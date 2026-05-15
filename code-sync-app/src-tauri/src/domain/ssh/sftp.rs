use std::path::Path;

use russh_sftp::client::SftpSession;
use tokio::io::AsyncWriteExt;
use sha2::{Digest, Sha256};

use crate::domain::error::{AppError, AppResult};
use crate::domain::ssh::client::SshClient;
use crate::domain::types::PatchInfo;

/// Get or create an SFTP session from an SSH client.
pub async fn open_sftp(client: &mut SshClient) -> AppResult<SftpSession> {
    let channel = client
        .handle
        .channel_open_session()
        .await
        .map_err(|e| AppError::Sftp(format!("Failed to open channel: {e}")))?;

    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| AppError::Sftp(format!("Failed to request sftp subsystem: {e}")))?;

    SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| AppError::Sftp(format!("Failed to create SFTP session: {e}")))
}

/// Compute SHA256 of a local file.
pub fn sha256_file(path: &str) -> AppResult<String> {
    let data = std::fs::read(path).map_err(AppError::Io)?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}

/// Upload a local file to the remote server via SFTP.
/// Uses content-addressed deduplication and atomic rename.
pub async fn upload_file(
    client: &mut SshClient,
    local_path: &str,
    remote_dir: &str,
    filename: &str,
) -> AppResult<(String, bool)> {
    // (remote_path, skipped_existing)
    let remote_path = format!("{remote_dir}/{filename}");
    let remote_tmp = format!("{remote_path}.tmp");

    let local_sha256 = sha256_file(local_path)?;
    let local_data = std::fs::read(local_path).map_err(AppError::Io)?;

    let sftp = open_sftp(client).await?;

    // Ensure remote directory exists
    create_remote_dir_all(&sftp, remote_dir).await?;

    // Content-addressed dedup: check if same hash already on server
    if let Ok(existing_data) = sftp.read(remote_path.clone()).await {
        let mut hasher = Sha256::new();
        hasher.update(&existing_data);
        let existing_sha256 = hex::encode(hasher.finalize());
        if existing_sha256 == local_sha256 {
            tracing::info!("Skipping upload — identical file already on server: {remote_path}");
            return Ok((remote_path, true));
        }
    }

    // Write to temp file (create = CREATE | TRUNCATE | WRITE, works for new files)
    sftp.create(remote_tmp.clone())
        .await
        .map_err(|e| AppError::Sftp(format!("Failed to create temp file: {e}")))?
        .write_all(&local_data)
        .await
        .map_err(|e| AppError::Sftp(format!("Failed to write temp file: {e}")))?;

    // Verify integrity on server
    let uploaded_data = sftp
        .read(remote_tmp.clone())
        .await
        .map_err(|e| AppError::Sftp(format!("Failed to read back temp file: {e}")))?;

    let mut hasher = Sha256::new();
    hasher.update(&uploaded_data);
    let remote_sha256 = hex::encode(hasher.finalize());

    if remote_sha256 != local_sha256 {
        // Clean up corrupted temp file
        let _ = sftp.remove_file(remote_tmp.clone()).await;
        return Err(AppError::Integrity(format!(
            "Integrity check failed: local={} remote={}",
            &local_sha256[..12],
            &remote_sha256[..12]
        )));
    }

    // Atomic rename
    sftp.rename(remote_tmp, remote_path.clone())
        .await
        .map_err(|e| AppError::Sftp(format!("Atomic rename failed: {e}")))?;

    tracing::info!(
        "Uploaded {} → {} (sha256={})",
        filename,
        remote_path,
        &local_sha256[..12]
    );

    Ok((remote_path, false))
}

/// Download a remote file to a local directory via SFTP.
/// Returns (local_path, sha256_verified).
pub async fn download_file(
    client: &mut SshClient,
    remote_path: &str,
    local_dir: &str,
) -> AppResult<(String, bool)> {
    let filename = Path::new(remote_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("patch.codesync");

    let local_path = Path::new(local_dir).join(filename);
    std::fs::create_dir_all(local_dir).map_err(AppError::Io)?;

    let sftp = open_sftp(client).await?;

    // Get remote file data
    let remote_data = sftp
        .read(remote_path.to_string())
        .await
        .map_err(|e| AppError::Sftp(format!("Failed to read remote file: {e}")))?;

    // Compute remote SHA256 before writing
    let mut hasher = Sha256::new();
    hasher.update(&remote_data);
    let remote_sha256 = hex::encode(hasher.finalize());

    // Write local file
    std::fs::write(&local_path, &remote_data).map_err(AppError::Io)?;

    // Verify integrity
    let local_sha256 = sha256_file(&local_path.to_string_lossy())?;
    let sha256_verified = local_sha256 == remote_sha256;

    if !sha256_verified {
        let _ = std::fs::remove_file(&local_path);
        return Err(AppError::Integrity(format!(
            "Integrity check failed: remote={} local={}",
            &remote_sha256[..12],
            &local_sha256[..12]
        )));
    }

    tracing::info!(
        "Downloaded {} → {} (verified={})",
        remote_path,
        local_path.display(),
        sha256_verified
    );

    Ok((local_path.to_string_lossy().into_owned(), sha256_verified))
}

/// List .codesync patch files in a remote directory.
pub async fn list_patches(client: &mut SshClient, remote_dir: &str) -> AppResult<Vec<PatchInfo>> {
    let sftp = open_sftp(client).await?;

    let entries = match sftp.read_dir(remote_dir.to_string()).await {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()), // Directory doesn't exist yet
    };

    let mut patches = Vec::new();
    for entry in entries {
        let filename = entry.file_name();
        if !filename.ends_with(".codesync") {
            continue;
        }

        let remote_path = format!("{remote_dir}/{filename}");
        let size_bytes = entry.metadata().size.unwrap_or(0);
        let modified_at = entry
            .metadata()
            .mtime
            .map(|t| {
                chrono::DateTime::from_timestamp(t as i64, 0)
                    .map(|dt| dt.format("%b %d %H:%M").to_string())
                    .unwrap_or_else(|| t.to_string())
            })
            .unwrap_or_default();

        patches.push(PatchInfo {
            remote_path,
            filename,
            size_bytes,
            modified_at,
        });
    }

    // Sort by filename (newest first based on UUID prefix date)
    patches.sort_by(|a, b| b.filename.cmp(&a.filename));

    Ok(patches)
}

/// Recursively create remote directories (mkdir -p equivalent).
/// Creates each path component in order, ignoring "already exists" errors
/// but propagating genuine failures.
async fn create_remote_dir_all(sftp: &SftpSession, path: &str) -> AppResult<()> {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let mut current = String::new();

    for part in &parts {
        current = format!("{current}/{part}");

        match sftp.create_dir(current.clone()).await {
            Ok(_) => {
                tracing::debug!("Created remote directory: {current}");
            }
            Err(e) => {
                // Check if the directory already exists by trying to read it.
                // SFTP error code 4 = SSH_FX_FAILURE (often "already exists"),
                // error code 11 = SSH_FX_FILE_ALREADY_EXISTS.
                // The safest check is to verify the path is stat-able as a directory.
                if sftp.metadata(current.clone()).await.is_ok() {
                    // Path exists (file or dir) — continue
                    tracing::debug!("Remote path already exists: {current}");
                } else {
                    return Err(AppError::Sftp(format!(
                        "Failed to create remote directory '{current}': {e}"
                    )));
                }
            }
        }
    }

    Ok(())
}
