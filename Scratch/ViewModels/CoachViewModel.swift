import SwiftUI

@MainActor
final class CoachViewModel: ObservableObject {
    @Published var messages: [CoachMessage] = []
    @Published var inputText: String = ""
    @Published var isLoading: Bool = false
    @Published var showPaywall: Bool = false
    @Published var errorMessage: String?

    private let aiService: any AIServiceProtocol = MockAIService()
    private let storage = StorageService.shared

    init(appViewModel: AppViewModel) {
        let saved = storage.loadCoachMessages()
        if saved.isEmpty, let profile = appViewModel.userProfile {
            messages = MockData.initialCoachMessages(for: profile)
            storage.saveCoachMessages(messages)
        } else {
            messages = saved
        }
    }

    func send(userMessage: String? = nil, appVM: AppViewModel) {
        let text = (userMessage ?? inputText).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }

        guard appVM.canUseAI else {
            showPaywall = true
            return
        }

        inputText = ""
        let userMsg = CoachMessage.userMessage(text)
        messages.append(userMsg)
        storage.saveCoachMessages(messages)
        isLoading = true
        errorMessage = nil

        let context = AIContext(from: appVM.userProfile ?? UserProfile(
            currentHandicap: appVM.currentHandicap,
            goalHandicap: appVM.goalHandicap,
            handicapGoal: appVM.userProfile?.handicapGoal ?? .break90,
            primaryWeakness: appVM.userProfile?.primaryWeakness ?? .shortGame,
            playFrequency: appVM.userProfile?.playFrequency ?? .twiceAMonth,
            practiceFrequency: appVM.userProfile?.practiceFrequency ?? .weekly
        ), rounds: appVM.rounds)

        appVM.recordAIMessage()

        Task {
            do {
                let response = try await aiService.chat(messages: messages, context: context)
                let assistantMsg = CoachMessage.assistantMessage(response)
                messages.append(assistantMsg)
                storage.saveCoachMessages(messages)
            } catch {
                errorMessage = "Coach is unavailable right now. Try again in a moment."
            }
            isLoading = false
        }
    }

    func sendSuggestedPrompt(_ prompt: SuggestedPrompt, appVM: AppViewModel) {
        send(userMessage: prompt.text, appVM: appVM)
    }

    func clearHistory() {
        messages = []
        storage.saveCoachMessages([])
    }
}
