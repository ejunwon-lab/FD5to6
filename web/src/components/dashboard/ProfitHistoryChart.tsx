import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { gasApi } from '../../api/gasApi'
import { useAuth } from '../../auth/AuthContext'
import { krwCompact } from '../../utils/format'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { TrendEntry } from '../../models/types'

type Range = '1W' | '1M' | '3M' | '6M'

const RANGES: Range[] = ['1W', '1M', '3M', '6M']
const RANGE_LABELS: Record<Range, string> = { '1W': '1주', '1M': '1달', '3M': '3달', '6M': '6달' }
const RANGE_DAYS: Record<Range, number> = { '1W': 7, '1M': 30, '3M': 90, '6M': 180 }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.[0]) return null
  const val = payload[0].value
  return (
    <div className="bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${val >= 0 ? 'text-profit' : 'text-loss'}`}>
        {krwCompact(val)}
      </p>
    </div>
  )
}

export function ProfitHistoryChart() {
  const { getToken } = useAuth()
  const [entries, setEntries] = useState<TrendEntry[]>([])
  const [range, setRange] = useState<Range>('1M')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getToken()
      .then(token => gasApi.getProfitHistory(token))
      .then(res => {
        if (!cancelled && res.entries) setEntries(res.entries)
      })
      .catch(e => {
        if (!cancelled) setError(String(e.message))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [getToken])

  const filtered = entries.slice(-RANGE_DAYS[range])
  const profits = filtered.map(e => e.totalProfit)
  const minProfit = Math.min(...profits, 0)
  const maxProfit = Math.max(...profits, 0)
  const rangeProfit = filtered.length >= 2
    ? filtered[filtered.length - 1].totalProfit - filtered[0].totalProfit
    : 0

  const stats = {
    avg: profits.length ? profits.reduce((a, b) => a + b, 0) / profits.length : 0,
    max: maxProfit,
    min: minProfit,
  }

  return (
    <div className="flex flex-col h-full bg-[rgb(var(--page-bg))] pb-32">
      <div className="px-4 pt-12 pb-4">
        <h2 className="text-2xl font-bold">기간별 수익</h2>
      </div>

      <div className="px-4 mb-3">
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 py-1.5 rounded-full text-sm font-medium transition-all ${
                range === r
                  ? 'bg-accent text-white'
                  : 'bg-[rgb(var(--card-bg))] text-gray-500'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="수익 히스토리 불러오는 중..." />
      ) : error ? (
        <div className="px-4">
          <Card className="p-4 text-sm text-red-500">{error}</Card>
        </div>
      ) : (
        <>
          <div className="px-4 mb-3">
            <Card className="p-4">
              <p className="text-xs text-gray-400 mb-1">
                {filtered[0]?.date ?? ''} ~ {filtered[filtered.length - 1]?.date ?? ''}
              </p>
              <p className={`text-2xl font-bold ${rangeProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {rangeProfit >= 0 ? '+' : ''}{krwCompact(rangeProfit)}
              </p>
            </Card>
          </div>

          <div className="px-4 flex-1">
            <Card className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={filtered} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => d.slice(5)}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={v => krwCompact(v)}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    domain={[minProfit * 1.05, maxProfit * 1.05]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#E5E7EB" strokeDasharray="4 2" />
                  <Line
                    type="monotone"
                    dataKey="totalProfit"
                    stroke="#405AE6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#405AE6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="px-4 mt-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '일평균', value: stats.avg },
                { label: '최고 하루', value: stats.max },
                { label: '최저 하루', value: stats.min },
              ].map(s => (
                <Card key={s.label} className="p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-1">{s.label}</p>
                  <p className={`text-sm font-bold ${s.value >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {krwCompact(s.value)}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
