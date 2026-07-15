type Tab = 'dashboard' | 'holdings' | 'analysis' | 'indicators' | 'soldtracker'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'indicators',  label: '지표',     icon: '◈' },
  { id: 'dashboard',   label: '대시보드', icon: '◎' },
  { id: 'holdings',    label: '종목',     icon: '≡' },
  { id: 'analysis',    label: '분석',     icon: '△' },
  { id: 'soldtracker', label: '복기',     icon: '↺' },
]

interface TabBarProps {
  active: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-[430px] px-8">
      <div className="pointer-events-auto flex items-center bg-[rgb(var(--card-bg))]/90 backdrop-blur-xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.15)] px-2 py-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-full transition-all duration-200 ${
              active === tab.id
                ? 'bg-accent text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span className="text-[10px] font-medium leading-none">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export type { Tab }
