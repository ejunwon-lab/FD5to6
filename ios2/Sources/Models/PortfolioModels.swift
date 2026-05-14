import Foundation

struct PortfolioResponse: Codable {
    let success: Bool
    let error: String?
    let updatedAt: String?
    let usdRate: Double?
    let gbpRate: Double?
    let summary: Summary?
    let byCategory: [String: GroupStat]?
    let byAccount: [String: GroupStat]?
    let holdings: [Holding]?
}

struct Summary: Codable {
    let totalBuy: Double
    let totalCurrent: Double
    let totalProfit: Double
    let profitRate: Double
    let trendTotalProfit: Double?
    let totalProfitRate: Double?
    let confirmedProfit: Double?
    let confirmedProfitRate: Double?
    let trendOperatingProfit: Double?
    let operatingProfitRate: Double?
    let dayChangAmount: Double?
    let dayChangePct: String?
    let prevDayChangAmount: Double?
    let prevDayChangePct: String?
    let isMarketDay: Bool?
    let isTradingDay: Bool?
    let priceAsOfDate: String?
}

struct GroupStat: Codable {
    let current: Double
    let buy: Double
    let profit: Double
    let count: Int
    let profitRate: Double
    let pct: Double
}

struct ReferenceIndicator: Codable, Identifiable {
    var id: String { key }
    let key: String
    let name: String
    let category: String
    let value: Double
    let change: Double
    let changePct: Double

    var isUp: Bool { change >= 0 }
}

struct IndicatorsResponse: Codable {
    let success: Bool
    let error: String?
    let updatedAt: String?
    let indicators: [ReferenceIndicator]?
}

struct TrendEntry: Codable {
    let date: String
    let totalProfit: Double
}

struct TrendHistoryResponse: Codable {
    let success: Bool
    let error: String?
    let entries: [TrendEntry]?
}

struct Holding: Codable, Identifiable {
    var id: String { "\(code)-\(broker)-\(accountType)" }
    let code: String
    let name: String
    let category: String
    let broker: String
    let accountType: String
    let quantity: Double
    let buyPrice: Double
    let currentPrice: Double
    let opBuy: Double
    let opCurrent: Double
    let opProfit: Double
    let profitRate: Double
    let change: Double
    let changePct: String
    let m1: Double
    let m3: Double
    let m6: Double
    let y1: Double
    let high52: Double
    let low52: Double
    let buyDate: String?

    var isProfit: Bool { opProfit >= 0 }
    var isUS: Bool { code.range(of: #"^[A-Z]{1,5}$"#, options: .regularExpression) != nil }

    var holdingDays: Int {
        guard let buyDate, !buyDate.isEmpty else { return 0 }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        guard let date = fmt.date(from: buyDate) else { return 0 }
        return max(0, Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 0)
    }

    var holdingDurationText: String? {
        let days = holdingDays
        guard days > 0 || buyDate != nil else { return nil }
        guard let buyDate, !buyDate.isEmpty else { return nil }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        guard fmt.date(from: buyDate) != nil else { return nil }
        if days < 30 { return "\(days)일" }
        let months = days / 30
        let rem    = days % 30
        return rem > 0 ? "\(months)개월 \(rem)일" : "\(months)개월"
    }

    var dailyChangePct: Double {
        guard currentPrice > 0 else { return 0 }
        return change / currentPrice * 100
    }
}

// ── 종목 상세 ──────────────────────────────────────────────
struct StockTransaction: Codable, Identifiable {
    var id: String { "\(date)-\(type)-\(broker)-\(accountType)-\(quantity)-\(price)" }
    let date: String
    let type: String       // '매수' | '매도'
    let broker: String
    let accountType: String
    let quantity: Double
    let price: Double
    let amount: Double
    let fee: Double
    var isBuy: Bool { type == "매수" }
}

struct StockPosition: Codable, Identifiable {
    var id: String { "\(broker)-\(accountType)" }
    let broker: String
    let accountType: String
    let quantity: Double
    let avgPrice: Double
    let buyAmount: Double
    let currentPrice: Double
    let opCurrent: Double
    let opProfit: Double
    let profitRate: Double
    let high52: Double
    let low52: Double
}

struct StockPricePoint: Codable, Identifiable {
    var id: String { date }
    let date: String
    let price: Double
}

struct StockDetailSummary: Codable {
    let totalQuantity: Double
    let totalBuyAmount: Double
    let totalCurrentValue: Double
    let totalProfit: Double
    let profitRate: Double
}

struct StockDetailStats: Codable {
    let transactionCount: Int
    let buyCount: Int
    let sellCount: Int
    let firstBuyDate: String?
    let lastTransactionDate: String?
}

struct StockDetailResponse: Codable {
    let success: Bool
    let error: String?
    let code: String?
    let name: String?
    let category: String?
    let positions: [StockPosition]?
    let summary: StockDetailSummary?
    let transactions: [StockTransaction]?
    let priceHistory: [StockPricePoint]?
    let stats: StockDetailStats?
}

// ── 월별 실현손익 ──────────────────────────────────────────
struct MonthlyRealizedEntry: Codable, Identifiable {
    var id: String { month }
    let month: String
    let count: Int
    let winCount: Int
    let profit: Double
    let profitRate: Double
    let winRate: Double
}

struct MonthlyRealizedResponse: Codable {
    let success: Bool
    let error: String?
    let monthly: [MonthlyRealizedEntry]?
}
