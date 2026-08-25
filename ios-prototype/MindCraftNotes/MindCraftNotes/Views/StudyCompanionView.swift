import SwiftUI
import UIKit

/// The merged Learn+Practice AI study companion - Gurukul (2026-08-23,
/// explicit ask: "Learn and Practice can be merged and have to kind of
/// generate sims and kind of help you talk vocally one-on-one based on
/// what your goal is"). Presented as FieldDeskView's own full-screen
/// `.studyCompanion` overlay.
///
/// REDESIGNED 2026-08-25 (direct founder feedback, verbatim: "instead of a
/// screen, Jesse in the center glowing, talking back to you, listening to
/// you, reasoning live... You're talking to almost like Jarvis... it
/// should even have a moving geometric center"): the chat-bubble wall is
/// gone from the primary surface. What's here now:
///
/// - `JesseOrbView` - a live, animated geometric center (spinning tick
///   ring + counter-rotating dashed ring + reel-hub core, real Canvas
///   drawing on a TimelineView clock, not a static image), whose motion,
///   color and glow track the real call state: listening / thinking /
///   speaking / building / line closed. The reel motif comes straight
///   from the founder's saved reference video (~/Downloads/kick - two
///   spinning tape reels on a flat bold field).
/// - Jesse's latest line and the student's live transcript render around
///   the orb - one exchange at a time, like a conversation, not a chat
///   log. The full history is still one tap away (clock icon) for
///   continuity, but it's a drawer, not the screen.
/// - A live build ribbon while a lesson generates in the background
///   (`jesseCall.generationProgress`) - the conversation stays open the
///   whole time, which is the redesign's core loop: state a topic, answer
///   one real clarifying question, keep talking while the book builds,
///   then the finished book surfaces and the line hangs up on its own.
///
/// PRESERVED deliberately (founder, same conversation: "I really like the
/// little note icon I click on... I really like the format of the
/// contents being displayed... the book that opens up once sims are
/// created... lovely"): the note icon that reopens the built lesson, the
/// Save to Binder action, and - untouched - the BookReaderView /
/// StudySessionView reading experience this screen hands off into. The
/// typed input bar, upload path, mic toggle, and every accessibility
/// identifier also carry over unchanged so the existing wiring and tests
/// keep meaning something.
struct StudyCompanionView: View {
    var studentName: String
    var onClose: () -> Void
    var onSaveSession: (_ topic: String, _ transcript: String) -> Void
    /// Real "useful and easy to navigate" fix (2026-08-25): Constellation's
    /// node detail panel had an "Open lesson" button wired to an empty
    /// closure - tapping it did nothing at all. Set when arriving from a
    /// tapped Constellation node, submitted through the same form pipeline
    /// a typed/form request uses, so the two features actually connect
    /// instead of being two dead-end islands.
    var initialTopic: String? = nil

    @EnvironmentObject private var jesseCall: JesseCallSession
    @State private var draftText = ""
    @State private var showFileImporter = false
    @State private var isUploading = false
    @State private var uploadNotice: String?
    @State private var didSave = false
    /// Whether the generated-lesson overlay is showing. Separate from
    /// `jesseCall.workDashboardLesson` itself so dismissing the overlay to
    /// keep talking doesn't lose the lesson.
    @State private var showLesson = false
    @State private var showHistory = false
    @State private var presentedMicroSim: MicroSimRecord?
    @State private var presentedGeneratedSim: GeneratedSimResult?

    // MARK: - Learn form (2026-08-25, explicit ask: "a cute little
    // questionnaire... What would you like to learn, then another field
    // level, and things we need to create the best sim") - a structured
    // alternative to the spoken/typed clarify exchange, shown before a
    // conversation starts. Voice/typing still work (the mic + input bar
    // stay in the footer) - this is an additional, more predictable path
    // in, not a replacement for the conversational one.
    @State private var formTopic = ""
    @State private var formLevel: String?
    @State private var formContentType: String?

    private var ink: Color { Color(shex: "0c1207") }
    private var cream: Color { Color(shex: "f3f1ec") }
    private var lime: Color { Color(shex: "c4f547") }

