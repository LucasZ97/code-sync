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

      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300 mb-3">
        {t('conflict.banner')}
      </div>

      {conflicts.map(({ path, rejContent }) => (
        <div key={path} className="border border-white/8 rounded-lg overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2 bg-white/4 cursor-pointer hover:bg-white/6"
            onClick={() => toggle(path)}
          >
            <span className="text-red-400 text-sm">✕</span>
            <span className="text-xs font-mono text-gray-200 flex-1 truncate">{path}.rej</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => { e.stopPropagation(); copyToClipboard(path, rejContent) }}
              className="!py-0 !px-1.5 text-[10px]"
            >
              {copied === path ? t('conflict.copied') : t('conflict.copy')}
            </Button>
            <span className="text-gray-600 text-xs">{expanded.has(path) ? '▾' : '▸'}</span>
          </div>

          {/* Rej content */}
          {expanded.has(path) && (
            <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed bg-gray-950/60">
              {rejContent.split('\n').map((line, i) => {
                const cls =
                  line.startsWith('+') ? 'text-green-400' :
                  line.startsWith('-') ? 'text-red-400' :
                  line.startsWith('@@') ? 'text-indigo-400' :
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
