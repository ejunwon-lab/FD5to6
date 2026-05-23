import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Panel } from '../ui/Panel'
import type { EquityPoint } from '../../lib/types'

const RANGES = ['1D', '1W', '1M', '3M', 'YTD', 'ALL'] as const
type Range = typeof RANGES[number]

interface Props { equityCurve: EquityPoint[]; meta?: string }

export function EquityChart({ equityCurve, meta }: Props) {
  const [range, setRange] = useState<Range>('1M')
  return (
    <Panel
      title={`Equity Curve · ${equityCurve.length} sessions`}
      meta={meta ?? 'TRACKING'}
      className="col-span-1 row-span-1"
    >
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex gap-2 mb-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`border px-2.5 py-0.5 text-2xs tracking-widest uppercase font-mono ${
                range === r ? 'bg-amber border-amber text-bg' : 'border-line text-ink-dim hover:text-ink'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurve} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="eq-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#00ff7f" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#00ff7f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2630" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="date" stroke="#4a5568" tick={{ fill: '#4a5568', fontSize: 10 }} interval={5} />
              <YAxis stroke="#4a5568" tick={{ fill: '#4a5568', fontSize: 10 }}
                tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ background: '#11151c', border: '1px solid #1f2630', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                labelStyle={{ color: '#6b7280' }}
                itemStyle={{ color: '#d4d8e0' }}
                formatter={(v) => [`₩${Math.round(Number(v)).toLocaleString()}`, 'Equity']}
              />
              <Area type="monotone" dataKey="value" stroke="#00ff7f" strokeWidth={1.5} fill="url(#eq-grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Panel>
  )
}
