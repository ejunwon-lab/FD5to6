import { describe, expect, it } from 'vitest'
import { aggregateBySymbol, dayReturnPercentile, detectSignals, type SymbolAgg } from './todayInsights'
import type { EquityPoint, Holding } from './types'

const base: Holding = {
  symbol: '005930', name: '삼성전자', category: '한국주식', market: 'KR',
  value: 1_000_000, opBuy: 900_000, returnPct: 11.1, weightPct: 10,
  shares: 10, avgPrice: 90_000, currentPrice: 100_000,
  accountType: '종합', broker: '미래에셋',
  opProfit: 100_000, change: 1_000, changePct: '+1.00%',
  dayChange: 10_000, dayChangePct: 1.0,
  m1: 0, m3: 0, m6: 0, y1: 0, high52: 120_000, low52: 80_000,
}

function agg(over: Partial<SymbolAgg>): SymbolAgg {
  return {
    symbol: 'X', name: 'X종목', market: 'KR', value: 1_000_000,
    dayChange: 0, dayChangePct: 0, opProfit: 0, prevProfit: 0,
    currentPrice: 100, high52: 200, low52: 50,
    ...over,
  }
}

describe('aggregateBySymbol', () => {
  it('같은 종목 두 계좌를 1건으로 합산하고 prevProfit을 계산한다', () => {
    const rows = aggregateBySymbol([
      base,
      { ...base, accountType: 'ISA', value: 500_000, dayChange: 5_000, opProfit: -2_000 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBe(1_500_000)
    expect(rows[0].dayChange).toBe(15_000)
    expect(rows[0].opProfit).toBe(98_000)
    expect(rows[0].prevProfit).toBe(83_000)  // 98,000 - 15,000
  })
})

describe('detectSignals', () => {
  it('손실→수익 전환: 어제 -₩2,000 → 오늘 +₩3,000', () => {
    const s = detectSignals([agg({ opProfit: 3_000, dayChange: 5_000, prevProfit: -2_000 })])
    expect(s.map((x) => x.kind)).toContain('flipGain')
  })
  it('수익→손실 전환: 어제 +₩1,000 → 오늘 -₩4,000', () => {
    const s = detectSignals([agg({ opProfit: -4_000, dayChange: -5_000, prevProfit: 1_000 })])
    expect(s.map((x) => x.kind)).toContain('flipLoss')
  })
  it('52주 고점 95% 이상 근접 + 신고가 라벨', () => {
    const near = detectSignals([agg({ currentPrice: 192, high52: 200 })])
    expect(near[0]).toMatchObject({ kind: 'high52', label: '52주 고점 -4.0%' })
    const newHigh = detectSignals([agg({ currentPrice: 201, high52: 200 })])
    expect(newHigh[0].label).toBe('52주 신고가')
  })
  it('±3% 급등락만 잡는다', () => {
    const s = detectSignals([
      agg({ symbol: 'A', dayChangePct: 3.5 }),
      agg({ symbol: 'B', dayChangePct: -3.5, low52: 1 }),
      agg({ symbol: 'C', dayChangePct: 2.9 }),
    ])
    expect(s.map((x) => x.kind).sort()).toEqual(['plunge', 'surge'])
  })
  it('전환은 급등락보다 앞에 정렬된다', () => {
    const s = detectSignals([
      agg({ symbol: 'A', dayChangePct: 4 }),
      agg({ symbol: 'B', opProfit: 100, dayChange: 200, prevProfit: -100 }),
    ])
    expect(s[0].kind).toBe('flipGain')
  })
})

describe('dayReturnPercentile', () => {
  // 일별 등락 -1.0% ~ +1.0%가 고르게 섞인 30거래일 곡선
  const dailyPcts = Array.from({ length: 30 }, (_, i) => ((i % 21) - 10) * 0.1)
  const assets: number[] = [1_000_000]
  dailyPcts.forEach((p) => assets.push(assets[assets.length - 1] * (1 + p / 100)))
  const curve: EquityPoint[] = assets.map((a, i) => ({
    date: `07-${String(i + 1).padStart(2, '0')}`,
    value: 0,
    asset: a,
  }))
  it('평범한 상승일은 중간쯤(상위 ~50%)', () => {
    const r = dayReturnPercentile(curve, 0.1)
    expect(r).not.toBeNull()
    expect(r!.isUp).toBe(true)
    expect(r!.rankPct).toBeGreaterThan(20)
    expect(r!.rankPct).toBeLessThan(80)
  })
  it('큰 하락일은 하위 극단(작은 rankPct)', () => {
    const r = dayReturnPercentile(curve, -5)
    expect(r!.isUp).toBe(false)
    expect(r!.rankPct).toBeLessThan(10)
  })
  it('표본 20거래일 미만이면 null', () => {
    expect(dayReturnPercentile(curve.slice(0, 10), 1)).toBeNull()
  })
  it('asset 없는 곡선이면 null', () => {
    const noAsset = curve.map((p) => ({ ...p, asset: null }))
    expect(dayReturnPercentile(noAsset, 1)).toBeNull()
  })
})
