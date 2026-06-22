import Foundation

// MARK: - AI Service Protocol
// Swap MockAIService for AnthropicAIService / OpenAIService when ready.
protocol AIServiceProtocol {
    func chat(messages: [CoachMessage], context: AIContext) async throws -> String
    func analyzeSwing(club: Club, angle: SwingAngle, notes: String?) async throws -> SwingAnalysis
    func generatePracticePlan(for profile: UserProfile, recentRounds: [Round]) async throws -> PracticePlan
    func generateWeeklyInsight(for profile: UserProfile, rounds: [Round]) async throws -> String
}

// MARK: - Context
struct AIContext: Codable {
    var currentHandicap: Double
    var goalHandicap: Double
    var handicapGoal: HandicapGoal
    var primaryWeakness: GolfWeakness
    var recentRoundSummary: String
    var practiceFrequency: PracticeFrequency
    var subscriptionTier: SubscriptionTier

    init(from profile: UserProfile, rounds: [Round]) {
        self.currentHandicap = profile.currentHandicap
        self.goalHandicap = profile.goalHandicap
        self.handicapGoal = profile.handicapGoal
        self.primaryWeakness = profile.primaryWeakness
        self.practiceFrequency = profile.practiceFrequency
        self.subscriptionTier = profile.subscriptionTier
        if rounds.isEmpty {
            self.recentRoundSummary = "No rounds logged yet."
        } else {
            let recent = rounds.prefix(5)
            let scores = recent.map { "\($0.score)" }.joined(separator: ", ")
            let leakers = recent.map { $0.primaryLeaker.rawValue }.joined(separator: ", ")
            self.recentRoundSummary = "Recent scores: \(scores). Main stroke leakers: \(leakers)."
        }
    }
}

// MARK: - System Prompt Template
enum AIPrompts {
    static func coachSystemPrompt(context: AIContext) -> String {
        """
        You are Scratch, an expert AI golf coach. You are encouraging, clear, and practical.

        GOLFER PROFILE:
        - Current handicap: \(context.currentHandicap)
        - Goal: \(context.handicapGoal.rawValue) (target handicap: \(context.goalHandicap))
        - Primary weakness: \(context.primaryWeakness.rawValue)
        - Practice frequency: \(context.practiceFrequency.rawValue)
        - Recent performance: \(context.recentRoundSummary)

        COACHING STYLE:
        - Sound like a supportive PGA instructor, not a robot or a textbook
        - Give specific, actionable advice. Never give vague platitudes
        - Keep responses under 200 words unless asked for a detailed plan
        - When building practice plans, give exact drills with times and reps
        - Focus on the fastest path to lower scores for THIS golfer's handicap range
        - Use safe language for anything you cannot verify: "likely," "may," "in many cases"
        - Never diagnose swing mechanics from text alone — you need video for that

        TONE: Conversational, warm, direct. No fluff. Every sentence should be useful.
        """
    }

    static func swingAnalysisPrompt(club: Club, angle: SwingAngle, notes: String?) -> String {
        """
        Analyze this golf swing video and return structured feedback.

        Club: \(club.rawValue)
        Camera angle: \(angle.rawValue)
        Additional notes: \(notes ?? "None")

        Return EXACTLY this JSON structure:
        {
          "mainIssue": "One sentence describing the primary swing fault",
          "mainStrength": "One sentence about what they're doing well",
          "recommendedDrill": "One specific drill with instructions",
          "scoringImpact": "Estimated scoring impact if fixed",
          "confidence": "low|medium|high",
          "coachTags": ["tag1", "tag2"]
        }

        Rules:
        - Use hedged language: "appears to," "may be," "based on this angle"
        - Do not overdiagnose from one video
        - Keep each field to 1–2 sentences max
        - scoringImpact should be honest and specific, e.g. "Could save 1–2 shots/round if driver misses are your main issue"
        - confidence should reflect video clarity and angle quality
        """
    }
}

// MARK: - Mock Implementation (replace with real API calls)
final class MockAIService: AIServiceProtocol {

    func chat(messages: [CoachMessage], context: AIContext) async throws -> String {
        try await Task.sleep(nanoseconds: 1_200_000_000)
        return mockCoachResponse(for: messages.last?.content ?? "", context: context)
    }

    func analyzeSwing(club: Club, angle: SwingAngle, notes: String?) async throws -> SwingAnalysis {
        try await Task.sleep(nanoseconds: 2_500_000_000)
        return mockSwingAnalysis(club: club, angle: angle)
    }

    func generatePracticePlan(for profile: UserProfile, recentRounds: [Round]) async throws -> PracticePlan {
        try await Task.sleep(nanoseconds: 1_000_000_000)
        return MockData.practicePlan(for: profile)
    }

    func generateWeeklyInsight(for profile: UserProfile, rounds: [Round]) async throws -> String {
        try await Task.sleep(nanoseconds: 800_000_000)
        return MockData.weeklyInsight(for: profile, rounds: rounds)
    }

