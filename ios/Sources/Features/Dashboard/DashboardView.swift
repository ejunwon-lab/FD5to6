import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var vm: PortfolioViewModel

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()
            VStack(spacing: 0) {
                dashboardHeader
                ScrollView {
                    VStack(spacing: 20) {
                        summaryCard
                        fxCard
                        if let msg = vm.errorMessage {
                            errorBanner(msg)
                        }
                    }
                    .padding()
                }
            }
            if vm.isUpdating {
                updateOverlay
            }
        }
    }

    private var dashboardHeader: some View {
        VStack(spacing: 0) {
            HStack {
                Button("로그아웃") { AuthManager.shared.signOut() }
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                HStack(spacing: 8) {
                    circleButton(icon: "bolt.fill",            action: { await vm.updateHoldingsFast() })
                    circleButton(icon: "square.grid.2x2.fill", action: { await vm.updateHoldingsFull() })
                    circleButton(icon: "wand.and.stars",       action: { await vm.updateAll() })
                }
                .disabled(vm.isUpdating)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 4)

            Text("JUN & SOO 투자 현황")
                .font(.largeTitle).fontWeight(.bold)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
        }
        .background(Color.pageBg)
    }

    private var summaryCard: some View {
        VStack(spacing: 20) {
            // 상단 카드: 합계수익 + 오늘수익
            VStack(spacing: 0) {
                VStack(spacing: 8) {
                    Text("합계 수익")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                    let trendTotal = vm.portfolio?.summary?.trendTotalProfit ?? 0
                    Text(trendTotal.krwFormatted)
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    let totalRate = vm.portfolio?.summary?.totalProfitRate ?? 0
                    Text(totalRate.pctFormatted)
                        .font(.headline)
                        .foregroundColor(.white.opacity(0.85))
                }
                .frame(maxWidth: .infinity)
                .padding(28)
                .background(
                    LinearGradient(
                        colors: [Color(red: 0.25, green: 0.35, blue: 0.90), Color(red: 0.45, green: 0.25, blue: 0.80)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                )

                let dayAmt = vm.portfolio?.summary?.dayChangAmount ?? 0
                let dayPct = vm.portfolio?.summary?.dayChangePct ?? "0%"
                VStack(spacing: 6) {
                    Text("오늘의 수익")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                    Text(dayAmt.krwFormatted)
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text(dayPct.asChangePct)
                        .font(.headline)
                        .foregroundColor(.white.opacity(0.85))
                }
                .padding(.vertical, 28)
                .frame(maxWidth: .infinity)
                .background(dayAmt >= 0 ? Color(red: 0.85, green: 0.10, blue: 0.10) : Color(red: 0.05, green: 0.35, blue: 0.85))
            }
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: .black.opacity(0.10), radius: 12, y: 4)

            // 하단 카드: 확정/운용 수익
            HStack {
                let confirmed = vm.portfolio?.summary?.confirmedProfit ?? 0
                let confirmedRate = vm.portfolio?.summary?.confirmedProfitRate ?? 0
                let operating = vm.portfolio?.summary?.trendOperatingProfit ?? 0
                let operatingRate = vm.portfolio?.summary?.operatingProfitRate ?? 0
                statItem(title: "확정 수익", value: confirmed.krwFormatted, rate: confirmedRate)
                Divider().frame(height: 48)
                statItem(title: "운용 수익", value: operating.krwFormatted, rate: operatingRate)
            }
            .padding(.vertical, 16)
            .background(Color.cardBg)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        }
    }

    private var fxCard: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                fxItem(currency: "USD/KRW", rate: vm.portfolio?.usdRate ?? 0)
                Divider().frame(height: 36)
                fxItem(currency: "GBP/KRW", rate: vm.portfolio?.gbpRate ?? 0)
            }
            .padding(.vertical, 16)

            Divider()

            VStack(spacing: 2) {
                Text("마지막 갱신")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text(vm.lastUpdated)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 12)
        }
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }

    private var updateOverlay: some View {
        VStack {
            Spacer()
            HStack(spacing: 12) {
                ProgressView().tint(.primary)
                Text("업데이트 중... 최대 2분 소요")
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

    private func statItem(title: String, value: String, rate: Double? = nil, color: Color = .primary) -> some View {
        VStack(spacing: 3) {
            Text(title).font(.caption).foregroundColor(.secondary)
            Text(value).font(.subheadline).fontWeight(.semibold).foregroundColor(color)
            if let rate {
                Text(rate.pctFormatted)
                    .font(.footnote)
                    .foregroundColor(rate.profitColor)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func fxItem(currency: String, rate: Double) -> some View {
        VStack(spacing: 4) {
            Text(currency).font(.caption).foregroundColor(.secondary)
            Text(Int(rate).formatted()).font(.subheadline).fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
    }

    private func circleButton(icon: String, action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.primary)
                .frame(width: 32, height: 32)
                .background(.ultraThinMaterial, in: Circle())
        }
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
