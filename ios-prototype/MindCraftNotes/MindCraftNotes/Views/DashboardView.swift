import SwiftUI

/// The Dashboard shell - hero bar (wordmark, Home/Map/Work/Notes nav pills,
/// a real "today's spark" callout, display name + sign out) plus all 4 tabs:
/// Home (Contents roadmap), Map (same live progress, priority-sorted),
/// Work (real Problem Solver - story card + canvas + MyScript, ported from
/// this session's original prototype), Notes (real tutor/homework session
/// summaries via Firestore).
struct DashboardView: View {
    /// When true, Dashboard lives inside the Field Desk ACT stage - tabs
    /// swap in-place; house lands on the dash Home tab (does not leave desk).
    var embeddedInDesk: Bool = false
    var onDeskHome: (() -> Void)? = nil
    /// Real nav-intent entry point ("study quadratic equations" -> Ask The
    /// Desk resolves it to a real concept id via `DeskAskClient`'s
    /// `study_concept` action -> `FieldDeskView` opens the ACT stage with
    /// this set). Consumed once in `.task` below, then cleared - a plain
    /// concept-dot tap keeps working exactly as before it existed.
    var pendingConceptId: String? = nil

    private enum Tab: String, CaseIterable {
        case home = "Home"
        case map = "Map"
        case work = "Work"
        case notes = "Notes"
    }

    /// When opened as a Desk instance, Home returns to the hub dash.
    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .home
    // Set right before switching to `.work` by the spark badge / Weekly
    // Review tap. WorkPracticeView reads this to pull real questions for
    // exactly these concepts instead of the default 5-question sample.
    @State private var workTargetConceptIds: [String] = []
    @State private var showPracticeSession = false
    /// Persist practice so Binder minimize → reopen resumes the same set.
    @AppStorage("actFieldBook.resumePractice") private var resumePractice = false
    @AppStorage("actFieldBook.resumeConceptsJSON") private var resumeConceptsJSON = "[]"
    // Round 9: the real Weekly Review guided walkthrough
    // (WeeklyReviewWalkthroughView) - separate presentation state from
    // showPracticeSession/workTargetConceptIds above, which now only ever
    // drives the spark badge's plain single/multi-concept session.
    @State private var showWeeklyWalkthrough = false
    @State private var showFindTutor = false
    /// Design PDF / Figma: Marketplace for workflows on the ACT dashboard.
    @State private var showWorkflowMarket = false
    @StateObject private var workflowStore = WorkflowMarketStore()
    // Set when a concept dot (Home or Map) is tapped - presents the real
    // story "chapter" first (ConceptChapterView), whose own "Begin practice"
    // button then calls openWork(with:). Previously tapping a dot jumped
    // straight into Work with no narrative framing at all.
    @State private var chapterConceptId: String?
    private enum DiagnosticGate { case checking, needed, done }
    @State private var diagnosticGate: DiagnosticGate = .checking
    @StateObject private var studentStore = FirestoreStudentStore()
    @StateObject private var graphClient = KnowledgeGraphClient()
    // Real `POST /recommend` (mode: "exam") result - see RouteClient's
    // `fetchExamProfile()` doc comment (Phase 2 item 4). nil until it loads
    // (or if it fails/times out), in which case `todaysSpark`/`learnNext`
    // fall back to their pre-existing local-heuristic computation below -
    // this is a progressive enhancement over the already-working Phase 1
    // hero bar, not a hard dependency the whole bar blocks on.
    @State private var examProfile: ExamProfile?
    // Injected by AuthGate (MindCraftNotesApp.swift, Agent A's shared-file
    // edit) via `.environmentObject(authService)` around the bare
    // `DashboardView()` call - see build plan §3/§9.
    @EnvironmentObject private var authService: AuthService

    // Real ACT TOC lanes/concepts, decoded once from the bundled
    // `Resources/actToc.json` export (build plan §8/§9 Agent C's
    // `TocDataLoader`). Loading synchronously in `init` (not `.task`) since
    // it's a bundled-resource decode, not a network call - no need to show a
    // loading state for it.
    @State private var sections: [TocSection] = TocDataLoader.loadSections()
    // Same bundled decode ContentsRoadmapView uses for its own lane labels -
    // shared here only to resolve the "today's spark" concept's display name.
    private let conceptDisplays: [String: ConceptDisplay] = TocDataLoader.loadConceptDisplays()

    @State private var showCover = !CoverSession.alreadySeen
    // Shared between CoverView's equip-shelf and the wizard mascot picker
    // below - same two real, live consumers of `coverStickers.ts`'s catalog
    // on web (verified directly; see StickerCatalog.swift's doc comment for
    // why this is the correct system to port, not the orphaned Firestore
    // drag-placement one).
    @StateObject private var stickerStore = StickerStore()
    @State private var mascotShelfOpen = false

