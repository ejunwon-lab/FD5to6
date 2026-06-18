// "오늘 변동" 라벨 결정 헬퍼
// 규칙 (위에서부터 우선):
//   isTradingDay === false (주말/공휴일)        → "최근"  ← 서버 판정 사용
//   priceAsOfDate === today (KST)              → "오늘"
//   priceAsOfDate === today - 1 (달력상 어제)   → "전일"
//   그 외                                        → "최근"
// 휴일 판정은 GAS(*휴장일* 시트) 단일 소스 — 클라이언트는 summary.isTradingDay 를 받아 씀.

function todayKstDate(): Date {
  // KST 기준 yyyy-MM-dd 추출 후 Date 객체로
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const s = fmt.format(new Date())  // "2026-05-15"
  return new Date(s + 'T00:00:00')
}

export type ChangeLabel = '오늘' | '전일' | '최근'

export function decideChangeLabel(
  priceAsOfDate?: string | null,
  isTradingDay?: boolean,
): ChangeLabel {
  if (!priceAsOfDate) return '최근'
  // 오늘이 거래일이 아니면(주말·공휴일) 어떤 priceAsOfDate든 "오늘"일 수 없음
  if (isTradingDay === false) return '최근'
  const today = todayKstDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  if (priceAsOfDate === todayStr) return '오늘'
  // 달력상 어제
  const ystdy = new Date(today)
  ystdy.setDate(ystdy.getDate() - 1)
  const ystdyStr = `${ystdy.getFullYear()}-${pad(ystdy.getMonth() + 1)}-${pad(ystdy.getDate())}`
  if (priceAsOfDate === ystdyStr) return '전일'
  return '최근'
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

// 수익 기준일 표시용: "2026-05-15" → "2026년 5월 15일 금요일"
export function formatPriceAsOfDate(priceAsOfDate?: string | null): string {
  if (!priceAsOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(priceAsOfDate)) return ''
  const [y, m, d] = priceAsOfDate.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return `${y}년 ${m}월 ${d}일 ${WEEKDAY_KO[wd]}요일`
}

// "마지막 갱신" 시각("yyyy-MM-dd HH:mm[:ss]")을 날짜/시간 2줄로 분리.
// 갱신·기존값 모두 GAS가 시트 저장 시각을 주므로 동일하게 표시됨.
export function splitUpdatedAt(updatedAt?: string | null): { date: string; time: string } {
  if (!updatedAt) return { date: '', time: '' }
  const [date, time = ''] = String(updatedAt).trim().split(/\s+/)
  return { date: date ?? '', time }
}
