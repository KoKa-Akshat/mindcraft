import SwiftUI

/// The merged Learn+Practice AI study companion (2026-08-23, explicit ask:
/// "Learn and Practice can be merged and have to kind of generate sims and
/// kind of help you talk vocally one-on-one based on what your goal is...
/// basically like ChatGPT to learn but with superpower to kind of teach
/// them in a personalized way through sims and content"). Presented as
/// FieldDeskView's own full-screen `.studyCompanion` overlay - the whole
/// dashboard changes, not just the workspace column - per the founder's
/// own words: "whatever we have on the dash changes."
///
/// Deliberately a thin UI shell around backend that already exists and
/// already works: `JesseCallSession`'s `context == "workDashboard"` branch
/// already does real archive lookups + real generation
/// (BookLibraryClient/ArchiveRagClient/BookGenerationClient) from a spoken
/// or typed topic, already folds in an uploaded file
/// (`latestHomeworkUpload`), and already signals when the student asks to
/// practice (`practiceRequested`, consumed one level up in
/// DeskGridDashboardView, unchanged). This view adds only what didn't
/// already exist: a real full-screen home for that conversation, a typed
/// text input (the founder's own reference screenshot is text-first, mic
/// secondary - `JesseRailView` alone is voice/call-first with no text
/// box), a "+" upload button reusing the same real pipeline Homework Help
/// already uses (`HomeworkUploadPipeline.process`), and an explicit "Save
/// to Binder" action (`BinderStore.addStudySession`) - the founder's
/// confirmed choice of an explicit trigger over teaching the AI to decide
/// entirely on its own.
struct StudyCompanionView: View {
    var studentName: String
    var onClose: () -> Void
    var onSaveSession: (_ topic: String, _ transcript: String) -> Void

