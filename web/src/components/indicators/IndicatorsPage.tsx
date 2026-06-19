import { useState, useEffect, useCallback } from 'react'
import { gasApi } from '../../api/gasApi'
import { useAuth } from '../../auth/AuthContext'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { ReferenceIndicator } from '../../models/types'
import { formatUpdatedAtLine } from '../../utils/changeLabel'

const CATEGORY_ORDER = [
  '한국시장', '한국선물', '중국시장',
  '미국시장', '미국선물', 'AI/반도체', '빅테크',
  '상품', '매크로',
]

function formattedValue(v: number): string {
  if (v === 0) return '—'
  return Math.abs(v) >= 100 ? v.toFixed(2) : v.toFixed(3)
}

function formattedChange(v: number): string {
  if (v === 0) return '0.00'
  return (v >= 0 ? '+' : '') + v.toFixed(2)
}

function formattedPct(v: number): string {
  if (v === 0) return '0.00%'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function barColor(change: number): string {
  if (change === 0) return 'bg-gray-300 dark:bg-gray-600'
  return change > 0 ? 'bg-profit' : 'bg-loss'
}

function changeTextClass(change: number): string {
  if (change === 0) return 'text-gray-400'
  return change > 0 ? 'text-profit' : 'text-loss'
}

function IndicatorRow({ ind }: { ind: ReferenceIndicator }) {
  return (
    <div className="flex items-stretch">
      {/* left color bar */}
      <div className={`w-[3px] my-2 ml-2.5 rounded-full shrink-0 ${barColor(ind.change)}`} />

      <div className="flex items-center gap-2 flex-1 px-3 py-2.5">
        {/* name */}
        <p className="flex-1 text-[15px] font-medium truncate">{ind.name}</p>

        {/* value */}
        <p className="w-[88px] text-right text-[15px] font-semibold shrink-0">{formattedValue(ind.value)}</p>

        {/* change + pct */}
        <div className={`w-[72px] text-right shrink-0 ${changeTextClass(ind.change)}`}>
          <p className="text-[13px] font-semibold">{formattedChange(ind.change)}</p>
          <p className="text-[12px] font-medium">{formattedPct(ind.changePct)}</p>
        </div>
      </div>
    </div>
  )
}

export function IndicatorsPage() {
  const { getToken } = useAuth()
  const [indicators, setIndicators] = useState<ReferenceIndicator[]>([])
  const [updatedAt, setUpdatedAt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const fetch = useCallback(async (refresh = false) => {
    try {
      refresh ? setIsRefreshing(true) : setIsLoading(true)
      const token = await getToken()
      const res = await gasApi.getIndicators(token)
      if (res.success && res.indicators) {
        setIndicators(res.indicators)
        setUpdatedAt(res.updatedAt ?? '')
        setError('')
      } else {
        setError(res.error ?? '조회 실패')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      refresh ? setIsRefreshing(false) : setIsLoading(false)
    }
  }, [getToken])

  useEffect(() => { fetch() }, [fetch])

  const grouped = indicators.reduce<Record<string, ReferenceIndicator[]>>((acc, ind) => {
    acc[ind.category] = [...(acc[ind.category] ?? []), ind]
    return acc
  }, {})

  const orderedCategories = [
    ...CATEGORY_ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)),
  ]

  return (
    <div className="h-[100dvh] overflow-y-auto no-scrollbar bg-[rgb(var(--page-bg))] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[rgb(var(--page-bg))] px-4 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[28px] font-bold">참고지표</h2>
          <button
            onClick={() => fetch(true)}
            disabled={isRefreshing}
            className="w-11 h-11 rounded-full bg-black/5 dark:bg-white/10 backdrop-blur flex items-center justify-center text-lg disabled:opacity-40 active:scale-90 transition-all"
          >
            {isRefreshing ? (
              <span className="w-4 h-4 border-2 border-gray-400/40 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin block" />
            ) : '↻'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner message="지표 불러오는 중..." />
      ) : error ? (
        <div className="px-4">
          <Card className="p-4 text-sm text-red-500">{error}</Card>
        </div>
      ) : (
        <div className="px-4 space-y-5">
          {orderedCategories.map(category => (
            <div key={category}>
              <p className="text-xs font-semibold text-gray-400 px-1 mb-1.5">{category}</p>
              <Card className="overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {grouped[category].map(ind => (
                    <IndicatorRow key={ind.key} ind={ind} />
                  ))}
                </div>
              </Card>
            </div>
          ))}
          {indicators.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">지표 데이터 없음</p>
          )}

          {/* Footer — 마지막 갱신: 한 줄 */}
          {updatedAt && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">마지막 갱신  {formatUpdatedAtLine(updatedAt)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
