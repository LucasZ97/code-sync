/**
 * App — root layout: TopBar + Sidebar + main panel + LogPanel.
 * Wires up store, loads config on mount, shows setup wizard if needed.
 */

import { useEffect } from 'react'
import { StoreProvider } from './store'
import { useStore } from './store'
import { I18nProvider } from './lib/i18n'
import { useConfig } from './hooks'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { LogPanel } from './components/layout/LogPanel'
import { PushPanel } from './components/panels/PushPanel'
import { PullPanel } from './components/panels/PullPanel'
import { HistoryPanel } from './components/panels/HistoryPanel'
import { DiffPanel } from './components/panels/DiffPanel'
import { SetupWizard } from './components/modals/SetupWizard'
import { ServerManager } from './components/modals/ServerManager'
import { ProjectManager } from './components/modals/ProjectManager'

// ── Inner app (needs store context) ──────────────────────────────────────────

function AppInner() {
  const { state, dispatch } = useStore()
  const { loadConfig } = useConfig()

  // Load config once on mount
  useEffect(() => {
    loadConfig()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const panel = (() => {
    switch (state.activeView) {
      case 'push':    return <PushPanel />
      case 'pull':    return <PullPanel />
      case 'history': return <HistoryPanel />
      case 'diff':    return <DiffPanel />
    }
  })()

  return (
    <div className="app-shell flex flex-col h-screen text-gray-100 overflow-hidden select-none">
      {/* Top bar */}
      <TopBar onOpenSettings={() => dispatch({ type: 'SHOW_WIZARD', payload: true })} />

      {/* Middle: sidebar + panel */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="panel-surface flex-1 overflow-hidden">
          {panel}
        </main>
      </div>

      {/* Bottom log bar */}
      <LogPanel />

      {/* Setup wizard modal */}
      <SetupWizard />

      {/* Server manager modal */}
      <ServerManager />

      {/* Project manager modal */}
      <ProjectManager />
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <AppInner />
      </StoreProvider>
    </I18nProvider>
  )
}
