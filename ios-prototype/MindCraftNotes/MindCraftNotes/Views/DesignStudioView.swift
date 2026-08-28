import SwiftUI

/// Design Studio (rebuilt 2026-08-19) - ONE content canvas where a student
/// lays out a book spatially: chapters, simulations, checkpoints, and
/// branches as connectable boxes. This is the fusion of the two screens the
/// old Develop toggle flipped between: the box/connector mechanism came from
/// the original workflow canvas (which could render edges but had no way to
/// create one, and whose find/ask/make/output vocabulary was a dead end -
/// three of four types were inert), and the actual content pipeline came
/// from `BookWorkflowView` (real Jesse book-agent loop + `BinderStore.
/// addBook`), which now runs scoped inside a `.chapter` box instead of as a
/// separate top-level mode.
///
/// Two things the old canvas lacked that made it non-functional are real
/// now: edges can be created (long-press a box, or the inspector's
/// "Connect to..." - then tap the target), and the whole graph autosaves
/// through `ContentGraphStore` (UserDefaults draft; publish is still the
/// explicit `BinderStore.addBook` step, fed by walking the graph from its
/// start box along edges - see `ContentGraphStore.assembleBook`).
///
/// Layout follows the same 1440x810 artboard `DeskGridDashboardView`/
/// `LearnStudioView`/`BookWorkflowView` use, and the dashboard's own visual
/// language (cream dotted board, near-white cards, forest ink, soft
/// shadows) instead of the old full-saturation colored blocks.
struct DesignStudioView: View {
    var studentName: String
    var onClose: () -> Void
    /// True when this renders inside the Work Dashboard's binder content-
    /// viewer instead of full-screen (2026-08-22, in-binder consolidation).
    /// Defaults false so FieldDeskView's existing full-screen presentation
    /// is unaffected. `scale`'s own math needs no change either way - it
    /// already derives from whatever GeometryReader frame this view is
    /// given, not the screen's own bounds.
    var embedded: Bool = false

    @EnvironmentObject private var jesseCall: JesseCallSession
    @StateObject private var graph = ContentGraphStore()
    @StateObject private var binder = BinderStore()

    @State private var selectedId: String?
    @State private var dragStart: [String: CGPoint] = [:]
    /// Non-nil while "pick the box this one connects to" mode is live.
    @State private var connectFromId: String?
    /// `.chapter` box currently open in the scoped Jesse book flow.
    @State private var chapterFlowBox: DesignBox?
    /// `.simulation` box currently open in the Blockly workspace shell.
    @State private var simulationBox: DesignBox?
    /// `.simulation` box currently browsing the real sim library for
    /// (2026-08-23, explicit ask - see simulationInspector's own comment).
    @State private var simLibraryBox: DesignBox?
    /// Full-screen sim viewer state (2026-08-23, explicit ask: "use the
    /// entire simulations box to show them the sim").
    @State private var fullScreenSim: DesignSimPreview?
    /// Non-nil while an AI sim generation request is in flight for this
    /// box id - `generate-sim`'s real pipeline (fit-check -> generate ->
    /// rubric -> vision gate) is a genuine 15-60+ second job, not
    /// something to fire-and-forget without a visible loading state.
    @State private var generatingSimBoxId: String?
    /// Set only on a real, terminal failure (no good result / rate
    /// limited / service unavailable) - cleared on the next attempt.
    @State private var simGenerationError: String?

    private enum PublishState: Equatable {
        case idle, publishing, done(String), failed(String)
    }

    @State private var publishState: PublishState = .idle
    @State private var showPreview = false

    private let artboard = CGSize(width: 1440, height: 810)

    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            ZStack {
                Color(dsHex: "fff8e9").ignoresSafeArea()
                DottedDesignGrid().frame(width: geo.size.width, height: geo.size.height)
                ZStack(alignment: .topLeading) {
                    pin(StudioBoard.header, scale: scale) { header }
                    pin(StudioBoard.canvas, scale: scale) { canvasChrome }

                    connectorLayer(scale: scale)

                    ForEach(graph.boxes) { box in
                        boxView(box, scale: scale)
                    }

                    // Jesse rail removed here (2026-08-24, explicit ask -
                    // see StudioBoard.canvas's own doc comment). The
                    // inspector now only renders, as a floating overlay,
                    // when a box is actually selected - nothing occupies
                    // this space otherwise, leaving the widened canvas
                    // fully clear.
                    if let id = selectedId, let box = graph.box(id) {
                        pin(StudioBoard.inspectorOverlay, scale: scale) {
                            inspector(box)
                        }
                    }
                    pin(StudioBoard.timeline, scale: scale) { timelineStrip }
                    pin(StudioBoard.dock, scale: scale) { dock }

                    if connectFromId != nil {
                        pin(StudioBoard.connectBanner, scale: scale) { connectBanner }
                    }
                }
                .frame(width: artboard.width * scale, height: artboard.height * scale)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea(edges: embedded ? [] : .all)
        .statusBarHidden(!embedded)
        .fullScreenCover(item: $chapterFlowBox) { box in
            // Scoped chapter flow - the existing BookWorkflowView Jesse
            // loop, seeded from THIS box and saving back to the canvas
            // instead of publishing one global draft to Binder.
            BookWorkflowView(
                onClose: { chapterFlowBox = nil },
                studentName: studentName,
                chapterScope: .init(chapter: box.asChapter) { draft in
                    applyChapterDraft(draft, to: box.id)
                }
            )
            .environmentObject(jesseCall)
        }
        .fullScreenCover(isPresented: $showPreview) {
            BookPreviewView(
                title: graph.resolvedTitle,
                graph: graph,
                onClose: { showPreview = false }
            )
        }
        .fullScreenCover(item: $simulationBox) { box in
            SimulationStudioView(
                boxTitle: box.title,
                initialState: box.workspaceState,
                referenceURL: box.referenceURL,
                onSave: { state in
                    graph.updateBox(box.id) { $0.workspaceState = state }
                },
                onClose: { simulationBox = nil }
            )
        }
        .sheet(item: $simLibraryBox) { box in
            DesignStudioSimLibrarySheet(
                onPick: { title, html in
                    graph.updateBox(box.id) {
                        $0.generatedSimHTML = html
                        $0.generatedSimTitle = title
                    }
                    simLibraryBox = nil
                },
                onClose: { simLibraryBox = nil }
            )
        }
        .fullScreenCover(item: $fullScreenSim) { preview in
            FullScreenSimPlayer(title: preview.title, html: preview.html, onBack: { fullScreenSim = nil })
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "design-studio").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("designStudio")
                .allowsHitTesting(false)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("DESIGN STUDIO")
                    .font(.system(size: 9.5, weight: .heavy, design: .rounded))
                    .tracking(1.1)
                    .foregroundColor(Color(dsHex: "143a2e").opacity(0.45))
                TextField("Name your book", text: Binding(
                    get: { graph.title },
                    set: { graph.setTitle($0) }
                ))
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .textFieldStyle(.plain)
                .autocorrectionDisabled()
                .accessibilityIdentifier("designStudioBookTitle")
            }
            .frame(width: 300, alignment: .leading)

