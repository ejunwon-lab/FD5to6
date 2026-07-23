import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts'
import { usePortfolio } from '../../lib/usePortfolio'
import { holdings as sampleHoldings, equityCurve as sampleEquity } from '../../lib/sampleData'
import { Panel } from '../ui/Panel'
import { ContributionBar } from './ContributionBar'
import { BenchmarkPanel } from './BenchmarkPanel'
import { MonthlyHeatmapPanel } from './MonthlyHeatmapPanel'
import { DrawdownPanel } from './DrawdownPanel'

// 증권사 base 색상 + 같은 증권사 내 계좌별 명도 변형
const BROKER_SHADES: Record<string, string[]> = {
  '미래에셋': ['#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],   // orange 300~700
  '삼성증권': ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],   // blue   300~700
}
function brokerKey(b: string): string {
  const low = b.toLowerCase()
  if (low.includes('미래')) return '미래에셋'
  if (low.includes('삼성')) return '삼성증권'
  return ''
}
function brokerColor(b: string): string {
  const key = brokerKey(b)
  return key ? BROKER_SHADES[key][1] : 'rgb(var(--c-ink-dim))'   // base = 400
}
function accountShade(b: string, localIdx: number): string {
  const key = brokerKey(b)
  const shades = key ? BROKER_SHADES[key] : ['rgb(var(--c-ink-dim))']
  return shades[localIdx % shades.length]
}

import { accountDisplay } from '../../lib/accountDisplay'

// 분류 도넛 시리즈 — 테마별 값은 index.css --c-s1~s7 (modern은 CVD·대비 검증 통과 팔레트)
const CATEGORY_COLORS = [1, 2, 3, 4, 5, 6, 7].map((i) => `rgb(var(--c-s${i}))`)

