import { useEffect, useRef } from 'react'
import { gasApi } from '../../api/gasApi'
import { useAuth } from '../../auth/AuthContext'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ProfitHistoryChart } from './ProfitHistoryChart'
import { krwCompact, krwCompactSigned, krwFull, pctFormatted, normalizeChangePct } from '../../utils/format'
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

function isBeforeMarket(): boolean {
  // 한국시간 09:00 이전 (장 개시 전)
  // 브라우저 시간대가 한국이 아닐 수도 있어 Asia/Seoul 기준으로 계산
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false })
  const hour = parseInt(fmt.format(new Date()), 10)
  return hour < 9
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
  // 분기:
  //   비거래일 (주말/공휴일)         → "최근 수익" + dayChangAmount (마지막 거래일 캐시 포함)
  //   거래일 09:00 이전              → "전일 수익" + prevDayChangAmount (어제 거래일 백업)
  //   거래일 09:00 이후              → "오늘의 수익" + dayChangAmount (실시간/장후)
  const isTrading  = summary?.isTradingDay !== false
  const beforeMkt  = isBeforeMarket()
  const usePrev    = isTrading && beforeMkt
  const dayLabel   = !isTrading ? '최근 수익' : (beforeMkt ? '전일 수익' : '오늘의 수익')
  const dayAmt     = usePrev ? (summary?.prevDayChangAmount ?? 0) : (summary?.dayChangAmount ?? 0)
  const dayPct     = usePrev ? (summary?.prevDayChangePct ?? '0%') : (summary?.dayChangePct ?? '0%')
  const dayIsProfit = dayAmt >= 0

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
                {portfolio?.updatedAt && (
                  <p className="text-white/50 text-[10px] mt-2">{portfolio.updatedAt}</p>
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
