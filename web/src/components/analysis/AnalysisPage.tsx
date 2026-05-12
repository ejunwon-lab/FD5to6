import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import {
  krwFull, pctFormatted, profitTextClass,
  holdingDays, annualizedReturn, position52w, holdingDurationText,
} from '../../utils/format'
import type { Holding, PortfolioResponse, GroupStat } from '../../models/types'

type AnalysisPageProps = {
  portfolio: PortfolioResponse | null
  isLoading: boolean
  error: string
}

// ── Constants ──────────────────────────────────────────────────────────────
const ACCOUNT_ORDER = ['종합_랩', '퇴직연금_개인IRP', '종합', 'ISA', '퇴직연금_개인형IRP(범용)']
const MATRIX_THRESHOLD = 180
const ACC_PALETTE = ['#F97316', '#2563EB', '#405AE6', '#0D9488', '#7C3AED']

type AccountTab = '현황' | '수익률' | '비중' | '오늘' | '종목'
const ACCOUNT_TABS: AccountTab[] = ['현황', '수익률', '비중', '오늘', '종목']

type InsightTag = '핵심 보유' | '잠자는 돈' | '고점 근접' | '깊은 손실' | '단기'
const TAG_STYLE: Record<InsightTag, string> = {
  '핵심 보유': 'bg-profit/10 text-profit',
  '잠자는 돈': 'bg-orange-500/10 text-orange-500',
  '고점 근접': 'bg-yellow-600/10 text-yellow-600',
  '깊은 손실': 'bg-loss/10 text-loss',
  '단기':      'bg-gray-400/10 text-gray-400',
}

// ── Helpers ────────────────────────────────────────────────────────────────
function acctLabel(type: string, holdings: Holding[]): string {
  const broker = holdings.find(h => h.accountType === type)?.broker ?? ''
  const short = broker.slice(0, 2)
  return short ? `${short}_${type}` : type
}

function acctColor(type: string, holdings: Holding[], idx: number): string {
  const b = holdings.find(h => h.accountType === type)?.broker.toLowerCase() ?? ''
  if (b.includes('미래')) return '#F97316'
  if (b.includes('삼성')) return '#2563EB'
  return ACC_PALETTE[idx % ACC_PALETTE.length]
}

function insightTags(h: Holding, totalBuy: number): InsightTag[] {
  const tags: InsightTag[] = []
  const days = holdingDays(h.buyDate)
  const ann  = annualizedReturn(h.profitRate, h.buyDate)
  const buyPct = h.opBuy / totalBuy * 100
  if (days >= 30) {
    if (ann >= 15 && days >= 180) tags.push('핵심 보유')
    if (buyPct >= 8 && ann < 5 && days >= 90) tags.push('잠자는 돈')
  }
  const range = h.high52 - h.low52
  if (range > 0 && (h.currentPrice - h.low52) / range >= 0.95) tags.push('고점 근접')
  if (h.profitRate <= -15) tags.push('깊은 손실')
  if (days > 0 && days < 90) tags.push('단기')
  return tags
}

function pos52Color(pos: number): string {
  if (pos >= 90) return '#D97706'
  if (pos >= 40) return '#D91919'
  if (pos >= 20) return '#9CA3AF'
  return '#0D5AD9'
}

