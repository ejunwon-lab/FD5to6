import { useMemo } from 'react'
import { Panel } from '../ui/Panel'
import { accountDisplay } from '../../lib/accountDisplay'
import type { Holding } from '../../lib/types'
import type { DayPercentile } from '../../lib/todayInsights'

// 오늘 ₩변동을 시장(KR/US)·계좌로 분해 + 오늘 등락의 최근 분포 내 위치
export function BreakdownPanel({ holdings, percentile }: { holdings: Holding[]; percentile: DayPercentile | null }) {
  const { markets, accounts } = useMemo(() => {
    const mkt = new Map<string, { dayChange: number; value: number }>()
    const acc = new Map<string, { dayChange: number; value: number }>()
    holdings.forEach((h) => {
      const m = mkt.get(h.market) ?? { dayChange: 0, value: 0 }
      m.dayChange += h.dayChange ?? 0
      m.value += h.value
      mkt.set(h.market, m)
      const key = accountDisplay(h.broker, h.accountType)
      const a = acc.get(key) ?? { dayChange: 0, value: 0 }
      a.dayChange += h.dayChange ?? 0
      a.value += h.value
      acc.set(key, a)
    })
    const toRows = (map: Map<string, { dayChange: number; value: number }>) =>
      [...map.entries()]
        .map(([label, v]) => ({
          label,
          dayChange: v.dayChange,
          pct: v.value - v.dayChange > 0 ? (v.dayChange / (v.value - v.dayChange)) * 100 : 0,
        }))
        .sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange))
    return { markets: toRows(mkt), accounts: toRows(acc) }
  }, [holdings])

  return (
    <Panel title="분해" meta="시장 · 계좌">
      <div className="p-3 grid gap-1">
        {markets.map((r) => (
          <BreakdownRow key={r.label} label={r.label === 'KR' ? '한국' : '미국'} dayChange={r.dayChange} pct={r.pct} strong />
        ))}
        <div className="border-t border-line-dim my-1" />
        {accounts.map((r) => (
          <BreakdownRow key={r.label} label={r.label} dayChange={r.dayChange} pct={r.pct} />
        ))}
      </div>
      {percentile && (
        <div className="px-3 py-2 border-t border-line text-2xs text-ink-dim">
          오늘은 최근 {percentile.n}거래일 중{' '}
          <span className={percentile.isUp ? 'text-gain' : 'text-loss'}>
            {percentile.isUp ? '상위' : '하위'} {Math.round(percentile.rankPct)}% {percentile.isUp ? '상승일' : '하락일'}
          </span>
        </div>
      )}
    </Panel>
  )
}

function BreakdownRow({ label, dayChange, pct, strong }: { label: string; dayChange: number; pct: number; strong?: boolean }) {
  const toneClass = dayChange > 0 ? 'text-gain' : dayChange < 0 ? 'text-loss' : 'text-ink-dim'
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`text-xs truncate ${strong ? 'text-ink font-medium' : 'text-ink-dim'}`}>{label}</span>
      <span className={`text-xs tabular shrink-0 ${toneClass}`}>
        {dayChange >= 0 ? '+' : ''}₩{Math.round(dayChange).toLocaleString('ko-KR')}
        <span className="text-ink-faint ml-1.5">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
      </span>
    </div>
  )
}
