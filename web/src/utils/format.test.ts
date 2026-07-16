import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  krwFull, krwCompact, krwCompactSigned, pctFormatted, normalizeChangePct,
  isProfit, position52w, holdingDays, holdingDurationText, annualizedReturn,
  profitTextClass, profitBgClass,
} from './format'

describe('krwFull / krwCompact', () => {
  it('정수 콤마 표시', () => {
    expect(krwFull(12345)).toBe('12,345')
    expect(krwFull(1000000)).toBe('1,000,000')
    expect(krwFull(0)).toBe('0')
  })
  it('음수', () => {
    expect(krwFull(-1234)).toBe('-1,234')
  })
  it('소수점 반올림', () => {
    expect(krwFull(1234.7)).toBe('1,235')
    expect(krwFull(1234.4)).toBe('1,234')
  })
  it('krwCompact == krwFull', () => {
    expect(krwCompact(12345)).toBe(krwFull(12345))
  })
})

describe('krwCompactSigned', () => {
  it('양수에 + 부호', () => {
    expect(krwCompactSigned(1000)).toBe('+1,000')
  })
  it('0도 + 부호 (value >= 0)', () => {
    expect(krwCompactSigned(0)).toBe('+0')
  })
  it('음수는 부호 없이 마이너스만', () => {
    expect(krwCompactSigned(-1000)).toBe('-1,000')
  })
})

describe('pctFormatted', () => {
  it('+/- 부호 + 소수 2자리', () => {
    expect(pctFormatted(1.234)).toBe('+1.23%')
    expect(pctFormatted(-1.234)).toBe('-1.23%')
    expect(pctFormatted(0)).toBe('+0.00%')
  })
})

describe('normalizeChangePct', () => {
  it('0% 패턴은 그대로', () => {
    expect(normalizeChangePct('0%')).toBe('0%')
    expect(normalizeChangePct('0.00%')).toBe('0%')
  })
  it('부호 있으면 trim만', () => {
    expect(normalizeChangePct('+1.23%')).toBe('+1.23%')
    expect(normalizeChangePct('-1.23%')).toBe('-1.23%')
    expect(normalizeChangePct(' +1.23% ')).toBe('+1.23%')
  })
  it('부호 없으면 + 붙임', () => {
    expect(normalizeChangePct('1.23%')).toBe('+1.23%')
  })
  it('빈 입력 → 0%', () => {
    expect(normalizeChangePct('')).toBe('0%')
  })
})

describe('isProfit', () => {
  it('0 이상은 이익', () => {
    expect(isProfit(0)).toBe(true)
    expect(isProfit(1)).toBe(true)
  })
  it('음수는 손실', () => {
    expect(isProfit(-1)).toBe(false)
  })
})

describe('position52w', () => {
  it('low~high 사이의 위치를 0~100으로', () => {
    expect(position52w(50, 0, 100)).toBe(50)
    expect(position52w(0, 0, 100)).toBe(0)
    expect(position52w(100, 0, 100)).toBe(100)
    expect(position52w(75, 50, 100)).toBe(50)
  })
  it('high<=low 엣지 → 50', () => {
    expect(position52w(50, 50, 50)).toBe(50)
    expect(position52w(50, 100, 50)).toBe(50)
  })
})

// ── 날짜 의존 함수: 시스템 시각 고정으로 결정적 검증 (2026-07-16 테스트 공백 채움) ──
describe('holdingDays / holdingDurationText / annualizedReturn (시각 고정)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T12:00:00+09:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('holdingDays: 경과 일수 계산', () => {
    expect(holdingDays('2026-07-15')).toBe(1)
    expect(holdingDays('2026-06-16')).toBe(30)
    expect(holdingDays('2025-07-16')).toBe(365)
  })
  it('holdingDays: buyDate 없거나 미래면 0 이하', () => {
    expect(holdingDays(undefined)).toBe(0)
    expect(holdingDays('2026-07-20')).toBeLessThanOrEqual(0)
  })

  it('holdingDurationText: 일 → 개월+일 단계 표기', () => {
    expect(holdingDurationText('2026-07-01')).toBe('15일')          // 30일 미만
    expect(holdingDurationText('2026-06-16')).toBe('1개월')          // 정확히 30일
    expect(holdingDurationText('2026-05-02')).toBe('2개월 15일')     // 75일 = 2*30+15
  })
  it('holdingDurationText: buyDate 없으면 null', () => {
    expect(holdingDurationText(undefined)).toBeNull()
    expect(holdingDurationText('')).toBeNull()
  })

  it('annualizedReturn: (수익률/보유일)×365', () => {
    expect(annualizedReturn(10, '2025-07-16')).toBeCloseTo(10, 5)   // 365일 보유 +10% → 연환산 +10%
    expect(annualizedReturn(10, '2026-06-16')).toBeCloseTo((10 / 30) * 365, 5) // 30일 +10% → +121.67%
    expect(annualizedReturn(-3, '2026-07-01')).toBeCloseTo((-3 / 15) * 365, 5) // 손실도 동일 공식
  })
  it('annualizedReturn: buyDate 없으면 0', () => {
    expect(annualizedReturn(10, undefined)).toBe(0)
  })
})

describe('profitTextClass / profitBgClass', () => {
  it('0 이상 profit, 음수 loss', () => {
    expect(profitTextClass(0)).toBe('text-profit')
    expect(profitTextClass(-1)).toBe('text-loss')
    expect(profitBgClass(1)).toBe('bg-profit')
    expect(profitBgClass(-1)).toBe('bg-loss')
  })
})
