use tauri::State;

use crate::domain::config::store;
use crate::domain::types::AppConfig;
use crate::state::AppState;

/// Load the application configuration from disk.
#[tauri::command]
pub async fn config_load(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let cfg = tokio::task::spawn_blocking(store::load)
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
        .map_err(|e| e.to_string())?;
    *state.config.lock().await = cfg.clone();
    Ok(cfg)
}

/// Save the application configuration to disk.
#[tauri::command]
pub async fn config_save(config: AppConfig, state: State<'_, AppState>) -> Result<bool, String> {
    let cfg_clone = config.clone();
    tokio::task::spawn_blocking(move || store::save(&cfg_clone))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
        .map_err(|e| e.to_string())?;
    *state.config.lock().await = config;
    Ok(true)
}