    var body: some View {
        ZStack {
            stage
                // Real bug fix (2026-08-25, explicit ask: "the keyboard
                // appears but wont close when i lic on somehwere else on
                // the screen... hard to hit enter or done when creating
                // sims"). Neither text field here submits on Return (both
                // are `axis: .vertical`, so Return inserts a newline, not
                // a submit) and nothing was dismissing the keyboard on an
                // outside tap - once it was up there was no way to see the
                // Create/send button it was covering. `simultaneousGesture`
                // (not `onTapGesture`) so this fires alongside taps on real
                // buttons/fields underneath instead of stealing them.
                .simultaneousGesture(TapGesture().onEnded(hideKeyboard))

            // Same lesson hand-off as before the redesign - the READING
            // experience is explicitly not what's being redesigned.
            // BookReaderView preferred whenever a real AssembledBook
            // exists; StudySessionView stays the fallback for the thinner
            // archive-RAG/outline paths.
            if showLesson, let book = jesseCall.openedChapterBook {
                BookReaderView(
                    book: book,
                    generationInfo: jesseCall.openedChapterBookGenerationInfo,
                    focusConceptIds: jesseCall.openedChapterBookFocusConceptIds,
                    onClose: { showLesson = false }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .zIndex(50)
            } else if showLesson, let lesson = jesseCall.workDashboardLesson {
                StudySessionView(
                    lesson: lesson,
                    onClose: { showLesson = false },
                    onOpenMicroSim: { presentedMicroSim = $0 },
                    onOpenGeneratedSim: { presentedGeneratedSim = $0 }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .zIndex(50)
            }

            if showHistory {
                historyDrawer
                    .transition(.move(edge: .trailing).combined(with: .opacity))
                    .zIndex(60)
            }
        }
        .onAppear {
            jesseCall.studyCompanionPresented = true
            enterStudyMode()
            if let initialTopic {
                // Same "submit through the real form pipeline" pattern
                // the UI-testing script below uses - a beat after begin()
                // so the greeting has already been appended, otherwise
                // this student turn would land before Jesse's own "Heyy!"
                // and read backwards in the transcript.
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 300_000_000)
                    jesseCall.submitLearnForm(topic: initialTopic, prefs: LearnPreferences(), grade: nil)
                }
            }
            // Scripted typed conversation (2026-08-25) - drives the REAL
            // learn flow (extract topic -> clarify -> Tier-0 library
            // delivery -> auto hang-up) through the same submitText path a
            // student's typing uses, so the full loop can be verified with
            // screenshots on a device with no tap automation. "calculus"
            // is deliberate: it whole-title-matches the synced library
            // book (23 sections, all with sims), so the scripted run never
            // triggers paid generation.
            let scriptArgs = ProcessInfo.processInfo.arguments
            if scriptArgs.contains("--ui-testing-gurukul-script") {
                // Optional topic override: `--ui-testing-gurukul-topic <topic>`
                // (e.g. "US History" to drive the founder's exact repro
                // through the fixed matcher + background generation).
                var topic = "calculus"
                if let idx = scriptArgs.firstIndex(of: "--ui-testing-gurukul-topic"), scriptArgs.indices.contains(idx + 1) {
                    topic = scriptArgs[idx + 1]
                }
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 4_000_000_000)
                    jesseCall.submitText("I want to learn \(topic)")
                    try? await Task.sleep(nanoseconds: 8_000_000_000)
                    jesseCall.submitText("a reading please, beginner level")
                    try? await Task.sleep(nanoseconds: 25_000_000_000)
                    if jesseCall.generationProgress != nil {
                        // Mid-build status question - exercises the real
                        // progress-answer branch while generation runs.
                        jesseCall.submitText("is it done yet?")
                    } else {
                        // Post-delivery follow-up - mirrors send()'s
                        // quiet rejoin exactly, proving a typed message
                        // after the auto hang-up reopens the line with no
                        // ceremony and the reopen branch + re-hang-up work.
                        if !jesseCall.isActive {
                            jesseCall.begin(context: "workDashboard", studentName: studentName, quiet: true, voiceFirst: true)
                        }
                        jesseCall.submitText("open the lesson")
                    }
                }
            }
            // Seeds the orb's build state directly (real progress needs a
            // signed-in student + a live multi-minute generation job).
            if scriptArgs.contains("--ui-testing-gurukul-building") {
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    jesseCall.seedGenerationProgressForTesting(BookGenerationProgress(topic: "US History", chaptersReady: 2, totalChapters: 5))
                }
            }
        }
        .onDisappear { jesseCall.studyCompanionPresented = false }
        // Auto-resume the mic once Jesse's reply lands (2026-08-23 fix,
        // kept): a continuous back-and-forth, not tap-to-ask-one-thing.
        // Guarded on isActive so it stays quiet after the auto hang-up.
        .onChange(of: jesseCall.isThinking) { _, thinking in
            guard !thinking, jesseCall.isActive, !jesseCall.isListening, !jesseCall.isSpeaking else { return }
            jesseCall.startListening()
        }
        .onChange(of: jesseCall.workDashboardLesson) { _, lesson in
            didSave = false
            // Auto-surfaces the instant a real lesson finishes generating.
            if lesson != nil {
                withAnimation(.easeInOut(duration: 0.25)) { showLesson = true }
            }
        }
        .sheet(isPresented: $showFileImporter) {
            HomeworkDocumentPicker { url in
                Task { await upload(url) }
            }
        }
        .fullScreenCover(item: $presentedMicroSim) { sim in
            MicroSimView(sim: sim) { presentedMicroSim = nil }
        }
        .fullScreenCover(item: $presentedGeneratedSim) { sim in
            GeneratedSimView(sim: sim) { presentedGeneratedSim = nil }
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "study-companion").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("studyCompanionView")
                .allowsHitTesting(false)
        }
    }

    // MARK: - The stage (orb-centered conversation surface)

    private var stage: some View {
        VStack(spacing: 0) {
            header
            if isInConversation {
                conversationLayout
            } else {
                idleFormLayout
            }
            conversationFooter
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            ZStack {
                ink.ignoresSafeArea()
                // A faint warm center-glow so the stage reads as lit by
                // Jesse, not flat black.
                RadialGradient(
                    colors: [Color(shex: "1a2410").opacity(0.9), ink],
                    center: .center, startRadius: 40, endRadius: 520
                )
                .ignoresSafeArea()
            }
        )
        .animation(.easeInOut(duration: 0.3), value: isInConversation)
    }

    /// Real layout ask (2026-08-25, explicit: "once you start talking, the
    /// circle moves to the left and you can see the transcript on the
    /// right"). Fresh/idle (no turns yet) keeps the centered orb prompt;
    /// once a real conversation exists, `conversationLayout` below takes
    /// over - orb + status on the left, Jesse's line/the student's line/
    /// the generated-lesson file card on the right.
    /// Real bug fix (2026-08-25, found live-testing this exact screen):
    /// this used to be `!jesseCall.turns.isEmpty`, so a returning
    /// student's own opening greeting turn ("Pick up where you left off
    /// with Calculus?") counted as "a conversation," jumping straight to
    /// `conversationLayout` and burying the new form entirely - a
    /// returning student would never see it. Only a real STUDENT turn
    /// should flip this - Jesse talking first doesn't count.
    private var isInConversation: Bool {
        jesseCall.hasStudentSpokenThisSession
    }

    private var conversationLayout: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(spacing: 12) {
                Spacer(minLength: 0)
                JesseOrbView(state: orbState, buildFraction: buildFraction)
                    .frame(width: 148, height: 148)
                    .contentShape(Circle())
                    .onTapGesture { toggleLine() }
                    .accessibilityIdentifier("studyCompanionOrb")
                VStack(spacing: 5) {
                    Text(statusCaption)
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundColor(cream.opacity(0.55))
                        .textCase(.lowercase)
                    if let build = buildCaption {
                        Label(build, systemImage: "hammer.fill")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(lime)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(lime.opacity(0.12)))
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(width: 160)

            VStack(alignment: .leading, spacing: 16) {
                Spacer(minLength: 0)
                if let jesseLine = jesseCall.turns.last(where: { $0.speaker == "jesse" })?.text {
                    Text(jesseLine)
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundColor(cream.opacity(0.92))
                        .multilineTextAlignment(.leading)
                        .lineLimit(8)
                        .transition(.opacity)
                        .id(jesseLine)
                }
                if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty {
                    transcriptLine(jesseCall.liveTranscript, live: true)
                } else if let lastStudent = jesseCall.turns.last(where: { $0.speaker == "student" })?.text {
                    transcriptLine(lastStudent, live: false)
                }
                Spacer(minLength: 0)
                if jesseCall.workDashboardLesson != nil {
                    lessonFileCard
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .frame(maxHeight: .infinity)
        .animation(.easeInOut(duration: 0.25), value: jesseCall.turns.count)
    }

    private func transcriptLine(_ text: String, live: Bool) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .medium, design: .rounded))
            .foregroundColor(cream.opacity(live ? 0.6 : 0.75))
            .lineLimit(3)
            .multilineTextAlignment(.leading)
    }

    /// The tappable "little file" the founder asked for (2026-08-25:
    /// "once the sim is generated, you can also see the little file to
    /// tap on the right, which opens the dash") - same reopen action the
    /// header's note icon already uses, just surfaced where it's actually
    /// visible during the conversation instead of only in the header.
    private var lessonFileCard: some View {
        Button { withAnimation(.easeInOut(duration: 0.25)) { showLesson = true } } label: {
            HStack(spacing: 10) {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(ink)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(lime))
                VStack(alignment: .leading, spacing: 1) {
                    Text(jesseCall.workDashboardLesson?.topic ?? "Your lesson")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(cream)
                        .lineLimit(1)
                    Text("Tap to open")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(cream.opacity(0.5))
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("studyCompanionFileCard")
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.black)
                JesseRailView.raccoonImage
                    .resizable()
                    .scaledToFit()
                    .frame(width: 22, height: 22)
            }
            .frame(width: 36, height: 36)
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(cream.opacity(0.15)))
            Text("Gurukul")
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundColor(cream)
            Spacer(minLength: 0)

            Button {
                withAnimation(.easeInOut(duration: 0.2)) { showHistory.toggle() }
            } label: {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(cream)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Color.white.opacity(0.08)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("studyCompanionHistory")

            if jesseCall.workDashboardLesson != nil {
                // The note icon the founder explicitly likes - reopens a
                // dismissed lesson without losing it. Unchanged behavior.
                Button { withAnimation(.easeInOut(duration: 0.25)) { showLesson = true } } label: {
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(ink)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(cream))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("studyCompanionReopenLesson")

                Button(action: saveSession) {
                    Label(didSave ? "Saved" : "Save to Binder", systemImage: didSave ? "checkmark" : "tray.and.arrow.down")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(ink)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Capsule().fill(lime.opacity(didSave ? 0.5 : 1)))
                .disabled(didSave)
                .accessibilityIdentifier("studyCompanionSave")
            }
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(cream)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.08)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("studyCompanionClose")
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 6)
    }

    private var orbState: JesseOrbView.OrbState {
        if jesseCall.isSpeaking { return .speaking }
        if jesseCall.isThinking { return .thinking }
        if jesseCall.isListening { return .listening }
        if !jesseCall.isActive { return .closed }
        return .idle
    }

    private var buildFraction: Double? {
        guard let progress = jesseCall.generationProgress else { return nil }
        guard progress.totalChapters > 0 else { return 0 }
        return Double(progress.chaptersReady) / Double(max(1, progress.totalChapters))
    }

    private var statusCaption: String {
        switch orbState {
        case .speaking: return "Jesse is talking"
        case .thinking: return "reasoning"
        case .listening: return "listening, go ahead"
        case .closed: return "off the line, tap the orb or type to continue"
        case .idle: return "on the line"
        }
    }

    private var buildCaption: String? {
        guard let progress = jesseCall.generationProgress else { return nil }
        if progress.totalChapters > 0 {
            return "building \(progress.topic): \(progress.chaptersReady) of \(progress.totalChapters) chapters"
        }
        return "building \(progress.topic)"
    }

    /// Pre-conversation state: Jesse on one side, the structured
    /// questionnaire on the other (2026-08-25 - see the form @State
    /// group's own doc comment above). Once `submitLearnForm` appends the
    /// first turn, `isInConversation` flips true and `conversationLayout`
    /// takes over instead.
    private var idleFormLayout: some View {
        HStack(alignment: .top, spacing: 20) {
            VStack(spacing: 12) {
                Spacer(minLength: 0)
                JesseOrbView(state: orbState, buildFraction: buildFraction)
                    .frame(width: 132, height: 132)
                    .contentShape(Circle())
                    .onTapGesture { toggleLine() }
                    .accessibilityIdentifier("studyCompanionOrb")
                // Real bug fix (2026-08-25, spotted live: "listening, go
                // ahead" rendered as "...stening, go ahead" - unconstrained
                // center-aligned text overflowing its 150pt column clips
                // symmetrically on both edges instead of wrapping). Forcing
                // the wrap width + vertical-only fixedSize is the standard
                // SwiftUI fix for center-aligned text that needs to wrap
                // inside a narrower parent instead of overflowing it.
                Text(statusCaption)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(cream.opacity(0.55))
                    .textCase(.lowercase)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)
                if let notice = uploadNotice {
                    Text(notice)
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(shex: "8fdd9e"))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let status = jesseCall.status {
                    Text(status)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(Color(shex: "e08a82"))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .frame(width: 150)

            learnForm
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .frame(maxHeight: .infinity)
    }

    private var learnForm: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                // Returning student still gets one-tap access to their
                // existing lesson (same card/action as the header note
                // icon and conversationLayout's own copy) without it
                // hijacking the whole screen into conversationLayout the
                // way the old greeting-counts-as-a-turn logic did.
                if jesseCall.workDashboardLesson != nil {
                    lessonFileCard
                }
                formField(label: "What would you like to learn, \(studentName)?") {
                    TextField("", text: $formTopic, axis: .vertical)
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundColor(cream)
                        .tint(lime)
                        .overlay(alignment: .leading) {
                            if formTopic.isEmpty {
                                Text("e.g. photosynthesis")
                                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                                    .foregroundColor(cream.opacity(0.3))
                                    .allowsHitTesting(false)
                            }
                        }
                        .accessibilityIdentifier("studyCompanionFormTopic")
                }

                formField(label: "Level") {
                    HStack(spacing: 8) {
                        formChip("Just starting", isOn: formLevel == "Just starting") { formLevel = "Just starting" }
                        formChip("Comfortable", isOn: formLevel == "Comfortable") { formLevel = "Comfortable" }
                        formChip("Almost there", isOn: formLevel == "Almost there") { formLevel = "Almost there" }
                    }
                }

                formField(label: "What should we create?") {
                    HStack(spacing: 8) {
                        formChip("Sims", isOn: formContentType == "Sims") { formContentType = "Sims" }
                        formChip("Reading", isOn: formContentType == "Reading") { formContentType = "Reading" }
                        formChip("Talk it through", isOn: formContentType == "Talk it through") { formContentType = "Talk it through" }
                    }
                }

                Button(action: submitForm) {
                    Text("Create")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(ink)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Capsule().fill(lime.opacity(formTopic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.4 : 1)))
                }
                .buttonStyle(.plain)
                .disabled(formTopic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("studyCompanionFormCreate")

                Text("Or just talk, or type below, whichever's easier.")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(cream.opacity(0.35))
            }
            .padding(.vertical, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func formField<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(cream.opacity(0.5))
            content()
        }
    }

    private func formChip(_ title: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(isOn ? ink : cream.opacity(0.85))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    Capsule().fill(isOn ? lime : Color.white.opacity(0.08))
                )
        }
        .buttonStyle(.plain)
    }

    private func submitForm() {
        let level = formLevel
        let contentType = formContentType
        var prefs = LearnPreferences()
        switch contentType {
        case "Sims": prefs.wantsSims = true
        case "Reading": prefs.wantsReading = true
        case "Talk it through": prefs.wantsVocal = true
        default: break
        }
        switch level {
        case "Just starting": prefs.levelNote = "intro"
        case "Almost there": prefs.levelNote = "deep"
        default: break
        }
        jesseCall.submitLearnForm(topic: formTopic, prefs: prefs, grade: nil)
        formTopic = ""
        formLevel = nil
        formContentType = nil
        hideKeyboard()
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private var conversationFooter: some View {
        VStack(spacing: 10) {
            // Once a real conversation exists, the student's line already
            // shows in `conversationLayout`'s right panel - showing it
            // again here would be a duplicate. Idle/fresh (paired with
            // `idleFormLayout` above) has no turns yet by definition, so
            // this branch is inert there - kept simple rather than deleted
            // in case a future idle-state affordance needs it.
            if !isInConversation {
                if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty {
                    studentLine(jesseCall.liveTranscript, live: true)
                } else if let lastStudent = jesseCall.turns.last(where: { $0.speaker == "student" })?.text {
                    studentLine(lastStudent, live: false)
                }
            }
            inputBar
        }
        .padding(.bottom, 6)
    }

    private func studentLine(_ text: String, live: Bool) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .medium, design: .rounded))
            .foregroundColor(ink.opacity(live ? 0.75 : 0.9))
            .lineLimit(2)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Capsule().fill(cream.opacity(live ? 0.55 : 0.85)))
            .padding(.horizontal, 24)
            .opacity(live ? 0.85 : 1)
    }

    // MARK: - History drawer (the old transcript, one tap away)

    private var historyDrawer: some View {
        HStack(spacing: 0) {
            Color.black.opacity(0.35)
                .ignoresSafeArea()
                .onTapGesture { withAnimation(.easeInOut(duration: 0.2)) { showHistory = false } }
            VStack(spacing: 0) {
                HStack {
                    Text("Conversation")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(ink)
                    Spacer(minLength: 0)
                    Button { withAnimation(.easeInOut(duration: 0.2)) { showHistory = false } } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(ink)
                            .frame(width: 30, height: 30)
                            .background(Circle().fill(Color.black.opacity(0.06)))
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(jesseCall.turns) { turn in
                                turnBubble(turn).id(turn.id)
                            }
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .onAppear {
                        if let last = jesseCall.turns.last?.id { proxy.scrollTo(last, anchor: .bottom) }
                    }
                }
            }
            .frame(width: 340)
            .frame(maxHeight: .infinity)
            .background(cream)
        }
    }

    private func turnBubble(_ turn: JesseCallTurn) -> some View {
        HStack {
            if turn.speaker == "jesse" {
                bubbleContent(turn, mine: false)
                Spacer(minLength: 30)
            } else {
                Spacer(minLength: 30)
                bubbleContent(turn, mine: true)
            }
        }
    }

    private func bubbleContent(_ turn: JesseCallTurn, mine: Bool) -> some View {
        Text(turn.text)
            .font(.system(size: 13, weight: .medium, design: .rounded))
            .foregroundColor(mine ? .white : ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(mine ? Color.black : Color(shex: "e4dcc8"))
            )
    }

    // MARK: - Call lifecycle

    /// Fresh entry (onAppear): full `begin()` with greeting. Study mode
    /// always means `context == "workDashboard"` - if the student was
    /// mid-Resume (a different context) end it first, same end-before-
    /// switch shape as before the redesign.
    private func enterStudyMode() {
        if jesseCall.isActive, jesseCall.context != "workDashboard" {
            _ = jesseCall.end()
        }
        if !jesseCall.isActive {
            jesseCall.begin(context: "workDashboard", studentName: studentName, voiceFirst: true)
        }
    }

    /// Re-entry after the auto hang-up (2026-08-25, bug-#3 flow): rejoins
    /// the same conversation with NO ceremony - no "Heyy!", no state
    /// reset - so a typed follow-up or a mic tap after a delivery just
    /// continues where things left off.
    private func rejoinLineQuietly() {
        if jesseCall.isActive, jesseCall.context != "workDashboard" {
            _ = jesseCall.end()
        }
        if !jesseCall.isActive {
            jesseCall.begin(context: "workDashboard", studentName: studentName, quiet: true, voiceFirst: true)
        }
    }

    private func toggleLine() {
        if !jesseCall.isActive {
            rejoinLineQuietly()
            jesseCall.startListening()
            return
        }
        jesseCall.isListening ? jesseCall.stopListening() : jesseCall.startListening()
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            Button {
                showFileImporter = true
            } label: {
                Image(systemName: isUploading ? "hourglass" : "plus")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(cream)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.white.opacity(0.08)))
            }
            .buttonStyle(.plain)
            .disabled(isUploading)
            .accessibilityIdentifier("studyCompanionUpload")

            // Plain, borderless line instead of a pill/capsule field
            // (2026-08-25, explicit ask: "the search bar is not needed
            // here... design it neat") - voice is the primary path on this
            // screen; typing is still here as a real fallback, it just
            // doesn't need to look like a search box to earn its place.
            TextField("", text: $draftText, axis: .vertical)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(cream)
                .tint(lime)
                .padding(.vertical, 10)
                .overlay(alignment: .leading) {
                    if draftText.isEmpty {
                        Text("type to Jesse")
                            .font(.system(size: 14, weight: .medium, design: .rounded))
                            .foregroundColor(cream.opacity(0.3))
                            .allowsHitTesting(false)
                    }
                }
                .onSubmit(sendDraft)
                .accessibilityIdentifier("studyCompanionInput")

            Button {
                // Defensive re-entry (2026-08-23, kept + quiet-aware
                // 2026-08-25): a mic tap right as the screen opens, or
                // after the auto hang-up, re-opens the line first.
                if !jesseCall.isListening { rejoinLineQuietly() }
                jesseCall.isListening ? jesseCall.stopListening() : jesseCall.startListening()
            } label: {
                Image(systemName: jesseCall.isListening ? "mic.fill" : "mic")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(jesseCall.isListening ? ink : cream)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(jesseCall.isListening ? lime : Color.white.opacity(0.08)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("studyCompanionMic")

            Button(action: sendDraft) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? cream.opacity(0.25) : cream))
            }
            .buttonStyle(.plain)
            .disabled(draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityIdentifier("studyCompanionSend")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func sendDraft() {
        let text = draftText
        draftText = ""
        hideKeyboard()
        send(text)
    }

    private func send(_ text: String) {
        // Typed re-entry after the auto hang-up: `submitText` drops
        // messages while the session is inactive, so rejoin first.
        rejoinLineQuietly()
        jesseCall.submitText(text)
    }

    private func saveSession() {
        guard let lesson = jesseCall.workDashboardLesson else { return }
        let transcript = jesseCall.turns
            .map { "\($0.speaker == "jesse" ? "Jesse" : studentName): \($0.text)" }
            .joined(separator: "\n\n")
        onSaveSession(lesson.topic, transcript)
        didSave = true
    }

    private func upload(_ url: URL) async {
        isUploading = true
        uploadNotice = nil
        switch await HomeworkUploadPipeline.process(fileURL: url) {
        case .cards(let fileName, let cards):
            // Same bridge DeskGridDashboardView's own Homework Help tile
            // uses - lands the upload where JesseCallSession's clarify
            // flow already looks for it.
            jesseCall.latestHomeworkUpload = (fileName: fileName, cardSummaries: cards.map { "\($0.title): \($0.body)" })
            uploadNotice = "📄 \(fileName) ready, ask me to use it."
        case .error(let message):
            uploadNotice = message
        }
        isUploading = false
    }
}

