/** Shared UI primitives */

import React from 'react'

// ── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted'

const badgeColors: Record<BadgeVariant, string> = {
  success: 'bg-[#32d74b]/14 text-[#a8f5b4] border-[#32d74b]/26',
  warning: 'bg-[#ffd60a]/13 text-[#ffe985] border-[#ffd60a]/24',
  danger:  'bg-[#ff453a]/14 text-[#ffb4ae] border-[#ff453a]/28',
  info:    'bg-[#0a84ff]/14 text-[#9ed0ff] border-[#0a84ff]/28',
  muted:   'bg-white/7 text-gray-300 border-white/12',
}

export function Badge({ variant = 'muted', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium leading-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${badgeColors[variant]}`}>
      {children}
    </span>
  )
}

// ── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const btnStyles: Record<ButtonVariant, string> = {
  primary:   'bg-[linear-gradient(180deg,#2f9bff,#0071e3)] hover:bg-[linear-gradient(180deg,#47a8ff,#0a84ff)] text-white border-[#64d2ff]/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_8px_22px_rgba(10,132,255,0.22)]',
  secondary: 'bg-white/8 hover:bg-white/12 text-gray-100 border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_1px_rgba(0,0,0,0.2)]',
  danger:    'bg-[linear-gradient(180deg,#ff6961,#ff453a)] hover:bg-[linear-gradient(180deg,#ff7a73,#ff453a)] text-white border-[#ffb4ae]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_22px_rgba(255,69,58,0.18)]',
  ghost:     'bg-transparent hover:bg-white/8 text-gray-400 hover:text-gray-100 border-transparent',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const btnSizes = { sm: 'px-2.5 py-1 text-xs min-h-7', md: 'px-3.5 py-1.5 text-sm min-h-8', lg: 'px-5 py-2.5 text-sm min-h-10' }

export function Button({
  variant = 'secondary', size = 'md', loading, icon, children, className = '', disabled, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-all duration-150
        active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/35
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
    <div className="space-y-1.5">
      {label && <p className="text-xs text-gray-400">{label}</p>}
      <div className="h-1.5 bg-black/25 rounded-full overflow-hidden border border-white/8 shadow-inner">
        <div
          className="h-full bg-[linear-gradient(90deg,#0a84ff,#64d2ff)] rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(10,132,255,0.42)]"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  )
}

// ── StatusDot ────────────────────────────────────────────────────────────────

export function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-[#32d74b] shadow-[0_0_8px_rgba(50,215,75,0.9)]' : 'bg-gray-600'}`} />
  )
}

// ── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 min-h-8">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.08em]">{title}</h3>
      {action}
    </div>
  )
}

// ── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/7 text-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">{icon}</span>
      <p className="text-sm font-semibold text-gray-100">{title}</p>
      {description && <p className="text-xs text-gray-500 mt-1.5 max-w-xs leading-relaxed">{description}</p>}
    </div>
  )
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-950/92 text-gray-100
        text-xs rounded-md border border-white/12 whitespace-nowrap opacity-0 group-hover:opacity-100
        pointer-events-none transition-opacity z-50 shadow-xl backdrop-blur-xl">
        {content}
      </div>
    </div>
  )
}
