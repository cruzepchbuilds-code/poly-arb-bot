import Foundation

struct UserProfile: Codable, Equatable {
    var id: UUID = UUID()
    var name: String = ""
    var email: String = ""
    var currentHandicap: Double
    var goalHandicap: Double
    var handicapGoal: HandicapGoal
    var primaryWeakness: GolfWeakness
    var playFrequency: PlayFrequency
    var practiceFrequency: PracticeFrequency
    var createdAt: Date = Date()
    var subscriptionTier: SubscriptionTier = .free
    var avatarInitials: String {
        name.isEmpty ? "G" : String(name.prefix(1)).uppercased()
    }
}

// MARK: - Handicap Goal
enum HandicapGoal: String, CaseIterable, Codable, Identifiable {
    case break100    = "Break 100"
    case break90     = "Break 90"
    case break80     = "Break 80"
    case singleDigit = "Single Digit"
    case scratch     = "Scratch"

    var id: String { rawValue }

    var targetHandicap: Double {
        switch self {
        case .break100:    return 27
        case .break90:     return 18
        case .break80:     return 9
        case .singleDigit: return 9
        case .scratch:     return 0
        }
    }

    var targetScore: Int {
        switch self {
        case .break100:    return 99
        case .break90:     return 89
        case .break80:     return 79
        case .singleDigit: return 81
        case .scratch:     return 72
        }
    }

    var emoji: String {
        switch self {
        case .break100:    return "🎯"
        case .break90:     return "⛳"
        case .break80:     return "🏌️"
        case .singleDigit: return "🔥"
        case .scratch:     return "🏆"
        }
    }

    var description: String {
        switch self {
        case .break100:    return "Shoot under 100 consistently"
        case .break90:     return "Shoot under 90 consistently"
        case .break80:     return "Shoot under 80 consistently"
        case .singleDigit: return "Reach a sub-10 handicap"
        case .scratch:     return "Reach scratch or better"
        }
    }

    var estimatedMonths: String {
        switch self {
        case .break100:    return "2–4 months"
        case .break90:     return "3–6 months"
        case .break80:     return "6–12 months"
        case .singleDigit: return "12–24 months"
        case .scratch:     return "24–48 months"
        }
    }
}

// MARK: - Golf Weakness
enum GolfWeakness: String, CaseIterable, Codable, Identifiable {
    case driver    = "Driver"
    case irons     = "Irons"
    case wedges    = "Wedges"
    case shortGame = "Short Game"
    case putting   = "Putting"
    case mental    = "Mental Game"

    var id: String { rawValue }

    var systemIcon: String {
        switch self {
        case .driver:    return "arrow.up.right.circle.fill"
        case .irons:     return "minus.circle.fill"
        case .wedges:    return "scope"
        case .shortGame: return "flag.fill"
        case .putting:   return "circle.dashed"
        case .mental:    return "brain.head.profile"
        }
    }

    var coachTip: String {
        switch self {
        case .driver:
            return "Focus on tee shot consistency — fairways are worth more than distance."
        case .irons:
            return "Work on ball-striking from 100–150 yards. Clean contact beats power."
        case .wedges:
            return "The scoring zone is 50–100 yards. Proximity to the hole matters most here."
        case .shortGame:
            return "Up-and-down percentage is the #1 handicap lever. Chip and run when in doubt."
        case .putting:
            return "3-putts are handicap killers. Start with lag putting from 30+ feet."
        case .mental:
            return "Course management and commitment save more strokes than swing changes."
        }
    }
}

// MARK: - Play Frequency
enum PlayFrequency: String, CaseIterable, Codable, Identifiable {
    case lessThanOnce = "Less than once a month"
    case onceAMonth   = "About once a month"
    case twiceAMonth  = "2–3 times a month"
    case weekly       = "Once a week"
    case multiple     = "Multiple times a week"

    var id: String { rawValue }

    var roundsPerYear: Int {
        switch self {
        case .lessThanOnce: return 8
        case .onceAMonth:   return 12
        case .twiceAMonth:  return 28
        case .weekly:       return 48
        case .multiple:     return 80
        }
    }
}

// MARK: - Practice Frequency
enum PracticeFrequency: String, CaseIterable, Codable, Identifiable {
    case rarely      = "Rarely"
    case occasionally = "1–2x per month"
    case weekly      = "Once a week"
    case multiWeekly = "2–3x per week"
    case daily       = "Almost every day"

    var id: String { rawValue }

    var practiceHoursPerWeek: Double {
        switch self {
        case .rarely:       return 0.25
        case .occasionally: return 0.5
        case .weekly:       return 1.5
        case .multiWeekly:  return 4.0
        case .daily:        return 7.0
        }
    }
}
