import SwiftUI

struct AddRoundSheet: View {
    @EnvironmentObject var homeVM: HomeViewModel
    @EnvironmentObject var appVM: AppViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showAdvanced = false
    @State private var scoreInput: String = "90"

    var body: some View {
        NavigationStack {
            ZStack {
                ScratchColors.background.ignoresSafeArea()
                ScrollView(showsIndicators: false) {
                    VStack(spacing: ScratchLayout.sectionSpacing) {
                        // Score
                        scoreSection
                        // Stroke leaker
                        leakerSection
                        // Course (optional)
                        courseSection
                        // Advanced (optional)
                        advancedToggle
                        if showAdvanced { advancedSection }
                        Spacer(minLength: 100)
                    }
                    .padding(.horizontal, ScratchLayout.screenPadding)
                    .padding(.top, 16)
                }
            }
            .navigationTitle("Add Round")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(ScratchColors.textSecondary)
                }
                ToolbarItem(placement: .navigationBarBottom) {
                    EmptyView()
                }
            }
            .safeAreaInset(edge: .bottom) {
                PrimaryButton(title: "Save Round", icon: "checkmark", style: .green) {
                    if let score = Int(scoreInput) {
                        homeVM.roundToAdd.score = score
                    }
                    homeVM.submitRound(appVM: appVM)
                    dismiss()
                }
                .padding(.horizontal, ScratchLayout.screenPadding)
                .padding(.vertical, 16)
                .background(ScratchColors.background)
            }
        }
    }

    // MARK: - Score
    private var scoreSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Score", subtitle: "How many strokes for 18 holes?")
            HStack {
                TextField("90", text: $scoreInput)
                    .font(ScratchFont.number(56))
                    .foregroundColor(ScratchColors.textPrimary)
                    .keyboardType(.numberPad)
                    .frame(maxWidth: 120)
                Text("strokes")
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(ScratchLayout.cardPadding)
            .background(ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cardRadius)
        }
    }

    // MARK: - Stroke Leaker
    private var leakerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "What cost you the most strokes?")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(StrokeLeaker.allCases) { leaker in
                    LeakerButton(
                        leaker: leaker,
                        isSelected: homeVM.roundToAdd.primaryLeaker == leaker
                    ) {
                        homeVM.roundToAdd.primaryLeaker = leaker
                    }
                }
            }
        }
    }

    // MARK: - Course
    private var courseSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Course", subtitle: "Optional")
            TextField("Course name", text: Binding(
                get: { homeVM.roundToAdd.courseName ?? "" },
                set: { homeVM.roundToAdd.courseName = $0.isEmpty ? nil : $0 }
            ))
            .font(ScratchFont.body())
            .foregroundColor(ScratchColors.textPrimary)
            .padding(ScratchLayout.cardPadding)
            .background(ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cardRadius)
        }
    }

    // MARK: - Advanced Toggle
    private var advancedToggle: some View {
        Button {
            withAnimation { showAdvanced.toggle() }
        } label: {
            HStack {
                Text("Advanced Stats")
                    .font(ScratchFont.subheadline())
                    .foregroundColor(ScratchColors.textSecondary)
                Spacer()
                Image(systemName: showAdvanced ? "chevron.up" : "chevron.down")
                    .font(.system(size: 12))
                    .foregroundColor(ScratchColors.textTertiary)
            }
            .padding(ScratchLayout.cardPadding)
            .background(ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cardRadius)
        }
    }

    // MARK: - Advanced Stats
    private var advancedSection: some View {
        VStack(spacing: 10) {
            AdvancedStatField(
                label: "Fairways Hit (out of 14)",
                placeholder: "e.g. 7",
                value: Binding(
                    get: { homeVM.roundToAdd.fairwaysHit.map { "\($0)" } ?? "" },
                    set: { homeVM.roundToAdd.fairwaysHit = Int($0) }
                )
            )
            AdvancedStatField(
                label: "Greens in Regulation",
                placeholder: "e.g. 6",
                value: Binding(
                    get: { homeVM.roundToAdd.greensInRegulation.map { "\($0)" } ?? "" },
                    set: { homeVM.roundToAdd.greensInRegulation = Int($0) }
                )
            )
            AdvancedStatField(
                label: "Total Putts",
                placeholder: "e.g. 32",
                value: Binding(
                    get: { homeVM.roundToAdd.totalPutts.map { "\($0)" } ?? "" },
                    set: { homeVM.roundToAdd.totalPutts = Int($0) }
                )
            )
            AdvancedStatField(
                label: "Penalty Strokes",
                placeholder: "e.g. 2",
                value: Binding(
                    get: { homeVM.roundToAdd.penalties.map { "\($0)" } ?? "" },
                    set: { homeVM.roundToAdd.penalties = Int($0) }
                )
            )
        }
    }
}

private struct LeakerButton: View {
    let leaker: StrokeLeaker
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(leaker.emoji)
                Text(leaker.rawValue)
                    .font(ScratchFont.caption(13))
                    .foregroundColor(ScratchColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(isSelected ? ScratchColors.green.opacity(0.2) : ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: ScratchLayout.cornerRadius)
                    .stroke(isSelected ? ScratchColors.green : Color.clear, lineWidth: 1.5)
            )
        }
    }
}

private struct AdvancedStatField: View {
    let label: String
    let placeholder: String
    @Binding var value: String

    var body: some View {
        HStack {
            Text(label)
                .font(ScratchFont.body(14))
                .foregroundColor(ScratchColors.textSecondary)
            Spacer()
            TextField(placeholder, text: $value)
                .font(ScratchFont.headline())
                .foregroundColor(ScratchColors.textPrimary)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 60)
        }
        .padding(ScratchLayout.cardPadding)
        .background(ScratchColors.surface2)
        .cornerRadius(ScratchLayout.cornerRadius)
    }
}
