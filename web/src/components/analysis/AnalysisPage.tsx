import { useState, useEffect, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import { gasApi } from '../../api/gasApi'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import {
  krwCompact, pctFormatted, profitTextClass,
  holdingDays, annualizedReturn, position52w,
} from '../../utils/format'
import type { Holding, PortfolioResponse } from '../../models/types'

type AccountTab = '현황' | '수익률' | '비중' | '오늘수익' | '대장/골칫'
const ACCOUNT_TABS: AccountTab[] = ['현황', '수익률', '비중', '오늘수익', '대장/골칫']

const PIE_COLORS = ['#405AE6', '#7340D9', '#D91919', '#0D5AD9', '#E67340', '#40D9A0', '#D9C840']

function tag52w(h: Holding): string {
  const pos = position52w(h.currentPrice, h.low52, h.high52)
  const days = holdingDays(h.buyDate)
  if (days <= 14) return '단기'
  if (h.profitRate > 15 && pos > 50) return '핵심보유'
  const pctFromHigh = h.high52 > 0 ? ((h.high52 - h.currentPrice) / h.high52) * 100 : 100
  if (pctFromHigh < 5) return '고점근접'
  if (pos < 20) return '깊은손실'
  if (h.opProfit < 0 && pos > 40) return '잠자는돈'
  return ''
}

const TAG_COLORS: Record<string, string> = {
  '핵심보유': 'bg-profit/15 text-profit',
  '잠자는돈': 'bg-blue-500/15 text-blue-500',
  '고점근접': 'bg-orange-500/15 text-orange-500',
  '깊은손실': 'bg-loss/15 text-loss',
  '단기':    'bg-gray-400/15 text-gray-400',
}

export function AnalysisPage() {

  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeAccount, setActiveAccount] = useState('')
  const [accountTab, setAccountTab] = useState<AccountTab>('현황')
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    matrix: true, account: true, annualized: false, week52: false,
  })

  const fetchPortfolio = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await gasApi.getPortfolio()
      if (res.success) {
        setPortfolio(res)
        const accs = Object.keys(res.byAccount ?? {})
        if (accs.length > 0 && !activeAccount) setActiveAccount(accs[0])
        setError('')
      } else {
        setError(res.error ?? '조회 실패')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsLoading(false)
    }
  }, [activeAccount])

  useEffect(() => { fetchPortfolio() }, [fetchPortfolio])

  const holdings = portfolio?.holdings ?? []

  const matrix = useMemo(() => {
    const q = { shortProfit: [] as Holding[], shortLoss: [] as Holding[], longProfit: [] as Holding[], longLoss: [] as Holding[] }
    for (const h of holdings) {
      const days = holdingDays(h.buyDate)
      const isLong = days > 30
      const isProfit = h.opProfit >= 0
      if (!isLong && isProfit) q.shortProfit.push(h)
      else if (!isLong && !isProfit) q.shortLoss.push(h)
      else if (isLong && isProfit) q.longProfit.push(h)
      else q.longLoss.push(h)
    }
    return q
  }, [holdings])

  const accountHoldings = useMemo(() => {
    if (!activeAccount) return []
    return holdings.filter(h => h.accountType === activeAccount)
  }, [holdings, activeAccount])

  const accountDayChange = useMemo(() => {
    const map: Record<string, number> = {}
    for (const h of holdings) {
      map[h.accountType] = (map[h.accountType] ?? 0) + h.change * h.quantity
    }
    return map
  }, [holdings])

  const annualizedData = useMemo(() => {
    return holdings
      .filter(h => holdingDays(h.buyDate) >= 30)
      .map(h => ({ name: h.name, value: parseFloat(annualizedReturn(h.profitRate, h.buyDate).toFixed(1)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
  }, [holdings])

  const toggleSection = (key: string) =>
    setOpenSection(s => ({ ...s, [key]: !s[key] }))

  if (isLoading) return <LoadingSpinner message="분석 데이터 불러오는 중..." />
  if (error) return (
    <div className="p-4">
      <Card className="p-4 text-sm text-red-500">{error}</Card>
    </div>
  )

  return (
    <div className="h-[100dvh] overflow-y-auto no-scrollbar bg-[rgb(var(--page-bg))] pb-32">
      <div className="px-4 pt-12 pb-3">
        <h2 className="text-2xl font-bold">분석</h2>
      </div>

      <div className="px-4 space-y-3">

        {/* ─────── 투자 효율 매트릭스 ─────── */}
        <SectionAccordion
          title="투자 효율 매트릭스"
          open={openSection.matrix}
          onToggle={() => toggleSection('matrix')}
        >
          <div className="grid grid-cols-2 gap-2 pt-3">
            {[
              { label: '단기 수익', key: 'shortProfit' as const, profitSign: 1 },
              { label: '단기 손실', key: 'shortLoss' as const, profitSign: -1 },
              { label: '장기 수익', key: 'longProfit' as const, profitSign: 1 },
              { label: '장기 손실', key: 'longLoss' as const, profitSign: -1 },
            ].map(q => {
              const items = matrix[q.key]
              const total = items.reduce((s, h) => s + h.opProfit, 0)
              return (
                <div
                  key={q.label}
                  className={`rounded-2xl p-3 ${q.profitSign > 0 ? 'bg-profit/8' : 'bg-loss/8'}`}
                >
                  <p className="text-[10px] text-gray-400 mb-1">{q.label}</p>
                  <p className="text-xl font-bold">{items.length}<span className="text-xs font-normal text-gray-400 ml-0.5">종목</span></p>
                  <p className={`text-xs font-semibold mt-0.5 ${profitTextClass(total)}`}>
                    {krwCompact(total)}
                  </p>
                </div>
              )
            })}
          </div>
        </SectionAccordion>

        {/* ─────── 계좌별 분석 ─────── */}
        <SectionAccordion
          title="계좌별 분석"
          open={openSection.account}
          onToggle={() => toggleSection('account')}
        >
          <div className="pt-3">
            {/* 계좌 선택 */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
              {Object.keys(portfolio?.byAccount ?? {}).map(acc => (
                <button
                  key={acc}
                  onClick={() => setActiveAccount(acc)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeAccount === acc ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {acc}
                </button>
              ))}
            </div>

            {/* 5 탭 */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar mb-3">
              {ACCOUNT_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setAccountTab(t)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    accountTab === t ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            {accountTab === '현황' && (
              <AccountStatus account={activeAccount} stat={portfolio?.byAccount?.[activeAccount]} />
            )}
            {accountTab === '수익률' && (
              <AccountProfitRateChart holdings={accountHoldings} />
            )}
            {accountTab === '비중' && (
              <AccountAllocationChart
                byCategory={portfolio?.byCategory ?? {}}
                byAccount={portfolio?.byAccount ?? {}}
              />
            )}
            {accountTab === '오늘수익' && (
              <AccountDayProfit map={accountDayChange} active={activeAccount} />
            )}
            {accountTab === '대장/골칫' && (
              <TopBottom holdings={accountHoldings} />
            )}
          </div>
        </SectionAccordion>

        {/* ─────── 연 환산 수익률 ─────── */}
        <SectionAccordion
          title="연 환산 수익률"
          open={openSection.annualized}
          onToggle={() => toggleSection('annualized')}
        >
          <div className="pt-3">
            {annualizedData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">30일 이상 보유 종목 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={annualizedData.length * 28 + 20}>
                <BarChart
                  layout="vertical"
                  data={annualizedData}
                  margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 9, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip formatter={(v: number) => [`${v}%`, '연환산']} />
                  <ReferenceLine x={0} stroke="#E5E7EB" />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {annualizedData.map(entry => (
                      <Cell key={entry.name} fill={entry.value >= 0 ? '#D91919' : '#0D5AD9'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionAccordion>

        {/* ─────── 52주 포지션 ─────── */}
        <SectionAccordion
          title="52주 포지션"
          open={openSection.week52}
          onToggle={() => toggleSection('week52')}
        >
          <div className="pt-3 space-y-3">
            {holdings.map(h => {
              const pos = position52w(h.currentPrice, h.low52, h.high52)
              const tagLabel = tag52w(h)
              return (
                <div key={`${h.code}-${h.accountType}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate max-w-[120px]">{h.name}</span>
                    <div className="flex items-center gap-1">
                      {tagLabel && (
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${TAG_COLORS[tagLabel] ?? ''}`}>
                          {tagLabel}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold ${profitTextClass(h.opProfit)}`}>
                        {pctFormatted(h.profitRate)}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full rounded-full bg-accent/40"
                      style={{ width: `${Math.max(2, Math.min(100, pos))}%` }}
                    />
                    <div
                      className="absolute w-2 h-2 rounded-full bg-accent -translate-x-1/2"
                      style={{ left: `${Math.max(2, Math.min(98, pos))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                    <span>{krwCompact(h.low52)}</span>
                    <span>{krwCompact(h.high52)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionAccordion>

      </div>
    </div>
  )
}

// ── Sub-components ──

function SectionAccordion({
  title, open, onToggle, children,
}: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-4"
        onClick={onToggle}
      >
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </Card>
  )
}

function AccountStatus({ account, stat }: { account: string; stat?: { current: number; buy: number; profit: number; profitRate: number; count: number; pct: number } }) {
  if (!stat) return <p className="text-sm text-gray-400 text-center py-4">계좌를 선택하세요</p>
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: '계좌', val: account },
        { label: '종목 수', val: `${stat.count}종목` },
        { label: '평가금액', val: krwCompact(stat.current) },
        { label: '매입금액', val: krwCompact(stat.buy) },
        { label: '수익금', val: krwCompact(stat.profit), colored: true, v: stat.profit },
        { label: '수익률', val: pctFormatted(stat.profitRate), colored: true, v: stat.profit },
      ].map(item => (
        <div key={item.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-0.5">{item.label}</p>
          <p className={`text-sm font-bold ${item.colored ? profitTextClass(item.v ?? 0) : ''}`}>
            {item.val}
          </p>
        </div>
      ))}
    </div>
  )
}

function AccountProfitRateChart({ holdings }: { holdings: Holding[] }) {
  const data = [...holdings]
    .sort((a, b) => b.profitRate - a.profitRate)
    .slice(0, 10)
    .map(h => ({ name: h.name, value: h.profitRate }))

  return (
    <ResponsiveContainer width="100%" height={data.length * 28 + 20}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
        <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '수익률']} />
        <ReferenceLine x={0} stroke="#E5E7EB" />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map(entry => <Cell key={entry.name} fill={entry.value >= 0 ? '#D91919' : '#0D5AD9'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function AccountAllocationChart({
  byCategory,
  byAccount,
}: {
  byCategory: Record<string, { pct: number; current: number }>
  byAccount: Record<string, { pct: number; current: number }>
}) {
  const categoryData = Object.entries(byCategory).map(([name, v]) => ({ name, value: v.pct }))
  const accountData = Object.entries(byAccount).map(([name, v]) => ({ name, value: v.pct }))

  return (
    <div className="space-y-4">
      {[
        { title: '분류별', data: categoryData },
        { title: '계좌별', data: accountData },
      ].map(({ title, data }) => (
        <div key={title}>
          <p className="text-xs text-gray-400 mb-2">{title}</p>
          <div className="flex items-center gap-4">
            <PieChart width={120} height={120}>
              <Pie data={data} cx={55} cy={55} innerRadius={28} outerRadius={55} dataKey="value" paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`]} />
            </PieChart>
            <div className="flex-1 space-y-1">
              {data.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[10px] text-gray-500 truncate flex-1">{item.name}</span>
                  <span className="text-[10px] font-semibold">{item.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AccountDayProfit({ map, active }: { map: Record<string, number>; active: string }) {
  const val = map[active] ?? 0
  return (
    <div className="text-center py-4">
      <p className="text-xs text-gray-400 mb-1">오늘 수익 ({active})</p>
      <p className={`text-3xl font-bold ${profitTextClass(val)}`}>{krwCompact(val)}</p>
      <div className="mt-4 space-y-2">
        {Object.entries(map).map(([acc, v]) => (
          <div key={acc} className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{acc}</span>
            <span className={`text-xs font-semibold ${profitTextClass(v)}`}>{krwCompact(v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopBottom({ holdings }: { holdings: Holding[] }) {
  const sorted = [...holdings].sort((a, b) => b.profitRate - a.profitRate)
  const top3 = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3).reverse()
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-gray-400 mb-2">대장 (수익률 상위)</p>
        {top3.map(h => (
          <div key={h.code} className="flex items-center justify-between py-1.5">
            <span className="text-xs truncate max-w-[120px]">{h.name}</span>
            <span className={`text-xs font-bold ${profitTextClass(h.opProfit)}`}>
              {pctFormatted(h.profitRate)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
        <p className="text-[10px] text-gray-400 mb-2">골칫 (수익률 하위)</p>
        {bottom3.map(h => (
          <div key={h.code} className="flex items-center justify-between py-1.5">
            <span className="text-xs truncate max-w-[120px]">{h.name}</span>
            <span className={`text-xs font-bold ${profitTextClass(h.opProfit)}`}>
              {pctFormatted(h.profitRate)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
