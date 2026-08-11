import SwiftUI

/// Round 12 - shared chrome for the ACT Field Book practice layout, read
/// from the design brief "Please Bring Back the Owl Mascot but make it a
/// Racoon" (pages 6–11 modular labeled cards on a soft dot-grid field +
/// page 7's ACT rules: question / diagram / graph as separate boxes, no
/// empty media boxes, writing interface with calculator + tutor tools).
enum ActField {
    // Round 14: slightly warmer workspace wash - still paper, more “desk”.
    static let fieldBg = Color(actHex: "F0EBE3")
    static let card = Color(actHex: "FFFDF8")
    static let cardWarm = Color(actHex: "FBF8F4")
    static let label = Color(actHex: "8A8478")
    static let ink = Color(actHex: "1C1A17")
    static let inkDim = Color(actHex: "6F6A61")
    static let edge = Color(actHex: "E5DDD0")
    static let accent = Color(actHex: "3A6B6C")
    static let accentSoft = Color(actHex: "4F8A8B").opacity(0.14)
    static let lime = Color(actHex: "C4F547")
    static let dot = Color(actHex: "665C4E").opacity(0.14)
    static let corner: CGFloat = 20
}

/// Soft field background - the same language as the design PDF's modular
/// boards (pages 6/8/9/10/11): warm wash + faint 18pt dot grid.
struct ActFieldBackground: View {
    var body: some View {
        ZStack {
            ActField.fieldBg
            Canvas { context, size in
                let spacing: CGFloat = 18
                var y: CGFloat = 9
                while y < size.height {
                    var x: CGFloat = 9
                    while x < size.width {
                        context.fill(
                            Path(ellipseIn: CGRect(x: x - 0.7, y: y - 0.7, width: 1.4, height: 1.4)),
                            with: .color(ActField.dot)
                        )
                        x += spacing
                    }
                    y += spacing
                }
            }
            .allowsHitTesting(false)
        }
        .ignoresSafeArea()
    }
}

/// Labeled floating module - lowercase title above a rounded card, matching
/// the design PDF's "Script / Hero / question / diagram" pattern.
struct ActFieldModule<Content: View>: View {
    let title: String
    var fill: Color = ActField.cardWarm
    var minHeight: CGFloat? = nil
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(ActField.label)
                .tracking(0.2)
                .accessibilityAddTraits(.isHeader)
                // Keep the label as its own element - do not combine with
                // the card body or XCUITest loses question/diagram/choice ids.
                .accessibilityElement(children: .ignore)

            content()
                .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
                .background(fill)
                .clipShape(RoundedRectangle(cornerRadius: ActField.corner, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ActField.corner, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.85), lineWidth: 1.5)
                )
                .shadow(color: Color.black.opacity(0.07), radius: 14, x: 0, y: 6)
                .accessibilityElement(children: .contain)
        }
        .accessibilityElement(children: .contain)
    }
}

/// Compact raccoon mascot badge for ACT practice chrome.
struct ActRaccoonBadge: View {
    var size: CGFloat = 44

    var body: some View {
        Group {
            if let image = StickerCatalog.image(for: StickerCatalog.item(id: "raccoon") ?? StickerCatalog.items[0]) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "pawprint.fill")
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundColor(ActField.accent)
            }
        }
        .frame(width: size, height: size)
        .background(
            Circle()
                .fill(ActField.card)
                .shadow(color: Color.black.opacity(0.08), radius: 6, x: 0, y: 2)
        )
        .overlay(Circle().strokeBorder(ActField.lime.opacity(0.85), lineWidth: 2))
        .accessibilityLabel("Raccoon mascot")
        .accessibilityIdentifier("actRaccoonMascot")
    }
}

/// Lightweight in-session calculator - honest tool in the writing strip
/// (design brief: calculator + tutor options on the field).
struct ActFieldCalculatorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var display = "0"
    @State private var stored: Double?
    @State private var pendingOp: String?
    @State private var typingFresh = true

    private let keys: [[String]] = [
        ["C", "±", "%", "÷"],
        ["7", "8", "9", "×"],
        ["4", "5", "6", "−"],
        ["1", "2", "3", "+"],
        ["0", ".", "="],
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text(display)
                    .font(.system(size: 40, weight: .semibold, design: .rounded))
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.horizontal, 8)
                    .accessibilityIdentifier("actCalculatorDisplay")

                ForEach(Array(keys.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 10) {
                        ForEach(row, id: \.self) { key in
                            Button(key) { tap(key) }
                                .font(.system(size: 22, weight: .semibold, design: .rounded))
                                .foregroundColor(opColor(key))
                                .frame(maxWidth: .infinity)
                                .frame(height: 54)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(opFill(key))
                                )
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(20)
            .background(ActField.fieldBg.ignoresSafeArea())
            .navigationTitle("Calculator")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func opColor(_ key: String) -> Color {
        ["÷", "×", "−", "+", "="].contains(key) ? ActField.accent : ActField.ink
    }

    private func opFill(_ key: String) -> Color {
        ["÷", "×", "−", "+", "="].contains(key) ? ActField.accentSoft : ActField.card
    }

    private func tap(_ key: String) {
        switch key {
        case "C":
            display = "0"; stored = nil; pendingOp = nil; typingFresh = true
        case "±":
            if let v = Double(display) { display = format(-v) }
        case "%":
            if let v = Double(display) { display = format(v / 100) }
        case "÷", "×", "−", "+":
            stored = Double(display); pendingOp = key; typingFresh = true
        case "=":
            guard let left = stored, let op = pendingOp, let right = Double(display) else { return }
            let result: Double
            switch op {
            case "÷": result = right == 0 ? 0 : left / right
            case "×": result = left * right
            case "−": result = left - right
            default: result = left + right
            }
            display = format(result); stored = nil; pendingOp = nil; typingFresh = true
        case ".":
            if typingFresh { display = "0."; typingFresh = false }
            else if !display.contains(".") { display += "." }
        default:
            if typingFresh || display == "0" { display = key; typingFresh = false }
            else { display += key }
        }
    }

    private func format(_ value: Double) -> String {
        if value.rounded() == value { return String(Int(value)) }
        return String(format: "%g", value)
    }
}

private extension Color {
    init(actHex hex: String) {
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
