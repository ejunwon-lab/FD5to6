import { Panel } from '../ui/Panel'
import type { SymbolAgg } from '../../lib/todayInsights'

// 오늘 포트 변동 ₩의 주범 — 플러스 기여 Top 5 / 마이너스 기여 Top 5 (계좌 합산, ₩ 기준)
const TOP_N = 5

export function ContributionPanel({ aggs }: { aggs: SymbolAgg[] }) {
  const gainers = aggs.filter((a) => a.dayChange > 0).sort((a, b) => b.dayChange - a.dayChange).slice(0, TOP_N)
  const losers = aggs.filter((a) => a.dayChange < 0).sort((a, b) => a.dayChange - b.dayChange).slice(0, TOP_N)
  const maxAbs = Math.max(...gainers.map((a) => a.dayChange), ...losers.map((a) => -a.dayChange), 1)

  return (
    <Panel title="오늘의 기여도" meta="₩ 기준 · 계좌 합산">
      <div className="p-3 grid gap-1">
        {gainers.map((a) => <Row key={a.symbol} a={a} maxAbs={maxAbs} />)}
        {gainers.length > 0 && losers.length > 0 && <div className="border-t border-line-dim my-1" />}
        {losers.map((a) => <Row key={a.symbol} a={a} maxAbs={maxAbs} />)}
        {gainers.length === 0 && losers.length === 0 && (
          <div className="text-center text-ink-faint py-6 text-xs">오늘 변동 없음</div>
        )}
      </div>
    </Panel>
  )
}

function Row({ a, maxAbs }: { a: SymbolAgg; maxAbs: number }) {
  const up = a.dayChange > 0
  const toneClass = up ? 'text-gain' : 'text-loss'
  const barTone = up ? 'bg-gain' : 'bg-loss'
  const width = Math.min(100, (Math.abs(a.dayChange) / maxAbs) * 100)
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-amber font-medium text-xs truncate">{a.name}</span>
          <span className={`text-xs tabular ${toneClass} shrink-0`}>
            {up ? '+' : ''}₩{Math.round(a.dayChange).toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="h-1 bg-bg-elev mt-1 overflow-hidden">
          <div className={`h-full ${barTone}`} style={{ width: `${width}%` }} />
        </div>
      </div>
    </div>
  )
}
