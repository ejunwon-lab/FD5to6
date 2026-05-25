import { useMemo } from 'react'
import type { Holding, Market } from '../../lib/types'
import { Panel } from '../ui/Panel'

interface Props { holdings: Holding[] }

const ACCOUNT_DISPLAY: Record<string, string> = {
  '퇴직연금_개인IRP': '퇴직연금_미래',
  '퇴직연금_개인형IRP(범용)': '퇴직연금_삼성',
}
const ACCOUNT_ORDER = ['종합_랩', '종합', 'ISA', '퇴직연금_미래', '퇴직연금_개인IRP', '퇴직연금_개인형IRP(범용)']
const MARKETS: Market[] = ['KR', 'US']

export function ExposureMatrix({ holdings }: Props) {
  const { rows, marketTotals, grandTotal } = useMemo(() => {
    // 계좌별·시장별 value 집계
    const cell: Record<string, Record<Market, number>> = {}
    const cnt: Record<string, Record<Market, number>> = {}
    const accountTotals: Record<string, number> = {}
    const marketTotals: Record<Market, number> = { KR: 0, US: 0 }
    let grandTotal = 0

    for (const h of holdings) {
      const acc = h.accountType
      if (!cell[acc]) {
        cell[acc] = { KR: 0, US: 0 }
        cnt[acc] = { KR: 0, US: 0 }
        accountTotals[acc] = 0
      }
      cell[acc][h.market] += h.value
      cnt[acc][h.market] += 1
      accountTotals[acc] += h.value
      marketTotals[h.market] += h.value
      grandTotal += h.value
    }

    // 계좌 정렬: ACCOUNT_ORDER → 나머지 알파벳
    const present = Object.keys(cell)
    const ordered = ACCOUNT_ORDER.filter((a) => present.includes(a))
    const rest = present.filter((a) => !ACCOUNT_ORDER.includes(a)).sort()
    const accounts = [...ordered, ...rest]

    const rows = accounts.map((acc) => ({
      account: acc,
      display: ACCOUNT_DISPLAY[acc] ?? acc,
      cells: MARKETS.map((m) => ({
        market: m,
        value: cell[acc][m],
        count: cnt[acc][m],
        pctOfGrand: grandTotal ? (cell[acc][m] / grandTotal) * 100 : 0,
      })),
      total: accountTotals[acc],
      pctOfGrand: grandTotal ? (accountTotals[acc] / grandTotal) * 100 : 0,
    }))

    return { rows, marketTotals, grandTotal }
  }, [holdings])

  // 셀 색상 강도: grand 대비 비중 (0~100%)
  function cellShade(pct: number): string {
    if (pct <= 0) return 'bg-bg-elev'
    if (pct < 1) return 'bg-amber/5'
    if (pct < 3) return 'bg-amber/10'
    if (pct < 7) return 'bg-amber/20'
    if (pct < 15) return 'bg-amber/30'
    return 'bg-amber/45'
  }

  return (
    <Panel title="Exposure Matrix" meta={`${rows.length} accounts × ${MARKETS.length} markets · ₩${grandTotal.toLocaleString()}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line">
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">Account</th>
              {MARKETS.map((m) => (
                <th key={m} className="px-3 pt-2 pb-1.5 text-right font-medium">
                  <span className="text-cyan tracking-widest">{m}</span>
                </th>
              ))}
              <th className="px-3 pt-2 pb-1.5 text-right font-medium text-amber">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account} className="border-b border-line-dim">
                <td className="px-3 py-2">
                  <div className="text-ink">{r.display}</div>
                  <div className="text-2xs text-ink-faint tabular">{r.pctOfGrand.toFixed(1)}% of total</div>
                </td>
                {r.cells.map((c) => (
                  <td key={c.market} className={`px-3 py-2 text-right tabular ${cellShade(c.pctOfGrand)}`}>
                    {c.value > 0 ? (
                      <>
                        <div className="text-ink">₩{fullKRW(c.value)}</div>
                        <div className="text-2xs text-ink-faint">{c.count}p · {c.pctOfGrand.toFixed(1)}%</div>
                      </>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular bg-bg-elev">
                  <div className="text-amber font-medium">₩{fullKRW(r.total)}</div>
                  <div className="text-2xs text-ink-faint">{r.pctOfGrand.toFixed(1)}%</div>
                </td>
              </tr>
            ))}
            {/* Column totals */}
            <tr className="border-t border-line bg-bg/30">
              <td className="px-3 py-2 text-2xs uppercase tracking-widest text-ink-faint font-medium">Market Total</td>
              {MARKETS.map((m) => (
                <td key={m} className="px-3 py-2 text-right tabular">
                  <div className="text-cyan font-medium">₩{fullKRW(marketTotals[m])}</div>
                  <div className="text-2xs text-ink-faint">
                    {grandTotal ? ((marketTotals[m] / grandTotal) * 100).toFixed(1) : '0.0'}%
                  </div>
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular bg-amber/10">
                <div className="text-amber font-semibold">₩{fullKRW(grandTotal)}</div>
                <div className="text-2xs text-ink-faint">100%</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function fullKRW(n: number): string {
  return Math.round(n).toLocaleString()
}
