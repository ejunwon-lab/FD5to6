import { useMemo, useState } from 'react'
import { usePortfolio } from '../../lib/usePortfolio'
import { holdings as sampleHoldings } from '../../lib/sampleData'
import { Panel } from '../ui/Panel'
import type { Market } from '../../lib/types'

type SortKey = 'value' | 'returnPct' | 'weightPct' | 'symbol' | 'name'

export function HoldingsPage() {
  const { holdings: liveHoldings, loading } = usePortfolio()
  const all = (liveHoldings.length ? liveHoldings : sampleHoldings)

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' })
  const [marketFilter, setMarketFilter] = useState<Market | 'ALL'>('ALL')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let h = all
    if (marketFilter !== 'ALL') h = h.filter((x) => x.market === marketFilter)
    if (query) {
      const q = query.toLowerCase()
      h = h.filter((x) => x.symbol.toLowerCase().includes(q) || x.name.toLowerCase().includes(q))
    }
    h = [...h].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return h
  }, [all, sort, marketFilter, query])

  // 통계 요약
  const stats = useMemo(() => {
    const total = all.reduce((s, h) => s + h.value, 0)
    const gainCount = all.filter((h) => h.returnPct > 0).length
    const lossCount = all.filter((h) => h.returnPct < 0).length
    const sorted = [...all].sort((a, b) => b.returnPct - a.returnPct)
    const top = sorted[0]
    const bottom = sorted[sorted.length - 1]
    return { total, gainCount, lossCount, top, bottom, count: all.length }
  }, [all])

  return (
    <div className="overflow-y-auto p-3 grid gap-2.5">
      {/* Stat strip */}
      <div className="grid grid-cols-5 gap-px bg-line border border-line">
        <Stat label="Positions" value={`${stats.count}`} sub={`${stats.gainCount} gain · ${stats.lossCount} loss`} />
        <Stat label="Total Value" value={`₩${(stats.total / 1e6).toFixed(2)}M`} sub={`${(stats.total).toLocaleString()} KRW`} />
        <Stat label="Best" value={stats.top?.symbol ?? '—'} sub={stats.top ? `${stats.top.returnPct >= 0 ? '+' : ''}${stats.top.returnPct.toFixed(1)}%` : ''} tone="up" />
        <Stat label="Worst" value={stats.bottom?.symbol ?? '—'} sub={stats.bottom ? `${stats.bottom.returnPct >= 0 ? '+' : ''}${stats.bottom.returnPct.toFixed(1)}%` : ''} tone="down" />
        <Stat label="Concentration" value={`${stats.count ? ((all[0]?.weightPct ?? 0)).toFixed(1) : 0}%`} sub={`top 1 weight`} tone="cyan" />
      </div>

      {/* Filter + search */}
      <div className="flex gap-2 items-center text-xs">
        <span className="text-ink-faint uppercase tracking-widest text-2xs">market</span>
        {(['ALL', 'KR', 'US'] as const).map((m) => (
          <button key={m}
            onClick={() => setMarketFilter(m)}
            className={`border px-2.5 py-0.5 text-2xs tracking-widest uppercase ${
              marketFilter === m ? 'bg-amber border-amber text-bg' : 'border-line text-ink-dim hover:text-ink'
            }`}>{m}</button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search symbol or name..."
          className="ml-3 bg-bg-elev border border-line text-ink px-3 py-1 text-xs flex-1 max-w-md focus:outline-none focus:border-amber"
        />
        {loading && <span className="text-ink-faint text-2xs">loading...</span>}
      </div>

      {/* Full table */}
      <Panel title={`Holdings · ${filtered.length} of ${all.length}`} meta="CLICK COLUMN TO SORT" className="">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line">
              <Th>Rank</Th>
              <Th sortable sort={sort} k="symbol" onSort={setSort}>Symbol</Th>
              <Th sortable sort={sort} k="name" onSort={setSort}>Name</Th>
              <Th>Mkt</Th>
              <Th right>Shares</Th>
              <Th right>Avg Cost</Th>
              <Th right sortable sort={sort} k="value" onSort={setSort}>Value</Th>
              <Th right sortable sort={sort} k="returnPct" onSort={setSort}>Return</Th>
              <Th right sortable sort={sort} k="weightPct" onSort={setSort}>Weight</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h, i) => (
              <tr key={h.symbol} className="border-b border-line-dim hover:bg-bg-hover">
                <td className="px-3 py-2 text-ink-faint tabular">{String(i + 1).padStart(2, '0')}</td>
                <td className="px-3 py-2 text-amber font-medium">{h.symbol}</td>
                <td className="px-3 py-2 text-ink-dim">{h.name}</td>
                <td className="px-3 py-2"><span className="text-cyan text-2xs tracking-widest">{h.market}</span></td>
                <td className="px-3 py-2 text-right tabular">{h.shares.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular text-ink-dim">
                  {h.market === 'KR' ? `₩${h.avgPrice.toLocaleString()}` : `$${h.avgPrice.toFixed(2)}`}
                </td>
                <td className="px-3 py-2 text-right tabular">₩{h.value.toLocaleString()}</td>
                <td className={`px-3 py-2 text-right tabular ${h.returnPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {h.returnPct >= 0 ? '+' : ''}{h.returnPct.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="tabular text-ink-dim">{h.weightPct.toFixed(1)}%</span>
                  <div className="h-0.5 bg-line mt-1 ml-auto" style={{ width: '60px' }}>
                    <div className="h-full bg-amber" style={{ width: `${Math.min(h.weightPct, 100)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center text-ink-faint py-10 text-xs">no matches</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

interface ThProps {
  children: React.ReactNode
  right?: boolean
  sortable?: boolean
  k?: SortKey
  sort?: { key: SortKey; dir: 'asc' | 'desc' }
  onSort?: (s: { key: SortKey; dir: 'asc' | 'desc' }) => void
}

function Th({ children, right, sortable, k, sort, onSort }: ThProps) {
  const align = right ? 'text-right' : 'text-left'
  if (!sortable || !k || !sort || !onSort) {
    return <th className={`px-3 pt-2 pb-1.5 ${align} font-medium`}>{children}</th>
  }
  const active = sort.key === k
  return (
    <th
      className={`px-3 pt-2 pb-1.5 ${align} font-medium cursor-pointer hover:text-amber ${active ? 'text-amber' : ''}`}
      onClick={() => onSort({ key: k, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
    >
      {children}
      {active && <span className="ml-1">{sort.dir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'up' | 'down' | 'cyan' }) {
  return (
    <div className="bg-bg-elev px-3.5 py-3.5">
      <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1.5">{label}</div>
      <div className={`text-[22px] font-medium tabular ${tone === 'up' ? 'text-gain' : tone === 'down' ? 'text-loss' : tone === 'cyan' ? 'text-cyan' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-ink-dim tabular mt-0.5">{sub}</div>
    </div>
  )
}
