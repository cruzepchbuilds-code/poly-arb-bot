import SwiftUI

@MainActor
final class OnboardingViewModel: ObservableObject {
    // MARK: - Steps
    enum Step: Int, CaseIterable {
        case goal
        case handicap
        case weakness
        case frequency
        case generating
        case complete
    }

    // MARK: - State
    @Published var currentStep: Step = .goal
    @Published var handicapGoal: HandicapGoal = .break90
    @Published var currentHandicap: Double = 20
    @Published var handicapInput: String = "20"
    @Published var primaryWeakness: GolfWeakness = .shortGame
    @Published var playFrequency: PlayFrequency = .twiceAMonth
    @Published var practiceFrequency: PracticeFrequency = .weekly
    @Published var isGenerating: Bool = false
    @Published var generatedPlan: PracticePlan?
    @Published var generatedProfile: UserProfile?

    private let aiService: any AIServiceProtocol = MockAIService()

    // MARK: - Navigation
    var progress: Double {
        Double(currentStep.rawValue) / Double(Step.allCases.count - 2)
    }

    var canAdvance: Bool {
        switch currentStep {
        case .handicap:
            return Double(handicapInput) != nil
        default:
            return true
        }
    }

    func advance() {
        guard let next = Step(rawValue: currentStep.rawValue + 1) else { return }
        if currentStep == .frequency {
            generatePlan()
        } else {
            withAnimation(.easeInOut(duration: 0.3)) { currentStep = next }
        }
    }

    func back() {
        guard let prev = Step(rawValue: currentStep.rawValue - 1) else { return }
        withAnimation(.easeInOut(duration: 0.3)) { currentStep = prev }
    }

    // MARK: - Generate
    private func generatePlan() {
        guard let hcp = Double(handicapInput) else { return }
        currentHandicap = hcp

        withAnimation { currentStep = .generating; isGenerating = true }

        let profile = UserProfile(
            currentHandicap: currentHandicap,
            goalHandicap: handicapGoal.targetHandicap,
            handicapGoal: handicapGoal,
            primaryWeakness: primaryWeakness,
            playFrequency: playFrequency,
            practiceFrequency: practiceFrequency
        )

        Task {
            do {
                let plan = try await aiService.generatePracticePlan(for: profile, recentRounds: [])
                generatedProfile = profile
                generatedPlan = plan
                withAnimation { isGenerating = false; currentStep = .complete }
            } catch {
                withAnimation { isGenerating = false; currentStep = .complete }
                generatedProfile = profile
                generatedPlan = MockData.practicePlan(for: profile)
            }
        }
    }

    // MARK: - Estimated Timeline
    var estimatedTimeline: String {
        "\(handicapGoal.estimatedMonths) to \(handicapGoal.rawValue.lowercased())"
    }

    var personalizedInsight: String {
        guard let profile = generatedProfile else { return "" }
        return MockData.weeklyInsight(for: profile, rounds: [])
    }
}
