import type { Holding } from '../../lib/types'
import { accountDisplay } from '../../lib/accountDisplay'

export type HoldingSortKey = 'allInfo' | 'change' | 'agedDays' | 'opCurrent' | 'profitRate' | 'opProfit'

interface Props {
  holding: Holding
  sortKey: HoldingSortKey
  isExpanded: boolean
  onExpand: () => void
  onDetail?: () => void
  changeLabel?: string  // '오늘' | '전일' | '최근'
}

export function HoldingCard({ holding: h, isExpanded, onExpand, onDetail, changeLabel = '오늘' }: Props) {
  const isProfit = h.opProfit >= 0
  const isUp = h.change >= 0
  const duration = formatDuration(h.buyDate)
  // 당일 등락 기준으로 좌측 보더 색상
  const borderClass = isUp ? 'border-l-gain' : 'border-l-loss'

  return (
    <div
      onClick={onExpand}
      className={`bg-bg-elev border border-line border-l-4 ${borderClass} cursor-pointer hover:bg-bg-hover transition-colors`}
    >
      <div className={isExpanded ? 'p-3.5' : 'px-3 py-2.5'}>
        {/* 접힘 헤더: 정확히 2줄 — 종목명|현재가 / 등락%·내 등락총액 (2026-07-23) */}
        {!isExpanded && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-amber font-semibold text-sm truncate leading-tight">{h.name}</div>
              <div className={`text-xs tabular mt-0.5 ${isUp ? 'text-gain' : 'text-loss'}`}>
                {h.changePct} · {h.dayChange >= 0 ? '+' : ''}{Math.round(h.dayChange).toLocaleString('ko-KR')}원
              </div>
            </div>
            <div className="text-ink font-medium tabular text-sm shrink-0">
              {Math.round(h.currentPrice).toLocaleString('ko-KR')}원
            </div>
            <span className="text-ink-faint text-xs shrink-0">▼</span>
          </div>
        )}

        {/* 펼침 헤더 (기존 풀 헤더) */}
        {isExpanded && (
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5 mb-3">
          <div className="min-w-[9rem] flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-amber font-semibold text-sm truncate">{h.name}</span>
              <span className="text-cyan text-2xs tracking-widest shrink-0">{h.market}</span>
              <span className="text-2xs text-ink-faint tabular shrink-0">{h.symbol}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xs text-ink-faint tabular">{duration}</span>
              {onDetail && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDetail() }}
                  className="text-2xs bg-cyan/15 text-cyan border border-cyan/40 px-1.5 py-0 hover:bg-cyan/25 font-medium tracking-wider uppercase"
                  title="종목 상세"
                >
                  ▸ 상세
                </button>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 ml-auto">
            {/* 1. 현재가 */}
            <div className="text-ink font-medium tabular text-sm">
              {Math.round(h.currentPrice).toLocaleString('ko-KR')}원
            </div>
            {/* 2. 현재 상승액 / 상승률 */}
            <div className={`text-xs tabular ${isUp ? 'text-gain' : 'text-loss'}`}>
              {isUp ? '+' : ''}{Math.round(h.change).toLocaleString('ko-KR')}원 / {h.changePct}
            </div>
            {/* 3. 금일 상승액 — 둘째 줄과 동일 크기 */}
            <div className={`text-xs tabular mt-0.5 ${isUp ? 'text-gain' : 'text-loss'}`}>
              {isUp ? '+' : ''}{Math.round(h.change).toLocaleString('ko-KR')}원 × {h.shares.toLocaleString('ko-KR')}주 = {h.dayChange >= 0 ? '+' : ''}{Math.round(h.dayChange).toLocaleString('ko-KR')}원
            </div>
          </div>
          <span className="text-ink-faint text-xs shrink-0 mt-0.5">▲</span>
        </div>
        )}

        {/* 펼침(2단 통합): 요약 + 상세 전부. 접힘이면 헤더만 (2026-07-23 A안) */}
        {isExpanded && (
          <>
            {/* Mid: 매입 / 평가 / 수익 */}
            <div className="grid grid-cols-3 gap-px bg-line border border-line mb-3">
              <Cell label="매입" value={`₩${Math.round(h.opBuy).toLocaleString('ko-KR')}`} />
              <Cell label="평가" value={`₩${Math.round(h.value).toLocaleString('ko-KR')}`} />
              <Cell label="수익" value={`${h.opProfit >= 0 ? '+' : ''}₩${Math.round(h.opProfit).toLocaleString('ko-KR')}`} tone={isProfit ? 'gain' : 'loss'} />
            </div>

            {/* Bottom: 오늘 등락 / 수익률 */}
            <div className="grid grid-cols-2 gap-px bg-line border border-line">
              <BigCell label={`${changeLabel} 등락`} value={h.changePct} tone={isUp ? 'gain' : 'loss'} />
              <BigCell label="수익률" value={`${h.returnPct >= 0 ? '+' : ''}${h.returnPct.toFixed(2)}%`} tone={isProfit ? 'gain' : 'loss'} />
            </div>

            {/* 상세 — 요약과 중복인 평가/매입/수익금 3필드는 제외 */}
            <div className="mt-3 pt-3 border-t border-line">
              <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-xs">
                <DField label="현재 단가" value={`₩${Math.round(h.currentPrice).toLocaleString('ko-KR')}`} />
                <DField label="평균 단가" value={h.market === 'KR' ? `₩${Math.round(h.avgPrice).toLocaleString('ko-KR')}` : `$${h.avgPrice.toFixed(2)}`} />
                <DField label="수량"      value={`${h.shares.toLocaleString('ko-KR')}주`} />
                <DField label="1개월"     value={pctStr(h.m1)} tone={h.m1 >= 0 ? 'gain' : 'loss'} />
                <DField label="3개월"     value={pctStr(h.m3)} tone={h.m3 >= 0 ? 'gain' : 'loss'} />
                <DField label="12개월"    value={pctStr(h.y1)} tone={h.y1 >= 0 ? 'gain' : 'loss'} />
                <DField label="52주 고"   value={`₩${Math.round(h.high52).toLocaleString('ko-KR')}`} />
                <DField label="52주 저"   value={`₩${Math.round(h.low52).toLocaleString('ko-KR')}`} />
                <DField label="계좌"      value={accountDisplay(h.broker, h.accountType)} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}


function Cell({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className="bg-bg-elev px-2 py-2 text-center">
      <div className="text-2xs text-ink-faint mb-0.5 uppercase tracking-widest">{label}</div>
      <div className={`text-xs font-medium tabular ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  )
}

function BigCell({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className={`px-3 py-2 text-center ${tone === 'gain' ? 'bg-gain/10' : tone === 'loss' ? 'bg-loss/10' : 'bg-bg-elev'}`}>
      <div className="text-2xs text-ink-faint mb-0.5 uppercase tracking-widest">{label}</div>
      <div className={`text-sm font-medium tabular ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  )
}

function DField({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div>
      <div className="text-ink-faint text-2xs uppercase tracking-widest mb-0.5">{label}</div>
      <div className={`tabular font-medium ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  )
}

function pctStr(p: number): string {
  if (!Number.isFinite(p)) return '—'
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(2)}%`
}

function formatDuration(d?: string): string {
  if (!d) return ''
  const start = new Date(d).getTime()
  if (!Number.isFinite(start)) return ''
  const days = Math.floor((Date.now() - start) / 86_400_000)
  if (days < 0) return ''
  if (days < 30) return `${days}일`
  if (days < 365) {
    const m = Math.floor(days / 30)
    const r = days - m * 30
    return r > 0 ? `${m}개월 ${r}일` : `${m}개월`
  }
  const y = Math.floor(days / 365)
  const r = days - y * 365
  const m = Math.floor(r / 30)
  return m > 0 ? `${y}년 ${m}개월` : `${y}년`
}
