import SwiftUI

struct HomeView: View {
    @EnvironmentObject var appVM: AppViewModel
    @EnvironmentObject var homeVM: HomeViewModel

    var body: some View {
        NavigationStack {
            ZStack {
                ScratchColors.background.ignoresSafeArea()
                ScrollView(showsIndicators: false) {
                    VStack(spacing: ScratchLayout.sectionSpacing) {
                        // Hero card
                        heroCard
                        // AI Insight
                        insightCard
                        // Quick actions
                        quickActions
                        // This week's plan
                        if let plan = appVM.currentPracticePlan {
                            weeklyPlanSection(plan: plan)
                        }
                        // Recent rounds
                        if !appVM.rounds.isEmpty {
                            recentRoundsSection
                        }
                        Spacer(minLength: 100)
                    }
                    .padding(.horizontal, ScratchLayout.screenPadding)
                    .padding(.top, 8)
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Text("Scratch")
                        .font(ScratchFont.headline(20))
                        .foregroundColor(ScratchColors.green)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if let profile = appVM.userProfile, profile.subscriptionTier == .pro {
                        ProBadge()
                    }
                }
            }
            .sheet(isPresented: $homeVM.showAddRound) {
                AddRoundSheet()
                    .environmentObject(homeVM)
            }
        }
    }

    // MARK: - Hero Card
    private var heroCard: some View {
        ZStack {
            ScratchColors.brandGradient
                .cornerRadius(ScratchLayout.cardRadius + 4)
            VStack(spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Current Handicap")
                            .font(ScratchFont.caption())
                            .foregroundColor(.white.opacity(0.7))
                        Text(appVM.currentHandicap.handicapDisplay)
                            .font(ScratchFont.number(52))
                            .foregroundColor(.white)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("Goal")
                            .font(ScratchFont.caption())
                            .foregroundColor(.white.opacity(0.7))
                        Text(appVM.goalHandicap.handicapDisplay)
                            .font(ScratchFont.number(32))
                            .foregroundColor(ScratchColors.goldLight)
                        Text(appVM.userProfile?.handicapGoal.rawValue ?? "")
                            .font(ScratchFont.caption(11))
                            .foregroundColor(.white.opacity(0.7))
                    }
                }

                // Progress bar
                VStack(spacing: 6) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.2))
                            Capsule()
                                .fill(ScratchColors.goldGradient)
                                .frame(width: geo.size.width * (appVM.progressPercentage / 100))
                                .animation(.easeInOut(duration: 1.0), value: appVM.progressPercentage)
                        }
                    }
                    .frame(height: 6)
                    HStack {
                        Text("Progress toward goal")
                            .font(ScratchFont.caption(11))
                            .foregroundColor(.white.opacity(0.6))
                        Spacer()
                        Text(appVM.progressPercentage.percentDisplay)
                            .font(ScratchFont.caption(11))
                            .foregroundColor(ScratchColors.goldLight)
                    }
                }
            }
            .padding(ScratchLayout.cardPadding + 4)
        }
        .shadow(color: ScratchColors.green.opacity(0.4), radius: 16, x: 0, y: 8)
    }

    // MARK: - Insight
    private var insightCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "sparkles")
                .font(.system(size: 20))
                .foregroundColor(ScratchColors.gold)
                .frame(width: 36, height: 36)
                .background(ScratchColors.gold.opacity(0.15))
                .cornerRadius(10)
            Text(appVM.weeklyInsight)
                .font(ScratchFont.body(14))
                .foregroundColor(ScratchColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(ScratchLayout.cardPadding)
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
    }

    // MARK: - Quick Actions
    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Quick Actions")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                QuickActionCard(icon: "plus.circle.fill",  label: "Add Round",      color: ScratchColors.green) {
                    homeVM.showAddRound = true
                }
                QuickActionCard(icon: "video.fill",        label: "Upload Swing",   color: Color(hex: "4A90D9")) {
                    // Navigate to swing tab — handled at MainTabView level
                }
                QuickActionCard(icon: "figure.golf",       label: "Log Practice",   color: ScratchColors.gold) {
                    homeVM.showLogPractice = true
                }
                QuickActionCard(icon: "message.fill",      label: "Ask Coach",      color: Color(hex: "9B59B6")) {
                    // Navigate to coach tab
                }
            }
        }
    }

    // MARK: - Weekly Plan
    private func weeklyPlanSection(plan: PracticePlan) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(
                title: "This Week",
                subtitle: "Started \(Date.startOfCurrentWeek.shortDisplay)"
            )

            // Focus card
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("FOCUS")
                        .font(ScratchFont.caption(10))
                        .foregroundColor(ScratchColors.green)
                        .tracking(1.5)
                    Spacer()
                    Text("\(plan.completedCount)/\(plan.sessions.count) sessions")
                        .font(ScratchFont.caption(11))
                        .foregroundColor(ScratchColors.textSecondary)
                }
                Text(plan.weeklyFocus)
                    .font(ScratchFont.headline(16))
                    .foregroundColor(ScratchColors.textPrimary)

                // Progress
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(ScratchColors.surface3)
                        Capsule()
                            .fill(ScratchColors.green)
                            .frame(width: geo.size.width * (plan.completionPct / 100))
                            .animation(.easeInOut, value: plan.completionPct)
                    }
                }
                .frame(height: 4)
            }
            .padding(ScratchLayout.cardPadding)
            .background(ScratchColors.surface)
            .cornerRadius(ScratchLayout.cardRadius)

            // Sessions
            ForEach(plan.sessions.prefix(3)) { session in
                SessionRow(session: session) {
                    appVM.markSessionComplete(session.id)
                }
            }
        }
    }

    // MARK: - Recent Rounds
    private var recentRoundsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Recent Rounds")
            ForEach(appVM.rounds.prefix(3)) { round in
                RoundRow(round: round)
            }
        }
    }
}

// MARK: - Supporting Views
private struct QuickActionCard: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(color)
                Text(label)
                    .font(ScratchFont.subheadline(14))
                    .foregroundColor(ScratchColors.textPrimary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(ScratchLayout.cardPadding)
            .background(ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cardRadius)
        }
    }
}

private struct SessionRow: View {
    let session: PracticeSession
    let onComplete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onComplete) {
                Image(systemName: session.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundColor(session.isCompleted ? ScratchColors.success : ScratchColors.textTertiary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(session.title)
                    .font(ScratchFont.subheadline())
                    .foregroundColor(session.isCompleted ? ScratchColors.textTertiary : ScratchColors.textPrimary)
                    .strikethrough(session.isCompleted, color: ScratchColors.textTertiary)
                Text("\(session.durationMinutes) min · \(session.focus.rawValue)")
                    .font(ScratchFont.caption())
                    .foregroundColor(ScratchColors.textSecondary)
            }
            Spacer()
        }
        .padding(ScratchLayout.cardPadding)
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
    }
}

private struct RoundRow: View {
    let round: Round

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(round.courseName ?? "Round")
                    .font(ScratchFont.subheadline())
                    .foregroundColor(ScratchColors.textPrimary)
                Text(round.date.shortDisplay)
                    .font(ScratchFont.caption())
                    .foregroundColor(ScratchColors.textSecondary)
            }
            Spacer()
            HStack(spacing: 8) {
                Text(round.primaryLeaker.emoji)
                Text("\(round.score)")
                    .font(ScratchFont.headline(18))
                    .foregroundColor(ScratchColors.textPrimary)
            }
        }
        .padding(ScratchLayout.cardPadding)
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
    }
}
