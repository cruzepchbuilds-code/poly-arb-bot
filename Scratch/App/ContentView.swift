import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appVM: AppViewModel

    var body: some View {
        ZStack {
            ScratchColors.background.ignoresSafeArea()
            if appVM.hasCompletedOnboarding {
                MainTabView()
                    .transition(.opacity.animation(.easeIn(duration: 0.4)))
            } else {
                OnboardingView()
                    .transition(.opacity.animation(.easeIn(duration: 0.4)))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appVM.hasCompletedOnboarding)
    }
}
