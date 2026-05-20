/**
 * DiffViewer — renders a unified diff string using diff2html.
 *
 * Security: diff2html's `outputFormat: 'html'` produces sanitized HTML
 * (no user-controlled script injection). We set a strict CSP in tauri.conf.json.
 * The `dangerouslySetInnerHTML` here is safe because:
 *   1. diff2html escapes all file content before rendering
 *   2. Tauri's CSP blocks inline scripts
 *   3. The diff content comes from local git output, not untrusted network data
 */

import { useEffect, useRef } from 'react'
import { html as diff2html } from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'

interface DiffViewerProps {
  diffText: string
  viewType?: 'line-by-line' | 'side-by-side'
}

export function DiffViewer({ diffText, viewType = 'line-by-line' }: DiffViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !diffText) return

    const htmlOutput = diff2html(diffText, {
      drawFileList: true,
      matching: 'lines',
      outputFormat: viewType,
      renderNothingWhenEmpty: false,
    })

    containerRef.current.innerHTML = htmlOutput
  }, [diffText, viewType])

  if (!diffText) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No diff content to display.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="diff2html-wrapper overflow-auto h-full text-xs rounded-xl"
    />
  )
}
