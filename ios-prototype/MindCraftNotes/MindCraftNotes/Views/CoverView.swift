import SwiftUI

/// Real notebook cover - center card only, verified against the real
/// `CoverLanding.tsx` + `CoverLanding.module.css` colors/typography
/// (2026-08-06).
///
/// Round 5 built this as a full "world map" (8 scattered floating subject
/// pills + the center card), matching `CoverLanding.tsx` literally. Akshat's
/// next-session note SUPERSEDES that specific structural choice (not the
/// color/type verification underneath it): a new pre-login `WelcomeView`
/// now carries the "introduce the MindCraft world" job ahead of sign-in, so
/// this per-session in-app cover goes back to being just the clean center
/// card - no floating "Writing"/"Violin"/"Fashion"/"Law"/"Coding"/
/// "Photography"/"Spanish" pills. Kept: the verified Deep Field background,
/// wordmark colors, name field, equipped-sticker corner slots (a different
/// feature - decorating YOUR cover with stickers you own, not world-intro
/// atmosphere), and the Stickers/Find-a-Tutor top actions.
enum CoverSession {
    private static var seen = false
    static var alreadySeen: Bool { seen }
    static func markSeen() { seen = true }
}

struct CoverView: View {
    let accountName: String
    let onOpen: () -> Void
    /// Cover's "Find a Tutor" pill navigates away entirely (web:
    /// `navigate('/find-a-tutor')`), not into the notebook - separate from
    /// `onOpen` so the caller can present the right destination.
    var onFindTutor: (() -> Void)? = nil
    @ObservedObject var stickerStore: StickerStore

    @State private var name: String = ""
    @State private var closing = false
    @State private var shelfOpen = false
    @State private var appeared = false

    /// Shared weighted-ease timing across the entry flow — matches the
    /// brand's `--ease-weight` curve (`DASHBOARD_NOTEBOOK_SPEC.md` §12):
    /// fast start, long settle, zero bounce. "Weight over bounce" applies
    /// to every transition in Desk OS, not just the paper notebook system.
    private let weightedEase = Animation.timingCurve(0.2, 0, 0, 1, duration: 0.32)

