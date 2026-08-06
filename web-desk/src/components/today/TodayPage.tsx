import { useMemo, useState } from 'react'
import { usePortfolio } from '../../lib/usePortfolio'
import { useRealized } from '../../lib/useRealized'
import { holdings as sampleHoldings, indicators as sampleIndicators } from '../../lib/sampleData'
import { Panel } from '../ui/Panel'
import type { Holding, Indicator } from '../../lib/types'
import { aggregateBySymbol, dayReturnPercentile, detectSignals } from '../../lib/todayInsights'
import { ContributionPanel } from './ContributionPanel'
import { SignalsPanel } from './SignalsPanel'
import { BreakdownPanel } from './BreakdownPanel'
import { NewsPanel } from './NewsPanel'
import { EventsPanel } from './EventsPanel'

type SortKey = 'pct' | 'amount' | 'name'
type FilterKey = 'all' | 'gain' | 'loss' | 'flat'

const FLAT_THRESHOLD = 0.05  // |dayChangePct| < 0.05% 면 보합

/** 지표 찾기 — 심볼 정확 일치 우선, 없으면 이름 부분 일치 */
function findIndicator(list: Indicator[], symbol: string, nameLike: string): Indicator | undefined {
  return list.find((i) => i.symbol === symbol) ?? list.find((i) => i.name.toUpperCase().includes(nameLike))
}

export function TodayPage() {
  const { holdings: live, indicators: liveInd, equityCurve, updatedAt } = usePortfolio()
  const { entries: realized } = useRealized()
  const holdings = live.length ? live : sampleHoldings
  const indicators = liveInd.length ? liveInd : sampleIndicators

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

  // 종목 집계·주의 신호·오늘 위치 (순수 로직 — lib/todayInsights)
  const aggs = useMemo(() => aggregateBySymbol(holdings), [holdings])
  const signals = useMemo(() => detectSignals(aggs), [aggs])
  const percentile = useMemo(
    () => dayReturnPercentile(equityCurve, summary.totalPct),
    [equityCurve, summary.totalPct],
  )

  // 오늘 실현손익 — 매도 체결이 있는 날만 표시
  const todayRealized = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA')  // YYYY-MM-DD (로컬)
    const items = realized.filter((e) => e.date === today)
    if (items.length === 0) return null
    return { items, total: items.reduce((s, e) => s + e.profit, 0) }
  }, [realized])

  const kospi = findIndicator(indicators, 'KOSPI', 'KOSPI')
  const spx = findIndicator(indicators, 'S&P500', 'S&P')
  const usdkrw = findIndicator(indicators, 'USDKRW', 'USD/KRW')

  return (
    <div className="overflow-y-auto p-2 sm:p-3 grid gap-2.5 content-start">
      {/* 1. KPI 스트립 — 내 포트 · Breadth · 시장 기준선(KOSPI/S&P) · 환율 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-line border border-line">
        <Stat
          label="포트 변동 (당일)"
          value={`${summary.totalDayChange >= 0 ? '+' : ''}₩${Math.round(summary.totalDayChange).toLocaleString('ko-KR')}`}
          sub={`${summary.totalPct >= 0 ? '+' : ''}${summary.totalPct.toFixed(2)}%`}
          tone={summary.totalDayChange >= 0 ? 'up' : 'down'}
        />
        <div className="bg-bg-elev px-3.5 py-3">
          <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1">Breadth</div>
          <div className="text-[20px] font-medium tabular">
            <span className="text-gain">▲{summary.gainCount}</span>
            <span className="text-ink-faint mx-1.5">·</span>
            <span className="text-loss">▼{summary.lossCount}</span>
            <span className="text-ink-faint mx-1.5">·</span>
            <span className="text-ink-dim">⏸{summary.flatCount}</span>
          </div>
          <div className="text-xs text-ink-dim tabular mt-0.5">{holdings.length}종목</div>
        </div>
        <MarketStat label="KOSPI" ind={kospi} />
        <MarketStat label="S&P 500" ind={spx} />
        <MarketStat label="USD/KRW" ind={usdkrw} />
      </div>

      {/* 2. 오늘 실현손익 — 오늘 매도한 날만 나타나는 조건부 스트립 */}
      {todayRealized && (
        <div className="border border-line bg-bg-elev px-3 py-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
          <span className="text-ink-faint uppercase tracking-widest text-2xs">오늘 실현손익</span>
          <span className={`font-medium tabular ${todayRealized.total >= 0 ? 'text-gain' : 'text-loss'}`}>
            {todayRealized.total >= 0 ? '+' : ''}₩{Math.round(todayRealized.total).toLocaleString('ko-KR')}
          </span>
          <span className="text-ink-faint">· {todayRealized.items.length}건</span>
          {todayRealized.items.map((e, i) => (
            <span key={`${e.code}-${i}`} className="text-ink-dim">
              {e.name}{' '}
              <span className={`tabular ${e.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                {e.profit >= 0 ? '+' : ''}₩{Math.round(e.profit).toLocaleString('ko-KR')}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* 3. 본문 — iPad 가로(lg+): 좌측 종목 리스트 + 우측 인사이트 스택. 모바일: 인사이트 → 리스트 */}
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="grid gap-2.5 min-w-0 order-2 lg:order-1">
          {/* Sort + Filter 컨트롤 — 모바일은 줄바꿈 대신 가로 스크롤 한 줄 */}
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

        <div className="grid gap-2.5 order-1 lg:order-2">
          <ContributionPanel aggs={aggs} />
          <SignalsPanel signals={signals} />
          <BreakdownPanel holdings={holdings} percentile={percentile} />
          <NewsPanel />
          <EventsPanel />
        </div>
      </div>
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
          {Math.round(h.currentPrice).toLocaleString('ko-KR')}원
          <span className="text-ink-faint mx-2">·</span>
          <span className={toneClass}>
            {h.change >= 0 ? '+' : ''}{Math.round(h.change).toLocaleString('ko-KR')}원/주 × {h.shares.toLocaleString('ko-KR')}주
          </span>
        </div>
        <span className={`text-sm font-medium tabular ${toneClass}`}>
          {h.dayChange >= 0 ? '+' : ''}₩{Math.round(h.dayChange).toLocaleString('ko-KR')}
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

/** 시장 기준선 타일 — 당일 %를 메인으로, 레벨을 보조로 */
function MarketStat({ label, ind }: { label: string; ind?: Indicator }) {
  if (!ind) return <Stat label={label} value="—" sub="지표 없음" tone="neutral" />
  return (
    <Stat
      label={label}
      value={`${ind.changePct >= 0 ? '+' : ''}${ind.changePct.toFixed(2)}%`}
      sub={ind.value.toLocaleString('ko-KR')}
      tone={ind.changePct >= 0 ? 'up' : 'down'}
    />
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