            Spacer(minLength: 0)

            switch publishState {
            case .done(let message):
                publishFeedback(message, color: Color(dsHex: "247a4d"))
            case .failed(let message):
                publishFeedback(message, color: Color(dsHex: "b3261e"))
            case .idle where !graph.boxes.isEmpty && !graph.canPublish:
                publishFeedback("Write at least one chapter to publish", color: Color(dsHex: "143a2e").opacity(0.45))
            default:
                EmptyView()
            }

            Button {
                showPreview = true
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "book")
                    Text("Preview")
                }
                .font(.system(size: 12.5, weight: .bold, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(Capsule().strokeBorder(Color(dsHex: "143a2e").opacity(0.35), lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .disabled(graph.boxes.isEmpty)
            .opacity(graph.boxes.isEmpty ? 0.4 : 1)
            .accessibilityIdentifier("designStudioPreviewBook")

            // Renamed to plain "Publish" (2026-08-24, explicit ask:
            // "publish to binder should be publish which them published") -
            // and once it succeeds, the button itself reflects "Published"
            // rather than just the adjacent feedback text, same
            // confirmed-state pattern StudyCompanionView's "Save to
            // Binder" -> "Saved" already uses.
            Button(action: publish) {
                HStack(spacing: 5) {
                    if case .done = publishState {
                        Image(systemName: "checkmark")
                    }
                    Text(publishButtonLabel)
                }
                .font(.system(size: 12.5, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 9)
                .background(Capsule().fill(graph.canPublish ? Color.black : Color.black.opacity(0.25)))
            }
            .buttonStyle(.plain)
            .disabled(!graph.canPublish || publishState == .publishing)
            .accessibilityIdentifier("designStudioPublish")

            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 12.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(dsHex: "0c1207"))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .background(Capsule().fill(Color(dsHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("designStudioDone")
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
        )
    }

    private var publishButtonLabel: String {
        switch publishState {
        case .publishing: return "Publishing\u{2026}"
        case .done: return "Published"
        default: return "Publish"
        }
    }

    private func publishFeedback(_ message: String, color: Color) -> some View {
        Text(message)
            .font(.system(size: 11.5, weight: .semibold, design: .rounded))
            .foregroundColor(color)
            .lineLimit(2)
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: 260, alignment: .trailing)
    }

    private func publish() {
        guard let assembled = graph.assembleBook() else { return }
        publishState = .publishing
        let itemId = binder.addBook(title: assembled.title, body: assembled.body)
        if itemId.isEmpty {
            publishState = .failed("Sign in to publish to your Binder")
        } else {
            publishState = .done("Filed to your Binder")
        }
    }

    // MARK: - Canvas chrome (the board the boxes float over)

    private var canvasChrome: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .strokeBorder(Color(dsHex: "e4dcc8"), lineWidth: 1.5)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.white.opacity(0.4))
            )
            .overlay {
                if graph.boxes.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "square.grid.2x2")
                            .font(.system(size: 26, weight: .semibold))
                            .foregroundColor(Color(dsHex: "143a2e").opacity(0.25))
                        Text("Lay your book out here")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(dsHex: "143a2e").opacity(0.6))
                        Text("Add a Chapter from the tools below, then long-press a box to connect it to what comes next.")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(Color(dsHex: "143a2e").opacity(0.45))
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 340)
                    }
                }
            }
            .onTapGesture {
                // Tapping empty board clears selection / cancels connect
                // mode - standard node-editor escape hatch.
                withAnimation(.easeInOut(duration: 0.15)) {
                    selectedId = nil
                    connectFromId = nil
                }
            }
    }

    private var connectBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "point.topleft.down.curvedto.point.bottomright.up")
                .font(.system(size: 12, weight: .bold))
            Text("Tap the box that comes next")
                .font(.system(size: 12.5, weight: .bold, design: .rounded))
            Button {
                withAnimation(.easeInOut(duration: 0.15)) { connectFromId = nil }
            } label: {
                Text("Cancel")
                    .font(.system(size: 11.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(dsHex: "c4f547"))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("designStudioCancelConnect")
        }
        .foregroundColor(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 9)
        .background(Capsule().fill(Color(dsHex: "143a2e")).shadow(color: .black.opacity(0.2), radius: 8, y: 4))
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "connect-banner").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("designStudioConnectBanner")
                .allowsHitTesting(false)
        }
    }

    // MARK: - Boxes

    private func boxView(_ box: DesignBox, scale: CGFloat) -> some View {
        let accent = boxAccent(box.type)
        let pos = CGPoint(
            x: (StudioBoard.canvas.minX + box.position.x + DesignBox.size.width / 2) * scale,
            y: (StudioBoard.canvas.minY + box.position.y + DesignBox.size.height / 2) * scale
        )
        let isSelected = selectedId == box.id
        let isConnectSource = connectFromId == box.id
        return VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(accent.opacity(0.14))
                    Image(systemName: box.type.glyph)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(accent)
                }
                .frame(width: 20, height: 20)
                Text(box.type.label.uppercased())
                    .font(.system(size: 8.5, weight: .heavy, design: .rounded))
                    .tracking(0.7)
                    .foregroundColor(accent)
                Spacer(minLength: 0)
                if connectFromId != nil && !isConnectSource {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(Color(dsHex: "247a4d"))
                }
            }

            Text(box.title.isEmpty ? "Untitled" : box.title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .lineLimit(1)

            Text(box.statusLine)
                .font(.system(size: 10.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "8a8478"))
                .lineLimit(1)

            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
        .padding(.trailing, 10)
        .padding(.leading, 14)
        .frame(width: DesignBox.size.width * scale, height: DesignBox.size.height * scale, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(white: 0.985))
        )
        .overlay(alignment: .leading) {
            // Type accent as a slim edge bar, not a full-color block - the
            // dashboard's card language (near-white + accents), which is
            // what the old saturated boxes were clashing against.
            UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 14, bottomTrailingRadius: 0, topTrailingRadius: 0, style: .continuous)
                .fill(accent)
                .frame(width: 5)
        }
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(
                    isConnectSource ? Color(dsHex: "247a4d") : (isSelected ? accent : Color(dsHex: "e4dcc8").opacity(0.8)),
                    lineWidth: isSelected || isConnectSource ? 2 : 1
                )
        )
        .overlay(alignment: .trailing) {
            // Outgoing-connection handle - a visual affordance marking
            // where edges leave; the actual gesture is long-press (or the
            // inspector's "Connect to...").
            Circle()
                .fill(Color(white: 0.985))
                .overlay(Circle().strokeBorder(accent.opacity(0.7), lineWidth: 1.5))
                .frame(width: 10, height: 10)
                .offset(x: 5)
        }
        .shadow(color: .black.opacity(isSelected ? 0.16 : 0.09), radius: isSelected ? 12 : 7, y: 4)
        .position(pos)
        .gesture(
            DragGesture(minimumDistance: 2)
                .onChanged { value in
                    let start = dragStart[box.id] ?? box.position
                    if dragStart[box.id] == nil { dragStart[box.id] = box.position }
                    let next = CGPoint(
                        x: clamp(start.x + value.translation.width / scale, 0, StudioBoard.canvas.width - DesignBox.size.width),
                        y: clamp(start.y + value.translation.height / scale, 0, StudioBoard.canvas.height - DesignBox.size.height)
                    )
                    graph.setPosition(box.id, next)
                }
                .onEnded { _ in
                    dragStart[box.id] = nil
                    // Snap to an 8pt grid on release - boxes line up without
                    // pixel-nudging, which is most of what made the old
                    // canvas read as scattered/toy-like.
                    if let current = graph.box(box.id)?.position {
                        graph.setPosition(box.id, CGPoint(
                            x: (current.x / 8).rounded() * 8,
                            y: (current.y / 8).rounded() * 8
                        ))
                    }
                    graph.commitPosition()
                }
        )
        .onTapGesture { handleBoxTap(box) }
        .onLongPressGesture(minimumDuration: 0.45) {
            withAnimation(.easeInOut(duration: 0.15)) {
                connectFromId = box.id
                selectedId = box.id
            }
        }
        .accessibilityIdentifier("designStudioBox_\(box.id)")
    }

    private func handleBoxTap(_ box: DesignBox) {
        if let from = connectFromId {
            guard from != box.id else { return }
            completeConnection(from: from, to: box.id)
            return
        }
        withAnimation(.easeInOut(duration: 0.15)) { selectedId = box.id }
    }

    private func completeConnection(from: String, to: String) {
        let label: String? = {
            guard graph.box(from)?.type == .branch else { return nil }
            return "Choice \(graph.edgesFrom(from).count + 1)"
        }()
        _ = graph.addEdge(from: from, to: to, label: label)
        withAnimation(.easeInOut(duration: 0.15)) {
            connectFromId = nil
            selectedId = from
        }
    }

    private func boxAccent(_ type: DesignBoxType) -> Color {
        switch type {
        case .chapter: return Color(dsHex: "247a4d")
        case .simulation: return Color(dsHex: "5b3e8f")
        case .checkpoint: return Color(dsHex: "a3651f")
        case .branch: return Color(dsHex: "5b7596")
        }
    }

    // MARK: - Connectors

    private func connectorLayer(scale: CGFloat) -> some View {
        Canvas { context, _ in
            for edge in graph.edges {
                guard let from = graph.box(edge.from), let to = graph.box(edge.to) else { continue }
                let p1 = CGPoint(
                    x: (StudioBoard.canvas.minX + from.position.x + DesignBox.size.width) * scale,
                    y: (StudioBoard.canvas.minY + from.position.y + DesignBox.size.height / 2) * scale
                )
                let p2 = CGPoint(
                    x: (StudioBoard.canvas.minX + to.position.x) * scale,
                    y: (StudioBoard.canvas.minY + to.position.y + DesignBox.size.height / 2) * scale
                )
                let c = max(30, abs(p2.x - p1.x) * 0.5)
                let c1 = CGPoint(x: p1.x + c, y: p1.y)
                let c2 = CGPoint(x: p2.x - c, y: p2.y)
                var path = Path()
                path.move(to: p1)
                path.addCurve(to: p2, control1: c1, control2: c2)

                let stroke = Color(dsHex: "143a2e").opacity(edge.label == nil ? 0.32 : 0.5)
                context.stroke(path, with: .color(stroke), lineWidth: edge.label == nil ? 2 : 2.5)

                // Arrowhead at the target end, along the curve's end tangent.
                let angle = atan2(p2.y - c2.y, p2.x - c2.x)
                let arrowLength: CGFloat = 9 * scale.clampedForChrome
                var arrow = Path()
                arrow.move(to: p2)
                arrow.addLine(to: CGPoint(
                    x: p2.x - arrowLength * cos(angle - 0.45),
                    y: p2.y - arrowLength * sin(angle - 0.45)
                ))
                arrow.addLine(to: CGPoint(
                    x: p2.x - arrowLength * cos(angle + 0.45),
                    y: p2.y - arrowLength * sin(angle + 0.45)
                ))
                arrow.closeSubpath()
                context.fill(arrow, with: .color(stroke))

                // Choice label pill at the curve midpoint (cubic at t=0.5).
                if let label = edge.label, !label.isEmpty {
                    let mid = CGPoint(
                        x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8,
                        y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8
                    )
                    let text = context.resolve(
                        Text(label)
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundColor(Color(dsHex: "143a2e"))
                    )
                    let size = text.measure(in: CGSize(width: 160, height: 40))
                    let padded = CGRect(
                        x: mid.x - size.width / 2 - 7,
                        y: mid.y - size.height / 2 - 4,
                        width: size.width + 14,
                        height: size.height + 8
                    )
                    let pill = Path(roundedRect: padded, cornerRadius: padded.height / 2)
                    context.fill(pill, with: .color(Color(white: 0.985)))
                    context.stroke(pill, with: .color(Color(dsHex: "5b7596").opacity(0.5)), lineWidth: 1)
                    context.draw(text, at: mid, anchor: .center)
                }
            }
        }
        .allowsHitTesting(false)
        .frame(width: artboard.width * scale, height: artboard.height * scale)
    }

    // MARK: - Inspector

    private func inspector(_ box: DesignBox) -> some View {
        let accent = boxAccent(box.type)
        return ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    Image(systemName: box.type.glyph)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(accent)
                    Text(box.type.label)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(Color(dsHex: "143a2e"))
                    Spacer(minLength: 0)
                    Button {
                        withAnimation { selectedId = nil }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundColor(Color(dsHex: "143a2e").opacity(0.35))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("designStudioInspectorClose")
                }

                inspectorLabel("TITLE")
                TextField("Name this \(box.type.label.lowercased())", text: bindingForBox(box.id, get: \.title, set: { $0.title = $1 }))
                    .font(.system(size: 13.5, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(dsHex: "143a2e"))
                    .padding(9)
                    .background(fieldBackground)
                    .accessibilityIdentifier("designStudioBoxTitleField")

                switch box.type {
                case .chapter: chapterInspector(box)
                case .simulation: simulationInspector(box)
                case .checkpoint: checkpointInspector(box)
                case .branch: branchInspector(box)
                }

                connectionsSection(box)

                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { connectFromId = box.id }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "point.topleft.down.curvedto.point.bottomright.up")
                        Text("Connect to\u{2026}")
                    }
                    .font(.system(size: 12.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(dsHex: "143a2e"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Capsule().strokeBorder(Color(dsHex: "143a2e").opacity(0.35), lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("designStudioConnect")

                Button(role: .destructive) {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        graph.removeBox(box.id)
                        selectedId = nil
                        connectFromId = nil
                    }
                } label: {
                    Text("Remove box")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(Color(dsHex: "b3261e"))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .padding(.top, 2)
                .accessibilityIdentifier("designStudioRemoveBox")
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.1), radius: 14, y: 6)
        )
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "inspector").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("designStudioInspector")
                .allowsHitTesting(false)
        }
    }

    private func chapterInspector(_ box: DesignBox) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            inspectorLabel("CHAPTER TEXT")
            TextEditor(text: bindingForBox(box.id, get: \.chapterBody, set: { $0.chapterBody = $1 }))
                .font(.system(size: 12.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .scrollContentBackground(.hidden)
                .frame(height: 130)
                .padding(6)
                .background(fieldBackground)
                .accessibilityIdentifier("designStudioChapterBody")

            Button {
                chapterFlowBox = box
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "phone.fill")
                    Text("Write it with Jesse")
                }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(Capsule().fill(Color.black))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("designStudioOpenChapterFlow")

            Text("Talk it through and chapters land back on this canvas - or just type above.")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e").opacity(0.5))
        }
    }

    private func simulationInspector(_ box: DesignBox) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            inspectorLabel("PROMPT (AI-GENERATED SIM)")
            TextEditor(text: bindingForBox(box.id, get: \.simPrompt, set: { $0.simPrompt = $1 }))
                .font(.system(size: 12.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .scrollContentBackground(.hidden)
                .frame(height: 70)
                .padding(6)
                .background(fieldBackground)
                .accessibilityIdentifier("designStudioSimPrompt")

            if let chapterTitle = graph.upstreamChapterTitle(for: box.id) {
                Text("Grounded in the connected chapter \u{201c}\(chapterTitle)\u{201d}.")
                    .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(dsHex: "5b3e8f"))
            }

            Button {
                generateSim(for: box)
            } label: {
                HStack(spacing: 6) {
                    if generatingSimBoxId == box.id {
                        ProgressView().tint(.white).scaleEffect(0.8)
                    } else {
                        Image(systemName: "sparkles")
                    }
                    Text(generatingSimBoxId == box.id
                         ? "Generating\u{2026} (up to a minute)"
                         : (box.generatedSimHTML.isEmpty ? "Generate with AI" : "Regenerate"))
                }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(Capsule().fill(Color.black))
            }
            .buttonStyle(.plain)
            .disabled(generatingSimBoxId != nil || box.simPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityIdentifier("designStudioGenerateSim")

            if let error = simGenerationError, generatingSimBoxId == nil {
                Text(error)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(dsHex: "b0473f"))
            }

            if !box.generatedSimHTML.isEmpty {
                // Real ask (2026-08-23): "when I click on the sim use the
                // entire simulations box to show them the sim and put a
                // back button somewhere on top" - this 180pt inline
                // preview needed pinch-and-scroll to actually use (a real
                // p5.js sim is usually 800x650+). Tapping it now opens the
                // real thing full-screen; the small box stays as a
                // thumbnail/preview only.
                Button {
                    fullScreenSim = DesignSimPreview(
                        title: box.generatedSimTitle.isEmpty ? "Generated sim" : box.generatedSimTitle,
                        html: box.generatedSimHTML
                    )
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(box.generatedSimTitle.isEmpty ? "Generated sim" : box.generatedSimTitle)
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(Color(dsHex: "143a2e"))
                            Spacer(minLength: 0)
                            Image(systemName: "arrow.up.left.and.arrow.down.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(Color(dsHex: "143a2e").opacity(0.5))
                        }
                        InlineSimWebView(html: box.generatedSimHTML)
                            .frame(height: 180)
                            .allowsHitTesting(false)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(dsHex: "143a2e").opacity(0.1)))
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("designStudioGeneratedSimPreview")
            }

            Divider().padding(.vertical, 2)

            inspectorLabel("REFERENCE URL (OPTIONAL)")
            TextField("https://\u{2026}", text: bindingForBox(box.id, get: \.referenceURL, set: { $0.referenceURL = $1 }))
                .font(.system(size: 12.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(9)
                .background(fieldBackground)
                .accessibilityIdentifier("designStudioReferenceURL")

            // Real ask (2026-08-23): "you should also be able to browse the
            // sim library too... click that, open the sims archive and
            // click sth to load that there in that box." Same real library
            // Archive's own Simulations tab reads (ArchiveSimsLoader.loadAll
            // - chapter-book sims + the generated_sims library + Dan
            // McCreary's full catalog), not a new/parallel list. Picking one
            // loads its real html straight into this box the same way
            // "Generate with AI" does.
            Button {
                simLibraryBox = box
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "books.vertical.fill")
                    Text("Browse sim library")
                }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Capsule().strokeBorder(Color(dsHex: "143a2e").opacity(0.2)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("designStudioBrowseSimLibrary")

            Button {
                simulationBox = box
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "square.on.square.squareshape.controlhandles")
                    Text(box.workspaceState.isEmpty ? "Build the blocks yourself" : "Open block workspace")
                }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(Capsule().fill(Color(dsHex: "5b3e8f")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("designStudioOpenWorkspace")

            Text(box.workspaceState.isEmpty
                 ? "Or draw it yourself in a Blockly block editor - what you build saves back into this box."
                 : "Workspace saved \u{00b7} it reloads exactly where you left it.")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e").opacity(0.5))
        }
    }

    /// Calls the SAME real, budget-capped, gate-passed generation pipeline
    /// Jesse's voice flow already uses (`GeneratedSimClient` ->
    /// `/api/generate-sim`) - no new backend, no new quality bar, a
    /// simulation box just becomes a second way to reach the one real
    /// generation path. See `ContentGraphStore.upstreamChapterTitle` for
    /// why grounding is title-level, not full chapter text.
    private func generateSim(for box: DesignBox) {
        let prompt = box.simPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }
        let topic: String
        if let chapterTitle = graph.upstreamChapterTitle(for: box.id) {
            topic = "In the context of \u{201c}\(chapterTitle)\u{201d}: \(prompt)"
        } else {
            topic = prompt
        }
        generatingSimBoxId = box.id
        simGenerationError = nil
        // Activity feed (2026-08-27) - same log-only shape as
        // JesseCallSession's own GeneratedSimClient call site.
        let activityId = UUID().uuidString
        GenerationActivityBus.shared.logStart(id: activityId, title: topic, phase: "generating")
        Task {
            let verdict = await GeneratedSimClient.requestSim(topic: topic)
            await MainActor.run {
                generatingSimBoxId = nil
                switch verdict {
                case .verified(let result, _):
                    graph.updateBox(box.id) {
                        $0.generatedSimHTML = result.html
                        $0.generatedSimTitle = result.title
                    }
                    GenerationActivityBus.shared.logFinish(id: activityId, title: topic)
                case .noGoodResult(let reason, let suggestedRetryTopic):
                    var message = reason ?? "Couldn't make a good sim for that prompt."
                    if let suggestedRetryTopic { message += " Try: \u{201c}\(suggestedRetryTopic)\u{201d}" }
                    simGenerationError = message
                    GenerationActivityBus.shared.logFail(id: activityId, title: topic, reason: reason ?? "no good result")
                case .rateLimited(let reason):
                    simGenerationError = reason ?? "Sim generation is rate-limited right now - try again shortly."
                    GenerationActivityBus.shared.logFail(id: activityId, title: topic, reason: reason ?? "rate limited")
                case .unavailable(let reason):
                    simGenerationError = reason ?? "Sim generation isn't available right now."
                    GenerationActivityBus.shared.logFail(id: activityId, title: topic, reason: reason ?? "unavailable")
                }
            }
        }
    }

    private func checkpointInspector(_ box: DesignBox) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            inspectorLabel("QUESTION")
            TextEditor(text: bindingForBox(box.id, get: \.checkpointQuestion, set: { $0.checkpointQuestion = $1 }))
                .font(.system(size: 12.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .scrollContentBackground(.hidden)
                .frame(height: 76)
                .padding(6)
                .background(fieldBackground)
                .accessibilityIdentifier("designStudioCheckpointQuestion")

            inspectorLabel("WHAT A GOOD ANSWER LOOKS LIKE")
            TextField("e.g. a number in cm, one sentence\u{2026}", text: bindingForBox(box.id, get: \.checkpointAnswer, set: { $0.checkpointAnswer = $1 }))
                .font(.system(size: 12.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .padding(9)
                .background(fieldBackground)
                .accessibilityIdentifier("designStudioCheckpointAnswer")
        }
    }

    private func branchInspector(_ box: DesignBox) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            inspectorLabel("PATHS FROM HERE")
            Text("Each connection leaving this box is one choice the reader can take. Name the choices below, in Connections.")
                .font(.system(size: 11.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e").opacity(0.55))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func connectionsSection(_ box: DesignBox) -> some View {
        let outgoing = graph.edgesFrom(box.id)
        let incoming = graph.edgesInto(box.id)
        return VStack(alignment: .leading, spacing: 8) {
            inspectorLabel("CONNECTIONS")
            if outgoing.isEmpty && incoming.isEmpty {
                Text("Nothing connected yet.")
                    .font(.system(size: 11.5, weight: .medium, design: .rounded))
                    .foregroundColor(Color(dsHex: "8a8478"))
            }
            ForEach(outgoing) { edge in
                edgeRow(edge, direction: "arrow.right", peer: graph.box(edge.to)?.title ?? "?", editableLabel: box.type == .branch)
            }
            ForEach(incoming) { edge in
                edgeRow(edge, direction: "arrow.left", peer: graph.box(edge.from)?.title ?? "?", editableLabel: false)
            }
        }
    }

    private func edgeRow(_ edge: DesignEdge, direction: String, peer: String, editableLabel: Bool) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Image(systemName: direction)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Color(dsHex: "5b7596"))
                Text(peer.isEmpty ? "Untitled" : peer)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(dsHex: "143a2e"))
                    .lineLimit(1)
                Spacer(minLength: 0)
                Button {
                    graph.removeEdge(edge.id)
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(Color(dsHex: "b3261e").opacity(0.7))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("designStudioRemoveEdge_\(edge.id)")
            }
            if editableLabel {
                TextField("Name this choice", text: Binding(
                    get: { edge.label ?? "" },
                    set: { graph.setEdgeLabel(edge.id, label: $0) }
                ))
                .font(.system(size: 11.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e"))
                .padding(7)
                .background(fieldBackground)
                .accessibilityIdentifier("designStudioEdgeLabel_\(edge.id)")
            }
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(dsHex: "f3f1ec")))
    }

    private func inspectorLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 9.5, weight: .heavy, design: .rounded))
            .tracking(0.7)
            .foregroundColor(Color(dsHex: "143a2e").opacity(0.45))
    }

    private var fieldBackground: some View {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Color.white)
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Color(dsHex: "e4dcc8"), lineWidth: 1))
    }

    /// Two-way binding into a stored box's field - every keystroke routes
    /// through `updateBox` so the draft autosaves as it's typed (the whole
    /// point of the store; the graph is small enough that re-encoding on
    /// each edit is nothing).
    private func bindingForBox(_ id: String, get: @escaping (DesignBox) -> String, set: @escaping (inout DesignBox, String) -> Void) -> Binding<String> {
        Binding(
            get: { graph.box(id).map(get) ?? "" },
            set: { next in graph.updateBox(id) { set(&$0, next) } }
        )
    }

    // MARK: - Timeline strip (reading order)

    /// Live preview of the exact order `assembleBook` will walk - the strip
    /// and the published book share `walkOrder`, so what the student sees
    /// here is what publish produces, by construction.
    private var timelineStrip: some View {
        let order = graph.walkOrder
        return HStack(spacing: 10) {
            Text("READING ORDER")
                .font(.system(size: 9, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(Color(dsHex: "143a2e").opacity(0.4))
                .fixedSize()
            if order.isEmpty {
                Text("Connect boxes and their reading order shows up here.")
                    .font(.system(size: 11.5, weight: .medium, design: .rounded))
                    .foregroundColor(Color(dsHex: "8a8478"))
            } else {
                // The chips are hidden from the accessibility tree ON
                // PURPOSE: their labels duplicate every box card's own
                // title ("New Chapter" would resolve to two elements -
                // confirmed as a real multiple-match failure in
                // testDesignCanvasAddsBoxesAndConnectsThem), and a strip
                // of "1 New Chapter chevron 2 ..." fragments is worse
                // VoiceOver than one summary. The invisible
                // `designStudioTimelineOrder` marker below IS this strip's
                // accessible representation.
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Array(order.enumerated()), id: \.element.id) { index, box in
                            HStack(spacing: 5) {
                                Text("\(index + 1)")
                                    .font(.system(size: 9.5, weight: .heavy, design: .rounded))
                                    .foregroundColor(.white)
                                    .frame(width: 15, height: 15)
                                    .background(Circle().fill(boxAccent(box.type)))
                                Text(box.title.isEmpty ? "Untitled" : box.title)
                                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                                    .foregroundColor(Color(dsHex: "143a2e"))
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Color.white))
                            .overlay(Capsule().strokeBorder(Color(dsHex: "e4dcc8"), lineWidth: 1))
                            if index < order.count - 1 {
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(Color(dsHex: "8a8478"))
                            }
                        }
                    }
                }
                .accessibilityHidden(true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(dsHex: "fbf8f3"))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(dsHex: "e4dcc8"), lineWidth: 1))
        )
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            // Marker carries the full order as its LABEL so a UI test can
            // assert the real walk ("Intro > Quiz") without scraping the
            // horizontally-scrolling chips - same invisible-marker pattern
            // as deskGridArchiveSummary.
            Text(order.map { $0.title.isEmpty ? "Untitled" : $0.title }.joined(separator: " > "))
                .font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("designStudioTimelineOrder")
                .allowsHitTesting(false)
        }
    }

    // MARK: - Dock + add

    /// Same labeled tool-pill row shape the old canvas landed on (real
    /// buttons, not a hidden "+" menu) - only the vocabulary changed:
    /// content types instead of find/ask/make/output.
    private var dock: some View {
        HStack(spacing: 10) {
            ForEach(DesignBoxType.allCases) { type in
                Button {
                    addBox(type)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: type.glyph)
                        Text(type.label)
                    }
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(boxAccent(type))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .background(Capsule().fill(Color.white))
                    .overlay(Capsule().strokeBorder(boxAccent(type).opacity(0.3), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("designStudioAdd_\(type.rawValue)")
            }
            Spacer(minLength: 0)
            Text("\(graph.boxes.count) boxes \u{00b7} \(graph.edges.count) connections")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e").opacity(0.5))
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color(dsHex: "fbf8f3"))
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color(dsHex: "e4dcc8"), lineWidth: 1))
        )
        // NOT a direct .accessibilityIdentifier() on this container - the
        // documented clobbering bug class (it would stomp every pill's own
        // identifier). See DeskGridDashboardView's workDock comment.
    }

    /// Deterministic cascade instead of the old random scatter - new boxes
    /// land in a tidy 3-column grid until the student moves them, so an
    /// untouched canvas already looks composed.
    private func addBox(_ type: DesignBoxType) {
        let count = graph.boxes.count
        let column = count % 3
        let row = (count / 3) % 4
        let wrap = CGFloat(count / 12) * 16
        let position = CGPoint(
            x: clamp(24 + CGFloat(column) * 244 + wrap, 0, StudioBoard.canvas.width - DesignBox.size.width),
            y: clamp(24 + CGFloat(row) * 128 + wrap, 0, StudioBoard.canvas.height - DesignBox.size.height)
        )
        let box = graph.addBox(type, at: position)
        withAnimation(.easeInOut(duration: 0.15)) { selectedId = box.id }
    }

    // MARK: - Chapter draft mapping

    /// The scoped Jesse flow hands back a whole `BookAgentDraft` (the agent
    /// thinks in books). Chapter 1 lands in the box that opened the flow;
    /// any further chapters materialize as NEW chapter boxes chained after
    /// it with plain comes-next edges - the conversation's extra output
    /// becomes visible structure instead of being silently truncated.
    private func applyChapterDraft(_ draft: BookAgentDraft, to boxId: String) {
        guard let first = draft.chapters.first else { return }
        graph.updateBox(boxId) { $0.applyChapter(first) }

        var previousId = boxId
        for (offset, extra) in draft.chapters.dropFirst().enumerated() {
            guard let anchor = graph.box(previousId) else { break }
            let position = CGPoint(
                x: clamp(anchor.position.x + 36, 0, StudioBoard.canvas.width - DesignBox.size.width),
                y: clamp(anchor.position.y + 128 + CGFloat(offset) * 8, 0, StudioBoard.canvas.height - DesignBox.size.height)
            )
            let newBox = graph.addBox(.chapter, at: position)
            graph.updateBox(newBox.id) { $0.applyChapter(extra) }
            _ = graph.addEdge(from: previousId, to: newBox.id)
            previousId = newBox.id
        }
        if graph.title.isEmpty, !draft.title.isEmpty {
            graph.setTitle(draft.title)
        }
        chapterFlowBox = nil
    }

    // MARK: - Shared

    private func pin<Content: View>(_ box: CGRect, scale: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(width: box.width * scale, height: box.height * scale)
            .position(
                x: (box.minX + box.width / 2) * scale,
                y: (box.minY + box.height / 2) * scale
            )
    }

    private func clamp(_ v: CGFloat, _ lo: CGFloat, _ hi: CGFloat) -> CGFloat {
        min(max(v, lo), hi)
    }
}