/// Jesse's living geometric center - the "moving geometric center...
/// almost like Jarvis" from the 2026-08-25 redesign brief, drawn in the
/// visual language of the founder's saved reference clip (~/Downloads/
/// kick: spinning tape reels, flat bold field, thin connecting line):
/// a rotating tick ring, a counter-rotating dashed ring, and a dark
/// reel-hub core, all breathing on a real animation clock.
///
/// Real Canvas + TimelineView drawing at 30fps - not a static image, not
/// a Lottie file. Every state the call can be in has its own motion:
///
/// - listening: lime glow, slow confident spin, core breathing
/// - thinking:  amber, fast counter-rotation, three orbiting sparks
/// - speaking:  warm cream, ripple rings emanating outward
/// - closed:    dimmed, near-still - visually "off the line"
/// - idle:      soft cream, gentle breath
///
/// A background book build additionally draws a lime progress arc around
/// the outer ring (`buildFraction`), so generation reads as the orb
/// literally winding the lesson up - the reel spinning tape.
struct JesseOrbView: View {
    enum OrbState: Equatable {
        case idle, listening, thinking, speaking, closed
    }

    var state: OrbState
    /// 0...1 while a lesson builds in the background, nil otherwise.
    var buildFraction: Double?

    private struct Look {
        let color: Color
        let glow: Double
        let spin: Double      // outer ring, radians/sec
        let breath: Double    // core scale oscillation speed
        let dim: Double
    }

