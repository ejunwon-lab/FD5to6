import Foundation

class CacheService {
    static let shared = CacheService()
    private let portfolioKey = "portfolio_cache"
    private let indicatorsKey = "indicators_cache"
    private init() {}

    func save(_ response: PortfolioResponse) {
        if let data = try? JSONEncoder().encode(response) {
            UserDefaults.standard.set(data, forKey: portfolioKey)
        }
    }

    func load() -> PortfolioResponse? {
        guard let data = UserDefaults.standard.data(forKey: portfolioKey) else { return nil }
        return try? JSONDecoder().decode(PortfolioResponse.self, from: data)
    }

    func saveIndicators(_ response: IndicatorsResponse) {
        if let data = try? JSONEncoder().encode(response) {
            UserDefaults.standard.set(data, forKey: indicatorsKey)
        }
    }

    func loadIndicators() -> IndicatorsResponse? {
        guard let data = UserDefaults.standard.data(forKey: indicatorsKey) else { return nil }
        return try? JSONDecoder().decode(IndicatorsResponse.self, from: data)
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: portfolioKey)
        UserDefaults.standard.removeObject(forKey: indicatorsKey)
    }
}
