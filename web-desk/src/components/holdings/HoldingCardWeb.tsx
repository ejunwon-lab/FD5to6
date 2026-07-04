import type { Holding } from '../../lib/types'
import { accountDisplay } from '../../lib/accountDisplay'

/**
 * Web 앱(기존 web/)의 HoldingCard와 시각적으로 동일한 스타일.
 * - 둥근 모서리, 부드러운 보더, 시스템 sans-serif
 * - 숫자는 줄이지 않고 풀로 표시 (₩123,456,789)
 * - 사이즈 큼 (가독성 우선)
 */
export type HoldingSortKey = 'allInfo' | 'change' | 'agedDays' | 'opCurrent' | 'profitRate' | 'opProfit'

interface Props {
  holding: Holding
  sortKey: HoldingSortKey
  isExpanded: boolean
  onExpand: () => void
  onDetail?: () => void
  changeLabel?: string
}

export function HoldingCardWeb({ holding: h, isExpanded, onExpand, onDetail, changeLabel = '오늘' }: Props) {
  const isProfit = h.opProfit >= 0
  const isUp = h.change >= 0
  const duration = formatDuration(h.buyDate)
  // 보더 색: 당일 등락 기준
  const borderColor = isUp ? 'border-[#00ff7f]/60' : 'border-[#ff3366]/60'

  return (
    <div
      onClick={onExpand}
      className={`bg-[#161b24] border-2 ${borderColor} rounded-2xl overflow-hidden cursor-pointer hover:bg-[#1c222c] transition-colors`}
      style={{ fontFamily: 'system-ui, -apple-system, "Apple SD Gothic Neo", "Pretendard", sans-serif' }}
    >
      <div className="p-5">
        {/* Top — 모바일: 이름에 최소폭 보장, 수식 블록은 다음 줄로 wrap (종목명 잘림 방지) */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-4">
          <div className="min-w-[9rem] flex-1">
            <p className="font-semibold text-base text-ink truncate">{h.name}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-ink-faint tabular">{h.symbol}</span>
              {duration && (
                <>
                  <span className="text-xs text-ink-faint">·</span>
                  <span className="text-xs text-ink-faint">{duration}</span>
                </>
              )}
              {onDetail && <DetailBtn onClick={(e) => { e.stopPropagation(); onDetail() }} />}
            </div>
          </div>
          <div className="text-right shrink-0 ml-auto">
            {/* 1. 현재가 */}
            <p className="font-bold text-xl text-ink tabular leading-none">
              {Math.round(h.currentPrice).toLocaleString()}원
            </p>
            {/* 2. 현재 상승액 / 상승률 */}
            <p className={`text-sm font-medium tabular mt-1.5 ${isUp ? 'text-gain' : 'text-loss'}`}>
              {isUp ? '+' : ''}{Math.round(h.change).toLocaleString()}원 / {h.changePct}
            </p>
            {/* 3. 금일 상승액 — 둘째 줄과 동일 크기 */}
            <p className={`text-sm font-medium tabular mt-1 leading-tight ${isUp ? 'text-gain' : 'text-loss'}`}>
              {isUp ? '+' : ''}{Math.round(h.change).toLocaleString()}원 × {h.shares.toLocaleString()}주 = {h.dayChange >= 0 ? '+' : ''}{Math.round(h.dayChange).toLocaleString()}원
            </p>
          </div>
          <span className="text-ink-faint text-sm mt-1">{isExpanded ? '▲' : '▼'}</span>
        </div>

        {/* Middle: 매입 / 평가 / 수익 */}
        <div className="grid grid-cols-3 gap-2 bg-bg/40 rounded-xl p-3 mb-3">
          <Stat label="매입" value={`₩${Math.round(h.opBuy).toLocaleString()}`} />
          <Stat label="평가" value={`₩${Math.round(h.value).toLocaleString()}`} />
          <Stat label="수익" value={`${h.opProfit >= 0 ? '+' : ''}₩${Math.round(h.opProfit).toLocaleString()}`} tone={isProfit ? 'gain' : 'loss'} />
        </div>

        {/* Bottom: 오늘 등락 / 수익률 */}
        <div className="grid grid-cols-2 gap-2">
          <ColoredCell label={`${changeLabel} 등락`} value={h.changePct} tone={isUp ? 'gain' : 'loss'} />
          <ColoredCell
            label="수익률"
            value={`${h.returnPct >= 0 ? '+' : ''}${h.returnPct.toFixed(2)}%`}
            tone={isProfit ? 'gain' : 'loss'}
          />
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-line">
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              <Field label="평가금액"  value={`₩${Math.round(h.value).toLocaleString()}`} />
              <Field label="매입금액"  value={`₩${Math.round(h.opBuy).toLocaleString()}`} />
              <Field label="수익금"    value={`${h.opProfit >= 0 ? '+' : ''}₩${Math.round(h.opProfit).toLocaleString()}`} tone={isProfit ? 'gain' : 'loss'} />
              <Field label="현재 단가" value={`₩${Math.round(h.currentPrice).toLocaleString()}`} />
              <Field label="평균 단가" value={h.market === 'KR' ? `₩${Math.round(h.avgPrice).toLocaleString()}` : `$${h.avgPrice.toFixed(2)}`} />
              <Field label="수량"      value={`${h.shares.toLocaleString()}주`} />
              <Field label="1개월"     value={pctStr(h.m1)} tone={h.m1 >= 0 ? 'gain' : 'loss'} />
              <Field label="3개월"     value={pctStr(h.m3)} tone={h.m3 >= 0 ? 'gain' : 'loss'} />
              <Field label="12개월"    value={pctStr(h.y1)} tone={h.y1 >= 0 ? 'gain' : 'loss'} />
              <Field label="52주 고"   value={`₩${Math.round(h.high52).toLocaleString()}`} />
              <Field label="52주 저"   value={`₩${Math.round(h.low52).toLocaleString()}`} />
              <Field label="계좌"      value={accountDisplay(h.broker, h.accountType)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs bg-cyan/15 text-cyan rounded-full px-2.5 py-1 font-medium hover:bg-cyan/25 transition-colors leading-none border border-cyan/30"
      title="종목 상세"
    >
      📊 상세
    </button>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className="text-center">
      <p className="text-[11px] text-ink-faint mb-1">{label}</p>
      <p className={`text-sm font-bold tabular ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  )
}

function ColoredCell({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  const bg = tone === 'gain' ? 'bg-gain/10' : tone === 'loss' ? 'bg-loss/10' : 'bg-bg-hover'
  const fg = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'
  return (
    <div className={`rounded-xl py-2.5 text-center ${bg}`}>
      <p className="text-[11px] text-ink-faint mb-1">{label}</p>
      <p className={`text-sm font-bold tabular ${fg}`}>{value}</p>
    </div>
  )
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div>
      <p className="text-[11px] text-ink-faint mb-1">{label}</p>
      <p className={`text-sm font-medium tabular ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'}`}>
        {value}
      </p>
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
