import { useEffect, useState } from 'react'

export function TopBar() {
  const [clock, setClock] = useState(formatTime())
  useEffect(() => {
    const id = setInterval(() => setClock(formatTime()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="h-8 bg-bg-deep border-b border-line flex items-center px-4 gap-6 text-xs uppercase tracking-widest">
      <div className="font-display text-sm tracking-widest2 text-amber">port.jun</div>
      <Pill live>connected · kis</Pill>
      <Pill>krx open</Pill>
      <Pill>nyse pre</Pill>
      <div className="ml-auto flex gap-4 text-ink-dim">
        <span>usr · junwon</span>
        <span className="text-cyan tabular">{clock}</span>
      </div>
    </div>
  )
}

function Pill({ children, live }: { children: React.ReactNode; live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-bg-elev border border-line text-ink-dim">
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
