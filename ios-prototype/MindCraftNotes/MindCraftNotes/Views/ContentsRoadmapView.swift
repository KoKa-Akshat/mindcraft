import SwiftUI

/// Standard SwiftUI "read my real layout width without a `GeometryReader`
/// dictating my own size" pattern - see `ContentsRoadmapView.body`'s doc
/// comment for the real bug this replaced (a `GeometryReader` wrapping this
/// view's whole body collapsed to zero height once nested inside
/// `DashboardView`'s own outer `ScrollView`).
private struct RoadmapWidthKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

// Agent C. NATIVE_APP_BUILD_PLAN.md §9 / §4.
// The 4-lane, dot-per-concept Contents roadmap. Reads Models/DashboardModels.swift
// (Phase 0's frozen seam. ConceptProgress/TocSection/ConceptDisplay/TocDotState/
// tocDotState()/STATUS_COLOR) and the [String: ConceptProgress] dict Agent B's
// KnowledgeGraphClient produces. Public signature is the frozen integration
// point with Agent B's DashboardView.swift:
//     ContentsRoadmapView(sections: [TocSection], progress: [String: ConceptProgress])

// MARK: - JSON-decoding glue (build plan §8)

/// Full shape of the bundled `Resources/actToc.json` export - produced by the
/// real `app/scripts/exportActTocForNative.mjs`, which imports the actual
/// `ACT_TOC_SECTIONS` from `app/src/lib/actToc.ts` (not hand-translated).
private struct ActTocExport: Decodable {
    let sections: [TocSection]
    let concepts: [String: ConceptDisplay]
}

/// Loads + decodes the bundled `actToc.json` once per call. Exposed so
/// `DashboardView` (Agent B) can build the `[TocSection]` array this view's
/// `sections:` parameter expects, without duplicating decode logic.
enum TocDataLoader {
    static func loadSections() -> [TocSection] {
        loadExport()?.sections ?? []
    }

    // Widened from `fileprivate` so DashboardView (a different file) can
    // resolve a concept's label for the hero "today's spark" callout - same
    // decode this view already does for its own lane labels, just shared.
    static func loadConceptDisplays() -> [String: ConceptDisplay] {
        loadExport()?.concepts ?? [:]
    }

    private static func loadExport() -> ActTocExport? {
        guard
            let url = Bundle.main.url(forResource: "actToc", withExtension: "json"),
            let data = try? Data(contentsOf: url)
        else {
            return nil
        }
        return try? JSONDecoder().decode(ActTocExport.self, from: data)
    }
}

// MARK: - Color(hex:) helper (file-scoped to avoid clashing with any other
// agent's own hex-color helper. Swift keeps `fileprivate` members invisible
// outside this file, so two files can each declare one without conflict).

