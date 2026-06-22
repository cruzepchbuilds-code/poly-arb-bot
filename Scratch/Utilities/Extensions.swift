import SwiftUI

// MARK: - Color from Hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 255, 255, 255)
        }
        self.init(.sRGB,
                  red: Double(r) / 255,
                  green: Double(g) / 255,
                  blue: Double(b) / 255,
                  opacity: Double(a) / 255)
    }
}

// MARK: - Double Formatting
extension Double {
    var handicapDisplay: String {
        if self == 0 { return "Scratch" }
        if self == self.rounded() { return "\(Int(self))" }
        return String(format: "%.1f", self)
    }

    var percentDisplay: String {
        String(format: "%.0f%%", min(100, max(0, self)))
    }
}

// MARK: - Date Helpers
extension Date {
    var shortDisplay: String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f.string(from: self)
    }

    var monthYear: String {
        let f = DateFormatter()
        f.dateFormat = "MMM yyyy"
        return f.string(from: self)
    }

    var dayMonth: String {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f.string(from: self)
    }

    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    var isThisWeek: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .weekOfYear)
    }

    static var startOfCurrentWeek: Date {
        Calendar.current.date(
            from: Calendar.current.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())
        ) ?? Date()
    }
}

// MARK: - View Modifiers
extension View {
    func scratchCard(padding: CGFloat = ScratchLayout.cardPadding) -> some View {
        self
            .padding(padding)
            .background(ScratchColors.surface)
            .cornerRadius(ScratchLayout.cardRadius)
    }

    func scratchCard2(padding: CGFloat = ScratchLayout.cardPadding) -> some View {
        self
            .padding(padding)
            .background(ScratchColors.surface2)
            .cornerRadius(ScratchLayout.cardRadius)
    }

    func glowEffect(color: Color = ScratchColors.green, radius: CGFloat = 12) -> some View {
        self.shadow(color: color.opacity(0.35), radius: radius, x: 0, y: 4)
    }

    func goldGlow() -> some View {
        self.shadow(color: ScratchColors.gold.opacity(0.4), radius: 10, x: 0, y: 4)
    }

    func primaryButton() -> some View {
        self
            .frame(maxWidth: .infinity)
            .frame(height: ScratchLayout.buttonHeight)
            .background(ScratchColors.green)
            .cornerRadius(ScratchLayout.cornerRadius)
            .font(ScratchFont.headline())
            .foregroundColor(.white)
    }

    func goldButton() -> some View {
        self
            .frame(maxWidth: .infinity)
            .frame(height: ScratchLayout.buttonHeight)
            .background(ScratchColors.goldGradient)
            .cornerRadius(ScratchLayout.cornerRadius)
            .font(ScratchFont.headline())
            .foregroundColor(.black)
    }
}

// MARK: - Array Safety
extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
