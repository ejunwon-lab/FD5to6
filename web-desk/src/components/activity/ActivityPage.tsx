import { useMemo, useState } from 'react'
import { useRealized } from '../../lib/useRealized'
import { Panel } from '../ui/Panel'

const SAMPLE_REALIZED = [
  { date: '2026-05-20', month: '2026-05', code: 'NVDA',    name: 'NVIDIA',     broker: '미래에셋', account: '종합_랩',
    quantity: 2,  sellPrice: 1_900_000, sellAmount: 3_800_000, avgBuyPrice: 1_670_000, buyCost: 3_340_000, fee:  3_800, profit:   458_200, returnPct: 13.7 },
  { date: '2026-05-12', month: '2026-05', code: '035720',  name: '카카오',      broker: '삼성',     account: 'ISA',
    quantity: 10, sellPrice:    44_500, sellAmount:   445_000, avgBuyPrice:    57_000, buyCost:   570_000, fee:    600, profit:  -125_600, returnPct: -22.0 },
  { date: '2026-04-22', month: '2026-04', code: 'TSLA',    name: 'Tesla',      broker: '미래에셋', account: '종합_랩',
    quantity: 5,  sellPrice:   330_000, sellAmount: 1_650_000, avgBuyPrice:   307_000, buyCost: 1_535_000, fee:  1_700, profit:   113_300, returnPct: 7.4 },
  { date: '2026-04-09', month: '2026-04', code: '000660',  name: 'SK하이닉스',  broker: '미래에셋', account: '종합_랩',
    quantity: 20, sellPrice:   215_000, sellAmount: 4_300_000, avgBuyPrice:   195_000, buyCost: 3_900_000, fee:  4_300, profit:   395_700, returnPct: 10.1 },
  { date: '2026-03-18', month: '2026-03', code: 'AAPL',    name: 'Apple',      broker: '미래에셋', account: '종합_랩',
    quantity: 8,  sellPrice:   300_000, sellAmount: 2_400_000, avgBuyPrice:   281_500, buyCost: 2_252_000, fee:  2_400, profit:   145_600, returnPct: 6.5 },
  { date: '2026-03-05', month: '2026-03', code: '005930',  name: '삼성전자',    broker: '삼성',     account: '퇴직연금',
    quantity: 15, sellPrice:    76_000, sellAmount: 1_140_000, avgBuyPrice:    61_700, buyCost:   925_500, fee:  1_500, profit:   213_000, returnPct: 23.0 },
  { date: '2026-02-26', month: '2026-02', code: 'MSFT',    name: 'Microsoft',  broker: '미래에셋', account: '종합_랩',
    quantity: 4,  sellPrice:   560_000, sellAmount: 2_240_000, avgBuyPrice:   536_000, buyCost: 2_144_000, fee:  2_240, profit:    93_760, returnPct: 4.4 },
  { date: '2026-02-11', month: '2026-02', code: '005380',  name: '현대차',      broker: '삼성',     account: 'ISA',
    quantity: 8,  sellPrice:   245_000, sellAmount: 1_960_000, avgBuyPrice:   250_000, buyCost: 2_000_000, fee:  1_960, profit:   -41_960, returnPct: -2.1 },
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
    const totalFee = data.reduce((s, e) => s + (e.fee ?? 0), 0)
    const byMonth = new Map<string, number>()
    data.forEach((e) => {
      byMonth.set(e.month, (byMonth.get(e.month) ?? 0) + e.profit)
    })
    const monthly = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    return { total, winCount, lossCount, winSum, lossSum, totalFee, monthly }
  }, [data])

  const filtered = selectedMonth === 'ALL' ? data : data.filter((e) => e.month === selectedMonth)

  return (
    <div className="overflow-y-auto p-2 sm:p-3 grid gap-2.5">
      {/* Summary strip — 6 KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-line border border-line">
        <Stat label="Realized P&L"  value={fmtSignedKrw(stats.total)}                                   sub="all-time"                                                    tone={stats.total >= 0 ? 'up' : 'down'} />
        <Stat label="Win Trades"    value={`${stats.winCount}`}                                         sub={`+₩${Math.round(stats.winSum).toLocaleString()}`}              tone="up" />
        <Stat label="Loss Trades"   value={`${stats.lossCount}`}                                        sub={`₩${Math.round(stats.lossSum).toLocaleString()}`}              tone="down" />
        <Stat label="Win Rate"      value={`${data.length ? Math.round((stats.winCount / data.length) * 100) : 0}%`} sub={`${data.length} closed`} />
        <Stat label="Avg Trade"     value={fmtSignedKrw(stats.total / Math.max(data.length, 1))}        sub="per close"                                                    tone="cyan" />
        <Stat label="Total Fees"    value={`₩${Math.round(stats.totalFee).toLocaleString()}`}           sub={`${data.length ? Math.round(stats.totalFee / data.length).toLocaleString() : 0}/trade`} />
      </div>

      {/* Monthly P&L bar */}
      <Panel title="Monthly P&L" meta={loading ? 'loading...' : error ? `ERROR: ${error}` : `${stats.monthly.length} months`}>
        <div className="p-3">
          <div className="flex gap-2 items-end h-28">
            {stats.monthly.slice(0, 12).reverse().map(([month, profit]) => {
              const max = Math.max(...stats.monthly.map((m) => Math.abs(m[1])), 1)
              const heightPct = (Math.abs(profit) / max) * 100
              const up = profit >= 0
              return (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month === selectedMonth ? 'ALL' : month)}
                  className="flex-1 flex flex-col items-center gap-1 group"
                  title={`${month}: ${fmtSignedKrw(profit)}`}
                >
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className={`w-full transition-all ${up ? 'bg-gain' : 'bg-loss'} ${selectedMonth === month ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
                      style={{ height: `${heightPct}%`, minHeight: '2px' }}
                    />
                  </div>
                  <div className={`text-2xs tabular ${up ? 'text-gain' : 'text-loss'}`}>
                    {fmtSignedKrw(profit)}
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
      <div className="flex items-center gap-2 text-xs flex-wrap">
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
        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[960px]">
          <thead>
            <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line">
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">Date</th>
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">종목</th>
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">증권사·계좌</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">수량</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">매수가</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">매도가</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">수수료</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">손익 (₩)</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">수익률</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={`${e.date}-${e.code}-${i}`} className="border-b border-line-dim hover:bg-bg-hover">
                <td className="px-3 py-2 text-ink-dim tabular whitespace-nowrap">{e.date}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="text-amber font-medium leading-tight">{e.name}</div>
                  <div className="text-xxs text-ink-faint tabular leading-tight">{e.code}</div>
                </td>
                <td className="px-3 py-2 text-ink-dim text-xxs leading-tight whitespace-nowrap">
                  <div>{e.broker ?? '—'}</div>
                  <div className="text-ink-faint">{e.account ?? ''}</div>
                </td>
                <td className="px-3 py-2 text-right tabular">{e.quantity.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular text-ink-dim">{e.avgBuyPrice != null ? Math.round(e.avgBuyPrice).toLocaleString() : '—'}</td>
                <td className="px-3 py-2 text-right tabular text-ink-dim">{e.sellPrice != null ? Math.round(e.sellPrice).toLocaleString() : '—'}</td>
                <td className="px-3 py-2 text-right tabular text-ink-faint">{e.fee != null ? Math.round(e.fee).toLocaleString() : '—'}</td>
                <td className={`px-3 py-2 text-right tabular ${e.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {fmtSignedKrw(e.profit)}
                </td>
                <td className={`px-3 py-2 text-right tabular ${(e.returnPct ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {e.returnPct != null ? `${e.returnPct >= 0 ? '+' : ''}${e.returnPct.toFixed(2)}%` : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center text-ink-faint py-10 text-xs">no closed trades</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Panel>
    </div>
  )
}

function fmtSignedKrw(n: number): string {
  const v = Math.round(n)
  return `${v >= 0 ? '+' : ''}₩${v.toLocaleString()}`
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
