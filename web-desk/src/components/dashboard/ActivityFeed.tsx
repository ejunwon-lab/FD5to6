import { Panel } from '../ui/Panel'
import { useRealized } from '../../lib/useRealized'
import { activity as sampleActivity } from '../../lib/sampleData'

const tagStyle = {
  BUY:  'bg-gain/15 text-gain',
  SELL: 'bg-loss/15 text-loss',
  DIV:  'bg-cyan/15 text-cyan',
}

const RECENT_N = 8

// 실현손익(매도 기록) 최근 N건. 이전엔 sampleData.activity 더미가 무조건 표시됐음 (2026-07-23 배선).
export function ActivityFeed() {
  const { entries, loading } = useRealized()
  const recent = [...entries]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, RECENT_N)

  if (recent.length === 0) {
    return (
      <Panel title="Recent Activity" meta={loading ? 'LOADING' : 'SAMPLE'} className="col-span-1">
        <div className="py-1">
          {sampleActivity.map((a, i) => (
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

  return (
    <Panel title="Recent Activity" meta={`매도 최근 ${recent.length}건`} className="col-span-1">
      <div className="py-1">
        {recent.map((e, i) => {
          const up = e.profit >= 0
          return (
            <div key={`${e.date}-${e.code}-${i}`} className="grid grid-cols-[44px_1fr_auto] gap-2.5 items-baseline px-3 py-1.5 text-xs border-b border-line-dim last:border-0">
              <span className="text-ink-faint text-xxs tabular">{String(e.date).slice(5)}</span>
              <span className="text-ink-dim min-w-0">
                <span className={`inline-block px-1.5 text-2xs tracking-widest uppercase mr-1.5 ${tagStyle.SELL}`}>
                  SELL
                </span>
                <span className="text-amber font-medium">{e.name}</span>
                <span className="ml-1.5 text-ink-faint">{Number(e.quantity).toLocaleString('ko-KR')}주</span>
              </span>
              <span className={`tabular ${up ? 'text-gain' : 'text-loss'}`}>
                {up ? '+' : '-'}₩{Math.abs(Math.round(e.profit)).toLocaleString('ko-KR')}
              </span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