// ── Main Component ─────────────────────────────────────────────────────────
export function AnalysisPage({ portfolio, isLoading, error }: AnalysisPageProps) {
  const [expandedSection, setExpanded]  = useState<string | null>('matrix')
  const [accountTab, setAccountTab]     = useState<AccountTab>('현황')
  const [expandedQuad, setExpandedQuad] = useState<Set<string>>(new Set())

  const holdings = portfolio?.holdings ?? []

  const totalBuy = useMemo(() =>
    Math.max(holdings.reduce((s, h) => s + h.opBuy, 0), 1), [holdings])

  const orderedAccounts = useMemo((): { key: string; value: GroupStat }[] => {
    const by = portfolio?.byAccount ?? {}
    const ordered = ACCOUNT_ORDER.filter(k => k in by).map(k => ({ key: k, value: by[k] }))
    const rest = Object.keys(by).filter(k => !ACCOUNT_ORDER.includes(k)).sort().map(k => ({ key: k, value: by[k] }))
    return [...ordered, ...rest]
  }, [portfolio])

  const matrix = useMemo(() => {
    const g = { shortProfit: [] as Holding[], longProfit: [] as Holding[], shortLoss: [] as Holding[], longLoss: [] as Holding[] }
    for (const h of holdings) {
      const long = holdingDays(h.buyDate) >= MATRIX_THRESHOLD
      if (!long && h.opProfit >= 0)  g.shortProfit.push(h)
      else if (long && h.opProfit >= 0) g.longProfit.push(h)
      else if (!long) g.shortLoss.push(h)
      else g.longLoss.push(h)
    }
    return g
  }, [holdings])

  const annItems = useMemo(() => holdings
    .filter(h => holdingDays(h.buyDate) >= 30)
    .map(h => {
      const short = h.broker.slice(0, 2)
      const baseName = short ? `${h.name} (${short}_${h.accountType})` : h.name
      const duration = holdingDurationText(h.buyDate) ?? `${holdingDays(h.buyDate)}일`
      const ann = parseFloat(annualizedReturn(h.profitRate, h.buyDate).toFixed(1))
      return { name: `${h.code}|${h.accountType}`, baseName, duration, ann, profitRate: h.profitRate }
    })
    .sort((a, b) => b.ann - a.ann)
    .slice(0, 15),
  [holdings])

  const pos52Items = useMemo(() => holdings
    .filter(h => h.high52 > h.low52)
    .map(h => ({ h, pos: position52w(h.currentPrice, h.low52, h.high52), tags: insightTags(h, totalBuy) }))
    .sort((a, b) => b.pos - a.pos),
  [holdings, totalBuy])

  const toggleSection = (id: string) => setExpanded(p => p === id ? null : id)
  const toggleQuad = (title: string) => setExpandedQuad(prev => {
    const n = new Set(prev)
    n.has(title) ? n.delete(title) : n.add(title)
    return n
  })

  const matrixDefs: { title: string; items: Holding[]; highlight: boolean; warn: boolean }[] = [
    { title: '빠른 수익',  items: matrix.shortProfit, highlight: false, warn: false },
    { title: '장기 우량 ★', items: matrix.longProfit,  highlight: true,  warn: false },
    { title: '판단 유보',  items: matrix.shortLoss,   highlight: false, warn: false },
    { title: '자본 묶임 ⚠', items: matrix.longLoss,    highlight: false, warn: true  },
  ]

  if (isLoading) return (
    <div className="h-[100dvh] flex items-center justify-center bg-[rgb(var(--page-bg))]">
      <LoadingSpinner message="분석 데이터 불러오는 중..." />
    </div>
  )
  if (error) return (
    <div className="h-[100dvh] bg-[rgb(var(--page-bg))] p-4 pt-12">
      <Card className="p-4 text-sm text-red-500">{error}</Card>
    </div>
  )

  return (
    <div className="h-[100dvh] overflow-y-auto no-scrollbar bg-[rgb(var(--page-bg))] pb-32">
      <div className="px-4 pt-12 pb-3">
        <h2 className="text-[28px] font-bold">분석</h2>
      </div>

      <div className="px-4 space-y-3">

        {/* ── 1. 투자 효율 매트릭스 ── */}
        <SectionCard title="투자 효율 매트릭스"
          expanded={expandedSection === 'matrix'} onToggle={() => toggleSection('matrix')}>
          <div
            className="grid gap-2 pt-2"
            style={{ gridTemplateColumns: '18px 1fr 1fr' }}
          >
            {/* Row 0: header */}
            <div />
            <div className="text-[10px] text-gray-400 text-center pb-1">단기 (6개월 미만)</div>
            <div className="text-[10px] text-gray-400 text-center pb-1">장기 (6개월 이상)</div>
            {/* Row 1: 수익 */}
            <div className="text-[10px] text-gray-400 flex items-center justify-center">수익</div>
            <QuadrantCell g={matrixDefs[0]} expanded={expandedQuad.has(matrixDefs[0].title)} onToggle={() => toggleQuad(matrixDefs[0].title)} />
            <QuadrantCell g={matrixDefs[1]} expanded={expandedQuad.has(matrixDefs[1].title)} onToggle={() => toggleQuad(matrixDefs[1].title)} />
            {/* Row 2: 손실 */}
            <div className="text-[10px] text-gray-400 flex items-center justify-center">손실</div>
            <QuadrantCell g={matrixDefs[2]} expanded={expandedQuad.has(matrixDefs[2].title)} onToggle={() => toggleQuad(matrixDefs[2].title)} />
            <QuadrantCell g={matrixDefs[3]} expanded={expandedQuad.has(matrixDefs[3].title)} onToggle={() => toggleQuad(matrixDefs[3].title)} />
          </div>
        </SectionCard>

        {/* ── 2. 계좌별 분석 ── */}
        <SectionCard title="계좌별 분석"
          expanded={expandedSection === 'account'} onToggle={() => toggleSection('account')}>
          <div className="pt-2">
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {ACCOUNT_TABS.map(t => (
                <button key={t} onClick={() => setAccountTab(t)}
                  className={`px-3 py-1.5 rounded-full text-[11px] transition-colors ${
                    accountTab === t
                      ? 'bg-accent text-white font-bold'
                      : 'bg-[rgb(var(--page-bg))] text-gray-500 font-normal'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            {accountTab === '현황'  && <AccSummaryView   accounts={orderedAccounts} holdings={holdings} />}
            {accountTab === '수익률' && <AccProfitView    accounts={orderedAccounts} holdings={holdings} />}
            {accountTab === '비중'  && <AccAllocView     accounts={orderedAccounts} holdings={holdings} />}
            {accountTab === '오늘'  && <AccTodayView     accounts={orderedAccounts} holdings={holdings} />}
            {accountTab === '종목'  && <AccTopBottomView accounts={orderedAccounts} holdings={holdings} />}
          </div>
        </SectionCard>

        {/* ── 3. 연 환산 수익률 ── */}
        <SectionCard title="연 환산 수익률"
          expanded={expandedSection === 'annualized'} onToggle={() => toggleSection('annualized')}>
          <div className="pt-2">
            {annItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">30일 이상 보유 종목 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={annItems.length * 56 + 20}>
                <BarChart layout="vertical" data={annItems} margin={{ top: 0, right: 52, bottom: 0, left: 4 }}>
                  <XAxis type="number" tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={150}
                    tick={(props: any) => <AnnYTick {...props} items={annItems} />}
                    tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '연환산']} />
                  <ReferenceLine x={0} stroke="#E5E7EB" />
                  <Bar dataKey="ann" radius={[0, 4, 4, 0]}
                    label={{ position: 'right', formatter: (v: number) => `${v.toFixed(1)}%`, fontSize: 10, fontWeight: 600, fill: '#6B7280' }}>
                    {annItems.map(e => (
                      <Cell key={e.name} fill={e.ann >= 0 ? '#D91919' : '#0D5AD9'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        {/* ── 4. 52주 포지션 ── */}
        <SectionCard title="52주 포지션"
          expanded={expandedSection === 'position52'} onToggle={() => toggleSection('position52')}>
          <div className="pt-2">
            <div className="flex justify-between text-[10px] text-gray-400 mb-3">
              <span>저점</span><span>고점</span>
            </div>
            <div className="space-y-4">
              {pos52Items.map(({ h, pos, tags }) => (
                <div key={`${h.code}-${h.accountType}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium truncate max-w-[130px]">{h.name}</span>
                    <div className="flex items-center gap-1">
                      {tags.map(tag => (
                        <span key={tag} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TAG_STYLE[tag]}`}>
                          {tag}
                        </span>
                      ))}
                      <span className="text-[10px] text-gray-400 w-7 text-right">{Math.round(pos)}%</span>
                    </div>
                  </div>
                  <div className="relative h-[5px] bg-gray-100 dark:bg-gray-700 rounded-full">
                    <div className="absolute h-full rounded-full"
                      style={{ width: `${Math.max(2, Math.min(100, pos))}%`, background: pos52Color(pos) + '50' }} />
                    <div className="absolute w-[9px] h-[9px] rounded-full -translate-x-1/2 -translate-y-[2px]"
                      style={{ left: `${Math.max(2, Math.min(98, pos))}%`, background: pos52Color(pos) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ title, expanded, onToggle, children }: {
  title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <button className="w-full flex items-center justify-between px-5 py-5" onClick={onToggle}>
        <span className="font-semibold text-base">{title}</span>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && <div className="px-5 pb-5">{children}</div>}
    </Card>
  )
}

function QuadrantCell({ g, expanded, onToggle }: {
  g: { title: string; items: Holding[]; highlight: boolean; warn: boolean }
  expanded: boolean; onToggle: () => void
}) {
  const bg = g.highlight
    ? 'bg-profit/10 border border-profit/30'
    : g.warn
    ? 'bg-loss/8 border border-loss/25'
    : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50'
  const titleColor = g.highlight ? 'text-profit' : g.warn ? 'text-loss' : 'text-gray-600 dark:text-gray-300'
  const displayed = expanded ? g.items : g.items.slice(0, 3)

  return (
    <div className={`rounded-xl p-2.5 min-h-[80px] ${bg} ${g.items.length > 3 ? 'cursor-pointer' : ''}`}
      onClick={() => g.items.length > 3 && onToggle()}>
      <div className="flex items-center justify-between mb-1.5">
        <p className={`text-[10px] font-semibold ${titleColor}`}>{g.title}</p>
        {g.items.length > 3 && <span className="text-[9px] text-gray-400">{expanded ? '▲' : '▼'}</span>}
      </div>
      {g.items.length === 0
        ? <p className="text-[10px] text-gray-400">없음</p>
        : <>
            {displayed.map(h => (
              <p key={h.code + h.accountType} className="text-[10px] truncate leading-snug">{h.name}</p>
            ))}
            {!expanded && g.items.length > 3 && (
              <p className="text-[10px] text-gray-400">+{g.items.length - 3}개</p>
            )}
          </>
      }
    </div>
  )
}

function AnnYTick({ x, y, payload, items }: any) {
  const item = (items as { name: string; baseName: string; duration: string; profitRate: number }[])
    .find(i => i.name === payload.value)
  if (!item) return null
  const truncated = item.baseName.length > 15 ? item.baseName.slice(0, 15) + '…' : item.baseName
  const rateColor = item.profitRate >= 0 ? '#D91919' : '#0D5AD9'
  const sign = item.profitRate >= 0 ? '+' : ''
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-4} y={-6} textAnchor="end" fontSize={10} fontWeight={500} fill="currentColor">{truncated}</text>
      <text x={-4} y={7} textAnchor="end" fontSize={9} fill="#9CA3AF">
        {item.duration} · <tspan fill={rateColor} fontWeight={600}>{sign}{item.profitRate.toFixed(1)}%</tspan>
      </text>
    </g>
  )
}

function AccSummaryView({ accounts, holdings }: { accounts: { key: string; value: GroupStat }[]; holdings: Holding[] }) {
  return (
    <div>
      <div className="flex text-[10px] text-gray-400 pb-2 border-b border-gray-100 dark:border-gray-700">
        <span className="flex-1">계좌</span>
        <span className="w-28 text-right">평가금액</span>
        <span className="w-16 text-right">수익률</span>
      </div>
      {accounts.map(({ key, value }) => (
        <div key={key} className="flex items-center py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs font-medium truncate">{acctLabel(key, holdings)}</p>
            <p className="text-[10px] text-gray-400">매입 {krwFull(value.buy)}</p>
          </div>
          <span className="w-28 text-right text-xs font-medium shrink-0">{krwFull(value.current)}</span>
          <span className={`w-16 text-right text-xs font-semibold shrink-0 ${profitTextClass(value.profitRate)}`}>
            {pctFormatted(value.profitRate)}
          </span>
        </div>
      ))}
    </div>
  )
}

function AccProfitView({ accounts, holdings }: { accounts: { key: string; value: GroupStat }[]; holdings: Holding[] }) {
  const data = accounts.map((a, i) => ({
    name: acctLabel(a.key, holdings),
    value: a.value.profitRate,
    color: acctColor(a.key, holdings, i),
  }))
  const rates = data.map(d => d.value)
  const xMin = Math.min(...rates, 0) - 2
  const xMax = Math.max(...rates, 0) + 5

  return (
    <ResponsiveContainer width="100%" height={data.length * 52}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 56, bottom: 0, left: 4 }}>
        <XAxis type="number" tickFormatter={v => `${v}%`}
          tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
          domain={[xMin, xMax]} />
        <YAxis type="category" dataKey="name" width={104}
          tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '수익률']} />
        <ReferenceLine x={0} stroke="#E5E7EB" />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}
          label={{
            position: 'right',
            formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
            fontSize: 11, fontWeight: 600, fill: '#6B7280',
          }}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function AccAllocView({ accounts, holdings }: { accounts: { key: string; value: GroupStat }[]; holdings: Holding[] }) {
  const data = accounts.map((a, i) => ({
    name: acctLabel(a.key, holdings),
    buy: a.value.buy,
    pct: a.value.pct,
    profitRate: a.value.profitRate,
    color: ACC_PALETTE[i % ACC_PALETTE.length],
  }))
  return (
    <div className="flex items-center gap-4">
      <PieChart width={116} height={116}>
        <Pie data={data} dataKey="buy" cx={53} cy={53} innerRadius={28} outerRadius={53} paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v: number) => [krwFull(v), '매입금액']} />
      </PieChart>
      <div className="flex-1 space-y-1.5">
        <div className="flex text-[10px] text-gray-400 pb-1 border-b border-gray-100 dark:border-gray-700">
          <span className="flex-1">계좌</span>
          <span className="w-8 text-right">비중</span>
          <span className="w-14 text-right">수익률</span>
        </div>
        {data.map((d, i) => (
          <div key={i} className="flex items-center">
            <div className="w-2 h-2 rounded-full shrink-0 mr-1.5" style={{ background: d.color }} />
            <span className="text-[10px] flex-1 truncate">{d.name}</span>
            <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(d.pct)}%</span>
            <span className={`text-[10px] font-semibold w-14 text-right ${profitTextClass(d.profitRate)}`}>
              {pctFormatted(d.profitRate)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccTodayView({ accounts, holdings }: { accounts: { key: string; value: GroupStat }[]; holdings: Holding[] }) {
  const todayMap: Record<string, number> = {}
  for (const h of holdings) todayMap[h.accountType] = (todayMap[h.accountType] ?? 0) + h.change * h.quantity

  return (
    <div className="space-y-2">
      {accounts.map(({ key, value }) => {
        const amt = todayMap[key] ?? 0
        const pct = value.current > 0 ? amt / value.current * 100 : 0
        return (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: (amt >= 0 ? '#D91919' : '#0D5AD9') + '12' }}>
            <div>
              <p className="text-xs font-medium">{acctLabel(key, holdings)}</p>
              <p className="text-[10px] text-gray-400">종목 {value.count}개</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${profitTextClass(amt)}`}>{krwFull(amt)}</p>
              <p className={`text-[10px] ${profitTextClass(pct)}`}>{pctFormatted(pct)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AccTopBottomView({ accounts, holdings }: { accounts: { key: string; value: GroupStat }[]; holdings: Holding[] }) {
  return (
    <div className="space-y-3">
      {accounts.map(({ key }, idx) => {
        const list = holdings.filter(h => h.accountType === key).sort((a, b) => b.profitRate - a.profitRate)
        const top    = list[0]
        const bottom = list.length > 1 ? list[list.length - 1] : null
        return (
          <div key={key}>
            <p className="text-[10px] font-semibold text-gray-400 mb-1.5">{acctLabel(key, holdings)}</p>
            <div className="flex gap-2">
              {top && (
                <div className="flex-1 p-2 rounded-lg bg-profit/8">
                  <p className="text-[9px] font-bold text-profit mb-1">대장</p>
                  <p className="text-[10px] font-medium truncate">{top.name}</p>
                  <p className={`text-[10px] font-bold ${profitTextClass(top.profitRate)}`}>{pctFormatted(top.profitRate)}</p>
                </div>
              )}
              {bottom && (
                <div className="flex-1 p-2 rounded-lg bg-loss/8">
                  <p className="text-[9px] font-bold text-loss mb-1">골칫</p>
                  <p className="text-[10px] font-medium truncate">{bottom.name}</p>
                  <p className={`text-[10px] font-bold ${profitTextClass(bottom.profitRate)}`}>{pctFormatted(bottom.profitRate)}</p>
                </div>
              )}
            </div>
            {idx < accounts.length - 1 && <div className="border-b border-gray-100 dark:border-gray-700 mt-3" />}
          </div>
        )
      })}
    </div>
  )
}
