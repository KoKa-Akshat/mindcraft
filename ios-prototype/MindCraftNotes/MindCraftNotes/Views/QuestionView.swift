import SwiftUI
import PencilKit
import FirebaseAuth
import FirebaseFirestore

/// Shared hex-color helper for every hardcoded value in this file - kept as
/// a small local extension (not a global one) the same way this file always
/// has, so every literal below can be traced back to a real, named source
/// value in a code review without hunting for a separate definition file.
private extension Color {
    init(storyHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// **Round 8 rebuild - real structural + color parity with the live website,
/// verified fresh against `Practice.tsx`/`Practice.module.css` (not reused
/// from any prior round's notes).** Akshat's explicit priority this round:
/// "the current question looks nowhere like how it's displayed in the
/// website... a lot more elegant and simple... we dont need story in
/// questions... we need graph in top right and writing space is the whole
/// page."
///
/// **Two real findings this round, both confirmed by reading the CSS
/// cascade to its actual end, not its first plausible-looking rule:**
///
/// 1. **Structure**: `.sessionColumns { grid-template-columns: 1fr 320px }`
///    is the real, unconditional live grid (confirmed: `.pathLayout`'s
///    `1.15fr / min(320px,30%)` ratio the orchestrator flagged as a
///    possible alternate is a DIFFERENT screen - the topic-path/island map,
///    not the active question view; grepped `sessionColumns` usage in
///    `Practice.tsx` directly to confirm). `.sessionMain` (left) is ONLY the
///    question card - grepped `storyArtFor`/`sessionArt`: computed but its
///    render block is literally commented "removed... intentionally not
///    rendered here anymore." `.sessionAside` (right, fixed 320px) stacks
///    `GraphBox` (top, `defaultOpen` only for a graphable concept or a
///    question with real extractable points/expression) above `ScratchPad`
///    (`fillHeight`, takes the rest of the column). This directly matches
///    what round 7 already ported for the GRID RATIO, but round 7's
///    left-column still kept a Story/Graph swap picker sourced from an
///    earlier, now-superseded native-only design ask - removed below, no
///    web equivalent has ever existed for it.
///
/// 2. **Color - a real correction, not a restyle for its own sake**: round
///    7's own doc comment quoted `.shell { --practice-bg: #21616E }` as "the
///    real Practice page/shell background" - true of the FIRST rule with
///    that selector in the file, but NOT the cascade's actual winner. A
///    later block, explicitly headed "PAPER STANDARDIZATION - practice hub /
///    path / picker screens" (`Practice.module.css` ~5027), re-declares
///    `.shell, .pathShell, .matteShell { --practice-bg: var(--paper-bg);
///    --practice-surface: var(--paper-sheet); background: linear-gradient(paper
///    texture), radial-gradient(dot grid); }` - later in source order, same
///    selector, so it wins outright for the `background` property regardless
///    of the earlier teal fallback. Confirmed `--paper-bg`/`--paper-sheet`/
///    `--paper-ink`/`--paper-edge` are real, live tokens (`src/styles/paper.css`,
///    imported globally in `main.tsx`, not orphaned CSS) resolving to
///    `#f7f3ee`/`#fbf8f4`/`#1c1a17`/`#e2d8ca`. A THIRD, later still, block
///    ("FIELD JOURNAL. PAPER QUESTION TREATMENT", ~4427, its own comment:
///    "these rules come last so they win the cascade") repaints
///    `.matteShell .questionCard`/`.questionBanner`/`.questionText`/`.choice`
///    specifically off the flat teal card to a warm ivory paper sheet with a
///    dot-grid texture, `#1c1a17` ink text, and NO level-color gradient
///    banner at all (`!important` on `.questionBanner`'s background beats the
///    inline `lvBannerGradient` the JSX still sets). A FOURTH, later-still
///    block ("IMMERSIVE CANVAS SESSION", ~5389) fine-tunes further: PLAIN
///    (unselected) choices lose their card chrome entirely (`border: none
///    !important; background: transparent !important; border-radius: 0
///    !important` - just a bottom hairline divider row), while
///    selected/correct/wrong choices keep the earlier gradient-card
///    treatment from the FIELD JOURNAL block untouched. Root cause of the
///    "elegant and simple" mismatch: the live site is a warm paper journal
///    page, not a saturated teal gradient card - this is the real, sourced
///    reason for the whole restyle below, not a guess.
///
/// Root class chain confirmed live for the actual practice-session route
/// (not gap-scan): `mode === 'practice' && pPhase === 'session'` → root div
/// gets BOTH `s.shell` and `s.matteShell` (`isMatteFlow` includes
/// `'session'`), no `s.paperScan` unless `hideCorrectness` (diagnostic mode,
/// not this flow) - so the paper treatment above is genuinely what a normal
/// practice session shows, not a diagnostic-only skin.
///
/// A live visual screenshot of `mindcraft-93858.web.app` was attempted as an
/// extra cross-check per the orchestrator's request; the real practice
/// session sits behind Firebase Auth + onboarding state an unauthenticated
/// fetch cannot reach, and `WebFetch` only renders HTML→text (no CSS/visual
/// signal) even past a login wall - so this round's ground truth is the
/// literal CSS cascade read above, traced to its actual last-writer-wins
/// rule rather than its first match, which is the strongest verification
/// available in this environment short of Akshat's own on-device look.
///
/// **Round 12. ACT field modules (design PDF).** Supersedes Round 9's
/// full-page canvas overlay. Brief page 7, verbatim intent: questions in
/// one box, diagrams in another, graph/images too - but **no empty static
/// boxes** when a question has no graph/picture; writing interface with
/// calculator + tutor options lives in the field. Visual language from
/// pages 6/8–11: labeled floating cards on a soft dot-grid field.
///
/// Layout:
/// - Landscape: left column = `question.` (+ conditional `diagram.` /
///   `graph.`); right column = dedicated `writing.` canvas + tool strip.
/// - Portrait: same modules stacked, writing below.
/// - Canvas lives **only** inside `writing.` - choice taps no longer fight
///   a full-page overlay (Round 10 XCUITest pain). PassthroughCanvasView
///   still applies inside the writing box for pencil vs finger policy.
struct QuestionView: View {
    let question: SampleQuestion
    @ObservedObject var store: DrawingStore

    @State private var palmRejectionMode: PalmRejectionMode = .pencilOnly
    @State private var clearSignal = 0
    @State private var showClearConfirm = false
    @State private var strokeCount = 0
    @State private var recognizeSignal = 0
    @State private var isRecognizing = false
    @State private var recognizedExpression: String?
    @State private var recognizeError: String?
    @State private var selectedChoice: Int?
    @State private var checked = false
    @State private var outcomeSubmission: OutcomeSubmission = .idle
    /// Safari-style: hide writing chrome once work starts; reveal on scroll-up.
    @State private var toolsVisible = true
    // Round 9, live Akshat feedback: the graph now lives inline under the
    // question (see graphSection/showGraph below) instead of a fixed-height
    // side panel - real estate it permanently occupied even once a student
    // was done reading it. Collapsible, defaulting OPEN (a student should
    // see the graph the moment it's relevant, not have to discover a toggle
    // first) - see `graphSection`'s own doc comment for the toggle control.
    @State private var graphExpanded = true
    @State private var showCalculator = false
    @State private var docsToast: String?

    // MARK: Live "Call" co-working (NATIVE_APP_BUILD_PLAN.md "New product
    // surfaces since 2026-07-25" §1 - `LiveSessionClient`, a real port of
    // `app/src/lib/liveSession.ts`, wired into this screen the same place
    // web's own `CallButton` sits: `Practice.tsx`'s question-header row,
    // alongside the bookmark button).
    /// `users/{uid}.tutorId` - the button is hidden entirely with no linked
    /// tutor, same as web's `CallButton.tsx` ("a live session with no one to
    /// join is a dead end"). nil until the one-shot fetch below resolves.
    @State private var tutorId: String?
    @State private var liveSessionId: String?
    @State private var liveSessionStatus: LiveSessionStatus?
    @State private var isStartingCall = false
    @State private var sessionListener: ListenerRegistration?

    private enum OutcomeSubmission: Equatable {
        case idle, sending, saved, failed(String)
    }

    /// **Paper design tokens** - every literal ported directly from the
    /// cascade-resolved values documented in this view's top doc comment
    /// (`paper.css` custom properties + the FIELD JOURNAL/IMMERSIVE CANVAS
    /// override blocks in `Practice.module.css`), named after their CSS
    /// custom-property source so a future re-verification pass can grep the
    /// web file for the same string.
    private enum Paper {
        static let bg = Color(storyHex: "F7F3EE")            // --paper-bg
        static let sheet = Color(storyHex: "FBF8F4")         // --paper-sheet
        static let sheetRecessed = Color(storyHex: "F1EADF") // --paper-sheet-recessed
        static let edge = Color(storyHex: "E2D8CA")          // --paper-edge
        static let ink = Color(storyHex: "1C1A17")           // --paper-ink
        static let inkKatha = Color(storyHex: "232F4E")      // --paper-ink-katha
        static let inkDim = Color(storyHex: "6F6A61")        // --paper-ink-dim
        static let accentBlue = Color(storyHex: "1D3A8A")    // --paper-accent-blue
        static let bannerCream = Color(storyHex: "F7F3EC")   // .matteShell .questionBanner (final winner, ~5416)
        static let tealInk = Color(storyHex: "3A6B6C")       // .matteShell .examTagLight / .nextBtn ink accent
        static let tealTint = Color(storyHex: "4F8A8B").opacity(0.14) // examTagLight/qCall background family
        static let dotGrid = Color(storyHex: "665C4E").opacity(0.18) // .questionCard::before dot texture
    }

    var body: some View {
        GeometryReader { screenGeo in
            let wide = screenGeo.size.width > screenGeo.size.height + 40
            let safeH = max(0, screenGeo.size.height)
            ZStack {
                ActFieldBackground()
                Group {
                    if wide {
                        wideFieldLayout(height: safeH)
                    } else {
                        ScrollView {
                            tallFieldLayout(minWritingHeight: max(320, safeH * 0.48))
                                .padding(.horizontal, 16)
                                .padding(.top, 12)
                                .padding(.bottom, 28)
                        }
                    }
                }
            }
        }
        .background(ActField.fieldBg)
        .sheet(isPresented: $showCalculator) { ActFieldCalculatorSheet() }
        .task { await loadTutorId() }
        .onDisappear { endLiveCallIfActive() }
    }

    /// Landscape / wide iPad: content modules left (~38%), writing field the
    /// rest. Round 14 polish: more breathing room for the workspace feel.
    private func wideFieldLayout(height: CGFloat) -> some View {
        HStack(alignment: .top, spacing: 18) {
            ScrollView {
                contentModules
                    .padding(.trailing, 2)
                    .padding(.bottom, 28)
            }
            .frame(maxWidth: 400)

            writingModule(minHeight: max(300, height - 24))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 14)
    }

    /// Portrait: stack modules; writing gets a solid dedicated band.
    private func tallFieldLayout(minWritingHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            contentModules
            writingModule(minHeight: minWritingHeight)
        }
    }

    /// Question always; diagram / graph only when this question has them
    /// (design brief: no empty static media boxes).
    private var contentModules: some View {
        VStack(alignment: .leading, spacing: 14) {
            // No accessibilityIdentifier on these module wrappers. SwiftUI
            // parent ids swallow child hooks (`questionPrompt`,
            // `diagramRealImage`, `choiceButton_*`) the same way Round 10's
            // prompt wrapper did.
            ActFieldModule(title: "question.") {
                questionCard
            }

            if hasDiagram {
                ActFieldModule(title: "diagram.") {
                    diagramModuleBody
                        .padding(16)
                }
            }

            if showGraph {
                ActFieldModule(title: "graph.") {
                    graphSection
                        .padding(10)
                }
            }
        }
    }

    // MARK: Live "Call" co-working - data flow

    /// One-shot fetch, matching how `CallButton.tsx` receives `tutorId` as a
    /// plain prop from its parent rather than subscribing itself.
    private func loadTutorId() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        tutorId = await LiveSessionClient.fetchTutorId(for: uid)
    }

