/**
 * LogPanel — collapsible bottom log bar showing sync activity.
 */

import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useI18n } from '../../lib/i18n'
import { Button } from '../common'

const levelColor: Record<string, string> = {
  info:    'text-gray-400',
  warn:    'text-amber-400',
  error:   'text-red-400',
  success: 'text-green-400',
}

const levelPrefix: Record<string, string> = {
  info:    '·',
  warn:    '⚠',
  error:   '✕',
  success: '✓',
}

export function LogPanel() {
  const { state, dispatch } = useStore()
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (expanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [state.logs, expanded])

  const latest = state.logs[state.logs.length - 1]

  return (
    <div className={`border-t border-white/8 bg-gray-950/60 shrink-0 transition-all duration-200 ${expanded ? 'h-48' : 'h-8'}`}>
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 h-8 cursor-pointer select-none hover:bg-white/4"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-xs text-gray-500 font-medium">{t('log.title')}</span>
        {latest && !expanded && (
          <span className={`text-xs truncate flex-1 ${levelColor[latest.level]}`}>
            {levelPrefix[latest.level]} {latest.message}
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {state.logs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={e => { e.stopPropagation(); dispatch({ type: 'CLEAR_LOGS' }) }}
              className="!py-0 !px-1 text-[10px]"
            >
              {t('log.clear')}
            </Button>
          )}
          <span className="text-gray-600 text-xs">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {/* Log entries */}
      {expanded && (
        <div className="h-40 overflow-y-auto px-3 py-1 font-mono text-xs space-y-0.5 select-text cursor-text">
          {state.logs.length === 0 ? (
            <p className="text-gray-600 italic">{t('log.empty')}</p>
          ) : (
            state.logs.map(entry => (
              <div key={entry.id} className="flex gap-2 items-start">
                <span className="text-gray-600 shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 ${levelColor[entry.level]}`}>
                  {levelPrefix[entry.level]}
                </span>
                <span className={`break-all ${levelColor[entry.level]}`}>
                  {entry.message}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
