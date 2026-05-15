use tauri::State;

use crate::domain::history::store;
use crate::domain::types::HistoryEntry;
use crate::state::AppState;

/// List history entries for a project (newest first, max 100).
#[tauri::command]
pub async fn history_list(
    project_id: String,
    _state: State<'_, AppState>,
) -> Result<Vec<HistoryEntry>, String> {
    tokio::task::spawn_blocking(move || store::list(&project_id).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}
