import Foundation

struct PracticePlan: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var weekStarting: Date = Date.startOfCurrentWeek
    var weeklyFocus: String
    var sessions: [PracticeSession]
    var totalMinutes: Int { sessions.reduce(0) { $0 + $1.durationMinutes } }
    var completedCount: Int { sessions.filter { $0.isCompleted }.count }
    var completionPct: Double { sessions.isEmpty ? 0 : Double(completedCount) / Double(sessions.count) * 100 }
    var generatedAt: Date = Date()
    var insight: String = ""
}

struct PracticeSession: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var title: String
    var description: String
    var durationMinutes: Int
    var focus: GolfWeakness
    var drills: [Drill]
    var isCompleted: Bool = false
    var completedAt: Date?
}

struct Drill: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var name: String
    var instructions: String
    var durationMinutes: Int
    var reps: String?
    var videoSearchQuery: String?
}

// MARK: - Weekly Focus Tag
enum WeeklyFocusTag: String, CaseIterable, Identifiable {
    case drivingRange    = "Driving Range"
    case shortGame       = "Short Game Area"
    case puttingGreen    = "Putting Green"
    case onCourse        = "On Course"
    case mentalPractice  = "Mental Game"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .drivingRange:   return "arrow.up.right.circle.fill"
        case .shortGame:      return "scope"
        case .puttingGreen:   return "circle.dashed"
        case .onCourse:       return "flag.fill"
        case .mentalPractice: return "brain.head.profile"
        }
    }
}
