import Foundation

// MARK: - WHS Handicap Calculator
// Implements a simplified World Handicap System calculation.
// For production, connect to official GHIN API.
final class HandicapService {
    static let shared = HandicapService()
    private init() {}

    // MARK: - Calculate Playing Handicap
    func calculateHandicapIndex(from rounds: [Round]) -> Double? {
        guard rounds.count >= 3 else { return nil }

        let sorted = rounds
            .sorted { $0.date > $1.date }
            .prefix(20)
        let differentials = sorted.map { $0.differential }
        let sorted_diffs = differentials.sorted()

        let count = sorted_diffs.count
        let useCount: Int
        switch count {
        case 3:      useCount = 1
        case 4:      useCount = 1
        case 5:      useCount = 1
        case 6:      useCount = 2
        case 7...8:  useCount = 2
        case 9...11: useCount = 3
        case 12...14: useCount = 4
        case 15...16: useCount = 5
        case 17:     useCount = 6
        case 18:     useCount = 7
        case 19:     useCount = 8
        default:     useCount = 8  // 20 rounds
        }

        let lowest = Array(sorted_diffs.prefix(useCount))
        let average = lowest.reduce(0, +) / Double(lowest.count)
        let index = (average * 0.96 * 10).rounded() / 10
        return max(0, min(54, index))
    }

    // MARK: - Trend
    func handicapTrend(from rounds: [Round]) -> [HandicapDataPoint] {
        guard rounds.count >= 3 else { return [] }
        let sorted = rounds.sorted { $0.date < $1.date }
        var points: [HandicapDataPoint] = []

        for i in stride(from: 2, through: sorted.count - 1, by: 1) {
            let slice = Array(sorted[0...i])
            if let idx = calculateHandicapIndex(from: slice) {
                points.append(HandicapDataPoint(date: sorted[i].date, handicap: idx))
            }
        }
        return points
    }

    // MARK: - Scoring Average
    func scoringAverage(from rounds: [Round]) -> Double? {
        guard !rounds.isEmpty else { return nil }
        return Double(rounds.map { $0.score }.reduce(0, +)) / Double(rounds.count)
    }

    // MARK: - Best Differential
    func bestDifferential(from rounds: [Round]) -> Double? {
        rounds.map { $0.differential }.min()
    }

    // MARK: - Stroke Leaker Frequency
    func strokeLeakerFrequency(from rounds: [Round]) -> [(leaker: StrokeLeaker, count: Int)] {
        var counts: [StrokeLeaker: Int] = [:]
        rounds.forEach { counts[$0.primaryLeaker, default: 0] += 1 }
        return counts.sorted { $0.value > $1.value }.map { (leaker: $0.key, count: $0.value) }
    }

    // MARK: - Estimated Rounds to Goal
    func estimatedRoundsToGoal(currentHandicap: Double, targetHandicap: Double, improvementRate: Double = 0.3) -> Int? {
        guard targetHandicap < currentHandicap else { return 0 }
        let diff = currentHandicap - targetHandicap
        guard improvementRate > 0 else { return nil }
        return Int(ceil(diff / improvementRate))
    }

    // MARK: - Score Goal for Course
    func scoreGoal(handicapIndex: Double, courseRating: Double = 72.0, slopeRating: Int = 113) -> Int {
        let playing = handicapIndex * Double(slopeRating) / 113.0
        return Int((courseRating + playing).rounded())
    }
}

// MARK: - Data Point for Charts
struct HandicapDataPoint: Identifiable {
    var id = UUID()
    var date: Date
    var handicap: Double
}
