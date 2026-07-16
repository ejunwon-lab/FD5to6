import { Panel } from '../ui/Panel'
import type { Indicator } from '../../lib/types'

interface Props { indicators: Indicator[] }

export function Indicators({ indicators }: Props) {
  return (
    <Panel title="Macro · Real-time" meta="DELAY ≤15s" className="col-span-1">
      <div className="grid grid-cols-4 gap-px bg-line">
        {indicators.map((i) => {
          const up = i.changePct >= 0
          const stroke = up ? '#00ff7f' : '#ff3366'
          // Build sparkline path (graceful if no history)
          let points = ''
          if (i.spark.length >= 2) {
            const max = Math.max(...i.spark)
            const min = Math.min(...i.spark)
            const range = max - min || 1
            points = i.spark
              .map((v, idx) => {
                const x = (idx / (i.spark.length - 1)) * 100
                const y = 24 - ((v - min) / range) * 22 - 1
                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
              })
              .join(' ')
          }
          return (
            <div key={i.symbol} className="bg-bg-elev p-3">
              <div className="text-xs text-amber tracking-wide mb-1">{i.name}</div>
              <div className="text-base text-ink tabular mb-0.5">
                {i.value >= 1000 ? i.value.toLocaleString('ko-KR', { minimumFractionDigits: i.value > 10000 ? 0 : 2, maximumFractionDigits: 2 }) : i.value.toFixed(2)}
              </div>
              <div className={`text-xxs tabular ${up ? 'text-gain' : 'text-loss'}`}>
                {up ? '+' : ''}{i.changeAbs.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({up ? '+' : ''}{i.changePct.toFixed(2)}%)
              </div>
              <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="w-full h-6 mt-1.5">
                <path d={points} stroke={stroke} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
