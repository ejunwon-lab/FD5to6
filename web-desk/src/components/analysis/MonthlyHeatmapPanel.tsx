import { useMemo, useState } from 'react'
import { Panel } from '../ui/Panel'
import type { EquityPoint } from '../../lib/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface CellData {
  year: string
  month: number  // 0~11
  delta: number  // 그 달 누적수익 변화 (KRW)
  hasData: boolean
}

export function MonthlyHeatmapPanel({ equityCurve }: { equityCurve: EquityPoint[] }) {
  const [hovered, setHovered] = useState<CellData | null>(null)

  const { years, cells, maxAbs, ytdByYear } = useMemo(() => {
    const points = equityCurve
      .filter((p) => p.fullDate)
      .map((p) => ({ fullDate: p.fullDate!, value: p.value }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))

    if (points.length === 0) {
      return { years: [] as string[], cells: [] as CellData[], maxAbs: 0, ytdByYear: new Map<string, number>() }
    }

    // 월말 (= 같은 YYYY-MM의 마지막 fullDate) 값 추출
    const monthEnd = new Map<string, number>()  // 'YYYY-MM' → value
    points.forEach((p) => monthEnd.set(p.fullDate.slice(0, 7), p.value))

    // 연도 범위
    const yearsSet = new Set<string>()
    monthEnd.forEach((_, ym) => yearsSet.add(ym.slice(0, 4)))
    const years = Array.from(yearsSet).sort()

    // 각 (year, month)에 대해 그 달 변화량 = monthEnd[year-month] - monthEnd[전월]
    const sortedYM = Array.from(monthEnd.keys()).sort()
    const ymToPrev = new Map<string, string>()
    sortedYM.forEach((ym, i) => { if (i > 0) ymToPrev.set(ym, sortedYM[i - 1]) })

    const cells: CellData[] = []
    let maxAbs = 0
    const ytdByYear = new Map<string, number>()

    years.forEach((y) => {
      for (let m = 0; m < 12; m++) {
        const ym = `${y}-${String(m + 1).padStart(2, '0')}`
        const end = monthEnd.get(ym)
        if (end === undefined) {
          cells.push({ year: y, month: m, delta: 0, hasData: false })
          continue
        }
        const prevYM = ymToPrev.get(ym)
        const prev = prevYM !== undefined ? monthEnd.get(prevYM) ?? 0 : 0
        const delta = end - prev
        if (Math.abs(delta) > maxAbs) maxAbs = Math.abs(delta)
        cells.push({ year: y, month: m, delta, hasData: true })
        ytdByYear.set(y, (ytdByYear.get(y) ?? 0) + delta)
      }
    })

    return { years, cells, maxAbs, ytdByYear }
  }, [equityCurve])

  if (years.length === 0) {
    return (
      <Panel title="Monthly Heatmap" meta="no data">
        <div className="px-3 py-6 text-center text-ink-faint text-xs">
          누적수익(*추이 기록* 시트) 데이터 없음
        </div>
      </Panel>
    )
  }

  const hoverMeta = hovered && hovered.hasData
    ? `${hovered.year}-${String(hovered.month + 1).padStart(2, '0')}: ${hovered.delta >= 0 ? '+' : ''}₩${Math.round(hovered.delta).toLocaleString()}`
    : `${years.length} year${years.length !== 1 ? 's' : ''}`

  return (
    <Panel title="Monthly Heatmap · 월별 수익변동" meta={hoverMeta}>
      <div className="p-3 overflow-x-auto">
        <table className="text-2xs tabular border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1 text-ink-faint uppercase tracking-widest font-medium text-left w-12"></th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-1 text-ink-faint uppercase tracking-widest font-medium w-14">
                  {m}
                </th>
              ))}
              <th className="px-2 py-1 text-ink-faint uppercase tracking-widest font-medium w-20">YTD</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const rowCells = cells.filter((c) => c.year === y)
              const ytd = ytdByYear.get(y) ?? 0
              return (
                <tr key={y}>
                  <td className="px-2 py-1.5 text-ink-dim font-medium">{y}</td>
                  {rowCells.map((c) => {
                    if (!c.hasData) {
                      return <td key={c.month} className="px-1 py-1.5"><div className="h-7 bg-bg-deep border border-line-dim" /></td>
                    }
                    const ratio = maxAbs > 0 ? Math.abs(c.delta) / maxAbs : 0
                    const tone = c.delta > 0 ? 'gain' : c.delta < 0 ? 'loss' : 'neutral'
                    const bg = tone === 'gain'
                      ? `rgba(34, 197, 94, ${Math.max(0.12, ratio * 0.85).toFixed(2)})`
                      : tone === 'loss'
                        ? `rgba(239, 68, 68, ${Math.max(0.12, ratio * 0.85).toFixed(2)})`
                        : 'rgba(107, 114, 128, 0.15)'
                    return (
                      <td key={c.month} className="px-1 py-1.5">
                        <div
                          className="h-7 border border-line-dim"
                          style={{ backgroundColor: bg }}
                          onMouseEnter={() => setHovered(c)}
                          onMouseLeave={() => setHovered((prev) => (prev === c ? null : prev))}
                        />
                      </td>
                    )
                  })}
                  <td className={`px-2 py-1.5 text-right font-medium tabular ${ytd >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {ytd >= 0 ? '+' : ''}₩{Math.round(ytd).toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 pb-3 text-2xs text-ink-faint leading-relaxed">
        각 셀 = 그 달 누적수익 변화 (= 월말값 − 전월말값). 색 진하기 = |변화| / 최대값. 셀 hover → 패널 우측 메타에 정확한 ₩ 금액 표시. YTD = 그 해 누적 변화 합
      </div>
    </Panel>
  )
}
