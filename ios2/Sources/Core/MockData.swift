import Foundation

enum MockData {

    static let holdings: [Holding] = [
        Holding(
            code: "005930", name: "삼성전자", category: "반도체",
            broker: "한국투자", accountType: "종합_랩",
            quantity: 100, buyPrice: 71500, currentPrice: 78400,
            opBuy: 7_150_000, opCurrent: 7_840_000, opProfit: 690_000, profitRate: 9.65,
            change: 800, changePct: "+1.03%",
            m1: 5.2, m3: 12.1, m6: -3.4, y1: 18.7,
            high52: 88_800, low52: 58_200,
            buyDate: "2024-03-15"
        ),
        Holding(
            code: "000660", name: "SK하이닉스", category: "반도체",
            broker: "미래에셋", accountType: "ISA",
            quantity: 30, buyPrice: 145_000, currentPrice: 198_500,
            opBuy: 4_350_000, opCurrent: 5_955_000, opProfit: 1_605_000, profitRate: 36.90,
            change: 2_500, changePct: "+1.28%",
            m1: 8.3, m3: 22.4, m6: 15.1, y1: 44.2,
            high52: 238_500, low52: 141_000,
            buyDate: "2023-11-20"
        ),
        Holding(
            code: "035420", name: "NAVER", category: "IT",
            broker: "키움", accountType: "종합_랩",
            quantity: 20, buyPrice: 210_000, currentPrice: 185_000,
            opBuy: 4_200_000, opCurrent: 3_700_000, opProfit: -500_000, profitRate: -11.90,
            change: -3_000, changePct: "-1.60%",
            m1: -4.1, m3: -9.8, m6: -18.2, y1: -22.5,
            high52: 248_000, low52: 168_500,
            buyDate: "2024-01-08"
        ),
        Holding(
            code: "NVDA", name: "NVIDIA", category: "미국주식",
            broker: "한국투자", accountType: "종합_랩",
            quantity: 15, buyPrice: 62.5, currentPrice: 118.3,
            opBuy: 937_500, opCurrent: 1_774_500, opProfit: 837_000, profitRate: 89.28,
            change: 3.2, changePct: "+2.78%",
            m1: 14.5, m3: 38.2, m6: 55.1, y1: 192.4,
            high52: 153.13, low52: 47.32,
            buyDate: "2023-06-10"
        ),
        Holding(
            code: "AAPL", name: "Apple", category: "미국주식",
            broker: "미래에셋", accountType: "ISA",
            quantity: 25, buyPrice: 175.0, currentPrice: 211.4,
            opBuy: 4_375_000, opCurrent: 5_285_000, opProfit: 910_000, profitRate: 20.80,
            change: 1.8, changePct: "+0.86%",
            m1: 3.2, m3: 7.8, m6: 12.4, y1: 28.6,
            high52: 237.23, low52: 164.08,
            buyDate: "2023-09-05"
        ),
        Holding(
            code: "373220", name: "LG에너지솔루션", category: "2차전지",
            broker: "삼성", accountType: "퇴직연금_개인IRP",
            quantity: 10, buyPrice: 480_000, currentPrice: 312_000,
            opBuy: 4_800_000, opCurrent: 3_120_000, opProfit: -1_680_000, profitRate: -35.00,
            change: -8_000, changePct: "-2.50%",
            m1: -6.2, m3: -18.4, m6: -28.9, y1: -42.1,
            high52: 402_000, low52: 298_000,
            buyDate: "2023-04-22"
        ),
    ]

    static let summary = Summary(
        totalBuy: 25_812_500,
        totalCurrent: 27_674_500,
        totalProfit: 1_862_000,
        profitRate: 7.21,
        trendTotalProfit: 1_650_000,
        totalProfitRate: 6.39,
        confirmedProfit: 320_000,
        confirmedProfitRate: 1.24,
        trendOperatingProfit: 1_862_000,
        operatingProfitRate: 7.21,
        dayChangAmount: 85_000,
        dayChangePct: "+0.31%",
        prevDayChangAmount: -120_000,
        prevDayChangePct: "-0.43%",
        isMarketDay: true,
        isTradingDay: true,
        priceAsOfDate: nil
    )

    static let byCategory: [String: GroupStat] = [
        "반도체": GroupStat(current: 13_795_000, buy: 11_500_000, profit: 2_295_000, count: 2, profitRate: 19.96, pct: 49.8),
        "미국주식": GroupStat(current: 7_059_500, buy: 5_312_500, profit: 1_747_000, count: 2, profitRate: 32.88, pct: 25.5),
        "IT":      GroupStat(current: 3_700_000, buy: 4_200_000, profit: -500_000, count: 1, profitRate: -11.90, pct: 13.4),
        "2차전지":  GroupStat(current: 3_120_000, buy: 4_800_000, profit: -1_680_000, count: 1, profitRate: -35.00, pct: 11.3),
    ]

    static let byAccount: [String: GroupStat] = [
        "종합_랩":       GroupStat(current: 13_314_500, buy: 12_287_500, profit: 1_027_000, count: 3, profitRate: 8.36, pct: 48.1),
        "ISA":          GroupStat(current: 9_240_000, buy: 8_725_000, profit: 515_000,   count: 2, profitRate: 5.90, pct: 33.4),
        "퇴직연금_개인IRP": GroupStat(current: 3_120_000, buy: 4_800_000, profit: -1_680_000, count: 1, profitRate: -35.00, pct: 11.3),
    ]

    static let portfolioResponse = PortfolioResponse(
        success: true,
        error: nil,
        updatedAt: "2026-05-03 09:15:00",
        usdRate: 1_348.5,
        gbpRate: 1_702.3,
        summary: summary,
        byCategory: byCategory,
        byAccount: byAccount,
        holdings: holdings
    )

    static let indicatorsResponse = IndicatorsResponse(
        success: true,
        error: nil,
        updatedAt: "2026-05-03 09:10:00",
        indicators: [
            ReferenceIndicator(key: "KOSPI",  name: "코스피",   category: "국내지수", value: 2_612.35, change: 18.45,  changePct: 0.71),
            ReferenceIndicator(key: "KOSDAQ", name: "코스닥",   category: "국내지수", value: 868.72,  change: -4.12,  changePct: -0.47),
            ReferenceIndicator(key: "SPX",    name: "S&P 500", category: "미국지수", value: 5_218.44, change: 42.31,  changePct: 0.82),
        ]
    )

    static let trendHistoryResponse = TrendHistoryResponse(
        success: true,
        error: nil,
        entries: [
            TrendEntry(date: "2026-01-06", totalProfit: 450_000),
            TrendEntry(date: "2026-02-03", totalProfit: 950_000),
            TrendEntry(date: "2026-03-03", totalProfit: 1_180_000),
            TrendEntry(date: "2026-04-07", totalProfit: 1_420_000),
            TrendEntry(date: "2026-05-03", totalProfit: 1_862_000),
        ]
    )
}
