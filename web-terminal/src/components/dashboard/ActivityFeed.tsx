import { Panel } from '../ui/Panel'
import { activity } from '../../lib/sampleData'

const tagStyle = {
  BUY:  'bg-gain/15 text-gain',
  SELL: 'bg-loss/15 text-loss',
  DIV:  'bg-cyan/15 text-cyan',
}

export function ActivityFeed() {
  return (
    <Panel title="Recent Activity" meta="LAST 7D" className="col-span-1">
      <div className="py-1">
        {activity.map((a, i) => (
          <div key={i} className="grid grid-cols-[56px_1fr_auto] gap-2.5 items-baseline px-3 py-1.5 text-xs border-b border-line-dim last:border-0">
            <span className="text-ink-faint text-xxs tabular">{a.time}</span>
            <span className="text-ink-dim">
              <span className={`inline-block px-1.5 text-2xs tracking-widest uppercase mr-1.5 ${tagStyle[a.type]}`}>
                {a.type}
              </span>
              {a.description}
            </span>
            <span className="text-ink tabular">{a.amount}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
