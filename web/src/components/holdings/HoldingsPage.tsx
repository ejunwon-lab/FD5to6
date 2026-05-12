import { useState, useMemo } from 'react'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { HoldingCard } from './HoldingCard'
import { krwFull, normalizeChangePct, profitTextClass, holdingDays } from '../../utils/format'
import type { Holding, PortfolioResponse } from '../../models/types'
import type { SortKey } from './HoldingCard'

type HoldingsPageProps = {
  portfolio: PortfolioResponse | null
  isLoading: boolean
  error: string
}

const ACCOUNT_ORDER = ['종합_랩', '퇴직연금_개인IRP', '종합', 'ISA', '퇴직연금_개인형IRP(범용)']
const ACCOUNT_DISPLAY: Record<string, string> = {
  '퇴직연금_개인IRP': '퇴직연금_미래',
  '퇴직연금_개인형IRP(범용)': '퇴직연금_삼성',
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'allInfo',    label: '종목 정보' },
  { key: 'change',     label: '당일 등락' },
  { key: 'agedDays',   label: '보유 기간' },
  { key: 'opCurrent',  label: '평가 금액' },
  { key: 'profitRate', label: '수익률' },
  { key: 'opProfit',   label: '수익금' },
]

function brokerOf(accountType: string, brokerMap: Record<string, string>): string {
  return brokerMap[accountType] ?? ''
}

function chipStyle(broker: string, selected: boolean, isAll: boolean): string {
  if (isAll) {
    return selected
      ? 'bg-accent text-white border-accent border'
      : 'bg-transparent text-gray-500 border border-accent/30'
  }
  const lc = broker.toLowerCase()
  if (lc.includes('미래')) {
    return selected
      ? 'bg-orange-400/15 text-orange-500 border-[1.5px] border-orange-400'
      : 'bg-transparent text-gray-500 border-[1.5px] border-orange-400/60'
  }
  if (lc.includes('삼성')) {
    return selected
      ? 'bg-blue-600/15 text-blue-600 border-[1.5px] border-blue-600'
      : 'bg-transparent text-gray-500 border-[1.5px] border-blue-600/60'
  }
  return selected
    ? 'bg-[rgb(var(--card-bg))] text-gray-700 dark:text-gray-200 border-[1.5px] border-gray-400'
    : 'bg-transparent text-gray-500 border-[1.5px] border-gray-300/60'
}

