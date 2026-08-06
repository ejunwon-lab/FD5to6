import { useMemo } from 'react'
import { Panel } from '../ui/Panel'
import { dDay, upcomingEvents, type MacroEvent, type MacroKind } from '../../lib/macroCalendar'
import { useNews } from '../../lib/useNews'

// 다가오는 이벤트 — 정적 공표 일정(FOMC·CPI·금통위) + 규칙 계산(만기일) + US 보유 종목
// 실적 발표일(Yahoo, useNews 공유 응답 — 실패 시 실적 행만 조용히 빠짐).
const KIND_TAG: Record<MacroKind, string> = { fomc: 'US', cpi: 'US', bok: 'KR', expiry: '만기', earnings: '실적' }

export function EventsPanel() {
  const { earnings } = useNews()
  const today = new Date().toLocaleDateString('en-CA')

  const events = useMemo(() => {
    const earningEvents: MacroEvent[] = earnings
      .filter((e) => e.date >= today)
      .map((e) => ({
        date: e.date,
        name: `${e.name} 실적 발표${e.estimate ? ' (추정)' : ''}`,
        kind: 'earnings' as const,
      }))
    return [...upcomingEvents(today, 6), ...earningEvents]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(0, 8)
  }, [earnings, today])

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
