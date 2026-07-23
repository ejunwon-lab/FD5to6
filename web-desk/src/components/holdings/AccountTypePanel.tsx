import { Fragment, useMemo } from 'react'
import type { Holding } from '../../lib/types'
import type { CashReserve, NonStockAssets } from '../../api/gasApi'
import { Panel } from '../ui/Panel'
import { computeAccountTypeBreakdown } from '../../lib/accountType'

interface Props {
  holdings: Holding[]
  cashReserve?: CashReserve | null
  nonStockAssets?: NonStockAssets | null
}

// 계좌 유형별 — 일반 투자 vs 퇴직연금 (총자산 기준), 각 증권사별 세분.
export function AccountTypePanel({ holdings, cashReserve, nonStockAssets }: Props) {
  const { groups, total } = useMemo(
    () => computeAccountTypeBreakdown(holdings, cashReserve, nonStockAssets),
    [holdings, cashReserve, nonStockAssets],
  )

  return (
    <Panel title="계좌 유형별" meta={`총자산 ₩${Math.round(total).toLocaleString('ko-KR')}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[420px]">
          <thead>
            <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line-dim bg-bg-deep/40">
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">구분</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium text-amber">금액</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">비중</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.label}>
                <tr className="border-b border-line-dim bg-bg-deep/20">
                  <td className="px-3 py-2 text-ink font-medium">{g.label}</td>
                  <td className="px-3 py-2 text-right tabular text-amber font-medium">
                    ₩{Math.round(g.amount).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink-dim">{g.pct.toFixed(1)}%</td>
                </tr>
                {g.brokers.map((b) => (
                  <tr key={`${g.label}-${b.broker}`} className="border-b border-line-dim">
                    <td className="px-3 py-1.5 pl-7 text-ink-dim">{b.broker}</td>
                    <td className="px-3 py-1.5 text-right tabular text-ink">
                      ₩{Math.round(b.amount).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular text-ink-faint text-2xs">
                      {b.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="border-t border-line bg-bg-elev font-medium">
              <td className="px-3 py-2 text-ink">합계</td>
              <td className="px-3 py-2 text-right tabular text-amber">
                ₩{Math.round(total).toLocaleString('ko-KR')}
              </td>
              <td className="px-3 py-2 text-right tabular text-ink-dim">100.0%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
