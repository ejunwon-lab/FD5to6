import { Panel } from '../ui/Panel'
import type { Indicator } from '../../lib/types'

interface Props { indicators: Indicator[]; live?: boolean }

// Dashboard에 표시할 우선 지표 — 각 슬롯의 매칭 키워드 (OR)
const PRIORITY: { label: string; keywords: string[] }[] = [
  { label: 'KOSPI',      keywords: ['KOSPI'] },
  { label: 'KOSDAQ',     keywords: ['KOSDAQ'] },
  { label: 'S&P 500',    keywords: ['S&P', 'SPX', 'S&P500'] },
  { label: 'NASDAQ 100', keywords: ['NASDAQ100', 'NASDAQ', 'NDX'] },
  { label: 'USD/KRW',    keywords: ['USDKRW', 'USD/KRW', 'USD'] },
  { label: 'GBP/KRW',    keywords: ['GBPKRW', 'GBP/KRW', 'GBP'] },
]

function findIndicator(items: Indicator[], keywords: string[]): Indicator | undefined {
  const upper = items.map((i) => ({ i, key: (i.symbol + ' ' + (i.name ?? '')).toUpperCase() }))
  for (const kw of keywords) {
    const found = upper.find((u) => u.key.includes(kw.toUpperCase()))
    if (found) return found.i
  }
  return undefined
}

export function MarketIndices({ indicators, live = false }: Props) {
  // 우선순위 매칭 (없는 항목은 빈 슬롯)
  const slots = PRIORITY.map((p) => ({ label: p.label, ind: findIndicator(indicators, p.keywords) }))

  return (
    <Panel title="Markets" meta={live ? 'LIVE' : 'SAMPLE DATA'} className="col-span-1">
      <div className="grid grid-cols-2 gap-px bg-line">
        {slots.map((s, idx) => (
          <IndexCard key={idx} label={s.label} ind={s.ind} />
        ))}
      </div>
    </Panel>
  )
}

function IndexCard({ label, ind }: { label: string; ind?: Indicator }) {
  if (!ind) {
    return (
      <div className="bg-bg-elev p-3">
        <div className="text-xs text-ink-faint tracking-wider mb-1">{label}</div>
        <div className="text-ink-faint text-2xs tracking-widest uppercase mt-3">no data</div>
      </div>
    )
  }
  // 변동 데이터 없는 경우 (FX 등) → 중립 표시
  const noChangeData = ind.changeAbs === 0 && ind.changePct === 0 && ind.spark.length === 0
  const up = ind.changePct >= 0
  const stroke = noChangeData ? 'rgb(var(--c-ink-faint))' : (up ? 'rgb(var(--c-gain))' : 'rgb(var(--c-loss))')
  let points = ''
  if (ind.spark.length >= 2) {
    const max = Math.max(...ind.spark)
    const min = Math.min(...ind.spark)
    const range = max - min || 1
    points = ind.spark
      .map((v, i) => {
        const x = (i / (ind.spark.length - 1)) * 100
        const y = 28 - ((v - min) / range) * 24 - 2
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }
  return (
    <div className="bg-bg-elev p-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-amber font-medium text-xs tracking-wider truncate">{label}</span>
        {noChangeData ? (
          <span className="text-2xs tabular shrink-0 ml-1 text-ink-faint">·</span>
        ) : (
          <span className={`text-2xs tabular shrink-0 ml-1 ${up ? 'text-gain' : 'text-loss'}`}>
            {up ? '▲' : '▼'} {up ? '+' : ''}{ind.changePct.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="text-[19px] font-medium text-ink tabular leading-tight">
        {ind.value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-2xs tabular mt-0.5 ${noChangeData ? 'text-ink-faint' : (up ? 'text-gain' : 'text-loss')}`}>
        {noChangeData ? '변동 데이터 없음' : `${up ? '+' : ''}${ind.changeAbs.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </div>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-5 mt-1.5">
        <path d={points} stroke={stroke} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
