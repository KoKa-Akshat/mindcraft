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
    var onClose: () -> Void

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

    private var pages: [AssembledBookSection] {
        book.chapters.flatMap(\.sections)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
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
        let records: [SimInteractionRecord] = pages.enumerated().compactMap { index, section in
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
        onClose()
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

            // Real bug, live testing 2026-08-21 (same night as the fix
            // above, on a real Stoicism book): that fix's "summary is the
            // whole caption, the sim is the teaching surface" reasoning
            // silently assumed every page GETS a sim. Abstract concepts
            // (real example: "The Rational Order: Logos and Nature") are
            // correctly judged not sim-worthy at generation time - but with
            // no sim AND no body, those pages had nothing but a two-
            // sentence summary. Direct report: "the first few pages are
            // empty... don't just leave it empty." Full body text (already
            // generated, already gated - never hidden text, unlike the
            // rejected disclosure approach) fills that gap on exactly the
            // pages that need it; sim pages are completely unchanged.
            if section.simHtml == nil, !section.body.isEmpty {
                Text(section.body)
                    .font(.mcContent(size: 15))
                    .foregroundColor(ink.opacity(0.9))
                    .lineSpacing(5)
            }

            // The real, playable sim - the centerpiece of the page, not an
            // afterthought link. Direct feedback, 2026-08-21: a
            // "Read the full explanation" disclosure hiding the paragraph
            // body was rejected outright - "masking the problem instead of
            // finding a proper solution... short, powerful captions,
            // interactive sims" - so there is deliberately no expand-to-
            // read-more control here at all anymore. The summary above is
            // the whole caption; the sim is the actual teaching surface.
            // Depth comes from talking to Jesse (the discussion link right
            // below, where one exists), not from more paragraphs.
            if let html = section.simHtml {
                VStack(alignment: .leading, spacing: 6) {
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
            }

            if let discussionTitle = section.discussionTitle {
                HStack(spacing: 6) {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                    Text("Talk it through with Jesse: \(discussionTitle)")
                }
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundColor(ink.opacity(0.6))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
