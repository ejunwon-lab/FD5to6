import type { ActivityItem, EquityPoint, Holding, Indicator, PortfolioSummary, TickerItem } from './types'

export const summary: PortfolioSummary = {
  totalValue: 47_832_500,
  todayPnl: 523_800,
  todayPct: 1.10,
  totalReturn: 4_832_500,
  totalReturnPct: 11.25,
  positionsActive: 8,
  positionsTotal: 12,
  positionsGain: 6,
  positionsLoss: 2,
  cashReserve: 2_140_000,
  cashPct: 4.5,
}

function mk(p: Omit<Holding, 'category' | 'opBuy' | 'currentPrice' | 'change' | 'changePct' | 'm1' | 'm3' | 'm6' | 'y1' | 'high52' | 'low52'> & { changeKRW: number }): Holding {
  const opBuy = p.value - p.opProfit
  const currentPrice = p.value / Math.max(p.shares, 1)
  const change = p.changeKRW / Math.max(p.shares, 1)
  return {
    ...p,
    category: p.market === 'KR' ? '한국주식' : '미국주식',
    opBuy,
    currentPrice,
    change,
    changePct: `${p.dayChangePct >= 0 ? '+' : ''}${p.dayChangePct.toFixed(2)}%`,
    m1: p.dayChangePct * 1.3,
    m3: p.returnPct * 0.4,
    m6: p.returnPct * 0.7,
    y1: p.returnPct,
    high52: currentPrice * 1.18,
    low52: currentPrice * 0.72,
  }
}

export const holdings: Holding[] = [
  mk({ symbol: 'NVDA',   name: 'NVIDIA',     market: 'US', value: 12_400_000, returnPct: 28.5,  weightPct: 25.9, shares: 8,  avgPrice: 720,    accountType: '종합',         broker: '미래에셋', opProfit: 2_750_000, dayChange: +135_400, changeKRW: +135_400, dayChangePct: +1.10, buyDate: '2025-09-15' }),
  mk({ symbol: '005930', name: '삼성전자',   market: 'KR', value: 8_200_000,  returnPct: 5.2,   weightPct: 17.1, shares: 25, avgPrice: 328_000,accountType: '종합_랩',      broker: '미래에셋', opProfit:   405_000, dayChange:  +91_000, changeKRW:  +91_000, dayChangePct: +1.12, buyDate: '2024-11-02' }),
  mk({ symbol: 'MSFT',   name: 'Microsoft',  market: 'US', value: 7_300_000,  returnPct: 18.7,  weightPct: 15.3, shares: 12, avgPrice: 310,    accountType: '종합',         broker: '미래에셋', opProfit: 1_150_000, dayChange:  +77_400, changeKRW:  +77_400, dayChangePct: +1.07, buyDate: '2025-02-20' }),
  mk({ symbol: '000660', name: 'SK하이닉스', market: 'KR', value: 6_750_000,  returnPct: 12.8,  weightPct: 14.1, shares: 30, avgPrice: 175_000,accountType: '종합_랩',      broker: '미래에셋', opProfit:   765_000, dayChange: +145_300, changeKRW: +145_300, dayChangePct: +2.20, buyDate: '2025-03-08' }),
  mk({ symbol: 'AAPL',   name: 'Apple',      market: 'US', value: 5_200_000,  returnPct: 3.2,   weightPct: 10.9, shares: 15, avgPrice: 182,    accountType: 'ISA',          broker: '삼성증권', opProfit:   160_000, dayChange:  +44_200, changeKRW:  +44_200, dayChangePct: +0.85, buyDate: '2025-06-11' }),
  mk({ symbol: 'TSLA',   name: 'Tesla',      market: 'US', value: 3_100_000,  returnPct: -2.1,  weightPct: 6.5,  shares: 10, avgPrice: 240,    accountType: 'ISA',          broker: '미래에셋', opProfit:   -67_000, dayChange:  -66_400, changeKRW:  -66_400, dayChangePct: -2.10, buyDate: '2025-08-23' }),
  mk({ symbol: '035720', name: '카카오',     market: 'KR', value: 2_500_000,  returnPct: -8.3,  weightPct: 5.2,  shares: 50, avgPrice: 54_000, accountType: 'ISA',          broker: '삼성증권', opProfit:  -225_000, dayChange:  -49_000, changeKRW:  -49_000, dayChangePct: -1.92, buyDate: '2024-09-14' }),
  mk({ symbol: '005380', name: '현대차',     market: 'KR', value: 2_382_500,  returnPct: 6.4,   weightPct: 5.0,  shares: 12, avgPrice: 186_000,accountType: '퇴직연금_미래', broker: '미래에셋', opProfit:   143_500, dayChange:  +29_200, changeKRW:  +29_200, dayChangePct: +1.24, buyDate: '2025-01-30' }),
]

