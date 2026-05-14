import SwiftUI

struct HoldingsView: View {
    @EnvironmentObject var vm: PortfolioViewModel
    @State private var filterAccount = "전체"
    @State private var sortKey: SortKey = .allInfo
    @State private var sortAscending = false
    @State private var searchText = ""
    @State private var expandedHoldingId: String? = nil
    @State private var detailStock: DetailStockSelection? = nil

    struct DetailStockSelection: Identifiable {
        let id = UUID()
        let code: String
        let name: String
    }

    enum SortKey: String, CaseIterable {
        case allInfo    = "종목 정보"
        case change     = "당일 등락"
        case agedDays   = "보유 기간"
        case opCurrent  = "평가 금액"
        case profitRate = "수익률"
        case opProfit   = "수익금"
    }

    private let accountOrder = ["종합_랩", "퇴직연금_개인IRP", "종합", "ISA", "퇴직연금_개인형IRP(범용)"]
    private let accountDisplayName: [String: String] = [
        "퇴직연금_개인IRP": "퇴직연금_미래",
        "퇴직연금_개인형IRP(범용)": "퇴직연금_삼성"
    ]

    private var accounts: [String] {
        let existing = Set(vm.portfolio?.holdings?.map(\.accountType) ?? [])
        let ordered = accountOrder.filter { existing.contains($0) }
        let rest = existing.subtracting(accountOrder).sorted()
        return ["전체"] + ordered + rest
    }

    private var accountBrokerMap: [String: String] {
        var map: [String: String] = [:]
        for h in vm.portfolio?.holdings ?? [] {
            if map[h.accountType] == nil { map[h.accountType] = h.broker }
        }
        return map
    }

    private func brokerBorderColor(_ accountType: String) -> Color {
        switch accountBrokerMap[accountType]?.lowercased() {
        case let b where b?.contains("미래") == true:  return .orange
        case let b where b?.contains("삼성") == true:  return Color(red: 0.05, green: 0.35, blue: 0.85)
        default: return Color.secondary.opacity(0.3)
        }
    }

