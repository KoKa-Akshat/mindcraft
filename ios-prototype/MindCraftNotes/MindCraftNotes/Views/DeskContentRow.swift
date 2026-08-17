import SwiftUI

/// One content row shared by Work tiles and their matching popups.
/// Intel: tan dot + line + hairline. Email digest: red dot + subject + why.
/// No fixed frame — the parent sizes it. No `.accessibilityIdentifier` on
/// the wrapper (that clobbers nested ids; callers that need a container id
/// put it on their own VStack).
struct DeskContentRow: View {
    var title: String
    var subtitle: String? = nil
    var dot: Color
    var ink: Color
    var muted: Color = Color(deskRowHex: "8a8478")
    var divider: Color = Color(deskRowHex: "d9d2c5").opacity(0.85)
    var showDivider: Bool = true
    var compact: Bool = false

    var body: some View {
        HStack(alignment: subtitle == nil ? .center : .top, spacing: compact ? 8 : 10) {
            Circle()
                .fill(dot)
                .frame(width: 6, height: 6)
                .padding(.top, subtitle == nil ? 0 : (compact ? 5 : 6))
            VStack(alignment: .leading, spacing: compact ? 1 : 2) {
                Text(title)
                    .font(.system(size: compact ? 12 : 14, weight: compact ? .bold : .semibold, design: .rounded))
                    .foregroundColor(ink)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(muted)
                        .lineLimit(2)
                }
            }
        }
        .padding(.vertical, compact ? 5 : 7)
        .overlay(alignment: .bottom) {
            if showDivider {
                Rectangle()
                    .fill(divider)
                    .frame(height: 1)
                    .padding(.leading, 16)
            }
        }
    }
}

private extension Color {
    init(deskRowHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
