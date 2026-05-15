use tauri::State;

use crate::domain::ssh::client::SshClient;
use crate::domain::types::{ConnectionConfig, ConnectionTestResult};
use crate::state::AppState;

/// Get the connection config by ID from state.
async fn get_connection(
    state: &State<'_, AppState>,
    connection_id: &str,
) -> Result<ConnectionConfig, String> {
    let config = state.config.lock().await;
    config
        .connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{connection_id}' not found"))
}

/// Test an SSH connection.
#[tauri::command]
pub async fn connection_test(
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<ConnectionTestResult, String> {
    let conn_cfg = get_connection(&state, &connection_id).await?;

    match SshClient::connect(&conn_cfg).await {
        Ok(mut client) => match client.test().await {
            Ok(output) if output.contains("codesync-ok") => {
                // Cache the connection
                let mut pool = state.ssh_pool.lock().await;
                pool.insert(connection_id, std::sync::Arc::new(client));
                Ok(ConnectionTestResult {
                    success: true,
                    latency_ms: None,
                    error: None,
                })
            }
            Ok(output) => Ok(ConnectionTestResult {
                success: false,
                latency_ms: None,
                error: Some(format!("Unexpected response: {output}")),
            }),
            Err(e) => Ok(ConnectionTestResult {
                success: false,
                latency_ms: None,
                error: Some(e.to_string()),
            }),
        },
        Err(e) => Ok(ConnectionTestResult {
            success: false,
            latency_ms: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Add a new connection to the config.
#[tauri::command]
pub async fn connection_add(
    connection: ConnectionConfig,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let mut config = state.config.lock().await;
    if config.connections.iter().any(|c| c.id == connection.id) {
        return Err(format!("Connection '{}' already exists", connection.id));
    }
    config.connections.push(connection);
    crate::domain::config::store::save(&config).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Update an existing connection in the config.
#[tauri::command]
pub async fn connection_update(
    connection: ConnectionConfig,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let mut config = state.config.lock().await;
    let pos = config
        .connections
        .iter()
        .position(|c| c.id == connection.id)
        .ok_or_else(|| format!("Connection '{}' not found", connection.id))?;
    config.connections[pos] = connection.clone();
    crate::domain::config::store::save(&config).map_err(|e| e.to_string())?;

    // Invalidate cached SSH connection
    let mut pool = state.ssh_pool.lock().await;
    pool.remove(&connection.id);

    Ok(true)
}

/// Delete a connection from the config.
#[tauri::command]
pub async fn connection_delete(
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let mut config = state.config.lock().await;
    let initial_len = config.connections.len();
    config.connections.retain(|c| c.id != connection_id);
    if config.connections.len() == initial_len {
        return Err(format!("Connection '{connection_id}' not found"));
    }
    crate::domain::config::store::save(&config).map_err(|e| e.to_string())?;

    // Remove from SSH pool
    let mut pool = state.ssh_pool.lock().await;
    pool.remove(&connection_id);

    Ok(true)
}
