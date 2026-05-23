import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { gasApi, type PortfolioResponse, type IndicatorsResponse, type TrendHistoryResponse } from '../api/gasApi'
import type { Holding, Indicator, PortfolioSummary, EquityPoint, Market } from './types'

interface PortfolioState {
  loading: boolean
  error: string | null
  summary: PortfolioSummary | null
  holdings: Holding[]
  indicators: Indicator[]
  equityCurve: EquityPoint[]
  updatedAt: string | null
}

const initial: PortfolioState = {
  loading: false,
  error: null,
  summary: null,
  holdings: [],
  indicators: [],
  equityCurve: [],
  updatedAt: null,
}

export function usePortfolio() {
  const { isSignedIn, getToken } = useAuth()
  const [state, setState] = useState<PortfolioState>(initial)

  const refresh = useCallback(async () => {
    if (!isSignedIn) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const token = await getToken()
      const [pf, ind, hist] = await Promise.all([
        gasApi.getPortfolio(token),
        gasApi.getIndicators(token).catch(() => null),
        gasApi.getProfitHistory(token).catch(() => null),
      ])
      setState({
        loading: false,
        error: pf.success ? null : (pf.error ?? '포트폴리오 조회 실패'),
        summary: pf.summary ? mapSummary(pf) : null,
        holdings: pf.holdings ? mapHoldings(pf) : [],
        indicators: ind?.indicators ? mapIndicators(ind) : [],
        equityCurve: hist?.entries ? mapEquity(hist) : [],
        updatedAt: pf.updatedAt ?? null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (isSignedIn) refresh()
  }, [isSignedIn, refresh])

  return { ...state, refresh }
}

function mapSummary(pf: PortfolioResponse): PortfolioSummary {
  const s = pf.summary!
  const totalValue = Number(s.totalCurrent) || 0
  const totalReturn = Number(s.trendTotalProfit) || 0
  const todayPnl = Number(s.dayChangAmount) || 0
  const todayPct = parsePct(s.dayChangePct)
  const totalReturnPct = Number(s.totalProfitRate) || 0
  const holdings = pf.holdings ?? []
  const gainN = holdings.filter((h) => h.profitRate > 0).length
  const lossN = holdings.filter((h) => h.profitRate < 0).length
  return {
    totalValue,
    todayPnl,
    todayPct,
    totalReturn,
    totalReturnPct,
    positionsActive: holdings.length,
    positionsTotal: holdings.length,
    positionsGain: gainN,
    positionsLoss: lossN,
    cashReserve: 0,
    cashPct: 0,
  }
}

function mapHoldings(pf: PortfolioResponse): Holding[] {
  const total = pf.holdings?.reduce((sum, h) => sum + (Number(h.opCurrent) || 0), 0) || 1
  return (pf.holdings ?? [])
    .map((h) => {
      const value = Number(h.opCurrent) || 0
      const dayPct = parsePct(h.changePct)
      const dayChangePerShare = Number(h.change) || 0
      const quantity = Number(h.quantity) || 0
      return {
        symbol: h.code,
        name: h.name,
        market: detectMarket(h.code) as Market,
        value,
        returnPct: Number(h.profitRate) || 0,
        weightPct: (value / total) * 100,
        shares: quantity,
        avgPrice: Number(h.buyPrice) || 0,
        accountType: h.accountType || '—',
        broker: h.broker || '—',
        opProfit: Number(h.opProfit) || 0,
        dayChange: dayChangePerShare * quantity,
        dayChangePct: dayPct,
        buyDate: (h as { buyDate?: string }).buyDate,
      }
    })
    .sort((a, b) => b.value - a.value)
}

function detectMarket(code: string): Market {
  // KR codes are 6-digit numeric; everything else US
  return /^\d{6}$/.test(code) ? 'KR' : 'US'
}

function mapIndicators(ind: IndicatorsResponse): Indicator[] {
  return (ind.indicators ?? []).map((i) => ({
    symbol: i.key,
    name: i.name,
    value: Number(i.value) || 0,
    changeAbs: Number(i.change) || 0,
    changePct: Number(i.changePct) || 0,
    spark: [], // 외부 지표 history는 별도 API 필요 — 일단 비움
  }))
}

function mapEquity(hist: TrendHistoryResponse): EquityPoint[] {
  return (hist.entries ?? []).map((e) => ({
    date: e.date.slice(5), // MM-DD
    value: Number(e.totalProfit) || 0, // trendTotalProfit이라 누적 손익 — 표시 의미는 동일
  }))
}

function parsePct(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace('%', ''))
}
