import SwiftUI

struct HoldingCard: View {
    let holding: Holding
    let sortKey: HoldingsView.SortKey
    @Binding var expandedId: String?

    private var expanded: Bool { expandedId == holding.id }

    private func toggleExpand() {
        expandedId = expanded ? nil : holding.id
    }

    var body: some View {
        if sortKey == .allInfo {
            allInfoCard
        } else {
            standardCard
        }
    }

    // MARK: - Standard Card

    private var standardCard: some View {
        VStack(spacing: 0) {
            Button { toggleExpand() } label: {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(holding.name)
                            .font(.subheadline).fontWeight(.semibold)
                            .foregroundColor(.primary)
                            .lineLimit(1)
                        Text(holding.code)
                            .font(.caption2).foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .trailing, spacing: 4) {
                        switch sortKey {
                        case .profitRate:
                            Text(holding.profitRate.pctFormatted)
                                .font(.headline).fontWeight(.bold)
                                .foregroundColor(holding.opProfit.profitColor)
                            Text(holding.opProfit.krwFormatted)
                                .font(.caption)
                                .foregroundColor(holding.opProfit.profitColor)
                        case .opProfit:
                            Text(holding.opProfit.krwFormatted)
                                .font(.headline).fontWeight(.bold)
                                .foregroundColor(holding.opProfit.profitColor)
                            Text(holding.profitRate.pctFormatted)
                                .font(.caption)
                                .foregroundColor(holding.opProfit.profitColor)
                        case .opCurrent:
                            Text(holding.opCurrent.krwFormatted)
                                .font(.headline).fontWeight(.bold)
                                .foregroundColor(.primary)
                            Text(holding.profitRate.pctFormatted)
                                .font(.caption)
                                .foregroundColor(holding.opProfit.profitColor)
                        case .change:
                            let total = holding.change * holding.quantity
                            let perShareStr = (holding.change >= 0 ? "+" : "") + "\(Int(holding.change).formatted())"
                            let totalStr = (total >= 0 ? "+" : "") + "\(Int(total).formatted())"
                            Text("\(perShareStr) (\(holding.dailyChangePct.pctFormatted)) × \(Int(holding.quantity).formatted())주")
                                .font(.caption2).fontWeight(.semibold)
                                .foregroundColor(holding.change.profitColor)
                            Text(totalStr)
                                .font(.headline).fontWeight(.bold)
                                .foregroundColor(holding.change.profitColor)
                            Text(holding.dailyChangePct.pctFormatted)
                                .font(.caption)
                                .foregroundColor(holding.change.profitColor)
                        case .allInfo:
                            EmptyView()
                        }
                    }

                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption2).foregroundColor(.secondary)
                        .animation(.easeInOut(duration: 0.2), value: expanded)
                }
                .padding(16)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            VStack(spacing: 0) {
                if expanded {
                    Divider().padding(.horizontal, 16).transition(.identity)
                    detailGrid.padding(16).transition(.identity)
                }
            }
            .clipped()
            .animation(
                expanded ? .spring(response: 1.87, dampingFraction: 0.95) : .spring(response: 0.28, dampingFraction: 0.88),
                value: expanded
            )
        }
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.primary.opacity(0.18), lineWidth: 0.8))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }

    // MARK: - All Info Card

    private var allInfoCard: some View {
        VStack(spacing: 0) {
            Button { toggleExpand() } label: {
                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(holding.name)
                            .font(.subheadline).fontWeight(.semibold)
                            .foregroundColor(.primary)
                            .lineLimit(1)
                        Text(holding.code).font(.caption2).foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption2).foregroundColor(.secondary)
                        .frame(width: 28)
                        .animation(.easeInOut(duration: 0.2), value: expanded)

                    VStack(alignment: .trailing, spacing: 2) {
                        Text("현재가").font(.caption2).foregroundColor(.secondary)
                        Text(holding.currentPrice.krwFullFormatted)
                            .font(.subheadline).fontWeight(.semibold)
                            .foregroundColor(.primary)
                    }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Divider().padding(.horizontal, 14)

            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("투자금").font(.caption2).foregroundColor(.secondary)
                    Text(holding.opBuy.krwFormatted)
                        .font(.subheadline).fontWeight(.semibold)
                    Text("\(Int(holding.quantity).formatted())주 @ \(holding.buyPrice.krwFormatted)")
                        .font(.caption).foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14).padding(.vertical, 10)

                Divider().frame(height: 52)

                VStack(alignment: .trailing, spacing: 3) {
                    Text("평가금액").font(.caption2).foregroundColor(.secondary)
                    Text(holding.opCurrent.krwFormatted)
                        .font(.subheadline).fontWeight(.semibold)
                    HStack(spacing: 4) {
                        Text(holding.opProfit.krwFormatted)
                        Text(holding.profitRate.pctFormatted)
                    }
                    .font(.caption).foregroundColor(holding.opProfit.profitColor)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.horizontal, 14).padding(.vertical, 10)
            }

            let dailyTotal = holding.change * holding.quantity
            let changeSign = holding.change >= 0 ? "+" : ""
            let totalSign  = dailyTotal >= 0 ? "+" : ""
            HStack {
                Text("오늘 등락").font(.caption2).foregroundColor(.white.opacity(0.75))
                Text("\(changeSign)\(Int(holding.change).formatted())")
                    .font(.subheadline).fontWeight(.semibold).foregroundColor(.white)
                Text("(\(holding.dailyChangePct.pctFormatted))")
                    .font(.caption2).foregroundColor(.white.opacity(0.85))
                Spacer()
                Text("오늘 수익").font(.caption2).foregroundColor(.white.opacity(0.75))
                Text("\(totalSign)\(Int(dailyTotal).formatted())")
                    .font(.subheadline).fontWeight(.semibold).foregroundColor(.white)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(holding.change.profitColor)

            VStack(spacing: 0) {
                if expanded {
                    Divider().padding(.horizontal, 14).transition(.identity)
                    detailGrid.padding(14).transition(.identity)
                }
            }
            .clipped()
            .animation(
                expanded ? .spring(response: 1.87, dampingFraction: 0.95) : .spring(response: 0.28, dampingFraction: 0.88),
                value: expanded
            )
        }
        .background(Color.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.primary.opacity(0.18), lineWidth: 0.8))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }

    private var detailGrid: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                detailCell(label: "평가금액",  value: holding.opCurrent.krwFormatted)
                detailCell(label: "매입금액",  value: holding.opBuy.krwFormatted)
                detailCell(label: "평가손익",  value: holding.opProfit.krwFormatted, color: holding.opProfit.profitColor)
            }
            HStack(spacing: 8) {
                detailCell(label: "현재가",    value: holding.currentPrice.krwFullFormatted)
                detailCell(label: "평균단가",  value: holding.buyPrice.krwFullFormatted)
                detailCell(label: "수량",      value: Int(holding.quantity).formatted())
            }
            HStack(spacing: 8) {
                detailCell(label: "1개월",     value: holding.m1.pctFormatted, color: holding.m1.profitColor)
                detailCell(label: "3개월",     value: holding.m3.pctFormatted, color: holding.m3.profitColor)
                detailCell(label: "1년",       value: holding.y1.pctFormatted, color: holding.y1.profitColor)
            }
            HStack(spacing: 8) {
                detailCell(label: "52주 최고", value: holding.high52.krwFullFormatted)
                detailCell(label: "52주 최저", value: holding.low52.krwFullFormatted)
                detailCell(label: "계좌",      value: holding.accountType)
            }
        }
    }

    private func detailCell(label: String, value: String, color: Color = .primary) -> some View {
        VStack(spacing: 3) {
            Text(label).font(.caption2).foregroundColor(.secondary)
            Text(value).font(.caption).fontWeight(.medium).foregroundColor(color).lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color.pageBg)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