private extension CGFloat {
    /// Keeps chrome strokes (arrowheads) from vanishing at small scales
    /// without ballooning at large ones.
    var clampedForChrome: CGFloat { Swift.min(Swift.max(self, 0.75), 1.25) }
}

/// Read-through of the assembled book, walking the REAL graph structure -
/// the same edges `ContentGraphStore.assembleBook()` walks to publish, so
/// what this shows IS what `Publish` writes (with one deliberate
/// difference: unwritten boxes appear here as clearly-labeled gaps, while
/// publish drops them - a draft preview should show what's missing).
///
/// Real branching (2026-08-24, explicit ask: "preview shows connections
/// too and branching properly... not just in a listic view cause boxes
/// are connected sometimes") - `assembleSections()`'s own doc comment
/// already named this gap honestly ("a real choose-your-path reader is a
/// scoped-out gap this flatten does not pretend to solve"). This view no
/// longer consumes that pre-flattened array: it walks `graph` itself
/// (`section(for:)` renders one box at a time, factored out of
/// `assembleSections()` for exactly this reuse) and renders a `.branch`
/// box's multiple outgoing paths as real side-by-side tracks instead of
/// a bullet list of "if you choose X" text - a student can see the
/// structure, not just read about it.
///
/// This is deliberately NOT `StudySessionView`: that reader labels its
/// lessons "AI-generated" (correct for Jesse-generated lessons, a false
/// attribution for a book the student authored on this canvas), and it's
/// the flat-list reader anyway - same gap this view now closes for
/// Design Studio's own preview.
private struct BookPreviewView: View {
    let title: String
    @ObservedObject var graph: ContentGraphStore
    var onClose: () -> Void

