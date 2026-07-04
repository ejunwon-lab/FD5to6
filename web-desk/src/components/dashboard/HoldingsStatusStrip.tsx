import { useMemo } from 'react'
import type { Holding } from '../../lib/types'
import type { HoldingSortKey } from '../holdings/HoldingCard'

interface Props {
  holdings: Holding[]   // 이미 필터된 종목들
  sortKey: HoldingSortKey
  selectedAccount: string
}

/**
 * 계좌·정렬 선택 직후 표시되는 요약 strip.
 * - 4장 고정: 평가 / 누적 손익 / 오늘 등락 / 종목 분포
 * - 5번째 카드: 정렬 키에 따라 컨텍스트 인사이트
 */
export function HoldingsStatusStrip({ holdings, sortKey, selectedAccount }: Props) {
  const stats = useMemo(() => {
    const count = holdings.length
    const value = holdings.reduce((s, h) => s + h.value, 0)
    const opBuy = holdings.reduce((s, h) => s + h.opBuy, 0)
    const profit = holdings.reduce((s, h) => s + h.opProfit, 0)
    const profitPct = opBuy ? (profit / opBuy) * 100 : 0
    const dayChange = holdings.reduce((s, h) => s + h.dayChange, 0)
    const dayPct = value ? (dayChange / (value - dayChange)) * 100 : 0
    const gain = holdings.filter((h) => h.opProfit > 0).length
    const loss = holdings.filter((h) => h.opProfit < 0).length
    return { count, value, opBuy, profit, profitPct, dayChange, dayPct, gain, loss }
  }, [holdings])

  // change 정렬은 다이내믹 셀이 2장(TOP 상승·TOP 하락) → 6열로 빈칸 없이 정렬
  const lgCols = sortKey === 'change' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
  return (
    <div className="px-3 pt-2.5 pb-3 border-b border-line-dim bg-bg/30">
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${lgCols} gap-px bg-line border border-line`}>
        <KpiCell label="평가금액" value={`₩${stats.value.toLocaleString()}`} sub={`${stats.count}개 종목`} />
        <KpiCell
          label="누적 손익"
          value={`${stats.profit >= 0 ? '+' : ''}₩${stats.profit.toLocaleString()}`}
          sub={`${stats.profit >= 0 ? '+' : ''}${stats.profitPct.toFixed(2)}%`}
          tone={stats.profit >= 0 ? 'gain' : 'loss'}
        />
        <KpiCell
          label="오늘 등락"
          value={`${stats.dayChange >= 0 ? '+' : ''}₩${stats.dayChange.toLocaleString()}`}
          sub={`${stats.dayChange >= 0 ? '+' : ''}${stats.dayPct.toFixed(2)}%`}
          tone={stats.dayChange >= 0 ? 'gain' : 'loss'}
        />
        <KpiCell
          label="종목 분포"
          value={
            <span>
              <span className="text-gain">{stats.gain}</span>
              <span className="text-ink-faint mx-1">/</span>
              <span className="text-loss">{stats.loss}</span>
            </span>
          }
          sub={`gain · loss`}
        />
        <DynamicCell holdings={holdings} sortKey={sortKey} selectedAccount={selectedAccount} />
      </div>
    </div>
  )
}

function KpiCell({
  label, value, sub, tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'gain' | 'loss' | 'cyan' | 'amber'
}) {
  const valColor = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : tone === 'cyan' ? 'text-cyan' : tone === 'amber' ? 'text-amber' : 'text-ink'
  return (
    <div className="bg-bg-elev px-3 sm:px-3.5 py-2.5 sm:py-3">
      <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1">{label}</div>
      <div className={`text-[18px] sm:text-[20px] font-medium tabular leading-tight ${valColor}`}>{value}</div>
      {sub != null && (
        <div className="text-xs text-ink-dim tabular mt-0.5 truncate">{sub}</div>
      )}
    </div>
  )
}

function DynamicCell({ holdings, sortKey, selectedAccount }: Props) {
  if (holdings.length === 0) {
    return <KpiCell label="—" value="—" sub="비어있음" />
  }

  switch (sortKey) {
    case 'allInfo':
    case 'opCurrent': {
      // 비중 1위 종목 + 집중도 %
      const total = holdings.reduce((s, h) => s + h.value, 0) || 1
      const top = [...holdings].sort((a, b) => b.value - a.value)[0]
      const pct = (top.value / total) * 100
      return (
        <KpiCell
          label="비중 1위"
          value={<span className="text-amber">{top.name}</span>}
          sub={`${top.symbol} · ${pct.toFixed(1)}%`}
          tone="amber"
        />
      )
    }
    case 'change': {
      // 오늘 TOP 상승 + TOP 하락 (두 칸 — 한쪽이 없으면 "—")
      const byChange = [...holdings].sort((a, b) => b.dayChange - a.dayChange)
      const topGain = byChange[0].dayChange > 0 ? byChange[0] : null
      const bottom = byChange[byChange.length - 1]
      const topLoss = bottom.dayChange < 0 ? bottom : null
      const cell = (label: string, h: Holding | null, up: boolean) => h ? (
        <KpiCell
          label={label}
          value={<span className="text-amber">{h.name}</span>}
          sub={
            <span className={up ? 'text-gain' : 'text-loss'}>
              {up ? '+' : ''}₩{h.dayChange.toLocaleString()} ({h.changePct})
            </span>
          }
          tone="amber"
        />
      ) : (
        <KpiCell label={label} value="—" sub={up ? '상승 종목 없음' : '하락 종목 없음'} />
      )
      return (
        <>
          {cell('오늘 TOP 상승', topGain, true)}
          {cell('오늘 TOP 하락', topLoss, false)}
        </>
      )
    }
    case 'profitRate': {
      // 베스트/워스트 % 종목
      const sorted = [...holdings].sort((a, b) => b.returnPct - a.returnPct)
      const best = sorted[0]
      const worst = sorted[sorted.length - 1]
      return (
        <div className="bg-bg-elev px-3 sm:px-3.5 py-2.5 sm:py-3">
          <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1">베스트 · 워스트</div>
          <div className="text-xs space-y-0.5">
            <div className="flex items-baseline gap-1.5 justify-between">
              <span className="text-amber font-medium truncate">{best.name}</span>
              <span className="text-gain tabular shrink-0">+{best.returnPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-baseline gap-1.5 justify-between">
              <span className="text-amber font-medium truncate">{worst.name}</span>
              <span className="text-loss tabular shrink-0">{worst.returnPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )
    }
    case 'opProfit': {
      // 최대 수익/최대 손실 종목 (₩)
      const sorted = [...holdings].sort((a, b) => b.opProfit - a.opProfit)
      const best = sorted[0]
      const worst = sorted[sorted.length - 1]
      return (
        <div className="bg-bg-elev px-3 sm:px-3.5 py-2.5 sm:py-3">
          <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1">최대 수익 · 손실</div>
          <div className="text-xs space-y-0.5">
            <div className="flex items-baseline gap-1.5 justify-between">
              <span className="text-amber font-medium truncate">{best.name}</span>
              <span className="text-gain tabular text-2xs shrink-0">+₩{Math.abs(best.opProfit).toLocaleString()}</span>
            </div>
            <div className="flex items-baseline gap-1.5 justify-between">
              <span className="text-amber font-medium truncate">{worst.name}</span>
              <span className="text-loss tabular text-2xs shrink-0">−₩{Math.abs(worst.opProfit).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )
    }
    case 'agedDays': {
      // 평균 보유일 + 가장 오래 보유 종목
      const days = holdings.map((h) => heldDays(h.buyDate)).filter((d) => d > 0)
      const avg = days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : 0
      const sorted = [...holdings].sort((a, b) => heldDays(b.buyDate) - heldDays(a.buyDate))
      const longest = sorted[0]
      const longestDays = heldDays(longest.buyDate)
      return (
        <KpiCell
          label="평균 보유"
          value={<span>{avg}<span className="text-base text-ink-faint ml-1">일</span></span>}
          sub={<span>최장: <span className="text-amber">{longest.name}</span> · {longestDays}일</span>}
          tone="cyan"
        />
      )
    }
    default:
      // unreachable, fallback
      return <KpiCell label={selectedAccount === '전체' ? '전체' : selectedAccount} value={`${holdings.length}개`} sub="positions" />
  }
}

function heldDays(d?: string): number {
  if (!d) return 0
  const t = new Date(d).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}
