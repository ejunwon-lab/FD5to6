import { Panel } from '../ui/Panel'
import type { TodaySignal } from '../../lib/todayInsights'

// 오늘 기준으로 "상태가 바뀐" 종목 — 수익↔손실 전환·급등락·52주 고/저점 근접 (행동 후보)
export function SignalsPanel({ signals }: { signals: TodaySignal[] }) {
  return (
    <Panel title="주의 신호" meta={signals.length ? `${signals.length}건` : undefined}>
      {signals.length === 0 ? (
        <div className="text-center text-ink-faint py-6 text-xs">오늘 상태 변화 없음</div>
      ) : (
        <div className="p-1.5">
          {signals.map((s, i) => (
            <div
              key={`${s.kind}-${s.symbol}-${i}`}
              className="flex items-baseline justify-between gap-2 px-1.5 py-1.5 border-b border-line-dim last:border-0"
            >
              <span className="text-amber font-medium text-xs truncate">{s.name}</span>
              <span className={`text-xs tabular shrink-0 ${s.tone === 'gain' ? 'text-gain' : 'text-loss'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
