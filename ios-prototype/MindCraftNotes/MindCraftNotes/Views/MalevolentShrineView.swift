import SwiftUI

/// Floating shrine on a white void — soft-feathered image, no hard rectangle.
struct MalevolentShrineStage: View {
    var showTitle: Bool = false
    var title: String = "The Malevolent Shrine"
    var subtitle: String = ""
    /// When set, the shrine image itself is tappable (Projects → work desk).
    var onShrineTap: (() -> Void)? = nil
    /// True = dead-center the art with no title chrome (Projects screen).
    var centerOnly: Bool = false

    @State private var floating = false

    var body: some View {
        ZStack {
            // Match shrine plate edge so the asset blends (no hard white box).
            Color(red: 243 / 255, green: 242 / 255, blue: 247 / 255).ignoresSafeArea()

            GeometryReader { geo in
                let side = min(geo.size.width, geo.size.height) * (centerOnly ? 0.62 : 0.58)
                Image("MalevolentShrine")
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .frame(width: side, height: side)
                    .shadow(color: .black.opacity(0.10), radius: 20, x: 0, y: floating ? 14 : 8)
                    .offset(y: floating ? -8 : 4)
                    .animation(
                        .easeInOut(duration: 2.6).repeatForever(autoreverses: true),
                        value: floating
                    )
                    .position(x: geo.size.width / 2, y: geo.size.height / 2)
                    .accessibilityAddTraits(onShrineTap == nil ? [] : .isButton)
                    .accessibilityLabel("Malevolent Shrine")
                    .accessibilityIdentifier("malevolentShrineTap")
                    .onTapGesture {
                        onShrineTap?()
                    }
                    .allowsHitTesting(onShrineTap != nil)
            }

            if showTitle && !centerOnly {
                VStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Text(title)
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.28, green: 0.06, blue: 0.08))
                        if !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.system(size: 15, weight: .medium, design: .rounded))
                                .foregroundColor(Color.black.opacity(0.45))
                        }
                    }
                    .padding(.bottom, 36)
                }
                .allowsHitTesting(false)
            }
        }
        .onAppear { floating = true }
        .accessibilityIdentifier("malevolentShrineStage")
    }
}
