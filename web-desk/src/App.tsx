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
import { KisStatusPage } from './components/system/KisStatusPage'
import { PriceHistoryPage } from './components/pricehist/PriceHistoryPage'
import { SettingsPage } from './components/system/SettingsPage'
import { DataProvider } from './lib/DataProvider'

const SHORTCUTS: Record<string, NavKey> = {
  d: 'dashboard',
  y: 'today',
  h: 'holdings',
  a: 'analysis',
  i: 'indicators',
  t: 'activity',
  p: 'pricehist',
  k: 'kis',
  s: 'settings',
}

const NAV_KEYS: NavKey[] = ['dashboard', 'today', 'holdings', 'analysis', 'indicators', 'activity', 'pricehist', 'kis', 'settings']

function App() {
  // #holdings 같은 해시로 초기 탭 딥링크 (스크린샷 테스트·북마크용, 2026-08-16)
  const [active, setActive] = useState<NavKey>(() => {
    const h = window.location.hash.slice(1) as NavKey
    return NAV_KEYS.includes(h) ? h : 'dashboard'
  })
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 가로 스크롤 페이드 힌트 — .fade-x 요소에 오른쪽으로 더 볼 내용이 있을 때만 .fade-x-on을 켠다.
  // 상시 마스크는 스크롤 끝에서도 마지막 컬럼을 흐리게 만들어 "잘림"으로 보임 (2026-08-16)
  useEffect(() => {
    const update = (el: HTMLElement) =>
      el.classList.toggle('fade-x-on', el.scrollWidth - el.clientWidth - el.scrollLeft > 4)
    const sweep = () => document.querySelectorAll<HTMLElement>('.fade-x').forEach(update)
    sweep()
    const onScroll = (e: Event) => {
      const t = e.target
      if (t instanceof HTMLElement && t.classList.contains('fade-x')) update(t)
    }
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', sweep)
    const mo = new MutationObserver(() => requestAnimationFrame(sweep))
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', sweep)
      mo.disconnect()
    }
  }, [])

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
      case 'activity':    return <ActivityPage />
      case 'kis':         return <KisStatusPage />
      case 'pricehist':   return <PriceHistoryPage />
      case 'settings':    return <SettingsPage />
      default:            return <DashboardPage />
    }
  })()
  return (
    <DataProvider>
      {/* 100dvh: iOS Safari 주소창 수축/확장에도 하단 탭바가 잘리지 않게. overflow-x-clip: 페이지 전체 좌우 끌림 원천 차단 */}
      <div className="h-[100dvh] flex flex-col overflow-x-clip">
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
