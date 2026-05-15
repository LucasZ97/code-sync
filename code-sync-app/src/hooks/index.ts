/**
 * Custom hooks wrapping IPC calls with loading/error state.
 */

import { useCallback } from 'react'
import { ipc } from '../lib/ipc'
import { useStore } from '../store'
import type {
  AppConfig,
  ConnectionConfig,
  ProjectConfig,
  GeneratedPatch,
  UploadResult,
  DownloadResult,
  ApplyResult,
} from '../types'

// ── Config ───────────────────────────────────────────────────────────────────

export function useConfig() {
  const { dispatch, log } = useStore()

  const loadConfig = useCallback(async () => {
    try {
      const config = await ipc.configLoad()
      dispatch({ type: 'SET_CONFIG', payload: config })
      // Auto-select first project — this also syncs the associated connection via the reducer
      if (config.projects.length > 0) {
        dispatch({ type: 'SET_ACTIVE_PROJECT', payload: config.projects[0].id })
        // If the project has no associated connection, fall back to the first available one
        const firstProject = config.projects[0]
        const hasAssociated = config.connections.some(c => c.id === firstProject.connection_id)
        if (!hasAssociated && config.connections.length > 0) {
          dispatch({ type: 'SET_ACTIVE_CONNECTION', payload: config.connections[0].id })
        }
      } else if (config.connections.length > 0) {
        dispatch({ type: 'SET_ACTIVE_CONNECTION', payload: config.connections[0].id })
      }
      // Show wizard if no projects configured
      if (config.projects.length === 0) {
        dispatch({ type: 'SHOW_WIZARD', payload: true })
      }
    } catch (err) {
      log('error', `Failed to load config: ${err}`)
    }
  }, [dispatch, log])

  const saveConfig = useCallback(async (config: AppConfig) => {
    try {
      await ipc.configSave(config)
      dispatch({ type: 'SET_CONFIG', payload: config })
      log('success', 'Configuration saved.')
    } catch (err) {
      log('error', `Failed to save config: ${err}`)
    }
  }, [dispatch, log])

  return { loadConfig, saveConfig }
}

// ── Git status ───────────────────────────────────────────────────────────────

export function useGitStatus() {
  const { state, dispatch, log } = useStore()

  const refresh = useCallback(async () => {
    if (!state.activeProjectId) return
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const statuses = await ipc.gitStatus(state.activeProjectId)
      dispatch({ type: 'SET_FILE_STATUSES', payload: statuses })
    } catch (err) {
      log('error', `Git status failed: ${err}`)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.activeProjectId, dispatch, log])

  return { refresh }
}

// ── Connection ────────────────────────────────────────────────────────────────

export function useConnection() {
  const { state, dispatch, log } = useStore()

  const testConnection = useCallback(async () => {
    if (!state.activeConnectionId) return false
    try {
      const result = await ipc.connectionTest(state.activeConnectionId)
      dispatch({ type: 'SET_CONNECTED', payload: result.success })
      log(result.success ? 'success' : 'error', result.success ? 'Connection successful.' : (result.error ?? 'Connection failed.'))
      return result.success
    } catch (err) {
      dispatch({ type: 'SET_CONNECTED', payload: false })
      log('error', `Connection test failed: ${err}`)
      return false
    }
  }, [state.activeConnectionId, dispatch, log])

  const testConnectionById = useCallback(async (connectionId: string) => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: { id: connectionId, status: 'testing' } })
    try {
      const result = await ipc.connectionTest(connectionId)
      dispatch({
        type: 'SET_CONNECTION_STATUS',
        payload: { id: connectionId, status: result.success ? 'connected' : 'failed' },
      })
      // Also update global isConnected if this is the active connection
      if (connectionId === state.activeConnectionId) {
        dispatch({ type: 'SET_CONNECTED', payload: result.success })
      }
      return result.success
    } catch {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: { id: connectionId, status: 'failed' } })
      return false
    }
  }, [state.activeConnectionId, dispatch])

  return { testConnection, testConnectionById }
}

// ── Push (generate + upload) ─────────────────────────────────────────────────

