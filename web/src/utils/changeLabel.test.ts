import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { decideChangeLabel, formatPriceAsOfDate, splitUpdatedAt, formatUpdatedAtLine } from './changeLabel'

describe('decideChangeLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-05-18 (월) 09:00 KST 로 고정
    vi.setSystemTime(new Date('2026-05-18T00:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('priceAsOfDate 없음 → 최근', () => {
    expect(decideChangeLabel(undefined, true)).toBe('최근')
    expect(decideChangeLabel(null, true)).toBe('최근')
    expect(decideChangeLabel('', true)).toBe('최근')
  })

  it('비거래일(isTradingDay=false) → 최근 (priceAsOfDate가 오늘과 같아도)', () => {
    expect(decideChangeLabel('2026-05-18', false)).toBe('최근')
    expect(decideChangeLabel('2026-05-17', false)).toBe('최근')
  })

  it('priceAsOfDate === today → 오늘', () => {
    expect(decideChangeLabel('2026-05-18', true)).toBe('오늘')
  })

  it('priceAsOfDate === today-1 → 전일', () => {
    expect(decideChangeLabel('2026-05-17', true)).toBe('전일')
  })

  it('priceAsOfDate가 더 과거 → 최근', () => {
    expect(decideChangeLabel('2026-05-15', true)).toBe('최근')
    expect(decideChangeLabel('2026-05-01', true)).toBe('최근')
  })

  it('isTradingDay 누락(undefined)이면 기본 거래일 취급', () => {
    expect(decideChangeLabel('2026-05-18')).toBe('오늘')
    expect(decideChangeLabel('2026-05-15')).toBe('최근')
  })
})

describe('formatPriceAsOfDate', () => {
  it('유효 날짜 → "yyyy년 M월 d일 EEE요일"', () => {
    // 2026-05-15 = 금요일
    expect(formatPriceAsOfDate('2026-05-15')).toBe('2026년 5월 15일 금요일')
    // 2026-05-18 = 월요일
    expect(formatPriceAsOfDate('2026-05-18')).toBe('2026년 5월 18일 월요일')
  })

  it('형식 틀린 입력 → 빈 문자열', () => {
    expect(formatPriceAsOfDate('2026/05/15')).toBe('')
    expect(formatPriceAsOfDate('abc')).toBe('')
    expect(formatPriceAsOfDate('2026-5-15')).toBe('')
  })

  it('null/undefined/빈 → 빈 문자열', () => {
    expect(formatPriceAsOfDate(undefined)).toBe('')
    expect(formatPriceAsOfDate(null)).toBe('')
    expect(formatPriceAsOfDate('')).toBe('')
  })
})

describe('splitUpdatedAt', () => {
  it('"yyyy-MM-dd HH:mm" → 날짜(요일)/12시간제 시간', () => {
    // 2026-06-12 = 금요일, 09:15 → am 9:15
    expect(splitUpdatedAt('2026-06-12 09:15')).toEqual({ date: '2026-06-12(금)', time: 'am 9:15' })
    // 2026-06-18 = 목요일, 14:45 → pm 2:45
    expect(splitUpdatedAt('2026-06-18 14:45')).toEqual({ date: '2026-06-18(목)', time: 'pm 2:45' })
  })
  it('12시간제 경계 (자정/정오)', () => {
    expect(splitUpdatedAt('2026-06-18 00:30').time).toBe('am 12:30')
    expect(splitUpdatedAt('2026-06-18 12:00').time).toBe('pm 12:00')
  })
  it('초 포함이면 초는 버림', () => {
    expect(splitUpdatedAt('2026-06-12 09:15:30').time).toBe('am 9:15')
  })
  it('날짜만 있으면 시간 빈 문자열', () => {
    expect(splitUpdatedAt('2026-06-12')).toEqual({ date: '2026-06-12(금)', time: '' })
  })
  it('null/undefined/빈 → 둘 다 빈 문자열', () => {
    expect(splitUpdatedAt(undefined)).toEqual({ date: '', time: '' })
    expect(splitUpdatedAt(null)).toEqual({ date: '', time: '' })
    expect(splitUpdatedAt('')).toEqual({ date: '', time: '' })
  })
})

describe('formatUpdatedAtLine', () => {
  it('한 줄 "날짜(요일) 시간"', () => {
    expect(formatUpdatedAtLine('2026-06-18 14:45')).toBe('2026-06-18(목) pm 2:45')
    expect(formatUpdatedAtLine('2026-06-12 09:15')).toBe('2026-06-12(금) am 9:15')
  })
  it('날짜만 / 빈값', () => {
    expect(formatUpdatedAtLine('2026-06-18')).toBe('2026-06-18(목)')
    expect(formatUpdatedAtLine('')).toBe('')
    expect(formatUpdatedAtLine(null)).toBe('')
  })
})
