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

    /// The stage color the shrine PNG's own rectangular backdrop is asked to
    /// disappear into — matches the ZStack background below exactly.
    private static let stageColor = Color(red: 243 / 255, green: 242 / 255, blue: 247 / 255)
    /// A dark tone lifted from the shrine's own palette (matches the title
    /// text color) so the ambient glow reads as light spilling off the
    /// shrine rather than an unrelated decoration.
    private static let emberColor = Color(red: 0.28, green: 0.06, blue: 0.08)

    var body: some View {
        ZStack {
            Self.stageColor.ignoresSafeArea()

            GeometryReader { geo in
                let side = min(geo.size.width, geo.size.height) * (centerOnly ? 0.56 : 0.58)
                let artY = geo.size.height * (showTitle || !subtitle.isEmpty ? 0.42 : 0.50)

                VStack(spacing: 0) {
                    Spacer(minLength: 0)

                    ZStack {
                        // Soft ambient glow grounds the shrine in the scene
                        // and eases the eye from art to flat background
                        // instead of the image's edge reading as a pasted
                        // rectangle (Akshat: blend it in more seamlessly).
                        Ellipse()
                            .fill(
                                RadialGradient(
                                    colors: [Self.emberColor.opacity(0.16), Self.emberColor.opacity(0)],
                                    center: .center, startRadius: 0, endRadius: side * 0.6
                                )
                            )
                            .frame(width: side * 1.25, height: side * 0.8)
                            .blur(radius: 30)
                            .offset(y: side * 0.1)
                            .allowsHitTesting(false)

                        Image("MalevolentShrine")
                            .resizable()
                            .interpolation(.high)
                            .scaledToFit()
                            .frame(width: side, height: side)
                            .overlay(
                                // Feather the PNG's own flat corners into the
                                // stage color — only the empty backdrop past
                                // the shrine's silhouette is touched, tuned
                                // to start well beyond the art itself.
                                RadialGradient(
                                    stops: [
                                        .init(color: Self.stageColor.opacity(0), location: 0.88),
                                        .init(color: Self.stageColor.opacity(0.7), location: 0.97),
                                        .init(color: Self.stageColor, location: 1.0)
                                    ],
                                    center: .center, startRadius: 0, endRadius: side * 0.71
                                )
                                .allowsHitTesting(false)
                            )
                            // Two shadows: a tight contact shadow for weight,
                            // plus a wider tinted one that echoes the ambient
                            // glow instead of a flat black drop-shadow.
                            .shadow(color: .black.opacity(0.14), radius: 14, x: 0, y: floating ? 10 : 5)
                            .shadow(color: Self.emberColor.opacity(0.18), radius: 30, x: 0, y: floating ? 22 : 16)
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
                    }

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
