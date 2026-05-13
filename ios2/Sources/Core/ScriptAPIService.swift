import Foundation

actor ScriptAPIService {
    static let shared = ScriptAPIService()

    private let scriptID = "1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ"
    private let baseURL = "https://script.googleapis.com/v1/scripts"

    private init() {}

    func getPortfolio() async throws -> PortfolioResponse {
        return try await callFunction("newMobileGetPortfolio")
    }

    func triggerUpdate() async throws -> PortfolioResponse {
        return try await callFunction("newMobileUpdateCurrentPrice", useBackground: true)
    }

    func updateHoldingsFull() async throws -> PortfolioResponse {
        return try await callFunction("newMobileUpdateHistory", useBackground: true)
    }

    func updateHoldingsFast() async throws -> PortfolioResponse {
        return try await callFunction("newMobileUpdateCurrentPrice", useBackground: true)
    }

    func updateAll() async throws -> PortfolioResponse {
        return try await callFunction("newMobileUpdateAll", useBackground: true)
    }

    func getIndicators() async throws -> IndicatorsResponse {
        return try await callIndicatorsFunction("newMobileGetIndicators", useBackground: false)
    }

    func getStockDetail(code: String) async throws -> StockDetailResponse {
        let data = try await rawCallWithParams("newMobileGetStockDetail", parameters: [code], useBackground: false)
        return try decodeResult(data: data, type: StockDetailResponse.self)
    }

    func getMonthlyRealized() async throws -> MonthlyRealizedResponse {
        let data = try await rawCall("newMobileGetMonthlyRealized", useBackground: false)
        return try decodeResult(data: data, type: MonthlyRealizedResponse.self)
    }

    private func decodeResult<T: Decodable>(data: Data, type: T.Type) throws -> T {
        let rawStr = String(data: data, encoding: .utf8) ?? "(empty)"
        guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIError.gasError(String(rawStr.prefix(500)))
        }
        if let error = raw["error"] as? [String: Any] {
            throw APIError.gasError(error["message"] as? String ?? "GAS 오류")
        }
        guard let responseDict = raw["response"] as? [String: Any] else {
            throw APIError.gasError("응답 없음")
        }
        if let resultStr = responseDict["result"] as? String,
           let resultData = resultStr.data(using: .utf8) {
            return try JSONDecoder().decode(T.self, from: resultData)
        }
        if let resultObj = responseDict["result"] {
            let resultData = try JSONSerialization.data(withJSONObject: resultObj)
            return try JSONDecoder().decode(T.self, from: resultData)
        }
        throw APIError.gasError("result 없음")
    }

    private func rawCallWithParams(_ name: String, parameters: [Any], useBackground: Bool) async throws -> Data {
        let token = try await AuthManager.shared.accessToken()
        let url = URL(string: "\(baseURL)/\(scriptID):run")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = try JSONSerialization.data(withJSONObject: [
            "function": name,
            "devMode": true,
            "parameters": parameters,
        ])
        if useBackground {
            request.httpBody = nil
            return try await BackgroundNetworkSession.shared.post(request: request, body: body)
        }
        request.httpBody = body
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        let session = URLSession(configuration: config)
        let (d, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        return d
    }

    func getProfitHistory() async throws -> TrendHistoryResponse {
        let data = try await rawCall("newMobileGetProfitHistory", useBackground: false)
        let rawStr = String(data: data, encoding: .utf8) ?? "(empty)"
        guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIError.gasError(String(rawStr.prefix(500)))
        }
        if let error = raw["error"] as? [String: Any] {
            throw APIError.gasError(error["message"] as? String ?? "GAS 오류")
        }
        guard let responseDict = raw["response"] as? [String: Any] else {
            throw APIError.gasError("응답 없음")
        }
        if let resultStr = responseDict["result"] as? String,
           let resultData = resultStr.data(using: .utf8) {
            return try JSONDecoder().decode(TrendHistoryResponse.self, from: resultData)
        }
        if let resultObj = responseDict["result"] {
            let resultData = try JSONSerialization.data(withJSONObject: resultObj)
            return try JSONDecoder().decode(TrendHistoryResponse.self, from: resultData)
        }
        throw APIError.gasError("result 없음")
    }

    private func callIndicatorsFunction(_ name: String, useBackground: Bool = false) async throws -> IndicatorsResponse {
        let data = try await rawCall(name, useBackground: useBackground)
        let rawStr = String(data: data, encoding: .utf8) ?? "(empty)"

        guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIError.gasError(String(rawStr.prefix(500)))
        }
        if let error = raw["error"] as? [String: Any] {
            let msg = error["message"] as? String ?? "GAS 실행 오류"
            throw APIError.gasError(msg)
        }
        guard let responseDict = raw["response"] as? [String: Any] else {
            throw APIError.gasError("응답 없음: \(rawStr.prefix(300))")
        }
        if let resultStr = responseDict["result"] as? String,
           let resultData = resultStr.data(using: .utf8) {
            return try JSONDecoder().decode(IndicatorsResponse.self, from: resultData)
        }
        if let resultObj = responseDict["result"] {
            let resultData = try JSONSerialization.data(withJSONObject: resultObj)
            return try JSONDecoder().decode(IndicatorsResponse.self, from: resultData)
        }
        throw APIError.gasError("result 없음")
    }

    private func rawCall(_ name: String, useBackground: Bool) async throws -> Data {
        let token = try await AuthManager.shared.accessToken()
        let url = URL(string: "\(baseURL)/\(scriptID):run")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = try JSONSerialization.data(withJSONObject: [
            "function": name,
            "devMode": true
        ])

        if useBackground {
            request.httpBody = nil
            return try await BackgroundNetworkSession.shared.post(request: request, body: body)
        } else {
            request.httpBody = body
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 30
            let session = URLSession(configuration: config)
            let (d, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0)
            }
            return d
        }
    }

    private func callFunction(_ name: String, useBackground: Bool = false) async throws -> PortfolioResponse {
        let token = try await AuthManager.shared.accessToken()
        let url = URL(string: "\(baseURL)/\(scriptID):run")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = try JSONSerialization.data(withJSONObject: [
            "function": name,
            "devMode": true
        ])

        let data: Data
        if useBackground {
            request.httpBody = nil
            data = try await BackgroundNetworkSession.shared.post(request: request, body: body)
        } else {
            request.httpBody = body
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 30
            let session = URLSession(configuration: config)
            let (d, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0)
            }
            data = d
        }

        let rawStr = String(data: data, encoding: .utf8) ?? "(empty)"

        guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIError.gasError(String(rawStr.prefix(500)))
        }

        if let error = raw["error"] as? [String: Any] {
            let msg = error["message"] as? String ?? "GAS 실행 오류"
            throw APIError.gasError(msg)
        }

        guard let responseDict = raw["response"] as? [String: Any] else {
            throw APIError.gasError("응답 없음: \(rawStr.prefix(300))")
        }

        if let resultStr = responseDict["result"] as? String,
           let resultData = resultStr.data(using: .utf8) {
            return try JSONDecoder().decode(PortfolioResponse.self, from: resultData)
        }

        if let resultObj = responseDict["result"] {
            let resultData = try JSONSerialization.data(withJSONObject: resultObj)
            return try JSONDecoder().decode(PortfolioResponse.self, from: resultData)
        }

        throw APIError.gasError("result 없음")
    }
}

enum APIError: LocalizedError {
    case httpError(Int)
    case decodingError
    case gasError(String)

    var errorDescription: String? {
        switch self {
        case .httpError(let code): return "서버 오류 (\(code))"
        case .decodingError: return "데이터 처리 오류"
        case .gasError(let msg): return "GAS 오류: \(msg)"
        }
    }
}
