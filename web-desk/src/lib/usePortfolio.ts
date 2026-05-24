import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { gasApi, type PortfolioResponse, type IndicatorsResponse, type TrendHistoryResponse } from '../api/gasApi'
import type { Holding, Indicator, PortfolioSummary, EquityPoint, Market } from './types'

interface PortfolioState {
  loading: boolean
  updating: boolean
  error: string | null
  summary: PortfolioSummary | null
  holdings: Holding[]
  indicators: Indicator[]
  equityCurve: EquityPoint[]
  updatedAt: string | null
}

const initial: PortfolioState = {
  loading: false,
  updating: false,
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
      const baseIndicators: Indicator[] = ind?.indicators ? mapIndicators(ind) : []
      // FX 환율은 portfolio 응답의 usdRate/gbpRate에 있음 (indicators엔 없음) — 병합
      const fxIndicators = makeFxIndicators(pf)
      setState({
        loading: false,
        updating: false,
        error: pf.success ? null : (pf.error ?? '포트폴리오 조회 실패'),
        summary: pf.summary ? mapSummary(pf) : null,
        holdings: pf.holdings ? mapHoldings(pf) : [],
        indicators: [...baseIndicators, ...fxIndicators],
        equityCurve: hist?.entries ? mapEquity(hist) : [],
        updatedAt: pf.updatedAt ?? null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [isSignedIn, getToken])

  /** 전체 업데이트 — KIS 가격·환율·보유현황·추이까지 다시 계산 (30~60초). 끝나면 자동 refresh */
  const updateAll = useCallback(async () => {
    if (!isSignedIn) return
    setState((s) => ({ ...s, updating: true, error: null }))
    try {
      const token = await getToken()
      const res = await gasApi.updateAll(token)
      if (!res.success) {
        setState((s) => ({ ...s, updating: false, error: res.error ?? '전체 업데이트 실패' }))
        return
      }
      // updateAll 결과로 portfolio가 이미 fresh — 추가로 indicators·history도 다시 fetch
      const [ind, hist] = await Promise.all([
        gasApi.getIndicators(token).catch(() => null),
        gasApi.getProfitHistory(token).catch(() => null),
      ])
      const baseIndicators: Indicator[] = ind?.indicators ? mapIndicators(ind) : []
      const fxIndicators = makeFxIndicators(res)
      setState({
        loading: false,
        updating: false,
        error: null,
        summary: res.summary ? mapSummary(res) : null,
        holdings: res.holdings ? mapHoldings(res) : [],
        indicators: [...baseIndicators, ...fxIndicators],
        equityCurve: hist?.entries ? mapEquity(hist) : [],
        updatedAt: res.updatedAt ?? null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setState((s) => ({ ...s, updating: false, error: msg }))
    }
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (isSignedIn) refresh()
  }, [isSignedIn, refresh])

  return { ...state, refresh, updateAll }
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
        category: h.category || '',
        market: detectMarket(h.code) as Market,
        value,
        opBuy: Number(h.opBuy) || 0,
        returnPct: Number(h.profitRate) || 0,
        weightPct: (value / total) * 100,
        shares: quantity,
        avgPrice: Number(h.buyPrice) || 0,
        currentPrice: Number(h.currentPrice) || 0,
        accountType: h.accountType || '—',
        broker: h.broker || '—',
        opProfit: Number(h.opProfit) || 0,
        change: dayChangePerShare,
        changePct: h.changePct || '0%',
        dayChange: dayChangePerShare * quantity,
        dayChangePct: dayPct,
        m1: Number(h.m1) || 0,
        m3: Number(h.m3) || 0,
        m6: Number(h.m6) || 0,
        y1: Number(h.y1) || 0,
        high52: Number(h.high52) || 0,
        low52: Number(h.low52) || 0,
        buyDate: h.buyDate,
      }
    })
    .sort((a, b) => b.value - a.value)
}

function detectMarket(code: string): Market {
  // KR codes are 6-digit numeric; everything else US
  return /^\d{6}$/.test(code) ? 'KR' : 'US'
}

// FX 환율 합성 — portfolio 응답에서 usdRate/gbpRate 추출. 변동 정보 없어 0으로 표기
function makeFxIndicators(pf: PortfolioResponse): Indicator[] {
  const out: Indicator[] = []
  if (Number(pf.usdRate) > 0) {
    out.push({ symbol: 'USDKRW', name: 'USD/KRW', value: Number(pf.usdRate), changeAbs: 0, changePct: 0, spark: [] })
  }
  if (Number(pf.gbpRate) > 0) {
    out.push({ symbol: 'GBPKRW', name: 'GBP/KRW', value: Number(pf.gbpRate), changeAbs: 0, changePct: 0, spark: [] })
  }
  return out
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
    date: e.date.slice(5),   // MM-DD (X축 라벨)
    fullDate: e.date,        // YYYY-MM-DD (필터링용)
    value: Number(e.totalProfit) || 0,
  }))
}

function parsePct(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace('%', ''))
}
