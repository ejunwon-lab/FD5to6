import { useState } from 'react'
import { Card } from '../ui/Card'
import { krwCompact, krwFull, pctFormatted, profitTextClass, holdingDurationText } from '../../utils/format'
import type { Holding } from '../../models/types'

type SortKey = 'change' | 'agedDays' | 'opCurrent' | 'profitRate' | 'opProfit' | 'allInfo'

interface HoldingCardProps {
  holding: Holding
  sortKey: SortKey
}

export function HoldingCard({ holding: h, sortKey }: HoldingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isProfit = h.opProfit >= 0
  const isUp = h.change >= 0
  const duration = holdingDurationText(h.buyDate)
  const borderColor = isUp ? 'border-profit/50' : 'border-loss/50'

  const detailGrid = (
    <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-700 text-xs">
      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        {[
          { label: '평가금액', val: krwCompact(h.opCurrent) },
          { label: '매입금액', val: krwCompact(h.opBuy) },
          { label: '수익금', val: krwCompact(h.opProfit), colored: true, isProfit },
          { label: '현재 단가', val: krwFull(h.currentPrice) },
          { label: '평균 단가', val: krwFull(h.buyPrice) },
          { label: '수량', val: String(h.quantity) },
          { label: '1개월', val: pctFormatted(h.m1), colored: true, isProfit: h.m1 >= 0 },
          { label: '3개월', val: pctFormatted(h.m3), colored: true, isProfit: h.m3 >= 0 },
          { label: '12개월', val: pctFormatted(h.y1), colored: true, isProfit: h.y1 >= 0 },
          { label: '52주 고', val: krwFull(h.high52) },
          { label: '52주 저', val: krwFull(h.low52) },
          { label: '계좌', val: h.accountType },
        ].map(item => (
          <div key={item.label}>
            <p className="text-gray-400 mb-0.5">{item.label}</p>
            <p className={item.colored ? profitTextClass(item.isProfit ? 1 : -1) : 'font-medium'}>
              {item.val}
            </p>
          </div>
        ))}
      </div>
    </div>
  )

  if (sortKey === 'allInfo') {
    return (
      <Card className={`overflow-hidden border-2 ${borderColor}`}>
        <div className="p-4">
          {/* 상단: 이름 + 현재가 */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-sm">{h.name}</p>
              <p className="text-[10px] text-gray-400">{h.code} {duration ? `· ${duration}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-base">{krwFull(h.currentPrice)}</p>
              <p className={`text-xs font-medium ${profitTextClass(h.change)}`}>{h.changePct}</p>
            </div>
          </div>
          {/* 중단: 매입/평가/수익 */}
          <div className="grid grid-cols-3 gap-1 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2 mb-3">
            {[
              { label: '매입', val: krwCompact(h.opBuy) },
              { label: '평가', val: krwCompact(h.opCurrent) },
              { label: '수익', val: krwCompact(h.opProfit), colored: true },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[9px] text-gray-400 mb-0.5">{item.label}</p>
                <p className={`text-xs font-bold ${item.colored ? profitTextClass(h.opProfit) : ''}`}>{item.val}</p>
              </div>
            ))}
          </div>
          {/* 하단: 오늘등락 + 수익률 */}
          <div className="grid grid-cols-2 gap-1 text-center">
            <div className={`rounded-lg py-1.5 ${isUp ? 'bg-profit/10' : 'bg-loss/10'}`}>
              <p className="text-[9px] text-gray-400">오늘 등락</p>
              <p className={`text-xs font-bold ${profitTextClass(h.change)}`}>{h.changePct}</p>
            </div>
            <div className={`rounded-lg py-1.5 ${isProfit ? 'bg-profit/10' : 'bg-loss/10'}`}>
              <p className="text-[9px] text-gray-400">수익률</p>
              <p className={`text-xs font-bold ${profitTextClass(h.opProfit)}`}>{pctFormatted(h.profitRate)}</p>
            </div>
          </div>
          {detailGrid}
        </div>
      </Card>
    )
  }

  return (
    <Card
      className={`border-2 ${borderColor}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{h.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-gray-400">{h.code}</span>
              {duration && (
                <>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">|</span>
                  <span className="text-[10px] text-gray-400">{duration}</span>
                </>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            {sortKey === 'profitRate' && (
              <>
                <p className={`font-bold text-sm ${profitTextClass(h.opProfit)}`}>{pctFormatted(h.profitRate)}</p>
                <p className={`text-[10px] ${profitTextClass(h.opProfit)}`}>{krwCompact(h.opProfit)}</p>
              </>
            )}
            {sortKey === 'opProfit' && (
              <>
                <p className={`font-bold text-sm ${profitTextClass(h.opProfit)}`}>{krwCompact(h.opProfit)}</p>
                <p className={`text-[10px] ${profitTextClass(h.opProfit)}`}>{pctFormatted(h.profitRate)}</p>
              </>
            )}
            {sortKey === 'opCurrent' && (
              <>
                <p className="font-bold text-sm">{krwCompact(h.opCurrent)}</p>
                <p className={`text-[10px] ${profitTextClass(h.opProfit)}`}>{pctFormatted(h.profitRate)}</p>
              </>
            )}
            {sortKey === 'change' && (
              <>
                <p className={`font-bold text-sm ${profitTextClass(h.change)}`}>{h.changePct}</p>
                <p className={`text-[10px] ${profitTextClass(h.change)}`}>
                  {krwCompact(h.change * h.quantity)}
                </p>
              </>
            )}
            {sortKey === 'agedDays' && (
              <>
                <p className={`font-bold text-sm ${profitTextClass(h.opProfit)}`}>{krwCompact(h.opProfit)}</p>
                <p className={`text-[10px] ${profitTextClass(h.opProfit)}`}>{pctFormatted(h.profitRate)}</p>
              </>
            )}
          </div>

          <span className="text-gray-300 dark:text-gray-600 text-xs ml-1">
            {expanded ? '▲' : '▼'}
          </span>
        </div>

        {expanded && detailGrid}
      </div>
    </Card>
  )
}

export type { SortKey }
