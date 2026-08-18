import SwiftUI

/// Design Studio (2026-08-17) - the "+ Design" row at the bottom of Flows.
/// A boxy, spatial canvas where a student builds a small AI workflow by
/// connecting boxes, following the exact shell shape Learn Studio and Book
/// (Assignments F/G) already established that same night: `JesseRailView`
/// docked on the right (the one shared "talk to Jesse" card, never a
/// separate web call), content on the left on the same 1440x810 artboard
/// `DeskGridDashboardView`/`LearnStudioView` both use.
///
/// Scope, stated honestly rather than faked: only **Ask** boxes make a real
/// call right now (`StudentAIKeyStore.ask`, the same BYO-key path Homework
/// Help and Learn Studio use - no separate setup, it just works once a key
/// is saved). Find/Make/Output boxes are real, connectable, draggable canvas
/// objects but are not wired to a backend yet (no Binder search, no doc
/// generation, no Gmail/Calendar client here) - they say so plainly when
/// run, the same way `LearnStudioView.microsimPane` says "a placeholder, not
/// a stub pretending to work" rather than faking a result.
struct DesignStudioView: View {
    var studentName: String
    var onClose: () -> Void

    @EnvironmentObject private var jesseCall: JesseCallSession
    @ObservedObject private var aiKeys = StudentAIKeyStore.shared

    // Empty canvas, not the seeded demo flow (2026-08-18, explicit ask:
    // "the 4 boxes 3 connections thing remove it") - `DesignBox.demoFlow`/
    // `DesignEdge.demoFlow` still exist as reference data (their own doc
    // comments explain the intended shape of a real flow) but no longer
    // seed a fresh session.
    @State private var boxes: [DesignBox] = []
    @State private var edges: [DesignEdge] = []
    @State private var selectedId: String?
    @State private var dragStart: [String: CGPoint] = [:]

    // Per-box, not a single shared id - a second box's Run tap used to
    // stomp this and its own completion could then null out the FIRST
    // box's still-running indicator (or worse, a Reset Flow mid-await
    // let a stale response write into a box id that no longer exists).
    // Flagged by Greptile on the PR, real finding, fixed here.
    @State private var runningIds: Set<String> = []
    @State private var results: [String: String] = [:]
    @State private var errors: [String: String] = [:]
    @State private var promptDrafts: [String: String] = [:]

    private let artboard = CGSize(width: 1440, height: 810)

    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            ZStack {
                Color(dsHex: "fff8e9").ignoresSafeArea()
                ZStack(alignment: .topLeading) {
                    Color.clear.frame(width: artboard.width * scale, height: artboard.height * scale)
                    DottedDesignGrid().frame(width: artboard.width * scale, height: artboard.height * scale)

                    connectorLayer(scale: scale)

                    ForEach(boxes) { box in
                        boxView(box, scale: scale)
                    }

                    pin(DesignBoard.jesseRail, scale: scale) {
                        JesseRailView(studentName: studentName, context: "designStudio")
                    }
                    pin(DesignBoard.dock, scale: scale) { dock }
                    pin(DesignBoard.addButton, scale: scale) { addButton }

                    if let id = selectedId, let box = boxes.first(where: { $0.id == id }) {
                        pin(DesignBoard.inspector, scale: scale) { inspector(box) }
                    }
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(dsHex: "0c1207"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(dsHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 16)
            .accessibilityIdentifier("designStudioDone")
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "design-studio").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("designStudio")
                .allowsHitTesting(false)
        }
    }

    // MARK: - Boxes