    var body: some View {
        ZStack {
            Color(dsHex: "fff8e9").ignoresSafeArea()
            DottedDesignGrid()
            ScrollView([.vertical, .horizontal]) {
                VStack(alignment: .leading, spacing: 20) {
                    Text("PREVIEW · WHAT PUBLISH PRODUCES")
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                        .tracking(1)
                        .foregroundColor(Color(dsHex: "143a2e").opacity(0.45))
                    Text(title)
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(Color(dsHex: "143a2e"))

                    // Same pure-cycle fallback assembleSections() itself
                    // uses (every box has an incoming edge, so there's no
                    // real start) - a defined order beats a blank preview.
                    let roots = graph.startBoxes.isEmpty
                        ? Array(graph.boxes.sorted { ($0.position.y, $0.position.x) < ($1.position.y, $1.position.x) }.prefix(1))
                        : graph.startBoxes
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(roots) { start in
                            branchTrack(from: start, visited: [])
                        }
                    }
                }
                // Widened (2026-08-24, explicit ask: "make this longer to
                // occupy the whole screen please like more breadth") - was
                // capped at 720pt centered; a branching layout also
                // genuinely needs the horizontal room for side-by-side
                // tracks, not just more breathing room for a single column.
                .padding(.vertical, 40)
                .padding(.horizontal, 48)
                .frame(minWidth: 900)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 12.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(dsHex: "0c1207"))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .background(Capsule().fill(Color(dsHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .padding(.top, 14)
            .padding(.trailing, 18)
            .accessibilityIdentifier("designStudioPreviewDone")
        }
        .statusBarHidden(true)
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "book-preview").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("designStudioPreviewRoot")
                .allowsHitTesting(false)
        }
    }

