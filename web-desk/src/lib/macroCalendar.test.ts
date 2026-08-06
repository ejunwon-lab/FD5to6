import { describe, expect, it } from 'vitest'
import { dDay, expiryEvents, nthWeekdayOfMonth, upcomingEvents } from './macroCalendar'

describe('nthWeekdayOfMonth', () => {
  it('2026-09 둘째 목요일 = 9/10, 셋째 금요일 = 9/18', () => {
    expect(nthWeekdayOfMonth(2026, 9, 4, 2)).toBe('2026-09-10')
    expect(nthWeekdayOfMonth(2026, 9, 5, 3)).toBe('2026-09-18')
  })
  it('2026-12 둘째 목요일 = 12/10, 셋째 금요일 = 12/18', () => {
    expect(nthWeekdayOfMonth(2026, 12, 4, 2)).toBe('2026-12-10')
    expect(nthWeekdayOfMonth(2026, 12, 5, 3)).toBe('2026-12-18')
  })
})

describe('expiryEvents', () => {
  it('연 8건 (분기 4 × KR/US 2)', () => {
    expect(expiryEvents(2026)).toHaveLength(8)
  })
})

describe('upcomingEvents', () => {
  it('2026-08-06 기준 첫 이벤트는 8/12 CPI, 당일 이벤트 포함', () => {
    const list = upcomingEvents('2026-08-06', 3)
    expect(list[0]).toMatchObject({ date: '2026-08-12', kind: 'cpi' })
    const onDay = upcomingEvents('2026-08-12', 1)
    expect(onDay[0].date).toBe('2026-08-12')
  })
  it('날짜 오름차순 + limit 준수', () => {
    const list = upcomingEvents('2026-08-06', 6)
    expect(list).toHaveLength(6)
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    expect(list).toEqual(sorted)
  })
  it('연말 기준이면 이듬해 만기(규칙 계산)로 이어진다', () => {
    const list = upcomingEvents('2026-12-20', 2)
    expect(list[0]).toMatchObject({ date: '2027-03-11', name: 'KR 선물옵션 동시만기' })
  })
})

describe('dDay', () => {
  it('당일 0, 6일 뒤 6', () => {
    expect(dDay('2026-08-06', '2026-08-06')).toBe(0)
    expect(dDay('2026-08-06', '2026-08-12')).toBe(6)
  })
})
