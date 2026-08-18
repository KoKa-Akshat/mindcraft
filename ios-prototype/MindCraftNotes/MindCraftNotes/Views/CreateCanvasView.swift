import SwiftUI

enum CreateCanvasKind: String {
    case presentation
    case gdoc
}

/// PDF pages 1–3: Create · Presentation / GDoc.
/// Centered slide or doc, Jesse rail on the right, one Ask-AI dock.
/// Slides rail (the thumbnail picker, formerly labeled "Storyboards")
/// shows whenever there is more than one slide — not only during a call.
/// Agent is Jesse. Mic is tap-to-toggle, same as `JesseCallSheetView`.
struct CreateCanvasView: View {
    var kind: CreateCanvasKind
    var studentName: String
    var onClose: () -> Void

    @EnvironmentObject private var jesseCall: JesseCallSession

    @State private var askText = ""
    @State private var slides: [CreateSlide] = [
        CreateSlide(title: "You were never bad at this.", body: "You were working alone. The page was hard because nobody who had done it was in the room."),
        CreateSlide(title: "Office hours from your room.", body: "Show the actual page. Someone who has done this walks in already knowing where you left off."),
        CreateSlide(title: "The map just changed.", body: "Every session becomes evidence. The evidence stays yours. Inspect it. Export it. Delete it."),
    ]
    @State private var slideIndex = 0
    @State private var docText = ""
    @State private var instructionLog: [String] = []
    @State private var spacePan: CGSize = .zero
    @State private var spaceZoom: CGFloat = 1
    @GestureState private var livePan: CGSize = .zero
    @GestureState private var liveZoom: CGFloat = 1

    private let artboard = CGSize(width: 1440, height: 810)

    private var firstName: String {
        let trimmed = studentName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != "there" else { return "there" }
        return trimmed.split(separator: " ").first.map(String.init) ?? trimmed
    }

    private var callLive: Bool {
        jesseCall.isActive && jesseCall.context == "create"
    }

    /// Slide-thumbnail picker. Not "people on the call" — it jumps
    /// `slideIndex`. Visible whenever a deck has more than one slide.
    private var showSlidesRail: Bool {
        kind == .presentation && slides.count > 1
    }

