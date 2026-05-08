import type { PortfolioResponse, IndicatorsResponse, TrendHistoryResponse } from '../models/types'

export const KEY_STORAGE = 'app_key'

async function callGAS<T>(action: string): Promise<T> {
  const key = localStorage.getItem(KEY_STORAGE)
  if (!key) throw new Error('NO_KEY')

  const url = import.meta.env.VITE_GAS_WEBAPP_URL
  if (!url) throw new Error('VITE_GAS_WEBAPP_URL not set')

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action, key }),
    redirect: 'follow',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const raw = await res.json()

  if (raw?.error === 'UNAUTHORIZED') {
    window.dispatchEvent(new Event('gas-unauthorized'))
    throw new Error('UNAUTHORIZED')
  }
  if (raw?.error) throw new Error(raw.error)

  return typeof raw === 'string' ? JSON.parse(raw) : (raw as T)
}

export const gasApi = {
  ping:           () => callGAS<{ ok: boolean }>('ping'),
  getPortfolio:   () => callGAS<PortfolioResponse>('getPortfolio'),
  triggerUpdate:  () => callGAS<PortfolioResponse>('triggerUpdate'),
  updateFull:     () => callGAS<PortfolioResponse>('updateFull'),
  updateFast:     () => callGAS<PortfolioResponse>('updateFast'),
  updateAll:      () => callGAS<PortfolioResponse>('updateAll'),
  getIndicators:  () => callGAS<IndicatorsResponse>('getIndicators'),
  getProfitHistory: () => callGAS<TrendHistoryResponse>('getProfitHistory'),
}
