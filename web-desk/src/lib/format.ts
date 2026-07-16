// 표시 규칙: 숫자 축약(억/만/M/K) 금지 — 항상 풀 표기 (memory: feedback_number_display)
// 로케일: web(utils/format.ts)과 동일하게 ko-KR — 두 앱 표기 통일 (2026-07-16 드리프트 정리)
export function fmtKRW(n: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && n > 0 ? '+' : ''
  return `${sign}₩${Math.round(n).toLocaleString('ko-KR')}`
}

export function fmtPct(n: number, opts: { signed?: boolean; digits?: number } = {}): string {
  const digits = opts.digits ?? 2
  const sign = opts.signed && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

// 52주 밴드 내 현재가 위치 0~100. web(utils/format.ts position52w)과 동일 공식 — 두 앱 공용 규약
export function position52w(current: number, low52: number, high52: number): number {
  if (high52 <= low52) return 50
  return ((current - low52) / (high52 - low52)) * 100
}