    /// Starts a real `liveSessions` doc (`contextType: .question`, this
    /// question's own id/concept/text snapshotted at creation time, exactly
    /// like `CallButton.tsx`'s `start()`) and subscribes to the session doc
    /// so `liveSessionStatus` stays live.
    private func startLiveCall() {
        guard let user = Auth.auth().currentUser, !isStartingCall else { return }
        isStartingCall = true
        Task {
            let sessionId = await LiveSessionClient.createSession(.init(
                studentId: user.uid,
                tutorId: tutorId,
                contextType: .question,
                questionId: question.id,
                conceptId: question.conceptId,
                conceptName: question.conceptLabel,
                questionText: question.rawQuestion
            ))
            await MainActor.run {
                isStartingCall = false
                guard let sessionId else { return }
                liveSessionId = sessionId
                liveSessionStatus = .active
                sessionListener = LiveSessionClient.subscribeSession(sessionId) { entry in
                    liveSessionStatus = entry?.status
                }
            }
        }
    }

    /// Mirrors `LiveSessionPage.tsx`'s student page-unmount effect - native
    /// only ever plays the student/creator role (a tutor/parent joins from
    /// the web app), so this is unconditional rather than role-gated.
    private func endLiveCallIfActive() {
        sessionListener?.remove()
        sessionListener = nil
        guard let sessionId = liveSessionId else { return }
        liveSessionId = nil
        liveSessionStatus = nil
        Task { await LiveSessionClient.endSession(sessionId) }
    }

