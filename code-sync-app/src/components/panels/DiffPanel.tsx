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
      <div className="px-4 py-2 border-b border-white/8 flex items-center gap-2 shrink-0">
        <SectionHeader
          title={patchDiff ? patchDiff.patch_name : t('diff.title')}
          action={
            <div className="flex items-center gap-1">
              {/* View mode toggle */}
              <div className="flex rounded border border-white/10 overflow-hidden">
                {(['line-by-line', 'side-by-side'] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-2 py-0.5 text-xs transition-colors
                      ${viewMode === mode
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/4 text-gray-400 hover:text-gray-200'
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
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 shrink-0">
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
              <div className="px-4 py-3 border-b border-white/8">
                <ConflictViewer conflicts={patchDiff.conflict_files.map(path => ({ path, rejContent: '' }))} />
              </div>
            )}

            {/* Diff viewer */}
            <div className="px-2 py-2 h-full">
              <DiffViewer diffText={patchDiff.diff_text} viewType={viewMode} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
