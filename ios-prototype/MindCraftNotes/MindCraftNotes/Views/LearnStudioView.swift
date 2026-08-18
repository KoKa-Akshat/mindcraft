import SwiftUI

/// Learn Studio (2026-08-17, restructured same night per explicit ask).
/// Two phases, not straight to the boxes:
///   1. **Intake** - the GDoc shape: real content-editing area on the left,
///      `JesseRailView` (the one shared Jesse card every screen with Jesse
///      now uses) on the right. The student says what they want to study
///      and at what level; "Browse Archive" sits right next to that input,
///      since Archive folded into Learn instead of staying a separate Flow.
///   2. **Studying** - Jesse's plan decides how many boxes actually make
///      sense (`StudyPlan.layout`), not always a fixed five. Definition/
///      Context come from the plan's own text (or an honest "not authored
///      yet" - never fabricated). Practice never uses AI-invented
///      questions - it only ever pulls from `SampleQuestion.all`'s real,
///      verified bank via `StudyPlan.matchedConceptId`; no verification
///      firewall exists for arbitrary AI-authored math the way Blake's
///      ingredient-first pipeline has, so this deliberately doesn't try.
struct LearnStudioView: View {
    var studentName: String
    var onClose: () -> Void

    @EnvironmentObject private var jesseCall: JesseCallSession
    @ObservedObject private var aiKeys = StudentAIKeyStore.shared

    private enum Phase { case intake, planning, studying }
    @State private var phase: Phase = .intake

    @State private var topicDraft = ""
    @State private var level = "Just starting"
    @State private var planError: String?
    @State private var plan: StudyPlan?
    @State private var showArchive = false

    @State private var probeAnswers: [String: Int] = [:]
    @State private var probeChecked: Set<String> = []
    @State private var probeSubmitting = false

    private let artboard = CGSize(width: 1440, height: 810)
    private let levels = ["Just starting", "Comfortable", "Almost there"]

    // MARK: - Derived from the plan, never from a hardcoded concept

