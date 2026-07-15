import { describe, it, expect } from 'vitest'
import { computePeriodProfits } from './periodProfit'
import type { TrendEntry } from '../models/types'

// anchor = 마지막 날짜(2026-07-15). totalProfit = 확정누적 + 평가.
// 2026-07-14는 '매도일'로 800→1000 점프(실현이익 편입) — 기간 diff에 포함돼야 함.
const entries: TrendEntry[] = [
  { date: '2026-01-11', totalProfit: 100 },  // 데이터 시작(YTD 기준)
  { date: '2026-06-15', totalProfit: 500 },  // 1개월 기준(07-15 − 1M = 06-15)
  { date: '2026-07-08', totalProfit: 800 },  // 1주 기준(07-15 − 7d = 07-08)
  { date: '2026-07-14', totalProfit: 1000 }, // 매도일 실현 점프
  { date: '2026-07-15', totalProfit: 1200 }, // anchor
]

describe('computePeriodProfits', () => {
  it('1주/1개월/올해 번 돈 = 합계수익 양끝 차이', () => {
    const [w, m, y] = computePeriodProfits(entries)
    expect(w.label).toBe('1주')
    expect(w.amount).toBe(400)   // 1200 − 800
    expect(m.label).toBe('1개월')
    expect(m.amount).toBe(700)   // 1200 − 500
    expect(y.label).toBe('올해')
    expect(y.amount).toBe(1100)  // 1200 − 100 (YTD 기준=데이터 시작)
  })

  it('실현이익(매도일 점프)이 기간 diff에 포함된다', () => {
    // 1주 창(07-08~07-15) 안에 07-14 매도 점프(200)가 있음.
    // 400 = 평가변동(07-08→07-14 전 200 + 07-14→07-15 200) + 실현편입.
    // 핵심: totalProfit이 확정누적을 담으므로 diff가 실현을 자동 포함 → 별도 처리 불필요.
    const [w] = computePeriodProfits(entries)
    expect(w.amount).toBe(400)
  })

  it('기준일이 두 entry 사이면 그 이전 최근 entry를 기준으로', () => {
    // target(07-10)과 정확히 일치하는 행이 없어도 07-08을 기준으로 잡아야 함
    const e: TrendEntry[] = [
      { date: '2026-07-08', totalProfit: 800 },
      { date: '2026-07-14', totalProfit: 1000 },
      { date: '2026-07-15', totalProfit: 1200 }, // anchor → 1주 target=07-08
    ]
    const [w] = computePeriodProfits(e)
    expect(w.amount).toBe(400) // 1200 − 800
  })

  it('데이터가 anchor 하나뿐이면 null(기간 산출 불가)', () => {
    const one: TrendEntry[] = [{ date: '2026-07-15', totalProfit: 1200 }]
    const tiles = computePeriodProfits(one)
    expect(tiles.every(t => t.amount === null)).toBe(true)
  })

  it('빈 배열이면 전부 null', () => {
    const tiles = computePeriodProfits([])
    expect(tiles.map(t => t.amount)).toEqual([null, null, null])
    expect(tiles.map(t => t.label)).toEqual(['1주', '1개월', '올해'])
  })

  it('음수(손실) 기간도 정확히 계산', () => {
    const e: TrendEntry[] = [
      { date: '2026-07-08', totalProfit: 1000 },
      { date: '2026-07-15', totalProfit: 600 }, // anchor
    ]
    const [w] = computePeriodProfits(e)
    expect(w.amount).toBe(-400)
  })
})
