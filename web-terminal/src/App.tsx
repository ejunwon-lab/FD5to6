import { useState } from 'react'
import { TopBar } from './components/shell/TopBar'
import { Ticker } from './components/shell/Ticker'
import { Sidebar, type NavKey } from './components/shell/Sidebar'
import { Footer } from './components/shell/Footer'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { HoldingsPage } from './components/holdings/HoldingsPage'
import { AnalysisPage } from './components/analysis/AnalysisPage'
import { IndicatorsPage } from './components/indicators/IndicatorsPage'
import { ActivityPage } from './components/activity/ActivityPage'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="flex items-center justify-center overflow-hidden p-6">
      <div className="text-center">
        <div className="font-display text-amber text-xl sm:text-2xl tracking-widest mb-3 uppercase">{title}</div>
        <div className="text-ink-faint text-xs uppercase tracking-widest">Phase 3 — Coming next</div>
      </div>
    </main>
  )
}

function App() {
  const [active, setActive] = useState<NavKey>('dashboard')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const page = (() => {
    switch (active) {
      case 'dashboard':   return <DashboardPage />
      case 'holdings':    return <HoldingsPage />
      case 'analysis':    return <AnalysisPage />
      case 'indicators':  return <IndicatorsPage />
      case 'tradelog':    return <ActivityPage />
      case 'realized':    return <ActivityPage />
      default:            return <PlaceholderPage title={active} />
    }
  })()
  return (
    <div className="h-screen flex flex-col">
      <TopBar onMenuClick={() => setDrawerOpen(true)} />
      <Ticker />
      <div className="flex-1 grid overflow-hidden grid-cols-1 lg:grid-cols-[200px_1fr]">
        <Sidebar active={active} onSelect={setActive} drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
        {page}
      </div>
      <Footer />
    </div>
  )
}

export default App
