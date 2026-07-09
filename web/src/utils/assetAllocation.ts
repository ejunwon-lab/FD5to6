import type { PortfolioResponse } from '../models/types'

// 계좌명에 '퇴직' 또는 'IRP' 포함 → 퇴직연금, 그 외 → 일반. ISA는 일반.
export function isPensionAccount(account: string): boolean {
  const s = String(account || '')
  return s.indexOf('퇴직') !== -1 || s.toUpperCase().indexOf('IRP') !== -1
}

// 증권사 앞 2글자 (미래에셋투자증권/미래애셋투자증권 → 미래, 삼성증권 → 삼성)
export function shortBroker(broker: string): string {
  return String(broker || '').slice(0, 2)
}

export interface AssetAllocation {
  invested: number   // 투자중 = 보유현황 평가금액 합(summary.totalCurrent)
  idle: number       // 대기중 = 설정 대기자금(cashReserve.total)
  total: number      // 총자산 = 투자중 + 대기중
  idlePct: number    // 대기중 비중 (%) — "노는 돈" 비율
}

// 자산 배분: 투자중 / 대기중 / 총자산
export function computeAssetAllocation(p: PortfolioResponse | null): AssetAllocation {
  const invested = p?.summary?.totalCurrent ?? 0
  const idle = p?.cashReserve?.total ?? 0
  const total = invested + idle
  return { invested, idle, total, idlePct: total > 0 ? (idle / total) * 100 : 0 }
}

export interface BrokerSlice { broker: string; amount: number; pct: number }
export interface TypeGroup { label: string; amount: number; pct: number; brokers: BrokerSlice[] }
export interface AccountTypeBreakdown { groups: TypeGroup[]; total: number }

// 계좌 유형별: 일반 투자 / 퇴직연금 (각 증권사별). 총자산(투자중+대기중) 기준.
export function computeAccountTypeBreakdown(p: PortfolioResponse | null): AccountTypeBreakdown {
  const agg: Record<'일반' | '퇴직', Record<string, number>> = { 일반: {}, 퇴직: {} }
  const add = (account: string, broker: string, amount: number) => {
    const type = isPensionAccount(account) ? '퇴직' : '일반'
    const b = shortBroker(broker)
    agg[type][b] = (agg[type][b] || 0) + (amount || 0)
  }
  // 투자중: KIS 종목(holdings) + 펀드·예금·보험(nonStockAssets)
  ;(p?.holdings ?? []).forEach(h => add(h.accountType, h.broker, h.opCurrent))
  ;(p?.nonStockAssets?.items ?? []).forEach(it => add(it.account, it.broker, it.value))
  // 대기중: 설정 대기자금
  ;(p?.cashReserve?.items ?? []).forEach(it => add(it.account, it.broker, it.amount))

  const groupSum = (key: '일반' | '퇴직') =>
    Object.values(agg[key]).reduce((a, b) => a + b, 0)
  const total = groupSum('일반') + groupSum('퇴직')
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  // 순서: 일반 투자 먼저, 퇴직연금 다음
  const groups: TypeGroup[] = ([['일반 투자', '일반'], ['퇴직연금', '퇴직']] as const).map(
    ([label, key]) => {
      const brokers = Object.entries(agg[key])
        .sort((a, b) => b[1] - a[1])
        .map(([broker, amount]) => ({ broker, amount, pct: pct(amount) }))
      const amount = brokers.reduce((s, r) => s + r.amount, 0)
      return { label, amount, pct: pct(amount), brokers }
    },
  )
  return { groups, total }
}
