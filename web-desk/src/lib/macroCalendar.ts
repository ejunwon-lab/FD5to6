// 매크로 이벤트 캘린더 — 외부 API 없이 공표 일정(정적) + 규칙 계산(만기일).
// 고정 일정 검증 소스 (2026-08-06 웹 검증 — 암기 기입 금지 원칙):
//  - FOMC: federalreserve.gov 회의 캘린더 (잔여 2026: 9/15-16·10/27-28·12/8-9, 결과 발표는 2일차 현지 14:00)
//  - CPI: BLS 공표 일정 재게시(usinflationcalculator.com) — 8/12·9/11·10/14·11/10·12/10 (현지 08:30)
//  - 금통위 통방: 한국은행 2025-10-30 보도자료 (잔여 2026: 8/27·10/22·11/26)
// 만기일은 거래소 규칙으로 계산: KR 선물옵션 동시만기 3·6·9·12월 둘째 목요일, US 트리플위칭 셋째 금요일.
// ⚠️ 연도가 바뀌면 FIXED_EVENTS에 새해 공표 일정을 웹 검증 후 추가할 것.

export type MacroKind = 'fomc' | 'cpi' | 'bok' | 'expiry'

export interface MacroEvent {
  date: string   // YYYY-MM-DD (발표/만기 당일, 현지 기준)
  name: string
  kind: MacroKind
}

const FIXED_EVENTS: MacroEvent[] = [
  // FOMC 결과 발표일 (회의 2일차, 현지)
  { date: '2026-09-16', name: 'FOMC 금리 발표', kind: 'fomc' },
  { date: '2026-10-28', name: 'FOMC 금리 발표', kind: 'fomc' },
  { date: '2026-12-09', name: 'FOMC 금리 발표', kind: 'fomc' },
  // 미국 CPI 발표일 (현지 08:30)
  { date: '2026-08-12', name: '미국 CPI (7월분)', kind: 'cpi' },
  { date: '2026-09-11', name: '미국 CPI (8월분)', kind: 'cpi' },
  { date: '2026-10-14', name: '미국 CPI (9월분)', kind: 'cpi' },
  { date: '2026-11-10', name: '미국 CPI (10월분)', kind: 'cpi' },
  { date: '2026-12-10', name: '미국 CPI (11월분)', kind: 'cpi' },
  // 한국은행 금통위 통화정책방향 결정회의
  { date: '2026-08-27', name: '금통위 기준금리 결정', kind: 'bok' },
  { date: '2026-10-22', name: '금통위 기준금리 결정', kind: 'bok' },
  { date: '2026-11-26', name: '금통위 기준금리 결정', kind: 'bok' },
]

/** year-month(1~12)의 n번째 weekday(0=일…6=토) 날짜를 YYYY-MM-DD로 */
export function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(year, month - 1, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  const day = 1 + offset + (n - 1) * 7
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 해당 연도의 만기 이벤트 — KR 동시만기(3·6·9·12월 둘째 목) + US 트리플위칭(셋째 금) */
export function expiryEvents(year: number): MacroEvent[] {
  const out: MacroEvent[] = []
  ;[3, 6, 9, 12].forEach((m) => {
    out.push({ date: nthWeekdayOfMonth(year, m, 4, 2), name: 'KR 선물옵션 동시만기', kind: 'expiry' })
    out.push({ date: nthWeekdayOfMonth(year, m, 5, 3), name: 'US 트리플위칭 만기', kind: 'expiry' })
  })
  return out
}

/** fromDate(YYYY-MM-DD) 이후(당일 포함) 다가오는 이벤트, 날짜순 limit개 */
export function upcomingEvents(fromDate: string, limit = 6): MacroEvent[] {
  const year = Number(fromDate.slice(0, 4))
  const all = [...FIXED_EVENTS, ...expiryEvents(year), ...expiryEvents(year + 1)]
  return all
    .filter((e) => e.date >= fromDate)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, limit)
}

/** fromDate 기준 D-day (당일 = 0) */
export function dDay(fromDate: string, eventDate: string): number {
  const from = new Date(fromDate + 'T00:00:00')
  const to = new Date(eventDate + 'T00:00:00')
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}
