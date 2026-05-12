import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { TabBar } from './components/ui/TabBar'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { HoldingsPage } from './components/holdings/HoldingsPage'
import { AnalysisPage } from './components/analysis/AnalysisPage'
import { IndicatorsPage } from './components/indicators/IndicatorsPage'
import { gasApi } from './api/gasApi'
import type { PortfolioResponse } from './models/types'
import type { Tab } from './components/ui/TabBar'

function SignInScreen() {
  const { signIn, isLoading } = useAuth()

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-[rgb(var(--page-bg))] px-8">
      <div className="text-center mb-10">
        <div
          className="w-20 h-20 rounded-[24px] mx-auto mb-5 flex items-center justify-center text-4xl shadow-xl"
          style={{ background: 'linear-gradient(135deg, #405AE6 0%, #7340D9 100%)' }}
        >
          📈
        </div>
        <h1 className="text-2xl font-bold mb-1">JUN &amp; SOO Finance</h1>
        <p className="text-sm text-gray-400">포트폴리오 현황</p>
      </div>

      {isLoading ? (
        <div className="w-7 h-7 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
      ) : (
        <button
          onClick={signIn}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-md active:scale-95 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-sm font-medium">Google로 로그인</span>
        </button>
      )}
    </div>
  )
}

function MainApp() {
  const { isSignedIn, isLoading: authLoading, getToken } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [dashboardTap, setDashboardTap] = useState(0)
  const [visited, setVisited] = useState<Set<Tab>>(new Set(['dashboard']))

  // 공유 portfolio state — 모든 탭이 같은 데이터 참조
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')
  const [portfolioError, setPortfolioError] = useState('')

  const fetchPortfolio = useCallback(async () => {
    try {
      setIsLoadingPortfolio(true)
      const token = await getToken()
      const res = await gasApi.getPortfolio(token)
      if (res.success) { setPortfolio(res); setPortfolioError('') }
      else setPortfolioError(res.error ?? '데이터 조회 실패')
    } catch (e: unknown) {
      setPortfolioError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsLoadingPortfolio(false)
    }
  }, [getToken])

  const runUpdate = useCallback(async (
    fn: (token: string) => Promise<PortfolioResponse>,
    msg: string
  ) => {
    if (isUpdating) return
    setIsUpdating(true)
    setUpdateMsg(msg)
    try {
      const token = await getToken()
      const res = await fn(token)
      if (res.success) { setPortfolio(res); setPortfolioError('') }
      else setPortfolioError(res.error ?? '업데이트 실패')
    } catch (e: unknown) {
      setPortfolioError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsUpdating(false)
      setUpdateMsg('')
    }
  }, [getToken, isUpdating])

  useEffect(() => {
    if (isSignedIn) fetchPortfolio()
  }, [isSignedIn, fetchPortfolio])

  const handleTabChange = (tab: Tab) => {
    if (tab === 'dashboard' && activeTab === 'dashboard') {
      setDashboardTap(n => n + 1)
    }
    setActiveTab(tab)
    setVisited(prev => prev.has(tab) ? prev : new Set([...prev, tab]))
  }

  if (authLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[rgb(var(--page-bg))]">
        <div className="w-8 h-8 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isSignedIn) return <SignInScreen />

  return (
    <div className="relative max-w-[430px] mx-auto">
      {visited.has('indicators') && <div className={activeTab === 'indicators' ? '' : 'hidden'}><IndicatorsPage /></div>}
      {visited.has('dashboard')  && <div className={activeTab === 'dashboard'  ? '' : 'hidden'}>
        <DashboardPage
          scrollToTopSignal={dashboardTap}
          portfolio={portfolio}
          isLoading={isLoadingPortfolio}
          isUpdating={isUpdating}
          updateMsg={updateMsg}
          error={portfolioError}
          runUpdate={runUpdate}
        />
      </div>}
      {visited.has('holdings')   && <div className={activeTab === 'holdings'   ? '' : 'hidden'}>
        <HoldingsPage portfolio={portfolio} isLoading={isLoadingPortfolio} error={portfolioError} />
      </div>}
      {visited.has('analysis')   && <div className={activeTab === 'analysis'   ? '' : 'hidden'}>
        <AnalysisPage portfolio={portfolio} isLoading={isLoadingPortfolio} error={portfolioError} />
      </div>}
      <TabBar active={activeTab} onChange={handleTabChange} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}
