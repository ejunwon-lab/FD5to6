import Foundation

actor ScriptAPIService {
    static let shared = ScriptAPIService()

    private let scriptID = "12MAcPpoVE39N_Sz0B79G0rjGvevJ8-S_ibVC1Ot61fyVPZnaSQmrJyiR"
    private let baseURL = "https://script.googleapis.com/v1/scripts"

    private init() {}

    func getPortfolio() async throws -> PortfolioResponse {
        return try await callFunction("mobileGetPortfolio")
    }

    func triggerUpdate() async throws -> PortfolioResponse {
        return try await callFunction("mobileTriggerUpdate", useBackground: true)
    }

    func updateHoldingsFull() async throws -> PortfolioResponse {
        return try await callFunction("mobileUpdateHoldingsFull", useBackground: true)
    }

    func updateHoldingsFast() async throws -> PortfolioResponse {
        return try await callFunction("mobileUpdateHoldingsFast", useBackground: true)
    }

    func updateAll() async throws -> PortfolioResponse {
        return try await callFunction("mobileUpdateAll", useBackground: true)
    }

    func getIndicators() async throws -> IndicatorsResponse {
        return try await callIndicatorsFunction("mobileGetReferenceIndicators", useBackground: false)
    }

    func getProfitHistory() async throws -> TrendHistoryResponse {
        let data = try await rawCall("mobileGetProfitHistory", useBackground: false)
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
            // 백그라운드 세션: 화면이 꺼져도 OS가 연결을 유지하여 완료 후 앱을 깨움
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

        // scripts.run 응답에서 result 추출
        guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIError.gasError(String(rawStr.prefix(500)))
        }

        // GAS 실행 오류 처리
        if let error = raw["error"] as? [String: Any] {
            let msg = error["message"] as? String ?? "GAS 실행 오류"
            throw APIError.gasError(msg)
        }

        guard let responseDict = raw["response"] as? [String: Any] else {
            throw APIError.gasError("응답 없음: \(rawStr.prefix(300))")
        }

        // result가 String인 경우 (JSON.stringify로 반환)
        if let resultStr = responseDict["result"] as? String,
           let resultData = resultStr.data(using: .utf8) {
            return try JSONDecoder().decode(PortfolioResponse.self, from: resultData)
        }

        // result가 이미 객체인 경우
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
