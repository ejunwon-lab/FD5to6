import { useAuth } from '../../auth/AuthContext'
import { usePortfolio } from '../../lib/usePortfolio'
import { summary as sampleSummary, holdings as sampleHoldings, indicators as sampleIndicators, equityCurve as sampleEquity } from '../../lib/sampleData'
import { KpiStrip } from './KpiStrip'
import { EquityChart } from './EquityChart'
import { DashboardHoldings } from './DashboardHoldings'
import { MarketIndices } from './MarketIndices'
import { ActivityFeed } from './ActivityFeed'

export function DashboardPage() {
  const { isSignedIn, signIn, isLoading: authLoading } = useAuth()
  const { loading, error, summary, holdings, indicators, equityCurve, updatedAt, refresh } = usePortfolio()

  const liveReady = isSignedIn && summary && !loading
  const showSummary = liveReady ? summary! : sampleSummary
  const showHoldings = liveReady && holdings.length ? holdings : sampleHoldings
  const showIndicators = liveReady && indicators.length ? indicators : sampleIndicators
  const showEquity = liveReady && equityCurve.length ? equityCurve : sampleEquity

  return (
    <div className="overflow-y-auto">
      <DataStatusBar
        isSignedIn={isSignedIn}
        authLoading={authLoading}
        loading={loading}
        error={error}
        updatedAt={updatedAt}
        onSignIn={signIn}
        onRefresh={refresh}
      />
      <main className="p-3 grid gap-2.5"
        style={{ gridTemplateColumns: '1fr 2fr', gridAutoRows: 'min-content' }}>
        {/* Row 1: KPI Strip (full width) */}
        <div className="col-span-2">
          <KpiStrip summary={showSummary} />
        </div>
        {/* Row 2: Market Indices (KOSPI/KOSDAQ) | Equity Chart */}
        <MarketIndices indicators={showIndicators} />
        <EquityChart equityCurve={showEquity} meta={liveReady ? `LIVE · ${equityCurve.length} pts` : 'SAMPLE DATA'} />
        {/* Row 3: Holdings (full, with account chips + sort) */}
        <div className="col-span-2">
          <DashboardHoldings holdings={showHoldings} />
        </div>
        {/* Row 4: Activity Feed (full) */}
        <div className="col-span-2">
          <ActivityFeed />
        </div>
      </main>
    </div>
  )
}

interface StatusProps {
  isSignedIn: boolean
  authLoading: boolean
  loading: boolean
  error: string | null
  updatedAt: string | null
  onSignIn: () => void
  onRefresh: () => void
}

function DataStatusBar({ isSignedIn, authLoading, loading, error, updatedAt, onSignIn, onRefresh }: StatusProps) {
  if (authLoading) {
    return <Bar tone="info">인증 확인 중…</Bar>
  }
  if (!isSignedIn) {
    return (
      <Bar tone="warn">
        <span>샘플 데이터 표시 중 · 라이브 데이터를 보려면 Google 로그인 필요</span>
        <button
          onClick={onSignIn}
          className="ml-3 bg-amber text-bg px-3 py-0.5 text-xs font-semibold uppercase tracking-widest hover:opacity-80"
        >
          Sign in
        </button>
      </Bar>
    )
  }
  if (loading) {
    return <Bar tone="info">GAS에서 포트폴리오 가져오는 중…</Bar>
  }
  if (error) {
    return (
      <Bar tone="error">
        <span>오류: {error}</span>
        <button onClick={onRefresh} className="ml-3 underline">retry</button>
      </Bar>
    )
  }
  return (
    <Bar tone="ok">
      <span>● LIVE · 마지막 업데이트 {updatedAt ?? '—'}</span>
      <button
        onClick={onRefresh}
        className="ml-3 border border-line px-2 py-0.5 text-xxs uppercase tracking-widest hover:border-amber hover:text-amber"
      >
        Refresh
      </button>
    </Bar>
  )
}

function Bar({ tone, children }: { tone: 'info' | 'warn' | 'error' | 'ok'; children: React.ReactNode }) {
  const colorMap = {
    info:  'bg-bg-elev text-ink-dim border-line',
    warn:  'bg-bg-elev text-warn border-warn/30',
    error: 'bg-bg-elev text-loss border-loss/30',
    ok:    'bg-bg-elev text-gain border-gain/30',
  }
  return (
    <div className={`flex items-center px-4 py-2 text-xs border-b ${colorMap[tone]}`}>
      {children}
    </div>
  )
}
