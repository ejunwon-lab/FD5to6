import Foundation

class CacheService {
    static let shared = CacheService()
    private let key = "portfolio_cache"
    private init() {}

    func save(_ response: PortfolioResponse) {
        if let data = try? JSONEncoder().encode(response) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    func load() -> PortfolioResponse? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(PortfolioResponse.self, from: data)
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
