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
    var initialMemoText: String = ""
    var onOpenBinder: () -> Void = {}
    var onClose: () -> Void = {}
    var onOpenCalendar: () -> Void = {}
    var onOpenGmail: () -> Void = {}
    var onOpenIntel: () -> Void = {}
    var onOpenCreate: (CreateCanvasKind) -> Void = { _ in }
    var onOpenFlow: (String) -> Void = { _ in }
    var onSaveMemo: (String) -> Void = { _ in }
    var onTranscribe: () -> Void = {}
    var intelHasData: Bool = false
    var binderHasData: Bool = false
    var onGmailLinked: (_ calendarToo: Bool) -> Void = { _ in }
    var onMoodleLinked: () -> Void = {}
    var onMoodleDisconnected: () -> Void = {}
    var intelLines: [String] = []
    var binderTitles: [String] = []
    var onSyncCalendar: () -> Void = {}

    @ObservedObject private var gmail = GmailClient.shared
    @ObservedObject private var moodle = MoodleClient.shared
    @ObservedObject private var digest = GmailDigestClient.shared
    @ObservedObject private var digestStore = GmailDigestStore.shared
    @ObservedObject private var boxBus = DeskBoxBus.shared
    @State private var showMoodleSheet = false

    @State private var rail: Rail
    @State private var memoDraft: String
    @State private var memoSaved = true
    @State private var searchQuery = ""
    @State private var flowsSearchQuery = ""
    @State private var binderPulled = false
    @State private var spacePan: CGSize = .zero
    @State private var spaceZoom: CGFloat = 1
    @GestureState private var livePan: CGSize = .zero
    @GestureState private var liveZoom: CGFloat = 1

    private let artboard = CGSize(width: 1440, height: 810)

    init(
        initialRail: Rail = .none,
        initialMemoText: String = "",
        onOpenBinder: @escaping () -> Void = {},
        onClose: @escaping () -> Void = {},
        onOpenCalendar: @escaping () -> Void = {},
        onOpenGmail: @escaping () -> Void = {},
        onOpenIntel: @escaping () -> Void = {},
        onOpenCreate: @escaping (CreateCanvasKind) -> Void = { _ in },
        onOpenFlow: @escaping (String) -> Void = { _ in },
        onSaveMemo: @escaping (String) -> Void = { _ in },
        onTranscribe: @escaping () -> Void = {},
        intelHasData: Bool = false,
        binderHasData: Bool = false,
        onGmailLinked: @escaping (_ calendarToo: Bool) -> Void = { _ in },
        onMoodleLinked: @escaping () -> Void = {},
        onMoodleDisconnected: @escaping () -> Void = {},
        intelLines: [String] = [],
        binderTitles: [String] = [],
        onSyncCalendar: @escaping () -> Void = {}
    ) {
        self.initialRail = initialRail
        self.initialMemoText = initialMemoText
        self.onOpenBinder = onOpenBinder
        self.onClose = onClose
        self.onOpenCalendar = onOpenCalendar
        self.onOpenGmail = onOpenGmail
        self.onOpenIntel = onOpenIntel
        self.onOpenCreate = onOpenCreate
        self.onOpenFlow = onOpenFlow
        self.onSaveMemo = onSaveMemo
        self.onTranscribe = onTranscribe
        self.intelHasData = intelHasData
        self.binderHasData = binderHasData
        self.onGmailLinked = onGmailLinked
        self.onMoodleLinked = onMoodleLinked
        self.onMoodleDisconnected = onMoodleDisconnected
        self.intelLines = intelLines
        self.binderTitles = binderTitles
        self.onSyncCalendar = onSyncCalendar
        _rail = State(initialValue: initialRail)
        _memoDraft = State(initialValue: initialMemoText)
    }

    private var expanded: Bool { rail != .none }

    /// Drag empty cream to pan; pinch to move through the board in space.
    /// Tiles still win taps (minimumDistance keeps a tap from becoming a pan).
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
        // GeometryReader is the root (same shape as CreateCanvasView).
        // Do not wrap it in an outer ZStack + Color sibling, and do not
        // center the board with .position() — that pair was laying the
        // 1440×810 artboard out at ~half width on iPad (Email / Gcal
        // off-screen, FieldDeskView's 050a08 bleeding through on the
        // right) even when geo.size reported the full 1180×820.
        // One explicit ZStack child only. Tiles may .position() inside
        // the hard-framed board; the board itself must not.
        GeometryReader { geo in
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            let board = CGSize(width: artboard.width * scale, height: artboard.height * scale)
            ZStack {
                Color(gridHex: "fff8e9").ignoresSafeArea()
                tileBoard(scale: scale, board: board)
                    .scaleEffect(spaceZoom * liveZoom)
                    .offset(x: spacePan.width + livePan.width, y: spacePan.height + livePan.height)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .contentShape(Rectangle())
            .gesture(spaceGesture)
            .task { await syncConnectedBoxes() }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .onChange(of: intelLines) { _, lines in boxBus.intelLines = lines }
        .onChange(of: binderTitles) { _, titles in boxBus.binderTitles = titles }
        .sheet(isPresented: $showMoodleSheet) {
            MoodleBoxSheet(
                client: moodle,
                onLinked: onMoodleLinked,
                onDisconnected: onMoodleDisconnected
            )
        }
        // No Exit control here anymore - moved into the Manage page
        // (logo tap) so the dashboard itself stays clean. onClose is still
        // wired from FieldDeskView but nothing on this screen calls it now.
        // Not a direct .accessibilityIdentifier() here either - same
        // clobbering bug as workDock, this time it would stomp every
        // nested tile/dock/rail identifier with "deskGridDashboard".
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "dashboard").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridDashboard")
                .allowsHitTesting(false)
        }
    }

    private func tileBoard(scale: CGFloat, board: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            Color.clear
                .frame(width: board.width, height: board.height)
            DottedDeskGrid()
                .frame(width: board.width, height: board.height)
            pin(boxRect(.intel), scale: scale) {
                photoTile(.intel)
            }
            pin(boxRect(.moodle), scale: scale) {
                photoTile(.moodle)
            }
            pin(boxRect(.binder), scale: scale) {
                photoTile(.binder)
            }
            pin(boxRect(.emailSummaries), scale: scale) {
                photoTile(.emailSummaries)
            }
            pin(boxRect(.gcal), scale: scale) {
                photoTile(.gcal)
            }
            pin(WorkArtboard.dock, scale: scale) { activeDock }
            if expanded {
                pin(rail == .memo ? WorkArtboard.memoRail : WorkArtboard.flowsRail, scale: scale) {
                    if rail == .memo { memoRail } else { flowsRail }
                }
            }
        }
        .frame(width: board.width, height: board.height, alignment: .topLeading)
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: boxBus.hungry)
    }

    /// Place a measured PDF box on the hard-framed board. `.position()` is
    /// safe here — same helper as CreateCanvasView. The half-width bug was
    /// applying `.position()` to the board itself inside GeometryReader.
    private func pin<Content: View>(_ box: CGRect, scale: CGFloat, @ViewBuilder content: () -> Content) -> some View {
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

        var mascotSlug: String? {
            switch self {
            case .intel: return "intel"
            case .moodle: return "moodle"
            case .binder: return "binder"
            case .emailSummaries: return "email"
            case .gcal: return "gcal"
            case .memo: return nil
            }
        }

        func mascotAssetName(state: MascotPhase) -> String? {
            guard let mascotSlug else { return nil }
            return "desk_mascot_\(mascotSlug)_\(state.rawValue)"
        }

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

        func blurb(phase: MascotPhase, assignmentCount: Int) -> String {
            switch self {
            case .moodle:
                if phase == .working { return "Talking to Moodle…" }
                if phase == .awake {
                    return assignmentCount == 0
                        ? "Connected. No assignments in view yet."
                        : "\(assignmentCount) assignment\(assignmentCount == 1 ? "" : "s") from Moodle."
                }
                return "Tap the sleeping mascot to connect."
            case .emailSummaries:
                if phase == .sleeping { return "Tap the sleeping mascot to connect Gmail." }
                if phase == .working { return "Connecting Gmail…" }
                return "Listen through what actually needs you."
            case .gcal:
                if phase == .sleeping { return "Tap the sleeping mascot to connect Calendar." }
                if phase == .working { return "Connecting Calendar…" }
                return "This week, already on the page."
            case .intel:
                return phase == .sleeping
                    ? "Empty until Gmail, Calendar, or Moodle fetch something."
                    : "Jesse pulled three things from this week."
            case .binder:
                return phase == .sleeping
                    ? "Empty until Jesse files something here."
                    : "ACT Field Book. Pull it onto the desk."
            case .memo:
                return "Pin a note on the right rail."
            }
        }
    }

    /// Real paper-cut illustrated stills (`desk_mascot_<slug>_<state>` in
    /// Assets.xcassets) replace the earlier procedurally-drawn creature -
    /// same three-state model, same five box identities, just image-backed
    /// with an SF Symbol fallback if an asset is ever missing.
    private enum MascotPhase: String {
        case sleeping
        case working
        case awake
    }

    private func photoTile(_ kind: TileKind) -> some View {
        let phase = mascotPhase(kind)
        let awake = phase != .sleeping
        return VStack(alignment: .leading, spacing: 6) {
            Text(kind.title)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e"))
            Button {
                handleTile(kind)
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(LinearGradient(colors: kind.wash, startPoint: .topLeading, endPoint: .bottomTrailing))
                    if kind.mascotSlug != nil {
                        mascotArt(kind, phase: phase)
                        .scaleEffect(tileShowsContent(kind) ? 0.55 : 1)
                        .offset(
                            x: tileShowsContent(kind) ? 48 : 0,
                            y: kind == .binder && binderPulled ? 18 : (tileShowsContent(kind) ? -28 : -8)
                        )
                    } else {
                        Image(systemName: kind.symbol)
                            .font(.system(size: 36, weight: .medium))
                            .foregroundColor(.white.opacity(awake ? 0.88 : 0.35))
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Spacer(minLength: 0)
                        tileBody(kind, phase: phase)
                    }
                    .padding(10)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: .black.opacity(0.14), radius: 12, y: 6)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(awake ? Color.clear : Color(gridHex: "143a2e").opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("deskGridTile_\(kind.title)")
        }
    }

    private func mascotPhase(_ kind: TileKind) -> MascotPhase {
        switch kind {
        case .emailSummaries:
            if gmail.isBusy { return .working }
            return gmail.hasGmailScope ? .awake : .sleeping
        case .gcal:
            if gmail.isBusy { return .working }
            return gmail.hasCalendarScope ? .awake : .sleeping
        case .moodle:
            if moodle.isBusy { return .working }
            return moodle.isConnected ? .awake : .sleeping
        case .intel:
            return intelHasData ? .awake : .sleeping
        case .binder:
            return binderHasData ? .awake : .sleeping
        case .memo:
            return .awake
        }
    }

    /// Identifier lives on a nested marker, not the root image - same
    /// clobber family as `DeskGridDashboardView`'s dock (see CLAUDE.md):
    /// a parent's `.accessibilityIdentifier` stomps a plain child's own id.
    @ViewBuilder
    private func mascotArt(_ kind: TileKind, phase: MascotPhase) -> some View {
        if let assetName = kind.mascotAssetName(state: phase), let image = UIImage(named: assetName) {
            let content = Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .overlay(alignment: .topLeading) {
                    Text(verbatim: "mascot-\(kind.mascotSlug ?? "")")
                        .font(.system(size: 1))
                        .foregroundColor(.clear)
                        .accessibilityIdentifier("deskGridMascot_\(kind.mascotSlug ?? "")")
                        .allowsHitTesting(false)
                }
                .accessibilityLabel("\(kind.title) mascot, \(phase.rawValue)")
            if mascotTappable(kind) {
                Button(action: { connectMascot(kind) }) { content }
                    .buttonStyle(.plain)
                    .accessibilityHint("Connect this box")
            } else {
                content.accessibilityAddTraits(.isImage)
            }
        } else {
            Image(systemName: kind.symbol)
                .font(.system(size: kind == .binder ? 54 : 36, weight: .medium))
                .foregroundColor(.white.opacity(phase != .sleeping ? 0.88 : 0.35))
        }
    }

    private func mascotTappable(_ kind: TileKind) -> Bool {
        switch kind {
        case .moodle: return !moodle.isConnected
        case .emailSummaries: return !gmail.hasGmailScope
        case .gcal: return !gmail.hasCalendarScope
        default: return false
        }
    }

    private func connectMascot(_ kind: TileKind) {
        switch kind {
        case .moodle:
            showMoodleSheet = true
        case .emailSummaries, .gcal:
            Task {
                await gmail.connectGoogleMailAndCalendar()
                if gmail.hasGmailScope {
                    onGmailLinked(gmail.hasCalendarScope)
                }
            }
        default:
            break
        }
    }

    /// The search field had no wired behavior at all - typing did nothing,
    /// submitting did nothing (reported explicitly). Matches against the
    /// same real destinations the dock chips and tiles already open, so
    /// "search" genuinely jumps somewhere instead of being a decorative box.
    private func submitSearch() {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        defer { searchQuery = "" }
        guard !query.isEmpty else { return }
        if "binder".contains(query) || "act field book".contains(query) {
            handleTile(.binder)
        } else if "calendar".contains(query) || "gcal".contains(query) {
            onOpenCalendar()
        } else if "gmail".contains(query) || "email".contains(query) || "email summaries".contains(query) {
            onOpenGmail()
        } else if "memo".contains(query) {
            setRail(rail == .memo ? .none : .memo)
        } else if "flows".contains(query) || "presentation".contains(query) || "gdoc".contains(query)
            || "resume".contains(query) || "archive".contains(query) || "book".contains(query) || "apply".contains(query) {
            setRail(rail == .flows ? .none : .flows)
        }
    }

    /// Flows-only search - already inside the rail, so a match opens the
    /// flow directly instead of just toggling the rail (which is already open).
    private func submitFlowsSearch() {
        let query = flowsSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        defer { flowsSearchQuery = "" }
        guard !query.isEmpty else { return }
        if "presentation".contains(query) || "slide".contains(query) {
            onOpenCreate(.presentation)
        } else if "gdoc".contains(query) || "doc".contains(query) {
            onOpenCreate(.gdoc)
        } else if "resume".contains(query) {
            onOpenFlow("resume")
        } else if "archive".contains(query) {
            onOpenFlow("archive")
        } else if "book".contains(query) {
            onOpenFlow("book")
        } else if "apply".contains(query) || "job".contains(query) {
            onOpenFlow("apply")
        }
    }

    private func handleTile(_ kind: TileKind) {
        let box = boxID(kind)
        if tileShowsContent(kind), boxBus.hungry != box {
            boxBus.requestSpace(for: box)
            return
        }
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
        case .intel:
            onOpenIntel()
        case .moodle:
            showMoodleSheet = true
        default:
            break
        }
    }

    private func boxID(_ kind: TileKind) -> DeskBoxBus.Box {
        switch kind {
        case .intel: return .intel
        case .moodle: return .moodle
        case .binder: return .binder
        case .emailSummaries: return .email
        case .gcal: return .gcal
        case .memo: return .jesse
        }
    }

    private func tileShowsContent(_ kind: TileKind) -> Bool {
        switch kind {
        case .emailSummaries:
            return gmail.hasGmailScope && (shownDigest != nil || !gmail.messages.isEmpty)
        case .gcal:
            return gmail.hasCalendarScope && !gmail.week.isEmpty
        case .moodle:
            return moodle.isConnected && (!moodle.assignments.isEmpty || !moodle.grades.isEmpty)
        case .intel:
            return !intelLines.isEmpty
        case .binder:
            return !binderTitles.isEmpty
        case .memo:
            return false
        }
    }

    private var shownDigest: GmailDigestClient.Digest? {
        if let d = digest.digest { return d }
        guard let rec = digestStore.history.first else { return nil }
        return GmailDigestClient.Digest(
            headline: rec.headline,
            actionItems: rec.actionItems,
            fyi: rec.fyi,
            fallback: false
        )
    }

    private var tileInk: Color { Color(gridHex: "143a2e") }

    @ViewBuilder
    private func tileBody(_ kind: TileKind, phase: MascotPhase) -> some View {
        let ink: Color = (kind == .binder || kind == .moodle || kind == .emailSummaries) ? tileInk : .white
        if tileShowsContent(kind) {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(tileLines(kind).prefix(boxBus.hungry == boxID(kind) ? 7 : 3).enumerated()), id: \.offset) { _, line in
                    Text(line)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            .accessibilityIdentifier(kind == .emailSummaries ? "deskGridEmailSummaries" : "deskGridTileBody_\(kind.title)")
        } else {
            Text(kind.blurb(phase: phase, assignmentCount: moodle.assignments.count))
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
    }

    private func tileLines(_ kind: TileKind) -> [String] {
        switch kind {
        case .emailSummaries:
            if let digest = shownDigest {
                var lines = [digest.headline]
                lines.append(contentsOf: digest.actionItems.prefix(4).map(\.subject))
                if lines.count < 3 {
                    lines.append(contentsOf: digest.fyi.prefix(2).map(\.subject))
                }
                return lines.filter { !$0.isEmpty }
            }
            return gmail.messages.prefix(5).map(\.subject).filter { !$0.isEmpty }
        case .gcal:
            return gmail.week.prefix(6).map { "\($0.day) · \($0.title)" }
        case .moodle:
            let work = moodle.assignments.prefix(5).map { "\($0.name) · \($0.dueLabel)" }
            if !work.isEmpty { return Array(work) }
            return moodle.grades.prefix(5).map { "\($0.itemName) · \($0.gradeLabel)" }
        case .intel:
            return intelLines
        case .binder:
            return binderTitles
        case .memo:
            return []
        }
    }

    private func boxRect(_ kind: TileKind) -> CGRect {
        let base: CGRect
        switch kind {
        case .intel: base = expanded ? WorkArtboard.p5Intel : WorkArtboard.p4Intel
        case .moodle: base = expanded ? WorkArtboard.p5Moodle : WorkArtboard.p4Moodle
        case .binder: base = expanded ? WorkArtboard.p5Binder : WorkArtboard.p4Binder
        case .emailSummaries: base = expanded ? WorkArtboard.p5Email : WorkArtboard.p4Email
        case .gcal: base = expanded ? WorkArtboard.p5Gcal : WorkArtboard.p4Gcal
        case .memo: return WorkArtboard.memoRail
        }
        guard let hungry = boxBus.hungry else { return base }
        return negotiated(kind, hungry: hungry, page5: expanded, base: base)
    }

    /// A cramped box asks its neighbors to shrink so it can show content.
    /// Restores when another box asks, or when hungry is cleared.
    private func negotiated(_ kind: TileKind, hungry: DeskBoxBus.Box, page5: Bool, base: CGRect) -> CGRect {
        if page5 {
            switch hungry {
            case .email:
                switch kind {
                case .emailSummaries: return CGRect(x: 820, y: 54, width: 400, height: 340)
                case .gcal: return CGRect(x: 820, y: 404, width: 400, height: 216)
                case .binder: return CGRect(x: 425, y: 54, width: 380, height: 524)
                default: return base
                }
            case .gcal:
                switch kind {
                case .gcal: return CGRect(x: 820, y: 180, width: 400, height: 440)
                case .emailSummaries: return CGRect(x: 820, y: 54, width: 400, height: 116)
                case .binder: return CGRect(x: 425, y: 54, width: 380, height: 524)
                default: return base
                }
            case .intel:
                switch kind {
                case .intel: return CGRect(x: 76, y: 54, width: 340, height: 280)
                case .moodle: return CGRect(x: 106, y: 344, width: 267, height: 167)
                default: return base
                }
            case .moodle:
                switch kind {
                case .moodle: return CGRect(x: 76, y: 250, width: 340, height: 280)
                case .intel: return CGRect(x: 76, y: 54, width: 319, height: 180)
                default: return base
                }
            case .binder:
                switch kind {
                case .binder: return CGRect(x: 380, y: 54, width: 500, height: 560)
                case .intel: return CGRect(x: 76, y: 103, width: 280, height: 192)
                case .moodle: return CGRect(x: 76, y: 323, width: 280, height: 188)
                case .emailSummaries: return CGRect(x: 900, y: 93, width: 300, height: 180)
                case .gcal: return CGRect(x: 900, y: 295, width: 300, height: 325)
                default: return base
                }
            case .jesse:
                return base
            }
        }
        switch hungry {
        case .email:
            switch kind {
            case .emailSummaries: return CGRect(x: 900, y: 90, width: 510, height: 400)
            case .gcal: return CGRect(x: 900, y: 500, width: 510, height: 170)
            case .binder: return CGRect(x: 492, y: 61, width: 390, height: 568)
            default: return base
            }
        case .gcal:
            switch kind {
            case .gcal: return CGRect(x: 900, y: 200, width: 510, height: 470)
            case .emailSummaries: return CGRect(x: 900, y: 90, width: 510, height: 100)
            case .binder: return CGRect(x: 492, y: 61, width: 390, height: 568)
            default: return base
            }
        case .intel:
            switch kind {
            case .intel: return CGRect(x: 81, y: 70, width: 400, height: 320)
            case .moodle: return CGRect(x: 115, y: 400, width: 315, height: 200)
            default: return base
            }
        case .moodle:
            switch kind {
            case .moodle: return CGRect(x: 81, y: 280, width: 400, height: 340)
            case .intel: return CGRect(x: 81, y: 70, width: 376, height: 190)
            default: return base
            }
        case .binder:
            switch kind {
            case .binder: return CGRect(x: 430, y: 50, width: 580, height: 600)
            case .intel: return CGRect(x: 81, y: 118, width: 330, height: 227)
            case .moodle: return CGRect(x: 81, y: 378, width: 330, height: 222)
            case .emailSummaries: return CGRect(x: 1033, y: 107, width: 370, height: 212)
            case .gcal: return CGRect(x: 1033, y: 343, width: 370, height: 286)
            default: return base
            }
        case .jesse:
            return base
        }
    }

    private func syncConnectedBoxes() async {
        boxBus.intelLines = intelLines
        boxBus.binderTitles = binderTitles
        await gmail.restoreSessionIfNeeded()
        // Cached digest / seeded inbox can paint before the network round-trip.
        if tileShowsContent(.emailSummaries) {
            boxBus.requestSpace(for: .email)
        }
        if gmail.hasGmailScope {
            await gmail.fetchInbox()
            // Seeded UI tests have messages but no Google user — skip the
            // webhook so the tile can show subjects without a network wait.
            if gmail.hasLiveGoogleUser, !gmail.messages.isEmpty {
                await digest.summarize(gmail.messages)
                if let d = digest.digest {
                    digestStore.save(d, messageCount: gmail.messages.count)
                }
            }
            if tileShowsContent(.emailSummaries) {
                boxBus.requestSpace(for: .email)
            }
        }
        if gmail.hasCalendarScope {
            _ = await gmail.fetchCalendarWeek()
        }
        onSyncCalendar()
        if moodle.isConnected {
            await moodle.refresh()
        }
    }

    // MARK: - Dock

    /// Flows has its own dock: Binder/Calendar/Memo/Gmail don't apply inside
    /// that rail, so it's just a way back + a search optimized for flows.
    @ViewBuilder
    private var activeDock: some View {
        if rail == .flows {
            flowsDock
        } else {
            workDock
        }
    }

    private var workDock: some View {
        HStack(spacing: 8) {
            dockChip("Binder", system: "books.vertical.fill") { handleTile(.binder) }
            dockChip("Calendar", system: "calendar", action: onOpenCalendar)
            dockChip("Memo", system: "note.text", identifier: "deskGridDashboardAddMemo") { setRail(rail == .memo ? .none : .memo) }
            dockChip("Gmail", system: "envelope.fill", action: onOpenGmail)
            dockChip("Flows", system: "bolt.fill", identifier: "deskGridDock_Flows") { setRail(rail == .flows ? .none : .flows) }
            searchField(placeholder: "Search", identifier: "deskGridDashboardSearch", onSubmit: submitSearch)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color(gridHex: "1c1c1e")))
        // NOT .accessibilityIdentifier() directly on this container - that
        // clobbers every child dockChip's own identifier with this one
        // (confirmed live: each chip reported identifier
        // "deskGridDashboardToolbar" instead of its own deskGridDock_*,
        // even though .accessibilityElement(children: .contain) correctly
        // kept them individually queryable/tappable). Same proven fix as
        // FieldDeskView's combinedAskAndDock: an invisible marker Text
        // carries the container's own identifier instead.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "toolbar").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridDashboardToolbar")
                .allowsHitTesting(false)
        }
    }

    private var flowsDock: some View {
        HStack(spacing: 8) {
            dockChip("Dashboard", system: "square.grid.2x2.fill", identifier: "deskGridDock_BackToDash") { setRail(.none) }
            // Binder/Calendar/Gmail don't apply inside Flows - they're
            // already on the dashboard's own dock. Just Memo + Transcribe
            // (ambient room recording, not a Jesse call) + the flow search.
            dockChip("Memo", system: "note.text", identifier: "deskGridFlowsMemo") { setRail(.memo) }
            dockChip("Transcribe", system: "waveform", identifier: "deskGridFlowsTranscribe", action: onTranscribe)
            searchField(
                placeholder: "Search Presentation, Resume, Archive, Book…",
                identifier: "deskGridFlowsSearch",
                text: $flowsSearchQuery,
                onSubmit: submitFlowsSearch
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color(gridHex: "1c1c1e")))
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "toolbar").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridDashboardToolbar")
                .allowsHitTesting(false)
        }
    }

    private func searchField(placeholder: String, identifier: String, text: Binding<String>? = nil, onSubmit: @escaping () -> Void) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.white.opacity(0.45))
            TextField(placeholder, text: text ?? $searchQuery)
                .textFieldStyle(.plain)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white)
                .submitLabel(.search)
                .onSubmit(onSubmit)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Capsule().fill(Color.white.opacity(0.12)))
        .accessibilityIdentifier(identifier)
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
            HStack {
                Text("Memo")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gridHex: "143a2e"))
                Spacer(minLength: 0)
                Button {
                    onSaveMemo(memoDraft)
                    memoSaved = true
                } label: {
                    Text(memoSaved ? "Saved" : "Save")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .foregroundColor(memoSaved ? Color(gridHex: "8a8478") : Color(gridHex: "143a2e"))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(memoSaved ? Color(gridHex: "e4dcc8") : Color(gridHex: "c4f547")))
                }
                .buttonStyle(.plain)
                .disabled(memoSaved)
                .accessibilityIdentifier("deskGridDashboardMemoSave")
            }
            TextField("Pin a note…", text: $memoDraft, axis: .vertical)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .textFieldStyle(.plain)
                .lineLimit(3...6)
                .onChange(of: memoDraft) { _, _ in memoSaved = false }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        )
        .accessibilityIdentifier("deskGridTile_Memo")
        .accessibilityElement(children: .contain)
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
        // Not a direct .accessibilityIdentifier() - same clobbering bug as
        // workDock, would stomp all 6 flowRow identifiers
        // (Presentation/GDoc/Resume/Archive/Book/Apply) with this
        // container's own.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "flows").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridFlowsRail")
                .allowsHitTesting(false)
        }
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
        withAnimation(.spring(response: 0.45, dampingFraction: 0.84)) { rail = next }
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
    // Only the dock's own box moves toward the board's bottom edge (was
    // y: 632, leaving an 82pt empty gap below it out of an 810pt-tall
    // board). Tile boxes above are untouched - bottom-aligning the whole
    // ZStack instead moved the tiles too, which is explicitly wrong.
    // Nudged closer to the true bottom edge again (was y: 698, leaving a
    // 16pt gap under a 96pt-tall dock on an 810pt board) - tiles untouched.
    static let dock = CGRect(x: 96, y: 706, width: 1321, height: 96)
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