export function usePush() {
  const { state, dispatch, log } = useStore()

  const push = useCallback(async () => {
    if (!state.activeProjectId || !state.activeConnectionId) {
      log('error', 'No project or connection selected.')
      return false
    }

    // Step 1: Generate
    dispatch({ type: 'SET_PROGRESS', payload: { phase: 'generating', percent: 10, message: 'Generating patch...' } })
    log('info', 'Generating patch...')

    let patch: GeneratedPatch
    try {
      patch = await ipc.patchGenerate(
        state.activeProjectId,
        state.selectedFiles.size > 0 ? Array.from(state.selectedFiles) : undefined,
      )
    } catch (err) {
      log('error', `Generate failed: ${err}`)
      dispatch({ type: 'RESET_PROGRESS' })
      return false
    }

    log('success', `Patch generated: ${patch.patch_name} (${patch.files_changed} files)`)

    if (patch.path_warnings?.length > 0) {
      patch.path_warnings.forEach(w => log('warn', `Path warning: ${w.rel_path} — ${w.warning}`))
    }

    // Step 2: Upload
    dispatch({ type: 'SET_PROGRESS', payload: { phase: 'uploading', percent: 50, message: 'Uploading to server...' } })
    log('info', 'Uploading patch...')

    let uploadResult: UploadResult
    try {
      uploadResult = await ipc.patchUpload(
        patch.patch_path,
        state.activeProjectId,
        state.activeConnectionId,
      )
    } catch (err) {
      log('error', `Upload failed: ${err}`)
      dispatch({ type: 'RESET_PROGRESS' })
      return false
    }

    if (!uploadResult.success) {
      log('error', `Upload failed: ${uploadResult.error}`)
      dispatch({ type: 'RESET_PROGRESS' })
      return false
    }

    if (uploadResult.skipped_existing) {
      log('info', 'Upload skipped — identical patch already on server.')
    } else {
      log('success', `Uploaded to: ${uploadResult.remote_path}`)
    }

    dispatch({ type: 'SET_PROGRESS', payload: { phase: 'idle', percent: 100, message: 'Push complete!' } })
    setTimeout(() => dispatch({ type: 'RESET_PROGRESS' }), 2000)
    return true
  }, [state, dispatch, log])

  return { push }
}

// ── Pull (download + apply) ──────────────────────────────────────────────────

export function usePull() {
  const { state, dispatch, log } = useStore()

  const listPatches = useCallback(async () => {
    if (!state.activeProjectId || !state.activeConnectionId) return
    try {
      const patches = await ipc.patchList(state.activeProjectId, state.activeConnectionId)
      dispatch({ type: 'SET_SERVER_PATCHES', payload: patches })
    } catch (err) {
      log('error', `Failed to list patches: ${err}`)
    }
  }, [state.activeProjectId, state.activeConnectionId, dispatch, log])

  const pull = useCallback(async (remotePath: string) => {
    if (!state.activeProjectId || !state.activeConnectionId) return false

    // Step 1: Download
    dispatch({ type: 'SET_PROGRESS', payload: { phase: 'downloading', percent: 20, message: 'Downloading patch...' } })
    log('info', 'Downloading patch...')

    let dlResult: DownloadResult
    try {
      dlResult = await ipc.patchDownload(remotePath, state.activeConnectionId)
    } catch (err) {
      log('error', `Download failed: ${err}`)
      dispatch({ type: 'RESET_PROGRESS' })
      return false
    }

    if (!dlResult.success) {
      log('error', `Download failed: ${dlResult.error}`)
      dispatch({ type: 'RESET_PROGRESS' })
      return false
    }

    log('success', `Downloaded: ${dlResult.local_path} (SHA256 ${dlResult.sha256_verified ? '✓' : '⚠ unverified'})`)

    // Step 2: Apply
    dispatch({ type: 'SET_PROGRESS', payload: { phase: 'applying', percent: 60, message: 'Applying patch...' } })
    log('info', 'Applying patch...')

    let applyResult: ApplyResult
    try {
      applyResult = await ipc.patchApply(dlResult.local_path!, state.activeProjectId)
    } catch (err) {
      log('error', `Apply failed: ${err}`)
      dispatch({ type: 'RESET_PROGRESS' })
      return false
    }

    if (!applyResult.success) {
      log('error', `Apply failed: ${applyResult.error}`)
      dispatch({ type: 'RESET_PROGRESS' })
      return false
    }

    log('success', `Applied with strategy: ${applyResult.strategy_used}`)
    if (applyResult.conflict_files.length > 0) {
      log('warn', `${applyResult.conflict_files.length} conflict(s) — resolve .rej files manually.`)
    }

    dispatch({ type: 'SET_PROGRESS', payload: { phase: 'idle', percent: 100, message: 'Pull complete!' } })
    setTimeout(() => dispatch({ type: 'RESET_PROGRESS' }), 2000)
    return true
  }, [state, dispatch, log])

  return { listPatches, pull }
}