    var body: some View {
        Group {
            // Cover is a full page - skip when embedded so tabs stay in-stage.
            if showCover && !embeddedInDesk {
                CoverView(
                    accountName: studentStore.displayName == "there" ? "" : studentStore.displayName,
                    onOpen: { showCover = false },
                    onFindTutor: {
                        showCover = false
                        showFindTutor = true
                    },
                    stickerStore: stickerStore
                )
            } else {
            switch diagnosticGate {
            case .checking:
                ZStack {
                    DeskBackground()
                    ProgressView()
                }
            case .needed:
                // Real "identification" gate - same seed-assessment flow and
                // Firestore fields as web's Diagnostic.tsx, matching
                // Dashboard.tsx's own redirect-to-diagnostic behavior for any
                // student who hasn't rated their concepts yet.
                DiagnosticGateView(
                    sections: sections,
                    conceptDisplays: conceptDisplays,
                    onComplete: {
                        diagnosticGate = .done
                        Task { await graphClient.load() }
                    }
                )
            case .done:
                ZStack {
                    // Keep ACT chrome even when embedded in the desk stage.
                    DeskBackground()
                    VStack(spacing: 0) {
                        heroBar
                        content
                    }

                    // Round 28+: when hosted as a desk stage, chapter /
                    // practice / weekly stay INSIDE this frame - never a
                    // second device-full cover that escapes the stage box.
                    if embeddedInDesk {
                        if let chapterId = chapterConceptId {
                            ConceptChapterView(
                                conceptId: chapterId,
                                conceptLabel: conceptDisplays[chapterId]?.label
                                    ?? chapterId.replacingOccurrences(of: "_", with: " ").capitalized,
                                onBeginPractice: {
                                    chapterConceptId = nil
                                    openWork(with: [chapterId])
                                },
                                embeddedInDesk: true,
                                onClose: { chapterConceptId = nil }
                            )
                            .transition(.opacity)
                            .zIndex(20)
                        }
                        if showPracticeSession {
                            PracticeSessionView(
                                targetConceptIds: workTargetConceptIds,
                                conceptStatus: workTargetConceptIds.first.flatMap { graphClient.progress[$0]?.status },
                                embeddedInDesk: true,
                                onClose: { closePracticeSession() }
                            )
                            .transition(.opacity)
                            .zIndex(21)
                        }
                        if showWeeklyWalkthrough {
                            WeeklyReviewWalkthroughView(
                                slots: weeklyReviewSlots,
                                conceptStatus: graphClient.progress.mapValues { $0.status },
                                embeddedInDesk: true,
                                onClose: { showWeeklyWalkthrough = false }
                            )
                            .transition(.opacity)
                            .zIndex(21)
                        }
                    }
                }
                // Device-full covers only when ACT is its own shell - not
                // when embedded in the Field Desk stage box.
                .fullScreenCover(isPresented: $showFindTutor) {
                    NavigationStack { FindTutorView() }
                }
                .sheet(isPresented: $showWorkflowMarket) {
                    NavigationStack {
                        ActWorkflowMarketView(store: workflowStore)
                            .toolbar {
                                ToolbarItem(placement: .topBarTrailing) {
                                    Button("Close") { showWorkflowMarket = false }
                                }
                            }
                    }
                    .presentationDetents([.medium, .large])
                }
                .fullScreenCover(isPresented: Binding(
                    get: { !embeddedInDesk && showPracticeSession },
                    set: { if !$0 { closePracticeSession() } }
                )) {
                    PracticeSessionView(
                        targetConceptIds: workTargetConceptIds,
                        conceptStatus: workTargetConceptIds.first.flatMap { graphClient.progress[$0]?.status },
                        onClose: { closePracticeSession() }
                    )
                }
                .onAppear { restorePracticeResumeIfNeeded() }
                .onChange(of: showPracticeSession) { _, open in
                    if open { persistPracticeResume() }
                }
                .fullScreenCover(isPresented: Binding(
                    get: { !embeddedInDesk && showWeeklyWalkthrough },
                    set: { if !$0 { showWeeklyWalkthrough = false } }
                )) {
                    WeeklyReviewWalkthroughView(
                        slots: weeklyReviewSlots,
                        conceptStatus: graphClient.progress.mapValues { $0.status }
                    )
                }
                .fullScreenCover(item: Binding(
                    get: { embeddedInDesk ? nil : chapterConceptId.map { ChapterSheetItem(conceptId: $0) } },
                    set: { chapterConceptId = $0?.conceptId }
                )) { item in
                    ConceptChapterView(
                        conceptId: item.conceptId,
                        conceptLabel: conceptDisplays[item.conceptId]?.label ?? item.conceptId.replacingOccurrences(of: "_", with: " ").capitalized,
                        onBeginPractice: { openWork(with: [item.conceptId]) }
                    )
                }
                // Wizard sprite tap -> Stickers in "pick mascot" mode, same
                // `WizardMascot.tsx`'s `onSpriteClick` behavior.
                .sheet(isPresented: $mascotShelfOpen) {
                    StickersShelfView(mode: .mascot, store: stickerStore) { mascotShelfOpen = false }
                }
            }
            }
        }
        .task {
            if let pendingConceptId {
                chapterConceptId = pendingConceptId
            }
            // Embedded ACT stage: stay in-place - no diagnostic full-page gate.
            if embeddedInDesk {
                diagnosticGate = .done
                await graphClient.load()
                examProfile = await RouteClient.fetchExamProfile()
                return
            }
            let complete = await DiagnosticClient.isComplete()
            diagnosticGate = complete ? .done : .needed
            if complete {
                await graphClient.load()
                // Fired after the graph load (not `async let` in parallel)
                // deliberately: `todaysSpark`'s severity math reads
                // `graphClient.progress` for each weakness candidate's real
                // mastery, so the profile fetch's result is only actually
                // useful once that map is populated. Both are one-shot loads
                // on first render, not a polling loop.
                examProfile = await RouteClient.fetchExamProfile()
            }
        }
    }

