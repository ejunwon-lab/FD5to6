import SwiftUI

struct MainTabView: View {
    @StateObject private var vm = PortfolioViewModel.shared
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tag(0)
            HoldingsView()
                .tag(1)
            AnalysisView()
                .tag(2)
        }
        .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
        .safeAreaInset(edge: .bottom, spacing: 0) {
            customTabBar
        }
        .environmentObject(vm)
        .tint(.accent)
        .environment(\.sizeCategory, isPad ? .extraLarge : .large)
    }

    private var customTabBar: some View {
        HStack(spacing: 0) {
            tabBarButton(index: 0, label: "대시보드", icon: "chart.bar.fill")
            tabBarButton(index: 1, label: "종목",   icon: "list.bullet.rectangle.portrait.fill")
            tabBarButton(index: 2, label: "분석",   icon: "chart.pie.fill")
        }
        .frame(height: 49)
        .background(
            Color.clear
                .background(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        )
        .overlay(Divider().opacity(0.4), alignment: .top)
    }

    private func tabBarButton(index: Int, label: String, icon: String) -> some View {
        let isSelected = selectedTab == index
        return Button {
            withAnimation(.easeInOut(duration: 0.2)) { selectedTab = index }
        } label: {
            VStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: isSelected ? .semibold : .regular))
                Text(label)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
            }
            .foregroundColor(isSelected ? .accent : Color(.systemGray))
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}
