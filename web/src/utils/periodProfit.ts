import type { TrendEntry } from '../models/types'

// 기간별 '번 돈' = 추이(합계수익 AD) 양끝 차이.
// entries[].totalProfit = 확정(실현)누적 + 평가손익 → 기간 diff에 실현이익이 자동 포함된다.
// 기준 시점(anchor)은 데이터의 마지막 날짜(=priceAsOfDate)로 삼아 벽시계·주말 드리프트를 피한다.

export interface PeriodProfitTile {
  key: string
  label: string
  amount: number | null // null = 데이터 부족(기준일 없음)
}

// 'yyyy-MM-dd' → Date (로컬), 앞 10자만 사용
function parseYmd(s: string): Date | null {
  const m = String(s || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function shiftDays(ymd: string, days: number): string {
  const d = parseYmd(ymd)!
  d.setDate(d.getDate() + days)
  return toYmd(d)
}

function shiftMonths(ymd: string, months: number): string {
  const d = parseYmd(ymd)!
  d.setMonth(d.getMonth() + months)
  return toYmd(d)
}

// 기준값: date <= target 인 것 중 가장 최근. 없으면 가장 오래된 entry(데이터 시작).
// entries는 날짜 오름차순 가정.
// ⚠️ "올해" 타일 정확성은 서버 계약에 기댄다: newMobileGetProfitHistory(MobileAPI.js)가
// 윈도를 "최소 180거래일 + 전년 12/1까지"로 보장해야 YTD baseline(전년 마지막 거래일)이
// 항상 존재한다. 서버가 다시 고정 slice로 줄이면 fallback이 조용히 "윈도 시작 이후"를 만든다.
function pickBaseline(entries: TrendEntry[], targetYmd: string): TrendEntry | null {
  if (entries.length === 0) return null
  let baseline: TrendEntry | null = null
  for (const e of entries) {
    const d = String(e.date).slice(0, 10)
    if (d <= targetYmd) baseline = e
    else break
  }
  return baseline ?? entries[0]
}

// 1주 / 1개월 / YTD 번 돈. entries가 비면 전부 null.
export function computePeriodProfits(entries: TrendEntry[]): PeriodProfitTile[] {
  const specs: { key: string; label: string; target: (anchor: string) => string }[] = [
    { key: '1w', label: '1주', target: a => shiftDays(a, -7) },
    { key: '1m', label: '1개월', target: a => shiftMonths(a, -1) },
    { key: 'ytd', label: '올해', target: a => `${a.slice(0, 4)}-01-01` },
  ]

  const valid = entries.filter(e => parseYmd(String(e.date)) !== null)
  if (valid.length === 0) {
    return specs.map(s => ({ key: s.key, label: s.label, amount: null }))
  }

  const anchorEntry = valid[valid.length - 1]
  const anchor = String(anchorEntry.date).slice(0, 10)
  const latest = anchorEntry.totalProfit

  return specs.map(s => {
    const targetYmd = s.target(anchor)
    const baseline = pickBaseline(valid, targetYmd)
    // 기준일이 anchor와 같으면(데이터가 anchor 하나뿐) 기간 산출 불가
    if (!baseline || String(baseline.date).slice(0, 10) === anchor) {
      return { key: s.key, label: s.label, amount: null }
    }
    return { key: s.key, label: s.label, amount: latest - baseline.totalProfit }
  })
}
