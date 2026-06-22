import SwiftUI

struct CoachView: View {
    @EnvironmentObject var appVM: AppViewModel
    @EnvironmentObject var coachVM: CoachViewModel
    @FocusState private var inputFocused: Bool
    @State private var scrollProxy: ScrollViewProxy?

    var body: some View {
        NavigationStack {
            ZStack {
                ScratchColors.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    // Messages
                    ScrollViewReader { proxy in
                        ScrollView(showsIndicators: false) {
                            LazyVStack(spacing: 12) {
                                if coachVM.messages.isEmpty {
                                    suggestedPromptsView
                                } else {
                                    ForEach(coachVM.messages) { message in
                                        MessageBubble(message: message)
                                            .id(message.id)
                                    }
                                    if coachVM.isLoading { typingIndicator }
                                    if let err = coachVM.errorMessage {
                                        errorView(err)
                                    }
                                }
                            }
                            .padding(.horizontal, ScratchLayout.screenPadding)
                            .padding(.top, 12)
                            .padding(.bottom, 120)
                        }
                        .onAppear { scrollProxy = proxy }
                        .onChange(of: coachVM.messages.count) { _ in
                            if let last = coachVM.messages.last {
                                withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                            }
                        }
                    }

                    // Suggested prompts (when chat has messages)
                    if !coachVM.messages.isEmpty && !inputFocused {
                        promptChips
                    }

                    // Input bar
                    inputBar
                }
            }
            .navigationTitle("Coach")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if !coachVM.messages.isEmpty {
                        Button("Clear") { coachVM.clearHistory() }
                            .font(ScratchFont.caption())
                            .foregroundColor(ScratchColors.textTertiary)
                    }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    usageBadge
                }
            }
            .sheet(isPresented: $coachVM.showPaywall) {
                PaywallView()
            }
        }
    }

    // MARK: - Usage Badge
    private var usageBadge: some View {
        Group {
            if appVM.userProfile?.subscriptionTier == .pro {
                HStack(spacing: 4) {
                    Image(systemName: "infinity")
                        .font(.system(size: 10))
                    Text("Unlimited")
                        .font(ScratchFont.caption(11))
                }
                .foregroundColor(ScratchColors.gold)
            } else {
                Text("\(appVM.usageStats.aiMessagesRemaining) msg left")
                    .font(ScratchFont.caption(11))
                    .foregroundColor(ScratchColors.textTertiary)
            }
        }
    }

    // MARK: - Message Bubbles
    // MARK: - Suggested Prompts (empty state)
    private var suggestedPromptsView: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 60)
            // Avatar
            ZStack {
                Circle()
                    .fill(ScratchColors.green.opacity(0.2))
                    .frame(width: 72, height: 72)
                Image(systemName: "figure.golf")
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(ScratchColors.green)
            }
            VStack(spacing: 8) {
                Text("Hi, I'm your Scratch coach.")
                    .font(ScratchFont.headline())
                    .foregroundColor(ScratchColors.textPrimary)
                Text("Ask me anything about your game,\nor pick a prompt to get started.")
                    .font(ScratchFont.body())
                    .foregroundColor(ScratchColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            VStack(spacing: 10) {
                ForEach(SuggestedPrompt.allCases.prefix(5)) { prompt in
                    Button {
                        coachVM.sendSuggestedPrompt(prompt, appVM: appVM)
                    } label: {
                        HStack(spacing: 10) {
                            Text(prompt.emoji)
                            Text(prompt.text)
                                .font(ScratchFont.body(14))
                                .foregroundColor(ScratchColors.textPrimary)
                                .multilineTextAlignment(.leading)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11))
                                .foregroundColor(ScratchColors.textTertiary)
                        }
                        .padding(ScratchLayout.cardPadding)
                        .background(ScratchColors.surface2)
                        .cornerRadius(ScratchLayout.cardRadius)
                    }
                }
            }
            Spacer()
        }
    }

    // MARK: - Prompt Chips
    private var promptChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(SuggestedPrompt.allCases.prefix(4)) { prompt in
                    Button {
                        coachVM.sendSuggestedPrompt(prompt, appVM: appVM)
                    } label: {
                        HStack(spacing: 6) {
                            Text(prompt.emoji)
                            Text(prompt.text)
                                .font(ScratchFont.caption(12))
                                .foregroundColor(ScratchColors.textPrimary)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(ScratchColors.surface2)
                        .cornerRadius(20)
                    }
                }
            }
            .padding(.horizontal, ScratchLayout.screenPadding)
            .padding(.vertical, 8)
        }
        .background(ScratchColors.background)
    }

    // MARK: - Input Bar
    private var inputBar: some View {
        HStack(spacing: 12) {
            TextField("Ask your coach...", text: $coachVM.inputText, axis: .vertical)
                .font(ScratchFont.body())
                .foregroundColor(ScratchColors.textPrimary)
                .lineLimit(1...4)
                .focused($inputFocused)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(ScratchColors.surface2)
                .cornerRadius(22)
                .onSubmit { coachVM.send(appVM: appVM) }

            Button {
                coachVM.send(appVM: appVM)
                inputFocused = false
            } label: {
                Image(systemName: coachVM.isLoading ? "stop.fill" : "arrow.up.circle.fill")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundColor(
                        coachVM.inputText.trimmingCharacters(in: .whitespaces).isEmpty
                        ? ScratchColors.textTertiary
                        : ScratchColors.green
                    )
            }
            .disabled(coachVM.inputText.trimmingCharacters(in: .whitespaces).isEmpty && !coachVM.isLoading)
        }
        .padding(.horizontal, ScratchLayout.screenPadding)
        .padding(.vertical, 12)
        .background(ScratchColors.surface.ignoresSafeArea(edges: .bottom))
    }

    // MARK: - Typing Indicator
    private var typingIndicator: some View {
        HStack(alignment: .bottom, spacing: 8) {
            coachAvatar
            TypingDots()
            Spacer()
        }
    }

    private var coachAvatar: some View {
        ZStack {
            Circle().fill(ScratchColors.green.opacity(0.2)).frame(width: 28, height: 28)
            Image(systemName: "figure.golf")
                .font(.system(size: 12))
                .foregroundColor(ScratchColors.green)
        }
    }

    private func errorView(_ message: String) -> some View {
        Text(message)
            .font(ScratchFont.caption())
            .foregroundColor(ScratchColors.destructive)
            .padding(.horizontal)
    }
}

