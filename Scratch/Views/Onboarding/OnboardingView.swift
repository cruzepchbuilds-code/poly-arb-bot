import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var appVM: AppViewModel
    @StateObject private var vm = OnboardingViewModel()

    var body: some View {
        ZStack {
            ScratchColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                if vm.currentStep != .generating && vm.currentStep != .complete {
                    onboardingHeader
                }

                // Steps
                ZStack {
                    switch vm.currentStep {
                    case .goal:      GoalStepView(vm: vm)
                    case .handicap:  HandicapStepView(vm: vm)
                    case .weakness:  WeaknessStepView(vm: vm)
                    case .frequency: FrequencyStepView(vm: vm)
                    case .generating: GeneratingView()
                    case .complete:  OnboardingCompleteView(vm: vm, appVM: appVM)
                    }
                }
                .animation(.easeInOut(duration: 0.3), value: vm.currentStep)

                // Bottom nav
                if vm.currentStep != .generating && vm.currentStep != .complete {
                    bottomNav
                }
            }
        }
    }

    private var onboardingHeader: some View {
        VStack(spacing: 12) {
            HStack {
                // Back button
                if vm.currentStep.rawValue > 0 {
                    Button { vm.back() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(ScratchColors.textSecondary)
                            .frame(width: 36, height: 36)
                    }
                } else {
                    Spacer().frame(width: 36)
                }
                Spacer()
                // Step indicator
                Text("\(vm.currentStep.rawValue + 1) of 4")
                    .font(ScratchFont.caption())
                    .foregroundColor(ScratchColors.textSecondary)
            }
            .padding(.horizontal, ScratchLayout.screenPadding)

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(ScratchColors.surface3)
                        .frame(height: 3)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(ScratchColors.green)
                        .frame(width: geo.size.width * vm.progress, height: 3)
                        .animation(.easeInOut(duration: 0.4), value: vm.progress)
                }
            }
            .frame(height: 3)
            .padding(.horizontal, ScratchLayout.screenPadding)
        }
        .padding(.top, 16)
        .padding(.bottom, 8)
    }

    private var bottomNav: some View {
        VStack(spacing: 12) {
            PrimaryButton(
                title: vm.currentStep == .frequency ? "Build My Plan" : "Continue",
                icon: vm.currentStep == .frequency ? "sparkles" : nil,
                style: .green
            ) {
                vm.advance()
            }
            .padding(.horizontal, ScratchLayout.screenPadding)
            .disabled(!vm.canAdvance)
        }
        .padding(.bottom, 40)
    }
}

// MARK: - Step 1: Goal
private struct GoalStepView: View {
    @ObservedObject var vm: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: ScratchLayout.sectionSpacing) {
            VStack(alignment: .leading, spacing: 8) {
                Text("What's your\ngolf goal?")
                    .font(ScratchFont.display(32))
                    .foregroundColor(ScratchColors.textPrimary)
                Text("We'll build your roadmap around this.")
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)
            }
            .padding(.horizontal, ScratchLayout.screenPadding)
            .padding(.top, 24)

            VStack(spacing: 10) {
                ForEach(HandicapGoal.allCases) { goal in
                    GoalCard(goal: goal, isSelected: vm.handicapGoal == goal) {
                        withAnimation(.easeInOut(duration: 0.2)) { vm.handicapGoal = goal }
                    }
                }
            }
            .padding(.horizontal, ScratchLayout.screenPadding)
            Spacer()
        }
    }
}

private struct GoalCard: View {
    let goal: HandicapGoal
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Text(goal.emoji)
                    .font(.system(size: 24))
                    .frame(width: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(goal.rawValue)
                        .font(ScratchFont.headline())
                        .foregroundColor(ScratchColors.textPrimary)
                    Text(goal.description)
                        .font(ScratchFont.caption())
                        .foregroundColor(ScratchColors.textSecondary)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(ScratchColors.green)
                        .font(.system(size: 20))
                }
            }
            .padding(ScratchLayout.cardPadding)
            .background(isSelected ? ScratchColors.green.opacity(0.15) : ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cardRadius)
            .overlay(
                RoundedRectangle(cornerRadius: ScratchLayout.cardRadius)
                    .stroke(isSelected ? ScratchColors.green : Color.clear, lineWidth: 1.5)
            )
        }
    }
}

