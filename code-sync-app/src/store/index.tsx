/**
 * Global app store — React Context + useReducer.
 * Keeps UI state immutable: every update returns a new state object.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type {
  AppConfig,
  ProjectConfig,
  ConnectionConfig,
  FileStatus,
  PatchInfo,
  HistoryEntry,
  SyncProgress,
  LogEntry,
  PanelView,
} from '../types'

// ── State ────────────────────────────────────────────────────────────────────

export interface AppState {
  // Config
  config: AppConfig | null
  activeProjectId: string | null
  activeConnectionId: string | null

  // Git status
  fileStatuses: FileStatus[]
  selectedFiles: Set<string>

  // Server patches
  serverPatches: PatchInfo[]

  // History
  history: HistoryEntry[]

  // UI
  activeView: PanelView
  progress: SyncProgress
  logs: LogEntry[]
  isConnected: boolean
  isLoading: boolean
  error: string | null

  // Connection statuses per connection id
  connectionStatuses: Record<string, 'testing' | 'connected' | 'failed' | 'unknown'>

  // Setup wizard
  showWizard: boolean
  // Server manager
  showServerManager: boolean
  // Project manager
  showProjectManager: boolean
}

const initialProgress: SyncProgress = { phase: 'idle', percent: 0, message: '' }

const initialState: AppState = {
  config: null,
  activeProjectId: null,
  activeConnectionId: null,
  fileStatuses: [],
  selectedFiles: new Set(),
  serverPatches: [],
  history: [],
  activeView: 'push',
  progress: initialProgress,
  logs: [],
  isConnected: false,
  isLoading: false,
  error: null,
  connectionStatuses: {},
  showWizard: false,
  showServerManager: false,
  showProjectManager: false,
}

// ── Actions ──────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'SET_CONFIG'; payload: AppConfig }
  | { type: 'SET_ACTIVE_PROJECT'; payload: string }
  | { type: 'SET_ACTIVE_CONNECTION'; payload: string }
  | { type: 'SET_FILE_STATUSES'; payload: FileStatus[] }
  | { type: 'TOGGLE_FILE_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_FILES' }
  | { type: 'DESELECT_ALL_FILES' }
  | { type: 'SET_SERVER_PATCHES'; payload: PatchInfo[] }
  | { type: 'SET_HISTORY'; payload: HistoryEntry[] }
  | { type: 'SET_VIEW'; payload: PanelView }
  | { type: 'SET_PROGRESS'; payload: SyncProgress }
  | { type: 'RESET_PROGRESS' }
  | { type: 'ADD_LOG'; payload: Omit<LogEntry, 'id' | 'timestamp'> }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTION_STATUS'; payload: { id: string; status: 'testing' | 'connected' | 'failed' | 'unknown' } }
  | { type: 'SHOW_WIZARD'; payload: boolean }
  | { type: 'SHOW_SERVER_MANAGER'; payload: boolean }
  | { type: 'SHOW_PROJECT_MANAGER'; payload: boolean }

// ── Reducer ──────────────────────────────────────────────────────────────────

let _logId = 0

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.payload }

    case 'SET_ACTIVE_PROJECT': {
      // Auto-sync the associated connection when switching projects
      const project = state.config?.projects.find(p => p.id === action.payload)
      const newConnectionId = project?.connection_id ?? state.activeConnectionId
      return {
        ...state,
        activeProjectId: action.payload,
        activeConnectionId: newConnectionId,
        fileStatuses: [],
        selectedFiles: new Set(),
        isConnected: false,
      }
    }

    case 'SET_ACTIVE_CONNECTION':
      return { ...state, activeConnectionId: action.payload, isConnected: false }

    case 'SET_FILE_STATUSES':
      return {
        ...state,
        fileStatuses: action.payload,
        // Auto-select all non-excluded files
        selectedFiles: new Set(action.payload.map(f => f.rel_path)),
      }

    case 'TOGGLE_FILE_SELECTION': {
      const next = new Set(state.selectedFiles)
      if (next.has(action.payload)) next.delete(action.payload)
      else next.add(action.payload)
      return { ...state, selectedFiles: next }
    }

    case 'SELECT_ALL_FILES':
      return { ...state, selectedFiles: new Set(state.fileStatuses.map(f => f.rel_path)) }

    case 'DESELECT_ALL_FILES':
      return { ...state, selectedFiles: new Set() }

    case 'SET_SERVER_PATCHES':
      return { ...state, serverPatches: action.payload }

    case 'SET_HISTORY':
      return { ...state, history: action.payload }

    case 'SET_VIEW':
      return { ...state, activeView: action.payload }

    case 'SET_PROGRESS':
      return { ...state, progress: action.payload }

    case 'RESET_PROGRESS':
      return { ...state, progress: initialProgress }

    case 'ADD_LOG': {
      const entry: LogEntry = {
        id: ++_logId,
        timestamp: new Date().toISOString(),
        ...action.payload,
      }
      // Keep last 200 log entries
      const logs = [...state.logs, entry].slice(-200)
      return { ...state, logs }
    }

    case 'CLEAR_LOGS':
      return { ...state, logs: [] }

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload }

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connectionStatuses: { ...state.connectionStatuses, [action.payload.id]: action.payload.status },
      }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload }

    case 'SHOW_WIZARD':
      return { ...state, showWizard: action.payload }

    case 'SHOW_SERVER_MANAGER':
      return { ...state, showServerManager: action.payload }

    case 'SHOW_PROJECT_MANAGER':
      return { ...state, showProjectManager: action.payload }

    default:
      return state
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface StoreContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  // Derived helpers
  activeProject: ProjectConfig | null
  activeConnection: ConnectionConfig | null
  log: (level: LogEntry['level'], message: string) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const activeProject = state.config?.projects.find(p => p.id === state.activeProjectId) ?? null
  const activeConnection = state.config?.connections.find(c => c.id === state.activeConnectionId) ?? null

  const log = useCallback((level: LogEntry['level'], message: string) => {
    dispatch({ type: 'ADD_LOG', payload: { level, message } })
  }, [])

  return (
    <StoreContext.Provider value={{ state, dispatch, activeProject, activeConnection, log }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