// MARK: - Message Bubble
private struct MessageBubble: View {
    let message: CoachMessage

    var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isUser { Spacer(minLength: 60) }

            if !isUser {
                ZStack {
                    Circle().fill(ScratchColors.green.opacity(0.2)).frame(width: 28, height: 28)
                    Image(systemName: "figure.golf")
                        .font(.system(size: 12))
                        .foregroundColor(ScratchColors.green)
                }
            }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(ScratchFont.body(15))
                    .foregroundColor(isUser ? .white : ScratchColors.textPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isUser ? ScratchColors.green : ScratchColors.surface2)
                    .cornerRadius(18, corners: isUser ? [.topLeft, .topRight, .bottomLeft] : [.topLeft, .topRight, .bottomRight])

                Text(message.timestamp.shortDisplay)
                    .font(ScratchFont.caption(10))
                    .foregroundColor(ScratchColors.textTertiary)
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }
}

// MARK: - Typing Dots
private struct TypingDots: View {
    @State private var phase = 0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(ScratchColors.textTertiary)
                    .frame(width: 6, height: 6)
                    .scaleEffect(phase == i ? 1.3 : 0.9)
                    .animation(.easeInOut(duration: 0.4).delay(Double(i) * 0.15).repeatForever(), value: phase)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(ScratchColors.surface2)
        .cornerRadius(18)
        .onAppear {
            let timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
                phase = (phase + 1) % 3
            }
            RunLoop.main.add(timer, forMode: .common)
        }
    }
}

// MARK: - Corner Radius Helper
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCornerShape(radius: radius, corners: corners))
    }
}

private struct RoundedCornerShape: Shape {
    var radius: CGFloat
    var corners: UIRectCorner

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
