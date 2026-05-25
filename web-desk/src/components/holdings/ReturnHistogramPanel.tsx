import { useMemo } from 'react'
import { Panel } from '../ui/Panel'
import type { Holding } from '../../lib/types'

interface Bucket {
  label: string
  min: number
  max: number
}

const BUCKETS: Bucket[] = [
  { label: '< -30',  min: -Infinity, max: -30 },
  { label: '-30~-20', min: -30, max: -20 },
  { label: '-20~-10', min: -20, max: -10 },
  { label: '-10~0',   min: -10, max: 0 },
  { label: '0~+10',   min: 0,   max: 10 },
  { label: '+10~+20', min: 10,  max: 20 },
  { label: '+20~+30', min: 20,  max: 30 },
  { label: '+30~+50', min: 30,  max: 50 },
  { label: '+50~+100', min: 50, max: 100 },
  { label: '> +100',  min: 100, max: Infinity },
]

export function ReturnHistogramPanel({ holdings }: { holdings: Holding[] }) {
  const { counts, maxCount, gainN, lossN, median, mean } = useMemo(() => {
    const counts = BUCKETS.map(
      (b) => holdings.filter((h) => h.returnPct >= b.min && h.returnPct < b.max).length,
    )
    const maxCount = Math.max(...counts, 1)
    const gainN = holdings.filter((h) => h.returnPct > 0).length
    const lossN = holdings.filter((h) => h.returnPct < 0).length
    const sorted = [...holdings].map((h) => h.returnPct).sort((a, b) => a - b)
    const median = sorted.length
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0
    const mean = holdings.length ? holdings.reduce((s, h) => s + h.returnPct, 0) / holdings.length : 0
    return { counts, maxCount, gainN, lossN, median, mean }
  }, [holdings])

  if (holdings.length === 0) {
    return (
      <Panel title="Return Distribution" meta="no data">
        <div className="px-3 py-6 text-center text-ink-faint text-xs">no holdings</div>
      </Panel>
    )
  }

  return (
    <Panel title="Return Distribution" meta={`${holdings.length} holdings · median ${median >= 0 ? '+' : ''}${median.toFixed(1)}% · mean ${mean >= 0 ? '+' : ''}${mean.toFixed(1)}%`}>
      <div className="p-3">
        <div className="grid grid-cols-10 gap-1 items-end h-32">
          {BUCKETS.map((b, i) => {
            const count = counts[i]
            const heightPct = (count / maxCount) * 100
            const tone =
              b.max <= 0 ? 'bg-loss' :
              b.min >= 20 ? 'bg-gain' :
              b.min >= 0 ? 'bg-amber/70' : 'bg-amber/40'
            return (
              <div key={b.label} className="flex flex-col items-center gap-0.5">
                <div className="text-2xs tabular text-ink-dim h-3">{count > 0 ? count : ''}</div>
                <div className="flex-1 w-full flex items-end">
                  <div
                    className={`w-full ${tone}`}
                    style={{ height: `${heightPct}%`, minHeight: count > 0 ? '3px' : '0' }}
                    title={`${b.label}%: ${count} holding${count !== 1 ? 's' : ''}`}
                  />
                </div>
                <div className="text-2xs text-ink-faint leading-tight text-center mt-1">
                  {b.label}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-2xs text-ink-faint tracking-widest uppercase">
          <span>x: return % bucket · y: holdings count</span>
          <span><span className="text-gain">{gainN} gain</span> · <span className="text-loss">{lossN} loss</span></span>
        </div>
      </div>
    </Panel>
  )
}