    // MARK: - Hero bar

    /// Ported from `Dashboard.tsx`'s `weakness` signal, computed client-side
    /// from data already loaded here (`graphClient.progress`) rather than a
    /// second network call - the web side calls a separate `/recommend`
    /// endpoint for this (see build plan §5), which Phase 1 doesn't wire up
    /// yet. This is a real subset of that: the single lowest-mastery concept
    /// currently in a "needs" state (struggling/open_gap - same
    /// `tocDotState()` bucket the roadmap dots already use), so "today's
    /// spark" only ever names a genuine, currently-tracked weak spot, never
    /// a guess. Returns nil (hides the callout) when nothing qualifies yet
    /// - e.g. a brand-new student with no practice history.
    private var todaysSpark: (id: String, label: String)? {
        // Real `/recommend` profile weaknesses first - same `severity = 1 -
        // mastery` formula as web's `worstWeakness()` `profile` tier
        // (`recommendNextConcept.ts`), ranked by whichever candidate is
        // currently worst rather than just "first weakness the server
        // listed." Only candidates the bank can actually serve questions for
        // count (`hasPlayableQuestions`), matching web's own guard.
        if let examProfile {
            let ranked = examProfile.topWeaknesses
                .filter { hasPlayableQuestions($0.conceptId) }
                .map { (id: $0.conceptId, severity: 1 - min(1, max(0, graphClient.progress[$0.conceptId]?.mastery ?? 0))) }
                .max { $0.severity < $1.severity }
            if let ranked {
                let label = conceptDisplays[ranked.id]?.label
                    ?? ranked.id.replacingOccurrences(of: "_", with: " ").capitalized
                return (id: ranked.id, label: label)
            }
        }
        // Fallback: the local heuristic this Dashboard shipped with before
        // `/recommend` was wired up - used when the profile call hasn't
        // returned yet (still loading, offline, or the HF Space is cold-
        // starting) or returned no playable weaknesses, so the spark badge
        // is never just blank while a real weak spot is knowable locally.
        let weakest = graphClient.progress
            .filter { tocDotState($0.value.status) == .needs }
            .min { $0.value.mastery < $1.value.mastery }
        guard let weakest else { return nil }
        let label = conceptDisplays[weakest.key]?.label
            ?? weakest.key.replacingOccurrences(of: "_", with: " ").capitalized
        return (id: weakest.key, label: label)
    }

    /// Same `hasPlayableQuestions` guard web's `worstWeakness()`/PawHub use
    /// (`questionBank.ts`): never route "today's spark" or "learn next" to a
    /// concept the bundled bank can't actually serve a question for.
    private func hasPlayableQuestions(_ conceptId: String) -> Bool {
        !QuestionBankLoader.questions(forConcept: conceptId).isEmpty
    }

    /// Ported from `Dashboard.tsx`'s "Learn" signal (the old PawHub's
    /// zero-exposure pick, still the same real intent even though the web
    /// UI that named it that way is gone): the first concept, in curriculum
    /// (lane) order, the student hasn't touched at all yet. A genuinely
    /// different real recommendation from `todaysSpark` (shore up a known
    /// weak spot vs. explore something new) - never the same computation
    /// twice just relabeled.
    private var learnNext: (id: String, label: String)? {
        // Real `/recommend` exam-trimmed `canonicalChain` first - matches
        // CLAUDE.md's PawHub table exactly: "Learn (violet toe): mode: exam
        // -> first 0-exposure, playable concept on ACT path." The chain is
        // already in curriculum (prerequisite) order server-side, so the
        // first qualifying entry here is the same pick the web Dashboard's
        // `nextTopic` card would make.
        if let examProfile {
            for id in examProfile.canonicalChain {
                let status = graphClient.progress[id]?.status ?? "untouched"
                if tocDotState(status) == .locked, hasPlayableQuestions(id) {
                    let label = conceptDisplays[id]?.label ?? id.replacingOccurrences(of: "_", with: " ").capitalized
                    return (id: id, label: label)
                }
            }
        }
        // Fallback: the local lane-order scan this Dashboard shipped with
        // before `/recommend` was wired up.
        for section in sections {
            for id in section.conceptIds {
                let status = graphClient.progress[id]?.status ?? "untouched"
                if tocDotState(status) == .locked {
                    let label = conceptDisplays[id]?.label ?? id.replacingOccurrences(of: "_", with: " ").capitalized
                    return (id: id, label: label)
                }
            }
        }
        return nil
    }

