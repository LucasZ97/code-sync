use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::domain::types::AppConfig;

/// Shared application state managed by Tauri.
pub struct AppState {
    /// Cached application configuration.
    pub config: Arc<Mutex<AppConfig>>,
    /// SSH connection pool: connection_id → client handle.
    /// Avoids re-handshaking on every command (handshake costs 200-500ms).
    pub ssh_pool: Arc<Mutex<HashMap<String, Arc<crate::domain::ssh::client::SshClient>>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            config: Arc::new(Mutex::new(AppConfig::default())),
            ssh_pool: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
