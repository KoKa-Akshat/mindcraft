import SwiftUI

/// Floating shrine on a soft void — title + optional Gen-Z caption under the art.
struct MalevolentShrineStage: View {
    var showTitle: Bool = true
    var title: String = "The Malevolent Shrine"
    var subtitle: String = ""
    /// When set, the shrine image itself is tappable (Projects → work desk).
    var onShrineTap: (() -> Void)? = nil
    /// True = center the art (Projects screen). Title/caption still render below.
    var centerOnly: Bool = false

    @State private var floating = false

    var body: some View {
        ZStack {
            Color(red: 243 / 255, green: 242 / 255, blue: 247 / 255).ignoresSafeArea()

            GeometryReader { geo in
                let side = min(geo.size.width, geo.size.height) * (centerOnly ? 0.56 : 0.58)
                let artY = geo.size.height * (showTitle || !subtitle.isEmpty ? 0.42 : 0.50)

                VStack(spacing: 0) {
                    Spacer(minLength: 0)

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
                        .accessibilityLabel("The Malevolent Shrine")
                        .accessibilityIdentifier("malevolentShrineTap")
                        .modifier(ShrineTapTraits(enabled: onShrineTap != nil))
                        .onTapGesture {
                            onShrineTap?()
                        }
                        .allowsHitTesting(onShrineTap != nil)

                    if showTitle {
                        Text(title)
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.28, green: 0.06, blue: 0.08))
                            .padding(.top, 18)
                            .accessibilityIdentifier("malevolentShrineTitle")
                    }

                    if !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 17, weight: .semibold, design: .rounded))
                            .foregroundColor(Color.black.opacity(0.55))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                            .padding(.top, showTitle ? 10 : 16)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                            .id(subtitle)
                            .accessibilityIdentifier("malevolentShrineCaption")
                    }

                    Spacer(minLength: geo.size.height * 0.12)
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .position(x: geo.size.width / 2, y: geo.size.height / 2)
                .allowsHitTesting(true)
                // Keep art roughly centered even when caption grows.
                .padding(.bottom, artY > geo.size.height * 0.4 ? 0 : 0)
            }
        }
        .onAppear { floating = true }
        .accessibilityIdentifier("malevolentShrineStage")
    }
}

private struct ShrineTapTraits: ViewModifier {
    var enabled: Bool
    func body(content: Content) -> some View {
        if enabled {
            content.accessibilityAddTraits(.isButton)
        } else {
            content
        }
    }
}
