import { useMemo } from 'react'
import type { Holding } from '../../lib/types'
import { Panel } from '../ui/Panel'

interface Props { holdings: Holding[] }

const ACCOUNT_DISPLAY: Record<string, string> = {
  '퇴직연금_개인IRP': '퇴직연금_미래',
  '퇴직연금_개인형IRP(범용)': '퇴직연금_삼성',
}
const ACCOUNT_ORDER = ['종합_랩', '종합', 'ISA', '퇴직연금_미래', '퇴직연금_개인IRP', '퇴직연금_개인형IRP(범용)']

export function ExposureMatrix({ holdings }: Props) {
  const { rows, totals } = useMemo(() => {
    // 계좌별 원금/수익/평가 집계
    const agg: Record<string, { opBuy: number; opProfit: number; value: number; count: number }> = {}
    for (const h of holdings) {
      const acc = h.accountType
      if (!agg[acc]) agg[acc] = { opBuy: 0, opProfit: 0, value: 0, count: 0 }
      agg[acc].opBuy += h.opBuy
      agg[acc].opProfit += h.opProfit
      agg[acc].value += h.value
      agg[acc].count += 1
    }
    // 계좌 정렬: ACCOUNT_ORDER → 나머지
    const present = Object.keys(agg)
    const ordered = ACCOUNT_ORDER.filter((a) => present.includes(a))
    const rest = present.filter((a) => !ACCOUNT_ORDER.includes(a)).sort()
    const accounts = [...ordered, ...rest]

    const rows = accounts.map((acc) => {
      const a = agg[acc]
      const returnPct = a.opBuy > 0 ? (a.opProfit / a.opBuy) * 100 : 0
      return {
        account: acc,
        display: ACCOUNT_DISPLAY[acc] ?? acc,
        opBuy: a.opBuy,
        opProfit: a.opProfit,
        value: a.value,
        count: a.count,
        returnPct,
      }
    })

    const totals = {
      opBuy: rows.reduce((s, r) => s + r.opBuy, 0),
      opProfit: rows.reduce((s, r) => s + r.opProfit, 0),
      value: rows.reduce((s, r) => s + r.value, 0),
      count: rows.reduce((s, r) => s + r.count, 0),
    }
    return { rows, totals }
  }, [holdings])

  const totalReturnPct = totals.opBuy > 0 ? (totals.opProfit / totals.opBuy) * 100 : 0

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
              <tr key={r.account} className="border-b border-line-dim">
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
            {/* 전체 Total */}
            <tr className="border-t border-line bg-bg/30">
              <td className="px-3 py-2 text-2xs uppercase tracking-widest text-ink-faint font-medium">
                Total
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
              <td className="px-3 py-2 text-right tabular bg-amber/10">
                <div className="text-amber font-semibold">₩{Math.round(totals.value).toLocaleString()}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
