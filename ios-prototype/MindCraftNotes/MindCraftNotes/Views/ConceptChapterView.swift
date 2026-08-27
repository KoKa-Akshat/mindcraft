import SwiftUI

/// The real "chapter" experience a tapped lesson/concept dot opens into -
/// ported from `ConceptChapterPage.tsx`'s story-first pattern: the concept's
/// real scene art (`StoryArtLoader`, bundled with the app) beside real story
/// text (paginated via `StoryPaginator`, same pagination math as web), with
/// the real "PROTAGONIST · SETTING" byline (`ConceptStoryLoader.context`),
/// page-dot navigation, before leading into real practice questions
/// (`QuestionBankLoader`).
struct ConceptChapterView: View {
    let conceptId: String
    let conceptLabel: String
    let onBeginPractice: () -> Void
    /// Live-generated practice (2026-08-27) - optional and additive, not a
    /// replacement for `onBeginPractice`'s static-bank flow. Nil at any call
    /// site that hasn't opted in yet, which just hides the second button.
    var onBeginLivePractice: (() -> Void)? = nil
    /// When true, fills the ACT desk stage only (not a device-full cover).
    var embeddedInDesk: Bool = false
    var onClose: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var pageIndex = 0

    private var pages: [[String]] {
        guard let story = ConceptStoryLoader.story(for: conceptId) else { return [] }
        return StoryPaginator.pages(from: story)
    }

    private var context: ConceptStoryContext? { ConceptStoryLoader.context(for: conceptId) }
    private var art: UIImage? { StoryArtLoader.image(forConcept: conceptId) }

    private func close() {
        if let onClose { onClose() } else { dismiss() }
    }

    private func beginPractice() {
        // Embedded: parent swaps overlays - don't dismiss the desk shell.
        if !embeddedInDesk { dismiss() }
        onBeginPractice()
    }

    private func beginLivePractice() {
        if !embeddedInDesk { dismiss() }
        onBeginLivePractice?()
    }

