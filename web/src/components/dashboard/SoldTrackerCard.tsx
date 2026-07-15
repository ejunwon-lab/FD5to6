import { Card } from '../ui/Card'
import { krwCompactSigned } from '../../utils/format'
import type { SoldTrackerItem } from '../../models/types'

// 매도 복기 — 판 종목의 "안 팔았다면 오늘 손익" vs "실제 실현손익".
// diff(판것대비차이) +면 더 벌 수 있었음(아쉬움, amber), −면 잘 팔았음(하락, emerald).
export function SoldTrackerCard({ items }: { items: SoldTrackerItem[] }) {
  if (!items || items.length === 0) return null

  // 국내(diff 계산된 것)만 합산 — 해외는 null
  const totalDiff = items.reduce((s, it) => s + (it.diff ?? 0), 0)
  const scored = items.filter(it => it.diff != null).length

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">매도 복기</p>
        <p className="text-[11px] text-gray-400">안 팔았다면?</p>
      </div>
      {/* 총 차이 요약 */}
      <div className="flex items-baseline justify-between border-b border-gray-100 dark:border-gray-700 pb-2 mb-2">
        <span className="text-xs text-gray-500">
          {totalDiff >= 0 ? '안 팔았다면 총' : '판 게 이득 총'}
        </span>
        <span className={`text-base font-bold tabular-nums ${totalDiff >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {krwCompactSigned(totalDiff)}
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto no-scrollbar -mx-1">
        {items.map((it, i) => {
          const hasWhatIf = it.diff != null
          const diffPositive = (it.diff ?? 0) >= 0
          return (
            <div key={`${it.code}-${it.sellDate}-${i}`}
              className="flex items-center justify-between px-1 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <div className="min-w-0 pr-2">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{it.name}</p>
                <p className="text-[11px] text-gray-400">
                  {it.sellDate.slice(5)} · {it.elapsedDays != null ? `${it.elapsedDays}일 전` : ''} ·{' '}
                  <span className={((it.realizedProfit ?? 0) >= 0) ? 'text-profit' : 'text-loss'}>
                    실현 {krwCompactSigned(it.realizedProfit ?? 0)}
                  </span>
                </p>
              </div>
              <div className="text-right shrink-0">
                {hasWhatIf ? (
                  <>
                    <p className={`text-sm font-bold tabular-nums ${diffPositive ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {krwCompactSigned(it.diff ?? 0)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {diffPositive ? '더 벌 수 있었음' : '잘 팔았음'}
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-400">해외 · 집계 제외</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {scored < items.length && (
        <p className="text-[10px] text-gray-400 mt-2">* 해외 종목은 환율 미반영으로 집계 제외</p>
      )}
    </Card>
  )
}
