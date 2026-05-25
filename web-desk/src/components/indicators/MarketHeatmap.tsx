import { useMemo } from 'react'
import type { Indicator } from '../../lib/types'
import { Panel } from '../ui/Panel'

interface Props { indicators: Indicator[] }

export function MarketHeatmap({ indicators }: Props) {
  const sorted = useMemo(
    () => [...indicators]
      .filter((i) => Number.isFinite(i.changePct))
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)),
    [indicators]
  )

  return (
    <Panel title="Market Heatmap" meta={`${sorted.length} symbols · sorted by |Δ%|`}>
      <div className="p-2">
        <div className="grid gap-1 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
          {sorted.map((i) => <Cell key={i.symbol} ind={i} />)}
          {sorted.length === 0 && (
            <div className="col-span-full text-center text-ink-faint py-8 text-xs">no data</div>
          )}
        </div>
        <Legend />
      </div>
    </Panel>
  )
}

function Cell({ ind }: { ind: Indicator }) {
  const pct = ind.changePct
  const { bg, border, fg } = colorFor(pct)
  return (
    <div
      className={`relative px-2 py-2.5 border ${border} ${bg} ${fg} hover:brightness-125 transition-all`}
      title={`${ind.name || ind.symbol} · ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
    >
      <div className="text-amber font-medium text-xs truncate">{ind.name || ind.symbol}</div>
      <div className="text-xxs text-ink-faint tabular truncate">{ind.symbol}</div>
      <div className={`text-sm font-medium tabular mt-1 ${fg}`}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </div>
    </div>
  )
}

function Legend() {
  const stops = [-5, -2, -1, 0, 1, 2, 5]
  return (
    <div className="flex items-center gap-1 mt-3 px-1 text-2xs text-ink-faint tracking-widest uppercase">
      <span className="mr-2">Δ%</span>
      {stops.map((s) => {
        const { bg } = colorFor(s === 0 ? 0 : s * 0.9)
        return (
          <div key={s} className={`h-3 w-6 ${bg} border border-line`}>
            <span className="sr-only">{s}</span>
          </div>
        )
      })}
      <span className="ml-1 tabular">−5 … 0 … +5%</span>
    </div>
  )
}

function colorFor(pct: number): { bg: string; border: string; fg: string } {
  const a = Math.abs(pct)
  if (pct > 0) {
    if (a >= 5) return { bg: 'bg-gain/50', border: 'border-gain/60', fg: 'text-ink' }
    if (a >= 2) return { bg: 'bg-gain/30', border: 'border-gain/40', fg: 'text-gain' }
    if (a >= 1) return { bg: 'bg-gain/15', border: 'border-gain/25', fg: 'text-gain' }
    if (a > 0)  return { bg: 'bg-gain/5',  border: 'border-line',    fg: 'text-gain' }
  } else if (pct < 0) {
    if (a >= 5) return { bg: 'bg-loss/50', border: 'border-loss/60', fg: 'text-ink' }
    if (a >= 2) return { bg: 'bg-loss/30', border: 'border-loss/40', fg: 'text-loss' }
    if (a >= 1) return { bg: 'bg-loss/15', border: 'border-loss/25', fg: 'text-loss' }
    if (a > 0)  return { bg: 'bg-loss/5',  border: 'border-line',    fg: 'text-loss' }
  }
  return { bg: 'bg-bg-elev', border: 'border-line', fg: 'text-ink-dim' }
}
