import Foundation
import Combine

// MARK: - Protocol (RevenueCat-ready)
// Wire to RevenueCat SDK: replace MockSubscriptionService with RCSubscriptionService
protocol SubscriptionServiceProtocol: ObservableObject {
    var currentTier: SubscriptionTier { get }
    var isLoading: Bool { get }
    func purchase(_ product: SubscriptionProduct) async throws
    func restorePurchases() async throws
}

// MARK: - Mock Service
final class MockSubscriptionService: SubscriptionServiceProtocol {
    @Published var currentTier: SubscriptionTier = .free
    @Published var isLoading: Bool = false

    func purchase(_ product: SubscriptionProduct) async throws {
        isLoading = true
        defer { isLoading = false }
        try await Task.sleep(nanoseconds: 1_500_000_000)
        currentTier = .pro
    }

    func restorePurchases() async throws {
        isLoading = true
        defer { isLoading = false }
        try await Task.sleep(nanoseconds: 1_000_000_000)
        // In production: call RevenueCat.restorePurchases()
    }
}

// MARK: - RevenueCat Stub
// Uncomment once RevenueCat SDK is added via SPM: https://github.com/RevenueCat/purchases-ios
/*
import RevenueCat

final class RCSubscriptionService: SubscriptionServiceProtocol {
    @Published var currentTier: SubscriptionTier = .free
    @Published var isLoading: Bool = false

    init() {
        Purchases.configure(withAPIKey: "your_revenuecat_key")
        Task { await refreshEntitlements() }
    }

    func purchase(_ product: SubscriptionProduct) async throws {
        isLoading = true
        defer { isLoading = false }
        guard let rcPackage = await fetchPackage(id: product.id) else { return }
        let result = try await Purchases.shared.purchase(package: rcPackage)
        await refreshEntitlements()
    }

    func restorePurchases() async throws {
        isLoading = true
        defer { isLoading = false }
        _ = try await Purchases.shared.restorePurchases()
        await refreshEntitlements()
    }

    private func refreshEntitlements() async {
        let info = try? await Purchases.shared.customerInfo()
        let isPro = info?.entitlements["pro"]?.isActive == true
        await MainActor.run { currentTier = isPro ? .pro : .free }
    }

    private func fetchPackage(id: String) async -> Package? {
        let offerings = try? await Purchases.shared.offerings()
        return offerings?.current?.availablePackages.first { $0.storeProduct.productIdentifier == id }
    }
}
*/