    /// Renders one box, then its continuation(s). A plain (non-branch) box
    /// with a single successor reads as a straight vertical run, same
    /// feel as the old flat list; a `.branch` box's multiple successors
    /// render as real side-by-side columns (an HStack of independent
    /// vertical tracks), each headed by its real choice label, so the
    /// fork is something the student SEES, not just reads a bullet about.
    /// `visited` prevents runaway recursion on a cycle (same guard
    /// `assembleSections()`'s own walk uses, threaded through explicitly
    /// here since this is a real recursive function - Swift can't infer
    /// an opaque `some View` return type for a function that calls
    /// itself, so this returns `AnyView`, the standard escape hatch for
    /// recursive SwiftUI tree views).
    private func branchTrack(from box: DesignBox, visited: Set<String>) -> AnyView {
        guard !visited.contains(box.id) else { return AnyView(EmptyView()) }
        var seen = visited
        seen.insert(box.id)
        let section = graph.section(for: box)
        let outgoing = graph.edgesFrom(box.id)

        let card = sectionCard(section)

        if box.type == .branch, outgoing.count > 1 {
            // Real fork: each choice gets its own labeled column with its
            // own continuation walked independently underneath.
            return AnyView(
                VStack(alignment: .leading, spacing: 14) {
                    card
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 20) {
                            ForEach(Array(outgoing.enumerated()), id: \.element.id) { index, edge in
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "arrow.turn.down.right")
                                            .font(.system(size: 10, weight: .bold))
                                        Text(edge.label?.isEmpty == false ? edge.label! : "Choice \(index + 1)")
                                            .font(.system(size: 11.5, weight: .heavy, design: .rounded))
                                            .tracking(0.3)
                                    }
                                    .foregroundColor(Color(dsHex: "b3261e"))
                                    if let next = graph.box(edge.to) {
                                        branchTrack(from: next, visited: seen)
                                    } else {
                                        Text("Not connected to anything yet.")
                                            .font(.system(size: 12, weight: .medium, design: .rounded))
                                            .foregroundColor(Color(dsHex: "8a8478"))
                                    }
                                }
                                .frame(width: 340, alignment: .leading)
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .strokeBorder(Color(dsHex: "b3261e").opacity(0.25), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                                )
                            }
                        }
                    }
                }
            )
        }

        // Straight run: this box, then whatever comes next stacked below.
        return AnyView(
            VStack(alignment: .leading, spacing: 14) {
                card
                ForEach(outgoing) { edge in
                    if let next = graph.box(edge.to) {
                        branchTrack(from: next, visited: seen)
                    }
                }
            }
        )
    }

    private func sectionCard(_ section: ContentGraphStore.BookSection) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: section.type.glyph)
                    .font(.system(size: 11, weight: .bold))
                Text(section.title)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
            }
            .foregroundColor(Color(dsHex: "143a2e"))
            Text(markdownish(section.body))
                .font(.system(size: 13.5, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e").opacity(section.isPlaceholder ? 0.45 : 0.85))
                .italic(section.isPlaceholder)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: 640, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.07), radius: 8, y: 3)
        )
    }

    /// Renders the sections' light markdown (bold/italic) inline; keeps
    /// newlines and literal "- " bullets as-is. Falls back to plain text
    /// if parsing ever fails - never drops content.
    private func markdownish(_ body: String) -> AttributedString {
        (try? AttributedString(
            markdown: body,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(body)
    }
}

/// Coordinates on the same 1440x810 artboard every studio surface uses.
/// One right-panel slot swaps between the Jesse rail (nothing selected) and
/// the inspector (box selected) - a full-width inspector beats the old
/// squeeze of rail + 204pt inspector side by side, and Jesse's call keeps
/// running either way (`JesseCallSession` is app-lifetime, the rail is only
/// its UI).
private enum StudioBoard {
    static let header = CGRect(x: 40, y: 24, width: 1360, height: 60)
    // Widened to span the full board (2026-08-24, explicit ask: "we dont
    // need a jesse here instead make this longer to occupy the whole
    // screen please like more breadth") - was 940pt wide with a permanent
    // 396pt Jesse-rail panel reserved to its right whenever nothing was
    // selected. The inspector now floats as an overlay on top of this
    // wide canvas only while a box is actually selected (see
    // `inspectorOverlayRect`), instead of a permanently-reserved column.
    static let canvas = CGRect(x: 40, y: 100, width: 1360, height: 556)
    /// Where the inspector floats when a box is selected - same visual
    /// position the old rightPanel occupied, just an overlay now instead
    /// of a permanent reservation.
    static let inspectorOverlay = CGRect(x: 1004, y: 100, width: 396, height: 556)
    static let timeline = CGRect(x: 40, y: 672, width: 1360, height: 46)
    static let dock = CGRect(x: 40, y: 734, width: 1360, height: 52)
    static let connectBanner = CGRect(x: 420, y: 112, width: 480, height: 40)
}

/// Same dotted-grid treatment as `DeskGridDashboardView.DottedDeskGrid` /
/// `LearnStudioView.DottedLearnGrid` - duplicated per-file by convention in
/// this codebase rather than shared, same step/size/color.
private struct DottedDesignGrid: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 16
            for x in stride(from: 8, through: size.width, by: step) {
                for y in stride(from: 8, through: size.height, by: step) {
                    let dot = Path(ellipseIn: CGRect(x: x, y: y, width: 1.4, height: 1.4))
                    context.fill(dot, with: .color(Color(dsHex: "d7d0c2")))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private extension Color {
    init(dsHex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// Identifiable wrapper so a plain (title, html) pair can drive a
/// `.fullScreenCover(item:)` - `DesignBox` itself isn't right here since
/// the founder's own "back button" ask is about the SIM, not the box.
struct DesignSimPreview: Identifiable {
    let id = UUID()
    let title: String
    let html: String
}

/// Real ask (2026-08-23): "use the entire simulations box to show them the
/// sim and put a back button somewhere on top." Full-screen, not another
/// small inline box - a real p5.js sim is usually 800x650+, the exact
/// thing the small inspector preview couldn't show without pinch/scroll.
private struct FullScreenSimPlayer: View {
    let title: String
    let html: String
    var onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button(action: onBack) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("Back")
                    }
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("fullScreenSimBack")
                Spacer(minLength: 0)
                Text(title)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .lineLimit(1)
                Spacer(minLength: 0)
                // Balances the Back button so the title stays visually
                // centered - no action, just layout symmetry.
                Image(systemName: "chevron.left").opacity(0)
            }
            .padding(14)
            InlineSimWebView(html: html)
        }
        .background(Color.white)
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "fullscreen-sim").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("fullScreenSimPlayer")
                .allowsHitTesting(false)
        }
    }
}

