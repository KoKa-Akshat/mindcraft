import SwiftUI

/// Paginated chapter reader - complete rebuild, 2026-08-21, after real
/// on-device testing found the original (a single long-scrolling sheet,
/// full paragraph body shown by default, sim links that were just dead
/// text with nothing behind them) was the wrong shape entirely: "too many
/// words, no structure... I hit the play button, and nothing happens."
///
/// One page per concept section. Each page leads with the section's real
/// `summary` (1-2 sentences, already short and clean - the generation
/// prompt asks for it that way) instead of the full `body` - the full
/// paragraph text is deliberately not shown anywhere in this view at all
/// (a first pass hid it behind a "Read the full explanation" disclosure,
/// which was rejected just as firmly as showing it outright: "masking the
/// problem instead of finding a proper solution"). When a section has a
/// real sim, it renders inline and playable via `InlineSimWebView`
/// (book_assembler.py now embeds the sim's actual HTML, including its
/// separate sketch.js - two real, sequential bugs found via live testing:
/// first `sim_files_dir` was only ever a local content-engine repo path,
/// never a URL this app could load; fixing that surfaced a second one,
/// main.html alone is just a shell that loads sketch.js via a path
/// relative to a directory that doesn't exist on the client at all).
struct BookReaderView: View {
    let book: AssembledBook
    /// Real cost/time for a FRESHLY generated book, nil for anything opened
    /// from the Chapter Library or Binder (a pre-existing book, cached or
    /// pre-built) - see `ChapterBookGenerationInfo`'s own doc comment for
    /// why cached books deliberately never carry this. 2026-08-21, direct
    /// ask: "show the time required to generate it and then the credits
    /// required to generate it... after the chapter was generated."
    var generationInfo: ChapterBookGenerationInfo? = nil
    /// Section `conceptId`s the student's actual question matched, nil to
    /// show the whole book (2026-08-23, direct ask: "we dont show all
    /// pages... we show what pages are relevant to that learning
    /// session"). Set by `JesseCallSession.openedChapterBookFocusConceptIds`
    /// for a voice-matched sub-topic inside a large archive book; nil for
    /// every full-book-browsing entry point (Chapter Library / Binder /
    /// freshly generated book - see that property's own doc comment for
    /// why each case is nil or not). `showingAllPages` below is the
    /// explicit escape hatch back to the full table of contents - a filter
    /// should narrow the default view, not delete the rest of the book.
    var focusConceptIds: Set<String>? = nil
    var onClose: () -> Void

    @State private var showingAllPages = false

    // Real discussion mode (2026-08-22) - same environment injection
    // pattern already used by StudySessionView/JesseRailView, not a new
    // dependency shape.
    @EnvironmentObject private var jesseCall: JesseCallSession

    @State private var pageIndex = 0

    // Real sim engagement telemetry (2026-08-21) - dwell time + touch count
    // per page, keyed by page index since a section's real identity
    // (conceptId) is looked up from `pages[index]` at flush time. Tracked
    // per-page rather than a single running total because a student can
    // page back and forth - `dwellMsByPage` accumulates ACROSS every visit
    // to that page, not just the most recent one.
    @State private var pageEnteredAt = Date()
    @State private var dwellMsByPage: [Int: Int] = [:]
    @State private var touchCountByPage: [Int: Int] = [:]

    private let ink = Color(gridHex: "143a2e")
    private let cream = Color(gridHex: "fff8e9")
    private let lime = Color(gridHex: "c4f547")

    private var allPages: [AssembledBookSection] {
        book.chapters.flatMap(\.sections)
    }

    /// The real, non-empty subset a focus would narrow to - nil when
    /// there's no focus, or the focus set matches nothing (a stale/empty
    /// match should never leave the student looking at zero pages, so it's
    /// treated the same as no focus at all).
    private var focusedPages: [AssembledBookSection]? {
        guard let focusConceptIds, !focusConceptIds.isEmpty else { return nil }
        let filtered = allPages.filter { focusConceptIds.contains($0.conceptId) }
        return filtered.isEmpty ? nil : filtered
    }

