import Foundation

// "오늘 변동" 라벨 결정 (priceAsOfDate 기준)
//   priceAsOfDate == today (KST)           → "오늘"
//   today가 비거래일 (주말/공휴일)          → "최근"
//   priceAsOfDate == today - 1 (달력상 어제) → "전일"
//   그 외                                    → "최근"

private let KR_HOLIDAYS: Set<String> = [
    "2025-01-01",
    "2025-01-28", "2025-01-29", "2025-01-30",
    "2025-03-01", "2025-05-01", "2025-05-05", "2025-06-06",
    "2025-08-15",
    "2025-10-03", "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-09",
    "2025-12-25",
    "2026-01-01",
    "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-03-01", "2026-03-02",
    "2026-05-01", "2026-05-05", "2026-05-25",
    "2026-06-06", "2026-08-15",
    "2026-10-03", "2026-10-09",
    "2026-12-25", "2026-12-31",
]

private func kstFormatter() -> DateFormatter {
    let fmt = DateFormatter()
    fmt.dateFormat = "yyyy-MM-dd"
    fmt.timeZone = TimeZone(identifier: "Asia/Seoul")
    return fmt
}

private func isWeekendOrHoliday(_ date: Date) -> Bool {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "Asia/Seoul")!
    let weekday = cal.component(.weekday, from: date)  // 1=일, 7=토
    if weekday == 1 || weekday == 7 { return true }
    let s = kstFormatter().string(from: date)
    return KR_HOLIDAYS.contains(s)
}

func decideChangeLabel(_ priceAsOfDate: String?) -> String {
    guard let priceAsOfDate else { return "최근" }
    let fmt = kstFormatter()
    let today = Date()
    let todayStr = fmt.string(from: today)
    if priceAsOfDate == todayStr { return "오늘" }
    if isWeekendOrHoliday(today) { return "최근" }
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "Asia/Seoul")!
    guard let ystdy = cal.date(byAdding: .day, value: -1, to: today) else { return "최근" }
    let ystdyStr = fmt.string(from: ystdy)
    if priceAsOfDate == ystdyStr { return "전일" }
    return "최근"
}
