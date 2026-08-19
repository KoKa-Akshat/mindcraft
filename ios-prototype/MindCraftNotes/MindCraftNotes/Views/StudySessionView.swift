import SwiftUI

/// Study Session - the tabbed, chapter-by-chapter lesson view (2026-08-19,
/// Assignment L in CURSOR_HANDOFF.md - explicit ask, reference a real
/// product screenshot of a medical-chart dashboard: dark panel, a rounded-
/// pill tab row across the top, a scrollable content area, a bottom
/// progress strip). Overlays `DeskGridDashboardView` in screen space (same
/// pattern as `bottomDock`/`leftSidebar` there) rather than a
/// `.fullScreenCover` - the dashboard stays mounted underneath, matching
/// the explicit ask: "the dash was changing... right now, what will
/// happen instead is that once that happens, the dash stays."
///
/// Honest scope, not faked: `WorkDashboardLesson.chapters` is one page of
/// real content per chapter today (`chapterBody(at:)`), not the "5, 10,
/// however many pages" a chapter might eventually need - that needs the
/// richer, structured content-generation pipeline referenced in
/// `mindcraft-content-engine`'s own in-progress work, not yet wired to
/// produce per-chapter multi-page content this app can consume. The arrow
/// navigation here is built so a future `[ChapterPage]` array slots in
/// without a rewrite - `chapterBody(at:)` is already the one seam a
/// future multi-page chapter would extend.
struct StudySessionView: View {
    let lesson: WorkDashboardLesson
    /// True when rendered inside a container that already owns its own
    /// frame/positioning (2026-08-19: the merged Binder+Intel content-viewer
    /// space in `DeskGridDashboardView`) rather than as this view's own
    /// full-screen overlay. Strips the fixed 1100x720 cap (fills whatever
    /// space the container gives it instead) and the full-bleed
    /// `.ignoresSafeArea()` black scrim (which would paint outside the tile
    /// bounds, not just behind this view, if left on). Keeps the dark
    /// rounded panel + white text exactly as-is either way - that's the
    /// actual visual identity, not overlay-specific chrome.
    var embedded: Bool = false
    var onClose: () -> Void
    var onOpenMicroSim: (MicroSimRecord) -> Void
    /// Opens a gate-passed GENERATED sim (closed test, see
    /// `LiveGatedGeneration`) - separate from `onOpenMicroSim` because a
    /// `GeneratedSimResult` is not a `MicroSimRecord` and pretending it is
    /// would blur exactly the provenance line the attribution rules exist
    /// to keep sharp. Defaulted so existing call sites stay valid.
    var onOpenGeneratedSim: (GeneratedSimResult) -> Void = { _ in }

    /// For `liveSimState` only - the live gated-generation request lives on
    /// the session object (it outlives any one screen, and its loading
    /// state deliberately IS `jesseCall.isThinking` - see that property's
    /// doc comment). Safe here: this view is only ever created inside
    /// `DeskGridDashboardView`, which sits under `DeskShellView`'s
    /// `.environmentObject(jesseCall)`.
    @EnvironmentObject private var jesseCall: JesseCallSession

    private enum Tab: Equatable {
        case contents
        case chapter(Int)
        case sources
    }

    // Lands on Contents first, not chapter 0 (2026-08-19, explicit ask:
    // "go back to Contents, keep reading, and go to the next space" - a
    // real table-of-contents page distinct from chapter 1, not chapter 1
    // doubling as one).
    @State private var activeTab: Tab = .contents

