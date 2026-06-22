import Foundation

enum MockData {

    // MARK: - Sample User
    static let sampleProfile = UserProfile(
        name: "Alex Rivera",
        email: "alex@example.com",
        currentHandicap: 18.4,
        goalHandicap: 9.0,
        handicapGoal: .break80,
        primaryWeakness: .shortGame,
        playFrequency: .twiceAMonth,
        practiceFrequency: .weekly
    )

    // MARK: - Sample Rounds
    static let sampleRounds: [Round] = {
        let calendar = Calendar.current
        let today = Date()
        let scores = [98, 95, 92, 94, 91, 89, 93, 88, 91, 90]
        let leakers: [StrokeLeaker] = [.shortGame, .putting, .driver, .shortGame, .putting, .wedges, .shortGame, .putting, .mentalMistakes, .irons]
        let courses = ["Riverside GC", "Pine Valley Links", "Oakwood CC", "Meadowbrook GC", "Harbor View Golf", "Riverside GC", "Pine Valley Links", "Oakwood CC", "Meadowbrook GC", "Harbor View Golf"]
        return scores.enumerated().map { index, score in
            let date = calendar.date(byAdding: .day, value: -(index * 10), to: today) ?? today
            return Round(
                date: date,
                score: score,
                courseName: courses[index],
                courseRating: 71.5,
                slopeRating: 125,
                primaryLeaker: leakers[index],
                fairwaysHit: Int.random(in: 4...9),
                fairwaysTotal: 14,
                greensInRegulation: Int.random(in: 2...8),
                totalPutts: Int.random(in: 30...36),
                penalties: Int.random(in: 0...3)
            )
        }
    }()

    // MARK: - Sample Swing Analyses
    static let sampleSwingAnalyses: [SwingAnalysis] = {
        var a1 = SwingAnalysis(club: .driver, angle: .faceOn)
        a1.mainIssue = "Clubface appears open at impact — may be contributing to a consistent left-to-right ball flight."
        a1.mainStrength = "Your tempo is excellent. You're not rushing the transition, which gives you a solid foundation."
        a1.recommendedDrill = "Gate Drill: Place two tees just outside your ball line and practice swinging through without touching them. 20 reps per session."
        a1.scoringImpact = "Closing the face could save 1–2 shots per round if the slice is your main miss off the tee."
        a1.confidence = .medium
        a1.status = .complete

        var a2 = SwingAnalysis(club: .iron, angle: .downTheLine)
        a2.mainIssue = "Swing path looks slightly over-the-top, which may produce a pull or pull-fade with irons."
        a2.mainStrength = "Your hip rotation looks efficient — you're clearing well through the ball."
        a2.recommendedDrill = "Towel Under Arms: Keep a small towel under your trail armpit through the backswing to encourage a shallower path."
        a2.scoringImpact = "A more neutral path could improve GIR percentage, likely worth 2–3 shots per round."
        a2.confidence = .high
        a2.status = .complete

        return [a1, a2]
    }()

    // MARK: - Sample Practice Plan
    static func practicePlan(for profile: UserProfile) -> PracticePlan {
        let focus = "Short game precision — getting up and down from inside 30 yards"
        let insight = "Your fastest path to lower scores is short game. Statistically, golfers at your handicap leave 8–10 strokes per round within 50 yards of the green. Spend 60% of practice time here this week."

        let sessions: [PracticeSession] = [
            PracticeSession(
                title: "Chipping Precision",
                description: "Focus on landing spot control and roll-out. Learn to predict where your chip will end up.",
                durationMinutes: 30,
                focus: .shortGame,
                drills: [
                    Drill(name: "Clock Drill", instructions: "Place 4 balls at 12, 3, 6, and 9 o'clock around a hole at 5 feet. Chip each in. Repeat from 10 feet.", durationMinutes: 15, reps: "3 rounds"),
                    Drill(name: "Landing Zone", instructions: "Place a towel 3 feet onto the green. Chip to land on the towel and roll to the hole.", durationMinutes: 15, reps: "20 chips")
                ]
            ),
            PracticeSession(
                title: "Lag Putting",
                description: "Eliminate 3-putts. Focus only on putts from 20–40 feet — distance control, not line.",
                durationMinutes: 20,
                focus: .putting,
                drills: [
                    Drill(name: "Ladder Drill", instructions: "Putt from 20, 30, and 40 feet. Goal: leave the ball within 3 feet of the hole. Don't worry about making it.", durationMinutes: 20, reps: "5 putts from each distance")
                ]
            ),
            PracticeSession(
                title: "Bunker Basics",
                description: "Escape every greenside bunker in one shot. This alone is worth 1–2 strokes per round.",
                durationMinutes: 25,
                focus: .shortGame,
                drills: [
                    Drill(name: "Line Drill", instructions: "Draw a line in the sand 2 inches behind the ball. Practice hitting the sand on the line. The ball comes out naturally.", durationMinutes: 25, reps: "30 shots")
                ]
            )
        ]

        return PracticePlan(
            weekStarting: Date.startOfCurrentWeek,
            weeklyFocus: focus,
            sessions: sessions,
            insight: insight
        )
    }

    // MARK: - Weekly Insight
    static func weeklyInsight(for profile: UserProfile, rounds: [Round]) -> String {
        let insights: [String] = [
            "Your fastest path to lower scores is \(profile.primaryWeakness.rawValue.lowercased()). Spend 60% of practice time there this week.",
            "You've played \(rounds.count) rounds recently. The data shows \(rounds.first?.primaryLeaker.rawValue ?? "short game") as your most common stroke leaker. Target that first.",
            "Based on your goal to \(profile.handicapGoal.rawValue), you need to cut approximately \(max(0, Int(profile.currentHandicap - profile.goalHandicap))) strokes from your handicap. That's very achievable with focused practice.",
            "Most golfers at your level improve fastest by fixing 2–3 yards from the green, not their full swing. This week: prioritize chipping and putting.",
            "Short game accounts for roughly 60% of shots in a round. If you're not improving, the range probably isn't where you should be spending your time.",
        ]
        return insights.randomElement() ?? insights[0]
    }

    // MARK: - Initial Coach Messages
    static func initialCoachMessages(for profile: UserProfile) -> [CoachMessage] {
        let greeting = """
        Hey! I'm your Scratch coach. I've looked at your profile and here's the quick version:

        You're a **\(profile.currentHandicap.handicapDisplay) handicap** with a goal to **\(profile.handicapGoal.rawValue)**. Your stated weakness is **\(profile.primaryWeakness.rawValue.lowercased())**.

        **Your fastest path forward:** \(profile.primaryWeakness.coachTip)

        I've also built you a practice plan for this week in the Home tab. Ask me anything — drills, course strategy, how to break through plateaus. I'm here every round.
        """
        return [CoachMessage(role: .assistant, content: greeting)]
    }
}
