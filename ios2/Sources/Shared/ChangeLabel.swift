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

// "마지막 갱신" 시각("yyyy-MM-dd HH:mm[:ss]")을 표시용 날짜/시간으로 변환.
//   date → "2026-06-18(목)"   time → "pm 2:45" (12시간제, am/pm 소문자)
// 갱신·기존값 모두 GAS가 시트 저장 시각을 주므로 동일하게 표시됨.
func splitUpdatedAt(_ updatedAt: String?) -> (date: String, time: String) {
    guard let s = updatedAt?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return ("", "") }
    let parts = s.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true).map(String.init)
    let datePart = parts.first ?? ""
    let timePart = parts.count > 1 ? parts[1] : ""

    // 날짜 → "yyyy-MM-dd(요일)"
    var date = datePart
    if datePart.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        inFmt.timeZone = TimeZone(identifier: "Asia/Seoul")
        inFmt.locale = Locale(identifier: "en_US_POSIX")
        if let d = inFmt.date(from: datePart) {
            let wf = DateFormatter()
            wf.dateFormat = "E"
            wf.timeZone = TimeZone(identifier: "Asia/Seoul")
            wf.locale = Locale(identifier: "ko_KR")
            date = "\(datePart)(\(wf.string(from: d)))"
        }
    }

    // 시간 → "pm 2:45" (12시간제)
    var time = ""
    let comps = timePart.split(separator: ":").map(String.init)
    if comps.count >= 2, let h = Int(comps[0]) {
        let ampm = h < 12 ? "am" : "pm"
        let h12 = h % 12 == 0 ? 12 : h % 12
        time = "\(ampm) \(h12):\(comps[1])"
    }

    return (date, time)
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
