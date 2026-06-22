import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var appVM: AppViewModel
    @EnvironmentObject var profileVM: ProfileViewModel

    var body: some View {
        NavigationStack {
            ZStack {
                ScratchColors.background.ignoresSafeArea()
                ScrollView(showsIndicators: false) {
                    VStack(spacing: ScratchLayout.sectionSpacing) {
                        // Profile header
                        profileHeader
                        // Subscription card
                        subscriptionCard
                        // Handicap & goal
                        statsRow
                        // Connected accounts
                        connectedSection
                        // Settings
                        settingsSection
                        // Legal
                        legalSection
                        // Danger zone
                        dangerSection
                        Spacer(minLength: 100)
                    }
                    .padding(.horizontal, ScratchLayout.screenPadding)
                    .padding(.top, 8)
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $profileVM.showPaywall) { PaywallView() }
            .alert("Delete Account", isPresented: $profileVM.showDeleteConfirm) {
                Button("Delete", role: .destructive) {
                    profileVM.deleteAccount(appVM: appVM)
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will permanently delete all your data. This cannot be undone.")
            }
        }
    }

    // MARK: - Header
    private var profileHeader: some View {
        HStack(spacing: 16) {
            // Avatar
            ZStack {
                Circle()
                    .fill(ScratchColors.brandGradient)
                    .frame(width: 64, height: 64)
                Text(appVM.userProfile?.avatarInitials ?? "G")
                    .font(ScratchFont.display(28))
                    .foregroundColor(.white)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(appVM.userProfile?.name.isEmpty == false ? (appVM.userProfile?.name ?? "Golfer") : "Golfer")
                    .font(ScratchFont.headline(20))
                    .foregroundColor(ScratchColors.textPrimary)
                if let profile = appVM.userProfile {
                    Text("\(profile.handicapGoal.rawValue) · \(profile.playFrequency.rawValue)")
                        .font(ScratchFont.caption())
                        .foregroundColor(ScratchColors.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer()
        }
        .padding(ScratchLayout.cardPadding)
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
    }

    // MARK: - Subscription
    private var subscriptionCard: some View {
        let isPro = appVM.userProfile?.subscriptionTier == .pro

        return VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(isPro ? "Scratch Pro" : "Free Plan")
                            .font(ScratchFont.headline())
                            .foregroundColor(ScratchColors.textPrimary)
                        if isPro { ProBadge() }
                    }
                    Text(isPro
                         ? "Unlimited AI coaching + swing analysis"
                         : "\(appVM.usageStats.aiMessagesRemaining) AI messages left this month"
                    )
                    .font(ScratchFont.caption())
                    .foregroundColor(ScratchColors.textSecondary)
                }
                Spacer()
                if !isPro {
                    Button("Upgrade") {
                        profileVM.showPaywall = true
                    }
                    .font(ScratchFont.subheadline())
                    .foregroundColor(.black)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(ScratchColors.goldGradient)
                    .cornerRadius(20)
                }
            }
            .padding(ScratchLayout.cardPadding)
        }
        .background(isPro ? ScratchColors.green.opacity(0.15) : ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
        .overlay(
            RoundedRectangle(cornerRadius: ScratchLayout.cardRadius)
                .stroke(isPro ? ScratchColors.green.opacity(0.4) : Color.clear, lineWidth: 1)
        )
    }

    // MARK: - Stats
    private var statsRow: some View {
        HStack(spacing: 10) {
            StatChip(
                label: "Handicap",
                value: appVM.currentHandicap.handicapDisplay,
                accent: ScratchColors.textPrimary
            )
            StatChip(
                label: "Goal",
                value: "\(appVM.userProfile?.handicapGoal.rawValue ?? "—")",
                accent: ScratchColors.gold,
                subtitle: appVM.goalHandicap.handicapDisplay
            )
            StatChip(
                label: "Rounds",
                value: "\(appVM.rounds.count)",
                accent: ScratchColors.textSecondary
            )
        }
    }

    // MARK: - Connected Accounts
    private var connectedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Connected Accounts", subtitle: "Coming soon")
            VStack(spacing: 0) {
                ForEach(["GHIN", "Arccos", "Garmin", "Shot Scope"], id: \.self) { service in
                    connectedRow(service: service)
                    if service != "Shot Scope" { ScratchDivider() }
                }
            }
            .background(ScratchColors.surface)
            .cornerRadius(ScratchLayout.cardRadius)
        }
    }

    private func connectedRow(_ service: String) -> some View {
        HStack {
            Text(service)
                .font(ScratchFont.body())
                .foregroundColor(ScratchColors.textPrimary)
            Spacer()
            Text("Coming soon")
                .font(ScratchFont.caption())
                .foregroundColor(ScratchColors.textTertiary)
        }
        .padding(ScratchLayout.cardPadding)
    }

    // MARK: - Settings
    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Settings")
            VStack(spacing: 0) {
                settingsRow(icon: "bell.fill", label: "Notifications")
                ScratchDivider()
                settingsRow(icon: "lock.fill", label: "Privacy")
                ScratchDivider()
                settingsRow(icon: "questionmark.circle.fill", label: "Help & Support")
            }
            .background(ScratchColors.surface)
            .cornerRadius(ScratchLayout.cardRadius)
        }
    }

    private func settingsRow(icon: String, label: String, action: (() -> Void)? = nil) -> some View {
        Button(action: action ?? {}) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(ScratchColors.textSecondary)
                    .frame(width: 24)
                Text(label)
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(ScratchColors.textTertiary)
            }
            .padding(ScratchLayout.cardPadding)
        }
    }

    // MARK: - Legal
    private var legalSection: some View {
        VStack(spacing: 0) {
            legalLink("Privacy Policy", url: AppInfo.privacyURL)
            ScratchDivider()
            legalLink("Terms of Service", url: AppInfo.termsURL)
            ScratchDivider()
            HStack {
                Text("Version 1.0.0")
                    .font(ScratchFont.caption())
                    .foregroundColor(ScratchColors.textTertiary)
                Spacer()
            }
            .padding(ScratchLayout.cardPadding)
        }
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
    }

    private func legalLink(_ title: String, url: String) -> some View {
        HStack {
            Text(title)
                .font(ScratchFont.body())
                .foregroundColor(ScratchColors.textPrimary)
            Spacer()
            Image(systemName: "arrow.up.right.square")
                .font(.system(size: 12))
                .foregroundColor(ScratchColors.textTertiary)
        }
        .padding(ScratchLayout.cardPadding)
    }

    // MARK: - Danger
    private var dangerSection: some View {
        VStack(spacing: 10) {
            Button("Delete Account & Data") {
                profileVM.showDeleteConfirm = true
            }
            .font(ScratchFont.body())
            .foregroundColor(ScratchColors.destructive)
            .frame(maxWidth: .infinity)
            .padding(ScratchLayout.cardPadding)
            .background(ScratchColors.destructive.opacity(0.1))
            .cornerRadius(ScratchLayout.cardRadius)

            Text("Scratch does not sell your data. Your game data is stored locally on this device.")
                .font(ScratchFont.caption(11))
                .foregroundColor(ScratchColors.textTertiary)
                .multilineTextAlignment(.center)
        }
    }
}
