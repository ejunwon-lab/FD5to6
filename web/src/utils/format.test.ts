import { describe, it, expect } from 'vitest'
import {
  krwFull, krwCompact, krwCompactSigned, pctFormatted, normalizeChangePct,
  isProfit, position52w, holdingDurationText, annualizedReturn,
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

describe('holdingDurationText', () => {
  it('buyDate 없으면 null', () => {
    expect(holdingDurationText(undefined)).toBeNull()
    expect(holdingDurationText('')).toBeNull()
  })
})

describe('annualizedReturn', () => {
  it('buyDate 없으면 0', () => {
    expect(annualizedReturn(10, undefined)).toBe(0)
  })
})
