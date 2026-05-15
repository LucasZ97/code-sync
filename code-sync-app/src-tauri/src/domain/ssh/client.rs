use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use russh::client::{self, Handle};
use russh::keys::key::PublicKey;

use crate::domain::error::{AppError, AppResult};
use crate::domain::types::ConnectionConfig;

// ── Known-hosts store ────────────────────────────────────────────────────────

/// Path to the known_hosts file: `~/.config/codesync/known_hosts.json`
fn known_hosts_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("codesync")
        .join("known_hosts.json")
}

/// Load the known_hosts map from disk.  Returns an empty map on any error.
fn load_known_hosts() -> HashMap<String, String> {
    let path = known_hosts_path();
    let Ok(data) = std::fs::read_to_string(&path) else {
        return HashMap::new();
    };
    serde_json::from_str(&data).unwrap_or_default()
}

/// Persist the known_hosts map to disk atomically (write-then-rename).
fn save_known_hosts(map: &HashMap<String, String>) -> std::io::Result<()> {
    let path = known_hosts_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    let data = serde_json::to_string_pretty(map).map_err(std::io::Error::other)?;
    std::fs::write(&tmp, data)?;
    std::fs::rename(&tmp, &path)
}

// ── Client handler ───────────────────────────────────────────────────────────

/// Client handler that enforces TOFU (Trust On First Use) host-key verification.
///
/// On first connection to a host, the server's public key is persisted to
/// `~/.config/codesync/known_hosts.json`.  On subsequent connections the stored
/// fingerprint is compared; a mismatch causes the connection to be rejected.
pub(crate) struct ClientHandler {
    /// `"host:port"` key used to look up / store the fingerprint.
    pub host_key: String,
}

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        // Encode the public key as a base64 fingerprint for storage.
        let fingerprint = server_public_key.fingerprint();

        let mut known = load_known_hosts();

        match known.get(&self.host_key) {
            Some(stored) => {
                if stored == &fingerprint {
                    tracing::debug!(
                        host = %self.host_key,
                        "SSH host key matches stored fingerprint"
                    );
                    Ok(true)
                } else {
                    tracing::error!(
                        host = %self.host_key,
                        stored = %stored,
                        received = %fingerprint,
                        "SSH host key MISMATCH — possible MITM attack"
                    );
                    // Returning Ok(false) causes russh to close the connection.
                    Ok(false)
                }
            }
            None => {
                // First connection: persist the key (TOFU).
                tracing::info!(
                    host = %self.host_key,
                    fingerprint = %fingerprint,
                    "SSH host key not yet known — trusting on first use"
                );
                known.insert(self.host_key.clone(), fingerprint);
                if let Err(e) = save_known_hosts(&known) {
                    // Non-fatal: log the error but allow the connection.
                    tracing::warn!("Failed to persist known_hosts: {e}");
                }
                Ok(true)
            }
        }
    }
}

// ── SshClient ────────────────────────────────────────────────────────────────

/// A connected SSH client handle.
pub struct SshClient {
    pub(crate) handle: Handle<ClientHandler>,
    pub username: String,
}

