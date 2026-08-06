import { useMemo } from 'react'
import { Panel } from '../ui/Panel'
import { dDay, upcomingEvents, type MacroKind } from '../../lib/macroCalendar'

// 다가오는 매크로 이벤트 — 정적 공표 일정(FOMC·CPI·금통위) + 규칙 계산(만기일). 외부 호출 없음.
const KIND_TAG: Record<MacroKind, string> = { fomc: 'US', cpi: 'US', bok: 'KR', expiry: '만기' }

export function EventsPanel() {
  const today = new Date().toLocaleDateString('en-CA')
  const events = useMemo(() => upcomingEvents(today, 6), [today])

  return (
    <Panel title="다가오는 이벤트" meta="현지 발표일 기준">
      <div className="p-1.5">
        {events.map((e) => {
          const d = dDay(today, e.date)
          return (
            <div
              key={`${e.date}-${e.name}`}
              className="flex items-baseline gap-2 px-1.5 py-1.5 border-b border-line-dim last:border-0"
            >
              <span className={`w-10 shrink-0 text-xs tabular font-medium ${d <= 7 ? 'text-amber' : 'text-ink-dim'}`}>
                {d === 0 ? '오늘' : `D-${d}`}
              </span>
              <span className="w-12 shrink-0 text-2xs text-ink-faint tabular">{e.date.slice(5)}</span>
              <span className="text-xs text-ink truncate flex-1">{e.name}</span>
              <span className="shrink-0 text-2xs text-cyan tracking-widest">{KIND_TAG[e.kind]}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
