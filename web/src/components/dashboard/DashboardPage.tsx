import { useEffect, useRef } from 'react'
import { gasApi } from '../../api/gasApi'
import { useAuth } from '../../auth/AuthContext'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ProfitHistoryChart } from './ProfitHistoryChart'
import { decideChangeLabel, formatPriceAsOfDate, formatUpdatedAtLine } from '../../utils/changeLabel'
import { krwCompact, krwCompactSigned, krwFull, pctFormatted, normalizeChangePct } from '../../utils/format'
import { computeAssetAllocation, computeAccountTypeBreakdown } from '../../utils/assetAllocation'
import { computePeriodProfits } from '../../utils/periodProfit'
import type { PortfolioResponse, TrendEntry } from '../../models/types'

type DashboardPageProps = {
  scrollToTopSignal?: number
  portfolio: PortfolioResponse | null
  isLoading: boolean
  isUpdating: boolean
  updateMsg: string
  error: string
  runUpdate: (fn: (token: string) => Promise<PortfolioResponse>, msg: string) => Promise<void>
  historyEntries: TrendEntry[]
  isLoadingHistory: boolean
  historyError: string
}

function UpdateButton({ icon, label, onClick, disabled }: {
  icon: string; label: string; onClick: () => void; disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-base disabled:opacity-40 active:scale-90 transition-all"
      title={label}
    >
      {icon}
    </button>
  )
}