    /// Real subset of `weeklyPracticePaper.ts`'s inputs - weakness + learn +
    /// the first section's first 2 concepts as "review" - minus that file's
    /// lock/unlock-per-week completion tracking, which isn't wired up yet
    /// (no Firestore write for it here). Tapping "Weekly Review" opens a
    /// real multi-concept practice session, just without the "already done
    /// this week" gate the web side has.
    private var weeklyReviewConceptIds: [String] {
        var ids: [String] = []
        if let spark = todaysSpark { ids.append(spark.id) }
        if let learn = learnNext, !ids.contains(learn.id) { ids.append(learn.id) }
        for id in sections.first?.conceptIds.prefix(2) ?? [] where !ids.contains(id) {
            ids.append(id)
        }
        return ids
    }

    /// Round 9: the SAME real signals `weeklyReviewConceptIds` above already
    /// picks (spark weakness, learn-next, first-lane review pair), now kept
    /// as real `WeeklyReviewSlot`s (id + label + role) instead of being
    /// flattened into one plain id array - this is what
    /// `WeeklyReviewWalkthroughView` actually walks through, one slot's
    /// story beat → formula card → question batch at a time. Role mapping
    /// mirrors web's own real slot intent: the spark concept IS the weak
    /// spot being strengthened, the learn-next concept IS the new stretch
    /// topic, and the review-lane concepts ARE the light review pass - not
    /// an arbitrary relabeling.
    private var weeklyReviewSlots: [WeeklyReviewSlot] {
        var slots: [WeeklyReviewSlot] = []
        var seen: Set<String> = []
        if let spark = todaysSpark {
            slots.append(WeeklyReviewSlot(conceptId: spark.id, label: spark.label, role: .strengthen))
            seen.insert(spark.id)
        }
        if let learn = learnNext, !seen.contains(learn.id) {
            slots.append(WeeklyReviewSlot(conceptId: learn.id, label: learn.label, role: .stretch))
            seen.insert(learn.id)
        }
        for id in sections.first?.conceptIds.prefix(2) ?? [] where !seen.contains(id) {
            let label = conceptDisplays[id]?.label ?? id.replacingOccurrences(of: "_", with: " ").capitalized
            slots.append(WeeklyReviewSlot(conceptId: id, label: label, role: .review))
            seen.insert(id)
        }
        return slots
    }

    /// Opens the real guided walkthrough (round 9) - separate from
    /// `openWork(with:)`, which still drives the plain spark-badge session
    /// and any direct chapter "Begin practice" tap.
    private func openWeeklyWalkthrough() {
        showWeeklyWalkthrough = true
    }

    /// Opens a real practice session - a SEPARATE thing from the Work tab
    /// (same split as web: `/practice` vs `Dashboard.tsx`'s Work tab
    /// `WorkStudio.tsx`), presented full-screen rather than switching tabs.
    private func openWork(with conceptIds: [String]) {
        workTargetConceptIds = conceptIds
        showPracticeSession = true
        persistPracticeResume()
    }

    private func closePracticeSession() {
        showPracticeSession = false
        // Keep resume so Binder minimize → reopen can restore; clear only
        // when the student finishes/closes practice intentionally via Home
        // inside the session - still keep concepts+index in PracticeSessionView.
        // Clearing resumePractice means "don't auto-reopen overlay"; index stays.
        resumePractice = false
        resumeConceptsJSON = (try? String(
            data: JSONEncoder().encode(workTargetConceptIds),
            encoding: .utf8
        )) ?? "[]"
    }

    private func persistPracticeResume() {
        resumePractice = showPracticeSession
        resumeConceptsJSON = (try? String(
            data: JSONEncoder().encode(workTargetConceptIds),
            encoding: .utf8
        )) ?? "[]"
    }

    private func restorePracticeResumeIfNeeded() {
        guard !showPracticeSession else { return }
        guard resumePractice else { return }
        guard let data = resumeConceptsJSON.data(using: .utf8),
              let ids = try? JSONDecoder().decode([String].self, from: data),
              !ids.isEmpty else { return }
        workTargetConceptIds = ids
        showPracticeSession = true
    }