    // MARK: Mock Responses
    private func mockCoachResponse(for message: String, context: AIContext) -> String {
        let lower = message.lowercased()
        if lower.contains("break 90") || lower.contains("shoot 90") {
            return "Breaking 90 is mostly a short game problem. Statistically, golfers at a 20 handicap leave 8–12 strokes per round within 50 yards of the green. Here's what I'd focus on this week: 1) Chip-and-run technique from just off the green — aim to always be putting after. 2) Lag putting from 30+ feet — eliminating 3-putts is worth 2–3 shots per round instantly. 3) On the course, take a hybrid or long iron off any tight tee, not your driver. Fewer penalties = fewer blow-up holes."
        }
        if lower.contains("practice") || lower.contains("session") || lower.contains("range") {
            return "Here's a focused 45-minute range session for your level:\n\n**10 min — Warm-up:** Start with half-swings with a 7-iron. Focus on contact quality, not distance.\n\n**15 min — Target practice:** Pick a specific target (flag or cone). Hit 5 balls, assess. For your \(context.primaryWeakness.rawValue.lowercased()) work, focus on [\(context.primaryWeakness.coachTip)]\n\n**10 min — 3 clubs:** Pick your 3 most-used clubs and hit 5 shots each.\n\n**10 min — Pressure shots:** Play out 9 holes on the range — pick a club and target for each imaginary hole.\n\nDon't hit more than 80 balls total. Quality focus beats quantity every time."
        }
        if lower.contains("swing") || lower.contains("video") {
            return "I can only analyze your swing from a video — head to the Swing tab to upload one. Based on your stated weakness (\(context.primaryWeakness.rawValue)), I'd guess the issue is somewhere in your \(context.primaryWeakness.rawValue.lowercased()) pattern, but I need video to confirm anything specific. Upload from the face-on angle first — it gives the clearest picture for most common faults."
        }
        if lower.contains("why") && (lower.contains("not improving") || lower.contains("plateau")) {
            return "Plateaus happen for a few predictable reasons:\n\n**1. Same weaknesses, no focused practice.** If you're always doing what's comfortable on the range, you're not building new skills.\n\n**2. Not enough rounds.** Improvement shows up in score variance before it shows up in your handicap. You need 8+ rounds to see a real trend.\n\n**3. Course management.** Many golfers improve their ball-striking but not their decision-making. Are you taking on shots you shouldn't?\n\nGiven your \(context.primaryWeakness.rawValue.lowercased()) weakness, I'd bet the fastest fix is specific, uncomfortable practice in that area for 3 weeks straight."
        }
        return "Good question. Based on your handicap of \(context.currentHandicap) and goal to \(context.handicapGoal.rawValue), the fastest path forward is deliberately working on \(context.primaryWeakness.rawValue.lowercased()). \(context.primaryWeakness.coachTip) Want me to build you a specific 30-day plan, or focus on something this week?"
    }

    private func mockSwingAnalysis(club: Club, angle: SwingAngle) -> SwingAnalysis {
        let analyses: [(String, String, String, String)] = [
            (
                "Clubface appears open at impact, which may be contributing to shots that miss right. This is likely the primary cause of any slice or fade pattern.",
                "Your tempo and rhythm look solid — you're not rushing the transition, which is a real strength most amateur golfers lack.",
                "Gate Drill: Place two tees just outside your ball line, one at address width, one 4 inches ahead. Practice swinging through the gate without hitting either tee. 20 reps per session.",
                "Fixing an open clubface could save 1–2 strokes per round if your miss is consistently right."
            ),
            (
                "Your swing appears to get steep coming into the ball, which may create thin contact or a steep divot pattern, particularly with irons.",
                "Your setup looks athletic and balanced — good posture and ball position for this club.",
                "Towel Under Arms: Place a small towel under your trail arm and keep it there during the backswing. This encourages a shallower, more connected swing. Hit 15 balls per session.",
                "A shallower angle of attack could improve iron consistency by reducing thin shots — potentially 2–3 saved strokes per round."
            ),
            (
                "Based on this angle, your weight may be staying too far back at impact, which can lead to fat shots and inconsistent contact.",
                "Your backswing turn looks full and efficient — you're loading well for your level.",
                "Step Through Drill: After impact, let your trail foot step forward toward the target. This encourages weight transfer through the ball. Practice with a 7-iron, 20 reps.",
                "Better weight transfer typically improves ball-striking consistency — likely worth 1–3 shots per round."
            )
        ]
        let pick = analyses.randomElement()!
        var analysis = SwingAnalysis(club: club, angle: angle)
        analysis.mainIssue = pick.0
        analysis.mainStrength = pick.1
        analysis.recommendedDrill = pick.2
        analysis.scoringImpact = pick.3
        analysis.confidence = [.medium, .medium, .high].randomElement()!
        analysis.status = .complete
        analysis.coachTags = [club.rawValue, angle.rawValue, "impact", "ball-flight"]
        return analysis
    }
}

// MARK: - Anthropic Implementation Stub
// Uncomment and implement when connecting to real API
/*
final class AnthropicAIService: AIServiceProtocol {
    private let apiKey: String
    private let model = "claude-sonnet-4-6"
    private let baseURL = URL(string: "https://api.anthropic.com/v1/messages")!

    init(apiKey: String) { self.apiKey = apiKey }

    func chat(messages: [CoachMessage], context: AIContext) async throws -> String {
        let systemPrompt = AIPrompts.coachSystemPrompt(context: context)
        let apiMessages = messages.filter { $0.role != .system }.map {
            ["role": $0.role.rawValue, "content": $0.content]
        }
        // Build URLRequest, POST to Anthropic, decode response
        // See: https://docs.anthropic.com/en/api/messages
        fatalError("Implement with Anthropic SDK")
    }

    func analyzeSwing(club: Club, angle: SwingAngle, notes: String?) async throws -> SwingAnalysis {
        // Use vision API with video frame or image
        fatalError("Implement with Anthropic vision API")
    }

    func generatePracticePlan(for profile: UserProfile, recentRounds: [Round]) async throws -> PracticePlan {
        fatalError("Implement")
    }

    func generateWeeklyInsight(for profile: UserProfile, rounds: [Round]) async throws -> String {
        fatalError("Implement")
    }
}
*/
