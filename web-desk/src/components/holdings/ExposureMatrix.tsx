import { useMemo } from 'react'
import type { Holding } from '../../lib/types'
import type { CashReserve, NonStockAssets } from '../../api/gasApi'
import { Panel } from '../ui/Panel'
import { accountDisplay } from '../../lib/accountDisplay'

interface Props {
  holdings: Holding[]
  cashReserve?: CashReserve | null
  nonStockAssets?: NonStockAssets | null
}

export function ExposureMatrix({ holdings, cashReserve, nonStockAssets }: Props) {
  const { rows, totals } = useMemo(() => {
    // 계좌별 원금/수익/평가 집계 (broker도 같이 추적해서 display 만들 때 사용)
    const agg: Record<string, { broker: string; opBuy: number; opProfit: number; value: number; count: number }> = {}
    for (const h of holdings) {
      const key = `${h.broker}||${h.accountType}`
      if (!agg[key]) agg[key] = { broker: h.broker, opBuy: 0, opProfit: 0, value: 0, count: 0 }
      agg[key].opBuy += h.opBuy
      agg[key].opProfit += h.opProfit
      agg[key].value += h.value
      agg[key].count += 1
    }

    const rows = Object.entries(agg)
      .map(([key, a]) => {
        const [broker, account] = key.split('||')
        const returnPct = a.opBuy > 0 ? (a.opProfit / a.opBuy) * 100 : 0
        return {
          broker, account,
          display: accountDisplay(broker, account),
          opBuy: a.opBuy,
          opProfit: a.opProfit,
          value: a.value,
          count: a.count,
          returnPct,
        }
      })
      .sort((a, b) => b.value - a.value)

    const totals = {
      opBuy: rows.reduce((s, r) => s + r.opBuy, 0),
      opProfit: rows.reduce((s, r) => s + r.opProfit, 0),
      value: rows.reduce((s, r) => s + r.value, 0),
      count: rows.reduce((s, r) => s + r.count, 0),
    }
    return { rows, totals }
  }, [holdings])

  const totalReturnPct = totals.opBuy > 0 ? (totals.opProfit / totals.opBuy) * 100 : 0
  const cashTotal = cashReserve?.total ?? 0
  const nonStockTotal = nonStockAssets?.total ?? 0
  const netWorth = totals.value + nonStockTotal + cashTotal

  return (
    <Panel
      title="Account P&L"
      meta={`${rows.length} accounts · ${totals.count} positions · 평가 ₩${Math.round(totals.value).toLocaleString()}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line">
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">Account</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">투자 원금</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">수익금</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium text-amber">합계 (평가)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.broker}-${r.account}`} className="border-b border-line-dim">
                <td className="px-3 py-2">
                  <div className="text-ink">{r.display}</div>
                  <div className="text-2xs text-ink-faint tabular">{r.count}개 종목</div>
                </td>
                <td className="px-3 py-2 text-right tabular text-ink">
                  ₩{Math.round(r.opBuy).toLocaleString()}
                </td>
                <td className={`px-3 py-2 text-right tabular ${r.opProfit >= 0 ? 'text-gain' : 'text-loss'}`}>
                  <div>{r.opProfit >= 0 ? '+' : ''}₩{Math.round(r.opProfit).toLocaleString()}</div>
                  <div className="text-2xs opacity-80">
                    {r.returnPct >= 0 ? '+' : ''}{r.returnPct.toFixed(2)}%
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular bg-bg-elev">
                  <div className="text-amber font-medium">₩{Math.round(r.value).toLocaleString()}</div>
                </td>
              </tr>
            ))}
            {/* 주식 소계 */}
            <tr className="border-t border-line bg-bg/30">
              <td className="px-3 py-2 text-2xs uppercase tracking-widest text-ink-faint font-medium">
                주식 소계
                <div className="text-2xs text-ink-faint tabular normal-case">{totals.count}개 종목</div>
              </td>
              <td className="px-3 py-2 text-right tabular text-ink font-medium">
                ₩{Math.round(totals.opBuy).toLocaleString()}
              </td>
              <td className={`px-3 py-2 text-right tabular font-medium ${totals.opProfit >= 0 ? 'text-gain' : 'text-loss'}`}>
                <div>{totals.opProfit >= 0 ? '+' : ''}₩{Math.round(totals.opProfit).toLocaleString()}</div>
                <div className="text-2xs opacity-80">
                  {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular bg-amber/5">
                <div className="text-amber font-medium">₩{Math.round(totals.value).toLocaleString()}</div>
              </td>
            </tr>

            {/* 비주식 자산 그룹 (펀드·예금·보험·기타) */}
            {nonStockAssets && nonStockAssets.items.length > 0 && (
              <>
                {nonStockAssets.items.map((a, i) => {
                  const display = accountDisplay(a.broker, a.account)
                  const isProfit = a.opProfit >= 0
                  return (
                    <tr key={`nonstock-${i}`} className="border-b border-line-dim">
                      <td className="px-3 py-2">
                        <div className="text-ink">{display}</div>
                        <div className="text-2xs text-ink-faint tabular normal-case">
                          {a.category}{a.name ? ` · ${a.name}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular text-ink">
                        {a.opBuy > 0 ? `₩${Math.round(a.opBuy).toLocaleString()}` : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right tabular ${a.opProfit === 0 ? 'text-ink-faint' : (isProfit ? 'text-gain' : 'text-loss')}`}>
                        {a.opProfit !== 0 ? (
                          <>
                            <div>{isProfit ? '+' : ''}₩{Math.round(a.opProfit).toLocaleString()}</div>
                            <div className="text-2xs opacity-80">
                              {a.profitRate >= 0 ? '+' : ''}{a.profitRate.toFixed(2)}%
                            </div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular bg-bg-elev">
                        <div className="text-ink-dim font-medium">₩{Math.round(a.value).toLocaleString()}</div>
                      </td>
                    </tr>
                  )
                })}
                {/* 비주식 자산 소계 */}
                <tr className="border-t border-line-dim bg-bg/30">
                  <td className="px-3 py-2 text-2xs uppercase tracking-widest text-ink-faint font-medium">
                    비주식 자산 소계
                    <div className="text-2xs text-ink-faint tabular normal-case">
                      {nonStockAssets.items.length}건 · {Array.from(new Set(nonStockAssets.items.map(i => i.category))).join('·')}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink-faint">—</td>
                  <td className="px-3 py-2 text-right tabular text-ink-faint">—</td>
                  <td className="px-3 py-2 text-right tabular bg-ink/5">
                    <div className="text-ink font-medium">₩{Math.round(nonStockAssets.total).toLocaleString()}</div>
                  </td>
                </tr>
              </>
            )}

            {/* 대기자금 그룹 */}
            {cashReserve && cashReserve.items.length > 0 && (
              <>
                {cashReserve.items.map((c, i) => {
                  const display = accountDisplay(c.broker, c.account)
                  return (
                  <tr key={`cash-${i}`} className="border-b border-line-dim">
                    <td className="px-3 py-2">
                      <div className="text-cyan">{display}</div>
                      <div className="text-2xs text-ink-faint tabular normal-case">
                        대기자금{c.updatedAt ? ` · ${c.updatedAt}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular text-ink-faint">—</td>
                    <td className="px-3 py-2 text-right tabular text-ink-faint">—</td>
                    <td className="px-3 py-2 text-right tabular bg-bg-elev">
                      <div className="text-cyan font-medium">₩{Math.round(c.amount).toLocaleString()}</div>
                      {c.note && <div className="text-2xs text-ink-faint normal-case">{c.note}</div>}
                    </td>
                  </tr>
                  )
                })}
                {/* 대기자금 소계 */}
                <tr className="border-t border-line-dim bg-bg/30">
                  <td className="px-3 py-2 text-2xs uppercase tracking-widest text-ink-faint font-medium">
                    대기자금 소계
                    <div className="text-2xs text-ink-faint tabular normal-case">{cashReserve.items.length}개 계좌</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink-faint">—</td>
                  <td className="px-3 py-2 text-right tabular text-ink-faint">—</td>
                  <td className="px-3 py-2 text-right tabular bg-cyan/5">
                    <div className="text-cyan font-medium">₩{Math.round(cashTotal).toLocaleString()}</div>
                  </td>
                </tr>
              </>
            )}

            {/* 순자산 합계 */}
            <tr className="border-t-2 border-amber/40 bg-amber/5">
              <td className="px-3 py-2.5 text-2xs uppercase tracking-widest font-semibold text-amber">
                순자산 합계
                <div className="text-2xs text-ink-faint tabular normal-case">
                  주식{nonStockTotal > 0 ? ' + 비주식' : ''}{cashTotal > 0 ? ' + 대기자금' : ''}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular text-ink-faint">—</td>
              <td className="px-3 py-2.5 text-right tabular text-ink-faint">—</td>
              <td className="px-3 py-2.5 text-right tabular bg-amber/15">
                <div className="text-amber font-bold text-sm">₩{Math.round(netWorth).toLocaleString()}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
