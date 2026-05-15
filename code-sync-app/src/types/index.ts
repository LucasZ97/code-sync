// Domain types mirroring Python api.py dataclasses

export type SyncRole = 'sender' | 'receiver' | 'both'

export type ApplyStrategy =
  | 'git_apply'
  | 'git_apply_ignore_ws'
  | 'git_apply_3way'
  | 'patch_p1'
  | 'git_apply_reject'

// ── Config ──────────────────────────────────────────────────────────────────

export interface ConnectionConfig {
  id: string
  name: string
  target_host: string
  target_port: number
  target_username: string
  remote_base_dir: string
}

export interface ProjectConfig {
  id: string
  name: string
  local_repo_path: string
  connection_id: string
  syncignore_path: string
  source_encoding_hint: string
}

export interface AppConfig {
  version: number
  connections: ConnectionConfig[]
  projects: ProjectConfig[]
  patch_retention_days: number
}

// ── Git status ───────────────────────────────────────────────────────────────

export interface FileStatus {
  rel_path: string
  status: 'staged' | 'unstaged' | 'untracked'
}

// ── Patch generation ─────────────────────────────────────────────────────────

export interface PathWarning {
  rel_path: string
  warning: string
}

export interface GeneratedPatch {
  patch_path: string
  patch_name: string
  project_id: string
  base_commit: string
  base_commit_msg: string
  files_changed: number
  sha256: string
  path_warnings: PathWarning[]
  excluded_files: Record<string, string>
}

// ── Upload / Download ────────────────────────────────────────────────────────

export interface UploadResult {
  success: boolean
  remote_path?: string
  sha256?: string
  skipped_existing: boolean
  error?: string
}

export interface PatchInfo {
  remote_path: string
  filename: string
  size_bytes: number
  modified_at: string
}

export interface DownloadResult {
  success: boolean
  local_path?: string
  sha256_verified: boolean
  error?: string
}

// ── Diff ─────────────────────────────────────────────────────────────────────

export interface PatchDiff {
  patch_name: string
  diff_text: string
  conflict_files: string[]
}

// ── Connection test ───────────────────────────────────────────────────────────

export interface ConnectionTestResult {
  success: boolean
  latency_ms?: number
  error?: string
}

// ── Apply ────────────────────────────────────────────────────────────────────

export interface ApplyResult {
  success: boolean
  strategy_used?: ApplyStrategy
  applied_files: string[]
  failed_files: string[]
  conflict_files: string[]
  stash_ref?: string
  error?: string
}

// ── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: number
  project_id: string
  direction: 'push' | 'pull'
  patch_name: string
  base_commit: string
  files_changed: number
  strategy_used?: string
  status: 'success' | 'partial' | 'failed'
  created_at: string
}

// ── IPC ──────────────────────────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params: Record<string, unknown>
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: string
  result?: T
  error?: { code: number; message: string }
}

// ── UI state ─────────────────────────────────────────────────────────────────

export type PanelView = 'push' | 'pull' | 'history' | 'diff'

export interface SyncProgress {
  phase: 'idle' | 'generating' | 'uploading' | 'downloading' | 'applying'
  percent: number
  message: string
}

export interface LogEntry {
  id: number
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  timestamp: string
}
