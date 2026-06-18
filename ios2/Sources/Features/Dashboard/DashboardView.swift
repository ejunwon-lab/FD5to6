import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var vm: PortfolioViewModel
    @State private var dayCardPressed = false
    @State private var hapticTrigger = false
    @State private var updateHapticTrigger = false

    var body: some View {
        GeometryReader { geo in
            ScrollView(.vertical) {
                LazyVStack(spacing: 0) {
                    page1
                        .frame(width: geo.size.width, height: geo.size.height)
                    ProfitHistoryView()
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            }
            .scrollTargetBehavior(.paging)
            .scrollIndicators(.hidden)
        }
        .ignoresSafeArea()
        .overlay { if vm.isUpdating { updateOverlay } }
    }

    private var page1: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()
            VStack(spacing: 0) {
                dashboardHeader
                VStack(spacing: 12) {
                    summaryCard
                    fxCard
                    if let msg = vm.errorMessage { errorBanner(msg) }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "chevron.down")
                    Text("아래로 스와이프 — 기간별 수익")
                }
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.bottom, 16)
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
                .sensoryFeedback(.impact(weight: .medium), trigger: updateHapticTrigger)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 4)

            Text("뉴FD7 투자 현황")
                .font(.largeTitle).fontWeight(.bold)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
        }
        .background(Color.pageBg)
    }

    private var summaryCard: some View {
        VStack(spacing: 20) {
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

                let summary = vm.portfolio?.summary
                let dayAmt = profitAmount(summary)
                let dayPct = profitPct(summary)
                VStack(spacing: 6) {
                    Text(profitLabel(summary))
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                    Text(dayAmt.krwFormatted)
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text(dayPct.asChangePct)
                        .font(.headline)
                        .foregroundColor(.white.opacity(0.85))
                    Text(asOfDateString)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.65))
                        .padding(.top, 2)
                }
                .padding(.vertical, 28)
                .frame(maxWidth: .infinity)
                .background(dayAmt >= 0 ? Color.profit : Color.loss)
                .scaleEffect(dayCardPressed ? 0.97 : 1.0)
                .animation(.easeInOut(duration: 0.12), value: dayCardPressed)
                .contentShape(Rectangle())
                .onLongPressGesture(minimumDuration: 0, pressing: { pressing in
                    dayCardPressed = pressing
                    if pressing { hapticTrigger.toggle() }
                }, perform: {
                    Task { await vm.updateHoldingsFast() }
                })
                .sensoryFeedback(.impact(weight: .medium), trigger: hapticTrigger)
            }
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: .black.opacity(0.10), radius: 12, y: 4)

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
            .padding(.vertical, 10)

            Divider()

            VStack(spacing: 2) {
                Text("마지막 갱신")
                    .font(.footnote)
                    .foregroundColor(.secondary)
                Text(splitUpdatedAt(vm.lastUpdated).date)
                    .font(.footnote)
                    .foregroundColor(.secondary)
                Text(splitUpdatedAt(vm.lastUpdated).time)
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 8)
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

    private func profitLabel(_ summary: Summary?) -> String {
        // priceAsOfDate 기준 라벨 결정 (오늘/전일/최근)
        "\(decideChangeLabel(summary?.priceAsOfDate, summary?.isTradingDay)) 수익"
    }

    private func profitAmount(_ summary: Summary?) -> Double {
        // dayChangAmount는 GAS fallback으로 항상 priceAsOfDate 기준 변동을 반환
        summary?.dayChangAmount ?? 0
    }

    private func profitPct(_ summary: Summary?) -> String {
        summary?.dayChangePct ?? "0%"
    }

    private var asOfDateString: String {
        // 수익 기준일(priceAsOfDate). 없으면 호출 시각으로 폴백
        let formatted = formatPriceAsOfDate(vm.portfolio?.summary?.priceAsOfDate)
        return formatted.isEmpty ? (vm.portfolio?.updatedAt ?? "") : formatted
    }

    private func statItem(title: String, value: String, rate: Double? = nil, color: Color = .primary) -> some View {
        VStack(spacing: 3) {
            Text(title).font(.subheadline).foregroundColor(.secondary)
            Text(value).font(.callout).fontWeight(.semibold).foregroundColor(color)
            if let rate {
                Text(rate.pctFormatted)
                    .font(.body)
                    .foregroundColor(rate.profitColor)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func fxItem(currency: String, rate: Double) -> some View {
        VStack(spacing: 4) {
            Text(currency).font(.subheadline).foregroundColor(.secondary)
            Text(Int(rate).formatted()).font(.callout).fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
    }

    private func circleButton(icon: String, action: @escaping () async -> Void) -> some View {
        Button {
            updateHapticTrigger.toggle()
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
