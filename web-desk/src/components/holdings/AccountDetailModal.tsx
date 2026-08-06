import { useEffect, useMemo } from 'react'
import type { Holding } from '../../lib/types'
import type { CashReserve } from '../../api/gasApi'
import { useRealized } from '../../lib/useRealized'
import { accountDisplay } from '../../lib/accountDisplay'

interface Props {
  broker: string
  account: string   // 계좌명 raw (시트 원본 값, 예: 종합_랩)
  holdings: Holding[]
  cashReserve?: CashReserve | null
  onClose: () => void
}

// 계좌 드릴다운 — Account P&L 행 탭 시. 이미 로드된 holdings·realized·cashReserve만 사용 (추가 GAS 호출 없음).
export function AccountDetailModal({ broker, account, holdings, cashReserve, onClose }: Props) {
  const { entries: realized } = useRealized()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { rows, kpi, accRealized, cash } = useMemo(() => {
    const rows = holdings
      .filter((h) => h.broker === broker && h.accountType === account)
      .sort((a, b) => b.value - a.value)
    const opBuy = rows.reduce((s, h) => s + h.opBuy, 0)
    const value = rows.reduce((s, h) => s + h.value, 0)
    const opProfit = rows.reduce((s, h) => s + h.opProfit, 0)
    const dayChange = rows.reduce((s, h) => s + (h.dayChange ?? 0), 0)
    const accRealized = realized.filter((e) => e.broker === broker && e.account === account)
    const realizedTotal = accRealized.reduce((s, e) => s + e.profit, 0)
    const cash = (cashReserve?.items ?? []).filter((c) => c.broker === broker && c.account === account)
      .reduce((s, c) => s + c.amount, 0)
    return {
      rows,
      kpi: {
        opBuy, value, opProfit, dayChange, realizedTotal, cash,
        returnPct: opBuy > 0 ? (opProfit / opBuy) * 100 : 0,
        dayPct: value - dayChange > 0 ? (dayChange / (value - dayChange)) * 100 : 0,
      },
      accRealized,
      cash,
    }
  }, [holdings, realized, cashReserve, broker, account])

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl bg-bg-elev border border-line max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-bg-elev border-b border-line px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-ink font-semibold text-sm">{accountDisplay(broker, account)}</div>
            <div className="text-2xs text-ink-faint mt-0.5">{broker} · {account} · {rows.length}종목</div>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink text-lg leading-none px-2" aria-label="닫기">✕</button>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-line border-b border-line">
          <Kpi label="평가금액" value={`₩${Math.round(kpi.value).toLocaleString('ko-KR')}`} />
          <Kpi label="투자 원금" value={`₩${Math.round(kpi.opBuy).toLocaleString('ko-KR')}`} />
          <Kpi
            label="수익"
            value={`${kpi.opProfit >= 0 ? '+' : ''}₩${Math.round(kpi.opProfit).toLocaleString('ko-KR')}`}
            sub={`${kpi.returnPct >= 0 ? '+' : ''}${kpi.returnPct.toFixed(2)}%`}
            tone={kpi.opProfit >= 0 ? 'gain' : 'loss'}
          />
          <Kpi
            label="오늘 등락"
            value={`${kpi.dayChange >= 0 ? '+' : ''}₩${Math.round(kpi.dayChange).toLocaleString('ko-KR')}`}
            sub={`${kpi.dayPct >= 0 ? '+' : ''}${kpi.dayPct.toFixed(2)}%`}
            tone={kpi.dayChange >= 0 ? 'gain' : 'loss'}
          />
          <Kpi
            label="실현손익 누적"
            value={`${kpi.realizedTotal >= 0 ? '+' : ''}₩${Math.round(kpi.realizedTotal).toLocaleString('ko-KR')}`}
            sub={`${accRealized.length}건`}
            tone={kpi.realizedTotal >= 0 ? 'gain' : 'loss'}
          />
          <Kpi label="대기자금" value={cash > 0 ? `₩${Math.round(cash).toLocaleString('ko-KR')}` : '—'} tone="cyan" />
        </div>

        {/* 보유 종목 */}
        <div className="px-4 pt-3 pb-1 text-2xs text-ink-faint uppercase tracking-widest">보유 종목</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line-dim">
                <th className="px-4 py-1.5 text-left font-medium">종목</th>
                <th className="px-3 py-1.5 text-right font-medium">평가</th>
                <th className="px-3 py-1.5 text-right font-medium">수익</th>
                <th className="px-4 py-1.5 text-right font-medium">오늘</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.symbol} className="border-b border-line-dim">
                  <td className="px-4 py-2">
                    <span className="text-amber font-medium">{h.name}</span>
                    <span className="text-2xs text-ink-faint tabular ml-2">{h.symbol} · {h.shares.toLocaleString('ko-KR')}주</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink">₩{Math.round(h.value).toLocaleString('ko-KR')}</td>
                  <td className={`px-3 py-2 text-right tabular ${h.opProfit >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {h.opProfit >= 0 ? '+' : ''}₩{Math.round(h.opProfit).toLocaleString('ko-KR')}
                    <span className="text-2xs opacity-80 ml-1">{h.returnPct >= 0 ? '+' : ''}{h.returnPct.toFixed(1)}%</span>
                  </td>
                  <td className={`px-4 py-2 text-right tabular ${(h.dayChange ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {(h.dayChange ?? 0) >= 0 ? '+' : ''}₩{Math.round(h.dayChange ?? 0).toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="text-center text-ink-faint py-6">보유 종목 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 실현손익 최근 */}
        <div className="px-4 pt-4 pb-1 text-2xs text-ink-faint uppercase tracking-widest">
          실현손익 최근 {Math.min(accRealized.length, 8)}건
        </div>
        <div className="px-4 pb-4">
          {accRealized.slice(0, 8).map((e, i) => (
            <div key={`${e.date}-${e.code}-${i}`} className="flex items-baseline justify-between gap-2 py-1.5 border-b border-line-dim last:border-0 text-xs">
              <span className="text-ink-faint text-2xs tabular w-14 shrink-0">{String(e.date).slice(5)}</span>
              <span className="text-amber truncate flex-1">{e.name}</span>
              <span className={`tabular shrink-0 ${e.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                {e.profit >= 0 ? '+' : ''}₩{Math.round(e.profit).toLocaleString('ko-KR')}
              </span>
            </div>
          ))}
          {accRealized.length === 0 && (
            <div className="text-center text-ink-faint py-4 text-xs">이 계좌의 매도 기록 없음</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'gain' | 'loss' | 'cyan' }) {
  const toneClass = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : tone === 'cyan' ? 'text-cyan' : 'text-ink'
  return (
    <div className="bg-bg-elev px-3.5 py-2.5">
      <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-0.5">{label}</div>
      <div className={`text-sm font-medium tabular ${toneClass}`}>{value}</div>
      {sub && <div className="text-2xs text-ink-dim tabular mt-0.5">{sub}</div>}
    </div>
  )
}
