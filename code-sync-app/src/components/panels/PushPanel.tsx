/**
 * PushPanel — file status list + generate & upload controls.
 */

import { useEffect } from 'react'
import { useStore } from '../../store'
import { useGitStatus, usePush } from '../../hooks'
import { useI18n } from '../../lib/i18n'
import { Badge, Button, ProgressBar, SectionHeader, EmptyState, Tooltip } from '../common'
import type { FileStatus } from '../../types'

const statusVariant: Record<FileStatus['status'], 'warning' | 'success' | 'info'> = {
  unstaged: 'warning',
  staged:   'success',
  untracked: 'info',
}

export function PushPanel() {
  const { state, dispatch } = useStore()
  const { refresh } = useGitStatus()
  const { push } = usePush()
  const { t } = useI18n()

  // Load git status on mount / project change
  useEffect(() => {
    refresh()
  }, [state.activeProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const allSelected = state.fileStatuses.length > 0 &&
    state.fileStatuses.every(f => state.selectedFiles.has(f.rel_path))

  const isBusy = state.progress.phase !== 'idle'

  const handleSelectAll = () => {
    if (allSelected) dispatch({ type: 'DESELECT_ALL_FILES' })
    else dispatch({ type: 'SELECT_ALL_FILES' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      {isBusy && (
        <div className="px-5 pt-4">
          <ProgressBar percent={state.progress.percent} label={state.progress.message} />
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <SectionHeader
          title={`${t('push.title')} (${state.fileStatuses.length})`}
          action={
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={refresh} disabled={isBusy}>
                {t('push.refresh')}
              </Button>
              {state.fileStatuses.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {allSelected ? t('push.deselect_all') : t('push.select_all')}
                </Button>
              )}
            </div>
          }
        />

        {state.isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            {t('push.loading')}
          </div>
        ) : state.fileStatuses.length === 0 ? (
          <EmptyState
            icon="✓"
            title={t('push.empty_title')}
            description={t('push.empty_desc')}
          />
        ) : (
          <ul className="space-y-1.5">
            {state.fileStatuses.map(file => {
              const selected = state.selectedFiles.has(file.rel_path)
              return (
                <li
                  key={file.rel_path}
                  onClick={() => dispatch({ type: 'TOGGLE_FILE_SELECTION', payload: file.rel_path })}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all
                    ${selected ? 'mac-list-row-selected' : 'mac-list-row'}`}
                >
                  {/* Checkbox */}
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all
                    ${selected ? 'bg-[#0a84ff] border-[#64d2ff]/45 shadow-[0_0_0_2px_rgba(10,132,255,0.14)]' : 'border-white/20 bg-white/5'}`}>
                    {selected && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>

                  {/* File path */}
                  <span className="text-xs text-gray-200 font-mono truncate flex-1" title={file.rel_path}>
                    {file.rel_path}
                  </span>

                  {/* Status badge */}
                  <Badge variant={statusVariant[file.status]}>
                    {file.status}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Action bar */}
      <div className="mac-action-bar px-5 py-3 border-t flex items-center gap-2">
        <div className="flex-1" />

        <span className="text-xs text-gray-500">
          {state.selectedFiles.size} / {state.fileStatuses.length} {t('push.selected')}
        </span>

        <Tooltip content={
          !state.activeProjectId ? t('push.no_project') :
          !state.activeConnectionId ? t('push.no_server') :
          state.selectedFiles.size === 0 ? t('push.no_files') :
          t('push.tooltip')
        }>
          <Button
            variant="primary"
            size="md"
            loading={isBusy}
            onClick={push}
            disabled={
              !state.activeProjectId ||
              !state.activeConnectionId ||
              state.selectedFiles.size === 0 ||
              isBusy
            }
          >
            {t('push.button')}
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
