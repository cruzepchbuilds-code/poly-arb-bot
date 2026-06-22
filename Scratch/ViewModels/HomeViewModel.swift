import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var showAddRound: Bool = false
    @Published var showLogPractice: Bool = false
    @Published var justAddedRound: Bool = false
    @Published var roundToAdd = Round(
        date: Date(),
        score: 90,
        primaryLeaker: .shortGame
    )

    func resetRoundForm() {
        roundToAdd = Round(date: Date(), score: 90, primaryLeaker: .shortGame)
    }

    func submitRound(appVM: AppViewModel) {
        appVM.addRound(roundToAdd)
        showAddRound = false
        justAddedRound = true
        resetRoundForm()
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            self?.justAddedRound = false
        }
    }
}
