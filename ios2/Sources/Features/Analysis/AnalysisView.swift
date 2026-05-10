import SwiftUI
import Charts

private enum InsightTag {
    case coreHold, sleepingMoney, nearHigh, deepLoss, monitoring

    var label: String {
        switch self {
        case .coreHold:      return "핵심 보유"
        case .sleepingMoney: return "잠자는 돈"
        case .nearHigh:      return "고점 근접"
        case .deepLoss:      return "깊은 손실"
        case .monitoring:    return "단기"
        }
    }

    var color: Color {
        switch self {
        case .coreHold:      return .profit
        case .sleepingMoney: return .orange
        case .nearHigh:      return Color(red: 0.85, green: 0.60, blue: 0.10)
        case .deepLoss:      return .loss
        case .monitoring:    return .secondary
        }
    }
}

struct AnalysisView: View {
    @EnvironmentObject var vm: PortfolioViewModel
    @State private var expandedQuadrants: Set<String> = []
    @State private var selectedAccountTab: AccountTab = .summary
    @State private var expandedCollapsible: String? = nil

    private enum AccountTab: String, CaseIterable {
        case summary   = "현황"
        case profitRate = "수익률"
        case allocation = "비중"
        case today     = "오늘"
        case topBottom = "종목"
    }

    private struct AnnItem: Identifiable {
        let id: String
        let name: String
        let baseName: String
        let duration: String
        let ann: Double
        let holdingDays: Int
        let profitRate: Double
    }

    private var holdings: [Holding]  { vm.portfolio?.holdings ?? [] }
    private var totalBuy: Double     { max(vm.portfolio?.summary?.totalBuy ?? 1, 1) }

