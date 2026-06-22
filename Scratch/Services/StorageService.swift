import Foundation

// MARK: - StorageService
// Backed by UserDefaults today; swap the encode/decode calls for Supabase/Firebase.
final class StorageService {
    static let shared = StorageService()
    private let defaults = UserDefaults.standard
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private init() {}

    // MARK: UserProfile
    func saveUserProfile(_ profile: UserProfile) {
        save(profile, key: StorageKey.userProfile)
    }

    func loadUserProfile() -> UserProfile? {
        load(UserProfile.self, key: StorageKey.userProfile)
    }

    // MARK: Rounds
    func saveRounds(_ rounds: [Round]) {
        save(rounds, key: StorageKey.rounds)
    }

    func loadRounds() -> [Round] {
        load([Round].self, key: StorageKey.rounds) ?? []
    }

    // MARK: Swing Analyses
    func saveSwingAnalyses(_ analyses: [SwingAnalysis]) {
        save(analyses, key: StorageKey.swingAnalyses)
    }

    func loadSwingAnalyses() -> [SwingAnalysis] {
        load([SwingAnalysis].self, key: StorageKey.swingAnalyses) ?? []
    }

    // MARK: Practice Plan
    func saveCurrentPracticePlan(_ plan: PracticePlan) {
        save(plan, key: StorageKey.practicePlan)
    }

    func loadCurrentPracticePlan() -> PracticePlan? {
        load(PracticePlan.self, key: StorageKey.practicePlan)
    }

    // MARK: Coach History
    func saveCoachMessages(_ messages: [CoachMessage]) {
        save(messages, key: StorageKey.coachHistory)
    }

    func loadCoachMessages() -> [CoachMessage] {
        load([CoachMessage].self, key: StorageKey.coachHistory) ?? []
    }

    // MARK: Milestones
    func saveMilestones(_ milestones: [Milestone]) {
        save(milestones, key: StorageKey.milestones)
    }

    func loadMilestones() -> [Milestone] {
        load([Milestone].self, key: StorageKey.milestones) ?? MilestoneType.allCases.map { Milestone(type: $0) }
    }

    // MARK: Usage
    func saveUsageStats(_ stats: UsageStats) {
        save(stats, key: StorageKey.aiUsageCount)
    }

    func loadUsageStats() -> UsageStats {
        load(UsageStats.self, key: StorageKey.aiUsageCount) ?? UsageStats()
    }

    // MARK: Onboarding
    var hasCompletedOnboarding: Bool {
        get { defaults.bool(forKey: StorageKey.onboardingComplete) }
        set { defaults.set(newValue, forKey: StorageKey.onboardingComplete) }
    }

    // MARK: Reset (debug / account delete)
    func clearAll() {
        let keys = [
            StorageKey.onboardingComplete,
            StorageKey.userProfile,
            StorageKey.rounds,
            StorageKey.swingAnalyses,
            StorageKey.practicePlan,
            StorageKey.coachHistory,
            StorageKey.milestones,
            StorageKey.aiUsageCount,
        ]
        keys.forEach { defaults.removeObject(forKey: $0) }
    }

    // MARK: Private Helpers
    private func save<T: Codable>(_ value: T, key: String) {
        guard let data = try? encoder.encode(value) else { return }
        defaults.set(data, forKey: key)
    }

    private func load<T: Codable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? decoder.decode(type, from: data)
    }
}
