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
  const hasProjects = projects.length > 0
  const hasConnections = connections.length > 0

  const openProjectManager = () => dispatch({ type: 'SHOW_PROJECT_MANAGER', payload: true })
  const openServerManager = () => dispatch({ type: 'SHOW_SERVER_MANAGER', payload: true })

  return (
    <header className="mac-toolbar flex items-center gap-3 px-4 h-13 border-b backdrop-blur-2xl shrink-0">
      <div className="flex items-center gap-2 mr-1" aria-hidden="true">
        <span className="traffic-dot bg-[#ff5f57]" />
        <span className="traffic-dot bg-[#ffbd2e]" />
        <span className="traffic-dot bg-[#28c840]" />
      </div>

      {/* App name */}
      <span className="text-sm font-semibold text-gray-100 tracking-tight mr-1">{t('app.name')}</span>

      <div className="mac-divider w-px h-5" />

      {/* Project selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">{t('topbar.project')}</span>
        {hasProjects ? (
          <select
            value={state.activeProjectId ?? projects[0]?.id ?? ''}
            onChange={e => dispatch({ type: 'SET_ACTIVE_PROJECT', payload: e.target.value })}
            className="mac-control mac-select min-w-36 text-gray-100 text-xs rounded-md px-2 py-1 cursor-pointer"
            title={activeProject?.local_repo_path ?? t('topbar.manage_projects')}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={openProjectManager}
            className="mac-empty-select min-w-36 text-xs rounded-md px-2 py-1"
            title={t('topbar.manage_projects')}
          >
            {t('project.add')}
          </button>
        )}
        <Button variant="ghost" size="sm"
          onClick={openProjectManager}
          className="text-gray-400 hover:text-gray-100"
          title={hasProjects ? t('topbar.manage_projects') : t('project.add')}>
          {hasProjects ? '✎' : '+'}
        </Button>
      </div>

      <div className="mac-divider w-px h-5" />

      {/* Connection selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">{t('topbar.server')}</span>
        {hasConnections ? (
          <select
            value={state.activeConnectionId ?? connections[0]?.id ?? ''}
            onChange={e => dispatch({ type: 'SET_ACTIVE_CONNECTION', payload: e.target.value })}
            className="mac-control mac-select min-w-36 text-gray-100 text-xs rounded-md px-2 py-1 cursor-pointer"
            title={state.activeConnectionId ? connections.find(c => c.id === state.activeConnectionId)?.target_host : t('topbar.manage_servers')}
          >
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={openServerManager}
            className="mac-empty-select min-w-36 text-xs rounded-md px-2 py-1"
            title={t('topbar.manage_servers')}
          >
            {t('server.add')}
          </button>
        )}
        <Button variant="ghost" size="sm"
          onClick={openServerManager}
          className="text-gray-400 hover:text-gray-100"
          title={hasConnections ? t('topbar.manage_servers') : t('server.add')}>
          {hasConnections ? '✎' : '+'}
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Active project path hint */}
      {activeProject && (
        <span className="text-xs text-gray-500 truncate max-w-xs hidden md:block font-mono" title={activeProject.local_repo_path}>
          {activeProject.local_repo_path}
        </span>
      )}

      {/* Language toggle */}
      <div className="segmented-control flex rounded-md overflow-hidden p-0.5">
        {(['en', 'zh'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-2 py-0.5 text-xs rounded transition-all
              ${lang === l
                ? 'bg-white/18 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-100'
              }`}
          >
            {l === 'en' ? 'EN' : '中'}
          </button>
        ))}
      </div>

      {/* Settings */}
      <Button variant="ghost" size="sm" onClick={onOpenSettings} className="text-gray-400 hover:text-gray-100" title={t('topbar.settings')}>
        ⚙
      </Button>
    </header>
  )
}
