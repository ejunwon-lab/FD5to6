export function Footer() {
  // 사이드바 단축키와 일관 (App.tsx SHORTCUTS)
  const keys = [
    ['D', 'DASHBOARD'],
    ['Y', 'TODAY'],
    ['H', 'HOLDINGS'],
    ['A', 'ANALYSIS'],
    ['I', 'INDICATORS'],
    ['T', 'TRADE LOG'],
  ]
  return (
    <div className="h-7 bg-bg-deep border-t border-line flex items-center px-3 sm:px-4 text-xxs text-ink-faint gap-3 sm:gap-6 overflow-hidden">
      {keys.map(([k, label], idx) => (
        <span
          key={k}
          className={`gap-1.5 items-center shrink-0 hidden ${idx >= 3 ? 'md:inline-flex' : 'sm:inline-flex'}`}
        >
          <span className="bg-bg-elev border border-line text-amber px-1.5 py-0 font-semibold text-2xs">{k}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
      ))}
      <span className="ml-auto text-gain shrink-0">
        &gt; ready<span className="inline-block w-1.5 h-3 bg-gain align-middle ml-0.5 animate-blink" />
      </span>
    </div>
  )
}