export function DashboardPage({
  scrollToTopSignal = 0,
  portfolio,
  isLoading,
  isUpdating,
  updateMsg,
  error,
  runUpdate,
  historyEntries,
  isLoadingHistory,
  historyError,
}: DashboardPageProps) {
  const { signOut } = useAuth()
  const scrollRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollToTopSignal > 0) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [scrollToTopSignal])

  const summary = portfolio?.summary
  // 라벨 결정: priceAsOfDate(*현재가_이력* 마지막 행 날짜) 기준
  //   priceAsOfDate === today → "오늘 수익"
  //   today가 비거래일        → "최근 수익"
  //   priceAsOfDate === today-1 → "전일 수익"
  //   그 외                    → "최근 수익"
  const changeLabel = decideChangeLabel(summary?.priceAsOfDate, summary?.isTradingDay)
  const dayLabel    = `${changeLabel} 수익`
  const dayAmt      = summary?.dayChangAmount ?? 0
  const dayPct      = summary?.dayChangePct ?? '0%'
  const dayIsProfit = dayAmt >= 0
  // 수익 기준일(priceAsOfDate). 없으면 호출 시각으로 폴백
  const asOfText    = formatPriceAsOfDate(summary?.priceAsOfDate) || portfolio?.updatedAt || ''
  // 자산 배분(투자중/대기중/총자산) + 계좌 유형별(일반/퇴직, 증권사별)
  const alloc          = computeAssetAllocation(portfolio)
  const acctBreakdown  = computeAccountTypeBreakdown(portfolio)
  // 기간별 번 돈 (1주/1개월/올해) — 합계수익 추이 diff, 실현+평가 포함
  const periodProfits  = computePeriodProfits(historyEntries)

  return (
    <div ref={scrollRef} className="h-[100dvh] overflow-y-auto no-scrollbar bg-[rgb(var(--page-bg))]">
      <div className="pb-32">
        {/* Header */}
        <div
          className="px-4 pt-12 pb-3"
          style={{ background: 'linear-gradient(135deg, #405AE6 0%, #7340D9 100%)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <button onClick={signOut} className="text-white/60 text-xs">로그아웃</button>
            <div className="flex gap-2">
              <UpdateButton icon="⚡" label="빠른 업데이트" disabled={isUpdating}
                onClick={() => runUpdate(gasApi.updateFast, '현황 업데이트 중...')} />
              <UpdateButton icon="⊞" label="전체 업데이트" disabled={isUpdating}
                onClick={() => runUpdate(gasApi.updateFull, '전체 업데이트 중...')} />
              <UpdateButton icon="✦" label="통합 업데이트" disabled={isUpdating}
                onClick={() => runUpdate(gasApi.updateAll, '통합 업데이트 중...')} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">JUN &amp; SOO 투자 현황</h1>
        </div>

        {isLoading ? (
          <LoadingSpinner message="데이터 불러오는 중..." />
        ) : (
          <div className="px-4 pt-4 space-y-3">
            {/* 합계 수익 카드 */}
            <Card className="overflow-hidden">
              <div
                className="px-6 py-7 text-center"
                style={{ background: 'linear-gradient(135deg, #405AE6 0%, #7340D9 100%)' }}
              >
                <p className="text-white/75 text-sm mb-1">합계 수익</p>
                <p className="text-white text-4xl font-bold tracking-tight">
                  {krwCompact(summary?.trendTotalProfit ?? 0)}
                </p>
                <p className="text-white/80 text-base font-semibold mt-1">
                  {pctFormatted(summary?.totalProfitRate ?? 0)}
                </p>
              </div>

              {/* 오늘/전일 수익 */}
              <div
                className="px-6 py-6 text-center"
                style={{
                  background: dayIsProfit
                    ? 'linear-gradient(135deg, #D91919 0%, #B01010 100%)'
                    : 'linear-gradient(135deg, #0D5AD9 0%, #0A44A8 100%)',
                }}
              >
                <p className="text-white/75 text-sm mb-1">{dayLabel}</p>
                <p className="text-white text-4xl font-bold tracking-tight">
                  {krwCompactSigned(dayAmt)}
                </p>
                <p className="text-white/80 text-base font-semibold mt-1">
                  {normalizeChangePct(dayPct)}
                </p>
                {asOfText && (
                  <p className="text-white/50 text-[10px] mt-2">{asOfText}</p>
                )}
                {portfolio?.updatedAt && (
                  <p className="text-white/70 text-sm mt-2">마지막 갱신  {formatUpdatedAtLine(portfolio.updatedAt)}</p>
                )}
              </div>

              {/* 확정/운용 수익 */}
              <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-700">
                {[
                  { label: '확정 수익', val: summary?.confirmedProfit ?? 0, rate: summary?.confirmedProfitRate ?? 0 },
                  { label: '운용 수익', val: summary?.trendOperatingProfit ?? 0, rate: summary?.operatingProfitRate ?? 0 },
                ].map(item => (
                  <div key={item.label} className="py-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                    <p className={`text-base font-bold ${item.val >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {krwCompact(item.val)}
                    </p>
                    <p className={`text-xs ${item.rate >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {pctFormatted(item.rate)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* 기간별 수익 (실현+평가 포함, 합계수익 추이 diff) */}
            <Card className="p-4">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">기간별 수익</p>
              <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700">
                {periodProfits.map(tile => (
                  <div key={tile.key} className="text-center px-1">
                    <p className="text-xs text-gray-400 mb-1">{tile.label}</p>
                    <p className={`text-sm font-bold tabular-nums ${
                      tile.amount == null ? 'text-gray-400' : tile.amount >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {tile.amount == null ? '—' : krwCompactSigned(tile.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* 자산 배분 */}
            <Card className="p-4">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">자산 배분</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-500">투자중 <span className="text-xs text-emerald-500">일하는 돈</span></span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold tabular-nums">{krwFull(alloc.invested)}</span>
                    <span className="text-xs text-gray-400 w-14 text-right">
                      {(alloc.total > 0 ? (alloc.invested / alloc.total) * 100 : 0).toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-500">대기중 <span className="text-xs text-amber-500">노는 돈</span></span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{krwFull(alloc.idle)}</span>
                    <span className="text-xs text-amber-500 w-14 text-right">{alloc.idlePct.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="flex justify-between items-baseline border-t border-gray-100 dark:border-gray-700 pt-2 font-bold">
                  <span>총 자산</span>
                  <span className="tabular-nums">{krwFull(alloc.total)}</span>
                </div>
              </div>
            </Card>

            {/* 계좌 유형별 */}
            <Card className="p-4">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">계좌 유형별</p>
              <div className="space-y-2 text-sm">
                {acctBreakdown.groups.map(g => (
                  <div key={g.label} className="space-y-1">
                    <div className="flex justify-between items-baseline font-semibold">
                      <span>{g.label}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="tabular-nums">{krwFull(g.amount)}</span>
                        <span className="text-xs text-gray-400 w-14 text-right">{g.pct.toFixed(1)}%</span>
                      </span>
                    </div>
                    {g.brokers.map(b => (
                      <div key={b.broker} className="flex justify-between items-baseline text-xs text-gray-500 pl-3">
                        <span>{b.broker}</span>
                        <span className="flex items-baseline gap-2">
                          <span className="tabular-nums">{krwFull(b.amount)}</span>
                          <span className="text-gray-400 w-14 text-right">{b.pct.toFixed(1)}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex justify-between items-baseline border-t border-gray-100 dark:border-gray-700 pt-2 font-bold">
                  <span>합계</span>
                  <span className="tabular-nums">{krwFull(acctBreakdown.total)}</span>
                </div>
              </div>
            </Card>

            {/* 환율 카드 */}
            <Card>
              <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-700">
                {[
                  { label: 'USD/KRW', val: portfolio?.usdRate ?? 0 },
                  { label: 'GBP/KRW', val: portfolio?.gbpRate ?? 0 },
                ].map(item => (
                  <div key={item.label} className="py-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                    <p className="text-base font-bold">
                      {item.val > 0 ? krwFull(item.val) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* 오류 배너 */}
            {error && (
              <Card className="p-3 bg-red-50 dark:bg-red-900/20">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </Card>
            )}
          </div>
        )}

        {/* 기간별 수익 힌트 */}
        {!isLoading && (
          <div
            className="flex flex-col items-center mt-8 mb-2 gap-1 text-gray-300 cursor-pointer active:opacity-60"
            onClick={() => chartRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="text-xs">기간별 수익</span>
            <span className="text-sm">↓</span>
          </div>
        )}

        {/* 기간별 수익 차트 */}
        <div ref={chartRef}>
          <ProfitHistoryChart entries={historyEntries} loading={isLoadingHistory} error={historyError} />
        </div>
      </div>

      {/* 업데이트 오버레이 */}
      {isUpdating && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <Card className="px-8 py-6 text-center">
            <div className="w-8 h-8 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">{updateMsg}</p>
          </Card>
        </div>
      )}
    </div>
  )
}