    /// Small icon+label pill in the question banner's top row, matching
    /// where web's `CallButton` sits (`Practice.tsx`'s question-header row,
    /// beside the bookmark button). Restyled this round for the light paper
    /// banner (was white-on-teal; a white-opacity pill on cream would be
    /// near-invisible) using the same teal-ink family as `examTagLight`.
    @ViewBuilder
    private var callButton: some View {
        if let tutorId, !tutorId.isEmpty {
            if liveSessionId != nil {
                Button(action: endLiveCallIfActive) {
                    HStack(spacing: 5) {
                        Circle().fill(Color(storyHex: "1F6B45")).frame(width: 6, height: 6)
                        Text("live \u{00B7} end call")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(Paper.tealInk)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Paper.tealTint))
                }
                .accessibilityIdentifier("liveCallEndButton")
            } else {
                Button(action: startLiveCall) {
                    HStack(spacing: 5) {
                        if isStartingCall {
                            ProgressView().controlSize(.mini).tint(Paper.tealInk)
                        } else {
                            Image(systemName: "phone.fill")
                                .font(.system(size: 9, weight: .bold))
                        }
                        Text(isStartingCall ? "starting\u{2026}" : "call")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(Paper.tealInk)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Paper.tealTint))
                }
                .disabled(isStartingCall)
                .accessibilityIdentifier("liveCallStartButton")
            }
        }
    }

    // MARK: Field modules - question / diagram / writing

    /// Dedicated writing field (design brief). Canvas stays inside this box
    /// so question/choice hit-testing is clean again.
    private func writingModule(minHeight: CGFloat) -> some View {
        ActFieldModule(title: "writing.", fill: ActField.card, minHeight: minHeight) {
            VStack(spacing: 0) {
                if toolsVisible {
                    writingToolStrip
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
                ZStack(alignment: .bottomTrailing) {
                    // Round 12: canvas is scoped to `writing.` only - no longer
                    // overlays choices - so the Round 10 `--ui-testing-in-memory`
                    // allowsHitTesting(false) accommodation is unnecessary and
                    // would break ContentView harness drawing tests.
                    canvasOverlay
                    if toolsVisible {
                        floatingToolbar
                            .padding(12)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .frame(maxWidth: .infinity, minHeight: max(220, minHeight - 56), maxHeight: .infinity)
                .simultaneousGesture(workScrollChromeGesture)
            }
            .animation(.easeInOut(duration: 0.22), value: toolsVisible)
            .onChange(of: strokeCount) { _, count in
                // First strokes = working → tuck tools away for canvas room.
                if count > 0, toolsVisible {
                    withAnimation(.easeInOut(duration: 0.22)) { toolsVisible = false }
                }
            }
            .onChange(of: question.id) { _, _ in
                toolsVisible = true
            }
        }
    }

    /// Finger drag up hides chrome; drag down (scroll up) brings it back.
    private var workScrollChromeGesture: some Gesture {
        DragGesture(minimumDistance: 16, coordinateSpace: .local)
            .onEnded { value in
                let dy = value.translation.height
                if dy > 28 {
                    withAnimation(.easeInOut(duration: 0.22)) { toolsVisible = true }
                } else if dy < -28 {
                    withAnimation(.easeInOut(duration: 0.22)) { toolsVisible = false }
                }
            }
    }

    /// Calculator / tutor / docs / pencil affordances on the writing field.
    private var writingToolStrip: some View {
        HStack(spacing: 8) {
            toolChip(icon: "function", label: "Calc", id: "actToolCalculator") {
                showCalculator = true
            }
            toolChip(icon: "phone.fill", label: "Tutor", id: "actToolTutor") {
                if liveSessionId != nil {
                    endLiveCallIfActive()
                } else if tutorId != nil {
                    startLiveCall()
                } else {
                    docsToast = "Link a tutor on the web desk to call from here."
                }
            }
            toolChip(icon: "doc.richtext", label: "Docs", id: "actToolDocs") {
                docsToast = "Google Docs drop-in lands next - field space is ready."
            }
            Spacer(minLength: 0)
            if let docsToast {
                Text(docsToast)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(ActField.inkDim)
                    .lineLimit(2)
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.8) {
                            if self.docsToast != nil { self.docsToast = nil }
                        }
                    }
            }
            callButton
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(ActField.card.opacity(0.96))
        .overlay(Rectangle().fill(ActField.edge).frame(height: 1), alignment: .bottom)
    }

    private func toolChip(icon: String, label: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .bold))
                Text(label)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
            }
            .foregroundColor(ActField.ink)
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(Capsule().fill(ActField.accentSoft))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    /// Question card body inside the `question.` module - prompt + choices
    /// only. Diagrams move to their own module when present.
    private var questionCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            banner
            cardBody
        }
        .background(Paper.sheet)
        .overlay(paperDotGrid.clipShape(RoundedRectangle(cornerRadius: ActField.corner, style: .continuous)))
        .clipShape(RoundedRectangle(cornerRadius: ActField.corner, style: .continuous))
    }

    /// `.questionCard::before`'s dot-grid texture (`radial-gradient(circle,
    /// rgba(102,92,78,0.18) 1px, transparent 1px) 9px 9px / 18px 18px`) -
    /// SwiftUI has no radial-gradient-as-repeating-background-image
    /// primitive, so drawn directly via `Canvas`, same technique this file
    /// already used for the (now-removed) story excerpt's ruled-notebook
    /// lines.
    private var paperDotGrid: some View {
        Canvas { context, size in
            let spacing: CGFloat = 18
            var y: CGFloat = 9
            while y < size.height {
                var x: CGFloat = 9
                while x < size.width {
                    context.fill(Path(ellipseIn: CGRect(x: x - 0.75, y: y - 0.75, width: 1.5, height: 1.5)), with: .color(Paper.dotGrid))
                    x += spacing
                }
                y += spacing
            }
        }
        .allowsHitTesting(false)
    }

    /// `.questionBanner` final cascade winner: flat `#f7f3ec` cream, a
    /// hairline bottom border, no level-color gradient. `examTagLight`
    /// repurposed for the concept-label pill (teal-tinted, not white/20%).
    private var banner: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                Text(question.conceptLabel.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.6)
                    .foregroundColor(Paper.tealInk)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(Paper.tealTint)
                    .clipShape(Capsule())

                Spacer(minLength: 0)

                callButton

                Text(question.id)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(Paper.inkDim.opacity(0.7))
            }

            // Text-only prompt. Diagram segments render in `diagram.` module
            // (design brief separation). Keep `questionPrompt` on text for
            // XCUITest; never put the id on a wrapper that also holds SVG.
            questionPromptText
        }
        .padding(EdgeInsets(top: 20, leading: 22, bottom: 16, trailing: 22))
        .background(Paper.bannerCream)
        .overlay(Rectangle().fill(Paper.edge.opacity(0.5)).frame(height: 1), alignment: .bottom)
    }

    /// `.questionBody`: plain padding on the sheet's own paper fill (no
    /// separate background) - choices, then the check-answer control.
    private var cardBody: some View {
        VStack(alignment: .leading, spacing: 14) {
            choiceList

            if selectedChoice != nil {
                Button(action: submitAnswer) {
                    Text(checked ? (selectedChoice == question.correctIndex ? "Correct! \u{2713}" : "Not quite") : "Check answer")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(Paper.sheet)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                }
                .background(checkButtonColor)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .disabled(checked)
                .opacity(checked ? 0.75 : 1.0)
                .accessibilityIdentifier("checkAnswerButton")

                outcomeSubmissionLabel
            }
        }
        .padding(EdgeInsets(top: 18, leading: 24, bottom: 22, trailing: 24))
    }

    /// `.nextBtn` on paper (`#3a6b6c` teal ink / `#fbf8f4` cream text) for
    /// the neutral/correct state; wrong stays the same warm-orange
    /// `.feedbackBannerWrong` family every prior round already verified -
    /// this app deliberately never shows harsh red for a wrong SUMMARY
    /// state, only on the individual wrong choice card.
    private var checkButtonColor: Color {
        if checked && selectedChoice != question.correctIndex {
            return Color(storyHex: "C9963F")
        }
        return Paper.tealInk
    }

    /// Real port of the live cascade's two-tier choice treatment (see this
    /// view's top doc comment, "IMMERSIVE CANVAS SESSION" block): a PLAIN,
    /// unselected choice is a flat list row with only a bottom hairline
    /// divider - no card chrome at all. Once selected/checked, it becomes a
    /// full rounded card with a colored gradient + glow ring. This is a real
    /// visual state change on web, not a simplification.
    private var choiceList: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(question.choices.enumerated()), id: \.offset) { index, choice in
                let state = choiceState(for: index)
                // Round 10: plain SwiftUI `Button` inside this ScrollView +
                // full-page canvas host was reachable to XCUITest (`isHittable`
                // true, tap returned OK) but never fired its action - three
                // retry strategies confirmed it. A tappable `HStack` with an
                // explicit `contentShape` + combined accessibility element is
                // the reliable pattern for row selection here; same visual
                // states, same identifier contract for tests.
                HStack(spacing: 10) {
                    Text(choiceLetter(index).replacingOccurrences(of: ".", with: ""))
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .frame(width: 26, height: 26)
                        .background(Circle().fill(state.tileColor))
                        .foregroundColor(state.tileTextColor)
                        .overlay(Circle().strokeBorder(state.tileBorderColor, lineWidth: 1.5))
                    Text(choice)
                        .font(.callout)
                        .foregroundColor(Paper.ink)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, state.isCard ? 12 : 9)
                .padding(.horizontal, state.isCard ? 14 : 2)
                .background(state.isCard ? AnyShapeStyle(state.cardFill) : AnyShapeStyle(Color.clear))
                .overlay(
                    Group {
                        if state.isCard {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(state.borderColor, lineWidth: 1.5)
                        } else {
                            Rectangle()
                                .fill(Paper.inkKatha.opacity(0.14))
                                .frame(height: 1)
                                .frame(maxHeight: .infinity, alignment: .bottom)
                        }
                    }
                )
                .clipShape(state.isCard ? AnyShape(RoundedRectangle(cornerRadius: 16, style: .continuous)) : AnyShape(Rectangle()))
                .contentShape(Rectangle())
                .onTapGesture {
                    if !checked { selectedChoice = index }
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)
                .accessibilityIdentifier("choiceButton_\(index)")
                .accessibilityAction {
                    if !checked { selectedChoice = index }
                }
            }
        }
    }

    /// Real values ported from the cascade's final winners for
    /// `.choiceSelected`/`.choiceCorrect`/`.choiceWrong` (gradient card,
    /// FIELD JOURNAL block) and the plain `.choice` (flat row, IMMERSIVE
    /// CANVAS block, `!important`) - see this view's top doc comment.
    private enum ChoiceState {
        case plain, selected, correct, wrong

        /// Plain choices render as a flat divider row (`.matteShell .choice
        /// { background: transparent !important; border: none !important }`,
        /// wins over the base card treatment via `!important`); every other
        /// state keeps the full rounded gradient card.
        var isCard: Bool { self != .plain }

        var cardFill: LinearGradient {
            switch self {
            case .plain: return LinearGradient(colors: [.clear], startPoint: .top, endPoint: .bottom)
            case .selected: return LinearGradient(colors: [Color(storyHex: "F3FFE4"), Color(storyHex: "FFFDF8")], startPoint: .topLeading, endPoint: .bottomTrailing)
            case .correct: return LinearGradient(colors: [Color(storyHex: "E8FFF4"), Color(storyHex: "F4FFF8")], startPoint: .topLeading, endPoint: .bottomTrailing)
            case .wrong: return LinearGradient(colors: [Color(storyHex: "FFF6EF"), Color(storyHex: "FFE8D8")], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        var borderColor: Color {
            switch self {
            case .plain: return .clear
            case .selected: return Color(storyHex: "143A2E")
            case .correct: return Color(storyHex: "1F6B45")
            case .wrong: return Color(storyHex: "E8A672")
            }
        }
        /// `.choiceLetter` border is UNIFORM across every state in the real
        /// cascade (`.matteShell .choiceLetter { border: 1.5px solid
        /// rgba(58,47,85,0.2) !important }` - the later block wins for
        /// border regardless of state), only background/text vary.
        var tileBorderColor: Color { Color(storyHex: "3A2F55").opacity(0.2) }
        var tileColor: Color {
            switch self {
            case .plain: return Color(storyHex: "FFE566")
            case .selected: return Color(storyHex: "4F8A8B").opacity(0.18)
            case .correct: return Color(storyHex: "22C55E").opacity(0.14)
            case .wrong: return Color(storyHex: "F43F5E").opacity(0.12)
            }
        }
        var tileTextColor: Color {
            switch self {
            case .plain: return Color(storyHex: "3A2F55")
            case .selected: return Color(storyHex: "1C1A17")
            case .correct: return Color(storyHex: "166534")
            case .wrong: return Color(storyHex: "9F1239")
            }
        }
    }

    /// Marks the answer checked locally, then posts the real outcome to
    /// `/record-outcomes` - the practice→mastery feedback loop.
    private func submitAnswer() {
        checked = true
        guard let selectedChoice else { return }
        outcomeSubmission = .sending
        Task {
            do {
                try await OutcomeClient.recordOutcome(
                    conceptId: question.conceptId,
                    questionId: question.id,
                    level: question.level,
                    selectedChoiceIndex: selectedChoice,
                    correctIndex: question.correctIndex
                )
                outcomeSubmission = .saved
            } catch {
                outcomeSubmission = .failed(error.localizedDescription)
            }
        }
    }

    @ViewBuilder
    private var outcomeSubmissionLabel: some View {
        switch outcomeSubmission {
        case .idle:
            EmptyView()
        case .sending:
            HStack(spacing: 4) {
                ProgressView().controlSize(.mini)
                Text("Saving to your progress\u{2026}")
            }
            .font(.caption2)
            .foregroundColor(Paper.inkDim)
            .accessibilityIdentifier("outcomeSendingLabel")
        case .saved:
            Label("Saved to your progress", systemImage: "checkmark.circle.fill")
                .font(.caption2)
                .foregroundColor(Color(storyHex: "1F6B45"))
                .accessibilityIdentifier("outcomeSavedLabel")
        case .failed(let message):
            Label("Couldn't save (\(message))", systemImage: "exclamationmark.triangle.fill")
                .font(.caption2)
                .foregroundColor(Color(storyHex: "C9963F"))
                .accessibilityIdentifier("outcomeFailedLabel")
        }
    }

    private func choiceState(for index: Int) -> ChoiceState {
        if checked {
            if index == question.correctIndex { return .correct }
            if index == selectedChoice { return .wrong }
            return .plain
        }
        return index == selectedChoice ? .selected : .plain
    }

    private var promptSegments: [QuestionTextSegment] {
        AltDiagramSplitter.split(question.rawQuestion)
    }

    private var diagramAlts: [String] {
        promptSegments.compactMap {
            if case .diagram(let alt) = $0 { return alt }
            return nil
        }
    }

    /// True when this question has a diagram callout and/or a bundled SVG.
    /// Empty media modules are omitted entirely (design brief).
    private var hasDiagram: Bool {
        !diagramAlts.isEmpty || GeneratedDiagramLookup.url(forQuestionId: question.id) != nil
    }

    /// Prompt text only - diagrams live in the `diagram.` module.
    @ViewBuilder
    private var questionPromptText: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(promptSegments.enumerated()), id: \.offset) { _, segment in
                if case .text(let raw) = segment {
                    let cleaned = LaTeXDisplayText.plainText(from: raw)
                    if !cleaned.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(cleaned)
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundColor(Paper.ink)
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("questionPrompt")
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var diagramModuleBody: some View {
        if !diagramAlts.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(diagramAlts.enumerated()), id: \.offset) { _, alt in
                    DiagramSegmentView(questionId: question.id, alt: alt)
                }
            }
        } else if GeneratedDiagramLookup.url(forQuestionId: question.id) != nil {
            DiagramSegmentView(questionId: question.id, alt: "Bundled diagram")
        }
    }

    // MARK: The graph - `GraphBox`'s real-data gate, now rendered inline
    // under the question card (round 9) rather than in a fixed side column.

    /// Real per-question graph data (`PlottablePointsExtractor`, a scoped
    /// port of `lib/plottablePoints.ts`) - extracted once per question from
    /// its own raw text. `nil`/`[]` on a question with no graphable content.
    private var extractedGraphPoints: [PlottablePointsExtractor.Point] {
        PlottablePointsExtractor.extractPoints(from: question.rawQuestion) ?? []
    }
    private var extractedGraphExpression: String? {
        PlottablePointsExtractor.extractExpression(from: question.rawQuestion)
    }

    /// Literal port of web's `GraphBox` `defaultOpen` gate
    /// (`GRAPHABLE_CONCEPT_IDS.has(...) || !!graphPoints || !!graphExpr`) -
    /// the graph only appears when THIS question has real extractable data,
    /// or once a handwritten expression has actually been recognized (the
    /// recognize→graph pipeline still needs somewhere to show its result
    /// even for a question with no pre-existing graph data). When neither
    /// applies, the page is just the question card with the full-page
    /// canvas overlaid on it - this is the real mechanism behind "writing
    /// space is the whole page" for the common case, not a cosmetic default.
    ///
    /// `--ui-testing-force-graph`: the pre-existing `testGraphBoxAcceptsLaTeXAndScreenshots`
    /// XCUITest verifies GraphView's own LaTeX-parsing engine in isolation
    /// against a non-graphable legacy-harness question, previously reached
    /// via a "Graph" tab this round removes - same accommodation pattern
    /// this codebase already uses for `--ui-testing-force-welcome`.
    private var showGraph: Bool {
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-force-graph") { return true }
        return !extractedGraphPoints.isEmpty || extractedGraphExpression != nil || recognizedExpression != nil
    }

    /// The graph, now stacked directly under the question card as real page
    /// content (round 9 - both Akshat's "graph under the question" note and
    /// the natural consequence of there being no side column anymore), only
    /// rendered when `showGraph` gates it on. Same `GraphView` component,
    /// just full-width instead of pinned into a fixed 320pt aside.
    ///
    /// Round 9, second live ask: a real, obvious expand/collapse control
    /// (`graphExpanded`) - a graph that's always rendered at a fixed 300pt
    /// permanently eats page space even once a student is done reading it,
    /// which is exactly the kind of fixed writing-space tax priority 1's
    /// full-page canvas is meant to eliminate elsewhere on this same screen.
    /// The header row (label + chevron button) is ALWAYS visible so the
    /// control itself is never hidden; only the plot body collapses.
    private var graphSection: some View {
        VStack(spacing: 0) {
            Button(action: { withAnimation(.easeInOut(duration: 0.2)) { graphExpanded.toggle() } }) {
                HStack(spacing: 6) {
                    Text("GRAPH")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .tracking(1)
                        .foregroundColor(Paper.inkDim)
                    Spacer(minLength: 0)
                    Image(systemName: graphExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Paper.inkDim)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("graphCollapseToggle")

            if graphExpanded {
                graphPlot
            }
        }
        .background(Paper.sheet)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Paper.edge, lineWidth: 1)
        )
    }

    private var graphPlot: some View {
        GraphView(
            points: extractedGraphPoints,
            initialExpression: extractedGraphExpression,
            recognizedExpression: recognizedExpression
        )
        .frame(height: 300)
        .frame(maxWidth: .infinity)
        .overlay(Rectangle().fill(Paper.edge.opacity(0.6)).frame(height: 1), alignment: .top)
    }

    // MARK: The writing layer - round 9

    /// Writing-field canvas (Round 12 - scoped to the `writing.` module).
    private var canvasOverlay: some View {
        CanvasView(
            questionId: question.id,
            palmRejectionMode: palmRejectionMode,
            store: store,
            clearSignal: $clearSignal,
            recognizeSignal: $recognizeSignal,
            onDrawingCaptured: { drawing, canvasSize in
                recognize(drawing: drawing, canvasSize: canvasSize)
            },
            onStrokeCountChange: { count in strokeCount = count },
            onStrokeCompleted: liveSessionId.map { sessionId in
                { points in
                    guard let uid = Auth.auth().currentUser?.uid else { return }
                    Task {
                        await LiveSessionClient.appendStroke(
                            sessionId: sessionId,
                            authorId: uid,
                            authorRole: .student,
                            points: points
                        )
                    }
                }
            }
        )
        .id(question.id)
    }

    /// Compact floating pencil-tools toolbar - replaces round 8's boxed
    /// "Work it out" panel (header text, a bordered/recessed card, an
    /// "INPUT" caption) entirely; that WAS the "walled-off writing box with
    /// labeled controls" Akshat's own words rejected this round. Lives
    /// outside the `ScrollView` (see `body`) so it never scrolls away, and
    /// is a later `ZStack` sibling of it, so it's always the topmost view
    /// at its own screen region - no passthrough logic needed here the way
    /// `canvasOverlay` needs it, since this toolbar isn't part of that
    /// overlay composition at all, it just visually sits above it.
    /// Reuses `toolbarPill` verbatim (same pill chrome language as before),
    /// just regrouped into a small floating card instead of a full-width
    /// bordered panel.
    private var floatingToolbar: some View {
        VStack(alignment: .trailing, spacing: 8) {
            HStack(spacing: 8) {
                Picker("Input", selection: $palmRejectionMode) {
                    ForEach(PalmRejectionMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("palmRejectionPicker")

                Text(strokeCountLabel)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(Paper.inkDim)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Paper.edge.opacity(0.5)))
                    .accessibilityIdentifier("strokeCountLabel")
            }

            HStack(spacing: 8) {
                if showClearConfirm {
                    toolbarPill(icon: "trash.fill", label: "Confirm", tint: Color(storyHex: "C9963F").opacity(0.18), textColor: Color(storyHex: "8A5A1E")) {
                        clearSignal += 1
                        showClearConfirm = false
                    }
                    toolbarPill(icon: "xmark", label: "Cancel", tint: Paper.edge.opacity(0.5), textColor: Paper.inkDim) {
                        showClearConfirm = false
                    }
                } else {
                    toolbarPill(icon: "trash", label: "Clear", tint: Paper.edge.opacity(0.45), textColor: Paper.inkDim) {
                        showClearConfirm = true
                    }
                    Button {
                        recognizeError = nil
                        isRecognizing = true
                        recognizeSignal += 1
                    } label: {
                        HStack(spacing: 5) {
                            if isRecognizing {
                                ProgressView().controlSize(.mini).tint(Paper.sheet)
                            } else {
                                Image(systemName: "wand.and.stars")
                                    .font(.system(size: 11, weight: .semibold))
                            }
                            Text(isRecognizing ? "Reading\u{2026}" : "Recognize")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                        }
                        .foregroundColor(Paper.sheet)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(Paper.tealInk))
                    }
                    .disabled(isRecognizing || strokeCount == 0)
                    .opacity(strokeCount == 0 ? 0.5 : 1.0)
                    .accessibilityIdentifier("recognizeButton")
                }
            }

            if let recognizeError {
                Text(recognizeError)
                    .font(.caption2)
                    .foregroundColor(Color(storyHex: "C9963F"))
                    .accessibilityIdentifier("recognizeErrorLabel")
            }
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Paper.edge, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.10), radius: 12, x: 0, y: 5)
        .frame(maxWidth: 340, alignment: .trailing)
    }

    /// Sends the captured drawing to MyScript; a successful recognition
    /// surfaces the graph automatically via `showGraph` now including
    /// `recognizedExpression != nil` - no tab to switch to anymore.
    private func recognize(drawing: PKDrawing, canvasSize: CGSize) {
        Task {
            defer { isRecognizing = false }
            do {
                let latex = try await MyScriptRecognizer.recognizeLatex(drawing: drawing, canvasSize: canvasSize)
                recognizedExpression = latex
            } catch {
                recognizeError = error.localizedDescription
            }
        }
    }

    private var strokeCountLabel: String {
        strokeCount == 1 ? "1 stroke" : "\(strokeCount) strokes"
    }

    private func toolbarPill(icon: String, label: String, tint: Color, textColor: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                Text(label)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
            }
            .foregroundColor(textColor)
            .padding(.horizontal, 11)
            .padding(.vertical, 8)
            .background(Capsule().fill(tint))
        }
    }

    private func choiceLetter(_ index: Int) -> String {
        let letters = ["A", "B", "C", "D", "E"]
        return index < letters.count ? "\(letters[index])." : "\(index + 1)."
    }
}

