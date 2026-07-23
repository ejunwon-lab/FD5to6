import { useMemo, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Panel } from '../ui/Panel'
import type { EquityPoint } from '../../lib/types'

const RANGES = ['1W', '1M', '3M', '6M', 'YTD', 'ALL'] as const
type Range = typeof RANGES[number]

const RANGE_DAYS: Record<Range, number | 'YTD' | 'ALL'> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  YTD: 'YTD',
  ALL: 'ALL',
}

interface Props { equityCurve: EquityPoint[]; meta?: string }

export function EquityChart({ equityCurve, meta }: Props) {
  const [range, setRange] = useState<Range>('1M')

  const filtered = useMemo(() => filterByRange(equityCurve, range), [equityCurve, range])

  // 적절한 X축 라벨 간격 — 데이터 길이에 비례
  const tickInterval = Math.max(1, Math.floor(filtered.length / 6))

  // 현재 데이터 기간 표시
  const periodLabel = filtered.length >= 2
    ? `${filtered[0].date} ~ ${filtered[filtered.length - 1].date}`
    : ''

  return (
    <Panel
      title={`Equity Curve · ${filtered.length} sessions`}
      meta={meta ? `${meta} · ${periodLabel}` : periodLabel}
      className="col-span-1 row-span-1"
    >
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex gap-2 mb-2 flex-wrap">
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
            <AreaChart data={filtered} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eq-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#00ff7f" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#00ff7f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2630" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="date" stroke="#4a5568" tick={{ fill: '#4a5568', fontSize: 10 }} interval={tickInterval} />
              <YAxis stroke="#4a5568" tick={{ fill: '#4a5568', fontSize: 10 }} width={92}
                tickFormatter={(v) => Math.round(Number(v)).toLocaleString()} />
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

function filterByRange(curve: EquityPoint[], range: Range): EquityPoint[] {
  if (!curve.length) return curve
  const spec = RANGE_DAYS[range]
  if (spec === 'ALL') return curve

  if (spec === 'YTD') {
    // fullDate(YYYY-MM-DD) 있으면 사용, 없으면 폴백
    const lastPoint = curve[curve.length - 1]
    if (lastPoint.fullDate) {
      const year = lastPoint.fullDate.slice(0, 4)
      const yearStart = `${year}-01-01`
      const filtered = curve.filter((p) => (p.fullDate ?? '') >= yearStart)
      return filtered.length ? filtered : curve.slice(-150)
    }
    return curve.slice(-150)
  }

  // 숫자: 최근 N '달력일' — entries는 거래일만 있으므로 slice(-N)이 아니라 날짜로 자른다.
  // (slice(-30)은 30거래일 ≈ 6주가 되어 "1M" 라벨과 어긋난다 — 2026-07-23 설계 노트)
  const last = curve[curve.length - 1]
  if (last.fullDate) {
    const cutoff = shiftYmd(last.fullDate, -spec)
    const filtered = curve.filter((p) => (p.fullDate ?? '') >= cutoff)
    if (filtered.length >= 2) return filtered
  }
  return curve.slice(-spec)
}

// 'YYYY-MM-DD' ± days → 'YYYY-MM-DD' (로컬)
function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const mo = String(dt.getMonth() + 1).padStart(2, '0')
  const da = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mo}-${da}`
}
