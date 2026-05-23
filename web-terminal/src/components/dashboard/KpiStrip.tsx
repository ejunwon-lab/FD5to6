import type { PortfolioSummary } from '../../lib/types'
import { fmtKRW, fmtPct } from '../../lib/format'

interface Props { summary: PortfolioSummary }

export function KpiStrip({ summary }: Props) {
  const cells = [
    {
      label: 'Net Worth',
      value: fmtKRW(summary.totalValue),
      delta: `+${fmtKRW(summary.todayPnl)} (${fmtPct(summary.todayPct)})`,
      tone: 'up',
    },
    {
      label: 'Total Return',
      value: fmtKRW(summary.totalReturn, { signed: true }),
      delta: `${fmtPct(summary.totalReturnPct, { signed: true })} all-time`,
      tone: 'up',
    },
    {
      label: 'Today P&L',
      value: `+${fmtKRW(summary.todayPnl)}`,
      delta: `${fmtPct(summary.todayPct, { signed: true })} session`,
      tone: 'up',
      highlight: true,
    },
    {
      label: 'Positions',
      value: `${summary.positionsActive} / ${summary.positionsTotal}`,
      delta: `${summary.positionsGain} GAIN · ${summary.positionsLoss} LOSS`,
      tone: 'neutral',
    },
    {
      label: 'Cash Reserve',
      value: fmtKRW(summary.cashReserve),
      delta: `${summary.cashPct}% allocation`,
      tone: 'cyan',
    },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-line border border-line">
      {cells.map((c) => (
        <div key={c.label} className="bg-bg-elev px-3 sm:px-3.5 py-3 sm:py-3.5">
          <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1.5">{c.label}</div>
          <div className={`text-[18px] sm:text-[22px] font-medium tracking-tight tabular mb-0.5 ${c.highlight ? 'text-gain' : 'text-ink'}`}>
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
