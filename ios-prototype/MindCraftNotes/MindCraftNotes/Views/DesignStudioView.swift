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

    private enum PublishState: Equatable {
        case idle, publishing, done(String), failed(String)
    }

    @State private var publishState: PublishState = .idle

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

                    pin(StudioBoard.rightPanel, scale: scale) {
                        if let id = selectedId, let box = graph.box(id) {
                            inspector(box)
                        } else {
                            JesseRailView(studentName: studentName, context: "designStudio")
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
        .ignoresSafeArea()
        .statusBarHidden(true)
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

            Button(action: publish) {
                Text(publishState == .publishing ? "Publishing\u{2026}" : "Publish to Binder")
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

            Button {
                simulationBox = box
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "square.on.square.squareshape.controlhandles")
                    Text(box.workspaceState.isEmpty ? "Build the blocks" : "Open block workspace")
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
                 ? "Opens a Blockly block editor - what you build saves back into this box."
                 : "Workspace saved \u{00b7} it reloads exactly where you left it.")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e").opacity(0.5))
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

/// Coordinates on the same 1440x810 artboard every studio surface uses.
/// One right-panel slot swaps between the Jesse rail (nothing selected) and
/// the inspector (box selected) - a full-width inspector beats the old
/// squeeze of rail + 204pt inspector side by side, and Jesse's call keeps
/// running either way (`JesseCallSession` is app-lifetime, the rail is only
/// its UI).
private enum StudioBoard {
    static let header = CGRect(x: 40, y: 24, width: 1360, height: 60)
    static let canvas = CGRect(x: 40, y: 100, width: 940, height: 556)
    static let rightPanel = CGRect(x: 1004, y: 100, width: 396, height: 556)
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
