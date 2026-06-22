import SwiftUI

// MARK: - Primary Button
struct PrimaryButton: View {
    let title: String
    var icon: String? = nil
    var style: ButtonStyle = .green
    var isLoading: Bool = false
    let action: () -> Void

    enum ButtonStyle { case green, gold, outline }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: style == .gold ? .black : .white))
                        .scaleEffect(0.8)
                } else {
                    if let icon { Image(systemName: icon) }
                    Text(title)
                        .font(ScratchFont.headline())
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: ScratchLayout.buttonHeight)
            .background(background)
            .foregroundColor(style == .gold ? .black : .white)
            .cornerRadius(ScratchLayout.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: ScratchLayout.cornerRadius)
                    .stroke(ScratchColors.border, lineWidth: style == .outline ? 1 : 0)
            )
        }
        .disabled(isLoading)
    }

    @ViewBuilder
    private var background: some View {
        switch style {
        case .green:   ScratchColors.green
        case .gold:    ScratchColors.goldGradient
        case .outline: Color.clear
        }
    }
}

// MARK: - Section Header
struct SectionHeader: View {
    let title: String
    var subtitle: String? = nil
    var action: (() -> Void)? = nil
    var actionLabel: String = "See All"

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(ScratchFont.headline()).foregroundColor(ScratchColors.textPrimary)
                if let sub = subtitle {
                    Text(sub).font(ScratchFont.caption()).foregroundColor(ScratchColors.textSecondary)
                }
            }
            Spacer()
            if let action {
                Button(actionLabel, action: action)
                    .font(ScratchFont.caption())
                    .foregroundColor(ScratchColors.green)
            }
        }
    }
}

// MARK: - Stat Chip
struct StatChip: View {
    let label: String
    let value: String
    var accent: Color = ScratchColors.textPrimary
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(ScratchFont.number(28))
                .foregroundColor(accent)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(ScratchFont.caption(11))
                .foregroundColor(ScratchColors.textSecondary)
                .lineLimit(1)
            if let sub = subtitle {
                Text(sub).font(ScratchFont.caption(10)).foregroundColor(ScratchColors.textTertiary)
            }
        }
        .padding(ScratchLayout.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ScratchColors.surface2)
        .cornerRadius(ScratchLayout.cardRadius)
    }
}

// MARK: - Progress Ring
struct ProgressRing: View {
    let progress: Double   // 0–100
    var size: CGFloat = 80
    var lineWidth: CGFloat = 7
    var color: Color = ScratchColors.green
    var label: String? = nil

    private var fraction: Double { min(1, max(0, progress / 100)) }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.2), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.8), value: progress)
            if let label {
                Text(label)
                    .font(ScratchFont.caption(10))
                    .foregroundColor(ScratchColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Badge
struct ConfidenceBadge: View {
    let confidence: AnalysisConfidence

    var color: Color {
        switch confidence {
        case .low:    return ScratchColors.warning
        case .medium: return ScratchColors.gold
        case .high:   return ScratchColors.success
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text("\(confidence.rawValue) confidence")
                .font(ScratchFont.caption(11))
                .foregroundColor(color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.15))
        .cornerRadius(20)
    }
}

// MARK: - Empty State
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48, weight: .light))
                .foregroundColor(ScratchColors.textTertiary)
            Text(title)
                .font(ScratchFont.headline())
                .foregroundColor(ScratchColors.textPrimary)
            Text(message)
                .font(ScratchFont.body())
                .foregroundColor(ScratchColors.textSecondary)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                PrimaryButton(title: actionTitle, action: action)
                    .frame(maxWidth: 220)
            }
        }
        .padding(ScratchLayout.screenPadding)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Pro Badge
struct ProBadge: View {
    var body: some View {
        Text("PRO")
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.black)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(ScratchColors.goldGradient)
            .cornerRadius(4)
    }
}

// MARK: - Divider
struct ScratchDivider: View {
    var body: some View {
        Rectangle()
            .fill(ScratchColors.border)
            .frame(height: 1)
    }
}

// MARK: - Loading Overlay
struct LoadingOverlay: View {
    let message: String

    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: ScratchColors.green))
                    .scaleEffect(1.4)
                Text(message)
                    .font(ScratchFont.subheadline())
                    .foregroundColor(.white)
            }
            .padding(32)
            .background(ScratchColors.surface)
            .cornerRadius(ScratchLayout.cardRadius)
        }
    }
}
