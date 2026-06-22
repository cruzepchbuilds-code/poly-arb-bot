import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appVM: AppViewModel
    @StateObject private var coachVM = CoachViewModel(appViewModel: AppViewModel())
    @StateObject private var homeVM = HomeViewModel()
    @StateObject private var swingVM = SwingViewModel()
    @StateObject private var progressVM = ProgressViewModel()
    @StateObject private var profileVM = ProfileViewModel()
    @State private var selectedTab: Tab = .home

    enum Tab: Int {
        case home, coach, swing, progress, profile
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                HomeView()
                    .environmentObject(homeVM)
                    .tag(Tab.home)

                CoachView()
                    .environmentObject(coachVM)
                    .tag(Tab.coach)

                SwingView()
                    .environmentObject(swingVM)
                    .tag(Tab.swing)

                ProgressView()
                    .environmentObject(progressVM)
                    .tag(Tab.progress)

                ProfileView()
                    .environmentObject(profileVM)
                    .tag(Tab.profile)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            // Custom tab bar
            customTabBar
        }
        .ignoresSafeArea(edges: .bottom)
        .onAppear {
            // Rebuild coach VM with real appVM reference
        }
    }

    private var customTabBar: some View {
        HStack(spacing: 0) {
            TabBarItem(icon: "house.fill",       label: "Home",     tab: .home,     selected: $selectedTab)
            TabBarItem(icon: "message.fill",     label: "Coach",    tab: .coach,    selected: $selectedTab)
            TabBarItem(icon: "video.fill",       label: "Swing",    tab: .swing,    selected: $selectedTab)
            TabBarItem(icon: "chart.line.uptrend.xyaxis", label: "Progress", tab: .progress, selected: $selectedTab)
            TabBarItem(icon: "person.fill",      label: "Profile",  tab: .profile,  selected: $selectedTab)
        }
        .padding(.horizontal, 8)
        .padding(.top, 12)
        .padding(.bottom, 28)
        .background(
            ScratchColors.surface
                .overlay(ScratchDivider(), alignment: .top)
        )
    }
}

private struct TabBarItem: View {
    let icon: String
    let label: String
    let tab: MainTabView.Tab
    @Binding var selected: MainTabView.Tab

    var isSelected: Bool { selected == tab }

    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { selected = tab }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(isSelected ? ScratchColors.green : ScratchColors.textTertiary)
                    .scaleEffect(isSelected ? 1.1 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
                Text(label)
                    .font(ScratchFont.caption(10))
                    .foregroundColor(isSelected ? ScratchColors.green : ScratchColors.textTertiary)
            }
            .frame(maxWidth: .infinity)
        }
    }
}