/// Real ask (2026-08-23): "you should also be able to browse the sim
/// library too... click that, open the sims archive and click sth to load
/// that there in that box." Same real library Archive's own Simulations
/// tab reads (`ArchiveSimsLoader.loadAll()` - chapter-book sims + the
/// generated_sims library + Dan McCreary's full catalog), not a new/
/// parallel list.
private struct DesignStudioSimLibrarySheet: View {
    var onPick: (_ title: String, _ html: String) -> Void
    var onClose: () -> Void

    @State private var sims: [ArchiveSimEntry] = []
    @State private var isLoading = true
    @State private var loadingId: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading the simulation library\u{2026}")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if sims.isEmpty {
                    Text("No simulations synced yet.")
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(sims) { sim in
                        Button {
                            Task { await pick(sim) }
                        } label: {
                            HStack(spacing: 10) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(sim.section.simTitle ?? sim.section.title)
                                        .font(.system(size: 14, weight: .bold, design: .rounded))
                                        .foregroundColor(.primary)
                                    Text(sim.bookTitle)
                                        .font(.system(size: 11, weight: .medium, design: .rounded))
                                        .foregroundColor(.secondary)
                                }
                                Spacer(minLength: 0)
                                if loadingId == sim.id {
                                    ProgressView()
                                } else {
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .disabled(loadingId != nil)
                        .accessibilityIdentifier("designStudioSimLibraryRow_\(sim.id)")
                    }
                }
            }
            .navigationTitle("Sim Library")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel", action: onClose)
                }
            }
        }
        .task {
            sims = await ArchiveSimsLoader.loadAll()
            isLoading = false
        }
        .accessibilityIdentifier("designStudioSimLibrarySheet")
    }

    private func pick(_ sim: ArchiveSimEntry) async {
        loadingId = sim.id
        defer { loadingId = nil }
        let title = sim.section.simTitle ?? sim.section.title
        if let html = sim.section.simHtml {
            onPick(title, html)
        } else if let microSimId = sim.microSimId, let html = await MicroSimCatalogClient.fetchHTML(id: microSimId) {
            onPick(title, html)
        }
    }
}
