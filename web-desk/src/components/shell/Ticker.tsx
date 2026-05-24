import { tickerItems } from '../../lib/sampleData'
import { fmtNum } from '../../lib/format'

export function Ticker() {
  // duplicate items for seamless scroll
  const items = [...tickerItems, ...tickerItems]
  return (
    <div className="h-[26px] bg-bg-line border-b border-line overflow-hidden relative">
      <div className="flex gap-8 whitespace-nowrap animate-scroll items-center h-full" style={{ paddingLeft: '100%' }}>
        {items.map((t, i) => (
          <span key={i} className="text-xs">
            <span className="text-amber mr-2">{t.symbol}</span>
            <span>{fmtNum(t.price, t.price < 100 ? 2 : 0)}</span>
            <span className={`ml-2 ${t.changePct >= 0 ? 'text-gain' : 'text-loss'}`}>
              {t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