private extension Color {
    init(hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

private func statusColor(for status: String) -> Color {
    Color(hex: STATUS_COLOR[status] ?? STATUS_COLOR["untouched"]!)
}

/// Real port of `tocColumnsFor(count)` (`Dashboard.tsx` ~131-137, re-verified
/// 2026-08-06 directly against the function body, not re-derived from this
/// plan's own summary prose). A PRIOR version of this native port forced a
/// minimum of 3 columns unconditionally - wrong for small lanes: the real
/// function has a `count <= 4 → columns = count` branch (so a 2-concept lane
/// gets exactly 2 columns, one clean row, not 2 tiles adrift in a forced
/// 3-column grid with a dead empty column). Caught from a real-device
/// screenshot showing the 2-concept "Data & chance" lane with a wasted blank
/// column - visual evidence the earlier "near-square 3-4 columns" paraphrase
/// had silently dropped a real branch of the source function.
///
/// Round 7 real-device art direction (Akshat, explicit creative authority
/// granted): "give each logo its space... no need to condense... okay if it
/// runs across pages, I don't mind." Capped the upper bound at 3 (was 4) -
/// deliberately NOT a literal web-CSS-value port like the rest of this file;
/// the web grid can afford 4 columns because a browser window is often
/// 1400px+, this app's real iPad canvas is not, and Akshat explicitly asked
/// for bigger tiles over a tighter fit even at the cost of more vertical
/// scroll. Combined with `body`'s move to one full-width lane per row below
/// (was two lanes sharing a row), a lane's tiles now get roughly DOUBLE the
/// per-tile width this file had before this round.
private func tocColumnsFor(_ count: Int) -> Int {
    if count <= 0 { return 1 }
    if count <= 3 { return count }
    let ideal = Int(ceil(sqrt(Double(count))))
    return min(3, max(2, ideal))
}

// MARK: - ContentsRoadmapView

struct ContentsRoadmapView: View {
    let sections: [TocSection]
    let progress: [String: ConceptProgress]
    /// Tapping a concept dot calls this with the concept id. DashboardView
    /// wires it to open a real practice session for that concept (see its
    /// `homeBody` doc comment for what this does and doesn't cover yet).
    let onOpenConcept: (String) -> Void

    private let conceptDisplays: [String: ConceptDisplay]

    init(sections: [TocSection], progress: [String: ConceptProgress], onOpenConcept: @escaping (String) -> Void) {
        self.sections = sections
        self.progress = progress
        self.onOpenConcept = onOpenConcept
        self.conceptDisplays = TocDataLoader.loadConceptDisplays()
    }

    // Real bug #1, found from Akshat's physical-device report (can't scroll
    // far enough to reach the Geometric Transformations tile): the ORIGINAL
    // version of `body` applied `.frame(height:)` TWICE per lane-pair row -
    // once on an INNER `GeometryReader`'s content using the real measured
    // `geo.size.width`-derived `laneHeight`, and again on an OUTER
    // `GeometryReader` container using `laneHeight(cardWidth: nil)`, a flat
    // 390pt-fallback estimate that never matched the real iPad width. Since
    // that outer frame governs how much scroll space the row actually
    // claims, the real (taller) content silently overflowed past what the
    // `ScrollView` thought it needed to reserve.
    //
    // Real bug #2, found IMMEDIATELY after deploying the first attempted
    // fix (a single top-level `GeometryReader { ScrollView { ... } }`):
    // this view is ALREADY hosted inside `DashboardView`'s own outer
    // `ScrollView` (`homeBody`'s `ScrollView { ... ContentsRoadmapView(...) }`).
    // A `GeometryReader` has no intrinsic size of its own - nested inside an
    // ALREADY-scrolling, unbounded-height container with no explicit
    // `.frame(height:)` on the reader itself, it collapsed to a near-zero
    // height. Confirmed on a real-device screenshot: the whole Contents body
    // rendered as an empty green field with a single ~20pt sliver, which is
    // exactly why `testChapterDrillDownShowsRealStoryAndOpensPractice`
    // started failing ("not hittable" - the tile wasn't zero-opacity, it
    // simply wasn't there, collapsed into that sliver).
    //
    // Real fix: no `GeometryReader` controlling this view's OWN layout at
    // all. Real available width is read via the standard SwiftUI
    // background-`GeometryReader` + `PreferenceKey` pattern on a zero-height
    // full-width spacer (`widthProbe` below) - this reads the PARENT's true
    // proposed width without that read feeding back into (and destabilizing)
    // this view's own size the way wrapping the whole body in a
    // `GeometryReader` did. Every row's `.frame(height:)` still comes from
    // real, non-zero, explicitly-computed values, so the outer `ScrollView`
    // always sees genuine intrinsic content height - it can never collapse.
    @State private var measuredWidth: CGFloat = 820 // iPad-portrait-order-of-magnitude fallback for the very first frame only; corrected immediately via the preference below

    private var widthProbe: some View {
        Color.clear
            .frame(height: 0)
            .frame(maxWidth: .infinity)
            .background(
                GeometryReader { geo in
                    Color.clear.preference(key: RoadmapWidthKey.self, value: geo.size.width)
                }
            )
    }

    /// Round 7 real-device art direction (Akshat, explicit creative
    /// authority granted this round): "i dislike what you've done to the
    /// dash... too much padding on left and right... give each logo its
    /// space... no need to condense... okay if it runs across pages... keep
    /// the topic separation clearly though." Real structural change, not a
    /// value tweak: was two lanes sharing one row (each getting a
    /// proportional FRACTION of the available width, per the web's 12-column
    /// grid intent) - now ONE lane per row, full width. This directly
    /// answers all three parts of the ask at once: every tile gets roughly
    /// double its old width (more room, no forced condensing), the page
    /// scrolls further to fit 4 full-width lane cards instead of 2 rows of
    /// paired ones (explicitly acceptable to him), and each lane's own card
    /// chrome (background wash, border, header) is now the FULL visual
    /// width of the screen, making lane-to-lane separation MORE obvious, not
    /// less, despite the extra breathing room inside each one.
    var body: some View {
        VStack(spacing: 32) {
            widthProbe
            ForEach(sections) { section in
                LaneCard(section: section, progress: progress, conceptDisplays: conceptDisplays, onOpenConcept: onOpenConcept)
                    .frame(height: laneHeight(section: section, cardWidth: measuredWidth - 40))
            }
        }
        // Real fix: outer margin cut from 16pt to a slimmer, more deliberate
        // value. Akshat's own words were "too much padding on left and
        // right," and with lanes now full-width (above), this outer margin
        // is the ONLY horizontal inset left in the whole view, so it reads
        // immediately as either "generous margin" or "wasted edge space."
        // Landed on 20pt: enough to keep lane cards off the physical bezel
        // (a flush-edge card reads as a layout bug, not "no padding"), but
        // materially tighter than treating 16pt-plus-a-second-lane's-worth
        // of dead center gutter as this screen's horizontal margin the way
        // the old two-lanes-per-row layout effectively did.
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .onPreferenceChange(RoadmapWidthKey.self) { newWidth in
            if newWidth > 0 { measuredWidth = newWidth }
        }
        .background(deskBackground)
    }

    /// Real height for one lane card at a given rendered width: header +
    /// padding + N grid rows, where each row's height derives from the
    /// ACTUAL tile width at this card width (tile width → 16:10 aspect →
    /// tile height → + label), not a flat guess. `cardWidth` is now ALWAYS
    /// the real measured width (round-5 fix - see `body`'s doc comment
    /// above: the old nil/390pt-fallback path this comment used to describe
    /// was the actual root cause of the "can't scroll far enough" bug and
    /// has been removed; every call site now has real geometry up front via
    /// the single top-level `GeometryReader`). Kept as `CGFloat?` rather
    /// than tightened to `CGFloat` only to avoid an unrelated signature
    /// churn - always called with a real value now.
    private func laneHeight(section: TocSection, cardWidth: CGFloat?) -> CGFloat {
        let headerHeight: CGFloat = 84
        let cardPadding: CGFloat = 40
        // Round 7: bumped alongside the full-width-lane change and the
        // bigger tile chrome below. Akshat's "give each logo its space"
        // applies to the gaps AROUND tiles too, not just the tiles
        // themselves; a generously-sized tile with a cramped 12pt gutter
        // still reads as crowded next to its neighbors.
        let gridSpacing: CGFloat = 18
        // Node-card chrome around the label - bumped again this round
        // alongside the bigger tile padding/label size in `ConceptTile`
        // below, so this height math stays accurate and the ScrollView
        // keeps reserving the right amount of space (an under-reservation
        // here is exactly the class of bug that caused the original
        // "can't scroll far enough" report).
        let tileChromeHeight: CGFloat = 102
        let columns = tocColumnsFor(section.conceptIds.count)
        let rows = max(Int(ceil(Double(section.conceptIds.count) / Double(columns))), 1)
        let usableWidth = (cardWidth ?? 780) - cardPadding - CGFloat(columns - 1) * gridSpacing
        let tileWidth = max(usableWidth / CGFloat(columns), 40)
        let tileHeight = tileWidth * 10.0 / 16.0
        let rowHeight = tileHeight + tileChromeHeight
        return headerHeight + cardPadding + CGFloat(rows) * rowHeight + CGFloat(max(rows - 1, 0)) * gridSpacing
    }

    /// Phase 5 (2026-08-06): this was the ROOT CAUSE of the Home tab still
    /// screenshotting as the old pastel-lavender palette in this session's
    /// real-device Phase 2 pass, even though `DashboardView`'s own
    /// `DeskBackground` had already been fixed - `ContentsRoadmapView`
    /// (which renders as the Home tab's content, nested inside
    /// `DashboardView`'s already-dark stage) was independently painting
    /// this SECOND, separate, still-lavender background on top, obscuring
    /// the correct one underneath. Now matches `DeskBackground`'s real
    /// values (Dashboard.module.css `.canvasStage`, same as the rest of
    /// this phase) instead of re-deriving new ones.
    private var deskBackground: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "1c3228"), Color(hex: "14261c"), Color(hex: "0f1f18")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [Color(hex: "b9e86f").opacity(0.14), .clear],
                center: UnitPoint(x: 0.85, y: 0.08),
                startRadius: 0,
                endRadius: 460
            )
            RadialGradient(
                colors: [Color(hex: "1d3a8a").opacity(0.22), .clear],
                center: UnitPoint(x: 0.15, y: 0.9),
                startRadius: 0,
                endRadius: 460
            )
        }
        .ignoresSafeArea()
    }
}

