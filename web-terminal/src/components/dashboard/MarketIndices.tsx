import { Panel } from '../ui/Panel'
import type { Indicator } from '../../lib/types'

interface Props { indicators: Indicator[] }

// Dashboard에 보여줄 코어 시장 지수 — KOSPI + KOSDAQ 만
const PRIORITY = ['KOSPI', 'KOSDAQ']

export function MarketIndices({ indicators }: Props) {
  // 우선순위 매칭 후 fallback으로 처음 두 개
  const picked = PRIORITY
    .map((p) => indicators.find((i) => i.symbol.toUpperCase().includes(p)))
    .filter((i): i is Indicator => i !== undefined)
  const display = picked.length ? picked : indicators.slice(0, 2)

  return (
    <Panel title="Korea Market" meta="LIVE" className="col-span-1">
      <div className="grid grid-cols-2 gap-px bg-line">
        {display.map((i) => (
          <IndexCard key={i.symbol} ind={i} />
        ))}
        {display.length === 0 && (
          <div className="col-span-2 bg-bg-elev p-6 text-center text-ink-faint text-xs">
            No index data
          </div>
        )}
      </div>
    </Panel>
  )
}

function IndexCard({ ind }: { ind: Indicator }) {
  const up = ind.changePct >= 0
  const stroke = up ? '#00ff7f' : '#ff3366'
  let points = ''
  if (ind.spark.length >= 2) {
    const max = Math.max(...ind.spark)
    const min = Math.min(...ind.spark)
    const range = max - min || 1
    points = ind.spark
      .map((v, idx) => {
        const x = (idx / (ind.spark.length - 1)) * 100
        const y = 32 - ((v - min) / range) * 28 - 2
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }
  return (
    <div className="bg-bg-elev p-3.5">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-amber font-medium text-xs tracking-wider">{ind.name || ind.symbol}</span>
        <span className={`text-2xs tabular ${up ? 'text-gain' : 'text-loss'}`}>
          {up ? '▲' : '▼'} {up ? '+' : ''}{ind.changePct.toFixed(2)}%
        </span>
      </div>
      <div className="text-[22px] font-medium text-ink tabular leading-tight">
        {ind.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-xs tabular mt-0.5 ${up ? 'text-gain' : 'text-loss'}`}>
        {up ? '+' : ''}{ind.changeAbs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-7 mt-2">
        <path d={points} stroke={stroke} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
