// 표시 규칙: 숫자 축약(억/만/M/K) 금지 — 항상 풀 표기 (memory: feedback_number_display)
export function fmtKRW(n: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && n > 0 ? '+' : ''
  return `${sign}₩${Math.round(n).toLocaleString('en-US')}`
}

export function fmtPct(n: number, opts: { signed?: boolean; digits?: number } = {}): string {
  const digits = opts.digits ?? 2
  const sign = opts.signed && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