    private var spaceGesture: some Gesture {
        let drag = DragGesture(minimumDistance: 12)
            .updating($livePan) { value, state, _ in state = value.translation }
            .onEnded { value in
                spacePan.width += value.translation.width
                spacePan.height += value.translation.height
            }
        let pinch = MagnificationGesture()
            .updating($liveZoom) { value, state, _ in state = value }
            .onEnded { value in
                spaceZoom = min(2.6, max(0.65, spaceZoom * value))
            }
        return drag.simultaneously(with: pinch)
    }

    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            let board = CGSize(width: artboard.width * scale, height: artboard.height * scale)
            ZStack {
                Color.white.ignoresSafeArea()
                // Same dotted-grid treatment as the Work dashboard
                // (2026-08-18, explicit ask: "all other panels should
                // have polka dots too") - duplicated per-file, matching
                // this codebase's existing convention
                // (DottedDeskGrid/DottedLearnGrid/DottedDesignGrid).
                CreateDottedGrid()
                    .frame(width: geo.size.width, height: geo.size.height)
                ZStack(alignment: .topLeading) {
                    artboardContent(scale: scale)
                }
                .frame(width: board.width, height: board.height)
                .scaleEffect(spaceZoom * liveZoom)
                .offset(x: spacePan.width + livePan.width, y: spacePan.height + livePan.height)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(spaceGesture)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .overlay(alignment: .topTrailing) {
            Button("Done", action: onClose)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(createHex: "0c1207"))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Capsule().fill(Color(createHex: "c4f547")))
                .padding(.top, 12)
                .padding(.trailing, 16)
                .accessibilityIdentifier("createCanvasDone")
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.86), value: callLive)
        // Not a direct .accessibilityIdentifier() - confirmed live (via
        // DeskGridDashboardView's identical bug) that doing so clobbers
        // every nested button's own identifier (the Jesse rail's call
        // button, the dock, slides rail, add-slide, …) with this
        // container's own instead of just hiding them.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "create").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("createCanvasRoot")
                .allowsHitTesting(false)
        }
    }

    @ViewBuilder
    private func artboardContent(scale: CGFloat) -> some View {
        // No separate phone FAB - it duplicated "Jump on a call with
        // Jesse" inside jesseRail below, which does the same thing.
        // jesseRail stays at the SAME position whether or not a call is
        // live - it used to jump to a different box (CreateArtboard
        // .transcription) once callLive flipped, which read as teleporting
        // to a new tab instead of the conversation just continuing.
        if callLive || showSlidesRail {
            placed(CreateArtboard.liveSlide, scale: scale) { slideOrDoc }
            placed(CreateArtboard.jesseRailLive, scale: scale) { jesseRail }
            if showSlidesRail {
                placed(CreateArtboard.slidesRail, scale: scale) { slidesRail }
            }
        } else {
            placed(CreateArtboard.idleStage, scale: scale) { slideOrDoc }
            placed(CreateArtboard.jesseRailIdle, scale: scale) { jesseRail }
        }

        placed(CreateArtboard.dock, scale: scale) { createDock }
    }

    private func placed<Content: View>(_ box: CGRect, scale: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(width: box.width * scale, height: box.height * scale)
            .position(
                x: (box.minX + box.width / 2) * scale,
                y: (box.minY + box.height / 2) * scale
            )
    }

    // MARK: - Stage

    @ViewBuilder
    private var slideOrDoc: some View {
        if kind == .gdoc {
            gdocStage
                .accessibilityIdentifier("createCanvasGdoc")
        } else {
            presentationStage
                .accessibilityIdentifier("createCanvasSlide")
        }
    }

    private var presentationStage: some View {
        let safe = min(max(0, slideIndex), max(0, slides.count - 1))
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("PRESENTATION")
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .tracking(1.1)
                    .foregroundColor(.white.opacity(0.55))
                Spacer()
                Text("\(safe + 1) / \(max(slides.count, 1))")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(createHex: "c4f547"))
                    .monospacedDigit()
            }
            TextField(
                "Slide title",
                text: Binding(
                    get: { slides[safe].title },
                    set: { slides[safe].title = $0 }
                )
            )
            .font(.system(size: 28, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            TextField(
                "Talking point",
                text: Binding(
                    get: { slides[safe].body },
                    set: { slides[safe].body = $0 }
                ),
                axis: .vertical
            )
            .font(.system(size: 16, weight: .medium, design: .rounded))
            .foregroundColor(.white.opacity(0.82))
            .lineLimit(3...8)
            Spacer(minLength: 0)
            HStack(spacing: 10) {
                Button { slideIndex = max(0, slideIndex - 1) } label: {
                    Image(systemName: "chevron.left")
                        .frame(width: 36, height: 32)
                        .background(Capsule().fill(Color.white.opacity(0.12)))
                }
                .disabled(safe == 0)
                .opacity(safe == 0 ? 0.35 : 1)
                Button {
                    let at = min(safe + 1, slides.count)
                    slides.insert(CreateSlide(title: "New slide", body: "Say the next thing."), at: at)
                    slideIndex = at
                } label: {
                    Text("+ Slide")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .padding(.horizontal, 14)
                        .frame(height: 32)
                        .background(Capsule().fill(Color(createHex: "c4f547")))
                        .foregroundColor(Color(createHex: "0c1207"))
                }
                .accessibilityIdentifier("createCanvasAddSlide")
                Spacer()
                Button { slideIndex = min(slides.count - 1, slideIndex + 1) } label: {
                    Image(systemName: "chevron.right")
                        .frame(width: 36, height: 32)
                        .background(Capsule().fill(Color.white.opacity(0.12)))
                }
                .disabled(safe >= slides.count - 1)
                .opacity(safe >= slides.count - 1 ? 0.35 : 1)
            }
            .foregroundColor(.white)
            .buttonStyle(.plain)
        }
        .padding(22)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(
                    colors: [Color(createHex: "1a2c24"), Color(createHex: "0d1612")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .shadow(color: .black.opacity(0.18), radius: 16, y: 8)
        )
    }

    private var gdocStage: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("GDOC")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .tracking(1.1)
                .foregroundColor(Color(createHex: "143a2e").opacity(0.45))
            TextEditor(text: $docText)
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .scrollContentBackground(.hidden)
                .foregroundColor(Color(createHex: "143a2e"))
                .overlay(alignment: .topLeading) {
                    if docText.isEmpty {
                        Text("Write on the canvas. Jesse can take it from a call or the dock.")
                            .font(.system(size: 15, weight: .medium, design: .rounded))
                            .foregroundColor(Color(createHex: "143a2e").opacity(0.35))
                            .padding(.top, 8)
                            .padding(.leading, 5)
                            .allowsHitTesting(false)
                    }
                }
        }
        .padding(22)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(createHex: "fff8e9"))
                .shadow(color: .black.opacity(0.12), radius: 16, y: 8)
        )
    }

    // MARK: - Jesse rail (page 1 / 3)

    /// Greeting + transcript in ONE box, at one fixed position - previously
    /// the transcript was a separate positioned rail that only appeared
    /// once a call went live, which read as jumping to "its own new tab"
    /// instead of the conversation just continuing under the greeting.
    /// jesseCall.turns now persists across calls (JesseCallSession no
    /// longer wipes it in begin()), so past turns stay visible here too -
    /// not just for the current call.
    private var jesseRail: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(createHex: "e8f3ec"))
                    Image(systemName: "face.smiling")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundColor(Color(createHex: "247a4d"))
                }
                .frame(width: 52, height: 52)
                VStack(alignment: .leading, spacing: 4) {
                    JesseMiniWaveform(active: jesseCall.isSpeaking || jesseCall.isListening)
                    Text(jesseCall.isActive ? "On the line" : "Just now")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(createHex: "143a2e").opacity(0.45))
                }
            }

            Text("Hi \(firstName), Jesse here.")
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundColor(Color(createHex: "143a2e"))
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(createHex: "eef1ec"))
                )

            // Pinned right under the greeting - toggles to a real "End
            // call" once active (previously just went disabled/"On the
            // line" with no way to actually hang up from here). Transcript
            // scrolls beneath it, not above.
            Button(action: jesseCall.isActive ? endCall : jumpOnCall) {
                HStack {
                    Image(systemName: jesseCall.isActive ? "phone.down.fill" : "phone.fill")
                    Text(jesseCall.isActive ? "End call" : "Jump on a call with Jesse")
                    Spacer(minLength: 0)
                    if !jesseCall.isActive { Image(systemName: "arrow.right") }
                }
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(Capsule().fill(jesseCall.isActive ? Color(createHex: "b0473f") : Color.black))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("createCanvasCallJesse")

            if !jesseCall.turns.isEmpty || !instructionLog.isEmpty || jesseCall.isListening || jesseCall.isThinking {
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(jesseCall.turns) { turn in
                            transcriptLine(turn.speaker == "jesse" ? "Jesse" : firstName, turn.text)
                        }
                        if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty {
                            transcriptLine(firstName, jesseCall.liveTranscript)
                                .opacity(0.55)
                        }
                        ForEach(Array(instructionLog.enumerated()), id: \.offset) { _, line in
                            transcriptLine("Dock", line)
                        }
                        if jesseCall.isThinking {
                            Text("Jesse is working")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(createHex: "247a4d"))
                        }
                    }
                }
                .frame(maxHeight: 240)
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(createHex: "f3f1ec"))
                )
                .accessibilityIdentifier("createCanvasTranscription")
            }

            Text("or continue in chat")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(createHex: "143a2e").opacity(0.4))
                .frame(maxWidth: .infinity)

            if let status = jesseCall.status {
                Text(status)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(createHex: "b0473f"))
            }

            Spacer(minLength: 0)
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.08), radius: 14, y: 6)
        )
        // Not a direct .accessibilityIdentifier() - would clobber
        // createCanvasCallJesse's own identifier the same way workDock did.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "jesse-rail").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("createCanvasJesseRail")
                .allowsHitTesting(false)
        }
    }

    private func transcriptLine(_ who: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(who.uppercased())
                .font(.system(size: 9, weight: .heavy, design: .rounded))
                .tracking(0.6)
                .foregroundColor(Color(createHex: "143a2e").opacity(0.4))
            Text(text)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(createHex: "143a2e"))
        }
    }

    private var slidesRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Slides")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(createHex: "143a2e").opacity(0.45))
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(Array(slides.enumerated()), id: \.element.id) { index, slide in
                        Button { slideIndex = index } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(slide.title)
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                                    .lineLimit(2)
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, minHeight: 72, alignment: .topLeading)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(index == slideIndex ? Color(createHex: "247a4d") : Color(createHex: "1a2c24"))
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
        )
        .accessibilityIdentifier("createCanvasSlides")
    }

    // MARK: - Dock + call

    /// Nested search-styled capsule (magnifying glass + white-opacity
    /// pill inside the dark dock) matches `DeskGridDashboardView.
    /// searchField` - the same family of dock every screen should read
    /// as, not a one-off plain text field.
    private var createDock: some View {
        HStack(spacing: 12) {
            Image(systemName: "paperclip")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white.opacity(0.85))
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.white.opacity(0.45))
                TextField("Ask AI…", text: $askText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .foregroundColor(.white)
                    .onSubmit { sendAsk() }
                    .accessibilityIdentifier("createCanvasAsk")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color.white.opacity(0.12)))
            .frame(maxWidth: .infinity)
            Button(action: sendAsk) {
                Text("Send")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(createHex: "0c1207"))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Color(createHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .opacity(askText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.35 : 1)
            .disabled(askText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Button {
                toggleMic()
            } label: {
                Image(systemName: jesseCall.isListening ? "mic.fill" : "mic")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(jesseCall.isListening ? Color(createHex: "0c1207") : .white)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(jesseCall.isListening ? Color(createHex: "c4f547") : Color.white.opacity(0.12)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("createCanvasMic")

            JesseMiniWaveform(active: jesseCall.isListening || jesseCall.isSpeaking)
                .frame(width: 28, height: 28)
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 14)
        .background(Capsule().fill(Color(createHex: "1c1c1e")))
        // Not a direct .accessibilityIdentifier() - would clobber
        // createCanvasAsk and createCanvasMic's own identifiers.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "create-dock").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("createCanvasDock")
                .allowsHitTesting(false)
        }
    }

    private func jumpOnCall() {
        if !jesseCall.isActive {
            jesseCall.begin(context: "create")
        }
        if jesseCall.isListening {
            jesseCall.stopListening()
        } else {
            jesseCall.startListening()
        }
    }

    /// Real hang-up - the button used to just go disabled/"On the line"
    /// once active, with no way to actually end the call from here.
    private func endCall() {
        jesseCall.end()
    }

    private func toggleMic() {
        if !jesseCall.isActive {
            jesseCall.begin(context: "create")
        }
        if jesseCall.isListening {
            jesseCall.stopListening()
        } else {
            jesseCall.startListening()
        }
    }

    private func sendAsk() {
        let text = askText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        instructionLog.append(text)
        askText = ""
        // Transcript is the instruction stream. Do not fake a finished slide.
    }
}

