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
  priceAsOfDate?: string | null
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

export interface CashReserveItem {
  broker: string
  account: string
  amount: number
  note?: string
  updatedAt?: string
}

export interface CashReserve {
  items: CashReserveItem[]
  total: number
}

export interface NonStockAssetItem {
  category: string
  name: string
  broker: string
  account: string
  value: number
}

export interface NonStockAssets {
  items: NonStockAssetItem[]
  total: number
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
  cashReserve?: CashReserve
  nonStockAssets?: NonStockAssets
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

// 종목 상세
export interface StockTransaction {
  date: string
  type: '매수' | '매도'
  broker: string
  accountType: string
  quantity: number
  price: number
  amount: number
  fee: number
}

export interface StockPosition {
  broker: string
  accountType: string
  quantity: number
  avgPrice: number
  buyAmount: number
  currentPrice: number
  opCurrent: number
  opProfit: number
  profitRate: number
  high52: number
  low52: number
}

export interface StockPricePoint {
  date: string
  price: number
}

export interface StockDetailResponse {
  success: boolean
  error?: string
  code?: string
  name?: string
  category?: string
  positions?: StockPosition[]
  summary?: {
    totalQuantity: number
    totalBuyAmount: number
    totalCurrentValue: number
    totalProfit: number
    profitRate: number
  }
  transactions?: StockTransaction[]
  priceHistory?: StockPricePoint[]
  stats?: {
    transactionCount: number
    buyCount: number
    sellCount: number
    firstBuyDate: string | null
    lastTransactionDate: string | null
  }
}

// 매도 종목 What-if 추적
export interface SoldTrackerItem {
  sellDate: string
  code: string
  name: string
  category: string
  broker: string
  account: string
  sellQty: number | null
  sellPrice: number | null
  sellAmount: number | null
  avgBuyPrice: number | null
  buyCost: number | null
  realizedProfit: number | null
  currentPrice: number | null   // 해외는 null (환율 미반영 스케일)
  ifHeldProfit: number | null   // 안 팔았다면 오늘 손익
  diff: number | null           // 판 것 대비 차이(+면 더 벌 수 있었음, −면 잘 팔았음)
  elapsedDays: number | null
}

export interface SoldTrackerResponse {
  success: boolean
  error?: string
  asOfDate?: string | null
  items?: SoldTrackerItem[]
}

// 월별 실현손익
export interface MonthlyRealizedEntry {
  month: string         // 'yyyy-MM'
  count: number
  winCount: number
  profit: number
  profitRate: number
  winRate: number
}

export interface MonthlyRealizedResponse {
  success: boolean
  error?: string
  monthly?: MonthlyRealizedEntry[]
}
