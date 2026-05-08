import type { PortfolioResponse, IndicatorsResponse, TrendHistoryResponse } from '../models/types'

const SCRIPT_ID = '12MAcPpoVE39N_Sz0B79G0rjGvevJ8-S_ibVC1Ot61fyVPZnaSQmrJyiR'
const BASE_URL = 'https://script.googleapis.com/v1/scripts'

async function callGAS<T>(functionName: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${SCRIPT_ID}:run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ function: functionName, devMode: true }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const raw = await res.json()

  if (raw.error) {
    throw new Error(raw.error.message ?? 'GAS 실행 오류')
  }

  const result = raw.response?.result
  if (result === undefined || result === null) {
    throw new Error('GAS 응답 없음')
  }

  const parsed: T = typeof result === 'string' ? JSON.parse(result) : result
  return parsed
}

export const gasApi = {
  getPortfolio: (token: string) =>
    callGAS<PortfolioResponse>('mobileGetPortfolio', token),
  triggerUpdate: (token: string) =>
    callGAS<PortfolioResponse>('mobileTriggerUpdate', token),
  updateFull: (token: string) =>
    callGAS<PortfolioResponse>('mobileUpdateHoldingsFull', token),
  updateFast: (token: string) =>
    callGAS<PortfolioResponse>('mobileUpdateHoldingsFast', token),
  updateAll: (token: string) =>
    callGAS<PortfolioResponse>('mobileUpdateAll', token),
  getIndicators: (token: string) =>
    callGAS<IndicatorsResponse>('mobileGetReferenceIndicators', token),
  getProfitHistory: (token: string) =>
    callGAS<TrendHistoryResponse>('mobileGetProfitHistory', token),
}