/// Same dotted-grid treatment as `DeskGridDashboardView.DottedDeskGrid` /
/// `LearnStudioView.DottedLearnGrid` / `DesignStudioView.DottedDesignGrid` -
/// duplicated per-file by convention in this codebase rather than shared,
/// same step/size/color.
private struct CreateDottedGrid: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 16
            for x in stride(from: 8, through: size.width, by: step) {
                for y in stride(from: 8, through: size.height, by: step) {
                    let dot = Path(ellipseIn: CGRect(x: x, y: y, width: 1.4, height: 1.4))
                    context.fill(dot, with: .color(Color(createHex: "d7d0c2")))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private struct CreateSlide: Identifiable {
    let id = UUID()
    var title: String
    var body: String
}

private enum CreateArtboard {
    /// 1440×810. Tightened margins (28pt outer, not the old 96/76 split)
    /// and, critically, TWO separate Jesse-rail widths instead of one box
    /// reused for both layouts - the old single `jesseRail` (x:988,
    /// width:376, so it spanned to x:1364) was reused as-is for the
    /// 3-column live/multi-slide row too, where `slidesRail` starts at
    /// x:1225 - a 139pt overlap that was live on every normal load (the
    /// seed deck ships 3 slides, so `showSlidesRail` is true from the
    /// first frame, not just during a call). Real bug, not just a spacing
    /// preference - fixed by giving the 3-column row its own narrower
    /// rail width instead of borrowing the 2-column one.
    static let idleStage = CGRect(x: 28, y: 48, width: 920, height: 560)
    static let jesseRailIdle = CGRect(x: 980, y: 48, width: 432, height: 560)
    static let liveSlide = CGRect(x: 28, y: 48, width: 739, height: 560)
    static let jesseRailLive = CGRect(x: 787, y: 48, width: 403, height: 560)
    static let slidesRail = CGRect(x: 1210, y: 48, width: 202, height: 560)
    static let dock = CGRect(x: 28, y: 632, width: 1384, height: 96)
}

struct JesseMiniWaveform: View {
    var active: Bool

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<7, id: \.self) { i in
                Capsule()
                    .fill(Color(createHex: "247a4d").opacity(active ? 0.95 : 0.35))
                    .frame(width: 3, height: active ? CGFloat([8, 14, 20, 12, 18, 10, 7][i]) : 7)
            }
        }
        // Real bug (reported: bars kept pulsing after ending a call/
        // transcribe): a `.repeatForever` animation bound only via
        // `value:` doesn't reliably cancel when that value flips back to
        // false - a known SwiftUI quirk. Fix: only repeat WHILE active;
        // the return-to-rest transition uses a normal, non-repeating
        // animation instead of trying to interrupt a live infinite loop.
        .animation(active ? .easeInOut(duration: 0.28).repeatForever(autoreverses: true) : .easeInOut(duration: 0.2), value: active)
    }
}

extension Color {
    init(createHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