    private var annualizedItems: [AnnItem] {
        let filtered = holdings.filter { $0.holdingDays >= 30 }
        return filtered
            .map { h in
                let brokerShort = String(h.broker.prefix(2))
                let baseName = "\(h.name) (\(brokerShort)_\(h.accountType))"
                let duration = h.holdingDurationText ?? "\(h.holdingDays)일"
                return AnnItem(
                    id: h.id,
                    name: "\(baseName) · \(duration)",
                    baseName: baseName,
                    duration: duration,
                    ann: h.profitRate / Double(h.holdingDays) * 365,
                    holdingDays: h.holdingDays,
                    profitRate: h.profitRate
                )
            }
            .sorted { $0.ann > $1.ann }
    }

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()
            VStack(spacing: 0) {
                headerBar
                ScrollView {
                    VStack(spacing: 20) {
                        if !holdings.isEmpty {
                            matrixSection
                            accountAnalysisSection
                            annualizedSection
                            position52Section
                        }
                    }
                    .padding()
                }
            }
        }
    }

    private var headerBar: some View {
        Text("분석")
            .font(.largeTitle).fontWeight(.bold)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.pageBg)
    }

    // MARK: - 1. 투자 효율 매트릭스

    private var matrixSection: some View {
        let threshold = 180
        let groups: [(title: String, items: [Holding], highlight: Bool, warn: Bool)] = [
            ("빠른 수익", holdings.filter { $0.holdingDays < threshold && $0.profitRate >= 0 }, false, false),
            ("장기 우량 ★", holdings.filter { $0.holdingDays >= threshold && $0.profitRate >= 0 }, true, false),
            ("판단 유보", holdings.filter { $0.holdingDays < threshold && $0.profitRate < 0 }, false, false),
            ("자본 묶임 ⚠", holdings.filter { $0.holdingDays >= threshold && $0.profitRate < 0 }, false, true),
        ]

        return collapsibleCard(id: "matrix", title: "투자 효율 매트릭스", expandedId: $expandedCollapsible) {
            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    Text("").frame(width: 22)
                    Text("단기 (6개월 미만)")
                        .font(.caption2).foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                    Text("장기 (6개월 이상)")
                        .font(.caption2).foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                }
                HStack(alignment: .top, spacing: 8) {
                    VStack(spacing: 8) {
                        Text("수익").font(.caption2).foregroundColor(.secondary)
                            .frame(height: 80, alignment: .center)
                        Text("손실").font(.caption2).foregroundColor(.secondary)
                            .frame(height: 80, alignment: .center)
                    }
                    .frame(width: 22)

                    VStack(spacing: 8) {
                        quadrantCell(groups[0])
                        quadrantCell(groups[2])
                    }
                    .frame(maxWidth: .infinity)

                    VStack(spacing: 8) {
                        quadrantCell(groups[1])
                        quadrantCell(groups[3])
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private func quadrantCell(_ g: (title: String, items: [Holding], highlight: Bool, warn: Bool)) -> some View {
        let bg: Color         = g.highlight ? .profit.opacity(0.10) : (g.warn ? .loss.opacity(0.08) : .secondary.opacity(0.06))
        let border: Color     = g.highlight ? .profit.opacity(0.35) : (g.warn ? .loss.opacity(0.30) : .secondary.opacity(0.15))
        let titleColor: Color = g.highlight ? .profit : (g.warn ? .loss : .primary)
        let isExpanded        = expandedQuadrants.contains(g.title)
        let showAll           = isExpanded || g.items.count <= 3

        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(g.title)
                    .font(.caption2).fontWeight(.semibold)
                    .foregroundColor(titleColor)
                Spacer()
                if g.items.count > 3 {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundColor(.secondary)
                }
            }
            if g.items.isEmpty {
                Text("없음").font(.caption2).foregroundColor(.secondary)
            } else {
                let displayed = showAll ? g.items : Array(g.items.prefix(3))
                ForEach(displayed, id: \.id) { h in
                    Text(h.name)
                        .font(.system(size: 10))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                }
                if !showAll {
                    Text("+\(g.items.count - 3)개")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 80, alignment: .topLeading)
        .padding(10)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(border, lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture {
            guard g.items.count > 3 else { return }
            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                if isExpanded { expandedQuadrants.remove(g.title) }
                else          { expandedQuadrants.insert(g.title) }
            }
        }
    }

    // MARK: - 2. 연 환산 수익률

    private var annualizedSection: some View {
        collapsibleCard(id: "annualized", title: "연 환산 수익률", expandedId: $expandedCollapsible) {
            if annualizedItems.isEmpty {
                Text("보유 30일 이상 종목 없음")
                    .font(.caption).foregroundColor(.secondary)
            } else {
                let xMin = min((annualizedItems.last?.ann ?? 0) - 10, -5.0)
                let xMax = max((annualizedItems.first?.ann ?? 0) + 10, 20.0)
                let range = xMax - xMin
                let stride = [10.0, 20, 50, 100, 200, 500].first { range / $0 <= 6 } ?? 200.0

                Chart {
                    ForEach(annualizedItems) { item in
                        BarMark(
                            x: .value("연환산%", item.ann),
                            y: .value("종목", item.name)
                        )
                        .foregroundStyle(item.ann >= 0 ? Color.profit : Color.loss)
                        .cornerRadius(3)
                        .annotation(
                            position: item.ann / xMax > 0.80 ? .overlay : .trailing,
                            alignment: item.ann / xMax > 0.80 ? .trailing : .center
                        ) {
                            Text(String(format: "%.1f%%", item.ann))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(item.ann / xMax > 0.80 ? .white : (item.ann >= 0 ? .profit : .loss))
                                .padding(.trailing, item.ann / xMax > 0.80 ? 6 : 0)
                                .fixedSize()
                        }
                    }
                }
                .chartXScale(domain: xMin...xMax)
                .chartXAxis {
                    AxisMarks(values: .stride(by: stride)) { v in
                        AxisGridLine().foregroundStyle(Color.secondary.opacity(0.12))
                        AxisValueLabel {
                            if let d = v.as(Double.self) {
                                Text("\(Int(d))%").font(.system(size: 10)).foregroundColor(.secondary)
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks { v in
                        AxisValueLabel {
                            if let s = v.as(String.self),
                               let item = annualizedItems.first(where: { $0.name == s }) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.baseName)
                                        .font(.system(size: 11, weight: .medium))
                                        .lineLimit(1)
                                    HStack(spacing: 5) {
                                        Text(item.duration)
                                            .font(.system(size: 10))
                                            .foregroundColor(.secondary)
                                        Text((item.profitRate >= 0 ? "+" : "") + String(format: "%.1f%%", item.profitRate))
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(item.profitRate.profitColor)
                                    }
                                }
                            }
                        }
                    }
                }
                .frame(height: max(200, CGFloat(annualizedItems.count) * 64))
            }
        }
    }

    // MARK: - 3. 52주 포지션

    private var position52Section: some View {
        let posItems = holdings.compactMap { h -> (Holding, Double, [InsightTag])? in
            let range = h.high52 - h.low52
            guard range > 0 else { return nil }
            let pos = min(max((h.currentPrice - h.low52) / range, 0), 1)
            return (h, pos, insightTags(h))
        }.sorted { $0.1 > $1.1 }

        return collapsibleCard(id: "position52", title: "52주 포지션", expandedId: $expandedCollapsible) {
            VStack(spacing: 0) {
                HStack {
                    Text("저점").font(.system(size: 10)).foregroundColor(.secondary)
                    Spacer()
                    Text("고점").font(.system(size: 10)).foregroundColor(.secondary)
                }
                .padding(.bottom, 12)

                VStack(spacing: 14) {
                    ForEach(posItems, id: \.0.id) { (h, pos, tags) in
                        VStack(alignment: .leading, spacing: 5) {
                            HStack(spacing: 4) {
                                Text(h.name)
                                    .font(.caption).fontWeight(.medium)
                                    .lineLimit(1)
                                Spacer()
                                ForEach(tags, id: \.label) { tag in
                                    tagChip(tag)
                                }
                                Text(String(format: "%.0f%%", pos * 100))
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)
                                    .frame(width: 30, alignment: .trailing)
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule()
                                        .fill(Color.secondary.opacity(0.12))
                                        .frame(height: 5)
                                    Capsule()
                                        .fill(pos52Color(pos).opacity(0.35))
                                        .frame(width: geo.size.width * CGFloat(pos), height: 5)
                                    Circle()
                                        .fill(pos52Color(pos))
                                        .frame(width: 9, height: 9)
                                        .offset(x: geo.size.width * CGFloat(pos) - 4.5, y: -2)
                                }
                            }
                            .frame(height: 9)
                        }
                    }
                }
            }
        }
    }

    private func pos52Color(_ pos: Double) -> Color {
        if pos >= 0.90 { return Color(red: 0.85, green: 0.60, blue: 0.10) }
        if pos >= 0.40 { return .profit }
        if pos >= 0.20 { return .secondary }
        return .loss
    }

    // MARK: - Helpers

    private func insightTags(_ h: Holding) -> [InsightTag] {
        var result: [InsightTag] = []
        let buyPct = h.opBuy / totalBuy * 100
        if h.holdingDays >= 30 {
            let ann = h.profitRate / Double(h.holdingDays) * 365
            if ann >= 15, h.holdingDays >= 180 { result.append(.coreHold) }
            if buyPct >= 8, ann < 5, h.holdingDays >= 90 { result.append(.sleepingMoney) }
        }
        let range = h.high52 - h.low52
        if range > 0, (h.currentPrice - h.low52) / range >= 0.95 { result.append(.nearHigh) }
        if h.profitRate <= -15 { result.append(.deepLoss) }
        if h.holdingDays > 0, h.holdingDays < 90 { result.append(.monitoring) }
        return result
    }

    private func tagChip(_ tag: InsightTag) -> some View {
        Text(tag.label)
            .font(.system(size: 9, weight: .semibold))
            .foregroundColor(tag.color)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(tag.color.opacity(0.12))
            .clipShape(Capsule())
    }

    // MARK: - 4. 계좌별 분석

    private var orderedAccounts: [(key: String, value: GroupStat)] {
        guard let byAccount = vm.portfolio?.byAccount else { return [] }
        let order = ["종합_랩", "퇴직연금_개인IRP", "종합", "ISA", "퇴직연금_개인형IRP(범용)"]
        let ordered = order.compactMap { k in byAccount[k].map { (key: k, value: $0) } }
        let rest = byAccount.filter { !order.contains($0.key) }.sorted { $0.key < $1.key }.map { (key: $0.key, value: $0.value) }
        return ordered + rest
    }

    private func accountLabel(_ key: String) -> String {
        let broker = holdings.first(where: { $0.accountType == key })?.broker ?? ""
        let brokerShort = String(broker.prefix(2))
        return brokerShort.isEmpty ? key : "\(brokerShort)_\(key)"
    }

    private func accountColor(_ key: String) -> Color {
        let broker = holdings.first(where: { $0.accountType == key })?.broker.lowercased() ?? ""
        if broker.contains("미래") { return .orange }
        if broker.contains("삼성") { return Color(red: 0.05, green: 0.35, blue: 0.85) }
        return .accent
    }

    private var accountAnalysisSection: some View {
        collapsibleCard(id: "account", title: "계좌별 분석", expandedId: $expandedCollapsible) {
            VStack(spacing: 16) {
                HStack(spacing: 6) {
                    ForEach(AccountTab.allCases, id: \.self) { tab in
                        Button(tab.rawValue) { withAnimation(.easeInOut(duration: 0.18)) { selectedAccountTab = tab } }
                            .font(.caption)
                            .fontWeight(selectedAccountTab == tab ? .bold : .regular)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(selectedAccountTab == tab ? Color.accent : Color.pageBg)
                            .foregroundColor(selectedAccountTab == tab ? .white : .primary)
                            .clipShape(Capsule())
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Group {
                    switch selectedAccountTab {
                    case .summary:    accountSummaryView
                    case .profitRate: accountProfitRateView
                    case .allocation: accountAllocationView
                    case .today:      accountTodayView
                    case .topBottom:  accountTopBottomView
                    }
                }
            }
        }
    }

    private var accountSummaryView: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text("계좌").font(.caption2).foregroundColor(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                Text("평가금액").font(.caption2).foregroundColor(.secondary).frame(width: 64, alignment: .trailing)
                Text("수익률").font(.caption2).foregroundColor(.secondary).frame(width: 66, alignment: .trailing)
            }
            .padding(.bottom, 6)
            Divider()
            ForEach(orderedAccounts, id: \.key) { item in
                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(accountLabel(item.key)).font(.caption).fontWeight(.medium).lineLimit(1)
                        Text("매입 \(item.value.buy.krwFormatted)").font(.caption2).foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Text(item.value.current.krwCompact).font(.caption).fontWeight(.medium)
                        .frame(width: 64, alignment: .trailing)
                    Text(item.value.profitRate.pctFormatted).font(.caption).fontWeight(.semibold)
                        .foregroundColor(item.value.profitRate.profitColor)
                        .frame(width: 66, alignment: .trailing)
                }
                .padding(.vertical, 9)
                Divider()
            }
        }
    }

    private var accountProfitRateView: some View {
        let items = orderedAccounts
        guard !items.isEmpty else { return AnyView(EmptyView()) }
        let rates = items.map(\.value.profitRate)
        let xMin = min((rates.min() ?? 0) - 2, -2.0)
        let xMax = max((rates.max() ?? 0) + 5, 5.0)
        return AnyView(
            Chart {
                ForEach(items, id: \.key) { item in
                    BarMark(x: .value("수익률", item.value.profitRate),
                            y: .value("계좌", accountLabel(item.key)))
                        .foregroundStyle(accountColor(item.key))
                        .cornerRadius(4)
                        .annotation(position: item.value.profitRate >= 0 ? .trailing : .leading) {
                            Text(item.value.profitRate.pctFormatted)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(item.value.profitRate.profitColor)
                                .fixedSize()
                        }
                }
            }
            .chartXScale(domain: xMin...xMax)
            .chartXAxis {
                AxisMarks { v in
                    AxisGridLine().foregroundStyle(Color.secondary.opacity(0.12))
                    AxisValueLabel {
                        if let d = v.as(Double.self) {
                            Text("\(Int(d))%").font(.system(size: 10)).foregroundColor(.secondary)
                        }
                    }
                }
            }
            .frame(height: CGFloat(items.count) * 52)
        )
    }

    private var accountAllocationView: some View {
        let items = orderedAccounts
        let colors: [Color] = [.orange, Color(red: 0.05, green: 0.35, blue: 0.85), .accent, .teal, .purple]
        return HStack(alignment: .center, spacing: 20) {
            Chart(items.indices, id: \.self) { i in
                SectorMark(angle: .value("금액", items[i].value.buy),
                           innerRadius: .ratio(0.52), angularInset: 2)
                    .foregroundStyle(colors[i % colors.count])
                    .cornerRadius(4)
            }
            .frame(width: 116, height: 116)

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 0) {
                    Text("계좌").font(.caption2).foregroundColor(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                    Text("비중").font(.caption2).foregroundColor(.secondary).frame(width: 36, alignment: .trailing)
                    Text("수익률").font(.caption2).foregroundColor(.secondary).frame(width: 52, alignment: .trailing)
                }
                Divider()
                ForEach(items.indices, id: \.self) { i in
                    HStack(spacing: 0) {
                        HStack(spacing: 5) {
                            RoundedRectangle(cornerRadius: 2).fill(colors[i % colors.count]).frame(width: 7, height: 7)
                            Text(accountLabel(items[i].key)).font(.caption2).fontWeight(.medium).lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Text(String(format: "%.0f%%", items[i].value.pct))
                            .font(.caption2).foregroundColor(.secondary).frame(width: 36, alignment: .trailing)
                        Text(items[i].value.profitRate.pctFormatted)
                            .font(.caption2).fontWeight(.medium)
                            .foregroundColor(items[i].value.profitRate.profitColor)
                            .frame(width: 52, alignment: .trailing)
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var accountTodayView: some View {
        var todayMap: [String: Double] = [:]
        for h in holdings { todayMap[h.accountType, default: 0] += h.change * h.quantity }
        return VStack(spacing: 8) {
            ForEach(orderedAccounts, id: \.key) { item in
                let todayAmt = todayMap[item.key] ?? 0
                let pct = item.value.current > 0 ? todayAmt / item.value.current * 100 : 0
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(accountLabel(item.key)).font(.caption).fontWeight(.medium)
                        Text("종목 \(item.value.count)개").font(.caption2).foregroundColor(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(todayAmt.krwFormatted).font(.subheadline).fontWeight(.bold)
                            .foregroundColor(todayAmt.profitColor)
                        Text(pct.pctFormatted).font(.caption2).foregroundColor(pct.profitColor)
                    }
                }
                .padding(12)
                .background(todayAmt.profitColor.opacity(0.07))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    private var accountTopBottomView: some View {
        VStack(spacing: 12) {
            ForEach(orderedAccounts, id: \.key) { item in
                let acctHoldings = holdings.filter { $0.accountType == item.key }.sorted { $0.profitRate > $1.profitRate }
                let top    = acctHoldings.first
                let bottom = acctHoldings.count > 1 ? acctHoldings.last : nil
                VStack(alignment: .leading, spacing: 6) {
                    Text(accountLabel(item.key)).font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                    HStack(spacing: 8) {
                        if let top {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("대장").font(.system(size: 9, weight: .bold)).foregroundColor(.profit)
                                Text(top.name).font(.caption2).fontWeight(.medium).lineLimit(1)
                                Text(top.profitRate.pctFormatted).font(.caption2).bold().foregroundColor(.profit)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Color.profit.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        if let bottom {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("골칫").font(.system(size: 9, weight: .bold)).foregroundColor(.loss)
                                Text(bottom.name).font(.caption2).fontWeight(.medium).lineLimit(1)
                                Text(bottom.profitRate.pctFormatted).font(.caption2).bold().foregroundColor(.loss)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Color.loss.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                if item.key != orderedAccounts.last?.key { Divider() }
            }
        }
    }

    private func collapsibleCard<Content: View>(id: String, title: String, expandedId: Binding<String?>, @ViewBuilder content: () -> Content) -> some View {
        let isExpanded = expandedId.wrappedValue == id
        return VStack(alignment: .leading, spacing: isExpanded ? 14 : 0) {
            HStack {
                Text(title).font(.headline).foregroundColor(.primary)
                Spacer()
                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.secondary)
            }
            if isExpanded {
                content()
            }
        }
        .padding(20)
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                expandedId.wrappedValue = isExpanded ? nil : id
            }
        }
    }
}
