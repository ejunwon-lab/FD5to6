import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '../ui/Panel'
import { useAuth } from '../../auth/AuthContext'
import { usePortfolio } from '../../lib/usePortfolio'
import { gasApi, type StockDetailResponse } from '../../api/gasApi'

const RANGES = ['1M', '3M', '6M', 'ALL'] as const
type Range = typeof RANGES[number]
const RANGE_DAYS: Record<Range, number | 'ALL'> = { '1M': 30, '3M': 90, '6M': 180, ALL: 'ALL' }

// Price History (단축키 P) — 종목 선택 → *현재가_이력* 기반 가격 차트 + 매수/매도 마커 + 평균단가선.
// 데이터: newMobileGetStockDetail(code).priceHistory (StockDetailModal과 동일 원천)
export function PriceHistoryPage() {
  const { getToken, isSignedIn, signIn } = useAuth()
  const { holdings } = usePortfolio()

  // 종목 후보: 보유 종목을 코드 단위로 dedup (다계좌 합산), 평가금액 큰 순
  const stocks = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; value: number }>()
    holdings.forEach((h) => {
      const cur = byCode.get(h.symbol)
      if (cur) cur.value += h.value
      else byCode.set(h.symbol, { code: h.symbol, name: h.name, value: h.value })
    })
    return Array.from(byCode.values()).sort((a, b) => b.value - a.value)
  }, [holdings])

  const [selected, setSelected] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('3M')
  const [detail, setDetail] = useState<StockDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 첫 진입: 최대 비중 종목 자동 선택
  useEffect(() => {
    if (!selected && stocks.length > 0) setSelected(stocks[0].code)
  }, [stocks, selected])

  useEffect(() => {
    if (!selected || !isSignedIn) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getToken()
      .then((t) => gasApi.getStockDetail(t, selected))
      .then((res) => {
        if (cancelled) return
        if (res.success) setDetail(res)
        else setError(res.error ?? '조회 실패')
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selected, isSignedIn, getToken])

  const priceAll = detail?.priceHistory ?? []
  const priceData = useMemo(() => {
    const spec = RANGE_DAYS[range]
    if (spec === 'ALL' || priceAll.length === 0) return priceAll
    const last = priceAll[priceAll.length - 1].date
    const cutoff = shiftYmd(last, -spec)
    const filtered = priceAll.filter((p) => p.date >= cutoff)
    return filtered.length >= 2 ? filtered : priceAll
  }, [priceAll, range])

  const stats = useMemo(() => {
    if (priceData.length < 2) return null
    const first = priceData[0].price
    const lastP = priceData[priceData.length - 1].price
    const prices = priceData.map((p) => p.price)
    return {
      last: lastP,
      changePct: first > 0 ? ((lastP - first) / first) * 100 : 0,
      high: Math.max(...prices),
      low: Math.min(...prices),
    }
  }, [priceData])

  const avgPrice = detail?.summary && detail.summary.totalQuantity > 0
    ? detail.summary.totalBuyAmount / detail.summary.totalQuantity
    : null

  const txMarkers = (detail?.transactions ?? [])
    .map((tx) => {
      const pt = priceData.find((p) => p.date === tx.date)
      return pt ? { date: tx.date, price: pt.price, type: tx.type } : null
    })
    .filter((m): m is { date: string; price: number; type: '매수' | '매도' } => m !== null)

  const prices = priceData.map((p) => p.price)
  const minP = prices.length ? Math.min(...prices, ...(avgPrice ? [avgPrice] : [])) : 0
  const maxP = prices.length ? Math.max(...prices, ...(avgPrice ? [avgPrice] : [])) : 0
  const padding = (maxP - minP) * 0.05 || 1

  if (!isSignedIn) {
    return (
      <main className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="font-display text-amber text-xl tracking-widest mb-3 uppercase">Price History</div>
          <button onClick={signIn} className="bg-amber text-bg px-4 py-1 text-xs font-semibold uppercase tracking-widest hover:opacity-80">
            Sign in
          </button>
        </div>
      </main>
    )
  }

  const selectedStock = stocks.find((s) => s.code === selected)

  return (
    <main className="overflow-y-auto p-2 sm:p-3 grid gap-2.5 grid-cols-1 lg:grid-cols-[260px_1fr]" style={{ gridAutoRows: 'min-content' }}>
      {/* 종목 선택 — 데스크톱 세로 리스트 / 모바일 가로 스크롤 칩 */}
      <Panel title="Stocks" meta={`${stocks.length}종목`} className="lg:h-[calc(100dvh-180px)] lg:overflow-y-auto">
        <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible divide-y-0 lg:divide-y divide-line-dim">
          {stocks.map((s) => (
            <button
              key={s.code}
              onClick={() => setSelected(s.code)}
              className={`shrink-0 lg:w-full text-left px-3 py-2 text-xs border-l-2 whitespace-nowrap ${
                selected === s.code
                  ? 'bg-bg-elev border-amber text-ink'
                  : 'border-transparent text-ink-dim hover:bg-bg-hover hover:text-ink'
              }`}
            >
              <span className="text-amber font-medium">{s.name}</span>
              <span className="ml-2 text-2xs text-ink-faint tabular">{s.code}</span>
            </button>
          ))}
          {stocks.length === 0 && (
            <div className="px-3 py-6 text-center text-ink-faint text-xs w-full">보유 종목 없음</div>
          )}
        </div>
      </Panel>

      {/* 차트 영역 */}
      <div className="grid gap-2.5" style={{ gridAutoRows: 'min-content' }}>
        {/* KPI + 범위 버튼 */}
        <Panel
          title={selectedStock ? `${selectedStock.name}` : 'Price'}
          meta={selected ?? ''}
        >
          <div className="px-4 pt-3 pb-2">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <p className="text-2xs text-ink-faint uppercase tracking-widest mb-0.5">현재가</p>
                <p className="text-[22px] font-medium text-ink tabular leading-tight">
                  {stats ? `₩${Math.round(stats.last).toLocaleString('ko-KR')}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-2xs text-ink-faint uppercase tracking-widest mb-0.5">{range} 변화</p>
                <p className={`text-base font-medium tabular ${stats && stats.changePct >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {stats ? `${stats.changePct >= 0 ? '+' : ''}${stats.changePct.toFixed(2)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-2xs text-ink-faint uppercase tracking-widest mb-0.5">기간 고 / 저</p>
                <p className="text-base font-medium tabular text-ink-dim">
                  {stats ? `₩${Math.round(stats.high).toLocaleString('ko-KR')} / ₩${Math.round(stats.low).toLocaleString('ko-KR')}` : '—'}
                </p>
              </div>
              {avgPrice != null && (
                <div>
                  <p className="text-2xs text-ink-faint uppercase tracking-widest mb-0.5">내 평균단가</p>
                  <p className="text-base font-medium tabular text-cyan">₩{Math.round(avgPrice).toLocaleString('ko-KR')}</p>
                </div>
              )}
              <div className="ml-auto flex gap-2">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`border px-2.5 py-1 lg:py-0.5 text-2xs tracking-widest uppercase font-mono ${
                      range === r ? 'bg-amber border-amber text-bg' : 'border-line text-ink-dim hover:text-ink'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[320px] mt-3">
              {loading ? (
                <div className="h-full flex items-center justify-center text-ink-faint text-xs uppercase tracking-widest">로딩 중…</div>
              ) : error ? (
                <div className="h-full flex items-center justify-center text-loss text-xs">{error}</div>
              ) : priceData.length < 2 ? (
                <div className="h-full flex items-center justify-center text-ink-faint text-xs">가격 이력 부족</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => String(d).slice(5)}
                      tick={{ fontSize: 10, fill: '#4a5568', fontFamily: 'JetBrains Mono' }}
                      tickLine={false} axisLine={{ stroke: '#1f2630' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(v) => Math.round(Number(v)).toLocaleString('ko-KR')}
                      tick={{ fontSize: 10, fill: '#4a5568', fontFamily: 'JetBrains Mono' }}
                      tickLine={false} axisLine={{ stroke: '#1f2630' }} width={82}
                      domain={[minP - padding, maxP + padding]}
                    />
                    <Tooltip
                      contentStyle={{ background: '#11151c', border: '1px solid #1f2630', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      labelStyle={{ color: '#6b7280' }}
                      itemStyle={{ color: '#d4d8e0' }}
                      formatter={(v) => [`₩${Math.round(Number(v)).toLocaleString('ko-KR')}`, '가격']}
                    />
                    {avgPrice != null && (
                      <ReferenceLine y={avgPrice} stroke="#00d4ff" strokeDasharray="4 3" strokeOpacity={0.6} />
                    )}
                    <Line type="monotone" dataKey="price" stroke="#ffa500" strokeWidth={1.5} dot={false} />
                    {txMarkers.map((m, i) => (
                      <ReferenceDot
                        key={`${m.date}-${i}`}
                        x={m.date} y={m.price}
                        r={4}
                        fill={m.type === '매수' ? '#ff3366' : '#00ff7f'}
                        stroke="#0a0d12" strokeWidth={1.5}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex gap-4 text-2xs text-ink-faint mt-2 px-1 tracking-widest uppercase">
              <span><span className="inline-block w-2 h-2 rounded-full bg-loss mr-1.5 align-middle" />매수</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-gain mr-1.5 align-middle" />매도</span>
              {avgPrice != null && <span><span className="inline-block w-3 h-0.5 bg-cyan mr-1.5 align-middle" />내 평균단가</span>}
            </div>
          </div>
        </Panel>
      </div>
    </main>
  )
}

// 'YYYY-MM-DD' ± days
function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const mo = String(dt.getMonth() + 1).padStart(2, '0')
  const da = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mo}-${da}`
}
