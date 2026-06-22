import Foundation

struct CoachMessage: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var role: MessageRole
    var content: String
    var timestamp: Date = Date()
    var isStreaming: Bool = false

    static func userMessage(_ text: String) -> CoachMessage {
        CoachMessage(role: .user, content: text)
    }

    static func assistantMessage(_ text: String) -> CoachMessage {
        CoachMessage(role: .assistant, content: text)
    }
}

enum MessageRole: String, Codable {
    case user      = "user"
    case assistant = "assistant"
    case system    = "system"
}

// MARK: - Suggested Prompts
enum SuggestedPrompt: String, CaseIterable, Identifiable {
    case whyNotImproving   = "Why am I not improving?"
    case whatToPractice    = "What should I practice this week?"
    case howToBreak90      = "How do I break 90?"
    case swingVideoResults = "What did my swing video show?"
    case rangeSession      = "Build me a 45-minute range session."
    case courseStrategy    = "How should I approach a tough tee shot?"
    case beforeRound       = "How do I warm up before a round?"

    var id: String { rawValue }
    var text: String { rawValue }

    var emoji: String {
        switch self {
        case .whyNotImproving:   return "🤔"
        case .whatToPractice:    return "🏋️"
        case .howToBreak90:      return "🎯"
        case .swingVideoResults: return "🎥"
        case .rangeSession:      return "⛳"
        case .courseStrategy:    return "🗺️"
        case .beforeRound:       return "☀️"
        }
    }
}
