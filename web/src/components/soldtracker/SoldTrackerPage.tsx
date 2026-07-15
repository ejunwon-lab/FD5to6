import { useMemo, useState } from 'react'
import { Card } from '../ui/Card'
import { krwFull, krwCompactSigned } from '../../utils/format'
import type { SoldTrackerItem } from '../../models/types'

type SortKey = 'date' | 'diff' | 'realized' | 'elapsed' | 'name'
type SortDir = 'asc' | 'desc'

const SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: 'date', label: '최근순' },
  { key: 'diff', label: '차이순' },
  { key: 'realized', label: '실현순' },
  { key: 'elapsed', label: '경과순' },
  { key: 'name', label: '종목명' },
]

// null(해외 미집계)은 항상 맨 아래로
function cmpNullable(a: number | null, b: number | null, dir: SortDir): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return dir === 'asc' ? a - b : b - a
}

export function SoldTrackerPage({ items }: { items: SoldTrackerItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const onPill = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // 기본 방향: 이름은 오름차순, 나머지는 내림차순
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...items]
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return sortDir === 'asc'
            ? a.name.localeCompare(b.name, 'ko')
            : b.name.localeCompare(a.name, 'ko')
        case 'diff':     return cmpNullable(a.diff, b.diff, sortDir)
        case 'realized': return cmpNullable(a.realizedProfit, b.realizedProfit, sortDir)
        case 'elapsed':  return cmpNullable(a.elapsedDays, b.elapsedDays, sortDir)
        case 'date':
        default: {
          const c = a.sellDate < b.sellDate ? -1 : a.sellDate > b.sellDate ? 1 : 0
          return sortDir === 'asc' ? c : -c
        }
      }
    })
    return arr
  }, [items, sortKey, sortDir])

  const stats = useMemo(() => {
    const scored = items.filter(it => it.diff != null)
    const totalDiff = scored.reduce((s, it) => s + (it.diff ?? 0), 0)
    const regret = scored.filter(it => (it.diff ?? 0) > 0).length
    const good = scored.filter(it => (it.diff ?? 0) < 0).length
    return { totalDiff, regret, good, scoredN: scored.length }
  }, [items])

  return (
    <div className="h-[100dvh] overflow-y-auto no-scrollbar bg-[rgb(var(--page-bg))]">
      <div className="pb-32">
        {/* Header */}
        <div className="px-4 pt-12 pb-4" style={{ background: 'linear-gradient(135deg, #405AE6 0%, #7340D9 100%)' }}>
          <h1 className="text-2xl font-bold text-white">매도 복기</h1>
          <p className="text-white/70 text-xs mt-1">안 팔았다면 지금 얼마였을까 · {items.length}건</p>
        </div>

        <div className="px-4 pt-4 space-y-3">
          {/* 요약 */}
          <Card className="p-4">
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 text-center">
              <div className="px-1">
                <p className="text-xs text-gray-400 mb-1">안 팔았다면 총</p>
                <p className={`text-sm font-bold tabular-nums ${stats.totalDiff >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {krwCompactSigned(stats.totalDiff)}
                </p>
              </div>
              <div className="px-1">
                <p className="text-xs text-gray-400 mb-1">더 벌 수 있던</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{stats.regret}건</p>
              </div>
              <div className="px-1">
                <p className="text-xs text-gray-400 mb-1">잘 판</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{stats.good}건</p>
              </div>
            </div>
          </Card>

          {/* 정렬 pills */}
          <div className="flex flex-wrap gap-1.5">
            {SORT_PILLS.map(p => {
              const active = p.key === sortKey
              return (
                <button
                  key={p.key}
                  onClick={() => onPill(p.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    active
                      ? 'bg-accent text-white'
                      : 'bg-[rgb(var(--card-bg))] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {p.label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              )
            })}
          </div>

          {/* 목록 */}
          <Card className="p-0 overflow-hidden">
            {sorted.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">매도 내역이 없습니다</p>
            ) : (
              sorted.map((it, i) => {
                const hasWhatIf = it.diff != null
                const diffPos = (it.diff ?? 0) >= 0
                return (
                  <div key={`${it.code}-${it.sellDate}-${i}`}
                    className="flex items-start justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{it.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {it.category} · {it.sellDate.slice(5)} · {it.elapsedDays != null ? `${it.elapsedDays}일 전` : ''}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {it.broker} {it.account}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {hasWhatIf ? (
                        <>
                          <p className={`text-sm font-bold tabular-nums ${diffPos ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {krwCompactSigned(it.diff ?? 0)}
                          </p>
                          <p className="text-[11px] text-gray-400">{diffPos ? '더 벌 수 있었음' : '잘 팔았음'}</p>
                          <p className="text-[11px] mt-1">
                            <span className={(it.realizedProfit ?? 0) >= 0 ? 'text-profit' : 'text-loss'}>실현 {krwCompactSigned(it.realizedProfit ?? 0)}</span>
                          </p>
                          <p className="text-[11px] text-gray-400">안 팔았다면 {krwFull(it.ifHeldProfit ?? 0)}</p>
                        </>
                      ) : (
                        <>
                          <p className={`text-sm font-bold tabular-nums ${(it.realizedProfit ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {krwCompactSigned(it.realizedProfit ?? 0)}
                          </p>
                          <p className="text-[11px] text-gray-400">실현손익</p>
                          <p className="text-[11px] text-gray-400 mt-1">해외 · 집계 제외</p>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </Card>

          <p className="text-[10px] text-gray-400 px-1">
            차이 = (현재가 − 매도가) × 수량. <span className="text-amber-500">+</span> 안 팔았다면 더 벌 수 있었음 · <span className="text-emerald-500">−</span> 잘 팔았음. 해외는 환율 미반영으로 집계 제외.
          </p>
        </div>
      </div>
    </div>
  )
}
