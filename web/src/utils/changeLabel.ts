// "오늘 변동" 라벨 결정 헬퍼
// 규칙:
//   priceAsOfDate === today (KST)              → "오늘"
//   today가 비거래일 (주말/공휴일)              → "최근"
//   priceAsOfDate === today - 1 (달력상 어제)   → "전일"
//   그 외                                        → "최근"

const HOLIDAYS = new Set<string>([
  '2025-01-01',
  '2025-01-28', '2025-01-29', '2025-01-30',
  '2025-03-01', '2025-05-01', '2025-05-05', '2025-06-06',
  '2025-08-15',
  '2025-10-03', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-09',
  '2025-12-25',
  '2026-01-01',
  '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-03-01', '2026-03-02',
  '2026-05-01', '2026-05-05', '2026-05-25',
  '2026-06-06', '2026-08-15',
  '2026-10-03', '2026-10-09',
  '2026-12-25', '2026-12-31',
])

function todayKstDate(): Date {
  // KST 기준 yyyy-MM-dd 추출 후 Date 객체로
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const s = fmt.format(new Date())  // "2026-05-15"
  return new Date(s + 'T00:00:00')
}

function isWeekendOrHoliday(d: Date): boolean {
  const day = d.getDay()
  if (day === 0 || day === 6) return true
  const pad = (n: number) => String(n).padStart(2, '0')
  const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return HOLIDAYS.has(s)
}

export type ChangeLabel = '오늘' | '전일' | '최근'

export function decideChangeLabel(priceAsOfDate?: string | null): ChangeLabel {
  if (!priceAsOfDate) return '최근'
  const today = todayKstDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  if (priceAsOfDate === todayStr) return '오늘'
  if (isWeekendOrHoliday(today)) return '최근'
  // 달력상 어제
  const ystdy = new Date(today)
  ystdy.setDate(ystdy.getDate() - 1)
  const ystdyStr = `${ystdy.getFullYear()}-${pad(ystdy.getMonth() + 1)}-${pad(ystdy.getDate())}`
  if (priceAsOfDate === ystdyStr) return '전일'
  return '최근'
}
