import SwiftUI
import Charts

struct ProgressView: View {
    @EnvironmentObject var appVM: AppViewModel
    @EnvironmentObject var progressVM: ProgressViewModel

    private var filteredRounds: [Round] {
        progressVM.filteredRounds(from: appVM.rounds)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ScratchColors.background.ignoresSafeArea()
                if appVM.rounds.isEmpty {
                    EmptyStateView(
                        icon: "chart.line.uptrend.xyaxis",
                        title: "No data yet",
                        message: "Log a round to start tracking your improvement."
                    )
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: ScratchLayout.sectionSpacing) {
                            // Period picker
                            periodPicker
                            // Handicap section
                            handicapSection
                            // Score chart
                            scoreSection
                            // Leaker breakdown
                            leakerSection
                            // Milestones
                            milestonesSection
                            Spacer(minLength: 100)
                        }
                        .padding(.horizontal, ScratchLayout.screenPadding)
                        .padding(.top, 8)
                    }
                }
            }
            .navigationTitle("Progress")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Period Picker
    private var periodPicker: some View {
        HStack(spacing: 0) {
            ForEach(ProgressViewModel.TimePeriod.allCases) { period in
                Button {
                    withAnimation { progressVM.selectedPeriod = period }
                } label: {
                    Text(period.rawValue)
                        .font(ScratchFont.caption(13))
                        .foregroundColor(progressVM.selectedPeriod == period ? ScratchColors.textPrimary : ScratchColors.textTertiary)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(
                            progressVM.selectedPeriod == period
                            ? ScratchColors.surface3
                            : Color.clear
                        )
                        .cornerRadius(8)
                }
            }
        }
        .padding(4)
        .background(ScratchColors.surface2)
        .cornerRadius(10)
    }

    // MARK: - Handicap
    private var handicapSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Handicap")

            HStack(spacing: 12) {
                StatChip(
                    label: "Current",
                    value: appVM.currentHandicap.handicapDisplay,
                    accent: ScratchColors.textPrimary
                )
                StatChip(
                    label: "Goal",
                    value: appVM.goalHandicap.handicapDisplay,
                    accent: ScratchColors.gold
                )
                StatChip(
                    label: "Progress",
                    value: appVM.progressPercentage.percentDisplay,
                    accent: ScratchColors.green
                )
            }

            // Handicap chart
            if appVM.handicapTrend.count >= 2 {
                Chart(appVM.handicapTrend) { point in
                    LineMark(
                        x: .value("Date", point.date),
                        y: .value("Handicap", point.handicap)
                    )
                    .foregroundStyle(ScratchColors.green)
                    .interpolationMethod(.catmullRom)

                    AreaMark(
                        x: .value("Date", point.date),
                        y: .value("Handicap", point.handicap)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [ScratchColors.green.opacity(0.3), ScratchColors.green.opacity(0)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)
                }
                .frame(height: 140)
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks(position: .leading) { val in
                        AxisValueLabel {
                            if let v = val.as(Double.self) {
                                Text(v.handicapDisplay)
                                    .font(ScratchFont.caption(10))
                                    .foregroundColor(ScratchColors.textTertiary)
                            }
                        }
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    // MARK: - Scores
    private var scoreSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            let rounds = filteredRounds.sorted { $0.date < $1.date }
            SectionHeader(
                title: "Scores",
                subtitle: rounds.isEmpty ? nil : "Avg: \(rounds.map { $0.score }.reduce(0, +) / max(1, rounds.count))"
            )

            if rounds.count >= 2 {
                Chart(rounds) { round in
                    LineMark(
                        x: .value("Round", round.date),
                        y: .value("Score", round.score)
                    )
                    .foregroundStyle(ScratchColors.goldLight)
                    .interpolationMethod(.catmullRom)

                    PointMark(
                        x: .value("Round", round.date),
                        y: .value("Score", round.score)
                    )
                    .foregroundStyle(ScratchColors.gold)
                    .symbolSize(40)
                }
                .frame(height: 160)
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks(position: .leading) { val in
                        AxisValueLabel {
                            if let v = val.as(Int.self) {
                                Text("\(v)")
                                    .font(ScratchFont.caption(10))
                                    .foregroundColor(ScratchColors.textTertiary)
                            }
                        }
                    }
                }
            }

            // Best/worst/avg
            HStack(spacing: 10) {
                let scores = filteredRounds.map { $0.score }
                if !scores.isEmpty {
                    StatChip(label: "Best",    value: "\(scores.min() ?? 0)", accent: ScratchColors.success)
                    StatChip(label: "Average", value: "\(scores.reduce(0, +) / scores.count)", accent: ScratchColors.textPrimary)
                    StatChip(label: "Rounds",  value: "\(scores.count)", accent: ScratchColors.textSecondary)
                }
            }
        }
    }

    // MARK: - Leaker Breakdown
    private var leakerSection: some View {
        let freq = HandicapService.shared.strokeLeakerFrequency(from: filteredRounds)
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Stroke Leakers", subtitle: "Where are you losing shots?")
            if freq.isEmpty {
                Text("Not enough data yet.")
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textTertiary)
            } else {
                VStack(spacing: 8) {
                    ForEach(freq.prefix(5), id: \.leaker.id) { item in
                        HStack(spacing: 10) {
                            Text(item.leaker.emoji)
                                .font(.system(size: 18))
                            Text(item.leaker.rawValue)
                                .font(ScratchFont.body(14))
                                .foregroundColor(ScratchColors.textPrimary)
                            Spacer()
                            GeometryReader { geo in
                                let maxCount = freq.first?.count ?? 1
                                let pct = Double(item.count) / Double(maxCount)
                                ZStack(alignment: .leading) {
                                    Capsule().fill(ScratchColors.surface3)
                                    Capsule()
                                        .fill(ScratchColors.green)
                                        .frame(width: geo.size.width * pct)
                                }
                            }
                            .frame(width: 100, height: 6)
                            Text("\(item.count)x")
                                .font(ScratchFont.caption(12))
                                .foregroundColor(ScratchColors.textSecondary)
                                .frame(width: 28, alignment: .trailing)
                        }
                    }
                }
                .padding(ScratchLayout.cardPadding)
                .background(ScratchColors.surface)
                .cornerRadius(ScratchLayout.cardRadius)
            }
        }
    }

    // MARK: - Milestones
    private var milestonesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Milestones")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(appVM.milestones) { milestone in
                    MilestoneCard(milestone: milestone)
                }
            }
        }
    }
}

// MARK: - Milestone Card
private struct MilestoneCard: View {
    let milestone: Milestone

    var body: some View {
        VStack(spacing: 8) {
            Text(milestone.type.emoji)
                .font(.system(size: 28))
                .opacity(milestone.isAchieved ? 1.0 : 0.3)
            Text(milestone.type.rawValue)
                .font(ScratchFont.caption(11))
                .foregroundColor(milestone.isAchieved ? ScratchColors.textPrimary : ScratchColors.textTertiary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
            if milestone.isAchieved, let date = milestone.achievedDate {
                Text(date.dayMonth)
                    .font(ScratchFont.caption(9))
                    .foregroundColor(ScratchColors.green)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(milestone.isAchieved ? ScratchColors.green.opacity(0.12) : ScratchColors.surface2)
        .cornerRadius(ScratchLayout.cardRadius)
        .overlay(
            RoundedRectangle(cornerRadius: ScratchLayout.cardRadius)
                .stroke(milestone.isAchieved ? ScratchColors.green.opacity(0.5) : Color.clear, lineWidth: 1)
        )
    }
}
