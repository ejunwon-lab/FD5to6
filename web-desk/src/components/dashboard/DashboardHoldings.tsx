import { useMemo, useState } from 'react'
import { Panel } from '../ui/Panel'
import type { Holding } from '../../lib/types'
import { HoldingCard, type HoldingSortKey } from '../holdings/HoldingCard'
import { HoldingCardWeb } from '../holdings/HoldingCardWeb'
import { StockDetailModal } from '../holdings/StockDetailModal'
import { HoldingsStatusStrip } from './HoldingsStatusStrip'

interface Props { holdings: Holding[] }

type SortKey = HoldingSortKey
type ViewMode = 'list' | 'card-terminal' | 'card-web'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'allInfo',    label: '종목 정보' },
  { key: 'change',     label: '당일 등락' },
  { key: 'agedDays',   label: '보유 기간' },
  { key: 'opCurrent',  label: '평가 금액' },
  { key: 'profitRate', label: '수익률' },
  { key: 'opProfit',   label: '수익금' },
]

import { accountDisplay } from '../../lib/accountDisplay'

// 계좌 우선 정렬 (계좌명 raw 기준 — 시트의 원본 값)
const ACCOUNT_ORDER = ['종합_랩', '종합', 'ISA', '퇴직연금_개인IRP', '퇴직연금_개인형IRP(범용)']