export const indicators: Indicator[] = [
  { symbol: 'KOSPI',     name: 'KOSPI',       category: '한국시장', value: 2541.32, changeAbs: 11.34,   changePct: 0.45,  spark: [18,16,19,14,12,9,13,7,5] },
  { symbol: 'KOSDAQ',    name: 'KOSDAQ',      category: '한국시장', value:  832.41, changeAbs:  4.18,   changePct: 0.50,  spark: [22,19,17,15,18,12,14,9,7] },
  { symbol: 'S&P500',    name: 'S&P 500',     category: '미국시장', value: 5234.18, changeAbs: 42.55,   changePct: 0.82,  spark: [20,18,21,15,13,10,8,11,4] },
  { symbol: 'NASDAQ100', name: 'NASDAQ 100',  category: '미국시장', value:18342.65, changeAbs:206.42,   changePct: 1.14,  spark: [21,18,22,16,14,11,13,8,3] },
  { symbol: 'USDKRW',    name: 'USD/KRW',     category: '환율',     value: 1342.50, changeAbs: -2.40,   changePct:-0.18,  spark: [6,9,11,13,12,15,14,17,18] },
  { symbol: 'GBPKRW',    name: 'GBP/KRW',     category: '환율',     value: 1701.20, changeAbs: -3.15,   changePct:-0.18,  spark: [7,9,12,11,13,16,15,17,19] },
  { symbol: 'BTC',       name: 'BTC/USD',     category: '암호화폐', value:67234,    changeAbs:1583,     changePct: 2.41,  spark: [19,17,14,16,11,13,8,10,5] },
]

export const activity: ActivityItem[] = [
  { time: '14:18',  type: 'BUY',  symbol: 'NVDA',   description: 'Nvidia · 2 shares @ 872.50',     amount: '$1,745' },
  { time: '05-22',  type: 'DIV',  symbol: 'MSFT',   description: 'Microsoft · quarterly',           amount: '$9.00' },
  { time: '05-21',  type: 'SELL', symbol: '035720', description: '카카오 · 10 shares',              amount: '₩498,000' },
  { time: '05-20',  type: 'BUY',  symbol: '000660', description: 'SK하이닉스 · 5 shares',           amount: '₩697,500' },
  { time: '05-19',  type: 'DIV',  symbol: 'AAPL',   description: 'Apple · quarterly',               amount: '$3.60' },
  { time: '05-16',  type: 'BUY',  symbol: 'MSFT',   description: 'Microsoft · 3 shares @ 408.20',   amount: '$1,225' },
  { time: '05-14',  type: 'SELL', symbol: 'TSLA',   description: 'Tesla · 5 shares',                amount: '$1,188' },
]

export const tickerItems: TickerItem[] = [
  { symbol: '005930', name: '삼성전자',    price:  70_400, changePct:  1.30 },
  { symbol: 'NVDA',   name: 'Nvidia',      price: 875.32, changePct:  3.41 },
  { symbol: 'AAPL',   name: 'Apple',       price: 184.92, changePct:  0.85 },
  { symbol: 'KOSPI',  name: 'KOSPI',       price: 2541.32, changePct: 0.45 },
  { symbol: 'S&P500', name: 'S&P 500',     price: 5234.18, changePct: 0.82 },
  { symbol: 'USDKRW', name: 'USD/KRW',     price: 1342.50, changePct:-0.18 },
  { symbol: '035720', name: '카카오',      price:  50_400, changePct: -1.95 },
  { symbol: 'TSLA',   name: 'Tesla',       price: 235.10, changePct: -2.14 },
  { symbol: 'BTC',    name: 'BTC/USD',     price:  67_234, changePct:  2.41 },
  { symbol: 'MSFT',   name: 'Microsoft',   price: 414.20, changePct:  1.06 },
  { symbol: '000660', name: 'SK하이닉스',  price: 142_500, changePct:  2.15 },
]

// 180일 equity curve — 다양한 기간 필터 테스트용
export const equityCurve: EquityPoint[] = (() => {
  const start = 38_000_000
  const target = 47_832_500
  const n = 180
  const arr: EquityPoint[] = []
  let v = start
  const today = new Date()
  for (let i = 0; i < n; i++) {
    const drift = (target - v) * 0.012
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.6)) * 250_000
    const trendNoise = (Math.sin(i * 0.13)) * 800_000
    v = v + drift + noise + trendNoise
    const d = new Date(today.getTime() - (n - 1 - i) * 86_400_000)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    arr.push({
      date: `${mm}-${dd}`,
      fullDate: `${yyyy}-${mm}-${dd}`,
      value: Math.round(v),
    })
  }
  arr[arr.length - 1].value = target
  return arr
})()