/// Moodle box sheet: connect form when sleeping, real assignments/grades
/// when connected. Never invents homework.
private struct MoodleBoxSheet: View {
    @ObservedObject var client: MoodleClient
    var onLinked: () -> Void
    var onDisconnected: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var site = ""
    @State private var username = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if client.isConnected {
                        connectedBody
                    } else {
                        connectForm
                    }
                    if let err = client.lastError, !err.isEmpty {
                        Text(err)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(Color(gridHex: "b0473f"))
                    }
                }
                .padding(20)
            }
            .background(Color(gridHex: "fff8e9").ignoresSafeArea())
            .navigationTitle("Moodle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .accessibilityIdentifier("moodleSheetClose")
                }
            }
        }
    }

    private var connectForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Read-only. Assignments and grades for this student, nothing else. Schools that only allow SSO can’t mint a mobile token this way — that’s Moodle, not a fake empty inbox.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e").opacity(0.7))
            field("Moodle URL", text: $site, hint: "https://moodle.school.edu")
            field("Username", text: $username, hint: "school username")
            SecureField("Password", text: $password)
                .textFieldStyle(.plain)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
            Button {
                Task {
                    await client.connect(siteURL: site, username: username, password: password)
                    if client.isConnected {
                        onLinked()
                    }
                }
            } label: {
                Text(client.isBusy ? "Connecting…" : "Wake Moodle")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gridHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(Color(gridHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .disabled(client.isBusy)
            .accessibilityIdentifier("moodleSheetConnect")
        }
    }

    private var connectedBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(client.siteHost ?? "Connected")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(Color(gridHex: "8a8478"))
            if client.assignments.isEmpty && client.grades.isEmpty && !client.isBusy {
                Text("Connected, and Moodle returned nothing to show yet.")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gridHex: "143a2e"))
            }
            ForEach(client.assignments) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                    Text("\(item.courseName) · \(item.dueLabel)")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color(gridHex: "8a8478"))
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
            }
            ForEach(Array(client.grades.prefix(12))) { item in
                HStack {
                    Text(item.itemName)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                    Spacer()
                    Text(item.gradeLabel)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                }
                .foregroundColor(Color(gridHex: "143a2e"))
            }
            Button("Disconnect") {
                client.disconnect()
                onDisconnected()
            }
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(Color(gridHex: "b0473f"))
            .accessibilityIdentifier("moodleSheetDisconnect")
        }
    }

    private func field(_ title: String, text: Binding<String>, hint: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundColor(Color(gridHex: "8a8478"))
            TextField(hint, text: text)
                .textFieldStyle(.plain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
        }
    }
}
