export interface Summary {
  totalBuy: number
  totalCurrent: number
  totalProfit: number
  profitRate: number
  trendTotalProfit: number
  totalProfitRate: number
  confirmedProfit: number
  confirmedProfitRate: number
  trendOperatingProfit: number
  operatingProfitRate: number
  dayChangAmount: number
  dayChangePct: string
  prevDayChangAmount: number
  prevDayChangePct: string
  isMarketDay?: boolean
  isTradingDay?: boolean
}

export interface GroupStat {
  current: number
  buy: number
  profit: number
  count: number
  profitRate: number
  pct: number
}

export interface Holding {
  code: string
  name: string
  category: string
  broker: string
  accountType: string
  quantity: number
  buyPrice: number
  currentPrice: number
  opBuy: number
  opCurrent: number
  opProfit: number
  profitRate: number
  change: number
  changePct: string
  m1: number
  m3: number
  m6: number
  y1: number
  high52: number
  low52: number
  buyDate?: string
}

export interface PortfolioResponse {
  success: boolean
  error?: string
  updatedAt?: string
  usdRate?: number
  gbpRate?: number
  summary?: Summary
  byCategory?: Record<string, GroupStat>
  byAccount?: Record<string, GroupStat>
  holdings?: Holding[]
}

export interface ReferenceIndicator {
  key: string
  name: string
  category: string
  value: number
  change: number
  changePct: number
}

export interface IndicatorsResponse {
  success: boolean
  error?: string
  updatedAt?: string
  indicators?: ReferenceIndicator[]
}

export interface TrendEntry {
  date: string
  totalProfit: number
}

export interface TrendHistoryResponse {
  success: boolean
  error?: string
  entries?: TrendEntry[]
}
