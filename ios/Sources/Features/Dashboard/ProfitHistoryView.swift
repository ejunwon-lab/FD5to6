import SwiftUI
import Charts

struct ProfitHistoryView: View {
    @EnvironmentObject var vm: PortfolioViewModel
    @State private var selectedDays = 30

    private let options = [(7, "1주"), (30, "1달"), (90, "3달"), (180, "6달")]

    // MARK: - Computed

    private var result: (amount: Double, startDate: String)? { vm.profitChange(forDays: selectedDays) }
    private var isProfit: Bool { (result?.amount ?? 0) >= 0 }
    private var accentColor: Color {
        isProfit ? Color(red: 0.85, green: 0.10, blue: 0.10) : Color(red: 0.05, green: 0.35, blue: 0.85)
    }

    private var periodEntries: [(date: Date, value: Double)] {
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        let target = Calendar.current.date(byAdding: .day, value: -selectedDays, to: Date()) ?? Date()
        let targetStr = fmt.string(from: target)
        return vm.trendHistory
            .filter { $0.date >= targetStr && !isWeekend($0.date) }
            .compactMap { e in
                guard let d = fmt.date(from: e.date) else { return nil }
                return (date: d, value: e.totalProfit)
            }
    }

    private var dailyAverage: Double? {
        guard let r = result, selectedDays > 0 else { return nil }
        return r.amount / Double(selectedDays)
    }

    private var bestWorst: (best: (date: String, change: Double), worst: (date: String, change: Double))? {
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        let target = Calendar.current.date(byAdding: .day, value: -selectedDays, to: Date()) ?? Date()
        let targetStr = fmt.string(from: target)
        let all = vm.trendHistory.filter { !isWeekend($0.date) }
        guard let firstIdx = all.firstIndex(where: { $0.date >= targetStr }) else { return nil }
        let entries = Array(all[max(0, firstIdx - 1)...])
        guard entries.count > 1 else { return nil }
        let deltas = zip(entries.dropFirst(), entries).map { (c, p) in
            (date: c.date, change: c.totalProfit - p.totalProfit)
        }
        guard let best  = deltas.max(by: { $0.change < $1.change }),
              let worst = deltas.min(by: { $0.change < $1.change }) else { return nil }
        return (best, worst)
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()
            VStack(spacing: 0) {
                header.padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 16)
                periodSelector.padding(.horizontal, 16).padding(.bottom, 12)

                if vm.isLoadingTrend {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else {
                    VStack(spacing: 12) {
                        dateRangeBar
                        amountCard
                        chartSection
                        if let avg = dailyAverage, let bw = bestWorst {
                            statsRow(avg: avg, best: bw.best, worst: bw.worst)
                        }
                    }
                    .padding(.horizontal, 16)
                }

                Spacer()
                swipeHint.padding(.bottom, 20)
            }
        }
        .task { await vm.fetchTrendHistory() }
    }

    // MARK: - Sub Views

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("기간별 수익").font(.largeTitle).fontWeight(.bold)
            Text("추이 기록 기반 합계 수익 변화").font(.subheadline).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var periodSelector: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.0) { days, label in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { selectedDays = days }
                } label: {
                    Text(label)
                        .font(.subheadline).fontWeight(.semibold)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(selectedDays == days ? Color(red: 0.25, green: 0.35, blue: 0.90) : Color.cardBg)
                        .foregroundColor(selectedDays == days ? .white : .primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    @ViewBuilder
    private var dateRangeBar: some View {
        if let r = result {
            HStack(spacing: 6) {
                Text(formattedDate(r.startDate))
                Image(systemName: "arrow.right").font(.caption2)
                Text(formattedDate(todayString()))
            }
            .font(.subheadline).foregroundColor(.secondary)
            .padding(.vertical, 10).frame(maxWidth: .infinity)
            .background(Color.cardBg)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    @ViewBuilder
    private var amountCard: some View {
        if let r = result {
            let sign = r.amount >= 0 ? "+" : ""
            VStack(spacing: 8) {
                Text("지난 \(selectedDays)일 수익").font(.subheadline).foregroundColor(.white.opacity(0.8))
                Text("\(sign)\(r.amount.krwFormatted)")
                    .font(.system(size: 38, weight: .bold, design: .rounded)).foregroundColor(.white)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 22)
            .background(accentColor)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: .black.opacity(0.1), radius: 12, y: 4)
        }
    }

    private var chartSection: some View {
        let entries = periodEntries
        let baseline = entries.first?.value ?? 0
        return VStack(alignment: .leading, spacing: 6) {
            Text("수익 추이").font(.caption).foregroundColor(.secondary)
            if entries.count > 1 {
                Chart(entries, id: \.date) { point in
                    LineMark(
                        x: .value("날짜", point.date),
                        y: .value("수익", point.value - baseline)
                    )
                    .foregroundStyle(accentColor)
                    AreaMark(
                        x: .value("날짜", point.date),
                        y: .value("수익", point.value - baseline)
                    )
                    .foregroundStyle(accentColor.opacity(0.15))
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .frame(height: 80)
            } else {
                Text("데이터 부족").font(.caption).foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 80)
            }
        }
        .padding(14)
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func statsRow(avg: Double, best: (date: String, change: Double), worst: (date: String, change: Double)) -> some View {
        HStack(spacing: 8) {
            statCell(
                label: "일평균",
                value: (avg >= 0 ? "+" : "") + avg.krwFormatted,
                sub: " ",
                color: avg >= 0 ? Color(red: 0.85, green: 0.10, blue: 0.10) : Color(red: 0.05, green: 0.35, blue: 0.85)
            )
            statCell(
                label: "최고 하루",
                value: "+" + best.change.krwFormatted,
                sub: formattedDate(best.date),
                color: Color(red: 0.85, green: 0.10, blue: 0.10)
            )
            statCell(
                label: "최저 하루",
                value: worst.change.krwFormatted,
                sub: formattedDate(worst.date),
                color: worst.change < 0 ? Color(red: 0.05, green: 0.35, blue: 0.85) : Color(red: 0.85, green: 0.10, blue: 0.10)
            )
        }
    }

    private func statCell(label: String, value: String, sub: String? = nil, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(label).font(.footnote).foregroundColor(.secondary)
            Text(value).font(.subheadline).fontWeight(.semibold).foregroundColor(color)
                .lineLimit(1).minimumScaleFactor(0.7)
            if let sub { Text(sub).font(.footnote).foregroundColor(.secondary) }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var swipeHint: some View {
        HStack(spacing: 4) {
            Image(systemName: "chevron.up")
            Text("위로 스와이프 — 대시보드")
        }
        .font(.caption).foregroundColor(.secondary)
    }

    // MARK: - Helpers

    private func isWeekend(_ dateStr: String) -> Bool {
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        guard let date = fmt.date(from: dateStr) else { return false }
        let weekday = Calendar.current.component(.weekday, from: date)
        return weekday == 1 || weekday == 7 // 1=일, 7=토
    }

    private func todayString() -> String {
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: Date())
    }

    private func formattedDate(_ dateStr: String) -> String {
        let inFmt = DateFormatter(); inFmt.dateFormat = "yyyy-MM-dd"
        guard let date = inFmt.date(from: dateStr) else { return dateStr }
        let outFmt = DateFormatter()
        outFmt.locale = Locale(identifier: "ko_KR")
        outFmt.dateFormat = "M/d (E)"
        return outFmt.string(from: date)
    }
}
