import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../ui/Panel'
import { useAuth } from '../../auth/AuthContext'
import { gasApi, type SystemStatusResponse } from '../../api/gasApi'

// KIS Status (단축키 K) — GAS newMobileGetSystemStatus (_buildDiag + kis_carried_status).
// 페이로드는 날짜·참거짓·개수·충족도만 (Diag.js 규칙 — 금액·종목명 없음).
export function KisStatusPage() {
  const { token, isSignedIn, signIn } = useAuth()
  const [data, setData] = useState<SystemStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await gasApi.getSystemStatus(token)
      if (!res.success) throw new Error(res.error || 'unknown')
      setData(res)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  if (!isSignedIn) {
    return (
      <main className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="font-display text-amber text-xl tracking-widest mb-3 uppercase">KIS Status</div>
          <button onClick={signIn} className="bg-amber text-bg px-4 py-1 text-xs font-semibold uppercase tracking-widest hover:opacity-80">
            Sign in
          </button>
        </div>
      </main>
    )
  }

  const d = data?.diag
  const kis = data?.kis
  const carried = Number(kis?.carried ?? 0)
  const total = Number(kis?.total ?? 0)
  const kisOk = total > 0 && carried === 0

  return (
    <main className="overflow-y-auto p-2 sm:p-3 grid gap-2.5 grid-cols-1 lg:grid-cols-2" style={{ gridAutoRows: 'min-content' }}>
      <div className="lg:col-span-2 flex items-center gap-3">
        <span className="text-2xs text-ink-faint uppercase tracking-widest">
          {loading ? '불러오는 중…' : error ? `오류: ${error}` : `조회 ${d?.now ?? '—'}`}
        </span>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="border border-line px-2 py-0.5 text-xxs uppercase tracking-widest text-ink-dim hover:border-amber hover:text-amber disabled:opacity-40"
        >
          Refresh
        </button>
      </div>

      {/* KIS 시세 상태 */}
      <Panel title="KIS 시세" meta={kis?.date ?? '—'}>
        <div className="p-4">
          <div className={`text-[22px] font-medium tabular mb-1 ${kisOk ? 'text-gain' : total > 0 ? 'text-warn' : 'text-ink-faint'}`}>
            {total > 0
              ? kisOk
                ? `전 종목 최신 (${total}종목)`
                : `직전가 유지 ${carried} / ${total}종목`
              : '기록 없음'}
          </div>
          <p className="text-xs text-ink-dim">
            마지막 시세 갱신에서 KIS 조회 실패로 직전가를 유지한 종목 수. 0이면 정상.
          </p>
        </div>
      </Panel>

      {/* 시스템 상태 */}
      <Panel title="시스템" meta={d?.isTradingDay ? '거래일' : '휴장'}>
        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <StatusField label="가격 기준일" value={d?.priceAsOfDate ?? '—'} />
          <StatusField label="장중 여부" value={d?.isMarketDay ? 'OPEN' : 'CLOSED'} tone={d?.isMarketDay ? 'gain' : undefined} />
          <StatusField label="추적 종목 수" value={d?.stockCount != null ? `${d.stockCount}종목` : '—'} />
          <StatusField label="마지막 갱신" value={d?.lastUpdate || '—'} wide />
        </div>
      </Panel>

      {/* 지표 충족도 */}
      <Panel title="지표 충족도" meta="종목지표">
        <div className="p-4 space-y-2.5">
          {d?.metricFill
            ? Object.entries(d.metricFill).map(([k, v]) => <FillBar key={k} label={k} frac={v} />)
            : <p className="text-xs text-ink-faint">데이터 없음</p>}
        </div>
      </Panel>

      {/* 최근 기록 */}
      <Panel title="최근 기록" meta="이력·휴장일">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-2xs text-ink-faint uppercase tracking-widest mb-1.5">현재가 이력 끝 3행</p>
            {(d?.priceHistTail ?? []).map((t) => <p key={t} className="tabular text-ink-dim">{t}</p>)}
          </div>
          <div>
            <p className="text-2xs text-ink-faint uppercase tracking-widest mb-1.5">최근 휴장일</p>
            {(d?.holidaysTail ?? []).map((t) => <p key={t} className="tabular text-ink-dim">{t}</p>)}
          </div>
        </div>
      </Panel>
    </main>
  )
}

function StatusField({ label, value, tone, wide }: { label: string; value: string; tone?: 'gain' | 'loss'; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-2xs text-ink-faint uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`tabular font-medium ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

// "20/23" 형태 문자열 → 채움 바
function FillBar({ label, frac }: { label: string; frac: string }) {
  const m = String(frac).match(/^(\d+)\s*\/\s*(\d+)$/)
  const filled = m ? Number(m[1]) : 0
  const total = m ? Number(m[2]) : 0
  const pct = total > 0 ? (filled / total) * 100 : 0
  const ok = total > 0 && filled === total
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-ink-dim">{label}</span>
        <span className={`tabular ${ok ? 'text-gain' : 'text-warn'}`}>{frac}</span>
      </div>
      <div className="h-1 bg-line">
        <div className={`h-full ${ok ? 'bg-gain' : 'bg-warn'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
