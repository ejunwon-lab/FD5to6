import { describe, it, expect } from 'vitest'
import { isPensionAccount, shortBroker, computeAccountTypeBreakdown } from './accountType'
import type { Holding } from './types'
import type { CashReserve, NonStockAssets } from '../api/gasApi'

// 익명화된 합성 픽스처 (실제 금액 아님, 합산 관계만 유지 — web assetAllocation.test.ts와 동일 규칙)
const holdings = [
  { accountType: '종합_랩', broker: '미래에셋투자증권', value: 200000000 },
  { accountType: 'ISA', broker: '삼성증권', value: 90000000 },
  { accountType: '종합', broker: '삼성증권', value: 50000000 },
  { accountType: '퇴직연금_개인IRP(범용)', broker: '삼성증권', value: 40000000 },
  { accountType: '퇴직연금_개인IRP', broker: '미래에셋투자증권', value: 38000000 },
] as Holding[]

const cashReserve: CashReserve = {
  total: 67165000,
  items: [
    { broker: '미래애셋투자증권', account: '종합_랩', amount: 50000 },
    { broker: '미래애셋투자증권', account: '퇴직연금_개인IRP', amount: 45000000 },
    { broker: '삼성증권', account: '종합', amount: 100000 },
    { broker: '삼성증권', account: 'ISA', amount: 20000000 },
    { broker: '삼성증권', account: '퇴직연금(다이렉트IRP)', amount: 15000 },
    { broker: '삼성증권', account: 'CMA', amount: 2000000 },
  ],
}

const nonStock: NonStockAssets = {
  total: 4873525,
  items: [
    { category: '예금', name: '정기예금', broker: '삼성증권', account: '퇴직연금_개인IRP(범용)', value: 4873525 },
  ] as NonStockAssets['items'],
}

describe('분류 규칙', () => {
  it('퇴직/IRP 포함 → 퇴직연금, ISA·CMA·종합은 일반', () => {
    expect(isPensionAccount('퇴직연금_개인IRP')).toBe(true)
    expect(isPensionAccount('퇴직연금(다이렉트IRP)')).toBe(true)
    expect(isPensionAccount('ISA')).toBe(false)
    expect(isPensionAccount('종합_랩')).toBe(false)
    expect(isPensionAccount('CMA')).toBe(false)
  })
  it('증권사 앞 2글자 (에/애 오타 흡수)', () => {
    expect(shortBroker('미래에셋투자증권')).toBe('미래')
    expect(shortBroker('미래애셋투자증권')).toBe('미래')
    expect(shortBroker('삼성증권')).toBe('삼성')
  })
})

describe('computeAccountTypeBreakdown', () => {
  const b = computeAccountTypeBreakdown(holdings, cashReserve, nonStock)

  it('총자산 = 주식 + 현금성 + 비주식 (대기중 포함 기준)', () => {
    expect(b.total).toBe(418000000 + 67165000 + 4873525)
  })

  it('그룹 순서: 일반 투자 → 퇴직연금, 합계 정합', () => {
    expect(b.groups.map((g) => g.label)).toEqual(['일반 투자', '퇴직연금'])
    const sum = b.groups.reduce((s, g) => s + g.amount, 0)
    expect(sum).toBe(b.total)
  })

  it('일반 투자 = 랩+ISA+종합+CMA (주식+현금)', () => {
    const general = b.groups[0]
    // 미래: 200M(랩) + 0.05M(현금) / 삼성: 90+50M(주식) + 0.1+20+2M(현금)
    expect(general.amount).toBe(200050000 + 162100000)
    const mirae = general.brokers.find((x) => x.broker === '미래')!
    expect(mirae.amount).toBe(200050000)
  })

  it('퇴직연금 = IRP 주식+현금+비주식(예금)', () => {
    const pension = b.groups[1]
    // 미래 IRP: 38M(주식)+45M(현금) / 삼성 IRP: 40M(주식)+0.015M(현금)+4.873525M(예금)
    expect(pension.amount).toBe(38000000 + 45000000 + 40000000 + 15000 + 4873525)
  })

  it('pct 합 ≈ 100', () => {
    const pctSum = b.groups.reduce((s, g) => s + g.pct, 0)
    expect(pctSum).toBeCloseTo(100, 5)
  })

  it('빈 입력 안전', () => {
    const empty = computeAccountTypeBreakdown([], null, null)
    expect(empty.total).toBe(0)
    expect(empty.groups[0].pct).toBe(0)
  })
})
