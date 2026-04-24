import SwiftUI
import Charts

struct AnalysisView: View {
    @EnvironmentObject var vm: PortfolioViewModel

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()
            VStack(spacing: 0) {
                Text("분석")
                    .font(.largeTitle).fontWeight(.bold)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.pageBg)
                ScrollView {
                    VStack(spacing: 20) {
                        if let byCategory = vm.portfolio?.byCategory, !byCategory.isEmpty {
                            donutSection(title: "분류별 자산 비중", data: byCategory)
                        }
                        if let byAccount = vm.portfolio?.byAccount, !byAccount.isEmpty {
                            donutSection(title: "계좌별 자산 비중", data: byAccount)
                        }
                        topBottomSection
                    }
                    .padding()
                }
            }
        }
    }

    private func donutSection(title: String, data: [String: GroupStat]) -> some View {
        let sorted = data.sorted { $0.value.current > $1.value.current }
        let colors: [Color] = [.accent, .purple, .teal, .orange, .pink, .green]

        return VStack(alignment: .leading, spacing: 16) {
            Text(title).font(.headline)

            HStack(alignment: .center, spacing: 24) {
                Chart(sorted.indices, id: \.self) { i in
                    SectorMark(
                        angle: .value("금액", sorted[i].value.current),
                        innerRadius: .ratio(0.55),
                        angularInset: 2
                    )
                    .foregroundStyle(colors[i % colors.count])
                    .cornerRadius(4)
                }
                .frame(width: 140, height: 140)

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(sorted.indices, id: \.self) { i in
                        HStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(colors[i % colors.count])
                                .frame(width: 10, height: 10)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(sorted[i].key).font(.caption).fontWeight(.medium)
                                Text("\(sorted[i].value.pct, specifier: "%.1f")% · \(sorted[i].value.profitRate.pctFormatted)")
                                    .font(.caption2).foregroundColor(.secondary)
                            }
                        }
                    }
                }
                Spacer()
            }
        }
        .padding(20)
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }

    private var topBottomSection: some View {
        let holdings = vm.portfolio?.holdings ?? []
        let sorted = holdings.sorted { $0.profitRate > $1.profitRate }
        let top3 = Array(sorted.prefix(3))
        let bottom3 = Array(sorted.suffix(3).reversed())

        return VStack(alignment: .leading, spacing: 16) {
            Text("수익률 순위").font(.headline)

            VStack(spacing: 0) {
                rankHeader
                Divider()
                ForEach(top3.indices, id: \.self) { i in
                    rankRow(rank: i + 1, holding: top3[i], isTop: true)
                    if i < top3.count - 1 { Divider() }
                }
                Divider().padding(.vertical, 4)
                ForEach(bottom3.indices, id: \.self) { i in
                    rankRow(rank: (holdings.count) - i, holding: bottom3[i], isTop: false)
                    if i < bottom3.count - 1 { Divider() }
                }
            }
            .background(Color.cardBg)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .padding(20)
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }

    private var rankHeader: some View {
        HStack {
            Text("순위").frame(width: 30)
            Text("종목").frame(maxWidth: .infinity, alignment: .leading)
            Text("수익률").frame(width: 70, alignment: .trailing)
            Text("평가손익").frame(width: 80, alignment: .trailing)
        }
        .font(.caption).foregroundColor(.secondary)
        .padding(.horizontal, 12).padding(.vertical, 8)
    }

    private func rankRow(rank: Int, holding: Holding, isTop: Bool) -> some View {
        HStack {
            Text("\(rank)").font(.caption).fontWeight(.bold)
                .foregroundColor(isTop ? .profit : .loss)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(holding.name).font(.caption).fontWeight(.medium).lineLimit(1)
                Text(holding.category).font(.caption2).foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(holding.profitRate.pctFormatted)
                .font(.caption).fontWeight(.bold)
                .foregroundColor(holding.opProfit.profitColor)
                .frame(width: 70, alignment: .trailing)
            Text(holding.opProfit.krwFormatted)
                .font(.caption2)
                .foregroundColor(holding.opProfit.profitColor)
                .frame(width: 80, alignment: .trailing)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
    }
}
