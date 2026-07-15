import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { gasApi, type PortfolioResponse, type IndicatorsResponse, type TrendHistoryResponse, type MonthlyRealizedItem, type CashReserve, type NonStockAssets, type IndicatorHistoryEntry, type SoldTrackerItem } from '../api/gasApi'
import type { Holding, Indicator, PortfolioSummary, EquityPoint, Market } from './types'

interface PortfolioCtxValue {
  loading: boolean
  updating: boolean
  error: string | null
  summary: PortfolioSummary | null
  holdings: Holding[]
  indicators: Indicator[]
  equityCurve: EquityPoint[]
  cashReserve: CashReserve | null
  nonStockAssets: NonStockAssets | null
  updatedAt: string | null
  refresh: () => Promise<void>
  updateAll: () => Promise<void>
}

interface RealizedCtxValue {
  loading: boolean
  error: string | null
  entries: MonthlyRealizedItem[]
  refresh: () => Promise<void>
}

interface IndicatorHistoryCtxValue {
  loading: boolean
  error: string | null
  keys: string[]
  entries: IndicatorHistoryEntry[]
  ensureLoaded: () => void  // lazy: 처음 호출 시 fetch, 이후 cache
}

interface SoldTrackerCtxValue {
  loading: boolean
  error: string | null
  items: SoldTrackerItem[]
  asOfDate: string | null
  refresh: () => Promise<void>
}

const PortfolioCtx = createContext<PortfolioCtxValue | null>(null)
const RealizedCtx = createContext<RealizedCtxValue | null>(null)
const IndicatorHistoryCtx = createContext<IndicatorHistoryCtxValue | null>(null)
const SoldTrackerCtx = createContext<SoldTrackerCtxValue | null>(null)

const AUTO_REFRESH_MS = 60 * 60 * 1000  // 1시간

interface PortfolioState {
  loading: boolean
  updating: boolean
  error: string | null
  summary: PortfolioSummary | null
  holdings: Holding[]
  indicators: Indicator[]
  equityCurve: EquityPoint[]
  cashReserve: CashReserve | null
  nonStockAssets: NonStockAssets | null
  updatedAt: string | null
}

const initialP: PortfolioState = {
  loading: false, updating: false, error: null,
  summary: null, holdings: [], indicators: [], equityCurve: [],
  cashReserve: null, nonStockAssets: null, updatedAt: null,
}

interface RealizedState {
  loading: boolean
  error: string | null
  entries: MonthlyRealizedItem[]
}

const initialR: RealizedState = { loading: false, error: null, entries: [] }

interface SoldTrackerState {
  loading: boolean
  error: string | null
  items: SoldTrackerItem[]
  asOfDate: string | null
}

const initialS: SoldTrackerState = { loading: false, error: null, items: [], asOfDate: null }

interface IndicatorHistoryState {
  loading: boolean
  error: string | null
  keys: string[]
  entries: IndicatorHistoryEntry[]
  loaded: boolean
}

const initialIH: IndicatorHistoryState = { loading: false, error: null, keys: [], entries: [], loaded: false }

