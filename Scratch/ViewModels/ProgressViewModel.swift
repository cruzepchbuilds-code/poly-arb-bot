import SwiftUI

@MainActor
final class ProgressViewModel: ObservableObject {
    @Published var selectedPeriod: TimePeriod = .last3Months

    enum TimePeriod: String, CaseIterable, Identifiable {
        case last10Rounds = "10 Rounds"
        case last3Months  = "3 Months"
        case last6Months  = "6 Months"
        case allTime      = "All Time"
        var id: String { rawValue }
    }

    func filteredRounds(from allRounds: [Round]) -> [Round] {
        let cutoff: Date?
        let cal = Calendar.current
        switch selectedPeriod {
        case .last10Rounds: return Array(allRounds.prefix(10))
        case .last3Months:  cutoff = cal.date(byAdding: .month, value: -3, to: Date())
        case .last6Months:  cutoff = cal.date(byAdding: .month, value: -6, to: Date())
        case .allTime:      cutoff = nil
        }
        guard let cutoff else { return allRounds }
        return allRounds.filter { $0.date >= cutoff }
    }
}
