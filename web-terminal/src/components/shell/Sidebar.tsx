export type NavKey = 'dashboard' | 'holdings' | 'analysis' | 'indicators' | 'tradelog' | 'pricehist' | 'realized' | 'dividends' | 'kis' | 'settings'

interface Props {
  active: NavKey
  onSelect: (k: NavKey) => void
}

const sections: { title: string; items: { key: NavKey; label: string; hint?: string; badge?: string }[] }[] = [
  {
    title: 'Workspace',
    items: [
      { key: 'dashboard', label: 'Dashboard', hint: 'F1' },
      { key: 'holdings', label: 'Holdings', hint: 'F2' },
      { key: 'analysis', label: 'Analysis', hint: 'F3' },
      { key: 'indicators', label: 'Indicators', hint: 'F4' },
      { key: 'tradelog', label: 'Trade Log', hint: 'F5' },
    ],
  },
  {
    title: 'Data',
    items: [
      { key: 'pricehist', label: 'Price History', hint: 'F6' },
      { key: 'realized', label: 'Realized P&L', hint: 'F7' },
      { key: 'dividends', label: 'Dividends', badge: '3' },
    ],
  },
  {
    title: 'System',
    items: [
      { key: 'kis', label: 'KIS Status', hint: '●' },
      { key: 'settings', label: 'Settings', hint: 'F9' },
    ],
  },
]

export function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="w-[200px] bg-[#0c0f15] border-r border-line py-3.5 overflow-y-auto">
      {sections.map((sec) => (
        <div key={sec.title}>
          <h3 className="text-xxs text-ink-faint tracking-widest3 px-4 pt-3.5 pb-1.5 uppercase font-medium">
            {sec.title}
          </h3>
          {sec.items.map((item) => (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`w-full flex items-center justify-between px-4 py-1.5 text-left text-xs border-l-2 ${
                active === item.key
                  ? 'bg-bg-elev border-amber text-ink'
                  : 'border-transparent text-ink-dim hover:bg-bg-hover hover:text-ink'
              }`}
            >
              <span>{item.label}</span>
              {item.hint && <span className="text-2xs text-ink-faint">{item.hint}</span>}
              {item.badge && (
                <span className="bg-amber text-bg px-1.5 py-0 text-2xs font-bold rounded-sm">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}
