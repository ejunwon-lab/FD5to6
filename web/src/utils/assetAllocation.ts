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

// 계좌 유형별: 일반 투자 / 퇴직연금. 총자산(투자중+대기중) 기준.
// 일반 투자는 증권사가 계좌를 2개 이상 가지면 계좌 단위로 분리(예: 삼성 종합 / 삼성 ISA),
// 1개면 증권사명만(예: 미래). 퇴직연금은 증권사 단위.
export function computeAccountTypeBreakdown(p: PortfolioResponse | null): AccountTypeBreakdown {
  const genByBrokerAcct: Record<string, { broker: string; account: string; amount: number }> = {}
  const penByBroker: Record<string, number> = {}

  const add = (account: string, broker: string, amount: number) => {
    const amt = amount || 0
    const b = shortBroker(broker)
    if (isPensionAccount(account)) {
      penByBroker[b] = (penByBroker[b] || 0) + amt
    } else {
      const acct = String(account || '').trim()
      const key = `${b}|${acct}`
      if (!genByBrokerAcct[key]) genByBrokerAcct[key] = { broker: b, account: acct, amount: 0 }
      genByBrokerAcct[key].amount += amt
    }
  }
  // 투자중: KIS 종목(holdings) + 펀드·예금·보험(nonStockAssets)
  ;(p?.holdings ?? []).forEach(h => add(h.accountType, h.broker, h.opCurrent))
  ;(p?.nonStockAssets?.items ?? []).forEach(it => add(it.account, it.broker, it.value))
  // 대기중: 설정 대기자금
  ;(p?.cashReserve?.items ?? []).forEach(it => add(it.account, it.broker, it.amount))

  const genTotal = Object.values(genByBrokerAcct).reduce((s, r) => s + r.amount, 0)
  const penTotal = Object.values(penByBroker).reduce((s, v) => s + v, 0)
  const total = genTotal + penTotal
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  // 일반: 증권사별 계좌 수 → 2개 이상이면 "증권사 계좌", 1개면 "증권사"
  const acctCountByBroker: Record<string, number> = {}
  Object.values(genByBrokerAcct).forEach(r => {
    acctCountByBroker[r.broker] = (acctCountByBroker[r.broker] || 0) + 1
  })
  const genBrokers: BrokerSlice[] = Object.values(genByBrokerAcct)
    .sort((a, b) => b.amount - a.amount)
    .map(r => ({
      broker: acctCountByBroker[r.broker] > 1 ? `${r.broker} ${r.account}` : r.broker,
      amount: r.amount,
      pct: pct(r.amount),
    }))

  const penBrokers: BrokerSlice[] = Object.entries(penByBroker)
    .sort((a, b) => b[1] - a[1])
    .map(([broker, amount]) => ({ broker, amount, pct: pct(amount) }))

  // 순서: 일반 투자 먼저, 퇴직연금 다음
  const groups: TypeGroup[] = [
    { label: '일반 투자', amount: genTotal, pct: pct(genTotal), brokers: genBrokers },
    { label: '퇴직연금', amount: penTotal, pct: pct(penTotal), brokers: penBrokers },
  ]
  return { groups, total }
}
