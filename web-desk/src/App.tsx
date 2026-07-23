import { useEffect, useState } from 'react'
import { TopBar } from './components/shell/TopBar'
import { Ticker } from './components/shell/Ticker'
import { Sidebar, type NavKey } from './components/shell/Sidebar'
import { MobileTabBar } from './components/shell/MobileTabBar'
import { Footer } from './components/shell/Footer'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { TodayPage } from './components/today/TodayPage'
import { HoldingsPage } from './components/holdings/HoldingsPage'
import { AnalysisPage } from './components/analysis/AnalysisPage'
import { IndicatorsPage } from './components/indicators/IndicatorsPage'
import { ActivityPage } from './components/activity/ActivityPage'
import { DataProvider } from './lib/DataProvider'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="flex items-center justify-center overflow-hidden p-6">
      <div className="text-center">
        <div className="font-display text-amber text-xl sm:text-2xl tracking-widest mb-3 uppercase">{title}</div>
        <div className="text-ink-faint text-xs uppercase tracking-widest">준비 중 — 로드맵 등재 (2026-07-23)</div>
      </div>
    </main>
  )
}

const SHORTCUTS: Record<string, NavKey> = {
  d: 'dashboard',
  y: 'today',
  h: 'holdings',
  a: 'analysis',
  i: 'indicators',
  t: 'tradelog',
  p: 'pricehist',
  v: 'dividends',
  k: 'kis',
  s: 'settings',
}

function App() {
  const [active, setActive] = useState<NavKey>('dashboard')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t) {
        const tag = t.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return
      }
      const k = e.key.toLowerCase()
      const nav = SHORTCUTS[k]
      if (nav) {
        e.preventDefault()
        setActive(nav)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const page = (() => {
    switch (active) {
      case 'dashboard':   return <DashboardPage />
      case 'today':       return <TodayPage />
      case 'holdings':    return <HoldingsPage />
      case 'analysis':    return <AnalysisPage />
      case 'indicators':  return <IndicatorsPage />
      case 'tradelog':    return <ActivityPage />
      default:            return <PlaceholderPage title={active} />
    }
  })()
  return (
    <DataProvider>
      {/* 100dvh: iOS Safari 주소창 수축/확장에도 하단 탭바가 잘리지 않게 */}
      <div className="h-[100dvh] flex flex-col">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <Ticker />
        <div className="flex-1 grid overflow-hidden grid-cols-1 lg:grid-cols-[200px_1fr]">
          <Sidebar active={active} onSelect={setActive} drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
          {page}
        </div>
        <MobileTabBar active={active} onSelect={setActive} />
        <div className="hidden lg:block">
          <Footer />
        </div>
      </div>
    </DataProvider>
  )
}

export default App
