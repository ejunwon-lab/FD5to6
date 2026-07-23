import { useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid, ReferenceLine } from 'recharts'
import { Panel } from '../ui/Panel'
import { useIndicatorHistory } from '../../lib/DataProvider'
import type { EquityPoint } from '../../lib/types'

interface Props {
  equityCurve: EquityPoint[]
  portfolioValue: number  // 현재 자산총액 — % 정규화 base
}

export function BenchmarkPanel({ equityCurve, portfolioValue }: Props) {
  const { entries, loading, error, ensureLoaded } = useIndicatorHistory()

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  const { chartData, summary } = useMemo(() => {
    if (!entries.length || !equityCurve.length || portfolioValue <= 0) {
      return { chartData: [] as ChartPoint[], summary: null as Summary | null }
    }

    const indMap = new Map<string, { KOSPI: number; SPX: number }>()
    entries.forEach((e) => {
      indMap.set(String(e.date), {
        KOSPI: Number(e.KOSPI) || 0,
        SPX:   Number(e.SPX)   || 0,
      })
    })

    const equityWithFull = equityCurve.filter((p) => p.fullDate)
    if (!equityWithFull.length) return { chartData: [] as ChartPoint[], summary: null as Summary | null }

    const points: ChartPoint[] = []
    let portfolioBase: number | null = null
    let kospiBase: number | null = null
    let spxBase: number | null = null

    equityWithFull.forEach((p) => {
      const ind = indMap.get(p.fullDate!)
      if (!ind || ind.KOSPI <= 0 || ind.SPX <= 0) return
      if (portfolioBase === null) {
        portfolioBase = p.value
        kospiBase     = ind.KOSPI
        spxBase       = ind.SPX
      }
      points.push({
        date:      p.fullDate!,
        portfolio: ((p.value - portfolioBase) / portfolioValue) * 100,
        KOSPI:     ((ind.KOSPI - kospiBase!) / kospiBase!) * 100,
        SPX:       ((ind.SPX   - spxBase!)   / spxBase!)   * 100,
      })
    })

    if (!points.length) return { chartData: [] as ChartPoint[], summary: null as Summary | null }

    const last = points[points.length - 1]
    return {
      chartData: points,
      summary: {
        portfolio:  last.portfolio,
        kospi:      last.KOSPI,
        spx:        last.SPX,
        vsKospi:    last.portfolio - last.KOSPI,
        vsSpx:      last.portfolio - last.SPX,
        rangeStart: points[0].date,
        rangeEnd:   last.date,
        n:          points.length,
      },
    }
  }, [entries, equityCurve, portfolioValue])

  const meta = loading
    ? 'loading indicator history...'
    : error
      ? `ERROR: ${error}`
      : summary
        ? `${summary.rangeStart} ~ ${summary.rangeEnd} · ${summary.n} sessions`
        : 'no data'

  return (
    <Panel title="Benchmark Outperformance" meta={meta}>
      <div className="p-3">
        {summary && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <StatBox label="Portfolio"     value={summary.portfolio} color="#fbbf24" />
            <StatBox label="vs KOSPI"      value={summary.vsKospi}   color="#60a5fa" diff />
            <StatBox label="vs S&P 500"    value={summary.vsSpx}     color="#a78bfa" diff />
          </div>
        )}
        {chartData.length > 0 && (
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'rgb(var(--c-ink-dim))' }}
                  interval="preserveStartEnd"
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgb(var(--c-ink-dim))' }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--c-bg-deep))', border: '1px solid rgb(var(--c-line-bright))', fontSize: 11 }}
                  formatter={(v) => `${Number(v).toFixed(2)}%`}
                />
                <ReferenceLine y={0} stroke="rgb(var(--c-line-bright))" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="portfolio" stroke="#fbbf24" dot={false} strokeWidth={2.2} name="Portfolio" />
                <Line type="monotone" dataKey="KOSPI"     stroke="#60a5fa" dot={false} strokeWidth={1.5} name="KOSPI" />
                <Line type="monotone" dataKey="SPX"       stroke="#a78bfa" dot={false} strokeWidth={1.5} name="S&P 500" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="py-8 text-center text-ink-faint text-xs">
            데이터 부족 — *추이 기록* 시트 또는 *참고지표_히스토리* 시트에 누적 일별 데이터 필요
          </div>
        )}
      </div>
      <div className="px-3 pb-3 text-2xs text-ink-faint leading-relaxed">
        portfolio % ≈ (누적수익 변화) ÷ 현재 자산총액 × 100 · benchmarks % = (지수 변화) ÷ 시작값 × 100.
        portfolio 정규화는 시작 시점 자산총액 정보가 없어 현재값 근사 — 추세 비교용
      </div>
    </Panel>
  )
}

interface ChartPoint {
  date: string
  portfolio: number
  KOSPI: number
  SPX: number
}

interface Summary {
  portfolio: number
  kospi: number
  spx: number
  vsKospi: number
  vsSpx: number
  rangeStart: string
  rangeEnd: string
  n: number
}

function StatBox({ label, value, color, diff }: { label: string; value: number; color: string; diff?: boolean }) {
  const sign = value >= 0 ? '+' : ''
  const toneClass = diff ? (value >= 0 ? 'text-gain' : 'text-loss') : ''
  return (
    <div className="bg-bg-elev border border-line px-3 py-2">
      <div className="text-2xs uppercase tracking-widest mb-0.5" style={{ color }}>{label}</div>
      <div className={`text-base tabular ${toneClass}`} style={!diff ? { color } : undefined}>
        {sign}{value.toFixed(2)}%
      </div>
    </div>
  )
}
