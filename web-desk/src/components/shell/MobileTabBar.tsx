import type { NavKey } from './Sidebar'

// 모바일(<lg) 하단 탭바 — 드로어보다 빠른 주 화면 전환.
// Data/System 메뉴(pricehist·dividends·kis·settings)는 여전히 햄버거 드로어에서.
const TABS: { key: NavKey; label: string; icon: string }[] = [
  { key: 'dashboard',  label: 'Dash',  icon: '◫' },
  { key: 'today',      label: 'Today', icon: '☀' },
  { key: 'holdings',   label: 'Hold',  icon: '▤' },
  { key: 'analysis',   label: 'Anlys', icon: '◔' },
  { key: 'indicators', label: 'Indic', icon: '↗' },
  { key: 'tradelog',   label: 'Trade', icon: '≡' },
]

interface Props {
  active: NavKey
  onSelect: (k: NavKey) => void
}

export function MobileTabBar({ active, onSelect }: Props) {
  return (
    <nav
      className="lg:hidden shrink-0 bg-bg-deep border-t border-line grid grid-cols-6"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-2xs uppercase tracking-wider ${
            active === t.key ? 'text-amber' : 'text-ink-dim'
          }`}
          aria-label={t.label}
        >
          <span className="text-sm leading-none">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