/// Renders one `(Diagram: ...)` segment: a real generated image when this
/// exact question id has a bundled SVG in `Resources/generatedDiagrams/`
/// (same lookup-by-question-id convention as web's `generatedDiagramFor()`),
/// else a clearly-framed caption. Re-themed this round for the paper card
/// (`.matteShell .questionVisual`: `#f7f3ee` off-white, `rgba(102,92,78,0.18)`
/// border - was a teal-card-era accentColor tint).
private struct DiagramSegmentView: View {
    let questionId: String
    let alt: String

    var body: some View {
        if let url = GeneratedDiagramLookup.url(forQuestionId: questionId) {
            SVGImageView(fileURL: url)
                .frame(minHeight: 180, maxHeight: 260)
                .frame(maxWidth: .infinity)
                .background(Color(storyHex: "F7F3EE"))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color(storyHex: "665C4E").opacity(0.18), lineWidth: 1))
                // Round 9 hook for XCUITest - children: .ignore so the
                // WKWebView inside SVGImageView doesn't replace this id
                // with its own (or inherit a parent `questionPrompt`).
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Diagram")
                .accessibilityIdentifier("diagramRealImage")
        } else {
            HStack(alignment: .top, spacing: 8) {
                Text("\u{2B21}")
                    .foregroundColor(Color(storyHex: "6F6A61"))
                Text("Picture: \(AltDiagramSplitter.humanizeCaption(alt))")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(Color(storyHex: "6F6A61"))
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(storyHex: "F7F3EE"))
            .overlay(
                Rectangle()
                    .fill(Color(storyHex: "1D3A8A").opacity(0.35))
                    .frame(width: 2),
                alignment: .leading
            )
        }
    }
}
