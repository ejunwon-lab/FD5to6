import { type ReactNode } from 'react'

interface Props {
  title: string
  meta?: string
  className?: string
  children: ReactNode
}

export function Panel({ title, meta, className = '', children }: Props) {
  return (
    <section className={`bg-bg-elev border border-line relative ${className}`}>
      <div className="flex justify-between items-center px-3 py-1.5 border-b border-line text-2xs uppercase tracking-widest text-ink-dim">
        <span className="text-ink font-semibold">{title}</span>
        {meta && <span className="text-ink-faint">{meta}</span>}
      </div>
      {children}
    </section>
  )
}
