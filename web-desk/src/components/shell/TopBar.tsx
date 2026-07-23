import { useEffect, useState } from 'react'
import { usePortfolio } from '../../lib/usePortfolio'

interface Props { onMenuClick?: () => void }

export function TopBar({ onMenuClick }: Props) {
  const [clock, setClock] = useState(formatTime())
  const { summary, loading } = usePortfolio()
  useEffect(() => {
    const id = setInterval(() => setClock(formatTime()), 1000)
    return () => clearInterval(id)
  }, [])
  // 실데이터 배선 (2026-07-23): 이전엔 "CONNECTED·KIS"/"KRX OPEN"/"NYSE PRE"가 고정 표시였음.
  const dataLive = !!summary
  const krx = marketStatus('Asia/Seoul', 9 * 60, 15 * 60 + 30)
  const nyse = nyseStatus()
  return (
    <div className="h-9 bg-bg-deep border-b border-line flex items-center px-3 gap-2 sm:gap-4 lg:gap-6 text-xs uppercase tracking-widest">
      {/* 햄버거 버튼 - lg 미만에서만 */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-amber p-1.5 -ml-1.5 hover:text-ink"
        aria-label="menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="font-display text-[20px] sm:text-[22px] tracking-[0.08em] text-amber leading-none pt-0.5">PORT.JUN</div>
      <Pill live={dataLive} className="hidden sm:inline-flex">
        {loading ? 'DATA · LOADING' : dataLive ? 'DATA · LIVE' : 'DATA · SAMPLE'}
      </Pill>
      <Pill className="hidden md:inline-flex">{krx ? 'KRX OPEN' : 'KRX CLOSED'}</Pill>
      <Pill className="hidden md:inline-flex">NYSE {nyse}</Pill>
      <div className="ml-auto flex gap-2 sm:gap-4 text-ink-dim items-center">
        <span className="hidden sm:inline">USR · JUNWON</span>
        <span className="text-cyan tabular">{clock}</span>
      </div>
    </div>
  )
}

function Pill({ children, live, className = '' }: { children: React.ReactNode; live?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 bg-bg-elev border border-line text-ink-dim ${className}`}>
      {live && <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" style={{ boxShadow: '0 0 8px #00ff7f' }} />}
      {children}
    </span>
  )
}

// 해당 타임존의 (요일, 자정 이후 경과분) — 개장 판정용
function tzNowMinutes(tz: string): { weekday: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  // hour12:false에서 자정이 '24'로 나오는 브라우저 대응
  const h = Number(get('hour')) % 24
  return { weekday: get('weekday'), minutes: h * 60 + Number(get('minute')) }
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// 정규장 시간 기준 개장 여부 (요일+시각만 — 공휴일 휴장은 미반영 근사)
function marketStatus(tz: string, openMin: number, closeMin: number): boolean {
  const { weekday, minutes } = tzNowMinutes(tz)
  return WEEKDAYS.includes(weekday) && minutes >= openMin && minutes < closeMin
}

// NYSE: PRE(04:00~09:30) / OPEN(09:30~16:00) / AFTER(16:00~20:00) / CLOSED — ET 기준(DST 자동)
function nyseStatus(): 'PRE' | 'OPEN' | 'AFTER' | 'CLOSED' {
  const { weekday, minutes } = tzNowMinutes('America/New_York')
  if (!WEEKDAYS.includes(weekday)) return 'CLOSED'
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return 'PRE'
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return 'OPEN'
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 'AFTER'
  return 'CLOSED'
}

function formatTime(): string {
  // 라벨이 "kst"이므로 브라우저 로컬 TZ가 아닌 Asia/Seoul로 고정 (해외 접속 시 오표기 방지)
  const t = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
  return `${t} kst`
}
