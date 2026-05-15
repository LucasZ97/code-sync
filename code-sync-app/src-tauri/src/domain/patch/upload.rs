use std::path::Path;

use crate::domain::error::AppResult;
use crate::domain::ssh::client::SshClient;
use crate::domain::ssh::retry::with_retry;
use crate::domain::ssh::sftp::{sha256_file, upload_file};
use crate::domain::types::{ConnectionConfig, UploadResult};

/// Upload a patch file to the remote server.
/// Orchestrates: sha256 → ssh connect → sftp upload → verify.
pub async fn upload_patch(
    local_path: &str,
    project_id: &str,
    conn_cfg: &ConnectionConfig,
) -> AppResult<UploadResult> {
    let filename = Path::new(local_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("patch.codesync")
        .to_string();

    let local_sha256 = sha256_file(local_path)?;

    let remote_dir = format!(
        "{}/{}/{}",
        conn_cfg.remote_base_dir, project_id, conn_cfg.target_username
    );

    let conn_cfg = conn_cfg.clone();
    let local_path = local_path.to_string();
    let filename_clone = filename.clone();
    let remote_dir_clone = remote_dir.clone();

    let result = with_retry(|| {
        let conn_cfg = conn_cfg.clone();
        let local_path = local_path.clone();
        let filename = filename_clone.clone();
        let remote_dir = remote_dir_clone.clone();

        async move {
            let mut client = SshClient::connect(&conn_cfg).await?;
            upload_file(&mut client, &local_path, &remote_dir, &filename).await
        }
    })
    .await;

    match result {
        Ok((remote_path, skipped_existing)) => Ok(UploadResult {
            success: true,
            remote_path: Some(remote_path),
            sha256: Some(local_sha256),
            skipped_existing,
            error: None,
        }),
        Err(e) => Ok(UploadResult {
            success: false,
            remote_path: None,
            sha256: None,
            skipped_existing: false,
            error: Some(e.to_string()),
        }),
    }
}
