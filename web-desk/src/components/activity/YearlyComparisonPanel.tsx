import { useMemo } from 'react'
import { Panel } from '../ui/Panel'
import type { MonthlyRealizedItem } from '../../api/gasApi'

interface YearStat {
  year: string
  profit: number
  trades: number
  winCount: number
  fee: number
}

export function YearlyComparisonPanel({ entries }: { entries: ReadonlyArray<MonthlyRealizedItem> }) {
  const data = useMemo<YearStat[]>(() => {
    const byYear = new Map<string, YearStat>()
    entries.forEach((e) => {
      const y = e.month.slice(0, 4)
      if (!byYear.has(y)) byYear.set(y, { year: y, profit: 0, trades: 0, winCount: 0, fee: 0 })
      const g = byYear.get(y)!
      g.profit += e.profit
      g.trades += 1
      g.winCount += e.profit > 0 ? 1 : 0
      g.fee += e.fee ?? 0
    })
    return Array.from(byYear.values()).sort((a, b) => b.year.localeCompare(a.year))
  }, [entries])

  if (data.length === 0) {
    return (
      <Panel title="Yearly Performance · YoY" meta="no data">
        <div className="px-3 py-6 text-center text-ink-faint text-xs">no closed trades</div>
      </Panel>
    )
  }

  const current = data[0]
  const prev = data[1] ?? null
  const yoyDiff = prev ? current.profit - prev.profit : null
  const yoyPct = prev && prev.profit !== 0
    ? ((current.profit - prev.profit) / Math.abs(prev.profit)) * 100
    : null

  return (
    <Panel title="Yearly Performance · YoY" meta={`${data.length} year${data.length !== 1 ? 's' : ''}`}>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <YearCard stat={current} highlight />
          {prev && <YearCard stat={prev} />}
          {!prev && (
            <div className="bg-bg-deep border border-line px-3 py-3 flex items-center justify-center text-xs text-ink-faint">
              비교할 작년 데이터 없음
            </div>
          )}
        </div>
        {prev && yoyDiff !== null && (
          <div className="bg-bg-elev border border-line px-3 py-2 flex items-center justify-between flex-wrap gap-2">
            <div className="text-2xs uppercase tracking-widest text-ink-faint">
              YoY · {current.year} vs {prev.year}
            </div>
            <div className="flex items-center gap-3 text-sm tabular">
              <span className={yoyDiff >= 0 ? 'text-gain' : 'text-loss'}>
                {yoyDiff >= 0 ? '+' : ''}₩{Math.round(yoyDiff).toLocaleString('ko-KR')}
              </span>
              {yoyPct !== null && (
                <span className={yoyPct >= 0 ? 'text-gain' : 'text-loss'}>
                  ({yoyPct >= 0 ? '+' : ''}{yoyPct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}
        {data.length > 2 && (
          <div className="mt-3">
            <div className="text-xxs text-ink-faint uppercase tracking-widest mb-1.5">all years</div>
            <table className="w-full text-xs">
              <tbody>
                {data.map((d) => (
                  <tr key={d.year} className="border-b border-line-dim">
                    <td className="px-2 py-1.5 tabular">{d.year}</td>
                    <td className="px-2 py-1.5 text-right tabular text-ink-dim">{d.trades} closes</td>
                    <td className="px-2 py-1.5 text-right tabular text-ink-dim">
                      {d.trades ? Math.round((d.winCount / d.trades) * 100) : 0}% win
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular ${d.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {d.profit >= 0 ? '+' : ''}₩{Math.round(d.profit).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  )
}

function YearCard({ stat, highlight }: { stat: YearStat; highlight?: boolean }) {
  const winRate = stat.trades ? Math.round((stat.winCount / stat.trades) * 100) : 0
  return (
    <div className={`px-3 py-3 ${highlight ? 'bg-bg-elev border border-amber/40' : 'bg-bg-deep border border-line'}`}>
      <div className="text-xxs text-ink-faint uppercase tracking-widest mb-1">{stat.year}</div>
      <div className={`text-xl tabular font-medium ${stat.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
        {stat.profit >= 0 ? '+' : ''}₩{Math.round(stat.profit).toLocaleString('ko-KR')}
      </div>
      <div className="text-xxs text-ink-dim mt-1 tabular">
        {stat.trades} closes · {winRate}% win · ₩{Math.round(stat.fee).toLocaleString('ko-KR')} fees
      </div>
    </div>
  )
}
