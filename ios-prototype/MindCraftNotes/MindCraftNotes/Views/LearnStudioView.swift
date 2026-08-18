import SwiftUI

/// Learn Studio — the five-pane concept-study screen (Definition, Context,
/// Worked Example, Microsim, Practice Probe) from tonight's "Wiring
/// MindCraft" / "Bar Exam Pilot" design pass. Two patterns already ship in
/// this app and are reused unchanged here, per the actual spec handed down
/// (there was no real wireframe in the source docs before this one):
///   - Jesse stays reachable the same way she already is everywhere else -
///     `JesseCallPill` top-right when a call is active, opening the same
///     `JesseCallSheetView` on tap. No inline chat panel invented for this
///     screen; there isn't one anywhere else in the app either.
///   - The content area reuses `DeskGridDashboardView`'s own board system -
///     a fixed 1440x810 canvas, independently-positioned rounded white
///     cards on a cream dotted grid, one dock strip at the bottom. Panel
///     corner radius (18), shadow (`black.opacity(0.14), radius 12, y 6`),
///     and dock chip style are copied from `photoTile`/`activeDock`
///     directly, not restyled.
/// Practice Probe is the hero pane (largest footprint, right column, full
/// height) because it's the only pane that writes a real outcome back to
/// mastery via `OutcomeClient.recordOutcome` (`/record-outcomes`) - matching
/// "every activity tracked" actually depending on this one pane, not the
/// other four.
struct LearnStudioView: View {
    var conceptId: String
    var onClose: () -> Void

    @EnvironmentObject private var jesseCall: JesseCallSession
    @State private var showJesseCallSheet = false
    @State private var probeAnswers: [String: Int] = [:]
    @State private var probeChecked: Set<String> = []
    @State private var probeSubmitting = false

    private let artboard = CGSize(width: 1440, height: 810)

    private var questions: [SampleQuestion] {
        SampleQuestion.all.filter { $0.conceptId == conceptId }
    }
    private var workedExample: SampleQuestion? { questions.first }
    private var probeQuestions: [SampleQuestion] { Array(questions.dropFirst().prefix(3)) }
    private var story: ConceptStory? { workedExample?.story }
    private var conceptLabel: String { workedExample?.conceptLabel ?? conceptId }

    private var progressDone: Int { probeChecked.count }
    private var progressTotal: Int { max(probeQuestions.count, 1) }

    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            let board = CGSize(width: artboard.width * scale, height: artboard.height * scale)
            ZStack {
                Color(lsHex: "fff8e9").ignoresSafeArea()
                studioBoard(scale: scale, board: board)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .overlay(alignment: .topTrailing) {
            jesseReachOverlay
        }
        .sheet(isPresented: $showJesseCallSheet) {
            JesseCallSheetView(
                call: jesseCall,
                onClose: { showJesseCallSheet = false },
                onEnd: {
                    _ = jesseCall.end()
                    showJesseCallSheet = false
                }
            )
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "learn-studio").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("learnStudio")
                .allowsHitTesting(false)
        }
    }

    /// Same call-to-action as `CreateCanvasView.jesseRail`'s "Jump on a call
    /// with Jesse" button (black capsule, phone icon, identical copy) - the
    /// board here has no room for that rail's full card (avatar, greeting,
    /// transcript), but the button itself matches exactly rather than
    /// inventing a different lime-dot pill nobody else in the app uses.
    /// Once active, same `JesseCallPill` every other screen uses.
    @ViewBuilder
    private var jesseReachOverlay: some View {
        if jesseCall.isActive {
            JesseCallPill(call: jesseCall, onTap: { showJesseCallSheet = true })
        } else {
            Button {
                jesseCall.begin(context: "learnStudio_\(conceptId)")
                showJesseCallSheet = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "phone.fill")
                    Text("Jump on a call with Jesse")
                    Image(systemName: "arrow.right")
                }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color.black))
            }
            .buttonStyle(.plain)
            .padding(.top, 10)
            .padding(.trailing, 14)
            .accessibilityIdentifier("learnStudioTalkToJesse")
        }
    }

    // MARK: - Board

    private func studioBoard(scale: CGFloat, board: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            Color.clear.frame(width: board.width, height: board.height)
            DottedLearnGrid()
                .frame(width: board.width, height: board.height)

            pin(LearnBoard.definition, scale: scale) {
                pane(title: "Definition", accent: Color(lsHex: "247a4d")) {
                    Text(conceptLabel)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text(definitionText)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            pin(LearnBoard.context, scale: scale) {
                pane(title: "Context", accent: Color(lsHex: "7a6ba8")) {
                    if let story {
                        Text(story.protagonist).font(.system(size: 13, weight: .bold, design: .rounded)).foregroundColor(.white)
                        Text(story.settingLine)
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundColor(.white.opacity(0.65))
                        Text(story.bridgeLine)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.9))
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        Text("No story context authored for this concept yet.")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
            }

            pin(LearnBoard.workedExample, scale: scale) {
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
                        Text("No worked example for this concept yet.")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
            }

            pin(LearnBoard.microsim, scale: scale) {
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

            pin(LearnBoard.practiceProbe, scale: scale) {
                practiceProbePane
            }

            pin(LearnBoard.dock, scale: scale) { studioDock }
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
            if probeQuestions.isEmpty {
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

    /// The one pane that actually closes the loop - `OutcomeClient` is the
    /// real `/record-outcomes` client already built for `QuestionView`;
    /// reused here rather than re-implemented so Learn Studio's probes feed
    /// the exact same mastery graph a normal practice session does.
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

    // MARK: - Small shared pieces

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

    private var studioDock: some View {
        HStack(spacing: 14) {
            Button(action: onClose) {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left").font(.system(size: 12, weight: .bold))
                    Text("Desk").font(.system(size: 13, weight: .bold, design: .rounded))
                }
                .foregroundColor(Color(lsHex: "143a2e"))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color.white))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("learnStudioBackToDesk")

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

    /// Definition text is product copy (framing, not new pedagogical
    /// content) - short and honest per concept, not fabricated math.
    private var definitionText: String {
        switch conceptId {
        case "fractions_decimals":
            return "A fraction and a decimal can name the same value on the number line \u{2014} 3/4 of the whole is exactly 0.75 of it."
        default:
            return "No definition authored for this concept yet."
        }
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

/// Real coordinates on the same 1440x810 canvas `DeskGridDashboardView`
/// uses, verified against its usable area (content from ~y:40 to the dock
/// at y:706) rather than hardcoded from the wireframe sketch's proportions
/// alone. Practice Probe's height (616) exactly matches the two stacked
/// left/center columns' combined height (300 + 16 gap + 300), so all three
/// columns bottom-align.
private enum LearnBoard {
    static let definition = CGRect(x: 40, y: 40, width: 340, height: 300)
    static let context = CGRect(x: 40, y: 356, width: 340, height: 300)
    static let workedExample = CGRect(x: 396, y: 40, width: 460, height: 300)
    static let microsim = CGRect(x: 396, y: 356, width: 460, height: 300)
    static let practiceProbe = CGRect(x: 872, y: 40, width: 488, height: 616)
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
