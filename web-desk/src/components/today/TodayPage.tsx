import { useMemo, useState } from 'react'
import { usePortfolio } from '../../lib/usePortfolio'
import { holdings as sampleHoldings } from '../../lib/sampleData'
import { Panel } from '../ui/Panel'
import type { Holding } from '../../lib/types'

type SortKey = 'pct' | 'amount' | 'name'
type FilterKey = 'all' | 'gain' | 'loss' | 'flat'

const FLAT_THRESHOLD = 0.05  // |dayChangePct| < 0.05% 면 보합

export function TodayPage() {
  const { holdings: live, updatedAt } = usePortfolio()
  const holdings = live.length ? live : sampleHoldings

  const [sortKey, setSortKey] = useState<SortKey>('pct')
  const [filter, setFilter] = useState<FilterKey>('all')

  const { rows, summary, maxAbsPct } = useMemo(() => {
    const filtered = holdings.filter((h) => {
      const pct = h.dayChangePct ?? 0
      if (filter === 'gain') return pct > FLAT_THRESHOLD
      if (filter === 'loss') return pct < -FLAT_THRESHOLD
      if (filter === 'flat') return Math.abs(pct) <= FLAT_THRESHOLD
      return true
    })
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'pct')    return (b.dayChangePct ?? 0) - (a.dayChangePct ?? 0)
      if (sortKey === 'amount') return (b.dayChange ?? 0) - (a.dayChange ?? 0)
      return a.name.localeCompare(b.name)
    })

    const gainCount = holdings.filter((h) => (h.dayChangePct ?? 0) > FLAT_THRESHOLD).length
    const lossCount = holdings.filter((h) => (h.dayChangePct ?? 0) < -FLAT_THRESHOLD).length
    const flatCount = holdings.length - gainCount - lossCount
    const totalDayChange = holdings.reduce((s, h) => s + (h.dayChange ?? 0), 0)
    const totalValue = holdings.reduce((s, h) => s + h.value, 0)
    const totalPct = totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0

    const maxAbsPct = Math.max(
      ...holdings.map((h) => Math.abs(h.dayChangePct ?? 0)),
      1,
    )

    return {
      rows: sorted,
      summary: { gainCount, lossCount, flatCount, totalDayChange, totalPct, totalValue },
      maxAbsPct,
    }
  }, [holdings, sortKey, filter])

  return (
    <div className="overflow-y-auto p-2 sm:p-3 grid gap-2.5">
      {/* 1. 상단 KPI 스트립 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line">
        <Stat
          label="포트 변동 (당일)"
          value={`${summary.totalDayChange >= 0 ? '+' : ''}₩${Math.round(summary.totalDayChange).toLocaleString()}`}
          sub={`${summary.totalPct >= 0 ? '+' : ''}${summary.totalPct.toFixed(2)}%`}
          tone={summary.totalDayChange >= 0 ? 'up' : 'down'}
        />
        <Stat label="▲ 상승" value={`${summary.gainCount}`} sub="종목" tone="up" />
        <Stat label="▼ 하락" value={`${summary.lossCount}`} sub="종목" tone="down" />
        <Stat label="⏸ 보합" value={`${summary.flatCount}`} sub="종목" tone="neutral" />
      </div>

      {/* 2. Sort + Filter 컨트롤 — 모바일은 줄바꿈 대신 가로 스크롤 한 줄 */}
      <div className="flex items-center gap-2 text-xs overflow-x-auto">
        <span className="text-ink-faint uppercase tracking-widest text-2xs mr-1 shrink-0">정렬</span>
        <Toggle active={sortKey === 'pct'}    onClick={() => setSortKey('pct')}    label="등락률" />
        <Toggle active={sortKey === 'amount'} onClick={() => setSortKey('amount')} label="₩등락액" />
        <Toggle active={sortKey === 'name'}   onClick={() => setSortKey('name')}   label="종목명" />
        <span className="text-ink-faint uppercase tracking-widest text-2xs ml-3 mr-1 shrink-0">필터</span>
        <Toggle active={filter === 'all'}  onClick={() => setFilter('all')}  label="ALL" />
        <Toggle active={filter === 'gain'} onClick={() => setFilter('gain')} label="▲ GAIN" tone="up" />
        <Toggle active={filter === 'loss'} onClick={() => setFilter('loss')} label="▼ LOSS" tone="down" />
        <Toggle active={filter === 'flat'} onClick={() => setFilter('flat')} label="⏸ FLAT" />
        <span className="ml-auto text-ink-faint text-2xs tabular hidden lg:inline shrink-0">
          {updatedAt ? `updated ${updatedAt}` : ''}
        </span>
      </div>

      {/* 3. 종목별 막대 카드 리스트 */}
      <Panel
        title={`Today · ${rows.length} positions`}
        meta={`max move ${maxAbsPct.toFixed(2)}%`}
      >
        <div className="divide-y divide-line-dim">
          {rows.map((h, i) => (
            <MoverRow key={`${h.symbol}-${h.accountType}`} h={h} rank={i + 1} maxAbsPct={maxAbsPct} />
          ))}
          {rows.length === 0 && (
            <div className="text-center text-ink-faint py-10 text-xs">
              {filter === 'all' ? '보유 종목 없음' : '해당 필터 조건 종목 없음'}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

interface MoverProps {
  h: Holding
  rank: number
  maxAbsPct: number
}

function MoverRow({ h, rank, maxAbsPct }: MoverProps) {
  const pct = h.dayChangePct ?? 0
  const isUp = pct > FLAT_THRESHOLD
  const isDown = pct < -FLAT_THRESHOLD
  const arrow = isUp ? '▲' : isDown ? '▼' : '⏸'
  const tone = isUp ? 'gain' : isDown ? 'loss' : 'neutral'
  const toneClass = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink-dim'
  const barTone = tone === 'gain' ? 'bg-gain' : tone === 'loss' ? 'bg-loss' : 'bg-ink-faint'
  const barWidth = Math.min(100, (Math.abs(pct) / maxAbsPct) * 100)

  return (
    <div className="px-3 py-2.5 hover:bg-bg-hover">
      {/* Row 1: 순위 · 화살표 · 종목명 · 등락률 */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0 flex-1">
          <span className="text-ink-faint text-2xs tabular w-7 shrink-0">#{rank}</span>
          <span className={`shrink-0 text-sm ${toneClass}`}>{arrow}</span>
          <span className="text-amber font-medium text-sm truncate">{h.name}</span>
          <span className="hidden sm:inline text-2xs text-ink-faint tabular shrink-0">{h.symbol}</span>
          <span className="hidden sm:inline text-2xs text-cyan tracking-widest shrink-0">{h.market}</span>
        </div>
        <span className={`text-base font-medium tabular ${toneClass}`}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </span>
      </div>

      {/* Row 2: 현재가 · 1주변동 식 · 등락액 */}
      <div className="flex items-baseline justify-between gap-3 mt-1 pl-9">
        <div className="text-xs text-ink-dim tabular">
          {Math.round(h.currentPrice).toLocaleString()}원
          <span className="text-ink-faint mx-2">·</span>
          <span className={toneClass}>
            {h.change >= 0 ? '+' : ''}{Math.round(h.change).toLocaleString()}원/주 × {h.shares.toLocaleString()}주
          </span>
        </div>
        <span className={`text-sm font-medium tabular ${toneClass}`}>
          {h.dayChange >= 0 ? '+' : ''}₩{Math.round(h.dayChange).toLocaleString()}
        </span>
      </div>

      {/* Row 3: 가로 막대 (등락 강도) */}
      <div className="mt-2 pl-9">
        <div className="h-1.5 bg-bg-elev relative overflow-hidden">
          <div
            className={`h-full ${barTone} transition-all`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'up' | 'down' | 'neutral' }) {
  const toneClass = tone === 'up' ? 'text-gain' : tone === 'down' ? 'text-loss' : 'text-ink'
  return (
    <div className="bg-bg-elev px-3.5 py-3">
      <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1">{label}</div>
      <div className={`text-[20px] font-medium tabular ${toneClass}`}>{value}</div>
      <div className="text-xs text-ink-dim tabular mt-0.5">{sub}</div>
    </div>
  )
}

function Toggle({ active, onClick, label, tone }: { active: boolean; onClick: () => void; label: string; tone?: 'up' | 'down' }) {
  const activeClass = active
    ? tone === 'up'   ? 'bg-gain/30 border-gain text-gain'
    : tone === 'down' ? 'bg-loss/30 border-loss text-loss'
                      : 'bg-amber border-amber text-bg'
    : 'border-line text-ink-dim hover:text-ink'
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap border px-2.5 py-1.5 lg:py-0.5 text-2xs tracking-widest uppercase ${activeClass}`}
    >
      {label}
    </button>
  )
}
