import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'
import { gasApi } from '../../api/gasApi'
import { useAuth } from '../../auth/AuthContext'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { krwFull, krwCompact, pctFormatted, profitTextClass } from '../../utils/format'
import type { StockDetailResponse } from '../../models/types'

type Props = {
  code: string
  initialName?: string
  onClose: () => void
}

export function StockDetailModal({ code, initialName, onClose }: Props) {
  const { getToken } = useAuth()
  const [detail, setDetail] = useState<StockDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getToken()
      .then(token => gasApi.getStockDetail(token, code))
      .then(res => { if (!cancelled) { if (res.success) { setDetail(res); setError('') } else setError(res.error ?? '조회 실패') } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [code, getToken])

  const priceData = detail?.priceHistory ?? []
  const transactions = detail?.transactions ?? []
  const positions = detail?.positions ?? []
  const summary = detail?.summary

  // 차트 도메인
  const prices = priceData.map(p => p.price)
  const minP = prices.length ? Math.min(...prices) : 0
  const maxP = prices.length ? Math.max(...prices) : 0
  const padding = (maxP - minP) * 0.05 || 1

  // 거래 마커: 가격 시계열의 해당 날짜에 점 찍기
  const txMarkers = transactions
    .map(tx => {
      const pt = priceData.find(p => p.date === tx.date)
      return pt ? { date: tx.date, price: pt.price, type: tx.type } : null
    })
    .filter((m): m is { date: string; price: number; type: '매수' | '매도' } => m !== null)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-[430px] mx-auto bg-[rgb(var(--page-bg))] rounded-t-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-[rgb(var(--page-bg))] z-10 px-4 pt-4 pb-3 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{detail?.name ?? initialName ?? code}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{code} · {detail?.category}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 text-xl px-2">✕</button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="종목 정보 불러오는 중..." />
        ) : error ? (
          <div className="px-4 py-6"><Card className="p-4 text-sm text-red-500">{error}</Card></div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {/* 요약 카드 */}
            {summary && (
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">총 수량</p>
                    <p className="text-base font-bold">{summary.totalQuantity.toLocaleString()}주</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">평가금액</p>
                    <p className="text-base font-bold">{krwFull(summary.totalCurrentValue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">매입금액</p>
                    <p className="text-base font-bold">{krwFull(summary.totalBuyAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">손익 / 수익률</p>
                    <p className={`text-base font-bold ${profitTextClass(summary.totalProfit)}`}>
                      {summary.totalProfit >= 0 ? '+' : ''}{krwFull(summary.totalProfit)}
                    </p>
                    <p className={`text-xs ${profitTextClass(summary.totalProfit)}`}>{pctFormatted(summary.profitRate)}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* 가격 시계열 차트 */}
            {priceData.length >= 2 && (
              <Card className="p-3">
                <p className="text-xs text-gray-500 mb-2 px-1">가격 추이 ({priceData[0].date} ~ {priceData[priceData.length - 1].date})</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={priceData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={d => d.slice(5)}
                      tick={{ fontSize: 9, fill: '#9CA3AF' }}
                      tickLine={false} axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={v => krwCompact(v)}
                      tick={{ fontSize: 9, fill: '#9CA3AF' }}
                      tickLine={false} axisLine={false} width={56}
                      domain={[minP - padding, maxP + padding]}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                      labelStyle={{ fontSize: 10 }}
                      formatter={(v: number) => krwFull(v)}
                    />
                    <Line type="monotone" dataKey="price" stroke="#405AE6" strokeWidth={2} dot={false} />
                    {txMarkers.map((m, i) => (
                      <ReferenceDot
                        key={`${m.date}-${i}`}
                        x={m.date} y={m.price}
                        r={4}
                        fill={m.type === '매수' ? '#D91919' : '#0D5AD9'}
                        stroke="#fff" strokeWidth={1.5}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 text-[10px] text-gray-500 mt-2 px-1">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-loss mr-1 align-middle" />매수</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-profit mr-1 align-middle" />매도</span>
                </div>
              </Card>
            )}

            {/* 계좌별 보유 */}
            {positions.length > 0 && (
              <Card className="p-3">
                <p className="text-xs text-gray-500 mb-2 px-1">계좌별 보유</p>
                {positions.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-1 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="text-xs font-medium">{p.broker} / {p.accountType}</p>
                      <p className="text-[10px] text-gray-400">{p.quantity}주 · 평균 {krwFull(p.avgPrice)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${profitTextClass(p.opProfit)}`}>
                        {p.opProfit >= 0 ? '+' : ''}{krwFull(p.opProfit)}
                      </p>
                      <p className={`text-[10px] ${profitTextClass(p.opProfit)}`}>{pctFormatted(p.profitRate)}</p>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* 거래 이력 */}
            {transactions.length > 0 && (
              <Card className="p-3">
                <p className="text-xs text-gray-500 mb-2 px-1">거래 이력 ({transactions.length}건)</p>
                {transactions.slice().reverse().map((tx, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-1 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                    <div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tx.type === '매수' ? 'bg-loss/10 text-loss' : 'bg-profit/10 text-profit'}`}>
                        {tx.type}
                      </span>
                      <span className="text-xs ml-2">{tx.date}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs">{tx.quantity.toLocaleString()}주 @ {krwFull(tx.price)}</p>
                      <p className="text-[10px] text-gray-400">{krwFull(tx.amount)}</p>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
