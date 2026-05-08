export function krwCompact(value: number): string {
  return krwFull(value)
}

export function krwCompactSigned(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return sign + krwCompact(value)
}

export function krwFull(value: number): string {
  return Math.round(value).toLocaleString('ko-KR')
}

export function pctFormatted(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return sign + value.toFixed(2) + '%'
}

export function normalizeChangePct(raw: string): string {
  if (!raw) return '0%'
  const trimmed = raw.trim()
  if (trimmed === '0%' || trimmed === '0.00%') return '0%'
  return trimmed.startsWith('+') || trimmed.startsWith('-') ? trimmed : '+' + trimmed
}

export function isProfit(value: number): boolean {
  return value >= 0
}

export function profitTextClass(value: number): string {
  return value >= 0 ? 'text-profit' : 'text-loss'
}

export function profitBgClass(value: number): string {
  return value >= 0 ? 'bg-profit' : 'bg-loss'
}

export function holdingDays(buyDate?: string): number {
  if (!buyDate) return 0
  const buy = new Date(buyDate)
  const today = new Date()
  return Math.floor((today.getTime() - buy.getTime()) / (1000 * 60 * 60 * 24))
}

export function holdingDurationText(buyDate?: string): string | null {
  const days = holdingDays(buyDate)
  if (days <= 0) return null
  const months = Math.floor(days / 30)
  const rem = days % 30
  if (months === 0) return `${days}일`
  if (rem === 0) return `${months}개월`
  return `${months}개월 ${rem}일`
}

export function annualizedReturn(profitRate: number, buyDate?: string): number {
  const days = holdingDays(buyDate)
  if (days <= 0) return 0
  return (profitRate / days) * 365
}

export function position52w(current: number, low52: number, high52: number): number {
  if (high52 <= low52) return 50
  return ((current - low52) / (high52 - low52)) * 100
}
