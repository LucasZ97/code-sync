/**
 * Sidebar — navigation tabs (Push / Pull / History / Diff).
 */

import { useStore } from '../../store'
import { useI18n } from '../../lib/i18n'
import type { PanelView } from '../../types'

interface NavItem {
  view: PanelView
  labelKey: 'nav.push' | 'nav.pull' | 'nav.history' | 'nav.diff'
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { view: 'push',    labelKey: 'nav.push',    icon: '↑' },
  { view: 'pull',    labelKey: 'nav.pull',    icon: '↓' },
  { view: 'history', labelKey: 'nav.history', icon: '⏱' },
  { view: 'diff',    labelKey: 'nav.diff',    icon: '⊞' },
]

export function Sidebar() {
  const { state, dispatch } = useStore()
  const { t } = useI18n()

  return (
    <nav className="flex flex-col w-14 border-r border-white/8 bg-gray-950/40 shrink-0 pt-2">
      {NAV_ITEMS.map(({ view, labelKey, icon }) => {
        const active = state.activeView === view
        return (
          <button
            key={view}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: view })}
            title={t(labelKey)}
            className={`flex flex-col items-center justify-center gap-0.5 py-3 text-xs transition-colors
              ${active
                ? 'text-indigo-400 bg-indigo-500/10 border-r-2 border-indigo-500'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/4 border-r-2 border-transparent'
              }`}
          >
            <span className="text-base leading-none">{icon}</span>
            <span className="text-[10px]">{t(labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