    var body: some View {
        GeometryReader { geo in
            ZStack {
                CoverBackground()

                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.clear)
                    .background(coverBoxBackground)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .strokeBorder(Color(coverHex: "f5f5f5").opacity(0.11), lineWidth: 1)
                    )
                    .overlay(washDots)
                    .overlay(equipField(in: geo.size))
                    .overlay(coverFace)
                    .overlay(topActions, alignment: .topTrailing)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .shadow(color: .black.opacity(0.34), radius: 35, x: 0, y: 12)
                    .padding(8)
                    .opacity(closing ? 0 : (appeared ? 1 : 0))
                    .scaleEffect(closing ? 0.99 : (appeared ? 1 : 0.99))
            }
        }
        .onAppear {
            if name.isEmpty { name = accountName.trimmingCharacters(in: .whitespaces) }
            withAnimation(weightedEase) { appeared = true }
        }
        .sheet(isPresented: $shelfOpen) {
            StickersShelfView(mode: .equip, store: stickerStore) { shelfOpen = false }
        }
    }

    // MARK: - Layers

    private var coverBoxBackground: some View {
        ZStack {
            Color(coverHex: "080e14")
            RadialGradient(
                colors: [Color(coverHex: "1d3a8a").opacity(0.3), .clear],
                center: .center, startRadius: 0, endRadius: 420
            )
            RadialGradient(
                colors: [Color(coverHex: "c4f547").opacity(0.08), .clear],
                center: UnitPoint(x: 0.5, y: 0.52), startRadius: 0, endRadius: 300
            )
        }
    }

    private var washDots: some View {
        GeometryReader { geo in
            ZStack {
                Circle()
                    .fill(Color(coverHex: "c4f547").opacity(0.12))
                    .frame(width: 5, height: 5)
                    .position(x: geo.size.width * 0.12, y: geo.size.height * 0.26)
                Circle()
                    .fill(Color(coverHex: "c4f547").opacity(0.16))
                    .frame(width: 5, height: 5)
                    .position(x: geo.size.width * 0.87, y: geo.size.height * 0.71)
            }
        }
        .allowsHitTesting(false)
    }

    private func equipField(in size: CGSize) -> some View {
        let slots: [UnitPoint] = [
            UnitPoint(x: 0.22, y: 0.22),
            UnitPoint(x: 0.78, y: 0.20),
            UnitPoint(x: 0.18, y: 0.78),
            UnitPoint(x: 0.84, y: 0.80),
        ]
        return ZStack {
            ForEach(Array(stickerStore.equippedIds.enumerated()), id: \.element) { index, id in
                if let item = StickerCatalog.item(id: id), index < slots.count {
                    equippedStickerView(item)
                        .position(x: size.width * slots[index].x, y: size.height * slots[index].y)
                }
            }
        }
    }

    private func equippedStickerView(_ item: StickerItem) -> some View {
        ZStack(alignment: .topTrailing) {
            RotatableStickerView(image: StickerCatalog.image(for: item), size: 88)
            Button {
                withAnimation(.easeOut(duration: 0.15)) { stickerStore.removeEquipped(item.id) }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Color(coverHex: "fffdf7"))
                    .frame(width: 22, height: 22)
                    .background(Circle().fill(Color(coverHex: "080e14").opacity(0.72)))
            }
            .offset(x: 4, y: -4)
        }
    }

    private var topActions: some View {
        HStack(spacing: 10) {
            Button {
                shelfOpen = true
            } label: {
                HStack(spacing: 7) {
                    if let icon = StickerCatalog.image(for: StickerCatalog.item(id: "raccoon") ?? StickerCatalog.items[0]) {
                        Image(uiImage: icon).resizable().aspectRatio(contentMode: .fit).frame(width: 26, height: 26)
                    }
                    Text("STICKERS")
                }
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .tracking(1)
                .foregroundColor(Color(coverHex: "fffdf7"))
                .padding(.horizontal, 14)
                .frame(minHeight: 42)
                .background(
                    Capsule()
                        .fill(Color(coverHex: "080e14").opacity(0.72))
                        .overlay(Capsule().strokeBorder(Color(coverHex: "f5f5f5").opacity(0.28), lineWidth: 1.5))
                )
            }
            .buttonStyle(DeskPressStyle())

            Button {
                CoverSession.markSeen()
                onFindTutor?()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 13, weight: .bold))
                    Text("FIND A TUTOR")
                }
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .tracking(1)
                .foregroundColor(Color(coverHex: "fffdf7"))
                .padding(.horizontal, 16)
                .frame(minHeight: 42)
                .background(
                    Capsule()
                        .fill(Color(coverHex: "247a4d"))
                        .overlay(Capsule().strokeBorder(Color(coverHex: "143a2e"), lineWidth: 1.5))
                        .shadow(color: Color(coverHex: "143a2e").opacity(0.3), radius: 14, x: 0, y: 6)
                )
            }
            .buttonStyle(DeskPressStyle())
        }
        .padding(.top, 20)
        .padding(.trailing, 20)
    }

    private var coverFace: some View {
        VStack(spacing: 10) {
            Text("STUDY · CREATE · EXPLORE")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(3)
                .foregroundColor(Color(coverHex: "c4f547").opacity(0.72))

            Button(action: open) {
                VStack(spacing: 6) {
                    Text("The Desk")
                        .font(.system(size: 52, weight: .bold, design: .rounded))
                        .tracking(-1.2)
                        .foregroundColor(Color(coverHex: "f5f5f5"))
                    Text("by MindCraft")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(coverHex: "f5f5f5").opacity(0.68))
                        .tracking(0.5)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open The Desk")

            // "What should we call you?" was set in the editorial serif -
            // the Katha storyteller voice per Brand Book §9 ("when the
            // serif appears, the reader knows the storyteller is
            // speaking"). This is plain UI microcopy, not story content,
            // so it now uses the same humanist rounded voice as the rest
            // of the screen - keeps the two registers from bleeding
            // together.
            VStack(spacing: 10) {
                Text("What should we call you?")
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .foregroundColor(Color(coverHex: "f5f5f5").opacity(0.62))

                HStack(spacing: 10) {
                    TextField("Your name", text: $name)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(Color(coverHex: "080e14"))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color(coverHex: "f5f5f5").opacity(0.97))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .strokeBorder(Color(coverHex: "f5f5f5").opacity(0.28), lineWidth: 1.5)
                                )
                        )
                        .onSubmit(open)

                    Button(action: open) {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(Color(coverHex: "080e14"))
                            .frame(width: 48, height: 48)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color(coverHex: "c4f547"))
                                    .shadow(color: Color(coverHex: "c4f547").opacity(0.2), radius: 12, x: 0, y: 6)
                            )
                    }
                    .buttonStyle(DeskPressStyle())
                    .accessibilityIdentifier("coverOpenArrow")
                    .accessibilityLabel(name.trimmingCharacters(in: .whitespaces).isEmpty ? "Open The Desk" : "Open The Desk as \(name.trimmingCharacters(in: .whitespaces))")
                }
            }
            .frame(maxWidth: 320)
            .padding(.top, 10)
        }
        .padding(24)
        .background(
            // Was `.ultraThinMaterial` layered over a translucent fill -
            // two dark, near-identical surfaces stacked with a blur
            // between them read as visual noise more than depth, and
            // frosted glass sits against the brand's "shadow, not glow"
            // doctrine. A deliberate solid card in the cover-object tone
            // (one step lighter than Deep Field, same relationship the
            // notebook spec uses for `--cover-object`) with a near+far
            // shadow pair reads calmer and sharper.
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(coverHex: "0b1119"))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Color(coverHex: "f5f5f5").opacity(0.12), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.30), radius: 30, x: 0, y: 16)
                .shadow(color: .black.opacity(0.16), radius: 8, x: 0, y: 3)
        )
        .frame(maxWidth: 440)
    }

    private func open() {
        guard !closing else { return }
        withAnimation(weightedEase) { closing = true }
        CoverSession.markSeen()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            onOpen()
        }
    }
}

/// Tactile press feedback for the entry flow's primary actions - a fast,
/// weighted compress-and-release (no overshoot) rather than the default
/// plain-button no-op or an iOS bounce. "Weight over bounce" (Brand Book
/// §9) applied to touch feedback, not just full-screen transitions.
private struct DeskPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// Phase 5 (2026-08-06): colors verified against the live
// `CoverLanding.module.css` - `.page`/`.cover` base is `#080e14` (Deep
// Field, same motif `ConceptChapterView`'s outer background uses), wordmark
// "Mind" is near-white `#f5f5f5`, "Craft" is GOLD `#f5d348` (`.wordmarkCraft`
// - genuinely distinct from the lime `#c4f547` used on the CTA arrow
// elsewhere on this same screen, verified side-by-side in the CSS, not
// assumed to be the same green).
private extension Color {
    init(coverHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

private struct CoverBackground: View {
    var body: some View {
        Color(coverHex: "080e14")
            .ignoresSafeArea()
    }
}
