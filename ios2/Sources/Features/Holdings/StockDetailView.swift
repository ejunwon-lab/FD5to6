import SwiftUI
import Charts

struct StockDetailView: View {
    let code: String
    let initialName: String

    @State private var detail: StockDetailResponse?
    @State private var loading = true
    @State private var errorMsg: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                // 헤더
                VStack(alignment: .leading, spacing: 2) {
                    Text(detail?.name ?? initialName).font(.title2).fontWeight(.bold)
                    Text("\(code) · \(detail?.category ?? "-")")
                        .font(.caption).foregroundColor(.gray)
                }
                .padding(.horizontal).padding(.top, 8)

                if loading {
                    ProgressView("종목 정보 불러오는 중...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if let err = errorMsg {
                    Card { Text(err).font(.callout).foregroundColor(.red).padding() }
                        .padding(.horizontal)
                } else if let d = detail {
                    // 요약
                    if let s = d.summary {
                        summaryCard(s)
                    }
                    // 가격 추이 차트
                    if let priceHist = d.priceHistory, priceHist.count >= 2 {
                        priceChartCard(priceHistory: priceHist, transactions: d.transactions ?? [])
                    }
                    // 계좌별 보유
                    if let positions = d.positions, !positions.isEmpty {
                        positionsCard(positions)
                    }
                    // 거래 이력
                    if let txs = d.transactions, !txs.isEmpty {
                        transactionsCard(txs)
                    }
                }
            }
            .padding(.bottom, 32)
        }
        .navigationTitle("종목 상세")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let res = try await ScriptAPIService.shared.getStockDetail(code: code)
            if res.success { detail = res; errorMsg = nil }
            else { errorMsg = res.error ?? "조회 실패" }
        } catch {
            errorMsg = error.localizedDescription
        }
    }

    @ViewBuilder
    private func summaryCard(_ s: StockDetailSummary) -> some View {
        Card {
            VStack(spacing: 0) {
                HStack {
                    summaryItem("총 수량", "\(Int(s.totalQuantity).formatted())주", color: .primary)
                    Divider().frame(height: 32)
                    summaryItem("평가금액", s.totalCurrentValue.krwFormatted, color: .primary)
                }.padding(.bottom, 12)
                Divider()
                HStack {
                    summaryItem("매입금액", s.totalBuyAmount.krwFormatted, color: .primary)
                    Divider().frame(height: 32)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("손익 / 수익률").font(.caption2).foregroundColor(.gray)
                        Text((s.totalProfit >= 0 ? "+" : "") + s.totalProfit.krwFormatted)
                            .font(.callout).fontWeight(.bold)
                            .foregroundColor(s.totalProfit >= 0 ? .profit : .loss)
                        Text(s.profitRate.pctFormatted)
                            .font(.caption2)
                            .foregroundColor(s.totalProfit >= 0 ? .profit : .loss)
                    }
                    Spacer()
                }.padding(.top, 12)
            }.padding()
        }.padding(.horizontal)
    }

    private func summaryItem(_ label: String, _ value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundColor(.gray)
            Text(value).font(.callout).fontWeight(.bold).foregroundColor(color)
            Spacer().frame(height: 0)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func priceChartCard(priceHistory: [StockPricePoint], transactions: [StockTransaction]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text("가격 추이 (\(priceHistory.first?.date ?? "") ~ \(priceHistory.last?.date ?? ""))")
                    .font(.caption).foregroundColor(.gray)

                let buyDates  = Set(transactions.filter { $0.isBuy }.map { $0.date })
                let sellDates = Set(transactions.filter { !$0.isBuy }.map { $0.date })

                let buyPoints  = priceHistory.filter { buyDates.contains($0.date) }
                let sellPoints = priceHistory.filter { sellDates.contains($0.date) }

                Chart {
                    ForEach(priceHistory) { pt in
                        LineMark(
                            x: .value("Date", pt.date),
                            y: .value("Price", pt.price)
                        )
                        .foregroundStyle(Color.accent)
                        .interpolationMethod(.monotone)
                    }
                    ForEach(buyPoints) { pt in
                        PointMark(x: .value("Date", pt.date), y: .value("Price", pt.price))
                            .foregroundStyle(Color.loss)
                            .symbolSize(60)
                    }
                    ForEach(sellPoints) { pt in
                        PointMark(x: .value("Date", pt.date), y: .value("Price", pt.price))
                            .foregroundStyle(Color.profit)
                            .symbolSize(60)
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 5)) { val in
                        AxisGridLine().foregroundStyle(Color.gray.opacity(0.2))
                        AxisValueLabel().font(.caption2).foregroundStyle(.gray)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { val in
                        AxisGridLine().foregroundStyle(Color.gray.opacity(0.2))
                        AxisValueLabel().font(.caption2).foregroundStyle(.gray)
                    }
                }
                .frame(height: 220)

                HStack(spacing: 12) {
                    Label("매수", systemImage: "circle.fill").labelStyle(.titleAndIcon)
                        .foregroundColor(.loss).font(.caption2)
                    Label("매도", systemImage: "circle.fill").labelStyle(.titleAndIcon)
                        .foregroundColor(.profit).font(.caption2)
                }
            }.padding()
        }.padding(.horizontal)
    }

    @ViewBuilder
    private func positionsCard(_ positions: [StockPosition]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 0) {
                Text("계좌별 보유").font(.caption).foregroundColor(.gray).padding(.bottom, 6)
                ForEach(positions) { p in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(p.broker) / \(p.accountType)").font(.caption).fontWeight(.medium)
                            Text("\(Int(p.quantity).formatted())주 · 평균 \(p.avgPrice.krwFormatted)")
                                .font(.caption2).foregroundColor(.gray)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text((p.opProfit >= 0 ? "+" : "") + p.opProfit.krwFormatted)
                                .font(.caption).fontWeight(.bold)
                                .foregroundColor(p.opProfit >= 0 ? .profit : .loss)
                            Text(p.profitRate.pctFormatted)
                                .font(.caption2)
                                .foregroundColor(p.opProfit >= 0 ? .profit : .loss)
                        }
                    }.padding(.vertical, 6)
                    if p.id != positions.last?.id { Divider() }
                }
            }.padding()
        }.padding(.horizontal)
    }

    @ViewBuilder
    private func transactionsCard(_ txs: [StockTransaction]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 0) {
                Text("거래 이력 (\(txs.count)건)").font(.caption).foregroundColor(.gray).padding(.bottom, 6)
                ForEach(Array(txs.reversed())) { tx in
                    HStack {
                        Text(tx.type)
                            .font(.caption2).fontWeight(.bold)
                            .foregroundColor(tx.isBuy ? .loss : .profit)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background((tx.isBuy ? Color.loss : Color.profit).opacity(0.12))
                            .cornerRadius(4)
                        Text(tx.date).font(.caption).padding(.leading, 6)
                        Spacer()
                        VStack(alignment: .trailing, spacing: 0) {
                            Text("\(Int(tx.quantity).formatted())주 @ \(tx.price.krwFormatted)")
                                .font(.caption)
                            Text(tx.amount.krwFormatted)
                                .font(.caption2).foregroundColor(.gray)
                        }
                    }.padding(.vertical, 4)
                    if tx.id != txs.first?.id { Divider() }
                }
            }.padding()
        }.padding(.horizontal)
    }
}

private struct Card<Content: View>: View {
    @ViewBuilder let content: () -> Content
    var body: some View {
        content().background(Color(uiColor: .secondarySystemBackground)).cornerRadius(12)
    }
}
