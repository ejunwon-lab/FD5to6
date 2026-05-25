// Google Apps Script 직접 호출 — script.googleapis.com/v1/scripts/{SCRIPT_ID}:run
// 사용자 OAuth 토큰으로 인증. devMode: true (head 코드 실행).

const SCRIPT_ID = '1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ'
const BASE_URL = 'https://script.googleapis.com/v1/scripts'

export interface Summary {
  totalBuy: number
  totalCurrent: number
  totalProfit: number
  profitRate: number
  trendTotalProfit: number
  totalProfitRate: number
  dayChangAmount: number
  dayChangePct: string
  prevDayChangAmount: number
  prevDayChangePct: string
  priceAsOfDate?: string | null
}

export interface ApiHolding {
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
  m1?: number
  m3?: number
  m6?: number
  y1?: number
  high52?: number
  low52?: number
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
  category: string     // 펀드/예금/보험/기타
  name: string
  broker: string
  account: string
  quantity: number
  opBuy: number
  value: number
  opProfit: number
  profitRate: number
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
  holdings?: ApiHolding[]
  cashReserve?: CashReserve
  nonStockAssets?: NonStockAssets
}

export interface ApiIndicator {
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
  indicators?: ApiIndicator[]
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

export interface MonthlyRealizedItem {
  date: string          // YYYY-MM-DD (매도일)
  month: string         // YYYY-MM (date.slice(0,7))
  code: string
  name: string
  category?: string     // 한국주식/미국주식/일본주식 등
  broker?: string       // 미래에셋·삼성 등
  account?: string      // 종합_랩·ISA 등
  quantity: number
  sellPrice?: number    // 매도단가
  sellAmount?: number   // 매도금액
  avgBuyPrice?: number  // 평균매입단가
  buyCost?: number      // 매입원가
  fee?: number          // 수수료
  profit: number        // 실현손익 (수수료 차감 후)
  returnPct?: number    // 수익률 %
}

export interface MonthlyRealizedResponse {
  success: boolean
  error?: string
  entries?: MonthlyRealizedItem[]
}

export interface StockTransaction {
  date: string
  type: '매수' | '매도'
  broker: string
  accountType: string
  quantity: number
  price: number
  amount: number
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
  high52?: number
  low52?: number
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
  priceHistory?: { date: string; price: number }[]
  stats?: {
    transactionCount: number
    buyCount: number
    sellCount: number
    firstBuyDate: string | null
    lastTransactionDate: string | null
  }
}

async function callGAS<T>(functionName: string, token: string, parameters?: unknown[]): Promise<T> {
  const res = await fetch(`${BASE_URL}/${SCRIPT_ID}:run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ function: functionName, devMode: true, parameters: parameters || [] }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const raw = await res.json()
  if (raw.error) {
    throw new Error(raw.error.message ?? 'GAS 실행 오류')
  }

  const result = raw.response?.result
  if (result === undefined || result === null) {
    throw new Error('GAS 응답 없음')
  }

  return (typeof result === 'string' ? JSON.parse(result) : result) as T
}

export const gasApi = {
  getPortfolio:      (token: string) => callGAS<PortfolioResponse>('newMobileGetPortfolio', token),
  getIndicators:     (token: string) => callGAS<IndicatorsResponse>('newMobileGetIndicators', token),
  getProfitHistory:  (token: string) => callGAS<TrendHistoryResponse>('newMobileGetProfitHistory', token),
  getMonthlyRealized:(token: string) => callGAS<MonthlyRealizedResponse>('newMobileGetMonthlyRealized', token),
  getStockDetail:    (token: string, code: string) =>
    callGAS<StockDetailResponse>('newMobileGetStockDetail', token, [code]),
  updateAll:         (token: string) => callGAS<PortfolioResponse>('newMobileUpdateAll', token),
}
