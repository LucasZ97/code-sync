use tauri::State;

use crate::domain::patch::download::download_patch;
use crate::domain::patch::list::list_remote_patches;
use crate::domain::patch::upload::upload_patch;
use crate::domain::types::{DownloadResult, PatchInfo, UploadResult};
use crate::state::AppState;

/// Upload a patch file to the remote server.
#[tauri::command]
pub async fn patch_upload(
    patch_path: String,
    project_id: String,
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<UploadResult, String> {
    let config = state.config.lock().await;
    let project = config
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{project_id}' not found"))?;
    let project_name = project.name.clone();
    let conn_cfg = config
        .connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{connection_id}' not found"))?;
    drop(config);

    upload_patch(&patch_path, &project_name, &conn_cfg)
        .await
        .map_err(|e| e.to_string())
}

/// Download a patch file from the remote server.
#[tauri::command]
pub async fn patch_download(
    remote_path: String,
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<DownloadResult, String> {
    let config = state.config.lock().await;
    let conn_cfg = config
        .connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{connection_id}' not found"))?;
    drop(config);

    download_patch(&remote_path, &conn_cfg)
        .await
        .map_err(|e| e.to_string())
}

/// List available patches on the remote server for a project.
#[tauri::command]
pub async fn patch_list(
    project_id: String,
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<PatchInfo>, String> {
    let config = state.config.lock().await;
    let project = config
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{project_id}' not found"))?;
    let project_name = project.name.clone();
    let conn_cfg = config
        .connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{connection_id}' not found"))?;
    drop(config);

    list_remote_patches(&project_name, &conn_cfg)
        .await
        .map_err(|e| e.to_string())
}
