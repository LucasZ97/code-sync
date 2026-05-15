/**
 * TopBar — project/connection selectors, language toggle, settings.
 */

import { useStore } from '../../store'
import { useI18n } from '../../lib/i18n'
import { Button } from '../common'

interface TopBarProps {
  onOpenSettings: () => void
}

export function TopBar({ onOpenSettings }: TopBarProps) {
  const { state, dispatch, activeProject } = useStore()
  const { t, lang, setLang } = useI18n()

  const projects = state.config?.projects ?? []
  const connections = state.config?.connections ?? []

  return (
    <header className="flex items-center gap-3 px-4 h-12 border-b border-white/8 bg-gray-950/60 backdrop-blur-sm shrink-0">
      {/* App name */}
      <span className="text-sm font-semibold text-gray-100 tracking-tight mr-1">{t('app.name')}</span>

      <div className="w-px h-4 bg-white/10" />

      {/* Project selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">{t('topbar.project')}</span>
        <select
          value={state.activeProjectId ?? ''}
          onChange={e => dispatch({ type: 'SET_ACTIVE_PROJECT', payload: e.target.value })}
          className="bg-white/6 border border-white/10 text-gray-200 text-xs rounded px-2 py-1
            focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
        >
          {projects.length === 0 && <option value="">{t('topbar.no_projects')}</option>}
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Button variant="ghost" size="sm"
          onClick={() => dispatch({ type: 'SHOW_PROJECT_MANAGER', payload: true })}
          title={t('topbar.manage_projects')}>
          ✎
        </Button>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Connection selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">{t('topbar.server')}</span>
        <select
          value={state.activeConnectionId ?? ''}
          onChange={e => dispatch({ type: 'SET_ACTIVE_CONNECTION', payload: e.target.value })}
          className="bg-white/6 border border-white/10 text-gray-200 text-xs rounded px-2 py-1
            focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
        >
          {connections.length === 0 && <option value="">{t('topbar.no_servers')}</option>}
          {connections.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Button variant="ghost" size="sm"
          onClick={() => dispatch({ type: 'SHOW_SERVER_MANAGER', payload: true })}
          title={t('topbar.manage_servers')}>
          ✎
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Active project path hint */}
      {activeProject && (
        <span className="text-xs text-gray-600 truncate max-w-xs hidden md:block" title={activeProject.local_repo_path}>
          {activeProject.local_repo_path}
        </span>
      )}

      {/* Language toggle */}
      <div className="flex rounded border border-white/10 overflow-hidden">
        {(['en', 'zh'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-2 py-0.5 text-xs transition-colors
              ${lang === l
                ? 'bg-indigo-600 text-white'
                : 'bg-white/4 text-gray-400 hover:text-gray-200'
              }`}
          >
            {l === 'en' ? 'EN' : '中'}
          </button>
        ))}
      </div>

      {/* Settings */}
      <Button variant="ghost" size="sm" onClick={onOpenSettings} title={t('topbar.settings')}>
        ⚙
      </Button>
    </header>
  )
}
