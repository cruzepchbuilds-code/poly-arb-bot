import Foundation

struct Round: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var date: Date
    var score: Int
    var courseName: String?
    var courseRating: Double?
    var slopeRating: Int?
    var primaryLeaker: StrokeLeaker
    var notes: String?

    // Optional advanced stats
    var fairwaysHit: Int?
    var fairwaysTotal: Int?
    var greensInRegulation: Int?
    var totalPutts: Int?
    var penalties: Int?

    // Computed
    var differential: Double {
        guard let rating = courseRating, let slope = slopeRating else {
            // Estimate using standard par 72
            return (Double(score) - 72.0) * 113.0 / 113.0
        }
        return (Double(score) - rating) * 113.0 / Double(slope)
    }

    var fairwayPct: Double? {
        guard let hit = fairwaysHit, let total = fairwaysTotal, total > 0 else { return nil }
        return Double(hit) / Double(total) * 100
    }

    var girPct: Double? {
        guard let gir = greensInRegulation else { return nil }
        return Double(gir) / 18.0 * 100
    }

    var puttsPerHole: Double? {
        guard let putts = totalPutts else { return nil }
        return Double(putts) / 18.0
    }

    var formattedScore: String {
        let par = 72
        let diff = score - par
        if diff == 0 { return "E" }
        return diff > 0 ? "+\(diff)" : "\(diff)"
    }
}

// MARK: - Stroke Leaker
enum StrokeLeaker: String, CaseIterable, Codable, Identifiable {
    case driver          = "Driver"
    case irons           = "Irons"
    case wedges          = "Wedges"
    case shortGame       = "Short Game"
    case putting         = "Putting"
    case penalties       = "Penalties"
    case mentalMistakes  = "Mental Mistakes"

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .driver:         return "🏌️"
        case .irons:          return "⛳"
        case .wedges:         return "🎯"
        case .shortGame:      return "🏴"
        case .putting:        return "⚪"
        case .penalties:      return "⛔"
        case .mentalMistakes: return "🧠"
        }
    }

    var coachResponse: String {
        switch self {
        case .driver:
            return "Off-the-tee struggles typically mean fairways missed, which cascades into longer second shots. Try a pre-shot routine focusing on a specific target — not just 'away from trouble.'"
        case .irons:
            return "Iron inconsistency often comes down to ball position and impact quality. Focus on brushing the turf after the ball, not before."
        case .wedges:
            return "Wedge control is the fastest path to lower scores. Prioritize distance control from 50–100 yards — hit 10 balls to each yardage at your next practice session."
        case .shortGame:
            return "Up-and-downs save par. Work on your basic chip-and-run: land the ball on the fringe, let it roll to the hole. Simplicity beats technique in most situations."
        case .putting:
            return "Most golfers waste 3+ shots a round on putts over 20 feet. Lag putting practice from 30 feet will immediately lower scores."
        case .penalties:
            return "Penalties are a course management issue. Identify your two or three 'danger holes' and play conservatively there — take the iron off the tee, lay up short of water."
        case .mentalMistakes:
            return "Mental mistakes compound. After a bad hole, your only job is to make bogey on the next one — not birdie. Reset your target to 'one shot at a time.'"
        }
    }

    var golfWeakness: GolfWeakness {
        switch self {
        case .driver:         return .driver
        case .irons:          return .irons
        case .wedges:         return .wedges
        case .shortGame:      return .shortGame
        case .putting:        return .putting
        case .penalties:      return .driver
        case .mentalMistakes: return .mental
        }
    }
}
