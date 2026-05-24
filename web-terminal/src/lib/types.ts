export type Market = 'KR' | 'US'

export interface Holding {
  symbol: string         // code
  name: string
  category: string       // 카테고리
  market: Market
  value: number          // KRW (opCurrent — 평가금액)
  opBuy: number          // 매입금액 KRW
  returnPct: number      // 전체 수익률 %
  weightPct: number
  shares: number         // quantity
  avgPrice: number       // KRW for KR, USD for US (buyPrice — 매수단가)
  currentPrice: number   // 현재가 (KR ₩, US ₩ 환산 또는 $)
  // 계좌·증권사
  accountType: string    // 계좌명 (종합·ISA·퇴직연금_미래 등)
  broker: string         // 증권사
  // P&L
  opProfit: number       // 수익금 KRW
  // 당일
  change: number         // 당일 등락 단가 (per share)
  changePct: string      // 당일 등락 % (원본 문자열, "+1.10%" 등)
  dayChange: number      // 당일 등락 금액 (₩, 종목 전체 = change × shares)
  dayChangePct: number   // 당일 등락률 % (숫자)
  // 기간별 수익률
  m1: number
  m3: number
  m6: number
  y1: number
  // 52주
  high52: number
  low52: number
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
