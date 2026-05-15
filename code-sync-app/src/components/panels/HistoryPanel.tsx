/**
 * HistoryPanel — sync history for the active project.
 */

import { useEffect } from 'react'
import { useStore } from '../../store'
import { useHistory } from '../../hooks'
import { useI18n } from '../../lib/i18n'
import { Badge, Button, SectionHeader, EmptyState } from '../common'
import type { HistoryEntry } from '../../types'

const statusVariant: Record<HistoryEntry['status'], 'success' | 'warning' | 'danger'> = {
  success: 'success',
  partial: 'warning',
  failed:  'danger',
}

const directionIcon: Record<HistoryEntry['direction'], string> = {
  push: '↑',
  pull: '↓',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function HistoryPanel() {
  const { state } = useStore()
  const { loadHistory } = useHistory()
  const { t } = useI18n()

  useEffect(() => {
    if (state.activeProjectId) loadHistory()
  }, [state.activeProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <SectionHeader
          title={`${t('history.title')} (${state.history.length})`}
          action={
            <Button variant="ghost" size="sm" onClick={loadHistory}>
              {t('history.refresh')}
            </Button>
          }
        />

        {state.history.length === 0 ? (
          <EmptyState
            icon="⏱"
            title={t('history.empty_title')}
            description={t('history.empty_desc')}
          />
        ) : (
          <ul className="space-y-2">
            {[...state.history].reverse().map(entry => (
              <li
                key={entry.id}
                className="flex flex-col gap-1.5 px-3 py-2.5 rounded border border-white/8 bg-white/3"
              >
                {/* Top row */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${entry.direction === 'push' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                    {directionIcon[entry.direction]}
                  </span>
                  <span className="text-xs text-gray-200 font-mono truncate flex-1" title={entry.patch_name}>
                    {entry.patch_name}
                  </span>
                  <Badge variant={statusVariant[entry.status]}>{entry.status}</Badge>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 text-xs text-gray-500 pl-5">
                  <span>
                    {entry.files_changed} {entry.files_changed !== 1 ? t('history.files_plural') : t('history.files')}
                  </span>
                  {entry.strategy_used && <span>{t('history.via')} {entry.strategy_used}</span>}
                  <span className="font-mono">@{entry.base_commit}</span>
                  <span className="ml-auto">{formatDate(entry.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
