import { useMemo, useState } from 'react'
import { usePortfolio } from '../../lib/usePortfolio'
import { indicators as sampleIndicators } from '../../lib/sampleData'
import { Panel } from '../ui/Panel'
import type { Indicator } from '../../lib/types'
import { GainersLosersStrip } from './GainersLosersStrip'
import { MarketHeatmap } from './MarketHeatmap'
import { IndicatorDetailModal } from './IndicatorDetailModal'

// 웹앱과 동일 카테고리 순서 (GAS REFERENCE_INDICATORS 정의 순)
const CATEGORY_ORDER = [
  '한국시장', '한국선물', '중국시장',
  '미국시장', '미국선물', 'AI/반도체', '빅테크',
  '상품', '매크로', '환율', '암호화폐',
]

export function IndicatorsPage() {
  const { indicators: live } = usePortfolio()
  const indicators = live.length ? live : sampleIndicators
  const isLive = live.length > 0
  const [selected, setSelected] = useState<Indicator | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, Indicator[]>()
    indicators.forEach((i) => {
      const cat = i.category || '기타'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(i)
    })
    const present = Array.from(map.keys())
    const ordered = CATEGORY_ORDER.filter((c) => map.has(c))
    const rest = present.filter((c) => !CATEGORY_ORDER.includes(c)).sort()
    return [...ordered, ...rest].map((c) => [c, map.get(c)!] as const)
  }, [indicators])

  return (
    <div className="overflow-y-auto p-2 sm:p-3 grid gap-2.5">
      <GainersLosersStrip indicators={indicators} />
      <MarketHeatmap indicators={indicators} onSelect={setSelected} />
      {grouped.map(([cat, items]) => (
        <Panel key={cat} title={cat} meta={`${items.length} symbols`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line">
            {items.map((i) => (
              <BigIndicator key={i.symbol} ind={i} live={isLive} onClick={() => setSelected(i)} />
            ))}
          </div>
        </Panel>
      ))}
      {grouped.length === 0 && (
        <Panel title="Macro Indicators" meta="">
          <div className="text-center text-ink-faint py-12 text-xs">No indicators available</div>
        </Panel>
      )}
      {selected && <IndicatorDetailModal ind={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function BigIndicator({ ind, live, onClick }: { ind: Indicator; live: boolean; onClick: () => void }) {
  const up = ind.changePct >= 0
  const stroke = up ? 'rgb(var(--c-gain))' : 'rgb(var(--c-loss))'
  let points = ''
  if (ind.spark.length >= 2) {
    const max = Math.max(...ind.spark)
    const min = Math.min(...ind.spark)
    const range = max - min || 1
    points = ind.spark
      .map((v, idx) => {
        const x = (idx / (ind.spark.length - 1)) * 200
        const y = 50 - ((v - min) / range) * 46 - 2
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-bg-elev p-4 hover:bg-bg-hover text-left w-full focus:outline-none focus:ring-1 focus:ring-amber"
    >
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-amber font-medium text-sm tracking-wide">{ind.name || ind.symbol}</span>
        <span className="text-2xs text-ink-faint uppercase tracking-widest">{live ? 'live' : 'sample'}</span>
      </div>
      <div className="text-[28px] font-medium text-ink tabular leading-tight">
        {ind.value.toLocaleString('ko-KR', { minimumFractionDigits: ind.value > 10000 ? 0 : 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-xs tabular mt-1 ${up ? 'text-gain' : 'text-loss'}`}>
        {up ? '▲' : '▼'} {up ? '+' : ''}{ind.changeAbs.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span className="ml-2">({up ? '+' : ''}{ind.changePct.toFixed(2)}%)</span>
      </div>
      <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-12 mt-3">
        <path d={points} stroke={stroke} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    </button>
  )
}
