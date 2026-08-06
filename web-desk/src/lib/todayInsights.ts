// Today 페이지 순수 로직 — 종목 집계·주의 신호·오늘 등락의 최근 분포 내 위치.
// 화폐 단위 주의: avgPrice는 US가 USD라 쓰지 않는다. ₩ 필드(dayChange·opProfit)와
// 같은 통화끼리의 비율(currentPrice/high52 등)만 사용.

import type { EquityPoint, Holding, Market } from './types'

export interface SymbolAgg {
  symbol: string
  name: string
  market: Market
  value: number        // 평가금액 ₩ (계좌 합산)
  dayChange: number    // 당일 등락액 ₩ (계좌 합산)
  dayChangePct: number // 당일 등락률 % (종목 단일값)
  opProfit: number     // 현재 수익금 ₩ (계좌 합산)
  prevProfit: number   // 어제 기준 수익금 ₩ = opProfit - dayChange
  currentPrice: number
  high52: number
  low52: number
}

/** 같은 종목이 여러 계좌에 나뉜 보유를 종목 단위로 합산 */
export function aggregateBySymbol(holdings: Holding[]): SymbolAgg[] {
  const map = new Map<string, SymbolAgg>()
  holdings.forEach((h) => {
    const cur = map.get(h.symbol)
    if (cur) {
      cur.value += h.value
      cur.dayChange += h.dayChange ?? 0
      cur.opProfit += h.opProfit
    } else {
      map.set(h.symbol, {
        symbol: h.symbol,
        name: h.name,
        market: h.market,
        value: h.value,
        dayChange: h.dayChange ?? 0,
        dayChangePct: h.dayChangePct ?? 0,
        opProfit: h.opProfit,
        prevProfit: 0,
        currentPrice: h.currentPrice,
        high52: h.high52,
        low52: h.low52,
      })
    }
  })
  const list = [...map.values()]
  list.forEach((a) => { a.prevProfit = a.opProfit - a.dayChange })
  return list
}

export type SignalKind = 'flipGain' | 'flipLoss' | 'high52' | 'low52' | 'surge' | 'plunge'

export interface TodaySignal {
  kind: SignalKind
  symbol: string
  name: string
  label: string   // 예: "손실→수익 전환" · "52주 고점 -2.1%" · "급락 -4.32%"
  tone: 'gain' | 'loss'
}

const NEAR_HIGH = 0.95   // 52주 고점의 95% 이상
const NEAR_LOW = 1.05    // 52주 저점의 105% 이하
const SURGE_PCT = 3      // |당일%| ≥ 3 이면 급등락
const KIND_ORDER: SignalKind[] = ['flipGain', 'flipLoss', 'surge', 'plunge', 'high52', 'low52']

/** 오늘 기준으로 "상태가 바뀐" 종목만 추출 — 행동 후보 */
export function detectSignals(aggs: SymbolAgg[]): TodaySignal[] {
  const out: TodaySignal[] = []
  aggs.forEach((a) => {
    // 수익↔손실 전환 (₩ 기준 — 통화 안전)
    if (a.opProfit > 0 && a.prevProfit <= 0 && a.dayChange > 0)
      out.push({ kind: 'flipGain', symbol: a.symbol, name: a.name, label: '손실→수익 전환', tone: 'gain' })
    else if (a.opProfit < 0 && a.prevProfit >= 0 && a.dayChange < 0)
      out.push({ kind: 'flipLoss', symbol: a.symbol, name: a.name, label: '수익→손실 전환', tone: 'loss' })
    // 급등락
    if (a.dayChangePct >= SURGE_PCT)
      out.push({ kind: 'surge', symbol: a.symbol, name: a.name, label: `급등 +${a.dayChangePct.toFixed(2)}%`, tone: 'gain' })
    else if (a.dayChangePct <= -SURGE_PCT)
      out.push({ kind: 'plunge', symbol: a.symbol, name: a.name, label: `급락 ${a.dayChangePct.toFixed(2)}%`, tone: 'loss' })
    // 52주 고점/저점 근접 (비율만 사용 — 통화 무관)
    if (a.high52 > 0 && a.currentPrice >= a.high52 * NEAR_HIGH) {
      const gap = (a.currentPrice / a.high52 - 1) * 100
      out.push({
        kind: 'high52', symbol: a.symbol, name: a.name,
        label: gap >= 0 ? '52주 신고가' : `52주 고점 ${gap.toFixed(1)}%`, tone: 'gain',
      })
    } else if (a.low52 > 0 && a.currentPrice <= a.low52 * NEAR_LOW) {
      const gap = (a.currentPrice / a.low52 - 1) * 100
      out.push({
        kind: 'low52', symbol: a.symbol, name: a.name,
        label: gap <= 0 ? '52주 신저가' : `52주 저점 +${gap.toFixed(1)}%`, tone: 'loss',
      })
    }
  })
  return out.sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind))
}

export interface DayPercentile {
  n: number        // 표본 거래일 수
  rankPct: number  // 상승일: 상위 %, 하락일: 하위 % (작을수록 극단)
  isUp: boolean
}

const MIN_SAMPLE = 20

/** 오늘 등락률이 최근 window 거래일 일별 등락 분포에서 어디쯤인지 (자산 시리즈 기반) */
export function dayReturnPercentile(
  curve: EquityPoint[],
  todayPct: number,
  window = 90,
): DayPercentile | null {
  const changes: number[] = []
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].asset
    const cur = curve[i].asset
    if (prev != null && cur != null && prev > 0) changes.push(((cur - prev) / prev) * 100)
  }
  const recent = changes.slice(-window)
  if (recent.length < MIN_SAMPLE) return null
  const n = recent.length
  const isUp = todayPct >= 0
  const moreExtreme = isUp
    ? recent.filter((c) => c > todayPct).length
    : recent.filter((c) => c < todayPct).length
  const rankPct = ((moreExtreme + 1) / (n + 1)) * 100
  return { n, rankPct, isUp }
}
