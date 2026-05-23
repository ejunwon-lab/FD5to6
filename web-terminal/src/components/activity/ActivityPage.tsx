import { useMemo, useState } from 'react'
import { useRealized } from '../../lib/useRealized'
import { Panel } from '../ui/Panel'

const SAMPLE_REALIZED = [
  { month: '2026-05', code: 'NVDA',    name: 'NVIDIA',    quantity: 2,  profit:   458_200, returnPct: 14.2 },
  { month: '2026-05', code: '035720',  name: '카카오',     quantity: 10, profit:  -120_000, returnPct: -4.8 },
  { month: '2026-04', code: 'TSLA',    name: 'Tesla',     quantity: 5,  profit:    82_500, returnPct: 6.5 },
  { month: '2026-04', code: '000660',  name: 'SK하이닉스', quantity: 20, profit:   320_000, returnPct: 11.4 },
  { month: '2026-03', code: 'AAPL',    name: 'Apple',     quantity: 8,  profit:   145_600, returnPct: 5.8 },
  { month: '2026-03', code: '005930',  name: '삼성전자',   quantity: 15, profit:   210_000, returnPct: 4.3 },
  { month: '2026-02', code: 'MSFT',    name: 'Microsoft', quantity: 4,  profit:    96_400, returnPct: 8.2 },
  { month: '2026-02', code: '005380',  name: '현대차',     quantity: 8,  profit:   -42_000, returnPct: -2.1 },
]

export function ActivityPage() {
  const { entries, loading, error } = useRealized()
  const data = entries.length ? entries : SAMPLE_REALIZED

  const [selectedMonth, setSelectedMonth] = useState<string>('ALL')

  const stats = useMemo(() => {
    const total = data.reduce((s, e) => s + e.profit, 0)
    const winCount = data.filter((e) => e.profit > 0).length
    const lossCount = data.filter((e) => e.profit < 0).length
    const winSum = data.filter((e) => e.profit > 0).reduce((s, e) => s + e.profit, 0)
    const lossSum = data.filter((e) => e.profit < 0).reduce((s, e) => s + e.profit, 0)
    const byMonth = new Map<string, number>()
    data.forEach((e) => {
      byMonth.set(e.month, (byMonth.get(e.month) ?? 0) + e.profit)
    })
    const monthly = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    return { total, winCount, lossCount, winSum, lossSum, monthly }
  }, [data])

  const filtered = selectedMonth === 'ALL' ? data : data.filter((e) => e.month === selectedMonth)

  return (
    <div className="overflow-y-auto p-3 grid gap-2.5">
      {/* Summary strip */}
      <div className="grid grid-cols-5 gap-px bg-line border border-line">
        <Stat label="Realized P&L" value={`${stats.total >= 0 ? '+' : ''}₩${stats.total.toLocaleString()}`} sub="all-time" tone={stats.total >= 0 ? 'up' : 'down'} />
        <Stat label="Win Trades" value={`${stats.winCount}`} sub={`+₩${stats.winSum.toLocaleString()}`} tone="up" />
        <Stat label="Loss Trades" value={`${stats.lossCount}`} sub={`₩${stats.lossSum.toLocaleString()}`} tone="down" />
        <Stat label="Win Rate" value={`${data.length ? Math.round((stats.winCount / data.length) * 100) : 0}%`} sub={`${data.length} closed`} />
        <Stat label="Avg Trade" value={`${stats.total >= 0 ? '+' : ''}₩${Math.round(stats.total / Math.max(data.length, 1)).toLocaleString()}`} sub="per close" tone="cyan" />
      </div>

      {/* Monthly P&L bar */}
      <Panel title="Monthly P&L" meta={loading ? 'loading...' : error ? `ERROR: ${error}` : `${stats.monthly.length} months`}>
        <div className="p-3">
          <div className="flex gap-2 items-end h-24">
            {stats.monthly.slice(0, 12).reverse().map(([month, profit]) => {
              const max = Math.max(...stats.monthly.map((m) => Math.abs(m[1])), 1)
              const heightPct = (Math.abs(profit) / max) * 100
              const up = profit >= 0
              return (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month === selectedMonth ? 'ALL' : month)}
                  className="flex-1 flex flex-col items-center gap-1 group"
                  title={`${month}: ${profit >= 0 ? '+' : ''}₩${profit.toLocaleString()}`}
                >
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className={`w-full transition-all ${up ? 'bg-gain' : 'bg-loss'} ${selectedMonth === month ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
                      style={{ height: `${heightPct}%`, minHeight: '2px' }}
                    />
                  </div>
                  <div className={`text-2xs tabular ${up ? 'text-gain' : 'text-loss'}`}>
                    {up ? '+' : ''}{Math.round(profit / 1e4)}만
                  </div>
                  <div className="text-2xs text-ink-faint">{month.slice(5)}</div>
                </button>
              )
            })}
          </div>
          <div className="mt-2 text-2xs text-ink-faint text-center">click month to filter table below</div>
        </div>
      </Panel>

      {/* Filter pills */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-ink-faint uppercase tracking-widest text-2xs">filter</span>
        <button
          onClick={() => setSelectedMonth('ALL')}
          className={`border px-2.5 py-0.5 text-2xs tracking-widest uppercase ${
            selectedMonth === 'ALL' ? 'bg-amber border-amber text-bg' : 'border-line text-ink-dim hover:text-ink'
          }`}
        >all</button>
        {stats.monthly.slice(0, 6).map(([m]) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            className={`border px-2.5 py-0.5 text-2xs tracking-widest uppercase ${
              selectedMonth === m ? 'bg-amber border-amber text-bg' : 'border-line text-ink-dim hover:text-ink'
            }`}
          >{m}</button>
        ))}
      </div>

      {/* Detail table */}
      <Panel title={`Realized Trades · ${filtered.length} closes`} meta={selectedMonth === 'ALL' ? 'ALL TIME' : selectedMonth}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line">
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">Month</th>
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">Symbol</th>
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">Name</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">Qty</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">Profit (₩)</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">Return</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={`${e.month}-${e.code}-${i}`} className="border-b border-line-dim hover:bg-bg-hover">
                <td className="px-3 py-2 text-ink-dim tabular">{e.month}</td>
                <td className="px-3 py-2 text-amber font-medium">{e.code}</td>
                <td className="px-3 py-2 text-ink-dim">{e.name}</td>
                <td className="px-3 py-2 text-right tabular">{e.quantity}</td>
                <td className={`px-3 py-2 text-right tabular ${e.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {e.profit >= 0 ? '+' : ''}{e.profit.toLocaleString()}
                </td>
                <td className={`px-3 py-2 text-right tabular ${(e.returnPct ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {e.returnPct != null ? `${e.returnPct >= 0 ? '+' : ''}${e.returnPct.toFixed(2)}%` : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-ink-faint py-10 text-xs">no closed trades</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'up' | 'down' | 'cyan' }) {
  return (
    <div className="bg-bg-elev px-3.5 py-3.5">
      <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1.5">{label}</div>
      <div className={`text-[20px] font-medium tabular ${tone === 'up' ? 'text-gain' : tone === 'down' ? 'text-loss' : tone === 'cyan' ? 'text-cyan' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-ink-dim tabular mt-0.5">{sub}</div>
    </div>
  )
}
