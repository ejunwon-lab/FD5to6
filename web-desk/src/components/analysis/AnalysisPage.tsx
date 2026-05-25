import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { usePortfolio } from '../../lib/usePortfolio'
import { holdings as sampleHoldings, equityCurve as sampleEquity } from '../../lib/sampleData'
import { Panel } from '../ui/Panel'
import { ContributionBar } from './ContributionBar'

const MARKET_COLORS = { KR: '#00d4ff', US: '#ffa500' } as const

export function AnalysisPage() {
  const { holdings: live, equityCurve: liveEquity } = usePortfolio()
  const holdings = live.length ? live : sampleHoldings
  const equity = liveEquity.length ? liveEquity : sampleEquity

  const stats = useMemo(() => computeStats(holdings, equity), [holdings, equity])

  return (
    <div className="overflow-y-auto p-2 sm:p-3 grid gap-2.5 grid-cols-1 lg:grid-cols-2">
      {/* Risk metrics strip */}
      <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-line border border-line">
        <Stat label="Total Return" value={`${stats.totalReturn >= 0 ? '+' : ''}${stats.totalReturnPct.toFixed(2)}%`} tone={stats.totalReturn >= 0 ? 'up' : 'down'} sub={`₩${stats.totalReturn.toLocaleString()}`} />
        <Stat label="Sharpe (90d)" value={stats.sharpe.toFixed(2)} sub="annualized" tone="cyan" />
        <Stat label="Max Drawdown" value={`-${stats.maxDD.toFixed(1)}%`} sub={`${stats.maxDDDays}d ago`} tone="down" />
        <Stat label="Volatility" value={`${stats.vol.toFixed(2)}%`} sub="daily σ" />
        <Stat label="Win Days" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.winDays}/${stats.totalDays} sessions`} />
        <Stat label="Best Day" value={`+${stats.bestDay.toFixed(2)}%`} sub={stats.bestDayDate} tone="up" />
      </div>

      {/* Allocation by Market */}
      <Panel title="Allocation · by Market" meta={`${holdings.length} positions`}>
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.byMarket} dataKey="value" nameKey="market" outerRadius={70} innerRadius={42} strokeWidth={0}>
                  {stats.byMarket.map((m) => (
                    <Cell key={m.market} fill={MARKET_COLORS[m.market as 'KR' | 'US'] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#11151c', border: '1px solid #1f2630', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  labelStyle={{ color: '#6b7280' }} itemStyle={{ color: '#d4d8e0' }}
                  formatter={(v) => [`₩${Math.round(Number(v)).toLocaleString()}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col justify-center gap-2 text-xs">
            {stats.byMarket.map((m) => (
              <div key={m.market} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5" style={{ background: MARKET_COLORS[m.market as 'KR' | 'US'] }} />
                  <span className="text-ink-dim">{m.market}</span>
                  <span className="text-ink-faint text-2xs">({m.count})</span>
                </div>
                <span className="tabular">{m.pct.toFixed(1)}%</span>
              </div>
            ))}
            <div className="border-t border-line mt-2 pt-2 text-ink-faint text-2xs uppercase tracking-widest">Total</div>
            <div className="text-ink tabular">₩{stats.totalValue.toLocaleString()}</div>
          </div>
        </div>
      </Panel>

      {/* Concentration bar */}
      <Panel title="Concentration · top positions" meta="HHI risk">
        <div className="p-3 h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.topWeights} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
              <CartesianGrid stroke="#1f2630" strokeDasharray="0" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#4a5568', fontSize: 10 }} stroke="#4a5568" />
              <YAxis dataKey="symbol" type="category" tick={{ fill: '#ffa500', fontSize: 10 }} stroke="#4a5568" width={60} />
              <Tooltip
                contentStyle={{ background: '#11151c', border: '1px solid #1f2630', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                labelStyle={{ color: '#6b7280' }} itemStyle={{ color: '#d4d8e0' }}
                formatter={(v) => [`${Number(v).toFixed(1)}%`, 'weight']}
              />
              <Bar dataKey="weight" fill="#ffa500" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Profit Contribution — 종목별 합계 수익 기여 */}
      <ContributionBar holdings={holdings} />

      {/* Top winners */}
      <Panel title="Top Winners">
        <div className="p-2">
          {stats.winners.map((w, i) => (
            <div key={w.symbol} className="flex items-center justify-between px-2.5 py-1.5 border-b border-line-dim last:border-0 hover:bg-bg-hover text-xs">
              <span className="text-ink-faint w-6 tabular">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-amber font-medium w-20">{w.symbol}</span>
              <span className="text-ink-dim flex-1">{w.name}</span>
              <span className="text-ink-dim text-2xs mr-3">{w.market}</span>
              <span className="text-gain tabular">+{w.returnPct.toFixed(2)}%</span>
            </div>
          ))}
          {stats.winners.length === 0 && <div className="text-center text-ink-faint py-6 text-xs">no winners</div>}
        </div>
      </Panel>

      {/* Top losers */}
      <Panel title="Top Losers">
        <div className="p-2">
          {stats.losers.map((w, i) => (
            <div key={w.symbol} className="flex items-center justify-between px-2.5 py-1.5 border-b border-line-dim last:border-0 hover:bg-bg-hover text-xs">
              <span className="text-ink-faint w-6 tabular">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-amber font-medium w-20">{w.symbol}</span>
              <span className="text-ink-dim flex-1">{w.name}</span>
              <span className="text-ink-dim text-2xs mr-3">{w.market}</span>
              <span className="text-loss tabular">{w.returnPct.toFixed(2)}%</span>
            </div>
          ))}
          {stats.losers.length === 0 && <div className="text-center text-ink-faint py-6 text-xs">no losers</div>}
        </div>
      </Panel>
    </div>
  )
}

