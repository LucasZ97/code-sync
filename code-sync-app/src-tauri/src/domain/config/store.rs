use std::path::PathBuf;

use crate::domain::error::{AppError, AppResult};
use crate::domain::types::AppConfig;

/// Return the platform-specific config directory.
fn config_dir() -> PathBuf {
    if let Some(config_home) = dirs::config_dir() {
        config_home.join("codesync")
    } else {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".config")
            .join("codesync")
    }
}

/// Return the path to the config file.
pub fn config_path() -> PathBuf {
    config_dir().join("config.toml")
}

/// Load the application config from disk.
/// Returns a default config if the file does not exist.
pub fn load() -> AppResult<AppConfig> {
    let path = config_path();
    if !path.exists() {
        return Ok(AppConfig {
            version: 1,
            patch_retention_days: 30,
            ..Default::default()
        });
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Config(format!("Failed to read config: {e}")))?;

    toml::from_str::<AppConfig>(&content)
        .map_err(|e| AppError::Config(format!("Failed to parse config: {e}")))
}

/// Save the application config to disk atomically (write-then-rename).
pub fn save(cfg: &AppConfig) -> AppResult<()> {
    let path = config_path();
    let dir = path.parent().ok_or_else(|| {
        AppError::Config(format!(
            "Config path '{}' has no parent directory",
            path.display()
        ))
    })?;

    std::fs::create_dir_all(dir)
        .map_err(|e| AppError::Config(format!("Failed to create config dir: {e}")))?;

    let content = toml::to_string_pretty(cfg)
        .map_err(|e| AppError::Config(format!("Failed to serialize config: {e}")))?;

    // Atomic write: write to temp file then rename
    let tmp_path = path.with_extension("toml.tmp");
    std::fs::write(&tmp_path, &content)
        .map_err(|e| AppError::Config(format!("Failed to write temp config: {e}")))?;

    std::fs::rename(&tmp_path, &path)
        .map_err(|e| AppError::Config(format!("Failed to rename config: {e}")))?;

    tracing::info!("Config saved to {}", path.display());
    Ok(())
}
