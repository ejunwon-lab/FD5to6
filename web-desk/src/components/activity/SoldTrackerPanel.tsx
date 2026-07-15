import { useMemo } from 'react'
import { useSoldTracker } from '../../lib/DataProvider'
import { Panel } from '../ui/Panel'

// 매도 복기 (What-if) — 판 종목의 "안 팔았다면 오늘 손익" vs "실제 실현손익".
// diff(판것대비차이) +면 더 벌 수 있었음(아쉬움), −면 잘 팔았음(하락 후). 국내만 집계(해외 환율 미반영).
export function SoldTrackerPanel() {
  const { items, loading, error, asOfDate } = useSoldTracker()

  const stats = useMemo(() => {
    const scored = items.filter((it) => it.diff != null)
    const totalDiff = scored.reduce((s, it) => s + (it.diff ?? 0), 0)
    const regret = scored.filter((it) => (it.diff ?? 0) > 0).length   // 더 벌 수 있었음
    const good = scored.filter((it) => (it.diff ?? 0) < 0).length     // 잘 팔았음
    return { totalDiff, regret, good, scoredN: scored.length }
  }, [items])

  const meta = loading ? 'loading...' : error ? `ERROR: ${error}`
    : `${items.length} closes · 기준 ${asOfDate ?? '—'}`

  return (
    <Panel title="매도 복기 · 안 팔았다면?" meta={meta}>
      {/* 요약 strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border-b border-line">
        <Stat label="안 팔았다면 총" value={fmtSignedKrw(stats.totalDiff)} tone={stats.totalDiff >= 0 ? 'amber' : 'up'} sub={stats.totalDiff >= 0 ? '더 벌 수 있었음' : '판 게 이득'} />
        <Stat label="더 벌 수 있던 건" value={`${stats.regret}`} tone="amber" sub="oppty lost" />
        <Stat label="잘 판 건" value={`${stats.good}`} tone="up" sub="sold well" />
        <Stat label="집계 종목" value={`${stats.scoredN}/${items.length}`} sub="국내만" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1040px]">
          <thead>
            <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line">
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">매도일</th>
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">종목</th>
              <th className="px-3 pt-2 pb-1.5 text-left font-medium">증권사·계좌</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">수량</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">매도가</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">현재가</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">실현손익</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">안 팔았다면</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">판것 대비 차이</th>
              <th className="px-3 pt-2 pb-1.5 text-right font-medium">경과</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const hasWhatIf = it.diff != null
              const diffPos = (it.diff ?? 0) >= 0
              return (
                <tr key={`${it.code}-${it.sellDate}-${i}`} className="border-b border-line-dim hover:bg-bg-hover">
                  <td className="px-3 py-2 text-ink-dim tabular whitespace-nowrap">{it.sellDate}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-amber font-medium leading-tight">{it.name}</div>
                    <div className="text-xxs text-ink-faint tabular leading-tight">{it.code}</div>
                  </td>
                  <td className="px-3 py-2 text-ink-dim text-xxs leading-tight whitespace-nowrap">
                    <div>{it.broker || '—'}</div>
                    <div className="text-ink-faint">{it.account || ''}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{it.sellQty != null ? it.sellQty.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2 text-right tabular text-ink-dim">{it.sellPrice != null ? Math.round(it.sellPrice).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2 text-right tabular text-ink-dim">{it.currentPrice != null ? Math.round(it.currentPrice).toLocaleString() : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular ${(it.realizedProfit ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {it.realizedProfit != null ? fmtSignedKrw(it.realizedProfit) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right tabular ${hasWhatIf ? ((it.ifHeldProfit ?? 0) >= 0 ? 'text-gain' : 'text-loss') : 'text-ink-faint'}`}>
                    {hasWhatIf ? fmtSignedKrw(it.ifHeldProfit ?? 0) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right tabular font-medium ${hasWhatIf ? (diffPos ? 'text-amber' : 'text-gain') : 'text-ink-faint'}`}>
                    {hasWhatIf ? `${fmtSignedKrw(it.diff ?? 0)}` : '해외·제외'}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink-faint">{it.elapsedDays != null ? `${it.elapsedDays}일` : '—'}</td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan={10} className="text-center text-ink-faint py-10 text-xs">{loading ? 'loading...' : 'no sold positions'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-2xs text-ink-faint">
        차이 = (현재가 − 매도가) × 수량. <span className="text-amber">+</span> 안 팔았다면 더 벌 수 있었음 · <span className="text-gain">−</span> 잘 팔았음. 해외는 환율 미반영으로 집계 제외.
      </div>
    </Panel>
  )
}

function fmtSignedKrw(n: number): string {
  const v = Math.round(n)
  return `${v >= 0 ? '+' : ''}₩${v.toLocaleString()}`
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'up' | 'down' | 'amber' }) {
  return (
    <div className="bg-bg-elev px-3.5 py-3">
      <div className="text-xxs text-ink-faint tracking-widest2 uppercase mb-1.5">{label}</div>
      <div className={`text-[18px] font-medium tabular ${tone === 'up' ? 'text-gain' : tone === 'down' ? 'text-loss' : tone === 'amber' ? 'text-amber' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-ink-dim tabular mt-0.5">{sub}</div>
    </div>
  )
}
