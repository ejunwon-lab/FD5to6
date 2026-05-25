/**
 * 계좌 표시명 — 데스크 전역 공통.
 * 형식: {증권사 약칭}_{계좌명 단축}
 * 예: 미래에셋 + 종합_랩 → "미래_종합_랩"
 *     삼성증권 + ISA → "삼성_ISA"
 *     미래에셋 + 퇴직연금_개인IRP → "미래_퇴직연금"
 *     삼성증권 + 퇴직연금_개인형IRP(범용) → "삼성_퇴직연금"
 */

export function brokerShort(broker: string): string {
  if (!broker) return ''
  const low = broker.toLowerCase()
  if (low.includes('미래')) return '미래'
  if (low.includes('삼성')) return '삼성'
  return broker
}

// 길고 의미가 약한 suffix를 정리
const ACCOUNT_CLEANUP: Array<[RegExp | string, string]> = [
  [/^퇴직연금_개인IRP$/, '퇴직연금'],
  [/^퇴직연금_개인형IRP\(범용\)$/, '퇴직연금'],
]

export function accountShort(account: string): string {
  if (!account) return ''
  for (const [pat, repl] of ACCOUNT_CLEANUP) {
    if (typeof pat === 'string') {
      if (account === pat) return repl
    } else if (pat.test(account)) {
      return account.replace(pat, repl)
    }
  }
  return account
}

export function accountDisplay(broker: string, account: string): string {
  const prefix = brokerShort(broker)
  const short = accountShort(account)
  return prefix ? `${prefix}_${short}` : short
}
