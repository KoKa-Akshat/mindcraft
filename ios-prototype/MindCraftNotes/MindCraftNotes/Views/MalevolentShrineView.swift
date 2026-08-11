import SwiftUI

/// Floating shrine on a white void — soft-feathered image, no hard rectangle.
struct MalevolentShrineStage: View {
    var showTitle: Bool = false
    var title: String = "The Malevolent Shrine"
    var subtitle: String = ""

    @State private var floating = false

    var body: some View {
        ZStack {
            // Match shrine plate edge so the asset blends (no hard white box).
            Color(red: 243 / 255, green: 242 / 255, blue: 247 / 255).ignoresSafeArea()

            Image("MalevolentShrine")
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(maxWidth: 520)
                .shadow(color: .black.opacity(0.10), radius: 20, x: 0, y: floating ? 16 : 8)
                .offset(y: floating ? -10 : 6)
                .animation(
                    .easeInOut(duration: 2.6).repeatForever(autoreverses: true),
                    value: floating
                )
                .padding(.horizontal, 40)
                .allowsHitTesting(false)

            if showTitle {
                VStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Text(title)
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.28, green: 0.06, blue: 0.08))
                        Text(subtitle)
                            .font(.system(size: 15, weight: .medium, design: .rounded))
                            .foregroundColor(Color.black.opacity(0.45))
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
