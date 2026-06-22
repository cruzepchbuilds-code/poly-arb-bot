import Foundation

struct SwingAnalysis: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var date: Date = Date()
    var club: Club
    var angle: SwingAngle
    var videoLocalPath: String?
    var thumbnailLocalPath: String?
    var status: AnalysisStatus = .pending

    // AI Output
    var mainIssue: String = ""
    var mainStrength: String = ""
    var recommendedDrill: String = ""
    var scoringImpact: String = ""
    var confidence: AnalysisConfidence = .medium
    var disclaimer: String = "Based on this video angle only. For precise diagnosis, work with a PGA instructor."

    // Coach tags for AI context
    var coachTags: [String] = []
}

// MARK: - Club
enum Club: String, CaseIterable, Codable, Identifiable {
    case driver = "Driver"
    case wood   = "Fairway Wood"
    case iron   = "Iron"
    case wedge  = "Wedge"
    case putter = "Putter"

    var id: String { rawValue }

    var shortName: String {
        switch self {
        case .driver: return "Driver"
        case .wood:   return "Fairway Wood"
        case .iron:   return "Iron"
        case .wedge:  return "Wedge"
        case .putter: return "Putter"
        }
    }

    var emoji: String {
        switch self {
        case .driver: return "🏌️"
        case .wood:   return "🌳"
        case .iron:   return "⛳"
        case .wedge:  return "🎯"
        case .putter: return "⚪"
        }
    }
}

// MARK: - Swing Angle
enum SwingAngle: String, CaseIterable, Codable, Identifiable {
    case faceOn     = "Face-On"
    case downTheLine = "Down-the-Line"

    var id: String { rawValue }

    var tip: String {
        switch self {
        case .faceOn:
            return "Camera at chest height, directly in front. Best for seeing clubface, hip sway, and spine angle."
        case .downTheLine:
            return "Camera behind your trail shoulder. Best for seeing swing path, plane, and club position."
        }
    }
}

// MARK: - Analysis Status
enum AnalysisStatus: String, Codable {
    case pending    = "Analyzing..."
    case complete   = "Complete"
    case failed     = "Failed"
    case uploading  = "Uploading..."
}

// MARK: - Confidence
enum AnalysisConfidence: String, Codable, CaseIterable {
    case low    = "Low"
    case medium = "Medium"
    case high   = "High"

    var colorName: String {
        switch self {
        case .low:    return "warning"
        case .medium: return "gold"
        case .high:   return "success"
        }
    }

    var description: String {
        switch self {
        case .low:
            return "Video quality or angle makes this a rough estimate only."
        case .medium:
            return "Reasonably clear view. Findings are likely directionally correct."
        case .high:
            return "Clear video with a good angle. Findings are reliable."
        }
    }
}
