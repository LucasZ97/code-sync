/**
 * PullPanel — list server patches, download & apply selected patch.
 */

import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { usePull } from '../../hooks'
import { useI18n } from '../../lib/i18n'
import { Badge, Button, ProgressBar, SectionHeader, EmptyState } from '../common'
import type { PatchInfo } from '../../types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PullPanel() {
  const { state } = useStore()
  const { listPatches, pull } = usePull()
  const { t } = useI18n()
  const [selected, setSelected] = useState<string | null>(null)

  const isBusy = state.progress.phase !== 'idle'

  // Reload patch list on mount / project/connection change
  useEffect(() => {
    if (state.activeProjectId && state.activeConnectionId) {
      listPatches()
    }
  }, [state.activeProjectId, state.activeConnectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePull = async () => {
    if (!selected) return
    const ok = await pull(selected)
    if (ok) setSelected(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      {isBusy && (
        <div className="px-4 pt-3">
          <ProgressBar percent={state.progress.percent} label={state.progress.message} />
        </div>
      )}

      {/* Patch list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <SectionHeader
          title={`${t('pull.title')} (${state.serverPatches.length})`}
          action={
            <Button variant="ghost" size="sm" onClick={listPatches} disabled={isBusy}>
              {t('pull.refresh')}
            </Button>
          }
        />

        {state.serverPatches.length === 0 ? (
          <EmptyState
            icon="☁"
            title={t('pull.empty_title')}
            description={t('pull.empty_desc')}
          />
        ) : (
          <ul className="space-y-1.5">
            {state.serverPatches.map((patch: PatchInfo) => {
              const isSelected = selected === patch.remote_path
              return (
                <li
                  key={patch.remote_path}
                  onClick={() => setSelected(isSelected ? null : patch.remote_path)}
                  className={`flex flex-col gap-1 px-3 py-2.5 rounded border cursor-pointer transition-colors
                    ${isSelected
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-white/8 bg-white/3 hover:bg-white/6'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Radio dot */}
                    <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center
                      ${isSelected ? 'border-indigo-500' : 'border-white/20'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                    </div>
                    <span className="text-xs text-gray-200 font-mono truncate flex-1" title={patch.filename}>
                      {patch.filename}
                    </span>
                    <Badge variant="muted">{formatBytes(patch.size_bytes)}</Badge>
                  </div>
                  <div className="pl-5 text-xs text-gray-500">{patch.modified_at}</div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Action bar */}
      <div className="px-4 py-3 border-t border-white/8 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={listPatches}
          disabled={!state.activeConnectionId || isBusy}
        >
          {t('pull.refresh_list')}
        </Button>

        <div className="flex-1" />

        <Button
          variant="primary"
          size="md"
          loading={isBusy}
          onClick={handlePull}
          disabled={!selected || isBusy}
        >
          {t('pull.button')}
        </Button>
      </div>
    </div>
  )
}
