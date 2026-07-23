import { useMemo } from 'react'
import { usePortfolio } from '../../lib/usePortfolio'
import { tickerItems as sampleTicker } from '../../lib/sampleData'
import type { Indicator } from '../../lib/types'

interface DisplayItem {
  name: string
  symbol: string
  display: string   // formatted price/value
  changePct: number
}

// indicators 우선순위 키워드
const IND_PRIORITY = ['KOSPI', 'KOSDAQ', 'S&P', 'NASDAQ', 'USD', 'GBP', 'VIX', 'BTC']

export function Ticker() {
  const { holdings, indicators } = usePortfolio()

  const items = useMemo<DisplayItem[]>(() => {
    const list: DisplayItem[] = []

    // 1) indicators: 우선순위 키워드로 필터
    const indMatched = new Set<string>()
    for (const kw of IND_PRIORITY) {
      const found = indicators.find((i) => {
        const key = (i.symbol + ' ' + (i.name ?? '')).toUpperCase()
        return key.includes(kw) && !indMatched.has(i.symbol)
      })
      if (found) {
        indMatched.add(found.symbol)
        list.push(indToDisplay(found))
      }
    }

    // 2) holdings: |dayChangePct| 상위 8개
    const movers = [...holdings]
      .filter((h) => Number.isFinite(h.dayChangePct))
      .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))
      .slice(0, 8)
    for (const h of movers) {
      list.push({
        name: h.name || h.symbol,
        symbol: h.symbol,
        display: `₩${Math.round(h.currentPrice).toLocaleString('ko-KR')}`,
        changePct: h.dayChangePct,
      })
    }

    return list
  }, [holdings, indicators])

  // fallback: live 데이터 없으면 sample
  const finalItems = items.length
    ? items
    : sampleTicker.map((t) => ({
        name: t.name || t.symbol,
        symbol: t.symbol,
        display: t.price.toLocaleString('ko-KR', {
          minimumFractionDigits: t.price < 100 ? 2 : 0,
          maximumFractionDigits: t.price < 100 ? 2 : 0,
        }),
        changePct: t.changePct,
      }))

  // duplicate for seamless scroll
  const repeated = [...finalItems, ...finalItems]

  return (
    <div className="h-[26px] bg-bg-line border-b border-line overflow-hidden relative">
      <div
        className="flex gap-8 whitespace-nowrap animate-scroll items-center h-full"
        style={{ paddingLeft: '100%' }}
      >
        {repeated.map((t, i) => (
          <span key={i} className="text-xs">
            <span className="text-amber font-medium mr-1.5">{t.name}</span>
            <span className="text-ink-faint text-xxs tabular mr-1.5">{t.symbol}</span>
            <span className="tabular">{t.display}</span>
            <span className={`ml-1.5 tabular ${t.changePct >= 0 ? 'text-gain' : 'text-loss'}`}>
              {t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function indToDisplay(i: Indicator): DisplayItem {
  return {
    name: i.name || i.symbol,
    symbol: i.symbol,
    display: i.value.toLocaleString('ko-KR', {
      minimumFractionDigits: i.value > 10_000 ? 0 : 2,
      maximumFractionDigits: 2,
    }),
    changePct: i.changePct,
  }
}
