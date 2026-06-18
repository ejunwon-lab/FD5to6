import Foundation

// "오늘 변동" 라벨 결정 (priceAsOfDate 기준, 위에서부터 우선)
//   isTradingDay == false (주말/공휴일)     → "최근"  ← 서버 판정 사용
//   priceAsOfDate == today (KST)           → "오늘"
//   priceAsOfDate == today - 1 (달력상 어제) → "전일"
//   그 외                                    → "최근"
// 휴일 판정은 GAS(*휴장일* 시트) 단일 소스 — summary.isTradingDay 를 받아 씀.

private func kstFormatter() -> DateFormatter {
    let fmt = DateFormatter()
    fmt.dateFormat = "yyyy-MM-dd"
    fmt.timeZone = TimeZone(identifier: "Asia/Seoul")
    return fmt
}

func decideChangeLabel(_ priceAsOfDate: String?, _ isTradingDay: Bool?) -> String {
    guard let priceAsOfDate else { return "최근" }
    // 오늘이 거래일이 아니면(주말·공휴일) 어떤 priceAsOfDate든 "오늘"일 수 없음
    if isTradingDay == false { return "최근" }
    let fmt = kstFormatter()
    let today = Date()
    let todayStr = fmt.string(from: today)
    if priceAsOfDate == todayStr { return "오늘" }
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "Asia/Seoul")!
    guard let ystdy = cal.date(byAdding: .day, value: -1, to: today) else { return "최근" }
    let ystdyStr = fmt.string(from: ystdy)
    if priceAsOfDate == ystdyStr { return "전일" }
    return "최근"
}

// "마지막 갱신" 시각("yyyy-MM-dd HH:mm[:ss]")을 날짜/시간 2줄로 분리.
// 갱신·기존값 모두 GAS가 시트 저장 시각을 주므로 동일하게 표시됨.
func splitUpdatedAt(_ updatedAt: String?) -> (date: String, time: String) {
    guard let s = updatedAt?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return ("", "") }
    let parts = s.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true).map(String.init)
    if parts.count == 2 { return (parts[0], parts[1]) }
    return (parts.first ?? s, "")
}

// 수익 기준일 표시용: "2026-05-15" → "2026년 5월 15일 금요일"
func formatPriceAsOfDate(_ priceAsOfDate: String?) -> String {
    guard let priceAsOfDate,
          priceAsOfDate.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
    else { return "" }
    let inFmt = kstFormatter()
    inFmt.locale = Locale(identifier: "en_US_POSIX")
    guard let date = inFmt.date(from: priceAsOfDate) else { return "" }
    let outFmt = DateFormatter()
    outFmt.dateFormat = "yyyy년 M월 d일 EEEE"
    outFmt.timeZone = TimeZone(identifier: "Asia/Seoul")
    outFmt.locale = Locale(identifier: "ko_KR")
    return outFmt.string(from: date)
}