export function DashboardHoldings({ holdings }: Props) {
  const [selectedAccount, setSelectedAccount] = useState<string>('전체')
  const [sortKey, setSortKey] = useState<SortKey>('allInfo')
  const [sortAsc, setSortAsc] = useState(false)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('card-web')
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [detailStock, setDetailStock] = useState<{ code: string; name: string } | null>(null)

  // 계좌 → 증권사 매핑
  const accountBrokerMap = useMemo(() => {
    const m: Record<string, string> = {}
    holdings.forEach((h) => { if (!m[h.accountType]) m[h.accountType] = h.broker })
    return m
  }, [holdings])

  // 사용 가능한 계좌 (있는 순서 + 우선 순)
  const accounts = useMemo(() => {
    const present = new Set(holdings.map((h) => h.accountType))
    const ordered = ACCOUNT_ORDER.filter((a) => present.has(a))
    const rest = [...present].filter((a) => !ACCOUNT_ORDER.includes(a)).sort()
    return ['전체', ...ordered, ...rest]
  }, [holdings])

  // 필터 + 검색 + 정렬
  const filtered = useMemo(() => {
    let list = holdings
    if (selectedAccount !== '전체') list = list.filter((h) => h.accountType === selectedAccount)
    if (query) {
      const q = query.toLowerCase()
      list = list.filter((h) => h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q))
    }
    return sortHoldings([...list], sortKey, sortAsc)
  }, [holdings, selectedAccount, sortKey, sortAsc, query])

  // 합계 (필터 적용 후)
  const stats = useMemo(() => {
    const value = filtered.reduce((s, h) => s + h.value, 0)
    const dayChange = filtered.reduce((s, h) => s + h.dayChange, 0)
    const profit = filtered.reduce((s, h) => s + h.opProfit, 0)
    return { value, dayChange, profit }
  }, [filtered])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const totalWeight = holdings.reduce((s, h) => s + h.value, 0) || 1

  return (
    <Panel
      title={`Holdings · ${filtered.length}${selectedAccount === '전체' ? '' : ' / ' + accountDisplay(accountBrokerMap[selectedAccount] ?? '', selectedAccount)}`}
      meta={`₩${(stats.value / 1e6).toFixed(2)}M`}
      className="col-span-full"
    >
      {/* 필터 + 정렬 + 검색 바 */}
      <div className="px-3 py-2.5 border-b border-line-dim space-y-2">
        {/* 계좌 chips */}
        <div className="flex gap-1.5 overflow-x-auto items-center">
          <span className="text-2xs text-ink-faint uppercase tracking-widest shrink-0 mr-1">계좌</span>
          {accounts.map((acc) => {
            const isAll = acc === '전체'
            const broker = isAll ? '' : accountBrokerMap[acc] ?? ''
            const selected = selectedAccount === acc
            const label = isAll ? '전체' : accountDisplay(broker, acc)
            const cnt = isAll ? holdings.length : holdings.filter((h) => h.accountType === acc).length
            return (
              <button
                key={acc}
                onClick={() => setSelectedAccount(acc)}
                className={`shrink-0 px-2.5 py-0.5 text-2xs uppercase tracking-widest border ${chipStyle(broker, selected, isAll)}`}
              >
                {label}<span className="ml-1.5 opacity-60">{cnt}</span>
              </button>
            )
          })}
        </div>
        {/* Sort + View toggle + Search */}
        <div className="flex gap-1.5 items-center flex-wrap">
          <span className="text-2xs text-ink-faint uppercase tracking-widest shrink-0 mr-1">정렬</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 text-2xs uppercase tracking-widest border ${
                sortKey === opt.key
                  ? 'bg-amber border-amber text-bg'
                  : 'border-line text-ink-dim hover:text-ink'
              }`}
            >
              {opt.label}
              {sortKey === opt.key && <span>{sortAsc ? '↑' : '↓'}</span>}
            </button>
          ))}
          {/* View mode toggle — 3-state (순서: Web → Terminal → List) */}
          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex border border-line">
              <button
                onClick={() => setViewMode('card-web')}
                className={`px-2.5 py-0.5 text-2xs uppercase tracking-widest ${
                  viewMode === 'card-web' ? 'bg-amber text-bg' : 'text-ink-dim hover:text-ink'
                }`}
                title="Web 스타일 카드"
              >▤ Web</button>
              <button
                onClick={() => setViewMode('card-terminal')}
                className={`px-2.5 py-0.5 text-2xs uppercase tracking-widest border-l border-line ${
                  viewMode === 'card-terminal' ? 'bg-amber text-bg' : 'text-ink-dim hover:text-ink'
                }`}
                title="Terminal 카드"
              >▦ Terminal</button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-0.5 text-2xs uppercase tracking-widest border-l border-line ${
                  viewMode === 'list' ? 'bg-amber text-bg' : 'text-ink-dim hover:text-ink'
                }`}
                title="목록"
              >☰ List</button>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search..."
              className="bg-bg-deep border border-line text-ink px-2.5 py-0.5 text-xs w-44 focus:outline-none focus:border-amber"
            />
          </div>
        </div>
      </div>

      {/* 현황 strip — 필터·정렬 컨텍스트 요약 */}
      <HoldingsStatusStrip holdings={filtered} sortKey={sortKey} selectedAccount={selectedAccount} />

      {/* Terminal Card view */}
      {viewMode === 'card-terminal' && (
        <div className="p-3 grid gap-2.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((h) => {
            const id = `${h.symbol}-${h.accountType}`
            return (
              <HoldingCard
                key={id}
                holding={h}
                sortKey={sortKey}
                isExpanded={expandedCardId === id}
                onExpand={() => setExpandedCardId((cur) => cur === id ? null : id)}
                onDetail={() => setDetailStock({ code: h.symbol, name: h.name })}
              />
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-ink-faint py-10 text-xs">검색 결과 없음</div>
          )}
        </div>
      )}

      {/* Web-style Card view (web/ 와 동일 디자인, 큰 사이즈, 풀 숫자) */}
      {viewMode === 'card-web' && (
        <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((h) => {
            const id = `${h.symbol}-${h.accountType}`
            return (
              <HoldingCardWeb
                key={id}
                holding={h}
                sortKey={sortKey}
                isExpanded={expandedCardId === id}
                onExpand={() => setExpandedCardId((cur) => cur === id ? null : id)}
                onDetail={() => setDetailStock({ code: h.symbol, name: h.name })}
              />
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-ink-faint py-10 text-sm">검색 결과 없음</div>
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
      <div className="overflow-x-auto">
      {/* Header row */}
      <div className="grid items-center text-2xs uppercase tracking-widest text-ink-faint border-b border-line px-3 py-1.5 min-w-[1100px]"
           style={{ gridTemplateColumns: '1.8fr 1.4fr 60px 90px 1.1fr 1.3fr 1.4fr 60px 90px' }}>
        <span>Stock</span>
        <span>Account · Broker</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Avg</span>
        <span className="text-right">Value</span>
        <span className="text-right">Day Δ</span>
        <span className="text-right">Total P&L</span>
        <span className="text-right">Held</span>
        <span className="text-right">Weight</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-line-dim min-w-[1100px]">
        {filtered.map((h) => {
          const heldDays = h.buyDate ? Math.max(0, Math.floor((Date.now() - new Date(h.buyDate).getTime()) / 86_400_000)) : null
          const dayUp = h.dayChange >= 0
          const totalUp = h.opProfit >= 0
          const w = (h.value / totalWeight) * 100
          return (
            <div
              key={`${h.symbol}-${h.accountType}`}
              className="grid items-center px-3 py-2 hover:bg-bg-hover text-xs"
              style={{ gridTemplateColumns: '1.8fr 1.4fr 60px 90px 1.1fr 1.3fr 1.4fr 60px 90px' }}
            >
              {/* Name (main) + Market badge + Symbol (보조) */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber font-medium truncate">{h.name}</span>
                <span className="text-2xs text-cyan tracking-widest shrink-0">{h.market}</span>
                <span className="text-2xs text-ink-faint tabular shrink-0">{h.symbol}</span>
              </div>
              {/* Account · Broker chip */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-1.5 py-0 text-2xs tracking-wider border ${brokerBadge(h.broker)}`}>
                  {accountDisplay(h.broker, h.accountType)}
                </span>
                <span className="text-2xs text-ink-faint truncate">{h.broker}</span>
              </div>
              {/* Shares */}
              <div className="text-right tabular text-ink-dim">{h.shares}</div>
              {/* Avg cost */}
              <div className="text-right tabular text-ink-dim text-xxs">
                {h.market === 'KR' ? `₩${Math.round(h.avgPrice).toLocaleString()}` : `$${h.avgPrice.toFixed(2)}`}
              </div>
              {/* Value */}
              <div className="text-right tabular text-ink font-medium">₩{h.value.toLocaleString()}</div>
              {/* Day change */}
              <div className={`text-right tabular ${dayUp ? 'text-gain' : 'text-loss'}`}>
                <div>{dayUp ? '+' : ''}{h.dayChange.toLocaleString()}</div>
                <div className="text-2xs opacity-80">{dayUp ? '+' : ''}{h.dayChangePct.toFixed(2)}%</div>
              </div>
              {/* Total P&L */}
              <div className={`text-right tabular ${totalUp ? 'text-gain' : 'text-loss'}`}>
                <div>{totalUp ? '+' : ''}{h.opProfit.toLocaleString()}</div>
                <div className="text-2xs opacity-80">{totalUp ? '+' : ''}{h.returnPct.toFixed(2)}%</div>
              </div>
              {/* Held days */}
              <div className="text-right tabular text-ink-faint text-2xs">
                {heldDays != null ? `${heldDays}d` : '—'}
              </div>
              {/* Weight bar */}
              <div className="text-right">
                <div className="tabular text-ink-dim text-2xs">{w.toFixed(1)}%</div>
                <div className="h-1 bg-line mt-1 ml-auto" style={{ width: '72px' }}>
                  <div className="h-full bg-amber" style={{ width: `${Math.min(w, 100)}%` }} />
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center text-ink-faint py-8 text-xs">검색 결과 없음</div>
        )}
      </div>

      {/* Footer totals (필터 적용 시 강조) */}
      {selectedAccount !== '전체' && (
        <div className="border-t border-line px-3 py-2 grid text-xs min-w-[1100px]"
             style={{ gridTemplateColumns: '1.8fr 1.4fr 60px 90px 1.1fr 1.3fr 1.4fr 60px 90px' }}>
          <span className="text-ink-faint uppercase tracking-widest text-2xs">소계 · {accountDisplay(accountBrokerMap[selectedAccount] ?? '', selectedAccount)}</span>
          <span></span><span></span><span></span>
          <span className="text-right tabular font-medium">₩{stats.value.toLocaleString()}</span>
          <span className={`text-right tabular ${stats.dayChange >= 0 ? 'text-gain' : 'text-loss'}`}>
            {stats.dayChange >= 0 ? '+' : ''}{stats.dayChange.toLocaleString()}
          </span>
          <span className={`text-right tabular ${stats.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
            {stats.profit >= 0 ? '+' : ''}{stats.profit.toLocaleString()}
          </span>
          <span></span><span></span>
        </div>
      )}
      </div>
      )}

      {/* Stock detail modal */}
      {detailStock && (
        <StockDetailModal
          code={detailStock.code}
          initialName={detailStock.name}
          onClose={() => setDetailStock(null)}
        />
      )}
    </Panel>
  )
}

function sortHoldings(list: Holding[], key: SortKey, asc: boolean): Holding[] {
  const dir = asc ? 1 : -1
  switch (key) {
    case 'change':     return list.sort((a, b) => dir * (a.dayChange - b.dayChange))
    case 'agedDays':   return list.sort((a, b) => dir * (heldDays(a.buyDate) - heldDays(b.buyDate)))
    case 'opCurrent':  return list.sort((a, b) => dir * (a.value - b.value))
    case 'profitRate': return list.sort((a, b) => dir * (a.returnPct - b.returnPct))
    case 'opProfit':   return list.sort((a, b) => dir * (a.opProfit - b.opProfit))
    case 'allInfo':    return list.sort((a, b) => dir * (a.value - b.value))
  }
}

function heldDays(buyDate?: string): number {
  if (!buyDate) return -1
  return Math.max(0, Math.floor((Date.now() - new Date(buyDate).getTime()) / 86_400_000))
}

// 증권사별 chip 색상
function brokerBadge(broker: string): string {
  const b = broker.toLowerCase()
  if (b.includes('미래')) return 'border-orange-400/60 text-orange-300 bg-orange-500/10'
  if (b.includes('삼성')) return 'border-blue-400/60 text-blue-300 bg-blue-500/10'
  return 'border-line text-ink-dim'
}

function chipStyle(broker: string, selected: boolean, isAll: boolean): string {
  if (isAll) {
    return selected
      ? 'bg-amber border-amber text-bg'
      : 'bg-bg-deep border-line text-ink-dim hover:text-ink'
  }
  const b = broker.toLowerCase()
  if (b.includes('미래')) {
    return selected
      ? 'bg-orange-500/20 border-orange-400 text-orange-300'
      : 'bg-bg-deep border-orange-400/40 text-ink-dim hover:text-orange-300'
  }
  if (b.includes('삼성')) {
    return selected
      ? 'bg-blue-500/20 border-blue-400 text-blue-300'
      : 'bg-bg-deep border-blue-400/40 text-ink-dim hover:text-blue-300'
  }
  return selected
    ? 'bg-bg-elev border-ink-dim text-ink'
    : 'bg-bg-deep border-line text-ink-dim hover:text-ink'
}