    private var conceptId: String? { plan?.matchedConceptId }
    private var questions: [SampleQuestion] {
        guard let conceptId else { return [] }
        return SampleQuestion.all.filter { $0.conceptId == conceptId }
    }
    private var workedExample: SampleQuestion? { questions.first }
    private var probeQuestions: [SampleQuestion] { Array(questions.dropFirst().prefix(3)) }
    private var story: ConceptStory? { workedExample?.story }
    private var progressDone: Int { probeChecked.count }
    private var progressTotal: Int { max(probeQuestions.count, 1) }

    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            let board = CGSize(width: artboard.width * scale, height: artboard.height * scale)
            ZStack {
                Color(lsHex: "fff8e9").ignoresSafeArea()
                switch phase {
                case .intake, .planning:
                    intakeBoard(scale: scale, board: board)
                case .studying:
                    studyBoard(scale: scale, board: board)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .overlay(alignment: .topTrailing) {
            // Same Done capsule every overlay in the app uses.
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(lsHex: "0c1207"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(lsHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 16)
            .accessibilityIdentifier("learnStudioDone")
        }
        .fullScreenCover(isPresented: $showArchive) {
            ArchiveWorkflowView(onClose: { showArchive = false })
        }
        .overlay(alignment: .topLeading) {
            jesseLiveControl
                .padding(.top, 12)
                .padding(.leading, 16)
        }
        .onChange(of: jesseCall.studyPlan) { _, newPlan in
            guard let newPlan else { return }
            // Give the cards a real headline instead of leaving topicDraft
            // blank when the student never typed anything - the most
            // recent thing they said stands in for "what do you want to
            // study" the same way the form's own text field would.
            if topicDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               let lastStudentTurn = jesseCall.turns.last(where: { $0.speaker == "student" }) {
                topicDraft = String(lastStudentTurn.text.prefix(80))
            }
            // Only clear practice-probe progress if the matched concept
            // actually changed - regenerating the same concept's plan every
            // turn shouldn't wipe answers the student already checked.
            if newPlan.matchedConceptId != plan?.matchedConceptId {
                probeAnswers = [:]
                probeChecked = []
            }
            plan = newPlan
            planError = nil
            if phase != .studying {
                withAnimation(.easeInOut(duration: 0.25)) { phase = .studying }
            }
        }
        .onChange(of: jesseCall.studyPlanError) { _, newError in
            guard let newError else { return }
            planError = newError
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "learn-studio").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("learnStudio")
                .allowsHitTesting(false)
        }
    }

    /// Compact live-call presence for the studying screen (Assignment G) -
    /// `studyBoard` doesn't have room for the full `JesseRailView` card the
    /// intake screen shows (five pinned panes already fill the canvas), but
    /// without SOME control here the conversation could only ever produce
    /// one turn: `JesseRailView`'s mic button is the only thing that
    /// restarts listening after Jesse replies (listening does not
    /// auto-resume - confirmed reading `JesseCallSession` directly), and
    /// that button only exists inside `JesseRailView` itself, which
    /// `intakeBoard` stops rendering once `phase` flips to `.studying`.
    /// This reuses `jesseCall`/`JesseMiniWaveform` directly rather than
    /// re-implementing call state - not a second call, just a second,
    /// smaller control surface for the one call already running.
    @ViewBuilder
    private var jesseLiveControl: some View {
        if phase == .studying, jesseCall.isActive, jesseCall.context == "learnStudio" {
            HStack(spacing: 10) {
                JesseMiniWaveform(active: jesseCall.isSpeaking || jesseCall.isListening)
                Text(jesseCall.isThinking ? "Jesse is thinking\u{2026}" : (jesseCall.isListening ? "Listening\u{2026}" : "Tap mic to keep talking"))
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(lsHex: "143a2e"))
                    .lineLimit(1)
                Button {
                    jesseCall.isListening ? jesseCall.stopListening() : jesseCall.startListening()
                } label: {
                    Image(systemName: jesseCall.isListening ? "mic.fill" : "mic.slash.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(jesseCall.isListening ? Color(lsHex: "247a4d") : Color(lsHex: "8a8478")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("learnStudioLiveMic")
                Button {
                    _ = jesseCall.end()
                } label: {
                    Image(systemName: "phone.down.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(Color(lsHex: "b0473f")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("learnStudioLiveEndCall")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color.white).shadow(color: .black.opacity(0.12), radius: 10, y: 4))
            .accessibilityIdentifier("learnStudioLiveBadge")
        }
    }

    // MARK: - Phase 1: Intake (GDoc shape - content left, Jesse right)

    private func intakeBoard(scale: CGFloat, board: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            Color.clear.frame(width: board.width, height: board.height)
            DottedLearnGrid().frame(width: board.width, height: board.height)

            pin(IntakeBoard.content, scale: scale) { intakeContent }
            pin(IntakeBoard.jesseRail, scale: scale) {
                JesseRailView(studentName: studentName, context: "learnStudio")
            }
        }
    }

    private var intakeContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("STUDY SOMETHING NEW")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .tracking(1.1)
                .foregroundColor(Color(lsHex: "143a2e").opacity(0.45))

            Text("What do you want to study?")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(Color(lsHex: "143a2e"))

            HStack(alignment: .top, spacing: 10) {
                TextEditor(text: $topicDraft)
                    .font(.system(size: 16, weight: .medium, design: .rounded))
                    .scrollContentBackground(.hidden)
                    .foregroundColor(Color(lsHex: "143a2e"))
                    .frame(height: 90)
                    .padding(8)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color(lsHex: "e4dcc8"), lineWidth: 1)
                            )
                    )
                    .overlay(alignment: .topLeading) {
                        if topicDraft.isEmpty {
                            Text("e.g. \u{201c}fractions and decimals\u{201d}")
                                .font(.system(size: 15, weight: .medium, design: .rounded))
                                .foregroundColor(Color(lsHex: "143a2e").opacity(0.35))
                                .padding(.top, 16)
                                .padding(.leading, 13)
                                .allowsHitTesting(false)
                        }
                    }
                    .accessibilityIdentifier("learnStudioTopicField")

                // Archive folded into Learn (2026-08-17) - right next to
                // the study prompt, not a separate Flow anymore.
                Button {
                    showArchive = true
                } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "archivebox.fill")
                            .font(.system(size: 18, weight: .semibold))
                        Text("Browse\nArchive")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .multilineTextAlignment(.center)
                    }
                    .foregroundColor(Color(lsHex: "143a2e"))
                    .frame(width: 84, height: 90)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color(lsHex: "e4dcc8"), lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("learnStudioBrowseArchive")
            }

            HStack(spacing: 8) {
                Text("Level")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(lsHex: "143a2e").opacity(0.6))
                ForEach(levels, id: \.self) { option in
                    Button { level = option } label: {
                        Text(option)
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(level == option ? Color(lsHex: "0c1207") : Color(lsHex: "143a2e").opacity(0.6))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(
                                Capsule().fill(level == option ? Color(lsHex: "c4f547") : Color.white)
                            )
                            .overlay(Capsule().strokeBorder(Color(lsHex: "e4dcc8"), lineWidth: level == option ? 0 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .accessibilityIdentifier("learnStudioLevelPicker")

            if let planError {
                Text(planError)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(lsHex: "b3261e"))
            }
            if !aiKeys.hasKey {
                Text("Connect your AI key in Settings so Jesse can actually plan this, not just navigate you somewhere.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(lsHex: "143a2e").opacity(0.55))
            }

            Button {
                Task { await createPlan() }
            } label: {
                if phase == .planning {
                    HStack(spacing: 8) {
                        ProgressView().tint(.white)
                        Text("Jesse is planning\u{2026}")
                    }
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                } else {
                    Text("Create my plan")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
            }
            .buttonStyle(.plain)
            .background(Capsule().fill(Color.black))
            .disabled(topicDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || phase == .planning || !aiKeys.hasKey)
            .opacity((topicDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !aiKeys.hasKey) ? 0.5 : 1)
            .accessibilityIdentifier("learnStudioCreatePlan")

            Spacer(minLength: 0)
        }
        .padding(22)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.1), radius: 16, y: 8)
        )
    }

    /// Real generation call, real honest failure. Never silently falls
    /// back to a fabricated plan - a thin/failed result says so, matching
    /// the whole app's rule tonight against faking capability.
    private func createPlan() async {
        let topic = topicDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !topic.isEmpty else { return }
        phase = .planning
        planError = nil
        let known = Array(Set(SampleQuestion.all.map(\.conceptId)))
        switch await aiKeys.generateStudyPlan(topic: topic, level: level, knownConceptIds: known) {
        case .success(let result):
            plan = result
            probeAnswers = [:]
            probeChecked = []
            withAnimation(.easeInOut(duration: 0.25)) { phase = .studying }
        case .failure(.rejected), .failure(.noKey):
            planError = "That AI key was rejected. Open Settings to update it."
            phase = .intake
        case .failure(.unavailable):
            planError = "Couldn\u{2019}t put a plan together - try again in a bit, or rephrase the topic."
            phase = .intake
        }
    }

    // MARK: - Phase 2: Studying (layout chosen by the plan, not fixed)

    @ViewBuilder
    private func studyBoard(scale: CGFloat, board: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            Color.clear.frame(width: board.width, height: board.height)
            DottedLearnGrid().frame(width: board.width, height: board.height)

            switch plan?.layout {
            case "practiceOnly":
                pin(LearnBoard.practiceOnlyDefinition, scale: scale) { definitionPane }
                pin(LearnBoard.practiceOnlyProbe, scale: scale) { practiceProbePane }
            case "quick":
                pin(LearnBoard.quickDefinition, scale: scale) { definitionAndContextPane }
                pin(LearnBoard.quickWorkedExample, scale: scale) { workedExamplePane }
                pin(LearnBoard.quickPracticeProbe, scale: scale) { practiceProbePane }
            default:
                pin(LearnBoard.definition, scale: scale) { definitionPane }
                pin(LearnBoard.context, scale: scale) { contextPane }
                pin(LearnBoard.workedExample, scale: scale) { workedExamplePane }
                pin(LearnBoard.microsim, scale: scale) { microsimPane }
                pin(LearnBoard.practiceProbeFull, scale: scale) { practiceProbePane }
            }

            pin(LearnBoard.dock, scale: scale) { studyDock }
        }
    }

    private var definitionPane: some View {
        pane(title: "Definition", accent: Color(lsHex: "247a4d")) {
            Text(topicDraft).font(.system(size: 15, weight: .bold, design: .rounded)).foregroundColor(.white)
            Text(plan?.definition ?? "Not authored yet.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var contextPane: some View {
        pane(title: "Context", accent: Color(lsHex: "7a6ba8")) {
            Text(plan?.context ?? "Not authored yet.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)
            if let story {
                Divider().overlay(Color.white.opacity(0.2))
                Text(story.bridgeLine)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.75))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var definitionAndContextPane: some View {
        pane(title: "Definition & Context", accent: Color(lsHex: "247a4d")) {
            Text(topicDraft).font(.system(size: 15, weight: .bold, design: .rounded)).foregroundColor(.white)
            Text(plan?.definition ?? "Not authored yet.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
            Divider().overlay(Color.white.opacity(0.2))
            Text(plan?.context ?? "")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var workedExamplePane: some View {
        pane(title: "Worked Example", accent: Color(lsHex: "a3651f")) {
            if let q = workedExample {
                Text(q.prompt)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(.white)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill").foregroundColor(Color(lsHex: "c4f547"))
                    Text(q.choices[q.correctIndex])
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(lsHex: "c4f547"))
                }
            } else {
                Text("No worked example for this topic yet.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.7))
            }
        }
    }

    private var microsimPane: some View {
        pane(title: "Microsim", accent: Color(lsHex: "5b7596")) {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "hourglass")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundColor(.white.opacity(0.6))
                Text("Interactive microsims aren\u{2019}t built yet.")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.85))
                Text("This pane is a placeholder, not a stub pretending to work.")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
    }

    // MARK: - Practice Probe (hero, writes to mastery)

    private var practiceProbePane: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                paneLabel("Practice Probe")
                Spacer(minLength: 0)
                Text("\(progressDone)/\(progressTotal)")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(.white.opacity(0.6))
            }
            if conceptId == nil {
                Text("No verified practice bank matched this topic yet - Jesse won't invent unchecked questions.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            } else if probeQuestions.isEmpty {
                Text("No probe questions banked for this concept yet.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.7))
                Spacer(minLength: 0)
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(probeQuestions) { q in
                            probeCard(q)
                        }
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(
                    colors: [Color(lsHex: "c4f547"), Color(lsHex: "7a9e2e")],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.14), radius: 12, y: 6)
        .accessibilityIdentifier("learnStudioPracticeProbe")
    }

    private func probeCard(_ q: SampleQuestion) -> some View {
        let checked = probeChecked.contains(q.id)
        let picked = probeAnswers[q.id]
        return VStack(alignment: .leading, spacing: 8) {
            Text(q.prompt)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundColor(Color(lsHex: "0c1207"))
                .fixedSize(horizontal: false, vertical: true)
            ForEach(Array(q.choices.enumerated()), id: \.offset) { i, choice in
                Button {
                    guard !checked else { return }
                    probeAnswers[q.id] = i
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: picked == i ? "largecircle.fill.circle" : "circle")
                            .foregroundColor(rowColor(checked: checked, index: i, correct: q.correctIndex, picked: picked))
                        Text(choice)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(rowColor(checked: checked, index: i, correct: q.correctIndex, picked: picked))
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)
                .disabled(checked)
            }
            if !checked {
                Button {
                    Task { await checkProbe(q) }
                } label: {
                    Text(probeSubmitting ? "Recording\u{2026}" : "Check")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(Color(lsHex: "0c1207"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                }
                .buttonStyle(.plain)
                .background(Capsule().fill(Color.white.opacity(0.92)))
                .disabled(picked == nil || probeSubmitting)
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.14)))
        .accessibilityIdentifier("learnStudioProbe_\(q.id)")
    }

    private func rowColor(checked: Bool, index: Int, correct: Int, picked: Int?) -> Color {
        guard checked else { return Color(lsHex: "0c1207").opacity(0.85) }
        if index == correct { return Color(lsHex: "143a2e") }
        if index == picked { return Color(lsHex: "b3261e") }
        return Color(lsHex: "0c1207").opacity(0.4)
    }

    /// Same real `/record-outcomes` client `QuestionView` uses - Learn
    /// Studio's probes feed the exact same mastery graph a normal practice
    /// session does, not a side channel.
    private func checkProbe(_ q: SampleQuestion) async {
        guard let picked = probeAnswers[q.id] else { return }
        probeSubmitting = true
        probeChecked.insert(q.id)
        _ = try? await OutcomeClient.recordOutcome(
            conceptId: q.conceptId,
            questionId: q.id,
            level: q.level,
            selectedChoiceIndex: picked,
            correctIndex: q.correctIndex
        )
        probeSubmitting = false
    }

    // MARK: - Shared pieces

    private func pane<Content: View>(title: String, accent: Color, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            paneLabel(title)
            content()
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(accent))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.14), radius: 12, y: 6)
    }

    private func paneLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .heavy, design: .rounded))
            .tracking(0.6)
            .foregroundColor(.white.opacity(0.6))
    }

    private var studyDock: some View {
        HStack(spacing: 14) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    phase = .intake
                    plan = nil
                    topicDraft = ""
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.uturn.backward")
                    Text("New topic")
                }
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(lsHex: "143a2e"))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Capsule().fill(Color.white))
                .overlay(Capsule().strokeBorder(Color(lsHex: "e4dcc8"), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("learnStudioNewTopic")

            // Honesty rule (Assignment G): a live turn that fails to
            // produce a usable plan must not silently leave stale cards
            // with no indication anything went wrong.
            if let planError {
                Text(planError)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(lsHex: "b3261e"))
                    .lineLimit(2)
                    .accessibilityIdentifier("learnStudioLiveError")
            }

            Spacer(minLength: 0)

            HStack(spacing: 6) {
                Text("Practice")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(Color(lsHex: "143a2e").opacity(0.7))
                ForEach(0..<progressTotal, id: \.self) { i in
                    Circle()
                        .fill(i < progressDone ? Color(lsHex: "143a2e") : Color(lsHex: "143a2e").opacity(0.2))
                        .frame(width: 8, height: 8)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color(lsHex: "fbf8f3")))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color(lsHex: "e4dcc8"), lineWidth: 1))
        .accessibilityIdentifier("learnStudioDock")
    }

    private func pin<Content: View>(_ box: CGRect, scale: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(width: box.width * scale, height: box.height * scale)
            .position(
                x: (box.minX + box.width / 2) * scale,
                y: (box.minY + box.height / 2) * scale
            )
    }
}

