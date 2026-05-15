/** Shared UI primitives */

import React from 'react'

// ── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted'

const badgeColors: Record<BadgeVariant, string> = {
  success: 'bg-green-500/15 text-green-400 border-green-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  danger:  'bg-red-500/15 text-red-400 border-red-500/30',
  info:    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  muted:   'bg-white/5 text-gray-400 border-white/10',
}

export function Badge({ variant = 'muted', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border font-medium ${badgeColors[variant]}`}>
      {children}
    </span>
  )
}

// ── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const btnStyles: Record<ButtonVariant, string> = {
  primary:   'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent',
  secondary: 'bg-white/8 hover:bg-white/12 text-gray-200 border-white/10',
  danger:    'bg-red-600/80 hover:bg-red-500 text-white border-transparent',
  ghost:     'bg-transparent hover:bg-white/6 text-gray-400 hover:text-gray-200 border-transparent',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const btnSizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-1.5 text-sm', lg: 'px-5 py-2.5 text-sm' }

export function Button({
  variant = 'secondary', size = 'md', loading, icon, children, className = '', disabled, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
        disabled:opacity-40 disabled:cursor-not-allowed
        ${btnStyles[variant]} ${btnSizes[size]} ${className}`}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  )
}

// ── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className="animate-spin text-current"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── ProgressBar ──────────────────────────────────────────────────────────────

export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-gray-400">{label}</p>}
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  )
}

// ── StatusDot ────────────────────────────────────────────────────────────────

export function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-gray-600'}`} />
  )
}

// ── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
      {action}
    </div>
  )
}

// ── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm font-medium text-gray-300">{title}</p>
      {description && <p className="text-xs text-gray-500 mt-1 max-w-xs">{description}</p>}
    </div>
  )
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-gray-100
        text-xs rounded border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100
        pointer-events-none transition-opacity z-50">
        {content}
      </div>
    </div>
  )
}