function computeStats(holdings: { symbol: string; name: string; market: string; value: number; returnPct: number; weightPct: number }[], equity: { date: string; value: number }[]) {
  const totalValue = holdings.reduce((s, h) => s + h.value, 0) || 1
  // Re-compute weight from value (in case prop weightPct missing)
  const withW = holdings.map((h) => ({ ...h, w: (h.value / totalValue) * 100 }))

  const byMarketMap = new Map<string, { value: number; count: number }>()
  withW.forEach((h) => {
    const cur = byMarketMap.get(h.market) ?? { value: 0, count: 0 }
    byMarketMap.set(h.market, { value: cur.value + h.value, count: cur.count + 1 })
  })
  const byMarket = Array.from(byMarketMap.entries()).map(([market, v]) => ({
    market,
    value: v.value,
    count: v.count,
    pct: (v.value / totalValue) * 100,
  }))

  const topWeights = [...withW]
    .sort((a, b) => b.w - a.w)
    .slice(0, 6)
    .map((h) => ({ symbol: h.symbol, weight: h.w }))

  const sorted = [...holdings].sort((a, b) => b.returnPct - a.returnPct)
  const winners = sorted.filter((h) => h.returnPct > 0).slice(0, 5)
  const losers = sorted.filter((h) => h.returnPct < 0).slice(-5).reverse()

  // Equity-derived metrics
  const values = equity.map((e) => e.value)
  let totalReturn = 0
  let totalReturnPct = 0
  let sharpe = 0
  let maxDD = 0
  let maxDDDays = 0
  let vol = 0
  let winDays = 0
  let totalDays = 0
  let bestDay = 0
  let bestDayDate = '—'

  if (values.length > 1) {
    totalReturn = values[values.length - 1] - values[0]
    totalReturnPct = (totalReturn / Math.abs(values[0] || 1)) * 100
    const returns: number[] = []
    for (let i = 1; i < values.length; i++) {
      const r = (values[i] - values[i - 1]) / Math.abs(values[i - 1] || 1)
      if (Number.isFinite(r)) returns.push(r)
    }
    totalDays = returns.length
    winDays = returns.filter((r) => r > 0).length
    const mean = returns.reduce((s, r) => s + r, 0) / Math.max(returns.length, 1)
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(returns.length - 1, 1)
    const stdev = Math.sqrt(variance)
    vol = stdev * 100
    sharpe = stdev > 0 ? (mean / stdev) * Math.sqrt(252) : 0

    // Max drawdown
    let peak = values[0]
    let peakIdx = 0
    for (let i = 0; i < values.length; i++) {
      if (values[i] > peak) {
        peak = values[i]
        peakIdx = i
      }
      const dd = (peak - values[i]) / Math.abs(peak || 1)
      if (dd > maxDD / 100) {
        maxDD = dd * 100
        maxDDDays = values.length - peakIdx
      }
    }

    // Best day
    let bestIdx = 0
    let bestVal = -Infinity
    returns.forEach((r, idx) => {
      if (r > bestVal) {
        bestVal = r
        bestIdx = idx
      }
    })
    bestDay = bestVal * 100
    bestDayDate = equity[bestIdx + 1]?.date ?? '—'
  }

  return {
    totalValue,
    totalReturn,
    totalReturnPct,
    sharpe,
    maxDD,
    maxDDDays,
    vol,
    winRate: totalDays ? (winDays / totalDays) * 100 : 0,
    winDays,
    totalDays,
    bestDay,
    bestDayDate,
    byMarket,
    topWeights,
    winners,
    losers,
  }
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'up' | 'down' | 'cyan' }) {
  return (
    <div className="bg-bg-elev px-3.5 py-3.5">
      <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1.5">{label}</div>
      <div className={`text-[20px] font-medium tabular ${tone === 'up' ? 'text-gain' : tone === 'down' ? 'text-loss' : tone === 'cyan' ? 'text-cyan' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-ink-dim tabular mt-0.5">{sub}</div>
    </div>
  )
}