    /// **Round 8 reorganization** (Akshat's real-device feedback, landscape
    /// iPad specifically): the single-row hero bar packed wordmark, nav,
    /// mascot, spark/Weekly-Review badges, and trailing all into one HStack
    /// with multiple competing `Spacer`s - those spacers absorbed slack
    /// roughly evenly, which is exactly why the nav row read as "floating
    /// away" from the wordmark and the mascot/quote read as "floating too
    /// far right." New shape, two rows:
    /// - **Row 1**: wordmark + nav grouped tightly (own inner HStack, no
    ///   spacer between them). ONE real flexible `Spacer` - then a second
    ///   tight group (mascot + quote + Find a Tutor + name + sign out) so
    ///   that whole cluster reads as one unit instead of four things spread
    ///   across the bar.
    /// - **Row 2**: Today's Spark / Weekly Review badges, moved out of row 1
    ///   entirely (they were the thing crowding "Find a Tutor" out of the
    ///   bar before).
    /// "Find a Tutor" moves INTO row 1 from its old spot beside the
    /// "Contents" header (`homeBody`, now removed there) - same real
    /// `showFindTutor` action, just relocated and restyled as a pill to fit
    /// the bar's chrome instead of a plain `.bordered` button.
    private var heroBar: some View {
        VStack(spacing: embeddedInDesk ? 2 : 6) {
            heroBarRow1
            if todaysSpark != nil {
                heroBarRow2
            }
        }
        .padding(.horizontal, embeddedInDesk ? 12 : 20)
        .padding(.top, embeddedInDesk ? 4 : 14)
        .padding(.bottom, embeddedInDesk ? 4 : 14)
    }

    private var heroBarRow1: some View {
        HStack(spacing: 0) {
            HStack(spacing: 8) {
                wordmark
                navIconRow
            }
            .layoutPriority(1)

            Spacer(minLength: 12)

            // Sticker + quote live together on the left (navIconRow).
            // Trailing: Weekly Review + name + Home.
            HStack(spacing: 10) {
                if !weeklyReviewConceptIds.isEmpty {
                    weeklyReviewButton
                }
                if !embeddedInDesk {
                    Text(studentStore.displayName)
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(DeskColor.ink)
                        .lineLimit(1)
                }
                DeskHomeButton(
                    action: {
                        // Always land on the dash Home surface first.
                        closePracticeSession()
                        chapterConceptId = nil
                        showWeeklyWalkthrough = false
                        tab = .home
                        if embeddedInDesk {
                            // Stay on the desk-hosted dash (Binder/Home open it).
                            return
                        }
                        (onDeskHome ?? { dismiss() })()
                    },
                    accessibilityId: "actFieldBookHome"
                )
            }
            .layoutPriority(1)
        }
    }

    private var heroBarRow2: some View {
        HStack(spacing: 10) {
            if let spark = todaysSpark {
                sparkBadge("today's spark", spark.label) { openWork(with: [spark.id]) }
            }
            Spacer(minLength: 0)
        }
    }

    private var weeklyReviewButton: some View {
        Button(action: openWeeklyWalkthrough) {
            HStack(spacing: 5) {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 12, weight: .semibold))
                Text("Weekly Review")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .lineLimit(1)
            }
            .foregroundColor(DeskColor.ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(DeskColor.pillActiveBackground)
                    .shadow(color: DeskColor.pillShadow, radius: 6, x: 0, y: 3)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("actWeeklyReview")
    }

