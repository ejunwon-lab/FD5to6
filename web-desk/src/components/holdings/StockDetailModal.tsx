import { useEffect, useState } from 'react'
import { Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../../auth/AuthContext'
import { gasApi, type StockDetailResponse } from '../../api/gasApi'

interface Props {
  code: string
  initialName?: string
  onClose: () => void
}

export function StockDetailModal({ code, initialName, onClose }: Props) {
  const { getToken, isSignedIn } = useAuth()
  const [detail, setDetail] = useState<StockDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false)
      setError('로그인 필요 — sample data 모드')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getToken()
      .then((t) => gasApi.getStockDetail(t, code))
      .then((res) => {
        if (cancelled) return
        if (res.success) { setDetail(res); setError(null) }
        else setError(res.error ?? '조회 실패')
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [code, isSignedIn, getToken])

  const priceData = detail?.priceHistory ?? []
  const transactions = detail?.transactions ?? []
  const positions = detail?.positions ?? []
  const summary = detail?.summary

  const prices = priceData.map((p) => p.price)
  const minP = prices.length ? Math.min(...prices) : 0
  const maxP = prices.length ? Math.max(...prices) : 0
  const padding = (maxP - minP) * 0.05 || 1

  // 거래 마커
  const txMarkers = transactions
    .map((tx) => {
      const pt = priceData.find((p) => p.date === tx.date)
      return pt ? { date: tx.date, price: pt.price, type: tx.type } : null
    })
    .filter((m): m is { date: string; price: number; type: '매수' | '매도' } => m !== null)

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl bg-bg-elev border border-line max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-deep border-b border-line z-10 px-4 py-3 flex items-start justify-between">
          <div>
            <h2 className="text-amber font-semibold text-lg tabular tracking-wide">{detail?.name ?? initialName ?? code}</h2>
            <p className="text-xs text-ink-faint tabular mt-0.5">
              {code}{detail?.category ? ` · ${detail.category}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink text-lg px-2 -mr-2"
            aria-label="close"
          >✕</button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-ink-faint text-xs uppercase tracking-widest">로딩 중...</div>
        ) : error ? (
          <div className="p-4">
            <div className="bg-loss/10 border border-loss/30 text-loss px-3 py-2 text-xs">{error}</div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Summary */}
            {summary && (
              <Section title="요약" meta="SUMMARY">
                <div className="grid grid-cols-2 gap-px bg-line border border-line">
                  <KV label="총 수량"      value={`${summary.totalQuantity.toLocaleString('ko-KR')}주`} />
                  <KV label="평가금액"    value={`₩${Math.round(summary.totalCurrentValue).toLocaleString('ko-KR')}`} />
                  <KV label="매입금액"    value={`₩${Math.round(summary.totalBuyAmount).toLocaleString('ko-KR')}`} />
                  <KV
                    label="손익 / 수익률"
                    value={`${summary.totalProfit >= 0 ? '+' : ''}₩${Math.round(summary.totalProfit).toLocaleString('ko-KR')}`}
                    sub={`${summary.profitRate >= 0 ? '+' : ''}${summary.profitRate.toFixed(2)}%`}
                    tone={summary.totalProfit >= 0 ? 'gain' : 'loss'}
                  />
                </div>
              </Section>
            )}

            {/* Chart */}
            {priceData.length >= 2 && (
              <Section title="가격 추이" meta={`${priceData[0].date} ~ ${priceData[priceData.length - 1].date}`}>
                <div className="bg-bg-elev border border-line p-2">
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={priceData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => d.slice(5)}
                          tick={{ fontSize: 10, fill: '#4a5568', fontFamily: 'JetBrains Mono' }}
                          tickLine={false} axisLine={{ stroke: '#1f2630' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tickFormatter={(v) => Math.round(Number(v)).toLocaleString('ko-KR')}
                          tick={{ fontSize: 10, fill: '#4a5568', fontFamily: 'JetBrains Mono' }}
                          tickLine={false} axisLine={{ stroke: '#1f2630' }} width={78}
                          domain={[minP - padding, maxP + padding]}
                        />
                        <Tooltip
                          contentStyle={{ background: '#11151c', border: '1px solid #1f2630', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          labelStyle={{ color: '#6b7280' }}
                          itemStyle={{ color: '#d4d8e0' }}
                          formatter={(v) => `₩${Math.round(Number(v)).toLocaleString('ko-KR')}`}
                        />
                        <Line type="monotone" dataKey="price" stroke="#00d4ff" strokeWidth={1.5} dot={false} />
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
                  </div>
                  <div className="flex gap-4 text-2xs text-ink-faint mt-2 px-1 tracking-widest uppercase">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-loss mr-1.5 align-middle" />매수</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-gain mr-1.5 align-middle" />매도</span>
                  </div>
                </div>
              </Section>
            )}

            {/* Positions */}
            {positions.length > 0 && (
              <Section title="계좌별 보유" meta={`${positions.length} accounts`}>
                <div className="border border-line">
                  {positions.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 border-b border-line-dim last:border-0 text-xs">
                      <div>
                        <div className="text-amber font-medium">{p.broker}<span className="text-ink-faint"> / </span>{p.accountType}</div>
                        <div className="text-ink-faint text-2xs tabular mt-0.5">
                          {p.quantity}주 · 평균 ₩{Math.round(p.avgPrice).toLocaleString('ko-KR')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`tabular font-medium ${p.opProfit >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {p.opProfit >= 0 ? '+' : ''}₩{Math.round(p.opProfit).toLocaleString('ko-KR')}
                        </div>
                        <div className={`text-2xs tabular ${p.opProfit >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {p.profitRate >= 0 ? '+' : ''}{p.profitRate.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Transactions */}
            {transactions.length > 0 && (
              <Section title="거래 이력" meta={`${transactions.length}건`}>
                <div className="border border-line">
                  {transactions.slice().reverse().map((tx, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3 py-2 border-b border-line-dim last:border-0 text-xs">
                      <span className={`text-2xs font-bold px-1.5 py-0 tracking-widest uppercase ${
                        tx.type === '매수' ? 'bg-loss/15 text-loss' : 'bg-gain/15 text-gain'
                      }`}>{tx.type}</span>
                      <span className="text-ink tabular">{tx.date}</span>
                      <div className="text-right">
                        <div className="tabular text-ink">{tx.quantity.toLocaleString('ko-KR')}주 @ ₩{Math.round(tx.price).toLocaleString('ko-KR')}</div>
                        <div className="text-2xs text-ink-faint tabular">₩{Math.round(tx.amount).toLocaleString('ko-KR')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="text-xs uppercase tracking-widest text-ink-dim font-semibold">{title}</h3>
        {meta && <span className="text-2xs text-ink-faint tracking-widest uppercase">{meta}</span>}
      </div>
      {children}
    </div>
  )
}

function KV({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className="bg-bg-elev px-3 py-2.5">
      <div className="text-2xs text-ink-faint mb-0.5 tracking-widest uppercase">{label}</div>
      <div className={`tabular font-medium text-sm ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'}`}>{value}</div>
      {sub && <div className={`text-2xs tabular mt-0.5 ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink-dim'}`}>{sub}</div>}
    </div>
  )
}
