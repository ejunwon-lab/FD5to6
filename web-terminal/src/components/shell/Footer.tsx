export function Footer() {
  const keys = [
    ['F1', 'HELP'],
    ['F2', 'QUOTE'],
    ['F3', 'NEWS'],
    ['F4', 'CHART'],
    ['F5', 'REFRESH'],
    ['/', 'SEARCH'],
  ]
  return (
    <div className="h-7 bg-bg-deep border-t border-line flex items-center px-3 sm:px-4 text-xxs text-ink-faint gap-3 sm:gap-6 overflow-hidden">
      {keys.map(([k, label], idx) => (
        <span
          key={k}
          className={`inline-flex gap-1.5 items-center shrink-0 ${idx >= 3 ? 'hidden md:inline-flex' : ''}`}
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
