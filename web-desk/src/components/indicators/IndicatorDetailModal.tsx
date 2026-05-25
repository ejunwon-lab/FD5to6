import { useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { useIndicatorHistory } from '../../lib/DataProvider'
import type { Indicator } from '../../lib/types'

interface Props {
  ind: Indicator
  onClose: () => void
}

export function IndicatorDetailModal({ ind, onClose }: Props) {
  const { entries, loading, error, ensureLoaded } = useIndicatorHistory()

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { series, stats } = useMemo(() => {
    const pts: { date: string; value: number }[] = []
    entries.forEach((e) => {
      const v = Number(e[ind.symbol])
      if (v > 0) pts.push({ date: String(e.date), value: v })
    })
    if (pts.length === 0) return { series: pts, stats: null }
    const first = pts[0].value
    const last  = pts[pts.length - 1].value
    const high  = Math.max(...pts.map((p) => p.value))
    const low   = Math.min(...pts.map((p) => p.value))
    const pct   = first > 0 ? ((last - first) / first) * 100 : 0
    return { series: pts, stats: { first, last, high, low, pct } }
  }, [entries, ind.symbol])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-deep border border-line w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div>
            <div className="text-amber font-medium text-lg leading-tight">{ind.name || ind.symbol}</div>
            <div className="text-2xs text-ink-faint tabular mt-0.5">
              {ind.symbol} · {ind.category ?? '—'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-dim hover:text-ink text-xs uppercase tracking-widest border border-line px-2 py-0.5"
          >
            ESC
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border-b border-line">
          <Stat label="Current" value={formatValue(ind.value)} />
          <Stat
            label="Day Change"
            value={`${ind.changePct >= 0 ? '+' : ''}${ind.changePct.toFixed(2)}%`}
            tone={ind.changePct >= 0 ? 'up' : 'down'}
          />
          {stats ? (
            <>
              <Stat label="Period High" value={formatValue(stats.high)} />
              <Stat label="Period Low"  value={formatValue(stats.low)} />
            </>
          ) : (
            <>
              <Stat label="Period High" value="—" />
              <Stat label="Period Low"  value="—" />
            </>
          )}
        </div>

        <div className="p-4">
          {loading && <div className="py-12 text-center text-ink-faint text-xs">loading history...</div>}
          {error && <div className="py-12 text-center text-loss text-xs">ERROR: {error}</div>}
          {!loading && !error && series.length === 0 && (
            <div className="py-12 text-center text-ink-faint text-xs">
              해당 지표 ({ind.symbol}) 히스토리 데이터 없음 — *참고지표_히스토리* 시트에 누적되어야 표시
            </div>
          )}
          {series.length > 0 && stats && (
            <>
              <div className="text-2xs text-ink-faint uppercase tracking-widest mb-2 flex items-center justify-between flex-wrap gap-2">
                <span>{series[0].date} ~ {series[series.length - 1].date} · {series.length} sessions</span>
                <span className={`text-sm tabular ${stats.pct >= 0 ? 'text-gain' : 'text-loss'}`}>
                  period {stats.pct >= 0 ? '+' : ''}{stats.pct.toFixed(2)}%
                </span>
              </div>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      interval="preserveStartEnd"
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => v.toLocaleString()}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0c0f15', border: '1px solid #374151', fontSize: 11 }}
                      formatter={(v) => Number(v).toLocaleString()}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={stats.pct >= 0 ? '#22c55e' : '#ef4444'}
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="bg-bg-elev px-3 py-2.5">
      <div className="text-2xs text-ink-faint uppercase tracking-widest mb-0.5">{label}</div>
      <div className={`text-base tabular ${tone === 'up' ? 'text-gain' : tone === 'down' ? 'text-loss' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  )
}

function formatValue(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: n >= 10000 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
