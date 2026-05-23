import { Panel } from '../ui/Panel'
import type { Holding } from '../../lib/types'

interface Props { holdings: Holding[] }

export function HoldingsTable({ holdings }: Props) {
  return (
    <Panel title={`Holdings · ${holdings.length} positions`} meta="SORT: VAL ↓" className="col-span-1 row-span-2">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left px-3 pt-2 pb-1.5 text-ink-faint font-medium text-2xs tracking-widest uppercase border-b border-line">Symbol</th>
            <th className="text-right px-3 pt-2 pb-1.5 text-ink-faint font-medium text-2xs tracking-widest uppercase border-b border-line">Value (₩)</th>
            <th className="text-right px-3 pt-2 pb-1.5 text-ink-faint font-medium text-2xs tracking-widest uppercase border-b border-line">Δ</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.symbol} className="border-b border-line-dim hover:bg-bg-hover">
              <td className="px-3 py-2">
                <span className="text-amber font-medium">{h.symbol}</span>
                <div className="text-ink-dim text-xxs">
                  {h.name} · <span className="text-cyan text-[9px] tracking-wider">{h.market}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular">{h.value.toLocaleString('en-US')}</td>
              <td className={`px-3 py-2 text-right tabular ${h.returnPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                {h.returnPct >= 0 ? '+' : ''}{h.returnPct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
