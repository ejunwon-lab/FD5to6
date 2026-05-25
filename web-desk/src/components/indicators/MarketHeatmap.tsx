import { useMemo } from 'react'
import type { Indicator } from '../../lib/types'
import { Panel } from '../ui/Panel'

interface Props {
  indicators: Indicator[]
  onSelect?: (ind: Indicator) => void
}

// 웹앱 IndicatorsPage.tsx와 동일 순서 — GAS 정의 순(REFERENCE_INDICATORS)에 맞춤
const CATEGORY_ORDER = [
  '한국시장', '한국선물', '중국시장',
  '미국시장', '미국선물', 'AI/반도체', '빅테크',
  '상품', '매크로', '환율', '암호화폐',
]

export function MarketHeatmap({ indicators, onSelect }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, Indicator[]>()
    indicators.forEach((i) => {
      const cat = i.category || '기타'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(i)
    })
    // 카테고리 순서: CATEGORY_ORDER 우선, 그 외는 알파벳
    const present = Array.from(map.keys())
    const ordered = CATEGORY_ORDER.filter((c) => map.has(c))
    const rest = present.filter((c) => !CATEGORY_ORDER.includes(c)).sort()
    return [...ordered, ...rest].map((c) => ({ category: c, items: map.get(c)! }))
  }, [indicators])

  const total = indicators.length

  return (
    <Panel title="Market Heatmap" meta={`${total} symbols · 카테고리 순`}>
      <div className="p-2 space-y-2">
        {grouped.map(({ category, items }) => (
          <div key={category}>
            <div className="text-2xs uppercase tracking-widest text-ink-faint mb-1 px-1">
              {category} <span className="text-ink-faint/70 normal-case">· {items.length}</span>
            </div>
            <div className="grid gap-1 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
              {items.map((i) => <Cell key={i.symbol} ind={i} onSelect={onSelect} />)}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="text-center text-ink-faint py-8 text-xs">no data</div>
        )}
        <Legend />
      </div>
    </Panel>
  )
}

function Cell({ ind, onSelect }: { ind: Indicator; onSelect?: (ind: Indicator) => void }) {
  const pct = ind.changePct
  const { bg, border, fg } = colorFor(pct)
  const interactive = !!onSelect
  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(ind) : undefined}
      disabled={!interactive}
      className={`relative px-2 py-2.5 border ${border} ${bg} ${fg} text-left ${interactive ? 'hover:brightness-125 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber' : 'cursor-default'} transition-all`}
      title={`${ind.name || ind.symbol} · ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
    >
      <div className="text-amber font-medium text-xs truncate">{ind.name || ind.symbol}</div>
      <div className="text-xxs text-ink-faint tabular truncate">{ind.symbol}</div>
      <div className={`text-sm font-medium tabular mt-1 ${fg}`}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </div>
    </button>
  )
}

function Legend() {
  const stops = [-5, -2, -1, 0, 1, 2, 5]
  return (
    <div className="flex items-center gap-1 mt-3 px-1 text-2xs text-ink-faint tracking-widest uppercase">
      <span className="mr-2">Δ%</span>
      {stops.map((s) => {
        const { bg } = colorFor(s === 0 ? 0 : s * 0.9)
        return (
          <div key={s} className={`h-3 w-6 ${bg} border border-line`}>
            <span className="sr-only">{s}</span>
          </div>
        )
      })}
      <span className="ml-1 tabular">−5 … 0 … +5%</span>
    </div>
  )
}

function colorFor(pct: number): { bg: string; border: string; fg: string } {
  const a = Math.abs(pct)
  if (pct > 0) {
    if (a >= 5) return { bg: 'bg-gain/50', border: 'border-gain/60', fg: 'text-ink' }
    if (a >= 2) return { bg: 'bg-gain/30', border: 'border-gain/40', fg: 'text-gain' }
    if (a >= 1) return { bg: 'bg-gain/15', border: 'border-gain/25', fg: 'text-gain' }
    if (a > 0)  return { bg: 'bg-gain/5',  border: 'border-line',    fg: 'text-gain' }
  } else if (pct < 0) {
    if (a >= 5) return { bg: 'bg-loss/50', border: 'border-loss/60', fg: 'text-ink' }
    if (a >= 2) return { bg: 'bg-loss/30', border: 'border-loss/40', fg: 'text-loss' }
    if (a >= 1) return { bg: 'bg-loss/15', border: 'border-loss/25', fg: 'text-loss' }
    if (a > 0)  return { bg: 'bg-loss/5',  border: 'border-line',    fg: 'text-loss' }
  }
  return { bg: 'bg-bg-elev', border: 'border-line', fg: 'text-ink-dim' }
}