// ── Server Manager ────────────────────────────────────────────────────────────

export function useServerManager() {
  const { dispatch, log } = useStore()
  const { loadConfig } = useConfig()

  const addConnection = useCallback(async (conn: Omit<ConnectionConfig, 'id'> & { id: string }) => {
    try {
      await ipc.connectionAdd(conn)
      await loadConfig()
      log('success', `Server "${conn.name}" added.`)
    } catch (err) {
      log('error', `Failed to add server: ${err}`)
      throw err
    }
  }, [dispatch, log, loadConfig])

  const updateConnection = useCallback(async (conn: ConnectionConfig) => {
    try {
      await ipc.connectionUpdate(conn)
      await loadConfig()
      log('success', `Server "${conn.name}" updated.`)
    } catch (err) {
      log('error', `Failed to update server: ${err}`)
      throw err
    }
  }, [dispatch, log, loadConfig])

  const deleteConnection = useCallback(async (connectionId: string) => {
    try {
      await ipc.connectionDelete(connectionId)
      await loadConfig()
      log('success', 'Server deleted.')
    } catch (err) {
      log('error', `Failed to delete server: ${err}`)
      throw err
    }
  }, [dispatch, log, loadConfig])

  return { addConnection, updateConnection, deleteConnection }
}

// ── Project Manager ───────────────────────────────────────────────────────────

export function useProjectManager() {
  const { state, dispatch, log } = useStore()

  const addProject = useCallback(async (project: ProjectConfig) => {
    const config = state.config
    if (!config) return
    const updated: AppConfig = { ...config, projects: [...config.projects, project] }
    try {
      await ipc.configSave(updated)
      dispatch({ type: 'SET_CONFIG', payload: updated })
      log('success', `Project "${project.name}" added.`)
    } catch (err) {
      log('error', `Failed to add project: ${err}`)
      throw err
    }
  }, [state.config, dispatch, log])

  const updateProject = useCallback(async (project: ProjectConfig) => {
    const config = state.config
    if (!config) return
    const updated: AppConfig = {
      ...config,
      projects: config.projects.map(p => p.id === project.id ? project : p),
    }
    try {
      await ipc.configSave(updated)
      dispatch({ type: 'SET_CONFIG', payload: updated })
      log('success', `Project "${project.name}" updated.`)
    } catch (err) {
      log('error', `Failed to update project: ${err}`)
      throw err
    }
  }, [state.config, dispatch, log])

  const deleteProject = useCallback(async (projectId: string) => {
    const config = state.config
    if (!config) return
    const updated: AppConfig = {
      ...config,
      projects: config.projects.filter(p => p.id !== projectId),
    }
    try {
      await ipc.configSave(updated)
      dispatch({ type: 'SET_CONFIG', payload: updated })
      log('success', 'Project deleted.')
    } catch (err) {
      log('error', `Failed to delete project: ${err}`)
      throw err
    }
  }, [state.config, dispatch, log])

  return { addProject, updateProject, deleteProject }
}

// ── History ──────────────────────────────────────────────────────────────────

export function useHistory() {
  const { state, dispatch, log } = useStore()

  const loadHistory = useCallback(async () => {
    if (!state.activeProjectId) return
    try {
      const entries = await ipc.historyList(state.activeProjectId)
      dispatch({ type: 'SET_HISTORY', payload: entries })
    } catch (err) {
      log('error', `Failed to load history: ${err}`)
    }
  }, [state.activeProjectId, dispatch, log])

  return { loadHistory }
}
