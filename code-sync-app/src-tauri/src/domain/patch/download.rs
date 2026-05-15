use crate::domain::error::AppResult;
use crate::domain::ssh::client::SshClient;
use crate::domain::ssh::retry::with_retry;
use crate::domain::ssh::sftp::download_file;
use crate::domain::types::{ConnectionConfig, DownloadResult};

/// Download a patch file from the remote server.
/// Orchestrates: ssh connect → sftp download → sha256 verify → local write.
pub async fn download_patch(
    remote_path: &str,
    conn_cfg: &ConnectionConfig,
) -> AppResult<DownloadResult> {
    // Download to the local patches directory
    let local_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("codesync")
        .join("patches");

    let local_dir_str = local_dir.to_string_lossy().into_owned();
    let conn_cfg = conn_cfg.clone();
    let remote_path = remote_path.to_string();
    let local_dir_clone = local_dir_str.clone();

    let result = with_retry(|| {
        let conn_cfg = conn_cfg.clone();
        let remote_path = remote_path.clone();
        let local_dir = local_dir_clone.clone();

        async move {
            let mut client = SshClient::connect(&conn_cfg).await?;
            download_file(&mut client, &remote_path, &local_dir).await
        }
    })
    .await;

    match result {
        Ok((local_path, sha256_verified)) => Ok(DownloadResult {
            success: true,
            local_path: Some(local_path),
            sha256_verified,
            error: None,
        }),
        Err(e) => Ok(DownloadResult {
            success: false,
            local_path: None,
            sha256_verified: false,
            error: Some(e.to_string()),
        }),
    }
}
