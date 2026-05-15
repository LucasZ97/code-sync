//! Tauri application library.
//!
//! Registers all named Tauri commands and initialises AppState.
//! Architecture: React → named Tauri commands → Rust (complete business logic)

pub mod commands;
pub mod domain;
pub mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Config
            commands::config::config_load,
            commands::config::config_save,
            // Git
            commands::git::git_status,
            commands::git::patch_generate,
            commands::git::patch_apply,
            commands::git::patch_diff,
            // Connection
            commands::connection::connection_test,
            commands::connection::connection_add,
            commands::connection::connection_update,
            commands::connection::connection_delete,
            // Patch transport
            commands::patch::patch_upload,
            commands::patch::patch_download,
            commands::patch::patch_list,
            // History
            commands::history::history_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
