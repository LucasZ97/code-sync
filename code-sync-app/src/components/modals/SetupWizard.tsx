/**
 * SetupWizard — first-run modal for configuring a project and server connection.
 */

import { useState } from 'react'
import { useStore } from '../../store'
import { useConfig } from '../../hooks'
import { useI18n } from '../../lib/i18n'
import { Button } from '../common'
import type { AppConfig } from '../../types'

interface WizardState {
  projectName: string
  localRepoPath: string
  serverName: string
  targetHost: string
  targetPort: string
  targetUsername: string
  remoteBaseDir: string
}

const INITIAL: WizardState = {
  projectName: '',
  localRepoPath: '',
  serverName: '',
  targetHost: '127.0.0.1',
  targetPort: '9000',
  targetUsername: '',
  remoteBaseDir: '/tmp/codesync/patches',
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function SetupWizard() {
  const { state, dispatch } = useStore()
  const { saveConfig } = useConfig()
  const { t } = useI18n()
  const [form, setForm] = useState<WizardState>(INITIAL)
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)

  if (!state.showWizard) return null

  const set = (key: keyof WizardState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const step1Valid = form.projectName.trim() && form.localRepoPath.trim()
  const step2Valid = form.serverName.trim() && form.targetHost.trim() && form.targetUsername.trim()

  const handleSave = async () => {
    setSaving(true)
    const connId = generateId('conn')
    const projId = generateId('proj')

    const config: AppConfig = {
      version: 1,
      patch_retention_days: 30,
      connections: [
        {
          id: connId,
          name: form.serverName.trim(),
          target_host: form.targetHost.trim(),
          target_port: Number(form.targetPort) || 22,
          target_username: form.targetUsername.trim(),
          remote_base_dir: form.remoteBaseDir.trim(),
        },
      ],
      projects: [
        {
          id: projId,
          name: form.projectName.trim(),
          local_repo_path: form.localRepoPath.trim(),
          connection_id: connId,
          syncignore_path: '',
          source_encoding_hint: '',
        },
      ],
    }

    await saveConfig(config)
    setSaving(false)
    dispatch({ type: 'SHOW_WIZARD', payload: false })
  }

  const stepLabel = step === 1 ? t('wizard.step1_label') : t('wizard.step2_label')

  return (
    <div className="mac-sheet-backdrop fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl">
      <div className="mac-modal w-full max-w-md mx-4 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8">
          <h2 className="text-base font-semibold text-gray-100">{t('wizard.title')}</h2>
          <p className="text-xs text-gray-400 mt-1">
            {t('wizard.step')} {step} {t('wizard.of')} 2 — {stepLabel}
          </p>
          {/* Progress dots */}
          <div className="flex gap-1.5 mt-3">
            {[1, 2].map(s => (
              <div key={s} className={`h-1 rounded-full flex-1 transition-colors
                ${s <= step ? 'bg-[linear-gradient(90deg,#0a84ff,#64d2ff)] shadow-[0_0_10px_rgba(10,132,255,0.32)]' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {step === 1 ? (
            <>
              <Field label={t('wizard.project_name')} placeholder="My App" value={form.projectName} onChange={set('projectName')} />
              <Field label={t('wizard.local_path')} placeholder="/Users/you/projects/app" value={form.localRepoPath} onChange={set('localRepoPath')} />
            </>
          ) : (
            <>
              <p className="text-xs text-[#9ed0ff] bg-[#0a84ff]/10 border border-[#0a84ff]/20 rounded-lg px-3 py-2">
                {t('wizard.tunnel_hint')}
              </p>
              <Field label={t('wizard.server_name')} placeholder="Linux Dev Server" value={form.serverName} onChange={set('serverName')} />
              <Field label={t('wizard.host')} placeholder="127.0.0.1" value={form.targetHost} onChange={set('targetHost')} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('wizard.port')} placeholder="9000" value={form.targetPort} onChange={set('targetPort')} type="number" />
                <Field label={t('wizard.username')} placeholder="dev" value={form.targetUsername} onChange={set('targetUsername')} />
              </div>
              <Field label={t('wizard.remote_dir')} placeholder="/tmp/codesync/patches" value={form.remoteBaseDir} onChange={set('remoteBaseDir')} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center gap-2">
          {step === 2 && (
            <Button variant="ghost" size="md" onClick={() => setStep(1)}>
              {t('wizard.back')}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="md" onClick={() => dispatch({ type: 'SHOW_WIZARD', payload: false })}>
            {t('wizard.skip')}
          </Button>
          {step === 1 ? (
            <Button variant="primary" size="md" disabled={!step1Valid} onClick={() => setStep(2)}>
              {t('wizard.next')}
            </Button>
          ) : (
            <Button variant="primary" size="md" disabled={!step2Valid} loading={saving} onClick={handleSave}>
              {t('wizard.save')}
            </Button>
          )}
        </div>
      </div>
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
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="mac-control w-full text-gray-100 text-sm rounded-lg px-3 py-2
          placeholder:text-gray-600"
      />
    </div>
  )
}