    /// The set actually shown right now - filtered unless there's no real
    /// focus to filter by, or the student has tapped through to see all.
    private var pages: [AssembledBookSection] {
        guard !showingAllPages, let focusedPages else { return allPages }
        return focusedPages
    }

    private var isFiltered: Bool {
        pages.count < allPages.count
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if focusedPages != nil {
                    focusBanner
                }
                TabView(selection: $pageIndex) {
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, section in
                        ScrollView {
                            pageContent(section, pageIndex: index)
                                .padding(20)
                        }
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .indexViewStyle(.page(backgroundDisplayMode: .always))

                if let generationInfo {
                    generationBadge(generationInfo)
                }
                pagerControls
            }
            .background(cream.ignoresSafeArea())
            .navigationTitle(book.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", action: closeAndFlushTelemetry)
                }
            }
        }
        .onAppear { pageEnteredAt = Date() }
        .onChange(of: pageIndex) { oldValue, _ in
            recordDwell(forPage: oldValue)
            pageEnteredAt = Date()
        }
    }

    private func recordDwell(forPage index: Int) {
        let elapsedMs = Int(Date().timeIntervalSince(pageEnteredAt) * 1000)
        guard elapsedMs > 0 else { return }
        dwellMsByPage[index, default: 0] += elapsedMs
    }

    /// Flushes real, on-device engagement signal before dismissing - the
    /// Close button is the only real dismissal path (`.fullScreenCover`
    /// doesn't support swipe-to-dismiss), so wrapping it here is sufficient
    /// rather than needing a separate `.onDisappear` at the view root (which
    /// SwiftUI can also fire on unrelated re-renders, not just real closes).
    /// Only pages that actually showed a sim are worth logging - dwell time
    /// on text-only pages isn't sim telemetry.
    private func closeAndFlushTelemetry() {
        recordDwell(forPage: pageIndex)
        flushEngagementTelemetry(currentPages: pages)
        onClose()
    }

    private func flushEngagementTelemetry(currentPages: [AssembledBookSection]) {
        let records: [SimInteractionRecord] = currentPages.enumerated().compactMap { index, section in
            guard section.simHtml != nil else { return nil }
            let dwellMs = dwellMsByPage[index] ?? 0
            let touches = touchCountByPage[index] ?? 0
            guard dwellMs > 0 || touches > 0 else { return nil }
            return SimInteractionRecord(
                subjectId: book.subjectId,
                conceptId: section.conceptId,
                simTitle: section.simTitle,
                dwellMs: dwellMs,
                touchCount: touches
            )
        }
        SimInteractionClient.log(records)
    }

    /// `dwellMsByPage`/`touchCountByPage` are keyed by index into `pages`,
    /// which was a stable, unchanging array until this filter/"see all"
    /// toggle existed - toggling reshuffles what index N means, so a raw
    /// index carried across the toggle would misattribute one section's
    /// engagement to a different one. Flush what's accumulated under the
    /// OLD indexing before switching, then reset and re-locate the page the
    /// student was actually looking at by its real identity (conceptId) in
    /// the NEW array.
    private func toggleShowingAllPages() {
        recordDwell(forPage: pageIndex)
        let viewedConceptId = pages.indices.contains(pageIndex) ? pages[pageIndex].conceptId : nil
        flushEngagementTelemetry(currentPages: pages)
        dwellMsByPage = [:]
        touchCountByPage = [:]
        showingAllPages.toggle()
        pageIndex = pages.firstIndex(where: { $0.conceptId == viewedConceptId }) ?? 0
        pageEnteredAt = Date()
    }

    @ViewBuilder
    private func pageContent(_ section: AssembledBookSection, pageIndex index: Int) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(section.title)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundColor(ink)

            // Short description leads - not the full paragraph body. This
            // is the direct fix for "too many words, no structure."
            if !section.summary.isEmpty {
                Text(section.summary)
                    .font(.mcContent(size: 16, weight: .medium))
                    .foregroundColor(ink.opacity(0.85))
                    .lineSpacing(3)
            }

            let present = section.buildsOnLabels.filter { !section.assumesMissing.contains($0) }
            if !present.isEmpty || !section.assumesMissing.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    if !present.isEmpty {
                        Text("Builds on " + present.joined(separator: ", "))
                    }
                    if !section.assumesMissing.isEmpty {
                        Text("Also assumes (not yet in this book): " + section.assumesMissing.joined(separator: ", "))
                    }
                }
                .font(.system(size: 12, design: .rounded).italic())
                .foregroundColor(ink.opacity(0.5))
            }

            // Real, deliberate reversal (2026-08-23, explicit live ask:
            // "the sims should be or the concepts in the sims should be
            // explained and how it related to the chapter should be
            // explained too") of the 2026-08-21 decision this comment
            // used to describe ("the summary is the whole caption, the
            // sim is the teaching surface, no full body when a sim
            // exists"). That worked for abstract, sim-less pages; it left
            // sim pages with nothing but a title, a one-line summary, and
            // a bare interactive widget with zero explanation of the
            // concept it demonstrates - naming the reversal rather than
            // quietly re-adding the text. Body always shows now, sim or
            // not.
            if !section.body.isEmpty {
                Text(section.body)
                    .font(.mcContent(size: 15))
                    .foregroundColor(ink.opacity(0.9))
                    .lineSpacing(5)
            }

            // The real, playable sim - still the centerpiece of the page,
            // just no longer the ONLY thing on it (see the reversal above).
            if let html = section.simHtml {
                VStack(alignment: .leading, spacing: 6) {
                    // The explicit prose->sim handoff (2026-08-23, same
                    // ask - "how it related to the chapter should be
                    // explained too"). `simBridge` already existed in this
                    // model/schema (book_assembler.AssembledSection) but
                    // was never rendered anywhere in this file - real gap,
                    // not a new field.
                    if let bridge = section.simBridge, !bridge.isEmpty {
                        Text(bridge)
                            .font(.mcContent(size: 14, weight: .semibold))
                            .foregroundColor(ink.opacity(0.75))
                            .italic()
                    }
                    // Real fix, 2026-08-21: a fixed 340pt height looked
                    // fine on an iPad but was described as "horrible" on
                    // narrower/taller viewports - "imagine people being
                    // able to use this on their phone." The sim's own
                    // canvas is a fixed 800x650 pixels (roughly 1.23:1) -
                    // sizing height from the AVAILABLE WIDTH at this
                    // aspect ratio, instead of a flat constant, keeps the
                    // same proportions on a narrow phone-width layout as
                    // on a wide iPad one, rather than cropping or
                    // stretching either way.
                    GeometryReader { geo in
                        InlineSimWebView(html: html, onInteraction: {
                            touchCountByPage[index, default: 0] += 1
                        })
                        .frame(width: geo.size.width, height: geo.size.width * (650.0 / 800.0))
                    }
                    .aspectRatio(800.0 / 650.0, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(ink.opacity(0.1)))
                    Text("Pinch to zoom in on the diagram.")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(ink.opacity(0.4))
                }
            } else if let svg = section.imageSvg {
                // Tier 0 image fallback (2026-08-27) - content-engine's
                // visual_composer.py only ever sets this when there's no
                // passing sim, so this is genuinely else-if, not a second
                // visual stacked under a sim. Reuses InlineSVGView
                // (GeneratedQuestionView.swift) - same "model-produced SVG
                // string, not a bundled asset" shape, JS disabled.
                VStack(alignment: .leading, spacing: 6) {
                    InlineSVGView(svg: svg)
                        .frame(height: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(ink.opacity(0.1)))
                    if let caption = section.imageCaption, !caption.isEmpty {
                        Text(caption)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(ink.opacity(0.55))
                            .italic()
                    }
                }
            }

            if let discussionTitle = section.discussionTitle {
                // Real, bounded back-and-forth (2026-08-22) - was inert
                // decorative text with nothing behind it (no Button, no
                // gesture, no JesseCallSession reference anywhere in this
                // file). This is the one place in the app real spoken
                // back-and-forth is wanted: "only have the agent talk to
                // the student when there are simulations... like a
                // discussion... what's your summary, then why do you
                // think, until they polish it."
                Button {
                    let seed = """
                    You are Jesse, a patient tutor having a short spoken discussion with a student about "\(discussionTitle)" (from the section "\(section.title)": \(section.summary)). Ask them to summarize it in their own words, then ask ONE real follow-up "why" question grounded in their actual answer. Once their answer holds up, tell them they've got it and wrap up warmly - don't drag it out past that. Keep every reply to 1-2 short spoken sentences.
                    """
                    jesseCall.beginDiscussion(seed: seed, opening: "So, what's your take on \(discussionTitle)? Walk me through it.")
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                        Text("Talk it through with Jesse: \(discussionTitle)")
                    }
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(ink.opacity(0.6))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("bookReaderDiscussion")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The session-scoped-view banner (2026-08-23). Two states: narrowed
    /// (default, tells the student why they're not seeing the full table
    /// of contents and offers a way out) and expanded (the student tapped
    /// through - offers a way back to just what's relevant). Always tells
    /// the truth about how many pages exist either way, never just hides
    /// the rest silently.
    @ViewBuilder
    private var focusBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: showingAllPages ? "list.bullet" : "target")
            if showingAllPages {
                Text("Showing all \(allPages.count) chapters")
            } else {
                let n = focusedPages?.count ?? 0
                Text(n == 1 ? "Showing the 1 chapter for this" : "Showing \(n) chapters for this")
            }
            Spacer()
            Button(showingAllPages ? "Back to relevant" : "See all \(allPages.count)") {
                withAnimation(.easeInOut(duration: 0.2)) { toggleShowingAllPages() }
            }
            .font(.system(size: 12, weight: .semibold, design: .rounded))
        }
        .font(.system(size: 12, weight: .medium, design: .rounded))
        .foregroundColor(ink.opacity(0.65))
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(lime.opacity(0.18))
        .overlay(alignment: .bottom) { Rectangle().fill(ink.opacity(0.08)).frame(height: 1) }
        .accessibilityIdentifier("bookReaderFocusBanner")
    }

    @ViewBuilder
    private func generationBadge(_ info: ChapterBookGenerationInfo) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "sparkles")
            Text(generationSummary(info))
        }
        .font(.system(size: 11, weight: .semibold, design: .rounded))
        .foregroundColor(ink.opacity(0.5))
        .padding(.horizontal, 20)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .overlay(alignment: .top) { Rectangle().fill(ink.opacity(0.06)).frame(height: 1) }
    }

    private func generationSummary(_ info: ChapterBookGenerationInfo) -> String {
        let totalSeconds = max(0, Int(info.elapsedSeconds.rounded()))
        let timeLabel = totalSeconds >= 60 ? "\(totalSeconds / 60)m \(totalSeconds % 60)s" : "\(totalSeconds)s"
        guard let costUsd = info.costUsd, costUsd > 0 else {
            return "Freshly generated for you in \(timeLabel)"
        }
        // Placeholder conversion (10 credits = $1) pending a real credits
        // pricing decision - the point right now is showing real cost at
        // all, not the exact exchange rate.
        let credits = max(1, Int((costUsd * 10).rounded()))
        return "Freshly generated for you in \(timeLabel) · $\(String(format: "%.2f", costUsd)) (~\(credits) credits)"
    }

    private var pagerControls: some View {
        HStack {
            Button {
                withAnimation { pageIndex = max(0, pageIndex - 1) }
            } label: {
                Label("Previous", systemImage: "chevron.left")
            }
            .disabled(pageIndex == 0)

            Spacer()

            Text("\(pageIndex + 1) of \(pages.count)")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(ink.opacity(0.5))

            Spacer()

            Button {
                withAnimation { pageIndex = min(pages.count - 1, pageIndex + 1) }
            } label: {
                Label("Next page", systemImage: "chevron.right")
                    .labelStyle(.titleAndIcon)
            }
            .disabled(pageIndex >= pages.count - 1)
        }
        .font(.system(size: 14, weight: .bold, design: .rounded))
        .foregroundColor(ink)
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(Color.white)
        .overlay(alignment: .top) { Rectangle().fill(ink.opacity(0.08)).frame(height: 1) }
    }
}

private extension Color {
    init(gridHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
