import { useMemo } from 'react'
import { Panel } from '../ui/Panel'
import type { Holding } from '../../lib/types'

const TAX_RATE = 0.22            // 해외주식 양도세 (지방세 포함)
const ANNUAL_DEDUCTION = 2_500_000  // 연 250만원 기본공제

export function TaxSimPanel({ holdings }: { holdings: Holding[] }) {
  const { lossPositions, totalLoss, grossSave, netSave } = useMemo(() => {
    const usLoss = holdings
      .filter((h) => h.market === 'US' && h.opProfit < 0)
      .map((h) => ({ ...h, lossKrw: Math.abs(h.opProfit) }))
      .sort((a, b) => b.lossKrw - a.lossKrw)

    const totalLoss = usLoss.reduce((s, h) => s + h.lossKrw, 0)
    const grossSave = totalLoss * TAX_RATE
    const netSave   = Math.max(0, (totalLoss - ANNUAL_DEDUCTION) * TAX_RATE)
    return { lossPositions: usLoss, totalLoss, grossSave, netSave }
  }, [holdings])

  return (
    <Panel
      title="Tax-Loss Harvesting · 해외주식"
      meta={`${lossPositions.length} loss position${lossPositions.length !== 1 ? 's' : ''}`}
    >
      <div className="p-3">
        {lossPositions.length === 0 ? (
          <div className="py-6 text-center text-ink-faint text-xs">
            미국 주식 미실현 손실 종목 없음 — 절세 대상 없음
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatBox label="Total Loss"      value={-totalLoss} tone="loss" sub="미국 주식 미실현 손실 합" />
              <StatBox label="Tax Save (gross)" value={grossSave}  tone="gain" sub={`손실 × ${(TAX_RATE * 100).toFixed(0)}%`} />
              <StatBox label="Net Save"         value={netSave}    tone="gain" sub={`연 ${ANNUAL_DEDUCTION.toLocaleString('ko-KR')} 공제 후`} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="text-ink-faint text-2xs uppercase tracking-widest border-b border-line">
                    <th className="px-3 pt-2 pb-1.5 text-left font-medium">종목</th>
                    <th className="px-3 pt-2 pb-1.5 text-right font-medium">미실현 손실</th>
                    <th className="px-3 pt-2 pb-1.5 text-right font-medium">수익률</th>
                    <th className="px-3 pt-2 pb-1.5 text-right font-medium">매도 시 절세 (22%)</th>
                  </tr>
                </thead>
                <tbody>
                  {lossPositions.map((p) => (
                    <tr key={p.symbol} className="border-b border-line-dim hover:bg-bg-hover">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="text-amber font-medium leading-tight">{p.name}</div>
                        <div className="text-xxs text-ink-faint tabular leading-tight">{p.symbol}</div>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular text-loss">
                        -₩{Math.round(p.lossKrw).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular text-loss">
                        {p.returnPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-1.5 text-right tabular text-gain">
                        +₩{Math.round(p.lossKrw * TAX_RATE).toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="mt-3 text-2xs text-ink-faint leading-relaxed">
          한국 주식은 대주주 외 양도세 미부과 → 절세 대상 제외 · 해외 주식 양도세 22% (지방세 포함) · 연 250만 기본공제 적용.
          실제 세금은 연 *순 양도차익* (실현 이익 − 실현 손실) 기준 — 단순 시뮬레이션
        </div>
      </div>
    </Panel>
  )
}

function StatBox({ label, value, tone, sub }: { label: string; value: number; tone: 'gain' | 'loss'; sub: string }) {
  return (
    <div className="bg-bg-elev border border-line px-3 py-2">
      <div className="text-2xs uppercase tracking-widest text-ink-faint mb-0.5">{label}</div>
      <div className={`text-base tabular font-medium ${tone === 'gain' ? 'text-gain' : 'text-loss'}`}>
        {value >= 0 ? '+' : ''}₩{Math.round(value).toLocaleString('ko-KR')}
      </div>
      <div className="text-xxs text-ink-faint mt-0.5">{sub}</div>
    </div>
  )
}
