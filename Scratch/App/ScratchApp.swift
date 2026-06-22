import SwiftUI

@main
struct ScratchApp: App {
    @StateObject private var appVM = AppViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appVM)
                .preferredColorScheme(.dark)
                .tint(ScratchColors.green)
        }
    }
}
