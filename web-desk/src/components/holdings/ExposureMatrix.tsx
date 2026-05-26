import { useMemo, useState } from 'react'
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
  const [stockOpen, setStockOpen] = useState(true)
  const [nonStockOpen, setNonStockOpen] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)

  const { stockRows, stockTotals } = useMemo(() => {
    const agg: Record<string, { broker: string; opBuy: number; opProfit: number; value: number; count: number }> = {}
    for (const h of holdings) {
      const key = `${h.broker}||${h.accountType}`
      if (!agg[key]) agg[key] = { broker: h.broker, opBuy: 0, opProfit: 0, value: 0, count: 0 }
      agg[key].opBuy   += h.opBuy
      agg[key].opProfit += h.opProfit
      agg[key].value   += h.value
      agg[key].count   += 1
    }
    const stockRows = Object.entries(agg)
      .map(([key, a]) => {
        const [broker, account] = key.split('||')
        const returnPct = a.opBuy > 0 ? (a.opProfit / a.opBuy) * 100 : 0
        return {
          broker, account,
          display: accountDisplay(broker, account),
          opBuy: a.opBuy, opProfit: a.opProfit, value: a.value, count: a.count, returnPct,
        }
      })
      .sort((a, b) => b.value - a.value)
    const stockTotals = {
      opBuy:    stockRows.reduce((s, r) => s + r.opBuy, 0),
      opProfit: stockRows.reduce((s, r) => s + r.opProfit, 0),
      value:    stockRows.reduce((s, r) => s + r.value, 0),
      count:    stockRows.reduce((s, r) => s + r.count, 0),
      accountCount: stockRows.length,
    }
    return { stockRows, stockTotals }
  }, [holdings])

  const stockReturnPct = stockTotals.opBuy > 0 ? (stockTotals.opProfit / stockTotals.opBuy) * 100 : 0
  const cashTotal      = cashReserve?.total ?? 0
  const nonStockTotal  = nonStockAssets?.total ?? 0
  const nonStockCount  = nonStockAssets?.items.length ?? 0
  const cashCount      = cashReserve?.items.length ?? 0
  const netWorth       = stockTotals.value + nonStockTotal + cashTotal

  return (
    <Panel
      title="Account P&L"
      meta={`순자산 ₩${Math.round(netWorth).toLocaleString()}`}
    >
      {/* 1. 상단 4 그룹 카드 — 한눈에 자산 구조 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border-b border-line">
        <GroupCard
          label="주식"
          value={stockTotals.value}
          subtitle={`${stockTotals.accountCount}계좌 · ${stockTotals.count}종목`}
          returnPct={stockReturnPct}
          opProfit={stockTotals.opProfit}
          open={stockOpen}
          onClick={() => setStockOpen((v) => !v)}
        />
        <GroupCard
          label="비주식 자산"
          value={nonStockTotal}
          subtitle={nonStockCount > 0 ? `${nonStockCount}건` : '없음'}
          open={nonStockOpen}
          onClick={() => nonStockCount > 0 && setNonStockOpen((v) => !v)}
          disabled={nonStockCount === 0}
        />
        <GroupCard
          label="대기자금"
          value={cashTotal}
          subtitle={cashCount > 0 ? `${cashCount}계좌` : '없음'}
          open={cashOpen}
          onClick={() => cashCount > 0 && setCashOpen((v) => !v)}
          disabled={cashCount === 0}
          tone="cyan"
        />
        <NetWorthCard value={netWorth} />
      </div>

      {/* 2. 주식 상세 — 토글 (default 펼침) */}
      {stockOpen && stockRows.length > 0 && (
        <div className="overflow-x-auto border-b border-line-dim">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line-dim bg-bg-deep/40">
                <th className="px-3 pt-2 pb-1.5 text-left font-medium">주식 계좌</th>
                <th className="px-3 pt-2 pb-1.5 text-right font-medium">투자 원금</th>
                <th className="px-3 pt-2 pb-1.5 text-right font-medium">수익금</th>
                <th className="px-3 pt-2 pb-1.5 text-right font-medium text-amber">평가</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((r) => (
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
            </tbody>
          </table>
        </div>
      )}

      {/* 3. 비주식 자산 상세 — 토글 (default 접힘) */}
      {nonStockOpen && nonStockAssets && nonStockAssets.items.length > 0 && (
        <div className="overflow-x-auto border-b border-line-dim">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line-dim bg-bg-deep/40">
                <th className="px-3 pt-2 pb-1.5 text-left font-medium">비주식 자산</th>
                <th className="px-3 pt-2 pb-1.5 text-right font-medium">투자 원금</th>
                <th className="px-3 pt-2 pb-1.5 text-right font-medium">수익금</th>
                <th className="px-3 pt-2 pb-1.5 text-right font-medium text-amber">평가</th>
              </tr>
            </thead>
            <tbody>
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
            </tbody>
          </table>
        </div>
      )}

      {/* 4. 대기자금 상세 — 토글 (default 접힘) */}
      {cashOpen && cashReserve && cashReserve.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line-dim bg-bg-deep/40">
                <th className="px-3 pt-2 pb-1.5 text-left font-medium">대기자금</th>
                <th className="px-3 pt-2 pb-1.5 text-right font-medium" colSpan={2}>업데이트</th>
                <th className="px-3 pt-2 pb-1.5 text-right font-medium text-cyan">평가</th>
              </tr>
            </thead>
            <tbody>
              {cashReserve.items.map((c, i) => {
                const display = accountDisplay(c.broker, c.account)
                return (
                  <tr key={`cash-${i}`} className="border-b border-line-dim">
                    <td className="px-3 py-2">
                      <div className="text-cyan">{display}</div>
                      {c.note && <div className="text-2xs text-ink-faint normal-case">{c.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-ink-faint text-2xs" colSpan={2}>
                      {c.updatedAt || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular bg-bg-elev">
                      <div className="text-cyan font-medium">₩{Math.round(c.amount).toLocaleString()}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

interface GroupCardProps {
  label: string
  value: number
  subtitle: string
  returnPct?: number
  opProfit?: number
  open: boolean
  onClick: () => void
  disabled?: boolean
  tone?: 'amber' | 'cyan'
}

function GroupCard({ label, value, subtitle, returnPct, opProfit, open, onClick, disabled, tone = 'amber' }: GroupCardProps) {
  const profitTone = opProfit !== undefined ? (opProfit >= 0 ? 'text-gain' : 'text-loss') : ''
  const valueTone  = tone === 'cyan' ? 'text-cyan' : 'text-ink'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bg-bg-elev px-3.5 py-3 text-left ${disabled ? 'opacity-50 cursor-default' : 'hover:bg-bg-hover'} focus:outline-none focus:ring-1 focus:ring-amber`}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xs text-ink-faint uppercase tracking-widest">{label}</span>
        {!disabled && (
          <span className="text-xxs text-ink-faint">{open ? '▾' : '▸'}</span>
        )}
      </div>
      <div className={`text-base tabular font-medium ${valueTone}`}>
        ₩{Math.round(value).toLocaleString()}
      </div>
      <div className="text-xxs text-ink-dim mt-0.5">{subtitle}</div>
      {opProfit !== undefined && returnPct !== undefined && (
        <div className={`text-xxs tabular mt-1 ${profitTone}`}>
          {opProfit >= 0 ? '+' : ''}₩{Math.round(opProfit).toLocaleString()} · {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
        </div>
      )}
    </button>
  )
}

function NetWorthCard({ value }: { value: number }) {
  return (
    <div className="bg-amber/10 border-l border-amber/40 px-3.5 py-3 flex flex-col justify-center">
      <div className="text-2xs uppercase tracking-widest text-amber mb-1 font-semibold">순자산</div>
      <div className="text-lg tabular font-bold text-amber leading-tight">
        ₩{Math.round(value).toLocaleString()}
      </div>
      <div className="text-xxs text-ink-faint mt-0.5">주식 + 비주식 + 대기자금</div>
    </div>
  )
}
