/**
 * ServerManager — modal for adding, editing, and deleting server connections.
 * Opened via the "Manage Servers" button in TopBar.
 */

import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { useServerManager, useConnection } from '../../hooks'
import { useI18n } from '../../lib/i18n'
import { Button } from '../common'
import type { ConnectionConfig } from '../../types'

type View = 'list' | 'form'

interface FormState {
  id: string
  name: string
  target_host: string
  target_port: string
  target_username: string
  remote_base_dir: string
}

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  target_host: '127.0.0.1',
  target_port: '9000',
  target_username: '',
  remote_base_dir: '/tmp/codesync/patches',
}

function generateId() {
  return `conn-${Math.random().toString(36).slice(2, 9)}`
}

// ── Status dot ────────────────────────────────────────────────────────────────

type ConnStatus = 'testing' | 'connected' | 'failed' | 'unknown'

function StatusDot({ status }: { status: ConnStatus }) {
  const cls: Record<ConnStatus, string> = {
    unknown:   'bg-gray-500',
    testing:   'bg-yellow-400 animate-pulse',
    connected: 'bg-green-400',
    failed:    'bg-red-400',
  }
  const label: Record<ConnStatus, string> = {
    unknown:   '未检测',
    testing:   '检测中…',
    connected: '已连接',
    failed:    '连接失败',
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls[status]}`} />
      {label[status]}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ServerManager() {
  const { state, dispatch } = useStore()
  const { addConnection, updateConnection, deleteConnection } = useServerManager()
  const { testConnectionById } = useConnection()
  const { t } = useI18n()

  const [view, setView] = useState<View>('list')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ConnectionConfig | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set())

  const connections = state.config?.connections ?? []

  // Auto-test all connections when modal opens
  useEffect(() => {
    if (!state.showServerManager || connections.length === 0) return
    connections.forEach(conn => {
      testConnectionById(conn.id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.showServerManager])

  if (!state.showServerManager) return null

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, id: generateId() })
    setIsEditing(false)
    setView('form')
  }

  const openEdit = (conn: ConnectionConfig) => {
    setForm({
      id: conn.id,
      name: conn.name,
      target_host: conn.target_host,
      target_port: String(conn.target_port),
      target_username: conn.target_username,
      remote_base_dir: conn.remote_base_dir,
    })
    setIsEditing(true)
    setView('form')
  }

  const handleSave = async () => {
    setSaving(true)
    const conn: ConnectionConfig = {
      id: form.id,
      name: form.name.trim(),
      target_host: form.target_host.trim(),
      target_port: Number(form.target_port) || 22,
      target_username: form.target_username.trim(),
      remote_base_dir: form.remote_base_dir.trim(),
    }
    try {
      if (isEditing) {
        await updateConnection(conn)
      } else {
        await addConnection(conn)
      }
      setView('list')
      // Test the newly saved connection
      testConnectionById(conn.id)
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
      await deleteConnection(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(String(err))
    }
  }

  const handleTest = async (connId: string) => {
    setTestingIds(prev => new Set(prev).add(connId))
    await testConnectionById(connId)
    setTestingIds(prev => { const s = new Set(prev); s.delete(connId); return s })
  }

  const formValid = form.name.trim() && form.target_host.trim() && form.target_username.trim()

  const close = () => dispatch({ type: 'SHOW_SERVER_MANAGER', payload: false })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-100">{t('server.manager_title')}</h2>
            {view === 'list' && (
              <p className="text-xs text-gray-400 mt-0.5">{t('server.manager_desc')}</p>
            )}
          </div>
          <button onClick={close} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {view === 'list' ? (
            <>
              {/* Tunnel hint */}
              <p className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-md px-3 py-2 mb-4">
                {t('wizard.tunnel_hint')}
              </p>

              {/* Server list */}
              {connections.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">{t('server.empty')}</p>
              ) : (
                <ul className="space-y-2 mb-4">
                  {connections.map(conn => {
                    const status: ConnStatus = state.connectionStatuses[conn.id] ?? 'unknown'
                    const isTesting = testingIds.has(conn.id) || status === 'testing'
                    return (
                      <li key={conn.id}
                        className="flex items-center justify-between bg-white/4 border border-white/8 rounded-lg px-3 py-2.5">
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-sm text-gray-200 truncate">{conn.name}</p>
                          <p className="text-xs text-gray-500">{conn.target_username}@{conn.target_host}:{conn.target_port}</p>
                          <div className="mt-1">
                            <StatusDot status={status} />
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isTesting}
                            onClick={() => handleTest(conn.id)}
                          >
                            {isTesting ? '检测中' : '连接'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(conn)}>{t('server.edit')}</Button>
                          <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget(conn); setDeleteError(null) }}>
                            <span className="text-red-400">{t('server.delete')}</span>
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <Button variant="primary" size="md" onClick={openAdd} className="w-full">
                {t('server.add')}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <Field label={t('server.name')} placeholder="Linux Dev Server" value={form.name} onChange={set('name')} />
              <Field label={t('server.host')} placeholder="127.0.0.1" value={form.target_host} onChange={set('target_host')} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('server.port')} placeholder="9000" value={form.target_port} onChange={set('target_port')} type="number" />
                <Field label={t('server.username')} placeholder="dev" value={form.target_username} onChange={set('target_username')} />
              </div>
              <Field label={t('server.remote_dir')} placeholder="/tmp/codesync/patches" value={form.remote_base_dir} onChange={set('remote_base_dir')} />
            </div>
          )}
        </div>

        {/* Footer */}
        {view === 'form' && (
          <div className="px-6 pb-6 flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={() => setView('list')}>{t('server.cancel')}</Button>
            <div className="flex-1" />
            <Button variant="primary" size="md" disabled={!formValid} loading={saving} onClick={handleSave}>
              {t('server.save')}
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <p className="text-sm text-gray-200">
              {t('server.delete_confirm')} <span className="font-semibold text-white">"{deleteTarget.name}"</span>?
            </p>
            {deleteError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="md" onClick={() => setDeleteTarget(null)}>{t('server.cancel')}</Button>
              <Button variant="primary" size="md" onClick={handleDeleteConfirm}>
                <span className="text-red-300">{t('server.delete')}</span>
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
  label, placeholder, value, onChange, type = 'text',
}: {
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full bg-white/6 border border-white/10 text-gray-200 text-sm rounded-md px-3 py-1.5
          placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      />
    </div>
  )
}
