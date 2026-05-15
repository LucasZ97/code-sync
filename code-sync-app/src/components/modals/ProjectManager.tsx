/**
 * ProjectManager — modal for adding, editing, and deleting projects.
 * Opened via the "Manage Projects" button in TopBar.
 */

import { useState } from 'react'
import { useStore } from '../../store'
import { useProjectManager } from '../../hooks'
import { useI18n } from '../../lib/i18n'
import { Button } from '../common'
import type { ProjectConfig } from '../../types'

type View = 'list' | 'form'

interface FormState {
  id: string
  name: string
  local_repo_path: string
  connection_id: string
  syncignore_path: string
  source_encoding_hint: string
}

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  local_repo_path: '',
  connection_id: '',
  syncignore_path: '',
  source_encoding_hint: '',
}

function generateId() {
  return `proj-${Math.random().toString(36).slice(2, 9)}`
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProjectManager() {
  const { state, dispatch } = useStore()
  const { addProject, updateProject, deleteProject } = useProjectManager()
  const { t } = useI18n()

  const [view, setView] = useState<View>('list')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectConfig | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const projects = state.config?.projects ?? []
  const connections = state.config?.connections ?? []

  if (!state.showProjectManager) return null

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, id: generateId(), connection_id: connections[0]?.id ?? '' })
    setIsEditing(false)
    setView('form')
  }

  const openEdit = (project: ProjectConfig) => {
    setForm({
      id: project.id,
      name: project.name,
      local_repo_path: project.local_repo_path,
      connection_id: project.connection_id,
      syncignore_path: project.syncignore_path,
      source_encoding_hint: project.source_encoding_hint,
    })
    setIsEditing(true)
    setView('form')
  }

  const handleSave = async () => {
    setSaving(true)
    const project: ProjectConfig = {
      id: form.id,
      name: form.name.trim(),
      local_repo_path: form.local_repo_path.trim(),
      connection_id: form.connection_id,
      syncignore_path: form.syncignore_path.trim(),
      source_encoding_hint: form.source_encoding_hint.trim(),
    }
    try {
      if (isEditing) {
        await updateProject(project)
      } else {
        await addProject(project)
      }
      setView('list')
    } catch {
      // error already logged via hook
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    try {
      await deleteProject(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(String(err))
    }
  }

  const formValid = form.name.trim() && form.local_repo_path.trim()

  const close = () => dispatch({ type: 'SHOW_PROJECT_MANAGER', payload: false })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-100">{t('project.manager_title')}</h2>
            {view === 'list' && (
              <p className="text-xs text-gray-400 mt-0.5">{t('project.manager_desc')}</p>
            )}
          </div>
          <button onClick={close} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {view === 'list' ? (
            <>
              {projects.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">{t('project.empty')}</p>
              ) : (
                <ul className="space-y-2 mb-4">
                  {projects.map(project => {
                    const server = connections.find(c => c.id === project.connection_id)
                    return (
                      <li key={project.id}
                        className="flex items-center justify-between bg-white/4 border border-white/8 rounded-lg px-3 py-2.5">
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-sm text-gray-200 truncate">{project.name}</p>
                          <p className="text-xs text-gray-500 truncate">{project.local_repo_path}</p>
                          {server && (
                            <p className="text-xs text-gray-600 truncate">{server.name}</p>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(project)}>{t('project.edit')}</Button>
                          <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget(project); setDeleteError(null) }}>
                            <span className="text-red-400">{t('project.delete')}</span>
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <Button variant="primary" size="md" onClick={openAdd} className="w-full">
                {t('project.add')}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <Field label={t('project.name')} placeholder="My Project" value={form.name} onChange={set('name')} />
              <Field label={t('project.path')} placeholder="/home/user/myproject" value={form.local_repo_path} onChange={set('local_repo_path')} />
              <div className="space-y-1">
                <label className="text-xs text-gray-400">{t('project.server')}</label>
                <select
                  value={form.connection_id}
                  onChange={set('connection_id')}
                  className="w-full bg-white/6 border border-white/10 text-gray-200 text-sm rounded-md px-3 py-1.5
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="">— none —</option>
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <Field label={t('project.syncignore')} placeholder=".syncignore" value={form.syncignore_path} onChange={set('syncignore_path')} />
              <Field label={t('project.encoding')} placeholder="utf-8" value={form.source_encoding_hint} onChange={set('source_encoding_hint')} />
            </div>
          )}
        </div>

        {/* Footer */}
        {view === 'form' && (
          <div className="px-6 pb-6 flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={() => setView('list')}>{t('project.cancel')}</Button>
            <div className="flex-1" />
            <Button variant="primary" size="md" disabled={!formValid} loading={saving} onClick={handleSave}>
              {t('project.save')}
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <p className="text-sm text-gray-200">
              {t('project.delete_confirm')} <span className="font-semibold text-white">"{deleteTarget.name}"</span>?
            </p>
            {deleteError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="md" onClick={() => setDeleteTarget(null)}>{t('project.cancel')}</Button>
              <Button variant="primary" size="md" onClick={handleDeleteConfirm}>
                <span className="text-red-300">{t('project.delete')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label, placeholder, value, onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full bg-white/6 border border-white/10 text-gray-200 text-sm rounded-md px-3 py-1.5
          placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      />
    </div>
  )
}
