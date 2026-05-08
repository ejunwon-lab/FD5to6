import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { TabBar } from './components/ui/TabBar'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { HoldingsPage } from './components/holdings/HoldingsPage'
import { AnalysisPage } from './components/analysis/AnalysisPage'
import { IndicatorsPage } from './components/indicators/IndicatorsPage'
import type { Tab } from './components/ui/TabBar'

function KeyInputScreen() {
  const { signIn } = useAuth()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!key.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      await signIn(key.trim())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'UNAUTHORIZED') {
        setError('접근 코드가 올바르지 않습니다')
      } else {
        setError(`오류: ${msg}`)
      }
      setLoading(false)
    }
  }

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
        <p className="text-sm text-gray-400">접근 코드를 입력하세요</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="접근 코드"
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-accent"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !key.trim()}
          className="w-full py-3 rounded-2xl bg-accent text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform"
        >
          {loading ? '확인 중...' : '확인'}
        </button>
        {error && <p className="text-center text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}

function MainApp() {
  const { isSignedIn, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  if (isLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[rgb(var(--page-bg))]">
        <div className="w-8 h-8 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isSignedIn) return <KeyInputScreen />

  return (
    <div className="relative max-w-[430px] mx-auto">
      {activeTab === 'dashboard'  && <DashboardPage />}
      {activeTab === 'holdings'   && <HoldingsPage />}
      {activeTab === 'analysis'   && <AnalysisPage />}
      {activeTab === 'indicators' && <IndicatorsPage />}
      <TabBar active={activeTab} onChange={setActiveTab} />
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
