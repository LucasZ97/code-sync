use crate::domain::error::AppResult;
use crate::domain::ssh::client::SshClient;
use crate::domain::ssh::sftp::list_patches;
use crate::domain::types::{ConnectionConfig, PatchInfo};

/// List available patch files on the remote server for a project.
pub async fn list_remote_patches(
    project_id: &str,
    conn_cfg: &ConnectionConfig,
) -> AppResult<Vec<PatchInfo>> {
    let remote_dir = format!(
        "{}/{}/{}",
        conn_cfg.remote_base_dir, project_id, conn_cfg.target_username
    );

    let mut client = SshClient::connect(conn_cfg).await?;
    list_patches(&mut client, &remote_dir).await
}
