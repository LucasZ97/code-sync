/**
 * DiffPanel — Phase 7 diff visualization with i18n support.
 */

import { useState } from 'react'
import { useStore } from '../../store'
import { ipc } from '../../lib/ipc'
import { useI18n } from '../../lib/i18n'
import { Button, SectionHeader, EmptyState, Badge } from '../common'
import { DiffViewer } from '../diff/DiffViewer'
import { ConflictViewer } from '../diff/ConflictViewer'
import type { PatchDiff } from '../../types'

type ViewMode = 'line-by-line' | 'side-by-side'

export function DiffPanel() {
  const { state, log } = useStore()
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<ViewMode>('line-by-line')
  const [patchDiff, setPatchDiff] = useState<PatchDiff | null>(null)
  const [loading, setLoading] = useState(false)

  const loadLastDiff = async () => {
    if (!state.activeProjectId) {
      log('error', 'No project selected.')
      return
    }
    setLoading(true)
    try {
      const result = await ipc.patchDiff(state.activeProjectId)
      setPatchDiff(result)
    } catch (err) {
      log('error', `Failed to load diff: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="mac-action-bar px-5 py-3 border-b flex items-center gap-2 shrink-0">
        <SectionHeader
          title={patchDiff ? patchDiff.patch_name : t('diff.title')}
          action={
            <div className="flex items-center gap-1">
              {/* View mode toggle */}
              <div className="segmented-control flex rounded-md overflow-hidden p-0.5">
                {(['line-by-line', 'side-by-side'] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-2.5 py-1 text-xs rounded transition-all
                      ${viewMode === mode
                        ? 'bg-white/18 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-100'
                      }`}
                  >
                    {mode === 'line-by-line' ? t('diff.unified') : t('diff.split')}
                  </button>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                loading={loading}
                onClick={loadLastDiff}
                disabled={!state.activeProjectId}
              >
                {t('diff.load')}
              </Button>
            </div>
          }
        />
      </div>

      {/* Conflict banner */}
      {patchDiff && patchDiff.conflict_files.length > 0 && (
        <div className="px-5 py-2.5 bg-[#ff453a]/10 border-b border-[#ff453a]/20 flex items-center gap-2 shrink-0">
          <Badge variant="danger">
            {patchDiff.conflict_files.length} {patchDiff.conflict_files.length !== 1 ? t('diff.conflicts_plural') : t('diff.conflicts')}
          </Badge>
          <span className="text-xs text-red-300">{t('diff.conflict_msg')}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!patchDiff ? (
          <div className="flex flex-col h-full items-center justify-center">
            <EmptyState
              icon="⊞"
              title={t('diff.no_diff')}
              description={t('diff.no_diff_desc')}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {/* Conflict viewer */}
            {patchDiff.conflict_files.length > 0 && (
              <div className="px-5 py-4 border-b border-white/8">
                <ConflictViewer conflicts={patchDiff.conflict_files.map(path => ({ path, rejContent: '' }))} />
              </div>
            )}

            {/* Diff viewer */}
            <div className="px-3 py-3 h-full">
              <DiffViewer diffText={patchDiff.diff_text} viewType={viewMode} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
