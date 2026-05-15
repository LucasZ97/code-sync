use serde::{Deserialize, Serialize};

// ── Config types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub version: u32,
    pub projects: Vec<ProjectConfig>,
    pub connections: Vec<ConnectionConfig>,
    pub patch_retention_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub target_host: String,
    pub target_port: u16,
    pub target_username: String,
    pub remote_base_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub id: String,
    pub name: String,
    pub local_repo_path: String,
    pub connection_id: String,
    pub syncignore_path: String,
    pub source_encoding_hint: String,
}

// ── Git types ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStatus {
    pub rel_path: String,
    pub status: String, // "staged" | "unstaged" | "untracked"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathWarning {
    pub rel_path: String,
    pub warning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedPatch {
    pub patch_path: String,
    pub patch_name: String,
    pub project_id: String,
    pub base_commit: String,
    pub base_commit_msg: String,
    pub files_changed: usize,
    pub sha256: String,
    pub path_warnings: Vec<PathWarning>,
    pub excluded_files: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ApplyResult {
    pub success: bool,
    pub strategy_used: Option<String>,
    pub applied_files: Vec<String>,
    pub failed_files: Vec<String>,
    pub conflict_files: Vec<String>,
    pub stash_ref: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchDiff {
    pub patch_name: String,
    pub diff_text: String,
    pub conflict_files: Vec<String>,
}

// ── SSH / Transport types ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResult {
    pub success: bool,
    pub remote_path: Option<String>,
    pub sha256: Option<String>,
    pub skipped_existing: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchInfo {
    pub remote_path: String,
    pub filename: String,
    pub size_bytes: u64,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub local_path: Option<String>,
    pub sha256_verified: bool,
    pub error: Option<String>,
}

// ── History types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: u64,
    pub project_id: String,
    pub direction: String, // "push" | "pull"
    pub patch_name: String,
    pub base_commit: String,
    pub files_changed: usize,
    pub strategy_used: Option<String>,
    pub status: String, // "success" | "partial" | "failed"
    pub created_at: String,
}