    @EnvironmentObject private var jesseCall: JesseCallSession
    @State private var draftText = ""
    @State private var showFileImporter = false
    @State private var isUploading = false
    @State private var uploadNotice: String?
    @State private var didSave = false
    /// Whether the generated-lesson overlay is showing (2026-08-23, explicit
    /// ask: "if it does generate content, it should overlay that content on
    /// top of the screen, kind of like Binder does, and then I can interact
    /// with this for an hour"). Separate from `jesseCall.workDashboardLesson`
    /// itself so dismissing the overlay to keep talking doesn't lose the
    /// lesson - same reasoning `didSave` already uses.
    @State private var showLesson = false
    @State private var presentedMicroSim: MicroSimRecord?
    @State private var presentedGeneratedSim: GeneratedSimResult?

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                header
                transcript
                quickActions
                inputBar
            }
            .background(Color(shex: "f3f1ec").ignoresSafeArea())

            // Real bug fix (2026-08-23, live report: "it used to generate
            // nice boxes with tabs and content and sims... why is that not
            // being displayed here"): `WorkDashboardLesson.microsims` is a
            // topic-keyword MicroSim match, not the real per-section
            // `simHtml` a freshly generated/assembled book actually carries
            // - `syncWorkDashboardLesson` never copies section.simHtml
            // across at all, so StudySessionView (which only knows about
            // `lesson.microsims`) rendered real generated lessons with NO
            // sims, just the summary text repeated per chapter. `Jesse
            // CallSession.openedChapterBook` is the REAL `AssembledBook`
            // (with real section.simHtml) set alongside `workDashboardLesson`
            // by the exact same generation/library-match branches -
            // `BookReaderView` already renders it correctly (real sims,
            // real per-page content) elsewhere in this app. Prefer it
            // whenever it's there; StudySessionView stays the fallback only
            // for the thinner Dan's-archive-RAG/concept-graph paths that
            // never had a real AssembledBook to begin with.
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
        }
        .onAppear {
            jesseCall.studyCompanionPresented = true
            enterStudyMode()
        }
        .onDisappear { jesseCall.studyCompanionPresented = false }
        // Real fix (2026-08-23, live report: "after Jesse shows the text
        // you no longer have to be on the line, let the student speak,
        // there is a wait lag here... I have to wait even after seeing
        // what Jesse says"). Voice here is meant to be a continuous back-
        // and-forth ("I can interact with this for an hour"), not a manual
        // tap-to-ask-one-thing loop - once Jesse's reply lands
        // (isThinking flips false) the mic resumes on its own instead of
        // waiting for a second tap. Scoped to this screen only - the
        // Answer page's own JesseRailView stays tap-to-toggle per
        // CLAUDE.md's explicit "never hold-to-talk" convention, which this
        // doesn't touch (auto-RESUME after a reply is a different thing
        // from hold-vs-tap-to-start).
        .onChange(of: jesseCall.isThinking) { _, thinking in
            guard !thinking, jesseCall.isActive, !jesseCall.isListening, !jesseCall.isSpeaking else { return }
            jesseCall.startListening()
        }
        .onChange(of: jesseCall.workDashboardLesson) { _, lesson in
            didSave = false
            // Auto-surfaces the instant a real lesson finishes generating -
            // no separate tap needed to see what Jesse just built.
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

    /// Study mode always means `context == "workDashboard"` - if the
    /// student was mid-Resume (a different context) `isActive` is already
    /// true and `begin()` would silently no-op and leave them talking to
    /// Resume-mode Jesse inside a screen labeled Study. Same
    /// end-before-switch shape the Leverage module box already uses for
    /// the reverse direction.
    private func enterStudyMode() {
        if jesseCall.isActive, jesseCall.context != "workDashboard" {
            _ = jesseCall.end()
        }
        if !jesseCall.isActive {
            jesseCall.begin(context: "workDashboard", studentName: studentName)
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.black)
                JesseRailView.raccoonImage
                    .resizable()
                    .scaledToFit()
                    .frame(width: 26, height: 26)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text("Learn + Practice")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(Color(shex: "0c1207"))
                Text(jesseCall.isActive ? "Study mode · talking with Jesse" : "Study mode")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(shex: "0c1207").opacity(0.5))
            }
            Spacer(minLength: 0)
            if jesseCall.workDashboardLesson != nil {
                // Reopens a dismissed lesson overlay without losing it -
                // dismissing to keep talking (showLesson = false) doesn't
                // clear jesseCall.workDashboardLesson itself.
                Button { withAnimation(.easeInOut(duration: 0.25)) { showLesson = true } } label: {
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(Color(shex: "0c1207"))
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(Color.black.opacity(0.06)))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("studyCompanionReopenLesson")

                Button(action: saveSession) {
                    Label(didSave ? "Saved" : "Save to Binder", systemImage: didSave ? "checkmark" : "tray.and.arrow.down")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(shex: "0c1207"))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Capsule().fill(Color(shex: "c4f547").opacity(didSave ? 0.5 : 1)))
                .disabled(didSave)
                .accessibilityIdentifier("studyCompanionSave")
            }
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(shex: "0c1207"))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.black.opacity(0.06)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("studyCompanionClose")
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if jesseCall.turns.isEmpty {
                        Text("What are you trying to learn, \(studentName)?")
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(shex: "0c1207").opacity(0.55))
                            .padding(.top, 40)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                    ForEach(jesseCall.turns) { turn in
                        turnBubble(turn).id(turn.id)
                    }
                    if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty {
                        turnBubble(JesseCallTurn(id: "live", speaker: "student", text: jesseCall.liveTranscript, at: Date()))
                            .opacity(0.55)
                    }
                    if jesseCall.isThinking {
                        HStack(spacing: 6) {
                            ProgressView().scaleEffect(0.7)
                            Text("Jesse is working on it")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(shex: "0c1207").opacity(0.5))
                        }
                        .id("thinking")
                    }
                    if let notice = uploadNotice {
                        Text(notice)
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(shex: "247a4d"))
                    }
                    if let status = jesseCall.status {
                        Text(status)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(Color(shex: "b0473f"))
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: jesseCall.turns.count) { _, _ in scrollToEnd(proxy) }
            .onChange(of: jesseCall.isThinking) { _, _ in scrollToEnd(proxy) }
        }
    }

    private func scrollToEnd(_ proxy: ScrollViewProxy) {
        let target = jesseCall.isThinking ? "thinking" : jesseCall.turns.last?.id
        guard let target else { return }
        withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(target, anchor: .bottom) }
    }

    private func turnBubble(_ turn: JesseCallTurn) -> some View {
        HStack {
            if turn.speaker == "jesse" {
                bubbleContent(turn, mine: false)
                Spacer(minLength: 40)
            } else {
                Spacer(minLength: 40)
                bubbleContent(turn, mine: true)
            }
        }
    }

    private func bubbleContent(_ turn: JesseCallTurn, mine: Bool) -> some View {
        Text(turn.text)
            .font(.system(size: 14, weight: .medium, design: .rounded))
            .foregroundColor(mine ? .white : Color(shex: "0c1207"))
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(mine ? Color.black : Color(shex: "e4dcc8"))
            )
    }

    private var quickActions: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                quickChip("📚 Build a lesson on this") { send("Build a lesson on this") }
                quickChip("✏️ Quiz me") { send("I want to practice") }
                quickChip("📄 Summarize my upload") { send("Summarize what I uploaded") }
            }
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 8)
    }

    private func quickChip(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(shex: "0c1207"))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Capsule().stroke(Color(shex: "0c1207").opacity(0.15)))
        }
        .buttonStyle(.plain)
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            Button {
                showFileImporter = true
            } label: {
                Image(systemName: isUploading ? "hourglass" : "plus")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Color(shex: "0c1207"))
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.black.opacity(0.06)))
            }
            .buttonStyle(.plain)
            .disabled(isUploading)
            .accessibilityIdentifier("studyCompanionUpload")

            TextField("What are you trying to learn?", text: $draftText, axis: .vertical)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(Color(shex: "0c1207"))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color(shex: "e4dcc8").opacity(0.6)))
                .onSubmit(sendDraft)
                .accessibilityIdentifier("studyCompanionInput")

            Button {
                // Defensive re-entry (2026-08-23, real live report: tapping
                // mic sometimes did nothing) - closes a real timing gap
                // where `onAppear`'s enterStudyMode() hasn't landed yet if
                // the mic is tapped the instant this screen opens.
                // startListening() itself now also surfaces every other
                // failure reason via `status` instead of silently no-oping.
                if !jesseCall.isListening { enterStudyMode() }
                jesseCall.isListening ? jesseCall.stopListening() : jesseCall.startListening()
            } label: {
                Image(systemName: jesseCall.isListening ? "mic.fill" : "mic")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(jesseCall.isListening ? .white : Color(shex: "0c1207"))
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(jesseCall.isListening ? Color(shex: "247a4d") : Color.black.opacity(0.06)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("studyCompanionMic")

            Button(action: sendDraft) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.black.opacity(0.2) : Color.black))
            }
            .buttonStyle(.plain)
            .disabled(draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityIdentifier("studyCompanionSend")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    private func sendDraft() {
        let text = draftText
        draftText = ""
        send(text)
    }

    private func send(_ text: String) {
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
            // uses (solveHomeworkProblem) - lands the upload where
            // JesseCallSession's "materials or go ahead?" flow already
            // looks for it.
            jesseCall.latestHomeworkUpload = (fileName: fileName, cardSummaries: cards.map { "\($0.title): \($0.body)" })
            uploadNotice = "📄 \(fileName) ready — ask me to use it."
        case .error(let message):
            uploadNotice = message
        }
        isUploading = false
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
