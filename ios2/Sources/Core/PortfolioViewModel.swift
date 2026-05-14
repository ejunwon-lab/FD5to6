import Foundation

@MainActor
class PortfolioViewModel: ObservableObject {
    static let shared = PortfolioViewModel()

    @Published var portfolio: PortfolioResponse?
    @Published var isLoading = false
    @Published var isUpdating = false
    @Published var errorMessage: String?
    @Published var lastUpdated: String = "아직 갱신 안됨"

    @Published var indicators: [ReferenceIndicator] = []
    @Published var isLoadingIndicators = false
    @Published var indicatorsUpdatedAt: String = "-"
    @Published var indicatorsError: String?

    @Published var trendHistory: [TrendEntry] = []
    @Published var isLoadingTrend = false

    private init() {
        if let cached = CacheService.shared.load() {
            portfolio = cached
            lastUpdated = cached.updatedAt ?? "-"
        }
        Task { await fetchPortfolio() }

        if let cached = CacheService.shared.loadIndicators() {
            indicators = cached.indicators ?? []
            indicatorsUpdatedAt = cached.updatedAt ?? "-"
        }
    }

    func fetchPortfolio() async {
        guard !isLoading, !isUpdating else { return }
        isLoading = true
        errorMessage = nil
        do {
            let result = try await ScriptAPIService.shared.getPortfolio()
            applyResult(result)
        } catch is CancellationError {
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func triggerUpdate() async {
        await runUpdate { try await ScriptAPIService.shared.triggerUpdate() }
    }

    func updateHoldingsFull() async {
        await runUpdate { try await ScriptAPIService.shared.updateHoldingsFull() }
    }

    func updateHoldingsFast() async {
        await runUpdate { try await ScriptAPIService.shared.updateHoldingsFast() }
    }

    func updateAll() async {
        await runUpdate { try await ScriptAPIService.shared.updateAll() }
    }

    private func runUpdate(_ action: () async throws -> PortfolioResponse) async {
        guard !isUpdating else { return }
        isUpdating = true
        errorMessage = nil
        do {
            let result = try await action()
            applyResult(result)
        } catch {
            errorMessage = "갱신 실패: \(error.localizedDescription)"
        }
        isUpdating = false
    }

    func fetchIndicators() async {
        guard !isLoadingIndicators else { return }
        isLoadingIndicators = true
        indicatorsError = nil
        do {
            let result = try await ScriptAPIService.shared.getIndicators()
            if result.success == true {
                indicators = result.indicators ?? []
                indicatorsUpdatedAt = result.updatedAt ?? "-"
                CacheService.shared.saveIndicators(result)
            } else {
                indicatorsError = result.error ?? "알 수 없는 오류"
            }
        } catch is CancellationError {
        } catch {
            indicatorsError = "지표 갱신 실패: \(error.localizedDescription)"
        }
        isLoadingIndicators = false
    }

    func fetchTrendHistory() async {
        guard !isLoadingTrend, trendHistory.isEmpty else { return }
        isLoadingTrend = true
        do {
            let result = try await ScriptAPIService.shared.getProfitHistory()
            if result.success { trendHistory = result.entries ?? [] }
        } catch {}
        isLoadingTrend = false
    }

    func profitChange(forDays days: Int) -> (amount: Double, startDate: String)? {
        // 웹앱과 동일: history 배열 안에서 양 끝 차이 계산
        // (현재값을 summary와 혼합하지 않음 → 단일 소스로 일관)
        guard !trendHistory.isEmpty else { return nil }
        let target = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        let targetStr = fmt.string(from: target)
        let filtered = trendHistory.filter { $0.date >= targetStr }
        guard let first = filtered.first, let last = filtered.last else { return nil }
        return (amount: last.totalProfit - first.totalProfit, startDate: first.date)
    }

    private func applyResult(_ result: PortfolioResponse) {
        if result.success == true {
            portfolio = result
            lastUpdated = result.updatedAt ?? "-"
            CacheService.shared.save(result)
        } else {
            errorMessage = result.error ?? "알 수 없는 오류"
        }
    }
}
