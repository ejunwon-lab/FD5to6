import { useMemo } from 'react'
import { usePortfolio } from '../../lib/usePortfolio'
import { indicators as sampleIndicators } from '../../lib/sampleData'
import { Panel } from '../ui/Panel'
import type { Indicator } from '../../lib/types'

const CATEGORY_LABELS: Record<string, string> = {
  index_kr:    'Korea',
  index_us:    'US',
  index_intl:  'International',
  fx:          'FX',
  crypto:      'Crypto',
  commodity:   'Commodity',
  bond:        'Rates',
  other:       'Other',
}

// Categorize indicators by symbol prefix (rough)
function categorize(ind: Indicator): string {
  const s = ind.symbol.toUpperCase()
  if (s.includes('KOSPI') || s.includes('KOSDAQ')) return 'index_kr'
  if (s.includes('S&P') || s.includes('SPX') || s.includes('NASDAQ') || s.includes('IXIC') || s.includes('DOW') || s.includes('DJI') || s.includes('VIX')) return 'index_us'
  if (s.includes('NIKKEI') || s.includes('HSI') || s.includes('FTSE') || s.includes('DAX')) return 'index_intl'
  if (s.includes('USD') || s.includes('KRW') || s.includes('EUR') || s.includes('JPY') || s.includes('GBP')) return 'fx'
  if (s.includes('BTC') || s.includes('ETH') || s.includes('SOL')) return 'crypto'
  if (s.includes('GOLD') || s.includes('OIL') || s.includes('WTI') || s.includes('BRENT')) return 'commodity'
  if (s.includes('YIELD') || s.includes('UST') || s.includes('BOND')) return 'bond'
  return 'other'
}

export function IndicatorsPage() {
  const { indicators: live } = usePortfolio()
  const indicators = live.length ? live : sampleIndicators

  const grouped = useMemo(() => {
    const map = new Map<string, Indicator[]>()
    indicators.forEach((i) => {
      const cat = categorize(i)
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(i)
    })
    return Array.from(map.entries())
  }, [indicators])

  return (
    <div className="overflow-y-auto p-3 grid gap-2.5">
      {grouped.map(([cat, items]) => (
        <Panel key={cat} title={CATEGORY_LABELS[cat] ?? cat} meta={`${items.length} symbols`}>
          <div className="grid grid-cols-3 gap-px bg-line">
            {items.map((i) => (
              <BigIndicator key={i.symbol} ind={i} />
            ))}
          </div>
        </Panel>
      ))}
      {grouped.length === 0 && (
        <Panel title="Macro Indicators" meta="">
          <div className="text-center text-ink-faint py-12 text-xs">No indicators available</div>
        </Panel>
      )}
    </div>
  )
}

function BigIndicator({ ind }: { ind: Indicator }) {
  const up = ind.changePct >= 0
  const stroke = up ? '#00ff7f' : '#ff3366'
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
    <div className="bg-bg-elev p-4 hover:bg-bg-hover">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-amber font-medium text-sm tracking-wide">{ind.name || ind.symbol}</span>
        <span className="text-2xs text-ink-faint uppercase tracking-widest">live</span>
      </div>
      <div className="text-[28px] font-medium text-ink tabular leading-tight">
        {ind.value.toLocaleString('en-US', { minimumFractionDigits: ind.value > 10000 ? 0 : 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-xs tabular mt-1 ${up ? 'text-gain' : 'text-loss'}`}>
        {up ? '▲' : '▼'} {up ? '+' : ''}{ind.changeAbs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span className="ml-2">({up ? '+' : ''}{ind.changePct.toFixed(2)}%)</span>
      </div>
      <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-12 mt-3">
        <path d={points} stroke={stroke} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
