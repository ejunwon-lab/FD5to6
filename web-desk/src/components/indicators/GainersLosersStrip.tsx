import { useMemo } from 'react'
import type { Indicator } from '../../lib/types'
import { Panel } from '../ui/Panel'

interface Props { indicators: Indicator[] }

export function GainersLosersStrip({ indicators }: Props) {
  const { gainers, losers } = useMemo(() => {
    const valid = indicators.filter((i) => Number.isFinite(i.changePct))
    const sorted = [...valid].sort((a, b) => b.changePct - a.changePct)
    return {
      gainers: sorted.slice(0, 3),
      losers: sorted.slice(-3).reverse(),
    }
  }, [indicators])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
      <Panel title="Top Gainers" meta="3 best">
        <div className="divide-y divide-line-dim">
          {gainers.map((g, i) => <Row key={g.symbol} ind={g} rank={i + 1} tone="gain" />)}
          {gainers.length === 0 && <Empty />}
        </div>
      </Panel>
      <Panel title="Top Losers" meta="3 worst">
        <div className="divide-y divide-line-dim">
          {losers.map((l, i) => <Row key={l.symbol} ind={l} rank={i + 1} tone="loss" />)}
          {losers.length === 0 && <Empty />}
        </div>
      </Panel>
    </div>
  )
}

function Row({ ind, rank, tone }: { ind: Indicator; rank: number; tone: 'gain' | 'loss' }) {
  const up = ind.changePct >= 0
  const color = tone === 'gain' ? 'text-gain' : 'text-loss'
  const arrow = up ? '▲' : '▼'
  return (
    <div className="flex items-center px-3 py-2 hover:bg-bg-hover">
      <span className="text-ink-faint w-7 text-2xs tabular tracking-widest">#{String(rank).padStart(2, '0')}</span>
      <div className="flex-1 min-w-0">
        <div className="text-amber font-medium text-sm truncate">{ind.name || ind.symbol}</div>
        <div className="text-2xs text-ink-faint tabular truncate">{ind.symbol}</div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <div className="text-ink tabular text-sm">
          {ind.value.toLocaleString('en-US', { minimumFractionDigits: ind.value > 10000 ? 0 : 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`tabular text-xs ${color}`}>
          {arrow} {up ? '+' : ''}{ind.changePct.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

function Empty() {
  return <div className="text-center text-ink-faint py-6 text-xs">no data</div>
}
