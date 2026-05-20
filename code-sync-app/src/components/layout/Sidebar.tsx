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
    <nav className="mac-sidebar flex flex-col w-[68px] border-r shrink-0 px-2 py-3">
      {NAV_ITEMS.map(({ view, labelKey, icon }) => {
        const active = state.activeView === view
        return (
          <button
            key={view}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: view })}
            title={t(labelKey)}
            className={`relative flex flex-col items-center justify-center gap-1 py-2.5 mb-1 rounded-xl text-xs transition-all duration-150
              ${active
                ? 'text-white bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_8px_20px_rgba(0,0,0,0.12)]'
                : 'text-gray-500 hover:text-gray-200 hover:bg-white/7'
              }`}
          >
            {active && <span className="absolute left-[-8px] top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#0a84ff]" />}
            <span className="text-[18px] leading-none">{icon}</span>
            <span className="text-[10px] font-medium leading-none">{t(labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