// MARK: - Lane card

private struct LaneCard: View {
    let section: TocSection
    let progress: [String: ConceptProgress]
    let conceptDisplays: [String: ConceptDisplay]
    let onOpenConcept: (String) -> Void

    private var accentColor: Color { Color(hex: section.accent) }
    private var inkColor: Color { Color(hex: section.ink) }

    var body: some View {
        // Round 7: full-width lanes (see ContentsRoadmapView.body) made each
        // lane's own card chrome - this background wash, border, and shadow
        // - the clearest visual boundary on the whole screen now, exactly
        // what Akshat asked to keep even with more breathing room inside
        // ("keep the topic separation clearly though"). Padding/spacing
        // bumped (16→24, 12→18) to match - a bigger card with the same old
        // tight interior padding would have read as "more empty card," not
        // "more generous."
        VStack(alignment: .leading, spacing: 18) {
            header
            track
        }
        .padding(24)
        .background(
            LinearGradient(
                colors: [Color(hex: section.washTop), Color(hex: section.washBottom)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(accentColor.opacity(0.34), lineWidth: 2)
        )
        .shadow(color: Color(red: 90 / 255, green: 70 / 255, blue: 140 / 255).opacity(0.16), radius: 20, x: 0, y: 12)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            TocSectionMark(color: accentColor)
            VStack(alignment: .leading, spacing: 3) {
                Text(section.title)
                    // `.tocLaneTitle`: font-size 22px, font-weight 700, sans/
                    // display stack. NOT Caveat (a stale claim from an
                    // earlier pass of this plan, corrected in "The Contents
                    // roadmap component. REWRITTEN" section; confirmed here
                    // too, the old 28pt was forcing narrow proportional
                    // lanes like Data & chance to wrap into an unreadable
                    // vertical letter-stack on a real-device screenshot).
                    // Round 7: bumped to 26pt - full-width lanes have plenty
                    // of room for a bigger, more confident section header
                    // now, part of "keep the topic separation clearly."
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .foregroundColor(inkColor)
                Text(section.blurb)
                    .font(.system(size: 13, weight: .regular, design: .rounded))
                    .foregroundColor(inkColor.opacity(0.72))
            }
            Spacer(minLength: 0)
        }
    }

    /// Real port of the web's "near-square computed grid per lane, NOT a
    /// horizontal scroll of dots" (`tocColumnsFor(count)`), INCLUDING
    /// `tocTrailingSpans()`'s edge-to-edge trailing-row fill - a prior pass
    /// of this file used a uniform `LazyVGrid` and explicitly skipped the
    /// trailing-row fill as "not supported without much more custom layout,"
    /// but a real-device screenshot showed exactly the ragged result that
    /// skip predicted (a lone last tile stranded next to dead grid cells,
    /// e.g. Warm-ups' 7 concepts at 3 columns leaving one tile alone on a
    /// mostly-empty final row) - visible, wasted whitespace, not a
    /// theoretical gap. Rebuilt as manually-chunked rows instead: full rows
    /// use `columns` equal-width tiles, the trailing partial row stretches
    /// its fewer tiles to fill the SAME total row width evenly. This isn't
    /// literal per-cell integer `grid-column: span N` math (CSS's exact
    /// mechanic), but is visually equivalent for this component - no dead
    /// cells, edge-to-edge last row - without hand-building a custom grid
    /// layout container.
    private var track: some View {
        let columns = tocColumnsFor(section.conceptIds.count)
        let rows = section.conceptIds.chunked(into: max(columns, 1))
        // Round 7: 12→18, matching `ContentsRoadmapView.laneHeight`'s own
        // `gridSpacing` bump so the reserved scroll height stays accurate.
        return VStack(spacing: 18) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, rowIds in
                HStack(spacing: 18) {
                    ForEach(rowIds, id: \.self) { conceptId in
                        ConceptTile(
                            conceptId: conceptId,
                            display: conceptDisplays[conceptId],
                            conceptProgress: progress[conceptId],
                            laneAccent: accentColor,
                            onOpen: { onOpenConcept(conceptId) }
                        )
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }
}

private extension Array {
    /// `tocTrailingSpans()`'s row-chunking half, ported as plain array
    /// slicing since SwiftUI's grid containers don't support the CSS side
    /// (per-cell `grid-column: span N`) directly - see `track` above for how
    /// the trailing row's width-stretch achieves the same edge-to-edge
    /// result instead.
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}

/// Native stand-in for the web's hand-drawn `TocSectionMark` glyph - a simple
/// SF Symbol tinted with the lane's accent is sufficient per build plan §4.
private struct TocSectionMark: View {
    let color: Color

    var body: some View {
        // Bumped 20/28 → 24/34, then 24/34 → 28/40 in round 7 alongside the
        // header's own 22→26pt bump (full-width lanes, more visual weight to
        // balance).
        Image(systemName: "leaf.fill")
            .font(.system(size: 28, weight: .semibold))
            .foregroundColor(color)
            .frame(width: 40, height: 40)
    }
}

// MARK: - Concept tile (real story art + mastery-driven border/glow)

/// Phase 5 (2026-08-06): real port of the web's actual node mechanic - "a
/// square icon tile with a mastery-driven border/glow, NOT a circular dot,"
/// per this build plan's "Contents roadmap component. REWRITTEN" section
/// (verified there against live `Dashboard.tsx`/`.module.css`, not
/// re-derived here). Replaces the old `ConceptNode`/`DotView` pair (pie-fill
/// circle + connector lines) - the plan explicitly says the live product has
/// **no connector lines and no pie/conic fill**, a stale comment in the web
/// CSS itself still references them but they're not in the live JSX, so this
/// native port correctly drops them too rather than matching the stale
/// comment. Real story art via `StoryArtLoader.image(forConcept:)` (already
/// bundled + working - this was previously wired into `ConceptChapterView`
/// only, now also here, closing the plan's "single biggest remaining visual
/// gap" item).
private struct ConceptTile: View {
    let conceptId: String
    let display: ConceptDisplay?
    let conceptProgress: ConceptProgress?
    let laneAccent: Color
    let onOpen: () -> Void

    private var status: String { conceptProgress?.status ?? "untouched" }
    private var mastery: Double { min(max(conceptProgress?.mastery ?? 0, 0), 1) }
    private var dotState: TocDotState { tocDotState(status) }
    private var color: Color { statusColor(for: status) }
    private var isLocked: Bool { dotState == .locked }

    /// Real port of `.tocNode`'s CSS cascade (`Dashboard.module.css`
    /// ~1615-1662, re-verified 2026-08-06 directly against the live file -
    /// NOT re-derived from this build plan's own prose, which described a
    /// pure continuous mastery ramp across all 4 states; the live CSS does
    /// something more specific and is ground truth over the plan's summary).
    /// The BASE rule scales border opacity continuously by mastery
    /// (`color-mix(node-color, 40%+mastery*50%, transparent)`), but
    /// `[data-state='complete'|'needs'|'progress']` OVERRIDE border-color to
    /// the full solid `node-color` - only `locked` nodes actually render the
    /// mastery-scaled border (in practice near-constant since untouched
    /// nodes carry mastery ≈ 0).
    // Real fix from Akshat's physical-device report ("some [tiles] look like
    // they have [the glow] and some don't"): the literal CSS-cascade values
    // below were technically correct (locked/untouched tiles DO get a
    // mastery-scaled, dimmer border per the live `.tocNode` rule), but on a
    // real account most concepts start "untouched" (mastery 0) - so most
    // tiles rendered at the FLOOR of that range (0.4 border / 0.18 glow),
    // which reads on real hardware as "no glow at all" next to the few
    // fully-opaque complete/needs/progress tiles. That's not a rendering
    // bug, it's a floor set too low to read as "present but dim" rather than
    // "broken/missing" - raised both floors so every tile shows a visibly
    // real border/glow at rest, while still scaling up with real mastery
    // (locked tiles at mastery 0 are no longer indistinguishable from "off").
    private var borderOpacity: Double {
        switch dotState {
        case .complete, .needs, .progress: return 1.0
        case .locked: return 0.58 + mastery * 0.35
        }
    }
    /// Same cascade for `box-shadow`: complete/needs get a fixed 55%-opacity
    /// glow (their own explicit `box-shadow` rules), progress/locked fall
    /// through to the base rule's mastery-scaled floor (raised, see above).
    private var glowOpacity: Double {
        switch dotState {
        case .complete, .needs: return 0.55
        case .progress, .locked: return 0.32 + mastery * 0.28
        }
    }
    /// CSS blur radii (12px base / 16-18px complete&needs) halved as a
    /// SwiftUI `.shadow(radius:)` approximation - the two systems don't
    /// share blur semantics 1:1, this keeps the same relative ordering.
    /// Bumped slightly (7/10 vs the old 6/9) alongside the bigger tile
    /// chrome below so the glow still reads at the larger size.
    private var glowRadius: CGFloat {
        switch dotState {
        case .complete, .needs: return 10
        case .progress, .locked: return 7
        }
    }

    private var label: String {
        display?.label ?? conceptId
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }

    var body: some View {
        Button(action: onOpen) {
            VStack(spacing: 12) {
                iconLayer
                Text(label)
                    // `.tocNodeName`: weight 700, size 14, 2-line reserved
                    // height - bumped to 15pt/44pt min-height (Akshat's
                    // real-device "make the boxes bigger" note), then to
                    // 17pt/46pt in round 7 alongside the full-width-lane
                    // tile-sizing pass (Akshat: "give each logo its space").
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(Color(hex: "f4efe2"))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, minHeight: 46)
            }
            // `.tocNode`: padding 12/12/14, radius 14, its own translucent
            // dark background - this is the card the mastery border/glow
            // actually belongs to, NOT the art tile (see `iconLayer` below).
            // Padding bumped (12/12/14 → 14/14/16 → 18/18/20 in round 7) for
            // the same "bigger tiles" ask - matches `laneHeight`'s
            // `tileChromeHeight` bump so scroll math stays accurate.
            .padding(EdgeInsets(top: 18, leading: 18, bottom: 20, trailing: 18))
            .background(Color(red: 8 / 255, green: 18 / 255, blue: 14 / 255).opacity(0.45))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(color.opacity(borderOpacity), lineWidth: 2.5)
            )
            .shadow(color: color.opacity(glowOpacity), radius: glowRadius)
            .opacity(isLocked ? 0.62 : 1.0)
            .animation(.timingCurve(0.2, 0, 0, 1, duration: 0.3), value: mastery)
        }
        .buttonStyle(.plain)
        // Stable, concept-id-keyed tap target for XCUITest (Phase 2's
        // chapter-drill-down test) - unchanged from the old ConceptNode, so
        // the existing real-device test (`conceptNode_fractions_decimals`)
        // keeps passing without needing its own update.
        .accessibilityIdentifier("conceptNode_\(conceptId)")
        // The web's blurb text isn't part of this compact tile (per the
        // plan's own description of the real node - art + name + border
        // only) - kept as an accessibility hint instead of a visible line,
        // so the information isn't fully lost, just not shown inline.
        .accessibilityHint(display?.blurb ?? "")
    }

    /// `.tocNodeIcon` - a SEPARATE, FIXED lane-accent-tinted frame around the
    /// real story art, unrelated to mastery (confirmed directly in the live
    /// CSS: `.tocNodeIcon`'s `border: 1.5px solid color-mix(lane-accent 32%,
    /// transparent)` never references `--mastery` at all - the mastery
    /// treatment lives one level up, on `.tocNode`, applied in `body` above).
    /// Easy mix-up since both are square-ish tiles; only trustworthy by
    /// reading the actual rule, not by eyeballing the render.
    @ViewBuilder
    private var iconLayer: some View {
        ZStack(alignment: .bottomTrailing) {
            GeometryReader { geo in
                Group {
                    if let image = StoryArtLoader.image(forConcept: conceptId) {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            // `filter: saturate(1.05) contrast(1.05)
                            // brightness(0.92)` on `.tocNodeIcon img`.
                            .saturation(1.05)
                            .contrast(1.05)
                            .brightness(-0.08)
                    } else {
                        Rectangle().fill(Color(hex: "14261c"))
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            }
            .padding(5)
            .background(Color.black.opacity(0.28))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(laneAccent.opacity(0.32), lineWidth: 1.5)
            )

            if dotState == .complete {
                checkBadge
            }
        }
        // aspect-ratio: 16/10, per the live `.tocNodeIcon` rule.
        .aspectRatio(16.0 / 10.0, contentMode: .fit)
    }

    /// `.tocNodeCheck` - a solid `node-color` square badge with a DARK glyph
    /// on top (`background: var(--node-color); color: #14261c`), the
    /// opposite color relationship from this file's prior version (dark
    /// badge, colored glyph) - corrected against the live CSS rather than
    /// the visually-plausible-but-wrong guess. `right:-5px; bottom:-5px`
    /// relative to `.tocNodeIcon` → an offset overlapping the icon's own
    /// bottom-trailing corner, not fully inset.
    private var checkBadge: some View {
        Text("\u{2713}")
            .font(.system(size: 10, weight: .heavy))
            .foregroundColor(Color(hex: "14261c"))
            .frame(width: 17, height: 17)
            .background(color)
            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .strokeBorder(Color(hex: "14261c").opacity(0.9), lineWidth: 2)
            )
            .offset(x: 5, y: 5)
    }
}

// MARK: - Previews (component-isolation, all 4 TocDotState cases)

#Preview("Contents roadmap - fake data, all dot states") {
    let sections: [TocSection] = [
        TocSection(
            id: "warmups", title: "Warm-ups",
            blurb: "The fluency you lean on when everything else gets noisy.",
            washTop: "fff8f1", washBottom: "ffe8d6", accent: "e07a3a", ink: "8a3f12",
            conceptIds: ["fractions_decimals", "ratios_proportions", "order_of_operations", "basic_equations"]
        ),
        TocSection(
            id: "algebra", title: "Algebra",
            blurb: "Equations, functions, and the moves that unlock most ACT items.",
            washTop: "f3faf5", washBottom: "d9f0e2", accent: "2f8f62", ink: "14553a",
            conceptIds: ["linear_equations", "functions_basics", "quadratic_equations", "polynomials"]
        ),
        TocSection(
            id: "geometry", title: "Geometry",
            blurb: "Shapes, angles, and space: draw it, then name it.",
            washTop: "f2f7fc", washBottom: "d9e8f7", accent: "3a7eb8", ink: "1a4a72",
            conceptIds: ["right_triangle_geometry", "circles_geometry", "area_volume"]
        ),
        TocSection(
            id: "data", title: "Data & chance",
            blurb: "Read the story in a table, then weigh what could happen next.",
            washTop: "fff9ec", washBottom: "ffe9b8", accent: "c4921a", ink: "7a5200",
            conceptIds: ["descriptive_statistics", "basic_probability"]
        ),
    ]

    // Covers all 4 TocDotState cases: complete, needs, progress, locked
    // (via `tocDotState()` in Models/DashboardModels.swift).
    let progress: [String: ConceptProgress] = [
        "fractions_decimals": ConceptProgress(mastery: 1.0, status: "mastered"),         // .complete
        "ratios_proportions": ConceptProgress(mastery: 0.85, status: "stable"),          // .complete
        "order_of_operations": ConceptProgress(mastery: 0.3, status: "struggling"),      // .needs
        "linear_equations": ConceptProgress(mastery: 0.55, status: "in_progress"),       // .progress
        "functions_basics": ConceptProgress(mastery: 0.4, status: "repairing"),          // .progress
        "quadratic_equations": ConceptProgress(mastery: 0.15, status: "open_gap"),       // .needs
        "right_triangle_geometry": ConceptProgress(mastery: 0.0, status: "untouched"),   // .locked
        // "basic_equations", "polynomials", "circles_geometry", "area_volume",
        // "descriptive_statistics", "basic_probability" deliberately absent
        // from `progress` - proves the missing-entry fallback (mastery 0,
        // status "untouched" -> .locked) never crashes.
    ]

    return ContentsRoadmapView(sections: sections, progress: progress, onOpenConcept: { _ in })
}