export function AnalysisPage() {
  const { holdings: live, equityCurve: liveEquity, summary } = usePortfolio()
  const holdings = live.length ? live : sampleHoldings
  const equity = liveEquity.length ? liveEquity : sampleEquity
  const portfolioValue = summary?.totalValue ?? 0

  const stats = useMemo(() => computeStats(holdings, equity), [holdings, equity])

  // Total Return은 curve diff가 아니라 summary(전체 누적, 대시보드 KPI와 동일 정의) 우선.
  // curve는 서버 윈도(최소 180거래일) 안만 커버라 diff가 "윈도 내 수익"으로 축소된다 (2026-07-23).
  const totalReturnAmt = summary ? summary.totalReturn : stats.totalReturn
  const totalReturnPct = summary ? summary.totalReturnPct : stats.totalReturnPct

  return (
    <div className="overflow-y-auto p-2 sm:p-3 grid gap-2.5 grid-cols-1 lg:grid-cols-2">
      {/* Risk metrics strip */}
      <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-line border border-line">
        <Stat label="Total Return" value={`${totalReturnAmt >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}%`} tone={totalReturnAmt >= 0 ? 'up' : 'down'} sub={`${totalReturnAmt >= 0 ? '+' : '-'}₩${Math.abs(Math.round(totalReturnAmt)).toLocaleString('ko-KR')}`} />
        <Stat label="Sharpe (90d)" value={stats.sharpe.toFixed(2)} sub="annualized" tone="cyan" />
        <Stat label="Max Drawdown" value={`-${stats.maxDD.toFixed(1)}%`} sub={`${stats.maxDDDays}d ago`} tone="down" />
        <Stat label="Volatility" value={`${stats.vol.toFixed(2)}%`} sub="daily σ" />
        <Stat label="Win Days" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.winDays}/${stats.totalDays} sessions`} />
        <Stat label="Best Day" value={`+${stats.bestDay.toFixed(2)}%`} sub={stats.bestDayDate} tone="up" />
      </div>

      {/* Benchmark outperformance (전체 폭) */}
      <div className="lg:col-span-2">
        <BenchmarkPanel equityCurve={equity} portfolioValue={portfolioValue} />
      </div>

      {/* Monthly heatmap (전체 폭) */}
      <div className="lg:col-span-2">
        <MonthlyHeatmapPanel equityCurve={equity} />
      </div>

      {/* Drawdown underwater (전체 폭) — 자산 시리즈 기반 */}
      <div className="lg:col-span-2">
        <DrawdownPanel equityCurve={equity} />
      </div>

      {/* Allocation by 증권사 → 계좌 (nested) */}
      <Panel title="Allocation · 증권사 → 계좌" meta={`${holdings.length} positions`}>
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 p-3">
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* 내부 도넛: 증권사 */}
                <Pie
                  data={stats.byBroker}
                  dataKey="value"
                  nameKey="broker"
                  innerRadius={25}
                  outerRadius={55}
                  strokeWidth={0}
                >
                  {stats.byBroker.map((b) => (
                    <Cell key={b.broker} fill={brokerColor(b.broker)} />
                  ))}
                </Pie>
                {/* 외부 도넛: 계좌 (같은 증권사 색상의 명도 변형) */}
                <Pie
                  data={stats.byBrokerAccount}
                  dataKey="value"
                  nameKey="display"
                  innerRadius={62}
                  outerRadius={95}
                  strokeWidth={0}
                >
                  {stats.byBrokerAccount.map((a) => (
                    <Cell key={`${a.broker}-${a.account}`} fill={accountShade(a.broker, a.localIdx)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--c-bg-elev))', border: '1px solid rgb(var(--c-line))', fontSize: 11, fontFamily: 'var(--font-body)' }}
                  labelStyle={{ color: 'rgb(var(--c-ink-dim))' }} itemStyle={{ color: 'rgb(var(--c-ink))' }}
                  formatter={(v, name) => [`₩${Math.round(Number(v)).toLocaleString('ko-KR')}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 text-xs overflow-y-auto">
            {stats.byBrokerHierarchy.map((b) => (
              <div key={b.broker}>
                <div className="flex items-center justify-between border-b border-line-dim pb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 shrink-0" style={{ background: brokerColor(b.broker) }} />
                    <span className="text-ink font-medium truncate">{b.broker}</span>
                    <span className="text-ink-faint text-2xs shrink-0">({b.count}개 종목)</span>
                  </div>
                  <span className="tabular text-ink shrink-0 ml-2">
                    ₩{Math.round(b.total).toLocaleString('ko-KR')} · {b.pct.toFixed(2)}%
                  </span>
                </div>
                {b.accounts.map((a) => (
                  <div key={a.account} className="flex justify-between pl-4 mt-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 shrink-0" style={{ background: accountShade(a.broker, a.localIdx) }} />
                      <span className="text-ink-dim truncate">{a.display}</span>
                      <span className="text-ink-faint text-2xs shrink-0">({a.count})</span>
                    </div>
                    <span className="tabular text-ink-dim text-2xs shrink-0 ml-2">
                      ₩{Math.round(a.value).toLocaleString('ko-KR')} · {a.pct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <div className="border-t border-line mt-1 pt-2 flex justify-between text-2xs uppercase tracking-widest">
              <span className="text-ink-faint">Total</span>
              <span className="text-amber tabular normal-case">₩{Math.round(stats.totalValue).toLocaleString('ko-KR')}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Allocation by 분류 (Phase C — 시장/자산군 도넛) */}
      <Panel title="Allocation · 분류" meta={`${stats.byCategory.length} categories`}>
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 p-3">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.byCategory} dataKey="value" nameKey="category" innerRadius={45} outerRadius={85} strokeWidth={0}>
                  {stats.byCategory.map((c, i) => (
                    <Cell key={c.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--c-bg-elev))', border: '1px solid rgb(var(--c-line))', fontSize: 11, fontFamily: 'var(--font-body)' }}
                  labelStyle={{ color: 'rgb(var(--c-ink-dim))' }} itemStyle={{ color: 'rgb(var(--c-ink))' }}
                  formatter={(v, name) => [`₩${Math.round(Number(v)).toLocaleString('ko-KR')}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5 text-xs justify-center">
            {stats.byCategory.map((c, i) => (
              <div key={c.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="text-ink-dim truncate">{c.category}</span>
                  <span className="text-ink-faint text-2xs shrink-0">({c.count})</span>
                </div>
                <span className="tabular text-ink shrink-0 ml-2">
                  ₩{Math.round(c.value).toLocaleString('ko-KR')} · {c.pct.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Concentration bar */}
      <Panel title="Concentration · top positions" meta="포트폴리오 비중 (%)">
        <div className="p-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.topWeights} layout="vertical" margin={{ top: 5, right: 50, left: 0, bottom: 20 }}>
              <CartesianGrid stroke="rgb(var(--c-line))" strokeDasharray="0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: 'rgb(var(--c-ink-dim))', fontSize: 10 }}
                stroke="rgb(var(--c-ink-faint))"
                tickFormatter={(v) => `${v}%`}
                label={{ value: '비중 (%)', position: 'insideBottom', offset: -8, fill: 'rgb(var(--c-ink-dim))', fontSize: 10 }}
              />
              <YAxis dataKey="name" type="category" tick={{ fill: 'rgb(var(--c-amber))', fontSize: 10 }} stroke="rgb(var(--c-ink-faint))" width={110} interval={0} />
              <Tooltip
                contentStyle={{ background: 'rgb(var(--c-bg-elev))', border: '1px solid rgb(var(--c-line))', fontSize: 11, fontFamily: 'var(--font-body)' }}
                labelStyle={{ color: 'rgb(var(--c-ink-dim))' }} itemStyle={{ color: 'rgb(var(--c-ink))' }}
                formatter={(v) => [`${Number(v).toFixed(2)}%`, '비중']}
              />
              <Bar dataKey="weight" fill="rgb(var(--c-amber))">
                <LabelList
                  dataKey="weight"
                  position="right"
                  formatter={(v: unknown) => {
                    const n = Number(v)
                    return Number.isFinite(n) ? `${n.toFixed(1)}%` : ''
                  }}
                  fill="rgb(var(--c-ink))"
                  fontSize={10}
                />
              </Bar>
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
              <span className="text-amber font-medium flex-1 min-w-0 truncate">{w.name}</span>
              <span className="hidden sm:inline text-ink-faint text-2xs w-20">{w.symbol}</span>
              <span className="hidden sm:inline text-ink-dim text-2xs mr-3">{w.market}</span>
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
              <span className="text-amber font-medium flex-1 min-w-0 truncate">{w.name}</span>
              <span className="hidden sm:inline text-ink-faint text-2xs w-20">{w.symbol}</span>
              <span className="hidden sm:inline text-ink-dim text-2xs mr-3">{w.market}</span>
              <span className="text-loss tabular">{w.returnPct.toFixed(2)}%</span>
            </div>
          ))}
          {stats.losers.length === 0 && <div className="text-center text-ink-faint py-6 text-xs">no losers</div>}
        </div>
      </Panel>
    </div>
  )
}

function computeStats(holdings: { symbol: string; name: string; market: string; broker: string; accountType: string; category?: string; value: number; returnPct: number; weightPct: number }[], equity: { date: string; value: number; asset?: number | null }[]) {
  const totalValue = holdings.reduce((s, h) => s + h.value, 0) || 1
  // Re-compute weight from value (in case prop weightPct missing)
  const withW = holdings.map((h) => ({ ...h, w: (h.value / totalValue) * 100 }))

  // 증권사 → 계좌 계층 집계
  const brokerAccountMap = new Map<string, Map<string, { value: number; count: number }>>()
  withW.forEach((h) => {
    if (!brokerAccountMap.has(h.broker)) brokerAccountMap.set(h.broker, new Map())
    const accMap = brokerAccountMap.get(h.broker)!
    const cur = accMap.get(h.accountType) ?? { value: 0, count: 0 }
    accMap.set(h.accountType, { value: cur.value + h.value, count: cur.count + 1 })
  })

  const byBrokerHierarchy = Array.from(brokerAccountMap.entries()).map(([broker, accMap]) => {
    const total = Array.from(accMap.values()).reduce((s, v) => s + v.value, 0)
    const count = Array.from(accMap.values()).reduce((s, v) => s + v.count, 0)
    const accounts = Array.from(accMap.entries())
      .map(([account, v]) => ({
        account,
        display: accountDisplay(broker, account),
        value: v.value,
        count: v.count,
        pct: (v.value / totalValue) * 100,
        broker,
        localIdx: 0,   // 채울 자리, 아래에서 정렬 후 부여
      }))
      .sort((a, b) => b.value - a.value)
      .map((a, idx) => ({ ...a, localIdx: idx }))
    return { broker, total, count, pct: (total / totalValue) * 100, accounts }
  }).sort((a, b) => b.total - a.total)

  // Pie용 평탄 데이터 (내부 도넛)
  const byBroker = byBrokerHierarchy.map((b) => ({
    broker: b.broker, value: b.total, count: b.count, pct: b.pct,
  }))
  // Pie용 평탄 데이터 (외부 도넛, 같은 broker 끼리 인접 정렬 유지)
  const byBrokerAccount = byBrokerHierarchy.flatMap((b) => b.accounts)

  // 분류(한국주식/미국주식/펀드 등)별 집계 — Phase C 도넛 (2026-07-23)
  const catMap = new Map<string, { value: number; count: number }>()
  withW.forEach((h) => {
    const key = (h as { category?: string }).category || h.market || '기타'
    const cur = catMap.get(key) ?? { value: 0, count: 0 }
    catMap.set(key, { value: cur.value + h.value, count: cur.count + 1 })
  })
  const byCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, value: v.value, count: v.count, pct: (v.value / totalValue) * 100 }))
    .sort((a, b) => b.value - a.value)

  const topWeights = [...withW]
    .sort((a, b) => b.w - a.w)
    .slice(0, 6)
    .map((h) => ({ symbol: h.symbol, name: h.name, weight: h.w }))

  const sorted = [...holdings].sort((a, b) => b.returnPct - a.returnPct)
  const winners = sorted.filter((h) => h.returnPct > 0).slice(0, 5)
  const losers = sorted.filter((h) => h.returnPct < 0).slice(-5).reverse()

  // Equity-derived metrics
  // ⚠️ 리스크 지표(Sharpe·Vol·MDD·Win·Best)의 분모는 반드시 **총자산**이어야 한다.
  // 누적수익 곡선(value)으로 계산하면 수십 배 과대 (2026-07-23 설계 노트 — 자산 기반 교정).
  // 자산 데이터 없는 폴백(샘플 등)만 기존 수익곡선 방식 유지.
  // 한계: raw 자산 diff라 입출금일 왜곡 잔존 (TWR 보정은 doPost getPortfolioMetrics 전용).
  const values = equity.map((e) => e.value)
  const assetSeries = equity
    .filter((e) => e.asset != null && e.asset > 0)
    .map((e) => ({ date: e.date, v: e.asset as number }))
  const riskSeries = assetSeries.length >= 2
    ? assetSeries
    : equity.map((e) => ({ date: e.date, v: e.value }))

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
    // (summary 부재 시 폴백 표시용 — AnalysisPage 본문은 summary 우선 사용)
    totalReturn = values[values.length - 1] - values[0]
    totalReturnPct = (totalReturn / Math.abs(values[0] || 1)) * 100
  }

  const sv = riskSeries.map((p) => p.v)
  if (sv.length > 1) {
    const returns: number[] = []
    for (let i = 1; i < sv.length; i++) {
      const r = (sv[i] - sv[i - 1]) / Math.abs(sv[i - 1] || 1)
      if (Number.isFinite(r)) returns.push(r)
    }
    totalDays = returns.length
    winDays = returns.filter((r) => r > 0).length
    const mean = returns.reduce((s, r) => s + r, 0) / Math.max(returns.length, 1)
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(returns.length - 1, 1)
    const stdev = Math.sqrt(variance)
    vol = stdev * 100
    sharpe = stdev > 0 ? (mean / stdev) * Math.sqrt(252) : 0

    // Max drawdown — 자산 peak-to-trough (GAS getPortfolioMetrics의 Q열 MDD와 동일 정의)
    let peak = sv[0]
    let peakIdx = 0
    for (let i = 0; i < sv.length; i++) {
      if (sv[i] > peak) {
        peak = sv[i]
        peakIdx = i
      }
      const dd = (peak - sv[i]) / Math.abs(peak || 1)
      if (dd > maxDD / 100) {
        maxDD = dd * 100
        maxDDDays = sv.length - peakIdx
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
    bestDayDate = riskSeries[bestIdx + 1]?.date ?? '—'
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
    byBroker,
    byBrokerAccount,
    byBrokerHierarchy,
    byCategory,
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
