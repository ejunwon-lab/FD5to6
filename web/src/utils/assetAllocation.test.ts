import { describe, it, expect } from 'vitest'
import {
  isPensionAccount,
  shortBroker,
  computeAssetAllocation,
  computeAccountTypeBreakdown,
} from './assetAllocation'
import type { PortfolioResponse } from '../models/types'

// 익명화된 합성 픽스처(실제 금액 아님, 합산 관계만 유지)
const p: PortfolioResponse = {
  success: true,
  summary: { totalCurrent: 418000000 } as PortfolioResponse['summary'] as never,
  holdings: [
    { accountType: '종합_랩', broker: '미래에셋투자증권', opCurrent: 200000000 },
    { accountType: 'ISA', broker: '삼성증권', opCurrent: 90000000 },
    { accountType: '종합', broker: '삼성증권', opCurrent: 50000000 },
    { accountType: '퇴직연금_개인IRP(범용)', broker: '삼성증권', opCurrent: 40000000 },
    { accountType: '퇴직연금_개인IRP', broker: '미래에셋투자증권', opCurrent: 38000000 },
  ] as PortfolioResponse['holdings'] as never,
  nonStockAssets: { items: [], total: 0 },
  cashReserve: {
    total: 67165000,
    items: [
      { broker: '미래애셋투자증권', account: '종합_랩', amount: 50000 },
      { broker: '미래애셋투자증권', account: '퇴직연금_개인IRP', amount: 45000000 },
      { broker: '삼성증권', account: '종합', amount: 100000 },
      { broker: '삼성증권', account: 'ISA', amount: 20000000 },
      { broker: '삼성증권', account: '퇴직연금(다이렉트IRP)', amount: 15000 },
      { broker: '삼성증권', account: 'CMA', amount: 2000000 },
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
    expect(a.invested).toBe(418000000)
    expect(a.idle).toBe(67165000)
    expect(a.total).toBe(485165000)
    expect(a.idlePct).toBeCloseTo(13.84, 1)
  })
  it('null 안전', () => {
    expect(computeAssetAllocation(null)).toEqual({ invested: 0, idle: 0, total: 0, idlePct: 0 })
  })
})

describe('계좌 유형별', () => {
  const b = computeAccountTypeBreakdown(p)
  it('합계 = 총자산', () => {
    expect(b.total).toBe(485165000)
  })
  it('순서: 일반 투자 먼저', () => {
    expect(b.groups.map(g => g.label)).toEqual(['일반 투자', '퇴직연금'])
  })
  it('일반 투자: 삼성은 계좌별 분리(종합/ISA/CMA), 미래는 단일계좌라 증권사명만', () => {
    const g = b.groups[0]
    expect(g.amount).toBe(362150000)
    // 금액 내림차순: 미래 > 삼성 ISA > 삼성 종합 > 삼성 CMA
    expect(g.brokers.map(x => x.broker)).toEqual(['미래', '삼성 ISA', '삼성 종합', '삼성 CMA'])
    expect(g.brokers[0].amount).toBe(200050000) // 미래 종합_랩 = 투자+대기
    expect(g.brokers[1].amount).toBe(110000000) // 삼성 ISA = 투자+대기
    expect(g.brokers[2].amount).toBe(50100000)  // 삼성 종합 = 투자+대기
    expect(g.brokers[3].amount).toBe(2000000)   // 삼성 CMA = 대기
  })
  it('퇴직연금: 증권사 단위(미래 > 삼성)', () => {
    const g = b.groups[1]
    expect(g.amount).toBe(123015000)
    expect(g.brokers[0].amount).toBe(83000000) // 미래 = 투자+대기
    expect(g.brokers[1].amount).toBe(40015000) // 삼성 = 투자+대기
  })
  it('비중 합 100%', () => {
    const sum = b.groups.reduce((s, g) => s + g.pct, 0)
    expect(sum).toBeCloseTo(100, 5)
  })
})