    private var look: Look {
        switch state {
        case .listening: return Look(color: Color(red: 0.77, green: 0.96, blue: 0.28), glow: 0.55, spin: 0.5, breath: 1.6, dim: 1.0)
        case .thinking: return Look(color: Color(red: 0.96, green: 0.72, blue: 0.35), glow: 0.5, spin: 2.6, breath: 3.2, dim: 1.0)
        case .speaking: return Look(color: Color(red: 0.95, green: 0.93, blue: 0.86), glow: 0.6, spin: 0.9, breath: 2.2, dim: 1.0)
        case .closed: return Look(color: Color(red: 0.62, green: 0.64, blue: 0.58), glow: 0.12, spin: 0.05, breath: 0.4, dim: 0.45)
        case .idle: return Look(color: Color(red: 0.9, green: 0.9, blue: 0.82), glow: 0.3, spin: 0.25, breath: 0.9, dim: 0.8)
        }
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            Canvas { ctx, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let c = CGPoint(x: size.width / 2, y: size.height / 2)
                let radius = min(size.width, size.height) / 2 - 14
                let look = self.look
                let breath = 1 + 0.035 * sin(t * look.breath * .pi)

                // Glow field.
                var glow = ctx
                glow.addFilter(.blur(radius: 22))
                glow.fill(
                    Path(ellipseIn: CGRect(x: c.x - radius * 0.72, y: c.y - radius * 0.72, width: radius * 1.44, height: radius * 1.44)),
                    with: .color(look.color.opacity(look.glow * (0.75 + 0.25 * sin(t * look.breath * .pi))))
                )

                // Outer tick ring (the reel), rotating.
                let tickCount = 48
                let spinAngle = t * look.spin
                for i in 0..<tickCount {
                    let angle = spinAngle + Double(i) / Double(tickCount) * 2 * .pi
                    let major = i % 12 == 0
                    let inner = radius * (major ? 0.90 : 0.94)
                    let outer = radius
                    var tick = Path()
                    tick.move(to: CGPoint(x: c.x + cos(angle) * inner, y: c.y + sin(angle) * inner))
                    tick.addLine(to: CGPoint(x: c.x + cos(angle) * outer, y: c.y + sin(angle) * outer))
                    ctx.stroke(tick, with: .color(look.color.opacity((major ? 0.9 : 0.4) * look.dim)), style: StrokeStyle(lineWidth: major ? 2.2 : 1.1, lineCap: .round))
                }

                // Counter-rotating dashed mid ring.
                let midRadius = radius * 0.72
                var midCtx = ctx
                midCtx.translateBy(x: c.x, y: c.y)
                midCtx.rotate(by: .radians(-t * look.spin * 1.6))
                midCtx.translateBy(x: -c.x, y: -c.y)
                let mid = Path(ellipseIn: CGRect(x: c.x - midRadius, y: c.y - midRadius, width: midRadius * 2, height: midRadius * 2))
                midCtx.stroke(mid, with: .color(look.color.opacity(0.5 * look.dim)), style: StrokeStyle(lineWidth: 1.4, dash: [10, 14]))

                // Speaking ripples - expanding, fading rings.
                if state == .speaking {
                    for k in 0..<3 {
                        let phase = (t * 0.8 + Double(k) / 3).truncatingRemainder(dividingBy: 1)
                        let rippleRadius = midRadius + (radius - midRadius + 16) * phase
                        let ripple = Path(ellipseIn: CGRect(x: c.x - rippleRadius, y: c.y - rippleRadius, width: rippleRadius * 2, height: rippleRadius * 2))
                        ctx.stroke(ripple, with: .color(look.color.opacity((1 - phase) * 0.5)), lineWidth: 1.6)
                    }
                }

                // Thinking sparks - three orbiting dots.
                if state == .thinking {
                    for k in 0..<3 {
                        let angle = t * 2.4 + Double(k) * 2 * .pi / 3
                        let orbitRadius = radius * 0.82
                        let p = CGPoint(x: c.x + cos(angle) * orbitRadius, y: c.y + sin(angle) * orbitRadius)
                        ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3.2, y: p.y - 3.2, width: 6.4, height: 6.4)), with: .color(look.color.opacity(0.95)))
                    }
                }

                // Reel-hub core: dark disc + metallic ring + inner state dot.
                let coreRadius = radius * 0.46 * breath
                ctx.fill(
                    Path(ellipseIn: CGRect(x: c.x - coreRadius, y: c.y - coreRadius, width: coreRadius * 2, height: coreRadius * 2)),
                    with: .color(Color.black.opacity(0.92))
                )
                let hubRadius = coreRadius * 0.62
                ctx.stroke(
                    Path(ellipseIn: CGRect(x: c.x - hubRadius, y: c.y - hubRadius, width: hubRadius * 2, height: hubRadius * 2)),
                    with: .color(Color(red: 0.93, green: 0.92, blue: 0.88).opacity(0.85 * look.dim)),
                    lineWidth: 3
                )
                // Hub notches, spinning with the outer ring - the reel's
                // sprocket holes.
                for i in 0..<6 {
                    let angle = spinAngle * 1.0 + Double(i) / 6 * 2 * .pi
                    let p = CGPoint(x: c.x + cos(angle) * hubRadius * 0.72, y: c.y + sin(angle) * hubRadius * 0.72)
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - 2.4, y: p.y - 2.4, width: 4.8, height: 4.8)), with: .color(Color(red: 0.93, green: 0.92, blue: 0.88).opacity(0.5 * look.dim)))
                }
                let dotRadius = coreRadius * 0.24 * (1 + 0.18 * sin(t * look.breath * 2 * .pi))
                ctx.fill(
                    Path(ellipseIn: CGRect(x: c.x - dotRadius, y: c.y - dotRadius, width: dotRadius * 2, height: dotRadius * 2)),
                    with: .color(look.color.opacity(0.95 * look.dim))
                )

                // Build progress arc - the lesson literally winding up.
                if let fraction = buildFraction {
                    let arcRadius = radius + 8
                    var track = Path()
                    track.addArc(center: c, radius: arcRadius, startAngle: .degrees(-90), endAngle: .degrees(270), clockwise: false)
                    ctx.stroke(track, with: .color(Color.white.opacity(0.08)), lineWidth: 3)
                    if fraction > 0 {
                        var arc = Path()
                        arc.addArc(center: c, radius: arcRadius, startAngle: .degrees(-90), endAngle: .degrees(-90 + 360 * fraction), clockwise: false)
                        ctx.stroke(arc, with: .color(Color(red: 0.77, green: 0.96, blue: 0.28)), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    } else {
                        // Indeterminate: a short sweeping comet until the
                        // first chapter count arrives.
                        let sweep = (t * 0.7).truncatingRemainder(dividingBy: 1) * 360
                        var arc = Path()
                        arc.addArc(center: c, radius: arcRadius, startAngle: .degrees(sweep - 90), endAngle: .degrees(sweep - 30), clockwise: false)
                        ctx.stroke(arc, with: .color(Color(red: 0.77, green: 0.96, blue: 0.28).opacity(0.8)), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    }
                }
            }
        }
        .animation(.easeInOut(duration: 0.4), value: state)
    }
}

private extension Color {
    init(shex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(red: r, green: g, blue: b)
    }
}