export function HoldingsPage({ portfolio, isLoading, error }: HoldingsPageProps) {
  const [search, setSearch] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('전체')
  const [sortKey, setSortKey] = useState<SortKey>('allInfo')
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const accountBrokerMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const h of portfolio?.holdings ?? []) {
      if (!map[h.accountType]) map[h.accountType] = h.broker
    }
    return map
  }, [portfolio])

  const accounts = useMemo(() => {
    const existing = new Set(portfolio?.holdings?.map(h => h.accountType) ?? [])
    const ordered = ACCOUNT_ORDER.filter(a => existing.has(a))
    const rest = [...existing].filter(a => !ACCOUNT_ORDER.includes(a)).sort()
    return ['전체', ...ordered, ...rest]
  }, [portfolio])

  const filtered = useMemo(() => {
    let list = portfolio?.holdings ?? []
    if (selectedAccount !== '전체') list = list.filter(h => h.accountType === selectedAccount)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(h => h.name.toLowerCase().includes(q) || h.code.toLowerCase().includes(q))
    }
    return sortHoldings([...list], sortKey, sortAsc)
  }, [portfolio, selectedAccount, search, sortKey, sortAsc])

  const totalCurrent = useMemo(() => filtered.reduce((s, h) => s + h.opCurrent, 0), [filtered])
  const totalChange  = useMemo(() => filtered.reduce((s, h) => s + h.change * h.quantity, 0), [filtered])

  const summary = portfolio?.summary
  const dayAmt = summary?.dayChangAmount ?? 0
  const dayPct = normalizeChangePct(summary?.dayChangePct ?? '')
  const dayColor = profitTextClass(dayAmt)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
    setExpandedId(null)
  }

  const handleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const accountLabel = selectedAccount === '전체' ? '전체' : (ACCOUNT_DISPLAY[selectedAccount] ?? selectedAccount)

  return (
    <div className="h-[100dvh] overflow-y-auto no-scrollbar bg-[rgb(var(--page-bg))] pb-[160px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[rgb(var(--page-bg))]">

        {/* 타이틀 바 */}
        <div className="flex items-center justify-between px-4 pt-12 pb-1">
          <h2 className="text-[28px] font-bold">종목 ({filtered.length})</h2>
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${dayAmt >= 0 ? 'bg-profit/8' : 'bg-loss/8'} border ${dayAmt >= 0 ? 'border-profit/40' : 'border-loss/40'}`}>
            <span className={`text-sm font-semibold ${dayColor}`}>{dayAmt >= 0 ? '↑' : '↓'}</span>
            <span className={`text-sm font-semibold ${dayColor}`}>{krwFull(Math.abs(dayAmt))}</span>
            <span className={`text-xs font-semibold ${dayColor} opacity-75 ml-1`}>{dayPct}</span>
          </div>
        </div>

        {/* 계좌 필터 칩 */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3.5 py-2">
          {accounts.map(acc => {
            const isAll = acc === '전체'
            const broker = isAll ? '' : brokerOf(acc, accountBrokerMap)
            const selected = selectedAccount === acc
            const label = isAll ? '전체' : (ACCOUNT_DISPLAY[acc] ?? acc)
            return (
              <button
                key={acc}
                onClick={() => setSelectedAccount(acc)}
                className={`shrink-0 px-2 py-1 rounded-full text-xs transition-colors ${
                  selected ? 'font-bold' : 'font-normal'
                } ${chipStyle(broker, selected, isAll)}`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* 정렬 바 */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-1.5">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                sortKey === opt.key
                  ? 'bg-accent text-white font-bold'
                  : 'bg-[rgb(var(--card-bg))] text-gray-600 dark:text-gray-300 font-normal'
              }`}
            >
              {opt.label}
              {sortKey === opt.key && (
                <span className="text-[10px]">{sortAsc ? '↑' : '↓'}</span>
              )}
            </button>
          ))}
        </div>

        {/* 요약 바 */}
        <div className="bg-[rgb(var(--card-bg))] border-b border-gray-200 dark:border-gray-700 px-4 py-2">
          <p className="text-[11px] text-gray-500 text-center font-medium mb-0.5">{accountLabel}</p>
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm font-semibold">{krwFull(totalCurrent)}</span>
            <span className="text-gray-300 dark:text-gray-600 text-xs">|</span>
            <span className={`text-sm font-semibold ${profitTextClass(totalChange)}`}>
              {totalChange >= 0 ? '+' : ''}{krwFull(totalChange)}
            </span>
          </div>
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
          {filtered.map(h => {
            const id = `${h.code}-${h.accountType}`
            return (
              <HoldingCard
                key={id}
                holding={h}
                sortKey={sortKey}
                isExpanded={expandedId === id}
                onExpand={() => handleExpand(id)}
              />
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">종목이 없습니다</p>
          )}
        </div>
      )}

      {/* 검색바 (하단 고정) */}
      <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 z-40">
        <div className="flex items-center gap-2 bg-[rgb(var(--card-bg))]/90 backdrop-blur-xl rounded-2xl px-3.5 py-2.5 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="종목명 또는 코드 검색"
            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 text-xs">✕</button>
          )}
        </div>
      </div>
    </div>
  )
}

function sortHoldings(list: Holding[], key: SortKey, asc: boolean): Holding[] {
  const dir = asc ? 1 : -1
  switch (key) {
    case 'change':
      return list.sort((a, b) => dir * (a.change * a.quantity - b.change * b.quantity))
    case 'agedDays':
      return list.sort((a, b) => dir * (holdingDays(a.buyDate) - holdingDays(b.buyDate)))
    case 'opCurrent':
      return list.sort((a, b) => dir * (a.opCurrent - b.opCurrent))
    case 'profitRate':
      return list.sort((a, b) => dir * (a.profitRate - b.profitRate))
    case 'opProfit':
      return list.sort((a, b) => dir * (a.opProfit - b.opProfit))
    case 'allInfo':
      return list.sort((a, b) => dir * (a.opCurrent - b.opCurrent))
  }
}
