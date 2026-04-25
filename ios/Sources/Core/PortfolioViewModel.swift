import Foundation

@MainActor
class PortfolioViewModel: ObservableObject {
    static let shared = PortfolioViewModel()

    @Published var portfolio: PortfolioResponse?
    @Published var isLoading = false
    @Published var isUpdating = false
    @Published var errorMessage: String?
    @Published var lastUpdated: String = "아직 갱신 안됨"

    // 참고지표
    @Published var indicators: [ReferenceIndicator] = []
    @Published var isLoadingIndicators = false
    @Published var indicatorsUpdatedAt: String = "-"
    @Published var indicatorsError: String?

    private init() {
        // 포트폴리오 캐시 즉시 표시 후 백그라운드 조회
        if let cached = CacheService.shared.load() {
            portfolio = cached
            lastUpdated = cached.updatedAt ?? "-"
        }
        Task { await fetchPortfolio() }

        // 참고지표 캐시 즉시 표시 (수동 갱신 전까지 유지)
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
            // pull-to-refresh 취소는 에러 아님 — 무시
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
            // 무시
        } catch {
            indicatorsError = "지표 갱신 실패: \(error.localizedDescription)"
        }
        isLoadingIndicators = false
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
