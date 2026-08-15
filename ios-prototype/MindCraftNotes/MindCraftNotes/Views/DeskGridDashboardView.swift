import SwiftUI

/// Work canvas from Presentation Screen.pdf pages 4–5.
/// Tiles sit on a measured 1440×810 artboard (scaled to the iPad).
/// Page 4 = five photo cards + one dock. Page 5 = tiles shrink left, right rail opens.
/// Dock fill is Binder · Calendar · Memo · Gmail · Flows · search — not Ask AI.
struct DeskGridDashboardView: View {
    enum Rail: String {
        case none
        case memo
        case flows
    }

    var initialRail: Rail = .none
    var onOpenBinder: () -> Void = {}
    var onClose: () -> Void = {}
    var onOpenCalendar: () -> Void = {}
    var onOpenGmail: () -> Void = {}
    var onOpenCreate: (CreateCanvasKind) -> Void = { _ in }
    var onOpenFlow: (String) -> Void = { _ in }

    @State private var rail: Rail
    @State private var memoDraft = ""
    @State private var searchQuery = ""
    @State private var binderPulled = false

    private let artboard = CGSize(width: 1440, height: 810)

    init(
        initialRail: Rail = .none,
        onOpenBinder: @escaping () -> Void = {},
        onClose: @escaping () -> Void = {},
        onOpenCalendar: @escaping () -> Void = {},
        onOpenGmail: @escaping () -> Void = {},
        onOpenCreate: @escaping (CreateCanvasKind) -> Void = { _ in },
        onOpenFlow: @escaping (String) -> Void = { _ in }
    ) {
        self.initialRail = initialRail
        self.onOpenBinder = onOpenBinder
        self.onClose = onClose
        self.onOpenCalendar = onOpenCalendar
        self.onOpenGmail = onOpenGmail
        self.onOpenCreate = onOpenCreate
        self.onOpenFlow = onOpenFlow
        _rail = State(initialValue: initialRail)
    }

    private var expanded: Bool { rail != .none }

