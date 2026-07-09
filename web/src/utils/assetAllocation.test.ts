import { describe, it, expect } from 'vitest'
import {
  isPensionAccount,
  shortBroker,
  computeAssetAllocation,
  computeAccountTypeBreakdown,
} from './assetAllocation'
import type { PortfolioResponse } from '../models/types'

// 실제 시트 수치를 축약한 픽스처
const p: PortfolioResponse = {
  success: true,
  summary: { totalCurrent: [금액] } as PortfolioResponse['summary'] as never,
  holdings: [
    { accountType: '종합_랩', broker: '미래에셋투자증권', opCurrent: [금액] },
    { accountType: 'ISA', broker: '삼성증권', opCurrent: [금액] },
    { accountType: '종합', broker: '삼성증권', opCurrent: [금액] },
    { accountType: '퇴직연금_개인IRP(범용)', broker: '삼성증권', opCurrent: [금액] },
    { accountType: '퇴직연금_개인IRP', broker: '미래에셋투자증권', opCurrent: [금액] },
  ] as PortfolioResponse['holdings'] as never,
  nonStockAssets: { items: [], total: 0 },
  cashReserve: {
    total: [금액],
    items: [
      { broker: '미래애셋투자증권', account: '종합_랩', amount: [금액] },
      { broker: '미래애셋투자증권', account: '퇴직연금_개인IRP', amount: [금액] },
      { broker: '삼성증권', account: '종합', amount: [금액] },
      { broker: '삼성증권', account: 'ISA', amount: [금액] },
      { broker: '삼성증권', account: '퇴직연금(다이렉트IRP)', amount: [금액] },
      { broker: '삼성증권', account: 'CMA', amount: [금액] },
    ],
  },
}

describe('분류 규칙', () => {
  it('퇴직/IRP 포함 → 퇴직연금', () => {
    expect(isPensionAccount('퇴직연금_개인IRP')).toBe(true)
    expect(isPensionAccount('퇴직연금(다이렉트IRP)')).toBe(true)
    expect(isPensionAccount('ISA')).toBe(false) // ISA는 일반
    expect(isPensionAccount('종합_랩')).toBe(false)
    expect(isPensionAccount('CMA')).toBe(false)
  })
  it('증권사 앞 2글자 (에/애 오타 흡수)', () => {
    expect(shortBroker('미래에셋투자증권')).toBe('미래')
    expect(shortBroker('미래애셋투자증권')).toBe('미래')
    expect(shortBroker('삼성증권')).toBe('삼성')
  })
})

describe('자산 배분', () => {
  it('투자중/대기중/총자산/노는돈%', () => {
    const a = computeAssetAllocation(p)
    expect(a.invested).toBe([금액])
    expect(a.idle).toBe([금액])
    expect(a.total).toBe([금액])
    expect(a.idlePct).toBeCloseTo(14.36, 1)
  })
  it('null 안전', () => {
    expect(computeAssetAllocation(null)).toEqual({ invested: 0, idle: 0, total: 0, idlePct: 0 })
  })
})

describe('계좌 유형별', () => {
  const b = computeAccountTypeBreakdown(p)
  it('합계 = 총자산', () => {
    expect(b.total).toBe([금액])
  })
  it('순서: 일반 투자 먼저', () => {
    expect(b.groups.map(g => g.label)).toEqual(['일반 투자', '퇴직연금'])
  })
  it('일반 투자 = 381,164,069 (미래 > 삼성)', () => {
    const g = b.groups[0]
    expect(g.amount).toBe([금액])
    expect(g.brokers.map(x => x.broker)).toEqual(['미래', '삼성'])
    expect(g.brokers[0].amount).toBe([금액]) // 미래: 투자 212,423,750 + 대기 52,796
    expect(g.brokers[1].amount).toBe([금액]) // 삼성: 종합+ISA+CMA (투자+대기)
  })
  it('퇴직연금 = 129,616,380 (미래 88.5M > 삼성 41.1M)', () => {
    const g = b.groups[1]
    expect(g.amount).toBe([금액])
    expect(g.brokers[0].amount).toBe([금액]) // 미래: 40,598,550 + 47,909,381
    expect(g.brokers[1].amount).toBe([금액]) // 삼성: 41,092,235 + 16,214
  })
  it('비중 합 100%', () => {
    const sum = b.groups.reduce((s, g) => s + g.pct, 0)
    expect(sum).toBeCloseTo(100, 5)
  })
})
