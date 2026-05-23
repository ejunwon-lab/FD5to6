import { useEffect, useState } from 'react'

interface Props { onMenuClick?: () => void }

export function TopBar({ onMenuClick }: Props) {
  const [clock, setClock] = useState(formatTime())
  useEffect(() => {
    const id = setInterval(() => setClock(formatTime()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="h-9 bg-bg-deep border-b border-line flex items-center px-3 gap-2 sm:gap-4 lg:gap-6 text-xs uppercase tracking-widest">
      {/* 햄버거 버튼 - lg 미만에서만 */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-amber p-1.5 -ml-1.5 hover:text-ink"
        aria-label="menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="font-display text-sm tracking-widest2 text-amber">port.jun</div>
      <Pill live className="hidden sm:inline-flex">CONNECTED · KIS</Pill>
      <Pill className="hidden md:inline-flex">KRX OPEN</Pill>
      <Pill className="hidden md:inline-flex">NYSE PRE</Pill>
      <div className="ml-auto flex gap-2 sm:gap-4 text-ink-dim items-center">
        <span className="hidden sm:inline">USR · JUNWON</span>
        <span className="text-cyan tabular">{clock}</span>
      </div>
    </div>
  )
}

function Pill({ children, live, className = '' }: { children: React.ReactNode; live?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 bg-bg-elev border border-line text-ink-dim ${className}`}>
      {live && <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" style={{ boxShadow: '0 0 8px #00ff7f' }} />}
      {children}
    </span>
  )
}

function formatTime(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss} kst`
}