    var body: some View {
        ZStack {
            Color(gridHex: "fff8e9").ignoresSafeArea()
            GeometryReader { geo in
                let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
                let board = CGSize(width: artboard.width * scale, height: artboard.height * scale)
                ZStack(alignment: .topLeading) {
                    DottedDeskGrid()
                    artboardTiles(scale: scale)
                    placed(WorkArtboard.dock, scale: scale) { workDock }
                    if expanded {
                        placed(rail == .memo ? WorkArtboard.memoRail : WorkArtboard.flowsRail, scale: scale) {
                            if rail == .memo { memoRail } else { flowsRail }
                        }
                    }
                }
                .frame(width: board.width, height: board.height)
                .position(x: geo.size.width / 2, y: geo.size.height / 2)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button("Done", action: onClose)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "0c1207"))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Capsule().fill(Color(gridHex: "c4f547")))
                .padding(.top, 12)
                .padding(.trailing, 16)
                .accessibilityIdentifier("deskGridDashboardDone")
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.84), value: rail)
        .accessibilityIdentifier("deskGridDashboard")
    }

    @ViewBuilder
    private func artboardTiles(scale: CGFloat) -> some View {
        photoTile(.intel, box: expanded ? WorkArtboard.p5Intel : WorkArtboard.p4Intel, scale: scale)
        photoTile(.moodle, box: expanded ? WorkArtboard.p5Moodle : WorkArtboard.p4Moodle, scale: scale)
        photoTile(.binder, box: expanded ? WorkArtboard.p5Binder : WorkArtboard.p4Binder, scale: scale)
        photoTile(.emailSummaries, box: expanded ? WorkArtboard.p5Email : WorkArtboard.p4Email, scale: scale)
        photoTile(.gcal, box: expanded ? WorkArtboard.p5Gcal : WorkArtboard.p4Gcal, scale: scale)
    }

    private func placed<Content: View>(_ box: CGRect, scale: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(width: box.width * scale, height: box.height * scale)
            .position(
                x: (box.minX + box.width / 2) * scale,
                y: (box.minY + box.height / 2) * scale
            )
    }

    // MARK: - Tiles

    private enum TileKind {
        case intel, moodle, binder, emailSummaries, gcal, memo

        var title: String {
            switch self {
            case .intel: return "Intel"
            case .moodle: return "Moodle"
            case .binder: return "Binder"
            case .emailSummaries: return "Email Summaries"
            case .gcal: return "Gcal"
            case .memo: return "Memo"
            }
        }

        var connected: Bool { self != .moodle }

        var wash: [Color] {
            switch self {
            case .intel: return [Color(gridHex: "247a4d"), Color(gridHex: "143a2e")]
            case .moodle: return [Color(gridHex: "d7e4d4"), Color(gridHex: "b7c9b4")]
            case .binder: return [Color(gridHex: "f3efe4"), Color(gridHex: "e4dcc8")]
            case .emailSummaries: return [Color(gridHex: "c8ddd0"), Color(gridHex: "8fb89a")]
            case .gcal: return [Color(gridHex: "1f3d2e"), Color(gridHex: "0c1512")]
            case .memo: return [Color(gridHex: "fff8e9"), Color(gridHex: "efe6cf")]
            }
        }

        var symbol: String {
            switch self {
            case .intel: return "sparkles"
            case .moodle: return "graduationcap.fill"
            case .binder: return "person.crop.circle.fill"
            case .emailSummaries: return "headphones"
            case .gcal: return "calendar"
            case .memo: return "note.text"
            }
        }
    }

    private func photoTile(_ kind: TileKind, box: CGRect, scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(kind.title)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e"))
            Button {
                handleTile(kind)
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(LinearGradient(colors: kind.wash, startPoint: .topLeading, endPoint: .bottomTrailing))
                    if kind == .binder {
                        Circle()
                            .fill(Color(gridHex: "143a2e").opacity(0.18))
                            .frame(width: 120, height: 120)
                            .offset(y: binderPulled ? 18 : 0)
                        Image(systemName: kind.symbol)
                            .font(.system(size: 54, weight: .medium))
                            .foregroundColor(Color(gridHex: "143a2e").opacity(0.55))
                            .offset(y: binderPulled ? 18 : 0)
                    } else {
                        Image(systemName: kind.symbol)
                            .font(.system(size: 36, weight: .medium))
                            .foregroundColor(.white.opacity(kind.connected ? 0.88 : 0.35))
                    }
                    if !kind.connected {
                        Text("Connect")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(Color(gridHex: "143a2e").opacity(0.55))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Color.white.opacity(0.7)))
                            .offset(y: 48)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: .black.opacity(0.14), radius: 12, y: 6)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(kind.connected ? Color.clear : Color(gridHex: "143a2e").opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("deskGridTile_\(kind.title)")
        }
        .frame(width: box.width * scale, height: box.height * scale, alignment: .topLeading)
        .position(
            x: (box.minX + box.width / 2) * scale,
            y: (box.minY + box.height / 2) * scale
        )
    }

    private func handleTile(_ kind: TileKind) {
        switch kind {
        case .binder:
            withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) { binderPulled = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) { onOpenBinder() }
        case .gcal:
            onOpenCalendar()
        case .emailSummaries:
            onOpenGmail()
        case .memo:
            setRail(rail == .memo ? .none : .memo)
        default:
            break
        }
    }

    // MARK: - Dock

    private var workDock: some View {
        HStack(spacing: 8) {
            dockChip("Binder", system: "books.vertical.fill") { handleTile(.binder) }
            dockChip("Calendar", system: "calendar", action: onOpenCalendar)
            dockChip("Memo", system: "note.text", identifier: "deskGridDashboardAddMemo") { setRail(rail == .memo ? .none : .memo) }
            dockChip("Gmail", system: "envelope.fill", action: onOpenGmail)
            dockChip("Flows", system: "bolt.fill", identifier: "deskGridDock_Flows") { setRail(rail == .flows ? .none : .flows) }
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.white.opacity(0.45))
                TextField("Search", text: $searchQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color.white.opacity(0.12)))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color(gridHex: "1c1c1e")))
        .accessibilityIdentifier("deskGridDashboardToolbar")
    }

    private func dockChip(_ title: String, system: String, identifier: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: system)
                Text(title)
            }
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier ?? "deskGridDock_\(title)")
    }

    // MARK: - Right rails (page 5)

    private var memoRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Memo")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e"))
            TextField("Pin a note…", text: $memoDraft, axis: .vertical)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .textFieldStyle(.plain)
                .lineLimit(3...6)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        )
        .accessibilityIdentifier("deskGridTile_Memo")
    }

    private var flowsRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Flows")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e"))
            flowRow("Presentation", system: "rectangle.on.rectangle") { onOpenCreate(.presentation) }
            flowRow("GDoc", system: "doc.text") { onOpenCreate(.gdoc) }
            flowRow("Resume", system: "person.text.rectangle") { onOpenFlow("resume") }
            flowRow("Archive", system: "books.vertical") { onOpenFlow("archive") }
            flowRow("Book", system: "book") { onOpenFlow("book") }
            flowRow("Apply", system: "briefcase") { onOpenFlow("apply") }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        )
        .accessibilityIdentifier("deskGridFlowsRail")
    }

    private func flowRow(_ title: String, system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: system)
                    .font(.system(size: 12, weight: .semibold))
                Text(title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                Spacer(minLength: 0)
            }
            .foregroundColor(Color(gridHex: "143a2e"))
            .padding(.vertical, 6)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskGridFlow_\(title)")
    }

    private func setRail(_ next: Rail) {
        withAnimation { rail = next }
    }
}

/// 1440×810 boxes measured from Presentation_Screen.pdf.
private enum WorkArtboard {
    static let p4Intel = CGRect(x: 81, y: 118, width: 376, height: 227)
    static let p4Moodle = CGRect(x: 115, y: 378, width: 315, height: 222)
    static let p4Binder = CGRect(x: 492, y: 61, width: 505, height: 568)
    static let p4Email = CGRect(x: 1033, y: 107, width: 381, height: 212)
    static let p4Gcal = CGRect(x: 1032, y: 343, width: 392, height: 286)

    static let p5Intel = CGRect(x: 76, y: 103, width: 319, height: 192)
    static let p5Moodle = CGRect(x: 106, y: 323, width: 267, height: 188)
    static let p5Binder = CGRect(x: 425, y: 54, width: 428, height: 524)
    static let p5Email = CGRect(x: 884, y: 93, width: 322, height: 180)
    static let p5Gcal = CGRect(x: 884, y: 295, width: 332, height: 325)
    static let memoRail = CGRect(x: 1231, y: 193, width: 199, height: 194)
    static let flowsRail = CGRect(x: 1231, y: 54, width: 199, height: 566)
    static let dock = CGRect(x: 96, y: 632, width: 1321, height: 96)
}

private struct DottedDeskGrid: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 16
            for x in stride(from: 8, through: size.width, by: step) {
                for y in stride(from: 8, through: size.height, by: step) {
                    let dot = Path(ellipseIn: CGRect(x: x, y: y, width: 1.4, height: 1.4))
                    context.fill(dot, with: .color(Color(gridHex: "d7d0c2")))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private extension Color {
    init(gridHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
