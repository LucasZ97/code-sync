/**
 * IPC bridge — direct named Tauri commands (Rust backend).
 *
 * Each function maps 1:1 to a #[tauri::command] in the Rust backend.
 * Tauri 2 convention: frontend passes camelCase keys, Tauri auto-converts
 * to snake_case before matching Rust parameter names.
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  AppConfig,
  ConnectionConfig,
  ConnectionTestResult,
  FileStatus,
  GeneratedPatch,
  UploadResult,
  DownloadResult,
  ApplyResult,
  PatchInfo,
  PatchDiff,
  HistoryEntry,
} from '../types'

export const ipc = {
  // ── Config ──────────────────────────────────────────────────────────────
  configLoad: () =>
    invoke<AppConfig>('config_load'),

  configSave: (config: AppConfig) =>
    invoke<boolean>('config_save', { config }),

  // ── Git ─────────────────────────────────────────────────────────────────
  gitStatus: (projectId: string) =>
    invoke<FileStatus[]>('git_status', { projectId }),

  patchGenerate: (projectId: string, files?: string[]) =>
    invoke<GeneratedPatch>('patch_generate', {
      projectId,
      files: files ?? null,
    }),

  patchApply: (patchPath: string, projectId: string) =>
    invoke<ApplyResult>('patch_apply', {
      patchPath,
      projectId,
    }),

  patchDiff: (projectId: string) =>
    invoke<PatchDiff>('patch_diff', { projectId }),

  // ── Connection ──────────────────────────────────────────────────────────
  connectionTest: (connectionId: string) =>
    invoke<ConnectionTestResult>('connection_test', { connectionId }),

  connectionAdd: (connection: ConnectionConfig) =>
    invoke<boolean>('connection_add', { connection }),

  connectionUpdate: (connection: ConnectionConfig) =>
    invoke<boolean>('connection_update', { connection }),

  connectionDelete: (connectionId: string) =>
    invoke<boolean>('connection_delete', { connectionId }),

  // ── Patch transport ─────────────────────────────────────────────────────
  patchUpload: (patchPath: string, projectId: string, connectionId: string) =>
    invoke<UploadResult>('patch_upload', {
      patchPath,
      projectId,
      connectionId,
    }),

  patchDownload: (remotePath: string, connectionId: string) =>
    invoke<DownloadResult>('patch_download', {
      remotePath,
      connectionId,
    }),

  patchList: (projectId: string, connectionId: string) =>
    invoke<PatchInfo[]>('patch_list', {
      projectId,
      connectionId,
    }),

  // ── History ─────────────────────────────────────────────────────────────
  historyList: (projectId: string) =>
    invoke<HistoryEntry[]>('history_list', { projectId }),
}