// MARK: - Step 2: Handicap
private struct HandicapStepView: View {
    @ObservedObject var vm: OnboardingViewModel
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ScratchLayout.sectionSpacing) {
            VStack(alignment: .leading, spacing: 8) {
                Text("What's your\ncurrent handicap?")
                    .font(ScratchFont.display(32))
                    .foregroundColor(ScratchColors.textPrimary)
                Text("Estimate is fine if you don't track one.")
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)
            }
            .padding(.horizontal, ScratchLayout.screenPadding)
            .padding(.top, 24)

            VStack(spacing: 16) {
                TextField("e.g. 18", text: $vm.handicapInput)
                    .font(ScratchFont.display(48))
                    .foregroundColor(ScratchColors.textPrimary)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.center)
                    .focused($focused)
                    .onAppear { focused = true }

                Text("handicap index")
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)

                if let hcp = Double(vm.handicapInput), hcp > vm.handicapGoal.targetHandicap {
                    Text("You need to drop \(Int(hcp - vm.handicapGoal.targetHandicap)) strokes to reach your goal.")
                        .font(ScratchFont.body())
                        .foregroundColor(ScratchColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 40)

            // Don't track
            Button("I don't track a handicap") {
                vm.handicapInput = "25"
            }
            .font(ScratchFont.caption())
            .foregroundColor(ScratchColors.textTertiary)
            .frame(maxWidth: .infinity)

            Spacer()
        }
    }
}

// MARK: - Step 3: Weakness
private struct WeaknessStepView: View {
    @ObservedObject var vm: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: ScratchLayout.sectionSpacing) {
            VStack(alignment: .leading, spacing: 8) {
                Text("What's costing\nyou the most strokes?")
                    .font(ScratchFont.display(28))
                    .foregroundColor(ScratchColors.textPrimary)
                Text("Be honest — we'll focus coaching here first.")
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)
            }
            .padding(.horizontal, ScratchLayout.screenPadding)
            .padding(.top, 24)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(GolfWeakness.allCases) { weakness in
                    WeaknessCard(weakness: weakness, isSelected: vm.primaryWeakness == weakness) {
                        withAnimation(.easeInOut(duration: 0.2)) { vm.primaryWeakness = weakness }
                    }
                }
            }
            .padding(.horizontal, ScratchLayout.screenPadding)

            if true {
                Text(vm.primaryWeakness.coachTip)
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)
                    .padding()
                    .background(ScratchColors.surface2)
                    .cornerRadius(ScratchLayout.cardRadius)
                    .padding(.horizontal, ScratchLayout.screenPadding)
            }

            Spacer()
        }
    }
}

private struct WeaknessCard: View {
    let weakness: GolfWeakness
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: weakness.systemIcon)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(isSelected ? ScratchColors.green : ScratchColors.textSecondary)
                Text(weakness.rawValue)
                    .font(ScratchFont.subheadline(14))
                    .foregroundColor(ScratchColors.textPrimary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(isSelected ? ScratchColors.green.opacity(0.15) : ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cardRadius)
            .overlay(
                RoundedRectangle(cornerRadius: ScratchLayout.cardRadius)
                    .stroke(isSelected ? ScratchColors.green : Color.clear, lineWidth: 1.5)
            )
        }
    }
}

// MARK: - Step 4: Frequency
private struct FrequencyStepView: View {
    @ObservedObject var vm: OnboardingViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ScratchLayout.sectionSpacing) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("How often do\nyou play and practice?")
                        .font(ScratchFont.display(28))
                        .foregroundColor(ScratchColors.textPrimary)
                    Text("This helps calibrate your improvement timeline.")
                        .font(ScratchFont.body())
                        .foregroundColor(ScratchColors.textSecondary)
                }
                .padding(.horizontal, ScratchLayout.screenPadding)
                .padding(.top, 24)

                VStack(alignment: .leading, spacing: 8) {
                    Text("How often do you play?")
                        .font(ScratchFont.headline())
                        .foregroundColor(ScratchColors.textPrimary)
                        .padding(.horizontal, ScratchLayout.screenPadding)

                    ForEach(PlayFrequency.allCases) { freq in
                        FrequencyRow(label: freq.rawValue, isSelected: vm.playFrequency == freq) {
                            vm.playFrequency = freq
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("How often do you practice?")
                        .font(ScratchFont.headline())
                        .foregroundColor(ScratchColors.textPrimary)
                        .padding(.horizontal, ScratchLayout.screenPadding)

                    ForEach(PracticeFrequency.allCases) { freq in
                        FrequencyRow(label: freq.rawValue, isSelected: vm.practiceFrequency == freq) {
                            vm.practiceFrequency = freq
                        }
                    }
                }
                .padding(.bottom, 40)
            }
        }
    }
}

private struct FrequencyRow: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(label)
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textPrimary)
                Spacer()
                Circle()
                    .strokeBorder(isSelected ? ScratchColors.green : ScratchColors.border, lineWidth: 2)
                    .background(Circle().fill(isSelected ? ScratchColors.green : Color.clear))
                    .frame(width: 20, height: 20)
                    .overlay(
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                            .opacity(isSelected ? 1 : 0)
                    )
            }
            .padding()
            .background(isSelected ? ScratchColors.green.opacity(0.1) : ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cornerRadius)
        }
        .padding(.horizontal, ScratchLayout.screenPadding)
    }
}

