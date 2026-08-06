import { useState } from 'react'
import { Panel } from '../ui/Panel'
import { useNews } from '../../lib/useNews'

// 오늘의 뉴스 — GAS newMobileGetNews (네이버 국내/해외 종목뉴스, GAS측 30분 캐시).
// 데이터는 useNews 공유 훅(EventsPanel과 응답 공유). 실패("로드 실패")와 빈 결과("뉴스 없음")를
// 구분 표시 — GAS→네이버 실환경 허용 여부의 스모크 신호 역할 (설계 노트 2026-08-06).
const INITIAL_N = 10

export function NewsPanel() {
  const { isSignedIn, loading, error, items } = useNews()
  const [showAll, setShowAll] = useState(false)

  const visible = items ? (showAll ? items : items.slice(0, INITIAL_N)) : []

  return (
    <Panel title="오늘의 뉴스" meta="보유 종목 · 네이버">
      {!isSignedIn ? (
        <div className="text-center text-ink-faint py-6 text-xs">로그인 후 표시</div>
      ) : loading && !items ? (
        <div className="text-center text-ink-faint py-6 text-xs animate-pulse">뉴스 로딩 중…</div>
      ) : error ? (
        <div className="text-center text-loss py-6 text-xs px-3">뉴스 로드 실패 — {error}</div>
      ) : items && items.length === 0 ? (
        <div className="text-center text-ink-faint py-6 text-xs">뉴스 없음</div>
      ) : (
        <div className="p-1.5">
          {visible.map((n, i) => (
            <a
              key={`${n.code}-${n.dt}-${i}`}
              href={n.url || undefined}
              target="_blank"
              rel="noreferrer"
              className="block px-1.5 py-1.5 border-b border-line-dim last:border-0 hover:bg-bg-hover"
            >
              <div className="text-xs text-ink leading-snug">{n.title}</div>
              <div className="mt-0.5 text-2xs text-ink-faint tabular">
                <span className="text-amber">{n.name}</span>
                <span className="mx-1.5">·</span>{fmtDt(n.dt)}
                {n.source && <><span className="mx-1.5">·</span>{n.source}</>}
              </div>
            </a>
          ))}
          {items && items.length > INITIAL_N && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full text-center text-2xs text-ink-dim hover:text-ink uppercase tracking-widest py-2"
            >
              {showAll ? '접기 ▲' : `더 보기 (${items.length - INITIAL_N}) ▼`}
            </button>
          )}
        </div>
      )}
    </Panel>
  )
}

function fmtDt(dt: string): string {
  // YYYYMMDDHHmm → MM-DD HH:mm
  if (!dt || dt.length < 12) return dt
  return `${dt.slice(4, 6)}-${dt.slice(6, 8)} ${dt.slice(8, 10)}:${dt.slice(10, 12)}`
}
