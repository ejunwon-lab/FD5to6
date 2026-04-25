import SwiftUI

struct IndicatorsView: View {
    @EnvironmentObject var vm: PortfolioViewModel

    // 섹션 표시 순서
    private let categoryOrder: [String] = [
        "한국시장", "한국선물", "미국시장", "미국선물", "상품", "매크로"
    ]

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(spacing: 16) {
                        if let msg = vm.indicatorsError {
                            errorBanner(msg)
                        }

                        if vm.indicators.isEmpty && !vm.isLoadingIndicators {
                            emptyPlaceholder
                        } else {
                            ForEach(categoryOrder, id: \.self) { cat in
                                let items = vm.indicators.filter { $0.category == cat }
                                if !items.isEmpty {
                                    sectionCard(title: cat, items: items)
                                }
                            }
                        }

                        footerTime
                    }
                    .padding()
                }
                .refreshable {
                    await vm.fetchIndicators()
                }
            }

            if vm.isLoadingIndicators {
                loadingOverlay
            }
        }
        .task {
            if vm.indicators.isEmpty {
                await vm.fetchIndicators()
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 0) {
            HStack {
                Text("참고지표")
                    .font(.largeTitle).fontWeight(.bold)
                Spacer()
                Button {
                    Task { await vm.fetchIndicators() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.primary)
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial, in: Circle())
                }
                .disabled(vm.isLoadingIndicators)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 12)
        }
        .background(Color.pageBg)
    }

    // MARK: - Section Card

    private func sectionCard(title: String, items: [ReferenceIndicator]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.headline)
                .foregroundColor(.secondary)
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 8)

            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                    indicatorRow(item)
                    if idx < items.count - 1 {
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }

    private func indicatorRow(_ item: ReferenceIndicator) -> some View {
        HStack(spacing: 12) {
            Text(item.name)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(formattedValue(item.value))
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundColor(.primary)
                .frame(width: 90, alignment: .trailing)

            VStack(alignment: .trailing, spacing: 2) {
                Text(formattedChange(item.change))
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                Text(formattedPct(item.changePct))
                    .font(.system(size: 12, weight: .medium, design: .rounded))
            }
            .foregroundColor(item.change.profitColor)
            .frame(width: 80, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Helpers

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

    // MARK: - Footer / Overlays

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
            Text("지표 데이터 없음")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Text("갱신 버튼을 눌러 불러오세요")
                .font(.caption)
                .foregroundColor(.secondary)
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
