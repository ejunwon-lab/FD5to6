export function fmtKRW(n: number, opts: { signed?: boolean; compact?: boolean } = {}): string {
  const sign = opts.signed && n > 0 ? '+' : ''
  if (opts.compact) {
    if (Math.abs(n) >= 1e8) return `${sign}${(n / 1e8).toFixed(2)}억`
    if (Math.abs(n) >= 1e4) return `${sign}${(n / 1e4).toFixed(0)}만`
  }
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

export function shortKRW(n: number): string {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}억`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}만`
  return n.toLocaleString('en-US')
}