export function DataProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth()
  const [pState, setPState] = useState<PortfolioState>(initialP)
  const [rState, setRState] = useState<RealizedState>(initialR)
  const [ihState, setIHState] = useState<IndicatorHistoryState>(initialIH)
  const [sState, setSState] = useState<SoldTrackerState>(initialS)
  // 중복 호출 가드 — Strict mode 등에서 동시 호출되지 않게
  const inflightP = useRef(false)
  const inflightR = useRef(false)
  const inflightIH = useRef(false)
  const inflightS = useRef(false)

  // ── portfolio refresh (시트 캐시만 읽기) ──
  const refreshPortfolio = useCallback(async () => {
    if (!isSignedIn || inflightP.current) return
    inflightP.current = true
    setPState((s) => ({ ...s, loading: true, error: null }))
    try {
      const token = await getToken()
      const [pf, ind, hist] = await Promise.all([
        gasApi.getPortfolio(token),
        gasApi.getIndicators(token).catch(() => null),
        gasApi.getProfitHistory(token).catch(() => null),
      ])
      const baseIndicators: Indicator[] = ind?.indicators ? mapIndicators(ind) : []
      const fxIndicators = makeFxIndicators(pf)
      setPState({
        loading: false,
        updating: false,
        error: pf.success ? null : (pf.error ?? '포트폴리오 조회 실패'),
        summary: pf.summary ? mapSummary(pf) : null,
        holdings: pf.holdings ? mapHoldings(pf) : [],
        indicators: [...baseIndicators, ...fxIndicators],
        equityCurve: hist?.entries ? mapEquity(hist) : [],
        cashReserve: pf.cashReserve ?? null,
        nonStockAssets: pf.nonStockAssets ?? null,
        updatedAt: pf.updatedAt ?? null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setPState((s) => ({ ...s, loading: false, error: msg }))
    } finally {
      inflightP.current = false
    }
  }, [isSignedIn, getToken])

  // ── indicator history (lazy, 처음 ensureLoaded 호출 시만 fetch) ──
  const fetchIndicatorHistory = useCallback(async () => {
    if (!isSignedIn || inflightIH.current) return
    inflightIH.current = true
    setIHState((s) => ({ ...s, loading: true, error: null }))
    try {
      const token = await getToken()
      const res = await gasApi.getIndicatorHistory(token)
      setIHState({
        loading: false,
        error: res.success ? null : (res.error ?? '지표 history 조회 실패'),
        keys: res.keys ?? [],
        entries: res.entries ?? [],
        loaded: true,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setIHState({ loading: false, error: msg, keys: [], entries: [], loaded: true })
    } finally {
      inflightIH.current = false
    }
  }, [isSignedIn, getToken])

  const ensureIndicatorHistory = useCallback(() => {
    if (ihState.loaded || ihState.loading || inflightIH.current) return
    fetchIndicatorHistory()
  }, [ihState.loaded, ihState.loading, fetchIndicatorHistory])

  // ── monthly realized refresh ──
  const refreshRealized = useCallback(async () => {
    if (!isSignedIn || inflightR.current) return
    inflightR.current = true
    setRState((s) => ({ ...s, loading: true, error: null }))
    try {
      const token = await getToken()
      const res = await gasApi.getMonthlyRealized(token)
      setRState({
        loading: false,
        error: res.success ? null : (res.error ?? '실현 손익 조회 실패'),
        entries: res.entries ?? [],
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setRState({ loading: false, error: msg, entries: [] })
    } finally {
      inflightR.current = false
    }
  }, [isSignedIn, getToken])

  // ── sold tracker refresh (매도 What-if) ──
  const refreshSoldTracker = useCallback(async () => {
    if (!isSignedIn || inflightS.current) return
    inflightS.current = true
    setSState((s) => ({ ...s, loading: true, error: null }))
    try {
      const token = await getToken()
      const res = await gasApi.getSoldTracker(token)
      setSState({
        loading: false,
        error: res.success ? null : (res.error ?? '매도추적 조회 실패'),
        items: res.items ?? [],
        asOfDate: res.asOfDate ?? null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setSState({ loading: false, error: msg, items: [], asOfDate: null })
    } finally {
      inflightS.current = false
    }
  }, [isSignedIn, getToken])

  // ── updateAll (KIS 강제 갱신, 사용자 명시) ──
  const updateAll = useCallback(async () => {
    if (!isSignedIn) return
    setPState((s) => ({ ...s, updating: true, error: null }))
    try {
      const token = await getToken()
      const res = await gasApi.updateAll(token)
      if (!res.success) {
        setPState((s) => ({ ...s, updating: false, error: res.error ?? '전체 업데이트 실패' }))
        return
      }
      const [ind, hist] = await Promise.all([
        gasApi.getIndicators(token).catch(() => null),
        gasApi.getProfitHistory(token).catch(() => null),
      ])
      const baseIndicators: Indicator[] = ind?.indicators ? mapIndicators(ind) : []
      const fxIndicators = makeFxIndicators(res)
      setPState({
        loading: false,
        updating: false,
        error: null,
        summary: res.summary ? mapSummary(res) : null,
        holdings: res.holdings ? mapHoldings(res) : [],
        indicators: [...baseIndicators, ...fxIndicators],
        equityCurve: hist?.entries ? mapEquity(hist) : [],
        cashReserve: res.cashReserve ?? null,
        nonStockAssets: res.nonStockAssets ?? null,
        updatedAt: res.updatedAt ?? null,
      })
      // updateAll 후 realized·매도추적도 같이 갱신
      refreshRealized()
      refreshSoldTracker()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setPState((s) => ({ ...s, updating: false, error: msg }))
    }
  }, [isSignedIn, getToken, refreshRealized, refreshSoldTracker])

  // ── 첫 로그인 시: portfolio 우선 → realized·매도추적 prefetch ──
  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    ;(async () => {
      await refreshPortfolio()
      if (cancelled) return
      // 백그라운드 prefetch (대시보드 표시 후)
      refreshRealized().catch(() => {})
      refreshSoldTracker().catch(() => {})
    })()
    return () => { cancelled = true }
  }, [isSignedIn, refreshPortfolio, refreshRealized, refreshSoldTracker])

  // ── 시간당 자동 백그라운드 재페치 (GAS 09:30~16:30 자동 갱신과 매칭) ──
  useEffect(() => {
    if (!isSignedIn) return
    const id = setInterval(() => {
      refreshPortfolio().catch(() => {})
      refreshRealized().catch(() => {})
      refreshSoldTracker().catch(() => {})
    }, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [isSignedIn, refreshPortfolio, refreshRealized, refreshSoldTracker])

  const pValue: PortfolioCtxValue = {
    ...pState,
    refresh: refreshPortfolio,
    updateAll,
  }
  const rValue: RealizedCtxValue = {
    ...rState,
    refresh: refreshRealized,
  }
  const ihValue: IndicatorHistoryCtxValue = {
    loading: ihState.loading,
    error: ihState.error,
    keys: ihState.keys,
    entries: ihState.entries,
    ensureLoaded: ensureIndicatorHistory,
  }
  const sValue: SoldTrackerCtxValue = {
    ...sState,
    refresh: refreshSoldTracker,
  }

  return (
    <PortfolioCtx.Provider value={pValue}>
      <RealizedCtx.Provider value={rValue}>
        <IndicatorHistoryCtx.Provider value={ihValue}>
          <SoldTrackerCtx.Provider value={sValue}>{children}</SoldTrackerCtx.Provider>
        </IndicatorHistoryCtx.Provider>
      </RealizedCtx.Provider>
    </PortfolioCtx.Provider>
  )
}

export function usePortfolio(): PortfolioCtxValue {
  const ctx = useContext(PortfolioCtx)
  if (!ctx) throw new Error('usePortfolio must be used inside <DataProvider>')
  return ctx
}

export function useRealized(): RealizedCtxValue {
  const ctx = useContext(RealizedCtx)
  if (!ctx) throw new Error('useRealized must be used inside <DataProvider>')
  return ctx
}

export function useIndicatorHistory(): IndicatorHistoryCtxValue {
  const ctx = useContext(IndicatorHistoryCtx)
  if (!ctx) throw new Error('useIndicatorHistory must be used inside <DataProvider>')
  return ctx
}

export function useSoldTracker(): SoldTrackerCtxValue {
  const ctx = useContext(SoldTrackerCtx)
  if (!ctx) throw new Error('useSoldTracker must be used inside <DataProvider>')
  return ctx
}

// ── helpers ── (기존 usePortfolio.ts에서 이관) ──────────────────

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
  const cashReserve = pf.cashReserve?.total ?? 0
  const netWorth = totalValue + cashReserve
  return {
    totalValue, todayPnl, todayPct, totalReturn, totalReturnPct,
    positionsActive: holdings.length, positionsTotal: holdings.length,
    positionsGain: gainN, positionsLoss: lossN,
    cashReserve,
    cashPct: netWorth > 0 ? (cashReserve / netWorth) * 100 : 0,
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
        symbol: h.code, name: h.name, category: h.category || '',
        market: detectMarket(h.code) as Market,
        value, opBuy: Number(h.opBuy) || 0,
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
        m1: Number(h.m1) || 0, m3: Number(h.m3) || 0,
        m6: Number(h.m6) || 0, y1: Number(h.y1) || 0,
        high52: Number(h.high52) || 0, low52: Number(h.low52) || 0,
        buyDate: h.buyDate,
      }
    })
    .sort((a, b) => b.value - a.value)
}

function detectMarket(code: string): Market {
  return /^\d{6}$/.test(code) ? 'KR' : 'US'
}

function makeFxIndicators(pf: PortfolioResponse): Indicator[] {
  const out: Indicator[] = []
  if (Number(pf.usdRate) > 0) {
    out.push({ symbol: 'USDKRW', name: 'USD/KRW', category: '환율', value: Number(pf.usdRate), changeAbs: 0, changePct: 0, spark: [] })
  }
  if (Number(pf.gbpRate) > 0) {
    out.push({ symbol: 'GBPKRW', name: 'GBP/KRW', category: '환율', value: Number(pf.gbpRate), changeAbs: 0, changePct: 0, spark: [] })
  }
  return out
}

function mapIndicators(ind: IndicatorsResponse): Indicator[] {
  return (ind.indicators ?? []).map((i) => ({
    symbol: i.key, name: i.name,
    category: i.category,
    value: Number(i.value) || 0,
    changeAbs: Number(i.change) || 0,
    changePct: Number(i.changePct) || 0,
    spark: [],
  }))
}

function mapEquity(hist: TrendHistoryResponse): EquityPoint[] {
  return (hist.entries ?? []).map((e) => ({
    date: e.date.slice(5), fullDate: e.date,
    value: Number(e.totalProfit) || 0,
  }))
}

function parsePct(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace('%', ''))
}
