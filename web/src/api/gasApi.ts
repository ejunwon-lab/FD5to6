import type { PortfolioResponse, IndicatorsResponse, TrendHistoryResponse } from '../models/types'

// 신시스템 GAS Script ID (이전 구시스템: 12MAcPpoVE39N_Sz0B79G0rjGvevJ8-S_ibVC1Ot61fyVPZnaSQmrJyiR)
const SCRIPT_ID = '1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ'
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
  getPortfolio:    (token: string) => callGAS<PortfolioResponse>('newMobileGetPortfolio', token),
  triggerUpdate:   (token: string) => callGAS<PortfolioResponse>('newMobileUpdateCurrentPrice', token),
  updateFull:      (token: string) => callGAS<PortfolioResponse>('newMobileUpdateHistory', token),
  updateFast:      (token: string) => callGAS<PortfolioResponse>('newMobileUpdateCurrentPrice', token),
  updateAll:       (token: string) => callGAS<PortfolioResponse>('newMobileUpdateAll', token),
  getIndicators:   (token: string) => callGAS<IndicatorsResponse>('newMobileGetIndicators', token),
  getProfitHistory:(token: string) => callGAS<TrendHistoryResponse>('newMobileGetProfitHistory', token),
}
