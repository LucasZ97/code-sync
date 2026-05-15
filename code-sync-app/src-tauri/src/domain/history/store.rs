use std::path::PathBuf;

use crate::domain::error::{AppError, AppResult};
use crate::domain::types::HistoryEntry;

/// Return the path to the history JSONL file.
fn history_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("codesync")
        .join("history.jsonl")
}

/// Append a history entry to the JSONL file.
pub fn append(entry: &HistoryEntry) -> AppResult<()> {
    let path = history_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(AppError::Io)?;
    }

    let line = serde_json::to_string(entry)
        .map_err(|e| AppError::Config(format!("Failed to serialize history entry: {e}")))?;

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(AppError::Io)?;

    writeln!(file, "{line}").map_err(AppError::Io)?;
    Ok(())
}

/// Read history entries for a project, newest first, limited to 100.
pub fn list(project_id: &str) -> AppResult<Vec<HistoryEntry>> {
    let path = history_path();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&path).map_err(AppError::Io)?;

    let mut entries: Vec<HistoryEntry> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<HistoryEntry>(line).ok())
        .filter(|e| e.project_id == project_id)
        .collect();

    // Reverse for newest-first
    entries.reverse();
    entries.truncate(100);

    Ok(entries)
}
