import SwiftUI
import Charts

struct ProfitHistoryView: View {
    @EnvironmentObject var vm: PortfolioViewModel
    @State private var selectedDays = 30

    private let options = [(7, "1주"), (30, "1달"), (90, "3달"), (180, "6달")]

    private var result: (amount: Double, startDate: String)? { vm.profitChange(forDays: selectedDays) }
    private var isProfit: Bool { (result?.amount ?? 0) >= 0 }
    private var accentColor: Color {
        isProfit ? Color.profit : Color.loss
    }

    private var periodEntries: [(date: Date, value: Double)] {
        // 웹앱과 동일: 기간 내 history 그대로. 주말 제외 안 함 (GAS가 거래일만 기록)
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        let target = Calendar.current.date(byAdding: .day, value: -selectedDays, to: Date()) ?? Date()
        let targetStr = fmt.string(from: target)
        return vm.trendHistory
            .filter { $0.date >= targetStr }
            .compactMap { e in
                guard let d = fmt.date(from: e.date) else { return nil }
                return (date: d, value: e.totalProfit)
            }
    }

    // 웹앱과 동일: 일별 변동(diff) 평균 (실제 변동일수 기준)
    private var dailyAverage: Double? {
        let entries = periodEntries
        guard entries.count >= 2 else { return nil }
        let diffs = zip(entries.dropFirst(), entries).map { $0.0.value - $0.1.value }
        guard !diffs.isEmpty else { return nil }
        return diffs.reduce(0, +) / Double(diffs.count)
    }

    private var bestWorst: (best: (date: String, change: Double), worst: (date: String, change: Double))? {
        let entries = periodEntries
        guard entries.count >= 2 else { return nil }
        let fmtOut = DateFormatter(); fmtOut.dateFormat = "yyyy-MM-dd"
        let deltas = zip(entries.dropFirst(), entries).map { (c, p) in
            (date: fmtOut.string(from: c.date), change: c.value - p.value)
        }
        guard let best  = deltas.max(by: { $0.change < $1.change }),
              let worst = deltas.min(by: { $0.change < $1.change }) else { return nil }
        return (best, worst)
    }

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
                color: avg >= 0 ? Color.profit : Color.loss
            )
            statCell(
                label: "최고 하루",
                value: "+" + best.change.krwFormatted,
                sub: formattedDate(best.date),
                color: Color.profit
            )
            statCell(
                label: "최저 하루",
                value: worst.change.krwFormatted,
                sub: formattedDate(worst.date),
                color: worst.change < 0 ? Color.loss : Color.profit
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

    private func isWeekend(_ dateStr: String) -> Bool {
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        guard let date = fmt.date(from: dateStr) else { return false }
        let weekday = Calendar.current.component(.weekday, from: date)
        return weekday == 1 || weekday == 7
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
