import { useMemo, useState } from 'react'
import type { Holding } from '../../lib/types'
import { Panel } from '../ui/Panel'

interface Props { holdings: Holding[] }

type Mode = 'value' | 'pct'

export function ContributionBar({ holdings }: Props) {
  const [mode, setMode] = useState<Mode>('value')

  const { rows, totalProfit, maxAbs } = useMemo(() => {
    const totalProfit = holdings.reduce((s, h) => s + h.opProfit, 0)
    const denom = Math.abs(totalProfit) || 1
    const sorted = [...holdings]
      .filter((h) => Number.isFinite(h.opProfit) && h.opProfit !== 0)
      .sort((a, b) => b.opProfit - a.opProfit) // 큰 양수 → 큰 음수
    const rows = sorted.map((h) => ({
      symbol: h.symbol,
      name: h.name,
      market: h.market,
      profit: h.opProfit,
      contribPct: (h.opProfit / denom) * 100,
      returnPct: h.returnPct,
    }))
    const maxAbs = rows.reduce((m, r) => Math.max(m, Math.abs(r.profit)), 0) || 1
    return { rows, totalProfit, maxAbs }
  }, [holdings])

  // 양/음 분리해서 상위 10/하위 10만 노출
  const topGainers = rows.filter((r) => r.profit > 0).slice(0, 10)
  const topLosers = rows.filter((r) => r.profit < 0).slice(-10).reverse()

  return (
    <Panel
      title="Profit Contribution"
      meta={`total ${totalProfit >= 0 ? '+' : ''}₩${Math.round(totalProfit).toLocaleString()}`}
      className="lg:col-span-2"
    >
      {/* Mode toggle */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line-dim text-2xs uppercase tracking-widest">
        <span className="text-ink-faint mr-1">view</span>
        <button
          onClick={() => setMode('value')}
          className={`px-2.5 py-0.5 border ${mode === 'value' ? 'bg-amber border-amber text-bg' : 'border-line text-ink-dim hover:text-ink'}`}
        >₩ P&L</button>
        <button
          onClick={() => setMode('pct')}
          className={`px-2.5 py-0.5 border ${mode === 'pct' ? 'bg-amber border-amber text-bg' : 'border-line text-ink-dim hover:text-ink'}`}
        >% of total</button>
        <span className="ml-auto text-ink-faint normal-case tracking-normal">
          top 10 + bottom 10 · 합계 기준 기여도
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line-dim">
        <Side title="Gainers" rows={topGainers} mode={mode} maxAbs={maxAbs} tone="gain" />
        <Side title="Losers"  rows={topLosers}  mode={mode} maxAbs={maxAbs} tone="loss" />
      </div>
    </Panel>
  )
}

interface Row {
  symbol: string
  name: string
  market: string
  profit: number
  contribPct: number
  returnPct: number
}

function Side({ title, rows, mode, maxAbs, tone }: { title: string; rows: Row[]; mode: Mode; maxAbs: number; tone: 'gain' | 'loss' }) {
  const barColor = tone === 'gain' ? 'bg-gain' : 'bg-loss'
  const textColor = tone === 'gain' ? 'text-gain' : 'text-loss'
  return (
    <div className="p-3">
      <div className={`text-2xs uppercase tracking-widest mb-2 ${textColor}`}>{title} · {rows.length}</div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const widthPct = (Math.abs(r.profit) / maxAbs) * 100
          const display = mode === 'value'
            ? `${r.profit >= 0 ? '+' : ''}₩${Math.round(r.profit).toLocaleString()}`
            : `${r.contribPct >= 0 ? '+' : ''}${r.contribPct.toFixed(1)}%`
          return (
            <div key={`${r.symbol}-${r.profit}`} className="text-2xs">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-amber font-medium text-xs truncate flex-1 normal-case">{r.name}</span>
                <span className="text-cyan text-xxs tracking-widest shrink-0">{r.market}</span>
                <span className="text-ink-faint text-xxs tabular shrink-0">{r.symbol}</span>
                <span className={`${textColor} tabular shrink-0`}>{display}</span>
              </div>
              <div className="h-1.5 bg-line w-full">
                <div className={`h-full ${barColor}`} style={{ width: `${Math.min(widthPct, 100)}%` }} />
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <div className="text-center text-ink-faint py-6 text-xs">none</div>}
      </div>
    </div>
  )
}

