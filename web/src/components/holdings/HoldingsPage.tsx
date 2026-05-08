import { useState, useEffect, useCallback, useMemo } from 'react'
import { gasApi } from '../../api/gasApi'
import { useAuth } from '../../auth/AuthContext'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { HoldingCard } from './HoldingCard'
import { krwCompact, pctFormatted, profitTextClass } from '../../utils/format'
import type { Holding, PortfolioResponse } from '../../models/types'
import type { SortKey } from './HoldingCard'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'change',    label: '당일 등락' },
  { key: 'agedDays',  label: '보유기간' },
  { key: 'opCurrent', label: '평가금액' },
  { key: 'profitRate',label: '수익률' },
  { key: 'opProfit',  label: '수익금' },
  { key: 'allInfo',   label: 'All Info' },
]

export function HoldingsPage() {
  const { getToken } = useAuth()
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('전체')
  const [sortKey, setSortKey] = useState<SortKey>('change')

  const fetchPortfolio = useCallback(async () => {
    try {
      setIsLoading(true)
      const token = await getToken()
      const res = await gasApi.getPortfolio(token)
      if (res.success) {
        setPortfolio(res)
        setError('')
      } else {
        setError(res.error ?? '조회 실패')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsLoading(false)
    }
  }, [getToken])

  useEffect(() => { fetchPortfolio() }, [fetchPortfolio])

  const accounts = useMemo(() => {
    const set = new Set(portfolio?.holdings?.map(h => h.accountType) ?? [])
    return ['전체', ...Array.from(set).sort()]
  }, [portfolio])

  const filtered = useMemo(() => {
    let list = portfolio?.holdings ?? []
    if (selectedAccount !== '전체') list = list.filter(h => h.accountType === selectedAccount)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(h => h.name.toLowerCase().includes(q) || h.code.toLowerCase().includes(q))
    }
    return sortHoldings([...list], sortKey)
  }, [portfolio, selectedAccount, search, sortKey])

  const accountSummary = useMemo(() => {
    if (selectedAccount === '전체') return portfolio?.byAccount ?? {}
    const key = selectedAccount
    const acc = portfolio?.byAccount?.[key]
    return acc ? { [key]: acc } : {}
  }, [portfolio, selectedAccount])

  return (
    <div className="h-[100dvh] overflow-y-auto no-scrollbar bg-[rgb(var(--page-bg))] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[rgb(var(--page-bg))] pt-12 pb-2 px-4">
        <h2 className="text-2xl font-bold mb-3">종목</h2>

        {/* 검색바 */}
        <div className="relative mb-2">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="종목명 또는 코드 검색"
            className="w-full bg-[rgb(var(--card-bg))] rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none"
          />
        </div>

        {/* 계좌 필터 칩 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {accounts.map(acc => (
            <button
              key={acc}
              onClick={() => setSelectedAccount(acc)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedAccount === acc
                  ? 'bg-accent text-white'
                  : 'bg-[rgb(var(--card-bg))] text-gray-500'
              }`}
            >
              {acc}
            </button>
          ))}
        </div>

        {/* 정렬 */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-2 pb-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                sortKey === opt.key
                  ? 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'bg-[rgb(var(--card-bg))] text-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner message="종목 데이터 불러오는 중..." />
      ) : error ? (
        <div className="px-4 pt-2">
          <Card className="p-4 text-sm text-red-500">{error}</Card>
        </div>
      ) : (
        <div className="px-4 pt-2 space-y-2">
          {/* 계좌별 요약 바 */}
          {Object.entries(accountSummary).map(([name, stat]) => (
            <Card key={name} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{name}</span>
                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-[10px] text-gray-400">평가금액</p>
                    <p className="text-xs font-bold">{krwCompact(stat.current)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">수익</p>
                    <p className={`text-xs font-bold ${profitTextClass(stat.profit)}`}>
                      {krwCompact(stat.profit)} ({pctFormatted(stat.profitRate)})
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* 종목 카드 */}
          {filtered.map(h => (
            <HoldingCard key={`${h.code}-${h.accountType}`} holding={h} sortKey={sortKey} />
          ))}

          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">종목이 없습니다</p>
          )}
        </div>
      )}
    </div>
  )
}

function sortHoldings(list: Holding[], key: SortKey): Holding[] {
  switch (key) {
    case 'change':
      return list.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    case 'agedDays': {
      const today = Date.now()
      return list.sort((a, b) => {
        const da = a.buyDate ? today - new Date(a.buyDate).getTime() : 0
        const db = b.buyDate ? today - new Date(b.buyDate).getTime() : 0
        return db - da
      })
    }
    case 'opCurrent':
      return list.sort((a, b) => b.opCurrent - a.opCurrent)
    case 'profitRate':
      return list.sort((a, b) => b.profitRate - a.profitRate)
    case 'opProfit':
      return list.sort((a, b) => b.opProfit - a.opProfit)
    case 'allInfo':
      return list.sort((a, b) => b.opCurrent - a.opCurrent)
  }
}
