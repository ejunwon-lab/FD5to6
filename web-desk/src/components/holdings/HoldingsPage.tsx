import { usePortfolio } from '../../lib/usePortfolio'
import { holdings as sampleHoldings } from '../../lib/sampleData'
import { DashboardHoldings } from '../dashboard/DashboardHoldings'
import { ExposureMatrix } from './ExposureMatrix'
import { AccountTypePanel } from './AccountTypePanel'
import { Position52WeekPanel } from './Position52WeekPanel'
import { ReturnHistogramPanel } from './ReturnHistogramPanel'

export function HoldingsPage() {
  const { holdings: liveHoldings, cashReserve, nonStockAssets, loading } = usePortfolio()
  const all = liveHoldings.length ? liveHoldings : sampleHoldings

  return (
    <div className="overflow-y-auto p-2 sm:p-3 grid gap-2.5">
      <ExposureMatrix holdings={all} cashReserve={cashReserve} nonStockAssets={nonStockAssets} />
      <AccountTypePanel holdings={all} cashReserve={cashReserve} nonStockAssets={nonStockAssets} />
      <div className="grid lg:grid-cols-2 gap-2.5">
        <Position52WeekPanel holdings={all} />
        <ReturnHistogramPanel holdings={all} />
      </div>
      <DashboardHoldings holdings={all} />
      {loading && <div className="text-ink-faint text-2xs text-center py-2">loading...</div>}
    </div>
  )
}
