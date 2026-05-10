import SwiftUI

struct IndicatorsView: View {
    @EnvironmentObject var vm: PortfolioViewModel
    @State private var refreshHapticTrigger = false

    private let categoryOrder: [String] = [
        "한국시장", "한국선물", "중국시장",
        "미국시장", "미국선물", "AI/반도체", "빅테크",
        "상품", "매크로"
    ]

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(spacing: 20) {
                        if let msg = vm.indicatorsError {
                            errorBanner(msg)
                        }

                        if vm.indicators.isEmpty && !vm.isLoadingIndicators {
                            emptyPlaceholder
                        } else {
                            ForEach(categoryOrder, id: \.self) { cat in
                                let items = vm.indicators.filter { $0.category == cat }
                                if !items.isEmpty {
                                    sectionBlock(title: cat, items: items)
                                }
                            }
                        }

                        footerTime
                    }
                    .padding()
                }
                .task {
                    await vm.fetchIndicators()
                }
            }

            if vm.isLoadingIndicators {
                loadingOverlay
            }
        }
    }

    private var header: some View {
        HStack {
            Text("참고지표")
                .font(.largeTitle).fontWeight(.bold)
            Spacer()
            Button {
                refreshHapticTrigger.toggle()
                Task { await vm.fetchIndicators() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundColor(.primary)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .disabled(vm.isLoadingIndicators)
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: refreshHapticTrigger)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .background(Color.pageBg)
    }

    private func sectionBlock(title: String, items: [ReferenceIndicator]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                    indicatorRow(item)
                    if idx < items.count - 1 {
                        Divider().padding(.leading, 28)
                    }
                }
            }
            .background(Color.cardBg)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
        }
    }

    private func indicatorRow(_ item: ReferenceIndicator) -> some View {
        let barColor: Color = item.change == 0
            ? Color.secondary.opacity(0.25)
            : item.change.profitColor

        return HStack(spacing: 0) {
            barColor
                .frame(width: 3)
                .padding(.vertical, 10)
                .padding(.leading, 10)
                .cornerRadius(1.5)

            HStack(spacing: 8) {
                Text(item.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(formattedValue(item.value))
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundColor(.primary)
                    .frame(width: 88, alignment: .trailing)

                VStack(alignment: .trailing, spacing: 1) {
                    Text(formattedChange(item.change))
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                    Text(formattedPct(item.changePct))
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                }
                .foregroundColor(item.change == 0 ? .secondary : item.change.profitColor)
                .frame(width: 72, alignment: .trailing)
            }
            .padding(.leading, 10)
            .padding(.trailing, 14)
            .padding(.vertical, 9)
        }
    }

    private func formattedValue(_ v: Double) -> String {
        if v == 0 { return "-" }
        if abs(v) >= 100 {
            return String(format: "%.2f", v)
        } else {
            return String(format: "%.3f", v)
        }
    }

    private func formattedChange(_ v: Double) -> String {
        if v == 0 { return "0.00" }
        return String(format: "%+.2f", v)
    }

    private func formattedPct(_ v: Double) -> String {
        if v == 0 { return "0.00%" }
        return String(format: "%+.2f%%", v)
    }

    private var footerTime: some View {
        VStack(spacing: 2) {
            Text("마지막 갱신")
                .font(.caption2)
                .foregroundColor(.secondary)
            Text(vm.indicatorsUpdatedAt)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var emptyPlaceholder: some View {
        VStack(spacing: 8) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 32))
                .foregroundColor(.secondary)
            Text("신시스템 참고지표 미구현")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Text("현재 신시스템에서는 참고지표를 제공하지 않습니다")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private var loadingOverlay: some View {
        VStack {
            Spacer()
            HStack(spacing: 12) {
                ProgressView().tint(.primary)
                Text("지표 갱신 중...")
                    .font(.subheadline)
                    .foregroundColor(.primary)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
            .padding(.bottom, 16)
        }
        .frame(maxWidth: .infinity)
    }

    private func errorBanner(_ msg: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.orange)
            Text(msg).font(.caption).foregroundColor(.primary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