    /// Real tap target now that Work has real bank questions
    /// (`QuestionBankLoader`) to launch into - no longer a dead label.
    /// Real bug fix (found from a real-device screenshot, not eyeballed from
    /// code): the eyebrow line ("TODAY'S SPARK"/"WEEKLY REVIEW") had NO
    /// `.lineLimit`, unlike the label line below it - when `heroBar`'s
    /// HStack got squeezed (its badges are the deliberate "give up space
    /// first" element, no `.layoutPriority`), this Text wrapped onto as many
    /// lines as it took, one word (sometimes one syllable) per line, reading
    /// as an unreadable vertical letter-stack instead of a pill.
    ///
    /// FIRST attempted fix here was `.fixedSize(horizontal: true, ...)` on
    /// both lines - that stopped the letter-wrap, but a follow-up real-device
    /// screenshot showed it just moved the squeeze somewhere worse:
    /// `fixedSize` refuses to shrink AT ALL, so once total bar content
    /// exceeded the available width, the layout engine had nothing left to
    /// compress except the supposedly-protected `.layoutPriority(1)`
    /// wordmark/navPills - "Mind" got clipped at the screen edge and the
    /// "Home" pill rendered as an empty capsule with invisible text. THEN
    /// tried `.lineLimit(1)` + `.minimumScaleFactor(0.6)` on an `HStack`
    /// pairing eyebrow+label side by side - still wrong, confirmed on a real
    /// round-5 device screenshot: with both lines sharing one row's width,
    /// the badge still truncated to "TODA... Trig..." (0.6 floor reached
    /// before either line actually fit). Real root cause: an `HStack` makes
    /// the two lines COMPETE for the same horizontal space; a `VStack`
    /// (eyebrow small line stacked directly above the label) gives each line
    /// the badge's FULL width independently, which is enough on its own -
    /// kept the `lineLimit`/`minimumScaleFactor` safety net for genuinely
    /// tight widths, but it should now rarely need to engage.
    private func sparkBadge(_ eyebrow: String, _ label: String, filled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 1) {
                Text(eyebrow)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundColor(DeskColor.inkSoft.opacity(0.55))
                    .textCase(.uppercase)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(label)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(DeskColor.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 999, style: .continuous)
                    .fill(filled ? DeskColor.brandGreen.opacity(0.18) : DeskColor.pillActiveBackground)
                    .shadow(color: DeskColor.pillShadow, radius: 8, x: 0, y: 4)
            )
        }
        .buttonStyle(.plain)
    }

    /// Build plan Phase 5 item 6 ("a motivational quote... via the existing
    /// wizard-mascot tip mechanism, verify which is real on web"). Verified
    /// directly against `WizardMascot.tsx`/`Dashboard.tsx`: it is NOT a
    /// separate BRAND_BOOK-sourced tagline - `wizardLine = mascot.blurb` in
    /// `Dashboard.tsx` shows the currently-EQUIPPED mascot sticker's own
    /// `blurb` field (e.g. "Catch a green idea mid-air." for the default
    /// Palm of Sparks), already ported verbatim into `StickerCatalog.swift`.
    /// Reusing `stickerStore.mascotId` (same lookup `RotatableStickerView`
    /// above already does) rather than inventing a second source of truth.
    /// `WizardMascot.module.css`'s `.bubble`/`.line`: no speech-bubble chrome
    /// at all - background/border/shadow all `none`, just italic serif text.
    ///
    /// Deliberately NOT given `.layoutPriority(1)` and kept narrow/
    /// single-line: this exact spot is where the heroBar's own doc comment
    /// (top of this view) records a real "tabs disappear" squeeze bug from a
    /// wizard bubble text line competing for width against navPills - that
    /// bubble was removed for that reason. This one stays low-priority so it
    /// is the first thing to truncate (visibly, via `lineLimit`+ellipsis,
    /// never via `.minimumScaleFactor` collapsing to invisible text) if the
    /// bar gets tight, same as the sparkBadge pills beside it.
    private var wizardQuoteBubble: some View {
        let blurb = (StickerCatalog.item(id: stickerStore.mascotId) ?? StickerCatalog.items[0]).blurb
        return Text(blurb)
            // TODO: swap to Font.mcSerif italic once Resources/Fonts/ DM
            // Serif Display files are bundled (build plan §4. Phase 0 left
            // UIAppFonts empty on purpose). .system(design: .serif) stands in.
            .font(.system(size: embeddedInDesk ? 12 : 14, weight: .medium, design: .serif))
            .italic()
            .foregroundColor(DeskColor.ink.opacity(0.85))
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: embeddedInDesk ? 120 : 150, alignment: .leading)
    }

    /// Real bug fix (Akshat's follow-up note, cross-checked directly against
    /// `Dashboard.tsx` lines ~722-778 + `Dashboard.module.css`'s `.navBtn`):
    /// the live web nav is NOT 4 labeled pills. It's the wordmark itself as
    /// the Home affordance (`onClick={openHome}`, no visible "Home" pill at
    /// all) plus 3 ICON-ONLY buttons (`lucide-react`'s `Map`/`PenLine`/
    /// `NotebookPen`, size 22, strokeWidth 2.25, `aria-label` only - no
    /// visible text). This build plan's own §2 already documented this
    /// correctly; `navPills` below just never matched it. Wordmark is now
    /// tappable (`tab = .home`), and the old 4-text-pill `navPills` is
    /// replaced by `navIconRow` (Map/Work/Notes only, real SF Symbol
    /// stand-ins for the lucide icons - `map`/`pencil.line`/`note.text`,
    /// chosen for shape/meaning parity, not literal 1:1 glyphs).
    private var wordmark: some View {
        Button {
            withAnimation(.timingCurve(0.2, 0, 0, 1, duration: 0.25)) {
                tab = .home
            }
        } label: {
            Text("The Desk")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundColor(DeskColor.ink)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Home · The Desk")
    }

    /// Icon-only nav. Map/Work/Notes, matching the real web's 3 icon
    /// buttons (see `wordmark`'s doc comment above for the verification).
    /// Akshat separately asked for an "index" affordance placed near this
    /// row; I could not find any such element in the real web nav itself
    /// (confirmed: `Dashboard.tsx`'s `.heroBar` has exactly wordmark + these
    /// 3 icons + the wizard + trailing, nothing else). Best-guess reading,
    /// flagged as an assumption rather than invented silently: "index" may
    /// mean the Home/Contents affordance itself (tapping the wordmark
    /// already jumps back to the Contents "index" of lanes/concepts) - if
    /// that's not what he meant, this needs a follow-up conversation rather
    /// than another guess.
    private var navIconRow: some View {
        HStack(spacing: 4) {
            navIconButton(tab: .map, systemName: "map", label: "Map")
            navIconButton(tab: .work, systemName: "pencil.line", label: "Work")
            navIconButton(tab: .notes, systemName: "note.text", label: "Notes")
            // Sticker + quote together on the left (where the sticker sits).
            HStack(spacing: 6) {
                RotatableStickerView(
                    image: StickerCatalog.image(for: StickerCatalog.item(id: stickerStore.mascotId) ?? StickerCatalog.items[0]),
                    size: embeddedInDesk ? 30 : 36,
                    onTap: { mascotShelfOpen = true }
                )
                .accessibilityIdentifier("actNavSticker")
                wizardQuoteBubble
            }
            .padding(.leading, 4)
        }
    }

    private func navIconButton(tab candidate: Tab, systemName: String, label: String) -> some View {
        let isActive = tab == candidate
        return Button {
            withAnimation(.timingCurve(0.2, 0, 0, 1, duration: 0.25)) {
                tab = candidate
            }
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 20, weight: .medium))
                .foregroundColor(isActive ? DeskColor.navActiveTint : DeskColor.inkSoft.opacity(0.55))
                .frame(width: 40, height: 40)
                .background(
                    Circle()
                        .fill(isActive ? DeskColor.pillActiveBackground : Color.clear)
                        .shadow(
                            color: isActive ? DeskColor.pillShadow : .clear,
                            radius: isActive ? 10 : 0,
                            x: 0,
                            y: isActive ? 6 : 0
                        )
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: - Tab content

    @ViewBuilder
    private var content: some View {
        switch tab {
        case .home:
            ScrollView {
                homeBody
                    .padding(.horizontal, embeddedInDesk ? 12 : 20)
                    .padding(.top, embeddedInDesk ? 0 : 8)
                    .padding(.bottom, 24)
            }
        case .map:
            // Real ported constellation/GPS explorer - same
            // GET /knowledge-graph/{uid} payload the web
            // ConstellationGpsExplorer reads (real PCA node positions, real
            // edges, real student embedding points), not a synthetic
            // layout. See KnowledgeMapView's doc comment for the full port
            // notes and what's still open.
            KnowledgeMapView(
                nodes: graphClient.nodes,
                edges: graphClient.edges,
                studentPoints: graphClient.studentPoints,
                axisLabels: graphClient.axisLabels,
                conceptDisplays: conceptDisplays,
                onOpenConcept: { conceptId in chapterConceptId = conceptId },
                onQuickPractice: { conceptId in openWork(with: [conceptId]) }
            )
        case .work:
            // Real homework helper + solver - ported from `WorkStudio.tsx`:
            // real webhook photo parse → real Firestore homework_sessions,
            // real "paste a problem" → /recommend-ingredients hints, real
            // Recent list. NOT concept-targeted practice (that's
            // PracticeSessionView, presented full-screen from the spark/
            // Weekly Review/chapter taps) - this was the exact
            // mis-categorization Akshat flagged ("Work is where you drop
            // homework PDFs... what you're showing currently is legacy").
            WorkPracticeView()
        case .notes:
            // Real tutor-session/homework summaries via SessionNotesClient
            // (same `sessions`/`homework_sessions` Firestore collections
            // DashboardNotesPanel.tsx reads) - plain list rather than the
            // web's page-flip book leaves for now.
            NotesListView()
        }
    }

    @ViewBuilder
    private var homeBody: some View {
        VStack(alignment: .leading, spacing: embeddedInDesk ? 10 : 16) {
            // Round 13: surface Map / Tutors / Work builds that already exist
            // as tabs/modals but were easy to miss from Contents-only home.
            // Embedded stage: drop launch pads so Contents moves up.
            if !embeddedInDesk {
                dashboardLaunchPads
            }

            HStack {
                Text("Contents")
                    // TODO: swap for Font.mcHand(...)/Caveat once bundled.
                    .font(.system(size: embeddedInDesk ? 24 : 30, weight: .bold, design: .rounded))
                    .foregroundColor(DeskColor.ink)
                Spacer()
            }

            if graphClient.isLoading && graphClient.progress.isEmpty {
                loadingState
            } else if graphClient.lastError != nil && graphClient.progress.isEmpty {
                errorState
            }

            // onOpenConcept: tapping a lesson dot opens the real story
            // "chapter" (ConceptChapterView - real conceptStories.json text,
            // paginated the same way ConceptChapterPage.tsx does), which
            // leads into a real practice session on "Begin practice".
            // Previously the dots weren't tappable at all, then briefly
            // jumped straight to practice with no narrative framing.
            ContentsRoadmapView(sections: sections, progress: graphClient.progress) { conceptId in
                chapterConceptId = conceptId
            }
        }
    }

    /// Design PDF / Figma desk dashboard surfaces. Map, Tutors nearby,
    /// Workflow market, plus Work builds. Always on Home so they can't hide
    /// behind icon-only nav.
    private var dashboardLaunchPads: some View {
        HStack(spacing: 10) {
            launchPad(title: "Map", blurb: "Knowledge graph", system: "map", id: "dashPadMap") {
                tab = .map
            }
            launchPad(title: "Tutors", blurb: "Map + book", system: "person.2.fill", id: "dashPadTutors") {
                showFindTutor = true
            }
            launchPad(title: "Market", blurb: "Workflows", system: "storefront.fill", id: "dashPadMarket") {
                showWorkflowMarket = true
            }
            launchPad(title: "Work", blurb: "Homework builds", system: "wrench.and.screwdriver.fill", id: "dashPadWork") {
                tab = .work
            }
        }
        .padding(.bottom, 4)
    }

    private func launchPad(title: String, blurb: String, system: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: system)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(DeskColor.navActiveTint)
                Text(title)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(DeskColor.ink)
                Text(blurb)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(DeskColor.inkSoft)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(deskHex: "14261c").opacity(0.85))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(DeskColor.navActiveTint.opacity(0.22), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    private var loadingState: some View {
        HStack(spacing: 10) {
            ProgressView()
            // The HF Spaces free-tier bridge can take up to ~60s to wake
            // from a cold start (build plan §5) - this stays calm, not an
            // error state, for the whole real wait.
            Text("Waking up your progress…")
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(DeskColor.inkSoft.opacity(0.72))
        }
        .padding(.vertical, 8)
    }

    private var errorState: some View {
        Text("Couldn't load your progress just now - this will retry the next time you open the Dashboard.")
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(DeskColor.inkSoft.opacity(0.72))
            .padding(.vertical, 4)
    }


    // MARK: - Actions

    private func signOut() {
        // Routes through Agent A's real AuthService (injected by AuthGate),
        // which also signs out of GIDSignIn and clears its own errorMessage
        // state. AuthGate's `authService.currentUser` flips to nil and
        // switches the root view back to LoginView (build plan §3/§9).
        authService.signOut()
    }
}

// MARK: - Design system (build plan §4) - colors/background local to this file.
// Not extracted into a shared file to avoid a new pbxproj registration; if a
// later pass wants Font+MindCraft.swift / a shared Color+MindCraft.swift,
// these are easy to lift out unchanged.

// Real brand tokens - verified directly against the LIVE
// Dashboard.module.css (`.canvasStage`, lines ~1012-1044), 2026-08-06. The
// web Dashboard is a dark "chalkboard" stage (NOT a light cream/paper
// theme - `dashboardPersonalization.ts`'s `DEFAULT_THEME: cream` is a
// separate, narrower per-student customization layer, not the base page
// background). Replaces both the old lavender "canvas desk" placeholder
// AND my own first-pass cream/forest-green fix, which was wrong - verified
// against the wrong source (dashboardPersonalization.ts) instead of the
// actual live CSS.
private enum DeskColor {
    static let ink = Color(deskHex: "f4efe2")
    static let inkSoft = Color(deskHex: "f4efe2").opacity(0.72)
    static let brandGreen = Color(deskHex: "54b948")
    // `.navActive` (Dashboard.module.css:956-960) - translucent lime fill +
    // lime text + glow, not a solid dark pill.
    static let navActiveTint = Color(deskHex: "b9e86f")
    static let pillActiveBackground = Color(deskHex: "b9e86f").opacity(0.22)
    static let pillShadow = Color(deskHex: "b9e86f").opacity(0.35)
}

/// The "chalkboard" stage backdrop, ported verbatim from `.canvasStage`
/// (Dashboard.module.css:1030-1033): a 165° dark green→near-black linear
/// base plus two low-opacity radial highlights (lime top-right, blue
/// bottom-left).
private struct DeskBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(deskHex: "1c3228"),
                    Color(deskHex: "14261c"),
                    Color(deskHex: "0f1f18"),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [Color(deskHex: "b9e86f").opacity(0.14), .clear],
                center: UnitPoint(x: 0.85, y: 0.08),
                startRadius: 0,
                endRadius: 460
            )
            RadialGradient(
                colors: [Color(deskHex: "1d3a8a").opacity(0.22), .clear],
                center: UnitPoint(x: 0.15, y: 0.9),
                startRadius: 0,
                endRadius: 460
            )
        }
        .ignoresSafeArea()
    }
}

/// Wraps a plain concept id so `.sheet(item:)` (which needs `Identifiable`)
/// can present `ConceptChapterView` for whichever concept was last tapped.
private struct ChapterSheetItem: Identifiable {
    let conceptId: String
    var id: String { conceptId }
}

/// `deskHex` (not `hex`) to avoid any symbol collision with another agent's
/// own `Color(hex:)` convenience init landing in a different file in this
/// same parallel pass.
private extension Color {
    init(deskHex hex: String) {
        var sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if sanitized.hasPrefix("#") { sanitized.removeFirst() }
        var value: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&value)
        let r = Double((value & 0xFF0000) >> 16) / 255.0
        let g = Double((value & 0x00FF00) >> 8) / 255.0
        let b = Double(value & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}