    private func boxView(_ box: DesignBox, scale: CGFloat) -> some View {
        let pos = CGPoint(
            x: (DesignBoard.canvas.minX + box.position.x) * scale,
            y: (DesignBoard.canvas.minY + box.position.y) * scale
        )
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: box.type.glyph)
                    .font(.system(size: 12, weight: .bold))
                Text(box.type.label)
                    .font(.system(size: 9.5, weight: .heavy, design: .rounded))
                    .tracking(0.6)
                Spacer(minLength: 0)
                statusDot(for: box.id)
            }
            .foregroundColor(.white.opacity(0.75))

            Text(box.title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .lineLimit(1)
            Text(box.subtitle)
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.8))
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(width: DesignBox.size.width * scale, height: DesignBox.size.height * scale, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(box.type.accent)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.white.opacity(selectedId == box.id ? 0.9 : 0), lineWidth: 2)
        )
        .shadow(color: .black.opacity(0.16), radius: 8, y: 4)
        .position(pos)
        .gesture(
            DragGesture(minimumDistance: 2)
                .onChanged { value in
                    let start = dragStart[box.id] ?? box.position
                    if dragStart[box.id] == nil { dragStart[box.id] = box.position }
                    let next = CGPoint(
                        x: clamp(start.x + value.translation.width / scale, 0, DesignBoard.canvas.width - DesignBox.size.width),
                        y: clamp(start.y + value.translation.height / scale, 0, DesignBoard.canvas.height - DesignBox.size.height)
                    )
                    setPosition(box.id, next)
                }
                .onEnded { _ in dragStart[box.id] = nil }
        )
        .onTapGesture {
            withAnimation(.easeInOut(duration: 0.15)) { selectedId = box.id }
        }
        .accessibilityIdentifier("designStudioBox_\(box.id)")
    }

    private func statusDot(for id: String) -> some View {
        let color: Color
        if runningIds.contains(id) { color = Color(dsHex: "f5c542") }
        else if errors[id] != nil { color = Color(dsHex: "e05a4e") }
        else if results[id] != nil { color = Color(dsHex: "c4f547") }
        else { color = .white.opacity(0.35) }
        return Circle().fill(color).frame(width: 7, height: 7)
    }

    private func setPosition(_ id: String, _ point: CGPoint) {
        guard let i = boxes.firstIndex(where: { $0.id == id }) else { return }
        boxes[i].position = point
    }

    // MARK: - Connectors

    private func connectorLayer(scale: CGFloat) -> some View {
        Canvas { context, _ in
            for edge in edges {
                guard let from = boxes.first(where: { $0.id == edge.from }),
                      let to = boxes.first(where: { $0.id == edge.to }) else { continue }
                let p1 = CGPoint(
                    x: (DesignBoard.canvas.minX + from.position.x + DesignBox.size.width) * scale,
                    y: (DesignBoard.canvas.minY + from.position.y + DesignBox.size.height / 2) * scale
                )
                let p2 = CGPoint(
                    x: (DesignBoard.canvas.minX + to.position.x) * scale,
                    y: (DesignBoard.canvas.minY + to.position.y + DesignBox.size.height / 2) * scale
                )
                let c = max(30, abs(p2.x - p1.x) * 0.5)
                var path = Path()
                path.move(to: p1)
                path.addCurve(
                    to: p2,
                    control1: CGPoint(x: p1.x + c, y: p1.y),
                    control2: CGPoint(x: p2.x - c, y: p2.y)
                )
                context.stroke(path, with: .color(Color(dsHex: "143a2e").opacity(0.28)), lineWidth: 2)
            }
        }
        .allowsHitTesting(false)
        .frame(width: artboard.width * scale, height: artboard.height * scale)
    }

    // MARK: - Inspector

    private func inspector(_ box: DesignBox) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: box.type.glyph)
                Text(box.title).font(.system(size: 14, weight: .bold, design: .rounded))
                Spacer(minLength: 0)
                Button {
                    withAnimation { selectedId = nil }
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(Color(dsHex: "143a2e").opacity(0.4))
                }
                .buttonStyle(.plain)
            }
            .foregroundColor(Color(dsHex: "143a2e"))

            if box.type == .ask {
                Text("PROMPT").font(.system(size: 9.5, weight: .heavy, design: .rounded)).tracking(0.6)
                    .foregroundColor(Color(dsHex: "143a2e").opacity(0.45))
                TextEditor(text: Binding(
                    get: { promptDrafts[box.id] ?? box.subtitle },
                    set: { promptDrafts[box.id] = $0 }
                ))
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .scrollContentBackground(.hidden)
                .frame(height: 70)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.white))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Color(dsHex: "e4dcc8"), lineWidth: 1))

                if !aiKeys.hasKey {
                    Text("Connect your AI key in Settings so this box can actually run.")
                        .font(.system(size: 11.5, weight: .medium, design: .rounded))
                        .foregroundColor(Color(dsHex: "143a2e").opacity(0.55))
                }

                Button {
                    Task { await runAsk(box) }
                } label: {
                    if runningIds.contains(box.id) {
                        HStack(spacing: 6) { ProgressView().tint(.white); Text("Running\u{2026}") }
                    } else {
                        Text("Run")
                    }
                }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color.black))
                .buttonStyle(.plain)
                .disabled(!aiKeys.hasKey || runningIds.contains(box.id))
                .opacity(!aiKeys.hasKey ? 0.5 : 1)
                .accessibilityIdentifier("designStudioRun_\(box.id)")

                if let error = errors[box.id] {
                    Text(error).font(.system(size: 11.5, weight: .semibold, design: .rounded)).foregroundColor(Color(dsHex: "b3261e"))
                }
                if let result = results[box.id] {
                    ScrollView {
                        Text(result)
                            .font(.system(size: 12.5, weight: .medium, design: .rounded))
                            .foregroundColor(Color(dsHex: "143a2e"))
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxHeight: 140)
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(dsHex: "eef1ec")))
                }
            } else {
                Text("\(box.type.label) boxes aren\u{2019}t wired to anything real yet \u{2014} they hold their place in the flow so you can plan around them.")
                    .font(.system(size: 12.5, weight: .medium, design: .rounded))
                    .foregroundColor(Color(dsHex: "143a2e").opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button(role: .destructive) {
                removeBox(box.id)
            } label: {
                Text("Remove box")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(dsHex: "b3261e"))
            }
            .buttonStyle(.plain)

            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.1), radius: 14, y: 6)
        )
        .accessibilityIdentifier("designStudioInspector")
    }

    private func runAsk(_ box: DesignBox) async {
        guard !runningIds.contains(box.id) else { return }
        runningIds.insert(box.id)
        errors[box.id] = nil
        let prompt = promptDrafts[box.id] ?? box.subtitle
        let system = "You are Jesse, doing one focused task inside a student's own custom flow called \"\(box.title)\". Do exactly what's asked, concisely, no preamble."
        let response = await aiKeys.ask(systemPrompt: system, userPrompt: prompt)
        // The box (or the whole flow) may have been removed/reset while
        // this was in flight - don't resurrect a result for an id that's
        // no longer part of the flow.
        guard boxes.contains(where: { $0.id == box.id }) else {
            runningIds.remove(box.id)
            return
        }
        switch response {
        case .success(let text):
            results[box.id] = text
        case .failure(.noKey):
            errors[box.id] = "No AI key connected."
        case .failure(.rejected):
            errors[box.id] = "That AI key was rejected. Open Settings to update it."
        case .failure(.unavailable):
            errors[box.id] = "Couldn\u{2019}t reach the model \u{2014} try again in a bit."
        }
        runningIds.remove(box.id)
    }

    private func removeBox(_ id: String) {
        boxes.removeAll { $0.id == id }
        edges.removeAll { $0.from == id || $0.to == id }
        results[id] = nil
        errors[id] = nil
        if selectedId == id { selectedId = nil }
    }

    // MARK: - Dock + add

    // "Reset flow" removed (explicit ask - unnecessary chrome; "Remove box"
    // in the inspector already covers undoing a mistake per-box).
    private var dock: some View {
        HStack(spacing: 14) {
            Spacer(minLength: 0)

            Text("\(boxes.count) boxes \u{00b7} \(edges.count) connections")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundColor(Color(dsHex: "143a2e").opacity(0.6))

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color(dsHex: "fbf8f3")))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color(dsHex: "e4dcc8"), lineWidth: 1))
        .accessibilityIdentifier("designStudioDock")
    }

    private var addButton: some View {
        Menu {
            ForEach(DesignBoxType.allCases) { type in
                Button {
                    addBox(type)
                } label: {
                    Label(type.label, systemImage: type.glyph)
                }
            }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(Color(dsHex: "143a2e"))
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.white))
                .overlay(Circle().strokeBorder(Color(dsHex: "e4dcc8"), lineWidth: 1))
                .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
        }
        .accessibilityIdentifier("designStudioAdd")
    }

    private func addBox(_ type: DesignBoxType) {
        let id = "box_\(UUID().uuidString.prefix(6))"
        let box = DesignBox(
            id: id,
            type: type,
            title: "New \(type.label)",
            subtitle: type == .ask ? "Tell Jesse what this box should do." : "Not wired to a real backend yet.",
            position: CGPoint(x: CGFloat.random(in: 40...600), y: CGFloat.random(in: 40...460))
        )
        boxes.append(box)
        selectedId = id
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

// MARK: - Model

enum DesignBoxType: String, CaseIterable, Identifiable {
    case find, ask, make, output
    var id: String { rawValue }

    var label: String {
        switch self {
        case .find: return "Find"
        case .ask: return "Ask"
        case .make: return "Make"
        case .output: return "Output"
        }
    }

    var glyph: String {
        switch self {
        case .find: return "magnifyingglass"
        case .ask: return "sparkles"
        case .make: return "hammer.fill"
        case .output: return "flag.fill"
        }
    }

    var accent: Color {
        switch self {
        case .find: return Color(dsHex: "5b7596")
        case .ask: return Color(dsHex: "247a4d")
        case .make: return Color(dsHex: "a3651f")
        case .output: return Color(dsHex: "143a2e")
        }
    }
}

struct DesignBox: Identifiable {
    let id: String
    let type: DesignBoxType
    let title: String
    let subtitle: String
    var position: CGPoint

    static let size = CGSize(width: 190, height: 92)

    // Centered, symmetric flow-chart layout - was clustered at the canvas's
    // top edge with the bottom two-thirds empty (and the add button sitting
    // right on top of "notes"). Find -> Ask on one line, then Ask branches
    // evenly up/down into Make and Output so the connectors read as one
    // clean shape, not scattered boxes.
    static let demoFlow: [DesignBox] = [
        DesignBox(id: "notes", type: .find, title: "My ACT Notes", subtitle: "Binder \u{00b7} not wired yet", position: CGPoint(x: 20, y: 282)),
        DesignBox(id: "understand", type: .ask, title: "Understand my notes", subtitle: "Read what I wrote and tell me the 3 ideas I keep missing.", position: CGPoint(x: 280, y: 282)),
        DesignBox(id: "flashcards", type: .make, title: "Make flashcards", subtitle: "10 cards on my weak spots", position: CGPoint(x: 540, y: 190)),
        DesignBox(id: "results", type: .output, title: "Show me what I missed", subtitle: "One page, after the quiz", position: CGPoint(x: 540, y: 374)),
    ]
}

struct DesignEdge: Identifiable {
    let id = UUID()
    let from: String
    let to: String

    static let demoFlow: [DesignEdge] = [
        DesignEdge(from: "notes", to: "understand"),
        DesignEdge(from: "understand", to: "flashcards"),
        DesignEdge(from: "understand", to: "results"),
    ]
}

/// Coordinates on the same 1440x810 canvas `DeskGridDashboardView`/
/// `LearnStudioView` both use - Jesse rail proportions match
/// `IntakeBoard.jesseRail`, dock matches `LearnBoard.dock` exactly (same
/// artboard, same dock should look identical across every Flow).
private enum DesignBoard {
    // Jesse rail narrowed (2026-08-18, explicit ask: "shrink call Jesse to
    // the left so there's more space to add boxes") - 340 -> 260, its own
    // right edge held fixed (still a 28pt gap before `inspector`, matching
    // this artboard's usual margin), and the canvas grows to fill exactly
    // the width that freed up (760 -> 840) instead of leaving it empty.
    static let canvas = CGRect(x: 40, y: 40, width: 840, height: 656)
    static let jesseRail = CGRect(x: 908, y: 40, width: 260, height: 656)
    static let inspector = CGRect(x: 1196, y: 40, width: 204, height: 656)
    // Bottom-right corner of canvas, clear of every demoFlow box (all four
    // sit in x:20-730/y:0-232) - was pinned at (40,40), directly on top of
    // the first box's own top-left corner. Real overlap, not a style nit.
    static let addButton = CGRect(x: canvas.maxX - 60, y: canvas.maxY - 60, width: 44, height: 44)
    static let dock = CGRect(x: 96, y: 706, width: 1321, height: 96)
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