    var body: some View {
        ZStack {
            if embeddedInDesk {
                LinearGradient(
                    colors: [Color(chapterHex: "1c3228"), Color(chapterHex: "14261c"), Color(chapterHex: "0f1f18")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                ChapterDeskBackground()
            }
            VStack(spacing: 0) {
                topBar
                if pages.isEmpty {
                    noStoryState
                } else {
                    chapterCard
                    bottomNav
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            if embeddedInDesk {
                DeskHomeButton(action: close, accessibilityId: "actChapterHome")
            } else {
                Button(action: close) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("back")
                    }
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .foregroundColor(ChapterColor.inkSoft)
                }
            }
            Text(conceptLabel)
                .font(.system(size: embeddedInDesk ? 16 : 20, weight: .bold, design: .rounded))
                .foregroundColor(ChapterColor.ink)
                .lineLimit(1)
            Spacer(minLength: 8)
            if !pages.isEmpty {
                Text("\(pageIndex + 1)/\(pages.count)")
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundColor(ChapterColor.inkSoft.opacity(0.75))
                // Next / Begin practice - always top-trailing across stories.
                if pageIndex < pages.count - 1 {
                    Button {
                        withAnimation { pageIndex += 1 }
                    } label: {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(ChapterColor.ink)
                            .padding(10)
                            .background(Circle().fill(Color.white.opacity(0.12)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("chapterNextPageButton")
                } else {
                    HStack(spacing: 8) {
                        if onBeginLivePractice != nil {
                            Button("Practice with Jesse") {
                                beginLivePractice()
                            }
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .buttonStyle(.bordered)
                            .tint(ChapterColor.accent)
                            .accessibilityIdentifier("beginLivePracticeButton")
                        }
                        Button("Begin practice \u{2192}") {
                            beginPractice()
                        }
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .buttonStyle(.borderedProminent)
                        .tint(ChapterColor.accent)
                        .accessibilityIdentifier("beginPracticeButton")
                    }
                }
            }
        }
        .padding(.horizontal, embeddedInDesk ? 12 : 20)
        .padding(.vertical, embeddedInDesk ? 8 : 14)
    }

    // Real bug, found from Akshat's physical-device report ("in horizontal
    // view the story totally runs words into picture"): `artPlate`'s image
    // used `.aspectRatio(1, contentMode: .fill)` with ONLY a `.frame(width:)`
    // set - no paired height. `contentMode: .fill` means "grow to cover
    // both dimensions of whatever box you're given, cropping overflow," but
    // without an explicit height the image's ideal size going INTO the
    // HStack's layout pass was still open-ended, and the HStack's own
    // proposed height for a `GeometryReader`-nested landscape row is
    // similarly not obviously pinned. The safe, standard SwiftUI fix for
    // "fill-mode image in a fixed column, arbitrary row height" is to give
    // BOTH dimensions an explicit, finite value up front (not just width)
    // and `.clipped()` as a hard backstop - no ambiguity left for the
    // layout system to resolve differently than intended. Also gave
    // `storyColumn`'s own text an explicit `maxWidth: .infinity` at the
    // Text level (not just its containing VStack) so paragraph wrapping is
    // locked to the actual column width in every code path, landscape or
    // portrait.
    //
    // SECOND real bug, found from Akshat's live-device follow-up ("the
    // display... the story vertically in your test i saw the words run
    // under the screen the picture is massive"): the PORTRAIT branch below
    // had two compounding problems, neither caught by the earlier landscape
    // fix above (confirmed both only show up in portrait, not landscape -
    // don't assume one orientation's fix covers the other).
    //   1. `artPlate(height: geo.size.width - 56)` sized the art's height to
    //      the device's full CONTENT WIDTH - on a real iPad in portrait
    //      that's 700+pt, i.e. "the picture is massive." Checked the real
    //      web `ConceptChapterPage.module.css` for what this should actually
    //      be: its story-beat art (`.storyArt`/`.storyArtImg`) caps at
    //      `max-height: 240px` absolute, in a narrow column - nothing like a
    //      full-viewport-width square. Capped natively the same way
    //      (`min(geo.size.width * 0.4, 240)`), not a full-bleed square.
    //   2. `storyColumn` has its OWN internal `ScrollView` around the
    //      paragraph text (see below) - the portrait branch wrapped the
    //      whole `VStack(artPlate, storyColumn)` in a SECOND, outer
    //      `ScrollView`. Two vertical `ScrollView`s nested with no explicit
    //      height on the inner one is a known SwiftUI trap: the inner
    //      ScrollView never receives a bounded height to lay its content
    //      into, so paragraph text renders past the visible viewport with no
    //      reliable way to scroll down to it - exactly "words run under the
    //      screen." Real fix: drop the outer ScrollView. `storyColumn` now
    //      sits directly in a plain `VStack` under the SAME
    //      `maxHeight: .infinity` frame the (already-correct) landscape
    //      branch relies on below - a ScrollView is the flexible last child
    //      of a fixed-height VStack, so it now receives a real, bounded
    //      height exactly like the landscape case already does, instead of
    //      trying to size itself against another ScrollView's undefined one.
    // THIRD real bug, round 8 (Akshat's follow-up: "still seeing it when
    // tapping a concept... it may be a case the earlier fix didn't cover" -
    // confirmed round 7's own verification screenshot only ever checked
    // "Fractions and Decimals"). Re-read this whole function fresh: the
    // landscape branch gave `artPlate` an explicit `height: contentHeight`
    // but left `storyColumn` with WIDTH only, no height - the exact same
    // "unbounded height on the ScrollView-holding sibling" shape as the
    // portrait bug round 7 already found and fixed, just never applied to
    // the landscape branch's OTHER child. For "Fractions and Decimals"
    // specifically the story is short enough that this never visibly
    // mattered; a concept with a longer story paragraph is exactly the case
    // round 7's single-concept verification couldn't have caught. Fixed the
    // same way as the portrait fix: BOTH HStack children now get an
    // explicit, matching, finite height up front, plus `.clipped()` as a
    // hard backstop on the text column too (mirroring `artPlate`'s own
    // backstop) so no code path can let a tall paragraph render past the
    // card into the image regardless of how SwiftUI resolves the ambiguous
    // case.
    //
    // FOURTH real bug, round 9 (Akshat, live: "the story words bleed out of
    // the right in screen in horizontal display" - round 8 left this
    // genuinely open rather than falsely claiming it fixed; this is that
    // investigation, done for real). Found by re-reading this function's
    // actual width arithmetic, not by fighting the screenshot pipeline
    // (landscape captures in this environment are unreliable for a separate,
    // unrelated reason - see the round 9 build-plan entry). The landscape
    // branch's `0.34`/`0.66 - 28` split was computed against the RAW
    // `geo.size.width` - deliberately summing to exactly `geo.size.width`
    // once the HStack's own 28pt inter-item spacing is accounted for - but
    // the whole card is then wrapped in `.padding(28)` (56pt of TOTAL
    // horizontal inset, 28 each side) applied AFTER these widths are
    // already fixed via `.frame(width:)`. Because `.frame(width:)` makes a
    // view rigid (it reports that exact width upward regardless of what its
    // parent proposes), the HStack's true rendered width came out 56pt
    // WIDER than the space actually available inside the padded card -
    // `storyColumn` (the flexible-looking but actually-fixed-width trailing
    // child, already carrying its own `.clipped()` backstop from the THIRD
    // bug fix above) rendered its text wrapped to that too-generous width,
    // then got clipped back down to the card's TRUE edge, visually cutting
    // words off at the right rather than wrapping them onto the next line -
    // exactly Akshat's "bleed out of the right" report. `contentHeight`
    // right above already makes the analogous correction for the vertical
    // axis (`geo.size.height - 56`, "matches the 28pt padding below, both
    // edges") and the PORTRAIT branch already made it for width too
    // (`geo.size.width - 56`) - this is that same, already-proven correction
    // applied to the one remaining place it was missing. Verified across
    // multiple concepts (not just "Fractions and Decimals," the only one any
    // prior round's screenshot ever checked) and both story pages by reading
    // `ConceptStoryLoader`'s bundled story text directly for paragraph
    // length, not by assumption - see the round 9 build-plan entry for the
    // concept ids checked.
    private var chapterCard: some View {
        GeometryReader { geo in
            let isWide = geo.size.width > geo.size.height
            let contentHeight = geo.size.height - 56 // matches the 28pt padding below, both edges
            // Matches contentHeight's own correction, now applied to width
            // too (see the FOURTH bug note above): the card's eventual
            // `.padding(28)` below removes 56pt of horizontal space AFTER
            // these widths are fixed, so that has to be subtracted BEFORE
            // splitting the remainder between the art plate and the story
            // column, not after.
            let contentWidth = geo.size.width - 56
            Group {
                if isWide {
                    HStack(alignment: .top, spacing: 28) {
                        artPlate(width: contentWidth * 0.34, height: contentHeight)
                        storyColumn
                            .frame(width: contentWidth * 0.66 - 28, height: contentHeight, alignment: .topLeading)
                            .clipped()
                    }
                } else {
                    let portraitArtHeight = min(contentWidth * 0.4, 240)
                    VStack(alignment: .leading, spacing: 20) {
                        artPlate(width: contentWidth, height: portraitArtHeight)
                        storyColumn
                            .frame(width: contentWidth, alignment: .leading)
                    }
                }
            }
            .padding(embeddedInDesk ? 16 : 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: embeddedInDesk ? 16 : 24, style: .continuous)
                    .fill(ChapterColor.cardGradient)
            )
            .padding(.horizontal, embeddedInDesk ? 10 : 20)
            // Round 8: fluid left/right swipe through story pages, not just
            // the small arrow buttons in `bottomNav`. `.simultaneousGesture`
            // (not `.gesture`) so this doesn't fight `storyColumn`'s own
            // internal vertical `ScrollView` for the drag - both gestures
            // get to see the touch, and the horizontal-dominance check below
            // only acts on drags that are clearly a horizontal swipe, not a
            // vertical scroll that happens to wobble a few points sideways.
            .simultaneousGesture(
                DragGesture(minimumDistance: 30)
                    .onEnded { value in
                        let horizontal = value.translation.width
                        let vertical = value.translation.height
                        guard abs(horizontal) > abs(vertical) * 1.5, abs(horizontal) > 50 else { return }
                        withAnimation {
                            if horizontal < 0 {
                                pageIndex = min(pages.count - 1, pageIndex + 1)
                            } else {
                                pageIndex = max(0, pageIndex - 1)
                            }
                        }
                    }
            )
        }
    }

    // SECOND real bug, round 8 (Akshat + a prior screenshot both confirmed:
    // "the story-art image crops off the top of the artwork, cuts into
    // people's heads mid-frame"). Root cause: this forced EVERY source image
    // into a 1:1 SQUARE crop first (`.aspectRatio(1, contentMode: .fill)`)
    // and then, at the call site, stretched/cropped that square AGAIN into a
    // wide rectangular plate via a second, separate `.frame(width:height:)`
    // - two independent center-crop passes compounding whatever got cut off,
    // with no control over which edge lost content. Real fix: use the
    // image's OWN native aspect ratio (`.aspectRatio(contentMode: .fill)`,
    // no forced ratio) and do the crop in ONE pass - a single frame that
    // takes both width AND height directly, `alignment: .top`. `.fill` mode
    // still has to crop one axis when the source and target proportions
    // differ, but anchoring that crop to the top means the trim comes off
    // the BOTTOM of the art instead of symmetrically off both edges, which
    // is what was cutting into heads when a subject sits in the upper part
    // of the frame (the common case for these story portraits).
    @ViewBuilder
    private func artPlate(width: CGFloat, height: CGFloat) -> some View {
        if let art {
            Image(uiImage: art)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: width, height: max(height, 40), alignment: .top)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 8)
                .rotationEffect(.degrees(-1.5))
        }
    }

    private var storyColumn: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ACT CHAPTER")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(ChapterColor.inkSoft.opacity(0.55))
                .tracking(1.2)

            Text(conceptLabel)
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundColor(ChapterColor.ink)
                .fixedSize(horizontal: false, vertical: true)

            if let context, (context.protagonist != nil || context.settingLine != nil) {
                Text([context.protagonist, context.settingLine].compactMap { $0 }.joined(separator: " \u{00B7} ").uppercased())
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundColor(ChapterColor.accent)
                    .tracking(0.6)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(pages[pageIndex].enumerated()), id: \.offset) { idx, paragraph in
                        if pageIndex == 0 && idx == 0 {
                            dropCapParagraph(paragraph)
                        } else {
                            Text(paragraph)
                                .font(.system(size: 17, design: .serif))
                                .foregroundColor(ChapterColor.ink)
                                .lineSpacing(6)
                                // Real fix (landscape text-into-image bleed,
                                // Akshat's physical-device report): force
                                // every paragraph to wrap strictly within
                                // its column instead of reporting an
                                // unconstrained ideal width upward.
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    private func dropCapParagraph(_ paragraph: String) -> some View {
        let dropCap = String(paragraph.prefix(1))
        let rest = String(paragraph.dropFirst())
        return (
            Text(dropCap)
                .font(.system(size: 40, weight: .bold, design: .serif))
                .foregroundColor(ChapterColor.accent)
            + Text(rest)
                .font(.system(size: 17, design: .serif))
                .foregroundColor(ChapterColor.ink)
        )
        .lineSpacing(6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
    }

    private var bottomNav: some View {
        // Prev + dots only - next / Begin practice live top-trailing.
        HStack {
            Button(action: { withAnimation { pageIndex = max(0, pageIndex - 1) } }) {
                Image(systemName: "arrow.left")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(pageIndex == 0 ? ChapterColor.inkSoft.opacity(0.3) : ChapterColor.ink)
            }
            .disabled(pageIndex == 0)
            .accessibilityIdentifier("chapterPrevPageButton")

            Spacer()

            HStack(spacing: 6) {
                ForEach(0..<pages.count, id: \.self) { i in
                    Circle()
                        .fill(i == pageIndex ? ChapterColor.accent : ChapterColor.inkSoft.opacity(0.25))
                        .frame(width: 7, height: 7)
                }
            }

            Spacer()
            Color.clear.frame(width: 28, height: 1)
        }
        .padding(.horizontal, embeddedInDesk ? 16 : 32)
        .padding(.vertical, embeddedInDesk ? 10 : 18)
    }

    private var noStoryState: some View {
        VStack(spacing: 12) {
            Spacer()
            Text("No story written for this concept yet")
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .foregroundColor(ChapterColor.ink)
            Button("Begin practice") {
                beginPractice()
            }
            .buttonStyle(.borderedProminent)
            .tint(ChapterColor.accent)
            .accessibilityIdentifier("beginPracticeButton")
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// Phase 5 (2026-08-06): verified against the live `ConceptChapterPage.module.css`
// directly. Real structure is two layers: an outer near-black "Cover Deep
// Field" root (`#080e14` + faint grid + blue/lime radial glows, see
// `ChapterDeskBackground` below) and an inner `.canvasStage` lesson card
// using the exact same dark-green chalkboard gradient
// (`linear-gradient(165deg, #1c3228 0%, #14261c 55%, #0f1f18 100%)`) as
// `DashboardView`'s `DeskBackground` - not a flat "paper" fill, hence
// `cardGradient` replacing the old `paper` token at its one call site.
// `ink`/`accent` read directly off the same file's `color:`/active-state
// rules (`#f4efe2` body text, `#b9e86f` the real accent/active-lime here,
// not the generic brand green `#54b948` guess this had before).
private enum ChapterColor {
    static let ink = Color(chapterHex: "f4efe2")
    static let inkSoft = Color(chapterHex: "f4efe2").opacity(0.72)
    static let accent = Color(chapterHex: "b9e86f")
    static let cardGradient = LinearGradient(
        colors: [Color(chapterHex: "1c3228"), Color(chapterHex: "14261c"), Color(chapterHex: "0f1f18")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

private extension Color {
    init(chapterHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// Outer "Cover Deep Field" root, ported from `ConceptChapterPage.module.css`'s
/// `.root` (near-black `#080e14` + two soft radial glows - blue at center,
/// lime upper-right - the same "Cover Deep Field" motif the file's own
/// comment names, distinct from the inner `.canvasStage` chalkboard card
/// which `ChapterColor.cardGradient` now covers). The live CSS also has a
/// faint 56px grid line pattern here; skipped as a non-load-bearing detail
/// at this pass's effort level, not because it isn't real.
private struct ChapterDeskBackground: View {
    var body: some View {
        ZStack {
            Color(chapterHex: "080e14")
            RadialGradient(
                colors: [Color(chapterHex: "1d3a8a").opacity(0.22), .clear],
                center: UnitPoint(x: 0.5, y: 0.42),
                startRadius: 0,
                endRadius: 420
            )
            RadialGradient(
                colors: [Color(chapterHex: "c4f547").opacity(0.08), .clear],
                center: UnitPoint(x: 0.72, y: 0.18),
                startRadius: 0,
                endRadius: 340
            )
        }
        .ignoresSafeArea()
    }
}
