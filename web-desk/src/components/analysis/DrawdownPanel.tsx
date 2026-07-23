import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '../ui/Panel'
import type { EquityPoint } from '../../lib/types'

// Underwater(드로다운) 곡선 — 일별 총자산의 peak 대비 하락률. Phase C (2026-07-23).
// 자산 시리즈(asset)가 있어야 의미 있음 — 없으면(샘플 등) 렌더하지 않는 것은 부모가 판단.
export function DrawdownPanel({ equityCurve }: { equityCurve: EquityPoint[] }) {
  const data = useMemo(() => {
    const pts = equityCurve
      .filter((e) => e.asset != null && e.asset > 0)
      .map((e) => ({ date: e.date, v: e.asset as number }))
    if (pts.length < 2) return []
    let peak = pts[0].v
    return pts.map((p) => {
      if (p.v > peak) peak = p.v
      const dd = peak > 0 ? ((p.v - peak) / peak) * 100 : 0
      return { date: p.date, dd: Number(dd.toFixed(3)) }
    })
  }, [equityCurve])

  const maxDD = data.length ? Math.min(...data.map((d) => d.dd)) : 0

  if (data.length < 2) {
    return (
      <Panel title="Drawdown · Underwater" meta="no asset data">
        <div className="px-3 py-6 text-center text-ink-faint text-xs">일별 총자산 데이터 없음</div>
      </Panel>
    )
  }

  return (
    <Panel title="Drawdown · Underwater" meta={`max ${maxDD.toFixed(2)}%`}>
      <div className="px-2 pt-3 pb-1 h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dd-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff3366" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#ff3366" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1f2630" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="date" stroke="#4a5568" tick={{ fill: '#4a5568', fontSize: 10 }}
              interval={Math.max(1, Math.floor(data.length / 6))} />
            <YAxis stroke="#4a5568" tick={{ fill: '#4a5568', fontSize: 10 }} width={48}
              domain={[Math.floor(maxDD * 1.1), 0]}
              tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: '#11151c', border: '1px solid #1f2630', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              labelStyle={{ color: '#6b7280' }} itemStyle={{ color: '#d4d8e0' }}
              formatter={(v) => [`${Number(v).toFixed(2)}%`, 'drawdown']}
            />
            <Area type="monotone" dataKey="dd" stroke="#ff3366" strokeWidth={1.2} fill="url(#dd-grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
