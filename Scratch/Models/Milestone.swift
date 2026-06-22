import Foundation

struct Milestone: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var type: MilestoneType
    var achievedDate: Date?
    var isAchieved: Bool = false
}

enum MilestoneType: String, CaseIterable, Codable, Identifiable {
    // Score milestones
    case break100    = "Break 100"
    case break90     = "Break 90"
    case break80     = "Break 80"
    case singleDigit = "Single Digit"
    case scratch     = "Scratch"
    // Activity milestones
    case firstRound  = "First Round"
    case fiveRounds  = "5 Rounds"
    case tenRounds   = "10 Rounds"
    case firstSwing  = "First Swing"
    case weekStreak  = "Week Streak"

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .break100:    return "🎯"
        case .break90:     return "⛳"
        case .break80:     return "🏌️"
        case .singleDigit: return "🔥"
        case .scratch:     return "🏆"
        case .firstRound:  return "📋"
        case .fiveRounds:  return "📊"
        case .tenRounds:   return "📈"
        case .firstSwing:  return "🎥"
        case .weekStreak:  return "🔥"
        }
    }

    var description: String {
        switch self {
        case .break100:    return "Shoot under 100 for 18 holes"
        case .break90:     return "Shoot under 90 for 18 holes"
        case .break80:     return "Shoot under 80 for 18 holes"
        case .singleDigit: return "Reach a single-digit handicap"
        case .scratch:     return "Reach scratch or better"
        case .firstRound:  return "Log your first round"
        case .fiveRounds:  return "Log 5 rounds"
        case .tenRounds:   return "Log 10 rounds"
        case .firstSwing:  return "Upload your first swing video"
        case .weekStreak:  return "Practice 7 days in a row"
        }
    }

    var requiredScore: Int? {
        switch self {
        case .break100: return 99
        case .break90:  return 89
        case .break80:  return 79
        default:        return nil
        }
    }

    var isGoalMilestone: Bool {
        switch self {
        case .break100, .break90, .break80, .singleDigit, .scratch: return true
        default: return false
        }
    }
}