    private var chapterCount: Int { lesson.chapters.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            header
            tabRow
            Divider().overlay(Color.white.opacity(0.12))
            content
            if chapterCount > 1 {
                progressStrip
            }
        }
        .padding(embedded ? 16 : 28)
        .frame(maxWidth: embedded ? .infinity : 1100, maxHeight: embedded ? .infinity : 720)
        .background(
            RoundedRectangle(cornerRadius: embedded ? 18 : 28, style: .continuous)
                .fill(Color(studyHex: "2b2b2e"))
                .shadow(color: .black.opacity(0.4), radius: embedded ? 14 : 30, y: embedded ? 6 : 12)
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            if !embedded { Color.black.opacity(0.55).ignoresSafeArea() }
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "study-session").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("studySessionRoot")
                .allowsHitTesting(false)
        }
        // `.task(id:)` re-runs exactly when activeTab changes (including the
        // very first render, at .chapter(0) - a plain .onChange would miss
        // that initial view) and auto-cancels a stale in-flight call if the
        // student flips tabs again before it returns. Ungraded exposure
        // only - see LessonGraphTagging.swift's file header for why this is
        // a separate call from anything that touches mastery.
        .task(id: activeTab) {
            if case .chapter(let index) = activeTab {
                await recordChapterView(index)
            }
        }
    }

    /// Only for `.generated` lessons - their concept_ids are exactly what
    /// LessonGraphIngestClient tagged (see JesseCallSession's two generation
    /// branches). `.archive` lessons surface real BookGraphLoader/ArchiveRag
    /// content whose actual concept_ids (if minted at all) come from a
    /// different, not-yet-wired path - guessing at a slug here would log
    /// engagement against a concept_id that doesn't match what (if
    /// anything) the server actually knows this content as.
    private func recordChapterView(_ index: Int) async {
        guard case .generated = lesson.source, lesson.chapters.indices.contains(index) else { return }
        let conceptIds = LessonSlug.conceptIds(topic: lesson.topic, chapterTitles: lesson.chapters)
        guard conceptIds.indices.contains(index) else { return }
        await EngagementClient.recordEngagement(
            subjectId: LessonSlug.subjectId(topic: lesson.topic),
            conceptId: conceptIds[index],
            eventType: "viewed_chapter"
        )
    }

    private var header: some View {
        HStack(spacing: 14) {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.12)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("studySessionClose")

            VStack(alignment: .leading, spacing: 2) {
                Text(lesson.topic.capitalized)
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                Text(sourceLabel)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.5))
            }
            Spacer(minLength: 0)
        }
    }

    private var sourceLabel: String {
        switch lesson.source {
        case .archive(let bookTitle): return "From your archive · \(bookTitle)"
        case .generated: return "AI-generated outline"
        }
    }

    private var tabRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                tabPill("Contents", isActive: activeTab == .contents) {
                    activeTab = .contents
                }
                .accessibilityIdentifier("studySessionTab_contents")
                ForEach(Array(lesson.chapters.enumerated()), id: \.offset) { index, title in
                    tabPill(title, isActive: activeTab == .chapter(index)) {
                        activeTab = .chapter(index)
                    }
                    .accessibilityIdentifier("studySessionTab_\(index)")
                }
                tabPill("Sources", isActive: activeTab == .sources) {
                    activeTab = .sources
                }
                .accessibilityIdentifier("studySessionTab_sources")
            }
        }
    }

    private func tabPill(_ title: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(isActive ? Color(studyHex: "1c1c1e") : .white.opacity(0.85))
                .lineLimit(1)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Capsule().fill(isActive ? Color.white : Color.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        HStack(spacing: 12) {
            arrowButton("chevron.left", enabled: canGoBack) { step(-1) }
            ScrollView {
                Group {
                    switch activeTab {
                    case .contents:
                        contentsOverview
                    case .chapter(let index):
                        chapterContent(index)
                    case .sources:
                        sourcesContent
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            arrowButton("chevron.right", enabled: canGoForward) { step(1) }
        }
        .frame(maxHeight: .infinity)
        // This ScrollView's real children (chapter body, tab pills, sources/
        // citations) don't publish into the accessibility tree - a
        // pre-existing quirk of this exact nesting depth (inside the scaled
        // tileBoard artboard's `pin()`/`.scaleEffect`, inside a Button's own
        // label), already documented and worked around the same way for
        // `uploadContentViewerBody`'s own ScrollViews elsewhere in
        // DeskGridDashboardView.swift. Confirmed via a real screenshot
        // (2026-08-19) that the content renders and would be fully usable
        // for a real sighted tap - this is a query-only limitation, not a
        // rendering or touch-input bug. One marker carrying whichever
        // content is currently active, rather than per-element markers,
        // since the underlying issue is systemic to the whole ScrollView,
        // not any one Text.
        .overlay(alignment: .topLeading) {
            Text(verbatim: activeContentMarkerText)
                .font(.system(size: 1))
                .foregroundColor(.clear)
                .accessibilityIdentifier("studySessionActiveContent")
                .allowsHitTesting(false)
        }
    }

    private var activeContentMarkerText: String {
        switch activeTab {
        case .contents:
            return ([lesson.definition] + lesson.chapters).joined(separator: " | ")
        case .chapter(let index):
            var parts = [lesson.chapterBody(at: index)]
            if index == 0, let question = lesson.question { parts.append(question) }
            // The generated-sim section renders inside the same
            // non-publishing ScrollView as everything else here, so its
            // state copy rides the marker too - it's the only way a UI
            // test can assert the honest-outcome states at all.
            if let simMarker = generatedSimMarkerText { parts.append(simMarker) }
            return parts.joined(separator: " | ")
        case .sources:
            return lesson.citations.isEmpty
                ? "AI-generated - no archive source for this lesson."
                : lesson.citations.map { "\($0.pageTitle) — \($0.bookTitle)" }.joined(separator: " | ")
        }
    }

    /// The lesson's real definition plus a tappable row per chapter (and
    /// Sources, if there are real citations) - the landing page (2026-08-19,
    /// explicit ask), not chapter 1 doubling as one.
    private var contentsOverview: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(lesson.definition)
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 8) {
                Text("CHAPTERS")
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .tracking(0.6)
                    .foregroundColor(.white.opacity(0.5))
                ForEach(Array(lesson.chapters.enumerated()), id: \.offset) { index, title in
                    contentsRow(title, systemImage: nil, numbered: index + 1) {
                        activeTab = .chapter(index)
                    }
                    .accessibilityIdentifier("studySessionContentsRow_\(index)")
                }
                if !lesson.citations.isEmpty {
                    contentsRow("Sources", systemImage: "book.closed.fill", numbered: nil) {
                        activeTab = .sources
                    }
                    .accessibilityIdentifier("studySessionContentsRow_sources")
                }
            }
        }
    }

    private func contentsRow(_ title: String, systemImage: String?, numbered: Int?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if let numbered {
                    Text("\(numbered)")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(studyHex: "1c1c1e"))
                        .frame(width: 22, height: 22)
                        .background(Circle().fill(Color(studyHex: "c4f547")))
                } else if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.6))
                        .frame(width: 22, height: 22)
                }
                Text(title)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white.opacity(0.35))
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.06)))
        }
        .buttonStyle(.plain)
    }

    /// "Little button to go back" to the Contents page (2026-08-19, explicit
    /// ask) - distinct from the chevron arrows (step chapter-to-chapter) and
    /// the tab-pill row (jump to any tab): this one specifically names where
    /// it goes, for a student who wants back to the overview rather than
    /// just backward one step.
    private var backToContentsButton: some View {
        Button { activeTab = .contents } label: {
            HStack(spacing: 4) {
                Image(systemName: "chevron.left").font(.system(size: 10, weight: .bold))
                Text("Contents").font(.system(size: 12, weight: .bold, design: .rounded))
            }
            .foregroundColor(.white.opacity(0.55))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("studySessionBackToContents")
    }

    private func chapterContent(_ index: Int) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            backToContentsButton
            Text(lesson.chapterBody(at: index))
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("studySessionChapterBody_\(index)")

            if index == 0, let question = lesson.question {
                VStack(alignment: .leading, spacing: 6) {
                    Text("PRACTICE")
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                        .tracking(0.6)
                        .foregroundColor(.white.opacity(0.5))
                    Text(question)
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.9))
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.06)))
            }

            if !lesson.microsims.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("INTERACTIVE SIMULATIONS")
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                        .tracking(0.6)
                        .foregroundColor(.white.opacity(0.5))
                    ForEach(lesson.microsims) { sim in
                        Button { onOpenMicroSim(sim) } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "play.circle.fill")
                                Text(sim.title)
                            }
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(Color(studyHex: "c4f547"))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if LiveGatedGeneration.isEnabled {
                generatedSimSection
            }
        }
    }

    // MARK: - Live gated generation (closed test, LIVE_GATED_GENERATION_TEST_SPEC.md)

    /// The session's live-sim state, but only if it belongs to THIS lesson -
    /// `liveSimState` is one slot on the shared session object, and a
    /// student who generated for one topic then opened a different book
    /// should not see the old topic's verdict under the new one. Every
    /// case carries the ORIGINAL request topic for exactly this check.
    private var liveSimStateForThisLesson: LiveSimState? {
        guard let state = jesseCall.liveSimState else { return nil }
        let stateTopic: String
        switch state {
        case .running(let topic, _): stateTopic = topic
        case .verified(_, let topic, _): stateTopic = topic
        case .noGoodResult(let topic, _, _): stateTopic = topic
        case .rateLimited(let topic, _): stateTopic = topic
        case .unavailable(let topic, _): stateTopic = topic
        }
        return stateTopic == lesson.topic ? state : nil
    }

    /// The full state UI. Two design rules from the spec, load-bearing:
    /// (1) "couldn't make a good one" is styled and worded as the NORMAL
    /// outcome (the pipeline's real measured yield is 1/10-6/10 by domain),
    /// same visual weight as ordinary content, nothing error-red; (2) the
    /// expectation is set BEFORE the student spends a minute waiting, on
    /// the request button itself, not sprung on them afterward.
    @ViewBuilder
    private var generatedSimSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("GENERATED SIM")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.6)
                .foregroundColor(.white.opacity(0.5))

            switch liveSimStateForThisLesson {
            case nil:
                requestSimButton
            case .running(_, let attemptTopic):
                HStack(spacing: 8) {
                    ProgressView().tint(.white)
                    Text(attemptTopic == nil
                        ? "Building and checking a sim\u{2026} usually under a minute. It only shows up if it passes every check."
                        : "That angle didn't pass. Trying \"\(attemptTopic ?? "")\" instead\u{2026}")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(.white.opacity(0.7))
                }
            case .verified(let result, _, let cached):
                Button { onOpenGeneratedSim(result) } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "play.circle.fill")
                        Text(result.title)
                    }
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(studyHex: "c4f547"))
                }
                .buttonStyle(.plain)
                Text(cached
                    ? "AI-generated - passed the quality checks. Reused from the sim library."
                    : "AI-generated - passed the quality checks before being shown.")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.55))
            case .noGoodResult(_, let reason, let alsoTried):
                VStack(alignment: .leading, spacing: 6) {
                    Text("Couldn't make a good one for that yet.")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(.white.opacity(0.9))
                    if let reason, !reason.isEmpty {
                        Text(reason)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    if let alsoTried, !alsoTried.isEmpty {
                        Text("Also tried \"\(alsoTried)\" - no luck there either.")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    Text("That's the usual outcome for a lot of topics - only sims that pass every check get shown.")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.5))
                    retrySimButton
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.06)))
            case .rateLimited(_, let reason):
                Text(reason ?? "You've used today's sim-building attempts. The library keeps growing - check back tomorrow.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.7))
            case .unavailable(_, let note):
                VStack(alignment: .leading, spacing: 4) {
                    Text("Sim building isn't available right now.")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(.white.opacity(0.8))
                    if let note, !note.isEmpty {
                        Text(note)
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.5))
                    }
                    retrySimButton
                }
            }
        }
    }

    private var requestSimButton: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                Task { await jesseCall.requestLiveGatedSim(topic: lesson.topic) }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "wand.and.stars")
                    Text("Ask Jesse to build an interactive sim")
                }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(studyHex: "c4f547"))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("studySessionGenerateSim")
            Text("Only sims that pass a quality check are ever shown - many topics won't make one, and that's normal.")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.5))
        }
    }

    private var retrySimButton: some View {
        Button {
            jesseCall.clearLiveSimState()
            Task { await jesseCall.requestLiveGatedSim(topic: lesson.topic) }
        } label: {
            Text("Try again")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(studyHex: "c4f547"))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("studySessionRetrySim")
    }

    /// Mirror of `generatedSimSection`'s visible copy for the
    /// `studySessionActiveContent` marker - see that marker's doc comment
    /// for why content at this nesting depth can only be asserted through
    /// it. Kept adjacent to the section so copy edits change both together.
    private var generatedSimMarkerText: String? {
        guard LiveGatedGeneration.isEnabled else { return nil }
        switch liveSimStateForThisLesson {
        case nil:
            return "Ask Jesse to build an interactive sim"
        case .running(_, let attemptTopic):
            return attemptTopic == nil
                ? "Building and checking a sim"
                : "That angle didn't pass. Trying \"\(attemptTopic ?? "")\""
        case .verified(let result, _, let cached):
            return "\(result.title) | AI-generated - passed the quality checks\(cached ? ". Reused from the sim library." : " before being shown.")"
        case .noGoodResult(_, let reason, let alsoTried):
            var parts = ["Couldn't make a good one for that yet."]
            if let reason, !reason.isEmpty { parts.append(reason) }
            if let alsoTried, !alsoTried.isEmpty { parts.append("Also tried \"\(alsoTried)\"") }
            return parts.joined(separator: " | ")
        case .rateLimited(_, let reason):
            return reason ?? "You've used today's sim-building attempts."
        case .unavailable(_, let note):
            return "Sim building isn't available right now." + (note.map { " | \($0)" } ?? "")
        }
    }

    private var sourcesContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            backToContentsButton
            if lesson.citations.isEmpty {
                Text("AI-generated - no archive source for this lesson.")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.6))
            } else {
                ForEach(lesson.citations) { citation in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(citation.pageTitle)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text(citation.bookTitle)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.6))
                        if let url = URL(string: citation.url) {
                            Link(citation.url, destination: url)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundColor(Color(studyHex: "c4f547"))
                        }
                    }
                    .padding(.bottom, 6)
                }
            }
        }
        .accessibilityIdentifier("studySessionSources")
    }

    private func arrowButton(_ system: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(enabled ? .white : .white.opacity(0.25))
                .frame(width: 34, height: 34)
                .background(Circle().fill(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    private var progressStrip: some View {
        HStack(spacing: 8) {
            ForEach(0..<chapterCount, id: \.self) { index in
                Circle()
                    .fill(activeTab == .chapter(index) ? Color.white : Color.white.opacity(0.25))
                    .frame(width: 7, height: 7)
                    .onTapGesture { activeTab = .chapter(index) }
                    .accessibilityIdentifier("studySessionProgress_\(index)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private var canGoBack: Bool {
        if case .contents = activeTab { return false }
        return true
    }

    private var canGoForward: Bool {
        if case .sources = activeTab { return false }
        return true
    }

    private func step(_ delta: Int) {
        switch activeTab {
        case .contents:
            if delta > 0 {
                activeTab = chapterCount > 0 ? .chapter(0) : .sources
            }
        case .chapter(let index):
            let next = index + delta
            if next < 0 {
                activeTab = .contents
            } else if next >= chapterCount {
                activeTab = .sources
            } else {
                activeTab = .chapter(next)
            }
        case .sources:
            if delta < 0 {
                activeTab = chapterCount > 0 ? .chapter(chapterCount - 1) : .contents
            }
        }
    }
}

private extension Color {
    init(studyHex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(red: r, green: g, blue: b)
    }
}
