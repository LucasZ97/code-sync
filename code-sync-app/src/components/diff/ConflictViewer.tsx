/**
 * ConflictViewer — displays .rej conflict files from a failed patch apply.
 */

import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { Badge, Button, SectionHeader } from '../common'

interface ConflictFile {
  path: string
  rejContent: string
}

interface ConflictViewerProps {
  conflicts: ConflictFile[]
}

export function ConflictViewer({ conflicts }: ConflictViewerProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState<Set<string>>(new Set(conflicts.map(c => c.path)))
  const [copied, setCopied] = useState<string | null>(null)

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const copyToClipboard = async (path: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopied(path)
    setTimeout(() => setCopied(null), 2000)
  }

  if (conflicts.length === 0) return null

  return (
    <div className="space-y-3">
      <SectionHeader
        title={`${t('conflict.title')} (${conflicts.length})`}
        action={
          <Badge variant="danger">
            {conflicts.length} {conflicts.length !== 1 ? t('conflict.rej_plural') : t('conflict.rej')}
          </Badge>
        }
      />

      <div className="rounded-xl border border-[#ff453a]/30 bg-[#ff453a]/8 p-3 text-xs text-[#ffb4ae] mb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {t('conflict.banner')}
      </div>

      {conflicts.map(({ path, rejContent }) => (
        <div key={path} className="mac-list-row rounded-xl overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 bg-white/4 cursor-pointer hover:bg-white/7"
            onClick={() => toggle(path)}
          >
            <span className="text-[#ff8a82] text-sm">✕</span>
            <span className="text-xs font-mono text-gray-200 flex-1 truncate">{path}.rej</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => { e.stopPropagation(); copyToClipboard(path, rejContent) }}
              className="!py-0 !px-1.5 !min-h-6 text-[10px]"
            >
              {copied === path ? t('conflict.copied') : t('conflict.copy')}
            </Button>
            <span className="text-gray-500 text-xs">{expanded.has(path) ? '⌄' : '›'}</span>
          </div>

          {/* Rej content */}
          {expanded.has(path) && (
            <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed bg-black/25">
              {rejContent.split('\n').map((line, i) => {
                const cls =
                  line.startsWith('+') ? 'text-[#a8f5b4]' :
                  line.startsWith('-') ? 'text-[#ffb4ae]' :
                  line.startsWith('@@') ? 'text-[#9ed0ff]' :
                  'text-gray-400'
                return (
                  <span key={i} className={`block ${cls}`}>{line || ' '}</span>
                )
              })}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