    private var filtered: [Holding] {
        var list = vm.portfolio?.holdings ?? []
        if filterAccount != "전체" { list = list.filter { $0.accountType == filterAccount } }
        if !searchText.isEmpty { list = list.filter { $0.name.localizedCaseInsensitiveContains(searchText) || $0.code.localizedCaseInsensitiveContains(searchText) } }
        switch sortKey {
        case .allInfo:    list.sort { sortAscending ? $0.opCurrent < $1.opCurrent : $0.opCurrent > $1.opCurrent }
        case .change:     list.sort {
            let a = $0.change * $0.quantity
            let b = $1.change * $1.quantity
            return sortAscending ? a < b : a > b
        }
        case .opCurrent:  list.sort { sortAscending ? $0.opCurrent  < $1.opCurrent  : $0.opCurrent  > $1.opCurrent  }
        case .agedDays:   list.sort { sortAscending ? $0.holdingDays < $1.holdingDays : $0.holdingDays > $1.holdingDays }
        case .profitRate: list.sort { sortAscending ? $0.profitRate < $1.profitRate : $0.profitRate > $1.profitRate }
        case .opProfit:   list.sort { sortAscending ? $0.opProfit   < $1.opProfit   : $0.opProfit   > $1.opProfit   }
        }
        return list
    }

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()
            VStack(spacing: 0) {
                titleBar
                filterBar
                sortBar
                summaryBar
                if vm.isLoading && vm.portfolio == nil {
                    Spacer()
                    ProgressView("불러오는 중...").padding()
                    Spacer()
                } else {
                    List(filtered) { holding in
                        HoldingCard(
                            holding: holding,
                            sortKey: sortKey,
                            expandedId: $expandedHoldingId,
                            onDetail: { detailStock = DetailStockSelection(code: holding.code, name: holding.name) },
                            changeLabel: decideChangeLabel(vm.portfolio?.summary?.priceAsOfDate)
                        )
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                    }
                    .listStyle(.plain)
                    .sheet(item: $detailStock) { sel in
                        NavigationStack {
                            StockDetailView(code: sel.code, initialName: sel.name)
                        }
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            searchBar
        }
    }

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            TextField("종목명 또는 코드 검색", text: $searchText)
                .submitLabel(.search)
            if !searchText.isEmpty {
                Button { searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.cardBg.shadow(.drop(color: .black.opacity(0.08), radius: 8, y: -2)))
    }

    private var titleBar: some View {
        let amt = vm.portfolio?.summary?.dayChangAmount ?? 0
        let pct = vm.portfolio?.summary?.dayChangePct ?? "0%"
        let isUp = amt >= 0
        let color: Color = isUp ? .profit : .loss
        let arrow = isUp ? "↑" : "↓"
        return HStack(alignment: .center, spacing: 10) {
            Text("종목 (\(filtered.count))")
                .font(.largeTitle).fontWeight(.bold)
            Spacer()
            HStack(spacing: 4) {
                Text(arrow)
                    .font(.system(size: 17, weight: .semibold))
                Text(amt.krwFormatted)
                    .font(.system(size: 17, weight: .semibold))
                Text(pct.asChangePct)
                    .font(.system(size: 13, weight: .semibold))
                    .opacity(0.75)
                    .padding(.leading, 4)
            }
            .foregroundColor(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(color.opacity(0.08))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private var summaryBar: some View {
        let label: String = {
            if filterAccount == "전체" { return "전체" }
            let broker = accountBrokerMap[filterAccount] ?? ""
            let display = accountDisplayName[filterAccount] ?? filterAccount
            return broker.isEmpty ? display : "\(broker) \(display)"
        }()
        let totalCurrent = filtered.reduce(0) { $0 + $1.opCurrent }
        let totalChange  = filtered.reduce(0) { $0 + $1.change * $1.quantity }
        let changeSign   = totalChange >= 0 ? "+" : ""
        return VStack(spacing: 3) {
            Text(label)
                .font(.caption).fontWeight(.medium)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .center)
            HStack(spacing: 20) {
                Spacer()
                Text(totalCurrent.krwFormatted)
                    .font(.subheadline).fontWeight(.semibold)
                    .foregroundColor(.primary)
                Text("|")
                    .font(.caption).foregroundColor(.secondary.opacity(0.5))
                Text("\(changeSign)\(Int(totalChange).formatted())")
                    .font(.subheadline).fontWeight(.semibold)
                    .foregroundColor(totalChange.profitColor)
                Spacer()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.cardBg)
        .overlay(Divider(), alignment: .bottom)
    }

    private var filterBar: some View {
        HStack(spacing: 5) {
            accountChips(options: accounts, selected: $filterAccount)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.pageBg)
    }

    private var sortBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(SortKey.allCases, id: \.self) { key in
                    Button {
                        if sortKey == key { sortAscending.toggle() }
                        else { sortKey = key; sortAscending = false }
                    } label: {
                        HStack(spacing: 3) {
                            Text(key.rawValue)
                            if sortKey == key {
                                Image(systemName: sortAscending ? "arrow.up" : "arrow.down")
                                    .font(.caption2)
                            }
                        }
                    }
                    .font(.caption)
                    .fontWeight(sortKey == key ? .bold : .regular)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(sortKey == key ? Color.accent : Color.cardBg)
                    .foregroundColor(sortKey == key ? .white : .primary)
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
        }
    }

    private func accountChips(options: [String], selected: Binding<String>) -> some View {
        ForEach(options, id: \.self) { opt in
            let isSelected = selected.wrappedValue == opt
            let isAll = opt == "전체"
            let borderColor = isAll ? Color.accent : brokerBorderColor(opt)
            let label = accountDisplayName[opt] ?? opt
            Button(label) { selected.wrappedValue = opt }
                .font(.caption)
                .fontWeight(isSelected ? .bold : .regular)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(isSelected ? (isAll ? Color.accent : borderColor.opacity(0.15)) : Color.clear)
                .foregroundColor(isSelected ? (isAll ? .white : borderColor) : .secondary)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(isSelected ? borderColor : borderColor.opacity(isAll ? 0.3 : 0.6), lineWidth: isAll ? 1 : 1.5))
        }
    }
}