impl SshClient {
    /// Establish an SSH connection and authenticate.
    pub async fn connect(cfg: &ConnectionConfig) -> AppResult<Self> {
        let config = Arc::new(client::Config {
            inactivity_timeout: Some(Duration::from_secs(15)),
            keepalive_interval: Some(Duration::from_secs(30)),
            keepalive_max: 3,
            preferred: russh::Preferred {
                kex: std::borrow::Cow::Owned(vec![
                    russh::kex::CURVE25519,
                    russh::kex::CURVE25519_PRE_RFC_8731,
                    russh::kex::ECDH_SHA2_NISTP256,
                    russh::kex::ECDH_SHA2_NISTP384,
                    russh::kex::ECDH_SHA2_NISTP521,
                    russh::kex::DH_G16_SHA512,
                    russh::kex::DH_G14_SHA256,
                    russh::kex::DH_G14_SHA1,
                    russh::kex::DH_G1_SHA1,
                ]),
                ..russh::Preferred::default()
            },
            ..Default::default()
        });

        let addr = format!("{}:{}", cfg.target_host, cfg.target_port);
        let host_key = addr.clone();

        let stream = tokio::net::TcpStream::connect(&addr)
            .await
            .map_err(|e| AppError::Ssh(format!("TCP connect to {addr} failed: {e}")))?;

        let mut handle = client::connect_stream(config, stream, ClientHandler { host_key })
            .await
            .map_err(|e| AppError::Ssh(format!("SSH handshake failed: {e}")))?;

        let username = &cfg.target_username;
        let authenticated = try_authenticate(&mut handle, username).await?;

        if !authenticated {
            return Err(AppError::Ssh(format!(
                "SSH authentication failed for user '{username}' on {addr}"
            )));
        }

        tracing::info!("SSH connected to {addr} as {username}");

        Ok(Self {
            handle,
            username: username.clone(),
        })
    }

    /// Test the connection by running a simple echo command.
    pub async fn test(&mut self) -> AppResult<String> {
        let mut channel = self
            .handle
            .channel_open_session()
            .await
            .map_err(|e| AppError::Ssh(format!("Failed to open channel: {e}")))?;

        channel
            .exec(true, "echo codesync-ok")
            .await
            .map_err(|e| AppError::Ssh(format!("Failed to exec: {e}")))?;

        let mut output = String::new();
        loop {
            match channel.wait().await {
                Some(russh::ChannelMsg::Data { data }) => {
                    output.push_str(&String::from_utf8_lossy(&data));
                }
                Some(russh::ChannelMsg::Eof) | None => break,
                _ => {}
            }
        }

        Ok(output.trim().to_string())
    }
}

// ── Authentication ────────────────────────────────────────────────────────────

/// Try available authentication methods in order: none → SSH agent → public key files.
async fn try_authenticate(handle: &mut Handle<ClientHandler>, username: &str) -> AppResult<bool> {
    // Try "none" auth first — some servers (e.g. dev tunnels) allow it
    if handle.authenticate_none(username).await.unwrap_or(false) {
        tracing::debug!("Authenticated via none method");
        return Ok(true);
    }

    // Try SSH agent first (most common in dev environments)
    #[cfg(unix)]
    if let Ok(agent_sock) = std::env::var("SSH_AUTH_SOCK") {
        use russh_keys::agent::client::AgentClient;
        if let Ok(mut agent) = AgentClient::connect_uds(&agent_sock).await {
            if let Ok(identities) = agent.request_identities().await {
                for identity in identities {
                    if let Ok(agent2) = AgentClient::connect_uds(&agent_sock).await {
                        let (_, result) =
                            handle.authenticate_future(username, identity, agent2).await;
                        if result.unwrap_or(false) {
                            tracing::debug!("Authenticated via SSH agent");
                            return Ok(true);
                        }
                    }
                }
            }
        }
    }

    // Try default key files
    let ssh_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".ssh");

    for key_name in &["id_ed25519", "id_ecdsa", "id_rsa"] {
        let key_path = ssh_dir.join(key_name);
        if !key_path.exists() {
            continue;
        }

        match russh_keys::load_secret_key(&key_path, None) {
            Ok(key) => match handle.authenticate_publickey(username, Arc::new(key)).await {
                Ok(true) => {
                    tracing::debug!("Authenticated via public key: {}", key_path.display());
                    return Ok(true);
                }
                Ok(false) => continue,
                Err(e) => {
                    tracing::debug!("Public key auth failed for {}: {e}", key_path.display());
                    continue;
                }
            },
            Err(e) => {
                tracing::debug!("Failed to load key {}: {e}", key_path.display());
                continue;
            }
        }
    }

    Ok(false)
}
