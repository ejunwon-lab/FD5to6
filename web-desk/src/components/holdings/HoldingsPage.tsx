import { usePortfolio } from '../../lib/usePortfolio'
import { holdings as sampleHoldings } from '../../lib/sampleData'
import { DashboardHoldings } from '../dashboard/DashboardHoldings'
import { ExposureMatrix } from './ExposureMatrix'

export function HoldingsPage() {
  const { holdings: liveHoldings, loading } = usePortfolio()
  const all = liveHoldings.length ? liveHoldings : sampleHoldings

  return (
    <div className="overflow-y-auto p-2 sm:p-3 grid gap-2.5">
      <ExposureMatrix holdings={all} />
      <DashboardHoldings holdings={all} />
      {loading && <div className="text-ink-faint text-2xs text-center py-2">loading...</div>}
    </div>
  )
}
