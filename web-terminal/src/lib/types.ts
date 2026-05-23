export type Market = 'KR' | 'US'

export interface Holding {
  symbol: string
  name: string
  market: Market
  value: number          // KRW (opCurrent — 평가금액)
  returnPct: number      // 전체 수익률 %
  weightPct: number
  shares: number
  avgPrice: number       // KRW for KR, USD for US (buyPrice — 매수단가)
  // 계좌·증권사
  accountType: string    // 계좌명 (종합·ISA·퇴직연금_미래 등)
  broker: string         // 증권사
  // P&L
  opProfit: number       // 수익금 KRW
  // 당일
  dayChange: number      // 당일 등락 금액 (₩, 종목 전체)
  dayChangePct: number   // 당일 등락률 %
  // 메타
  buyDate?: string       // 매수일 YYYY-MM-DD
}

export interface Indicator {
  symbol: string
  name: string
  value: number
  changeAbs: number
  changePct: number
  spark: number[]
}

export interface ActivityItem {
  time: string
  type: 'BUY' | 'SELL' | 'DIV'
  symbol: string
  description: string
  amount: string
}

export interface TickerItem {
  symbol: string
  price: number
  changePct: number
}

export interface PortfolioSummary {
  totalValue: number
  todayPnl: number
  todayPct: number
  totalReturn: number
  totalReturnPct: number
  positionsActive: number
  positionsTotal: number
  positionsGain: number
  positionsLoss: number
  cashReserve: number
  cashPct: number
}

export interface EquityPoint {
  date: string
  value: number
}