// MARK: - Generating
private struct GeneratingView: View {
    @State private var dotCount = 0
    let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            // Animated logo
            ZStack {
                Circle()
                    .fill(ScratchColors.green.opacity(0.15))
                    .frame(width: 120, height: 120)
                    .scaleEffect(1.0)
                    .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: dotCount)
                Image(systemName: "sparkles")
                    .font(.system(size: 48, weight: .medium))
                    .foregroundColor(ScratchColors.green)
            }

            VStack(spacing: 12) {
                Text("Building your plan")
                    .font(ScratchFont.display(28))
                    .foregroundColor(ScratchColors.textPrimary)
                Text("Analyzing your profile and generating\na personalized coaching roadmap" + String(repeating: ".", count: dotCount))
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(ScratchLayout.screenPadding)
        .onReceive(timer) { _ in dotCount = (dotCount % 3) + 1 }
    }
}

// MARK: - Complete
private struct OnboardingCompleteView: View {
    @ObservedObject var vm: OnboardingViewModel
    let appVM: AppViewModel
    @State private var animateIn = false

    var body: some View {
        ScrollView {
            VStack(spacing: ScratchLayout.sectionSpacing) {
                // Header
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 60))
                        .foregroundColor(ScratchColors.green)
                        .scaleEffect(animateIn ? 1 : 0.5)
                        .opacity(animateIn ? 1 : 0)
                        .animation(.spring(response: 0.5, dampingFraction: 0.6).delay(0.1), value: animateIn)

                    Text("Your plan is ready")
                        .font(ScratchFont.display(32))
                        .foregroundColor(ScratchColors.textPrimary)
                        .opacity(animateIn ? 1 : 0)
                        .animation(.easeIn.delay(0.3), value: animateIn)

                    if let profile = vm.generatedProfile {
                        Text("Estimated timeline to \(profile.handicapGoal.rawValue): \(profile.handicapGoal.estimatedMonths)")
                            .font(ScratchFont.body())
                            .foregroundColor(ScratchColors.textSecondary)
                            .multilineTextAlignment(.center)
                            .opacity(animateIn ? 1 : 0)
                            .animation(.easeIn.delay(0.4), value: animateIn)
                    }
                }
                .padding(.top, 40)
                .frame(maxWidth: .infinity)

                // This week's focus
                if let plan = vm.generatedPlan {
                    VStack(alignment: .leading, spacing: 12) {
                        SectionHeader(title: "This Week's Focus")
                        Text(plan.weeklyFocus)
                            .font(ScratchFont.headline())
                            .foregroundColor(ScratchColors.textPrimary)
                            .padding(ScratchLayout.cardPadding)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(ScratchColors.green.opacity(0.15))
                            .cornerRadius(ScratchLayout.cardRadius)
                            .overlay(
                                RoundedRectangle(cornerRadius: ScratchLayout.cardRadius)
                                    .stroke(ScratchColors.green.opacity(0.4), lineWidth: 1)
                            )

                        Text(plan.insight)
                            .font(ScratchFont.body())
                            .foregroundColor(ScratchColors.textSecondary)
                    }
                    .padding(.horizontal, ScratchLayout.screenPadding)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeIn.delay(0.5), value: animateIn)
                }

                // Sessions preview
                if let plan = vm.generatedPlan {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeader(title: "Practice Sessions")
                        ForEach(plan.sessions) { session in
                            HStack(spacing: 12) {
                                Image(systemName: session.focus.systemIcon)
                                    .foregroundColor(ScratchColors.green)
                                    .frame(width: 24)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(session.title).font(ScratchFont.subheadline()).foregroundColor(ScratchColors.textPrimary)
                                    Text("\(session.durationMinutes) min").font(ScratchFont.caption()).foregroundColor(ScratchColors.textSecondary)
                                }
                                Spacer()
                            }
                            .padding(ScratchLayout.cardPadding)
                            .background(ScratchColors.surface2)
                            .cornerRadius(ScratchLayout.cardRadius)
                        }
                    }
                    .padding(.horizontal, ScratchLayout.screenPadding)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeIn.delay(0.6), value: animateIn)
                }

                PrimaryButton(title: "Let's Go", icon: "arrow.right", style: .green) {
                    if let profile = vm.generatedProfile, let plan = vm.generatedPlan {
                        appVM.completeOnboarding(profile: profile, practicePlan: plan)
                    }
                }
                .padding(.horizontal, ScratchLayout.screenPadding)
                .padding(.bottom, 40)
                .opacity(animateIn ? 1 : 0)
                .animation(.easeIn.delay(0.7), value: animateIn)
            }
        }
        .onAppear { animateIn = true }
    }
}
