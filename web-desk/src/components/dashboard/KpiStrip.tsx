import type { PortfolioSummary } from '../../lib/types'
import { fmtKRW, fmtPct } from '../../lib/format'

interface Props { summary: PortfolioSummary }

// 부호 → 표시 톤 (▲초록/▼빨강/중립). 하드코딩 'up' 금지 — 하락일에 초록 ▲로 표시되던 버그 (2026-07-23)
function signTone(n: number): 'up' | 'down' | 'neutral' {
  return n > 0 ? 'up' : n < 0 ? 'down' : 'neutral'
}

export function KpiStrip({ summary }: Props) {
  const netWorth = summary.totalValue + summary.cashReserve
  const flatN = Math.max(0, summary.positionsActive - summary.positionsGain - summary.positionsLoss)
  const cells = [
    {
      label: '총자산 (투자중 + 대기)',
      value: fmtKRW(netWorth),
      delta: `투자중 ${fmtKRW(summary.totalValue)} · 대기 ${fmtKRW(summary.cashReserve)}`,
      tone: 'neutral',
    },
    {
      label: 'Total Return',
      value: fmtKRW(summary.totalReturn, { signed: true }),
      delta: `${fmtPct(summary.totalReturnPct, { signed: true })} all-time`,
      tone: signTone(summary.totalReturn),
    },
    {
      label: 'Today P&L',
      value: fmtKRW(summary.todayPnl, { signed: true }),
      delta: `${fmtPct(summary.todayPct, { signed: true })} session`,
      tone: signTone(summary.todayPnl),
      highlight: true,
    },
    {
      label: 'Positions',
      value: `${summary.positionsActive}종목`,
      delta: `${summary.positionsGain} GAIN · ${summary.positionsLoss} LOSS · ${flatN} FLAT`,
      tone: 'neutral',
    },
    {
      label: 'Cash Reserve',
      value: fmtKRW(summary.cashReserve),
      delta: `${summary.cashPct.toFixed(1)}% of total`,
      tone: 'cyan',
    },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-line border border-line">
      {cells.map((c) => (
        <div key={c.label} className="bg-bg-elev px-3 sm:px-3.5 py-3 sm:py-3.5">
          <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1.5">{c.label}</div>
          <div className={`text-[18px] sm:text-[22px] font-medium tracking-tight tabular mb-0.5 ${
            c.highlight ? (c.tone === 'down' ? 'text-loss' : c.tone === 'up' ? 'text-gain' : 'text-ink') : 'text-ink'
          }`}>
            {c.value}
          </div>
          <div className={`text-xs tabular ${
            c.tone === 'up' ? 'text-gain' :
            c.tone === 'down' ? 'text-loss' :
            c.tone === 'cyan' ? 'text-cyan' :
            'text-ink-dim'
          }`}>
            {c.tone === 'up' && '▲ '}
            {c.tone === 'down' && '▼ '}
            {c.delta}
          </div>
        </div>
      ))}
    </div>
  )
}
