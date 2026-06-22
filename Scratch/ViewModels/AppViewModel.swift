import SwiftUI
import Combine

@MainActor
final class AppViewModel: ObservableObject {
    // MARK: - State
    @Published var hasCompletedOnboarding: Bool
    @Published var userProfile: UserProfile?
    @Published var rounds: [Round] = []
    @Published var swingAnalyses: [SwingAnalysis] = []
    @Published var currentPracticePlan: PracticePlan?
    @Published var milestones: [Milestone] = []
    @Published var usageStats: UsageStats = UsageStats()
    @Published var weeklyInsight: String = ""

    // MARK: - Services
    let aiService: any AIServiceProtocol = MockAIService()
    let storage = StorageService.shared
    let handicapService = HandicapService.shared

    init() {
        self.hasCompletedOnboarding = StorageService.shared.hasCompletedOnboarding
        self.userProfile             = StorageService.shared.loadUserProfile()
        self.rounds                  = StorageService.shared.loadRounds()
        self.swingAnalyses           = StorageService.shared.loadSwingAnalyses()
        self.currentPracticePlan     = StorageService.shared.loadCurrentPracticePlan()
        self.milestones              = StorageService.shared.loadMilestones()
        self.usageStats              = StorageService.shared.loadUsageStats()

        if hasCompletedOnboarding && rounds.isEmpty {
            rounds = MockData.sampleRounds
            storage.saveRounds(rounds)
        }
        if hasCompletedOnboarding && swingAnalyses.isEmpty {
            swingAnalyses = MockData.sampleSwingAnalyses
            storage.saveSwingAnalyses(swingAnalyses)
        }
        if let profile = userProfile {
            weeklyInsight = MockData.weeklyInsight(for: profile, rounds: rounds)
        }
    }

    // MARK: - Onboarding
    func completeOnboarding(profile: UserProfile, practicePlan: PracticePlan) {
        userProfile = profile
        currentPracticePlan = practicePlan
        rounds = MockData.sampleRounds
        swingAnalyses = MockData.sampleSwingAnalyses
        weeklyInsight = MockData.weeklyInsight(for: profile, rounds: rounds)
        milestones = MilestoneType.allCases.map { Milestone(type: $0) }

        storage.saveUserProfile(profile)
        storage.saveCurrentPracticePlan(practicePlan)
        storage.saveRounds(rounds)
        storage.saveSwingAnalyses(swingAnalyses)
        storage.saveMilestones(milestones)
        storage.hasCompletedOnboarding = true
        hasCompletedOnboarding = true
        checkMilestones()
    }

    // MARK: - Rounds
    func addRound(_ round: Round) {
        rounds.insert(round, at: 0)
        storage.saveRounds(rounds)
        checkMilestones()
        refreshInsight()
    }

    // MARK: - Swing
    func addSwingAnalysis(_ analysis: SwingAnalysis) {
        swingAnalyses.insert(analysis, at: 0)
        storage.saveSwingAnalyses(swingAnalyses)
        checkMilestones()
    }

    func updateSwingAnalysis(_ analysis: SwingAnalysis) {
        if let idx = swingAnalyses.firstIndex(where: { $0.id == analysis.id }) {
            swingAnalyses[idx] = analysis
            storage.saveSwingAnalyses(swingAnalyses)
        }
    }

    // MARK: - Practice
    func markSessionComplete(_ sessionID: UUID) {
        guard var plan = currentPracticePlan else { return }
        if let idx = plan.sessions.firstIndex(where: { $0.id == sessionID }) {
            plan.sessions[idx].isCompleted = true
            plan.sessions[idx].completedAt = Date()
        }
        currentPracticePlan = plan
        storage.saveCurrentPracticePlan(plan)
    }

    // MARK: - Computed Handicap
    var currentHandicap: Double {
        if let calculated = handicapService.calculateHandicapIndex(from: rounds) {
            return calculated
        }
        return userProfile?.currentHandicap ?? 25.0
    }

    var goalHandicap: Double {
        userProfile?.goalHandicap ?? 18.0
    }

    var progressPercentage: Double {
        guard let profile = userProfile else { return 0 }
        let start = profile.currentHandicap
        let goal = profile.goalHandicap
        if start <= goal { return 100 }
        let progress = (start - currentHandicap) / (start - goal) * 100
        return max(0, min(100, progress))
    }

    var handicapTrend: [HandicapDataPoint] {
        handicapService.handicapTrend(from: rounds)
    }

    var mostCommonLeaker: StrokeLeaker? {
        handicapService.strokeLeakerFrequency(from: rounds).first?.leaker
    }

    // MARK: - Usage Gate
    var canUseAI: Bool {
        userProfile?.subscriptionTier == .pro || usageStats.aiMessagesRemaining > 0
    }

    var canUploadSwing: Bool {
        userProfile?.subscriptionTier == .pro || usageStats.swingUploadsRemaining > 0
    }

    func recordAIMessage() {
        usageStats.aiMessagesUsed += 1
        storage.saveUsageStats(usageStats)
    }

    func recordSwingUpload() {
        usageStats.swingUploadsUsed += 1
        storage.saveUsageStats(usageStats)
    }

    func upgradeToPro() {
        userProfile?.subscriptionTier = .pro
        if let profile = userProfile { storage.saveUserProfile(profile) }
    }

    // MARK: - Milestones
    private func checkMilestones() {
        if rounds.count >= 1  { achieve(.firstRound) }
        if rounds.count >= 5  { achieve(.fiveRounds) }
        if rounds.count >= 10 { achieve(.tenRounds) }
        if !swingAnalyses.isEmpty { achieve(.firstSwing) }
        if rounds.contains(where: { $0.score < 100 }) { achieve(.break100) }
        if rounds.contains(where: { $0.score < 90 })  { achieve(.break90) }
        if rounds.contains(where: { $0.score < 80 })  { achieve(.break80) }
        if currentHandicap < 10 { achieve(.singleDigit) }
        if currentHandicap <= 0 { achieve(.scratch) }
        storage.saveMilestones(milestones)
    }

    private func achieve(_ type: MilestoneType) {
        guard let idx = milestones.firstIndex(where: { $0.type == type }), !milestones[idx].isAchieved else { return }
        milestones[idx].isAchieved = true
        milestones[idx].achievedDate = Date()
    }

    private func refreshInsight() {
        guard let profile = userProfile else { return }
        weeklyInsight = MockData.weeklyInsight(for: profile, rounds: rounds)
    }

    // MARK: - Reset
    func resetApp() {
        storage.clearAll()
        hasCompletedOnboarding = false
        userProfile = nil
        rounds = []
        swingAnalyses = []
        currentPracticePlan = nil
        milestones = []
    }
}
