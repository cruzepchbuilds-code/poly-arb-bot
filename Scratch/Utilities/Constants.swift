import SwiftUI

// MARK: - Colors
enum ScratchColors {
    static let green        = Color(hex: "1B5C45")
    static let greenDark    = Color(hex: "0E3328")
    static let greenLight   = Color(hex: "2E7D5C")
    static let gold         = Color(hex: "C9A84C")
    static let goldLight    = Color(hex: "DFC07A")
    static let background   = Color(hex: "0A0F0D")
    static let surface      = Color(hex: "141C19")
    static let surface2     = Color(hex: "1C2723")
    static let surface3     = Color(hex: "243029")
    static let border       = Color(white: 1, opacity: 0.08)
    static let textPrimary  = Color.white
    static let textSecondary = Color(hex: "8EA59D")
    static let textTertiary  = Color(hex: "546C65")
    static let success      = Color(hex: "30D158")
    static let warning      = Color(hex: "FFD60A")
    static let destructive  = Color(hex: "FF453A")

    static let brandGradient = LinearGradient(
        colors: [Color(hex: "1B5C45"), Color(hex: "0E3328")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    static let goldGradient = LinearGradient(
        colors: [Color(hex: "DFC07A"), Color(hex: "C9A84C")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    static let cardGradient = LinearGradient(
        colors: [Color(hex: "1C2723"), Color(hex: "141C19")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
}

// MARK: - Typography
enum ScratchFont {
    static func display(_ size: CGFloat = 34) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
    static func headline(_ size: CGFloat = 18) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }
    static func subheadline(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .medium, design: .rounded)
    }
    static func body(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .regular, design: .rounded)
    }
    static func caption(_ size: CGFloat = 12) -> Font {
        .system(size: size, weight: .medium, design: .rounded)
    }
    static func number(_ size: CGFloat = 40) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
    static func mono(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .semibold, design: .monospaced)
    }
}

// MARK: - Layout
enum ScratchLayout {
    static let screenPadding: CGFloat  = 20
    static let cardPadding: CGFloat    = 16
    static let itemSpacing: CGFloat    = 12
    static let sectionSpacing: CGFloat = 28
    static let cornerRadius: CGFloat   = 14
    static let cardRadius: CGFloat     = 18
    static let buttonHeight: CGFloat   = 52
}

// MARK: - App Constants
enum AppInfo {
    static let name                     = "Scratch"
    static let tagline                  = "Your AI Golf Coach"
    static let monthlyProductID         = "com.scratch.golf.pro.monthly"
    static let annualProductID          = "com.scratch.golf.pro.annual"
    static let monthlyPrice             = "$9.99"
    static let annualPrice              = "$79.99"
    static let annualMonthlyEquivalent  = "$6.67"
    static let freeAIMessagesPerMonth   = 5
    static let freeSwingUploadsPerMonth = 1
    static let supportEmail             = "support@scratchgolf.app"
    static let privacyURL               = "https://scratchgolf.app/privacy"
    static let termsURL                 = "https://scratchgolf.app/terms"
}

// MARK: - Storage Keys
enum StorageKey {
    static let onboardingComplete = "v1.onboarding.complete"
    static let userProfile        = "v1.user.profile"
    static let rounds             = "v1.rounds"
    static let swingAnalyses      = "v1.swing.analyses"
    static let practicePlan       = "v1.practice.plan"
    static let coachHistory       = "v1.coach.history"
    static let milestones         = "v1.milestones"
    static let aiUsageCount       = "v1.ai.usage.count"
    static let aiUsageResetDate   = "v1.ai.usage.reset"
    static let swingUsageCount    = "v1.swing.usage.count"
    static let practiceStreak     = "v1.practice.streak"
    static let lastPracticeDate   = "v1.practice.last.date"
}
