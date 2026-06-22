import SwiftUI

struct PaywallView: View {
    @EnvironmentObject var appVM: AppViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedProduct = SubscriptionProduct.annual
    @State private var isPurchasing = false
    @State private var isRestoring = false
    @StateObject private var subscriptionService = MockSubscriptionService()

    var body: some View {
        NavigationStack {
            ZStack {
                ScratchColors.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 28) {
                        // Header
                        header
                        // Feature list
                        featureList
                        // Product selector
                        productSelector
                        // CTA
                        ctaSection
                        // Legal
                        legalText
                        Spacer(minLength: 20)
                    }
                    .padding(.horizontal, ScratchLayout.screenPadding)
                    .padding(.top, 24)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") { dismiss() }
                        .foregroundColor(ScratchColors.textSecondary)
                }
            }
        }
    }

    // MARK: - Header
    private var header: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(ScratchColors.gold.opacity(0.2))
                    .frame(width: 80, height: 80)
                Image(systemName: "trophy.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(ScratchColors.goldGradient)
            }
            .goldGlow()

            VStack(spacing: 8) {
                Text("Scratch Pro")
                    .font(ScratchFont.display(32))
                    .foregroundColor(ScratchColors.textPrimary)
                Text("Unlimited AI coaching.\nPersonalized plans. Faster improvement.")
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Features
    private var featureList: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(SubscriptionTier.pro.features) { feature in
                HStack(spacing: 12) {
                    Image(systemName: feature.included ? "checkmark.circle.fill" : "minus.circle.fill")
                        .foregroundColor(feature.included ? ScratchColors.success : ScratchColors.textTertiary)
                        .font(.system(size: 18))
                    Text(feature.title)
                        .font(ScratchFont.body())
                        .foregroundColor(feature.included ? ScratchColors.textPrimary : ScratchColors.textTertiary)
                }
            }
        }
        .padding(ScratchLayout.cardPadding + 4)
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
    }

    // MARK: - Product Selector
    private var productSelector: some View {
        VStack(spacing: 10) {
            ForEach([SubscriptionProduct.annual, .monthly]) { product in
                Button {
                    withAnimation { selectedProduct = product }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(product.displayName)
                                    .font(ScratchFont.headline())
                                    .foregroundColor(ScratchColors.textPrimary)
                                if let savings = product.savings {
                                    Text(savings)
                                        .font(ScratchFont.caption(11))
                                        .foregroundColor(.black)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(ScratchColors.goldGradient)
                                        .cornerRadius(20)
                                }
                            }
                            if product.period == .annual {
                                Text("= \(AppInfo.annualMonthlyEquivalent)/mo")
                                    .font(ScratchFont.caption())
                                    .foregroundColor(ScratchColors.textSecondary)
                            }
                        }
                        Spacer()
                        Text(product.price)
                            .font(ScratchFont.headline())
                            .foregroundColor(ScratchColors.textPrimary)
                        Image(systemName: selectedProduct.id == product.id ? "largecircle.fill.circle" : "circle")
                            .foregroundColor(selectedProduct.id == product.id ? ScratchColors.green : ScratchColors.textTertiary)
                            .font(.system(size: 20))
                    }
                    .padding(ScratchLayout.cardPadding)
                    .background(selectedProduct.id == product.id ? ScratchColors.green.opacity(0.12) : ScratchColors.surface2)
                    .cornerRadius(ScratchLayout.cardRadius)
                    .overlay(
                        RoundedRectangle(cornerRadius: ScratchLayout.cardRadius)
                            .stroke(selectedProduct.id == product.id ? ScratchColors.green : Color.clear, lineWidth: 1.5)
                    )
                }
            }
        }
    }

    // MARK: - CTA
    private var ctaSection: some View {
        VStack(spacing: 12) {
            PrimaryButton(
                title: isPurchasing ? "Processing..." : "Start \(selectedProduct.displayName) — \(selectedProduct.price)",
                icon: isPurchasing ? nil : "sparkles",
                style: .gold,
                isLoading: isPurchasing
            ) {
                purchase()
            }

            Button("Restore Purchases") {
                restore()
            }
            .font(ScratchFont.body(14))
            .foregroundColor(ScratchColors.textTertiary)
        }
    }

    // MARK: - Legal
    private var legalText: some View {
        Text("Subscriptions automatically renew unless cancelled. Cancel anytime in Settings > Apple ID. By continuing, you agree to our Terms of Service and Privacy Policy.")
            .font(ScratchFont.caption(11))
            .foregroundColor(ScratchColors.textTertiary)
            .multilineTextAlignment(.center)
    }

    // MARK: - Purchase
    private func purchase() {
        isPurchasing = true
        Task {
            do {
                try await subscriptionService.purchase(selectedProduct)
                appVM.upgradeToPro()
                dismiss()
            } catch {
                // Show error
            }
            isPurchasing = false
        }
    }

    private func restore() {
        isRestoring = true
        Task {
            try? await subscriptionService.restorePurchases()
            isRestoring = false
        }
    }
}
