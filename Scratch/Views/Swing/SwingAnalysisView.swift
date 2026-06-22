import SwiftUI

struct SwingAnalysisView: View {
    let analysis: SwingAnalysis
    @Environment(\.dismiss) private var dismiss
    @State private var animateIn = false

    var body: some View {
        NavigationStack {
            ZStack {
                ScratchColors.background.ignoresSafeArea()
                ScrollView(showsIndicators: false) {
                    VStack(spacing: ScratchLayout.sectionSpacing) {
                        // Header
                        headerSection
                        // Main issue
                        analysisCard(
                            icon: "exclamationmark.triangle.fill",
                            iconColor: ScratchColors.warning,
                            label: "MAIN ISSUE",
                            content: analysis.mainIssue
                        )
                        .opacity(animateIn ? 1 : 0)
                        .offset(y: animateIn ? 0 : 20)
                        .animation(.easeOut(duration: 0.4).delay(0.2), value: animateIn)

                        // Strength
                        analysisCard(
                            icon: "checkmark.circle.fill",
                            iconColor: ScratchColors.success,
                            label: "STRENGTH",
                            content: analysis.mainStrength
                        )
                        .opacity(animateIn ? 1 : 0)
                        .offset(y: animateIn ? 0 : 20)
                        .animation(.easeOut(duration: 0.4).delay(0.35), value: animateIn)

                        // Drill
                        drillCard
                            .opacity(animateIn ? 1 : 0)
                            .offset(y: animateIn ? 0 : 20)
                            .animation(.easeOut(duration: 0.4).delay(0.5), value: animateIn)

                        // Scoring impact
                        scoringImpactCard
                            .opacity(animateIn ? 1 : 0)
                            .offset(y: animateIn ? 0 : 20)
                            .animation(.easeOut(duration: 0.4).delay(0.65), value: animateIn)

                        // Disclaimer
                        Text(analysis.disclaimer)
                            .font(ScratchFont.caption(11))
                            .foregroundColor(ScratchColors.textTertiary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, ScratchLayout.screenPadding)

                        PrimaryButton(title: "Ask Coach About This", icon: "message.fill", style: .outline) {
                            dismiss()
                        }
                        .padding(.horizontal, ScratchLayout.screenPadding)
                        .padding(.bottom, 40)
                    }
                    .padding(.top, 8)
                }
            }
            .navigationTitle("Swing Analysis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundColor(ScratchColors.green)
                }
            }
            .onAppear { animateIn = true }
        }
    }

    // MARK: - Header
    private var headerSection: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Label("\(analysis.club.emoji) \(analysis.club.rawValue)", systemImage: "")
                    .font(ScratchFont.subheadline())
                    .foregroundColor(ScratchColors.textPrimary)
                Divider().frame(height: 16)
                Text(analysis.angle.rawValue)
                    .font(ScratchFont.subheadline())
                    .foregroundColor(ScratchColors.textSecondary)
                Spacer()
                ConfidenceBadge(confidence: analysis.confidence)
            }
            .padding(ScratchLayout.cardPadding)
            .background(ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cardRadius)

            Text(analysis.date.shortDisplay)
                .font(ScratchFont.caption())
                .foregroundColor(ScratchColors.textTertiary)
        }
        .padding(.horizontal, ScratchLayout.screenPadding)
    }

    // MARK: - Analysis Card
    private func analysisCard(icon: String, iconColor: Color, label: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(iconColor)
                    .font(.system(size: 14))
                Text(label)
                    .font(ScratchFont.caption(11))
                    .foregroundColor(iconColor)
                    .tracking(1.5)
            }
            Text(content)
                .font(ScratchFont.body())
                .foregroundColor(ScratchColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(ScratchLayout.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
        .padding(.horizontal, ScratchLayout.screenPadding)
    }

    // MARK: - Drill Card
    private var drillCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "figure.golf")
                    .foregroundColor(ScratchColors.green)
                    .font(.system(size: 14))
                Text("DRILL TO TRY")
                    .font(ScratchFont.caption(11))
                    .foregroundColor(ScratchColors.green)
                    .tracking(1.5)
            }
            Text(analysis.recommendedDrill)
                .font(ScratchFont.body())
                .foregroundColor(ScratchColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(ScratchLayout.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ScratchColors.green.opacity(0.12))
        .cornerRadius(ScratchLayout.cardRadius)
        .overlay(
            RoundedRectangle(cornerRadius: ScratchLayout.cardRadius)
                .stroke(ScratchColors.green.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, ScratchLayout.screenPadding)
    }

    // MARK: - Scoring Impact
    private var scoringImpactCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "chart.line.downtrend.xyaxis")
                    .foregroundColor(ScratchColors.gold)
                    .font(.system(size: 14))
                Text("SCORING IMPACT")
                    .font(ScratchFont.caption(11))
                    .foregroundColor(ScratchColors.gold)
                    .tracking(1.5)
            }
            Text(analysis.scoringImpact)
                .font(ScratchFont.body())
                .foregroundColor(ScratchColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(ScratchLayout.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
        .padding(.horizontal, ScratchLayout.screenPadding)
    }
}
