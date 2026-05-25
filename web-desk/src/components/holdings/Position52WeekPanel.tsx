import { Panel } from '../ui/Panel'
import type { Holding } from '../../lib/types'

const ROW_LIMIT = 12

export function Position52WeekPanel({ holdings }: { holdings: Holding[] }) {
  const valid = holdings.filter(
    (h) => h.high52 > 0 && h.low52 > 0 && h.high52 > h.low52 && h.currentPrice > 0,
  )
  const sorted = [...valid].sort((a, b) => b.weightPct - a.weightPct).slice(0, ROW_LIMIT)

  if (sorted.length === 0) {
    return (
      <Panel title="52-Week Position" meta="no data">
        <div className="px-3 py-6 text-center text-ink-faint text-xs">no 52w range data</div>
      </Panel>
    )
  }

  return (
    <Panel title="52-Week Position" meta={`top ${sorted.length} by weight`}>
      <div className="px-3 py-3 space-y-2.5">
        {sorted.map((h) => {
          const range = h.high52 - h.low52
          const pos = ((h.currentPrice - h.low52) / range) * 100
          const clamped = Math.max(0, Math.min(100, pos))
          const nearHigh = clamped >= 75
          const nearLow = clamped <= 25
          const markerTone = nearHigh ? 'bg-loss' : nearLow ? 'bg-gain' : 'bg-amber'
          const pctTone = nearHigh ? 'text-loss' : nearLow ? 'text-gain' : 'text-ink-dim'
          return (
            <div key={h.symbol} className="grid grid-cols-[140px_1fr_60px] items-center gap-3 text-xs">
              <div className="truncate">
                <div className="text-amber font-medium leading-tight truncate">{h.name}</div>
                <div className="text-xxs text-ink-faint tabular">{h.symbol}</div>
              </div>
              <div className="relative">
                <div className="h-2.5 bg-bg-elev border border-line relative overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 w-1 ${markerTone}`}
                    style={{ left: `calc(${clamped}% - 2px)` }}
                    title={`${Math.round(h.currentPrice).toLocaleString()} (${clamped.toFixed(1)}%)`}
                  />
                </div>
                <div className="flex justify-between text-2xs text-ink-faint tabular mt-0.5">
                  <span>{Math.round(h.low52).toLocaleString()}</span>
                  <span>{Math.round(h.high52).toLocaleString()}</span>
                </div>
              </div>
              <div className={`text-right tabular text-xs ${pctTone}`}>
                {clamped.toFixed(0)}%
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-3 pb-3 text-2xs text-ink-faint">
        position % = (current − 52w low) / (52w high − 52w low) · <span className="text-gain">≤25% green (저점 근처)</span> · <span className="text-loss">≥75% red (고점 근처)</span>
      </div>
    </Panel>
  )
}
