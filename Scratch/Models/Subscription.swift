import Foundation

// MARK: - Tier
enum SubscriptionTier: String, Codable, Equatable {
    case free = "Free"
    case pro  = "Scratch Pro"

    var displayName: String { rawValue }
    var isPro: Bool { self == .pro }

    var features: [SubscriptionFeature] {
        switch self {
        case .free:
            return [
                .init(title: "Basic handicap tracking",         included: true),
                .init(title: "\(AppInfo.freeAIMessagesPerMonth) AI coach messages/month", included: true),
                .init(title: "\(AppInfo.freeSwingUploadsPerMonth) swing upload/month",    included: true),
                .init(title: "Round history",                   included: true),
                .init(title: "Unlimited AI coach",              included: false),
                .init(title: "Unlimited swing uploads",         included: false),
                .init(title: "Weekly AI reviews",               included: false),
                .init(title: "Personalized practice plans",     included: false),
                .init(title: "Progress forecasting",            included: false),
            ]
        case .pro:
            return [
                .init(title: "Everything in Free",              included: true),
                .init(title: "Unlimited AI coach messages",     included: true),
                .init(title: "Unlimited swing uploads",         included: true),
                .init(title: "Weekly AI performance review",    included: true),
                .init(title: "Personalized practice plans",     included: true),
                .init(title: "Progress forecasting",            included: true),
                .init(title: "Priority support",                included: true),
            ]
        }
    }
}

// MARK: - Feature Row
struct SubscriptionFeature: Identifiable {
    var id = UUID()
    var title: String
    var included: Bool
}

// MARK: - Product (RevenueCat-ready)
struct SubscriptionProduct: Identifiable {
    var id: String
    var displayName: String
    var price: String
    var period: BillingPeriod
    var savings: String?
    var isPopular: Bool = false

    static let monthly = SubscriptionProduct(
        id: AppInfo.monthlyProductID,
        displayName: "Monthly",
        price: AppInfo.monthlyPrice + "/mo",
        period: .monthly,
        savings: nil,
        isPopular: false
    )
    static let annual = SubscriptionProduct(
        id: AppInfo.annualProductID,
        displayName: "Annual",
        price: AppInfo.annualPrice + "/yr",
        period: .annual,
        savings: "Save 33%",
        isPopular: true
    )
}

enum BillingPeriod: String, Codable {
    case monthly = "month"
    case annual  = "year"
}

// MARK: - Usage Tracking
struct UsageStats: Codable {
    var aiMessagesUsed: Int = 0
    var swingUploadsUsed: Int = 0
    var resetDate: Date = Date()

    var aiMessagesRemaining: Int {
        max(0, AppInfo.freeAIMessagesPerMonth - aiMessagesUsed)
    }
    var swingUploadsRemaining: Int {
        max(0, AppInfo.freeSwingUploadsPerMonth - swingUploadsUsed)
    }

    mutating func resetIfNeeded() {
        let now = Date()
        if !Calendar.current.isDate(now, equalTo: resetDate, toGranularity: .month) {
            aiMessagesUsed = 0
            swingUploadsUsed = 0
            resetDate = now
        }
    }
}
