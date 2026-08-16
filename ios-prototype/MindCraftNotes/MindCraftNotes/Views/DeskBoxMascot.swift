import SwiftUI

/// Dashboard box mascot — one creature family, three states, five identities.
///
/// State machine (`JESSE_CENTRAL_AI_PLAN.md` Level 2):
/// - **sleeping** — OAuth not granted (Moodle / Gmail / Gcal), or Intel /
///   Binder genuinely empty.
/// - **working** — mid-handshake or mid-fetch (`isBusy`).
/// - **awake** — connected (or, for Intel/Binder, has data) and idle.
///
/// Identity is a second visual axis (accessory + wash), not just state —
/// otherwise five identical sleeping blobs can't be told apart.
///
/// Interaction: OAuth boxes tap-to-connect when sleeping. Intel / Binder
/// mascots are decorative; the tile behind them opens the overlay.
struct DeskBoxMascot: View {
    enum Kind: String {
        case intel, moodle, binder, email, gcal
    }

    enum Phase {
        case sleeping, working, awake
    }

    var kind: Kind
    var phase: Phase
    /// Sleeping OAuth mascots are the connect affordance. False for
    /// Intel/Binder (decorative) and for already-awake OAuth boxes.
    var tappable: Bool = false
    var action: () -> Void = {}

    @State private var bob = false

    var body: some View {
        let art = ZStack {
            creature
            if phase == .sleeping {
                zzz
            }
        }
        .frame(width: 86, height: 78)
        .onAppear {
            if phase == .working {
                bob = true
            }
        }
        .onChange(of: phase) { _, next in
            bob = next == .working
        }
        // Identifier lives on a nested marker, not the root — a parent
        // tile `.accessibilityIdentifier` stomps this view's own root id
        // (same clobber family as DeskGridDashboardView's dock).
        .overlay(alignment: .topLeading) {
            Text(verbatim: "mascot-\(kind.rawValue)")
                .font(.system(size: 1))
                .foregroundColor(.clear)
                .accessibilityIdentifier("deskGridMascot_\(kind.rawValue)")
                .allowsHitTesting(false)
        }

        if tappable {
            Button(action: action) { art }
                .buttonStyle(.plain)
                .accessibilityLabel(accessibilityName)
                .accessibilityHint(phase == .sleeping ? "Connect this box" : "")
        } else {
            art
                .accessibilityLabel(accessibilityName)
                .accessibilityAddTraits(.isImage)
        }
    }

    private var accessibilityName: String {
        let state: String
        switch phase {
        case .sleeping: state = "sleeping"
        case .working: state = "working"
        case .awake: state = "awake"
        }
        return "\(kindTitle) mascot, \(state)"
    }

    private var kindTitle: String {
        switch kind {
        case .intel: return "Intel"
        case .moodle: return "Moodle"
        case .binder: return "Binder"
        case .email: return "Email"
        case .gcal: return "Calendar"
        }
    }

    private var fur: Color {
        switch kind {
        case .intel: return Color(mascotHex: "c4f547")
        case .moodle: return Color(mascotHex: "f4efe3")
        case .binder: return Color(mascotHex: "e8d5b5")
        case .email: return Color(mascotHex: "d7efe0")
        case .gcal: return Color(mascotHex: "8fb89a")
        }
    }

    private var ink: Color {
        switch kind {
        case .intel, .gcal: return Color(mascotHex: "0c1512")
        default: return Color(mascotHex: "143a2e")
        }
    }

    private var creature: some View {
        ZStack {
            // Ears / accessory silhouette
            accessory
            Ellipse()
                .fill(fur)
                .frame(width: 52, height: 46)
                .offset(y: 8)
                .shadow(color: .black.opacity(0.18), radius: 6, y: 3)
            Ellipse()
                .fill(Color.white.opacity(0.35))
                .frame(width: 28, height: 16)
                .offset(x: -4, y: 14)
            eyes
                .offset(y: 6)
            nose
                .offset(y: 16)
        }
        .offset(y: bob ? 3 : 0)
        .animation(bob ? .easeInOut(duration: 0.38).repeatForever(autoreverses: true) : .default, value: bob)
    }

    @ViewBuilder
    private var accessory: some View {
        switch kind {
        case .intel:
            Image(systemName: "sparkle")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(Color(mascotHex: "fff8e9"))
                .offset(x: 22, y: -18)
        case .moodle:
            Image(systemName: "graduationcap.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(Color(mascotHex: "1f3d2e"))
                .offset(y: -20)
        case .binder:
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(Color(mascotHex: "c4a484"))
                .frame(width: 18, height: 10)
                .offset(y: -18)
        case .email:
            Image(systemName: "envelope.fill")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(Color(mascotHex: "247a4d"))
                .offset(x: 22, y: -16)
        case .gcal:
            Image(systemName: "calendar")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(Color(mascotHex: "fff8e9"))
                .offset(x: 22, y: -16)
        }
    }

    @ViewBuilder
    private var eyes: some View {
        HStack(spacing: 12) {
            eye
            eye
        }
    }

    @ViewBuilder
    private var eye: some View {
        switch phase {
        case .sleeping:
            Capsule()
                .fill(ink)
                .frame(width: 10, height: 2)
        case .working:
            Circle()
                .stroke(ink, lineWidth: 1.6)
                .frame(width: 8, height: 8)
                .overlay(
                    Capsule()
                        .fill(ink)
                        .frame(width: 2, height: 5)
                        .rotationEffect(.degrees(bob ? 50 : -20))
                )
        case .awake:
            ZStack(alignment: .topLeading) {
                Circle()
                    .fill(ink)
                    .frame(width: 8, height: 8)
                Circle()
                    .fill(Color.white)
                    .frame(width: 2.5, height: 2.5)
                    .offset(x: 1.5, y: 1.2)
            }
        }
    }

    private var nose: some View {
        Capsule()
            .fill(ink.opacity(phase == .sleeping ? 0.45 : 0.85))
            .frame(width: 8, height: 4)
    }

    private var zzz: some View {
        Text("z")
            .font(.system(size: 11, weight: .heavy, design: .rounded))
            .foregroundColor(ink.opacity(0.45))
            .offset(x: 30, y: -22)
    }
}

private extension Color {
    init(mascotHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
