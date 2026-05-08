import { useState, useEffect, useCallback } from 'react'
import { gasApi } from '../../api/gasApi'
import { useAuth } from '../../auth/AuthContext'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { profitTextClass } from '../../utils/format'
import type { ReferenceIndicator } from '../../models/types'

const CATEGORY_COLORS: Record<string, string> = {
  '한국시장':  'bg-blue-500',
  '미국시장':  'bg-indigo-500',
  '선물':     'bg-orange-500',
  '상품':     'bg-yellow-500',
  '매크로':   'bg-gray-500',
  'AI/반도체': 'bg-purple-500',
  '빅테크':   'bg-pink-500',
}

function formatValue(key: string, value: number): string {
  if (value === 0) return '—'
  if (['USD_KRW', 'GBP_KRW', 'JPY_KRW'].some(k => key.includes(k))) {
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
  }
  if (value >= 10000) return value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
  if (value >= 100) return value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
  return value.toFixed(2)
}

function IndicatorRow({ ind }: { ind: ReferenceIndicator }) {
  const isUp = ind.change >= 0
  const colorBar = CATEGORY_COLORS[ind.category] ?? 'bg-gray-400'

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-1 h-8 rounded-full shrink-0 ${colorBar}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{ind.name}</p>
        <p className="text-[10px] text-gray-400">{ind.category}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{formatValue(ind.key, ind.value)}</p>
        <div className="flex items-center justify-end gap-1">
          <span className={`text-[10px] font-medium ${profitTextClass(ind.change)}`}>
            {isUp ? '+' : ''}{formatValue(ind.key, ind.change)}
          </span>
          <span className={`text-[10px] ${profitTextClass(ind.change)}`}>
            ({isUp ? '+' : ''}{ind.changePct.toFixed(2)}%)
          </span>
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

  return (
    <div className="h-[100dvh] overflow-y-auto no-scrollbar bg-[rgb(var(--page-bg))] pb-32">
      <div className="sticky top-0 z-10 bg-[rgb(var(--page-bg))] px-4 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">참고지표</h2>
          <button
            onClick={() => fetch(true)}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center text-sm disabled:opacity-40 active:scale-90 transition-all"
          >
            {isRefreshing ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
            ) : '↻'}
          </button>
        </div>
        {updatedAt && (
          <p className="text-[10px] text-gray-400 mt-1">갱신: {updatedAt}</p>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner message="지표 불러오는 중..." />
      ) : error ? (
        <div className="px-4">
          <Card className="p-4 text-sm text-red-500">{error}</Card>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {Object.entries(grouped).map(([category, inds]) => (
            <Card key={category} className="px-4">
              <div className="flex items-center gap-2 pt-3 pb-1 border-b border-gray-100 dark:border-gray-700">
                <div className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[category] ?? 'bg-gray-400'}`} />
                <p className="text-xs font-semibold text-gray-500">{category}</p>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {inds.map(ind => <IndicatorRow key={ind.key} ind={ind} />)}
              </div>
            </Card>
          ))}
          {indicators.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">지표 없음</p>
          )}
        </div>
      )}
    </div>
  )
}