/// Intake screen coordinates - GDoc's own content-left/Jesse-right
/// proportions (`CreateArtboard.jesseRail` is x:988 w:376 on the same
/// 1440-wide canvas), not invented fresh.
private enum IntakeBoard {
    static let content = CGRect(x: 40, y: 40, width: 908, height: 656)
    static let jesseRail = CGRect(x: 972, y: 40, width: 388, height: 656)
}

/// Real coordinates on the same 1440x810 canvas `DeskGridDashboardView`
/// uses, verified against its usable area (content y:40 to the dock at
/// y:706). Three layout shapes, chosen by `StudyPlan.layout`, not always
/// the same five boxes - "full" keeps the original 5-pane proportions;
/// "quick" drops Microsim and merges Definition+Context into one tall
/// pane; "practiceOnly" is almost entirely the practice pane.
private enum LearnBoard {
    // full
    static let definition = CGRect(x: 40, y: 40, width: 340, height: 300)
    static let context = CGRect(x: 40, y: 356, width: 340, height: 300)
    static let workedExample = CGRect(x: 396, y: 40, width: 460, height: 300)
    static let microsim = CGRect(x: 396, y: 356, width: 460, height: 300)
    static let practiceProbeFull = CGRect(x: 872, y: 40, width: 488, height: 616)

    // quick
    static let quickDefinition = CGRect(x: 40, y: 40, width: 420, height: 616)
    static let quickWorkedExample = CGRect(x: 476, y: 40, width: 420, height: 616)
    static let quickPracticeProbe = CGRect(x: 912, y: 40, width: 448, height: 616)

    // practiceOnly
    static let practiceOnlyDefinition = CGRect(x: 40, y: 40, width: 1320, height: 90)
    static let practiceOnlyProbe = CGRect(x: 40, y: 146, width: 1320, height: 510)

    static let dock = CGRect(x: 96, y: 706, width: 1321, height: 96)
}

/// Same dotted-grid treatment as `DeskGridDashboardView`'s `DottedDeskGrid`
/// (private to that file, so duplicated here rather than exposed cross-file
/// for one shared Canvas) - same step, dot size, and color.
private struct DottedLearnGrid: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 16
            for x in stride(from: 8, through: size.width, by: step) {
                for y in stride(from: 8, through: size.height, by: step) {
                    let dot = Path(ellipseIn: CGRect(x: x, y: y, width: 1.4, height: 1.4))
                    context.fill(dot, with: .color(Color(lsHex: "d7d0c2")))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private extension Color {
    init(lsHex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(red: r, green: g, blue: b)
    }
}
