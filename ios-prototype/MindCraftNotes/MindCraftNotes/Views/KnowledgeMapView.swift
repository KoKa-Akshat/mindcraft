import SwiftUI

/// The Dashboard's "Map" tab - ported directly from the real web
/// `ConstellationGpsExplorer.tsx` (2026-07-25 "implement it a to z from the
/// dashboard" pass), not an invented substitute. Uses the SAME real data the
/// web component reads from `GET /knowledge-graph/{uid}`
/// (`ml/serve.py:knowledge_graph_endpoint`): real PCA-projected node
/// positions (`x`/`y`. NOT a synthetic layout), real ontology edges with
/// Beta-Binomial weights, real student mastery/strength embedding points,
/// real PCA axis labels. Ports: the `statusKind`/`KIND_COLOR`/`KIND_LABEL`
/// 4-state palette (distinct from the Home tab's `STATUS_COLOR`; the actual
/// hex values were repainted 2026-08-21 onto this app's own light lavender
/// palette - see `MapColor`'s doc comment near the bottom of this file for
/// why), the `isMajorEdge` filter (prerequisite edges >0.25 weight,
/// any edge >0.45 - trims the "hairball" of prior-only edges), the icon +
/// status-ring + mastery-arc node treatment, the student position diamonds,
/// the legend + coverage bar, status/level filter chips, and the tap →
/// detail-panel → "See path" → route-panel flow (`RouteClient`, a real
/// `POST /recommend`). NOT yet ported (see `ACTIVE_TASK.md` native Map
/// handoff): the search-bar autocomplete, and the route panel's mini
/// interactive graph SVG (a plain step list stands in for that one piece).
struct KnowledgeMapView: View {
    let nodes: [KnowledgeGraphNode]
    let edges: [KnowledgeGraphEdge]
    let studentPoints: KnowledgeGraphStudentPoints?
    let axisLabels: KnowledgeGraphAxisLabels?
    let conceptDisplays: [String: ConceptDisplay]
    let onOpenConcept: (String) -> Void
    let onQuickPractice: (String) -> Void
    /// True when shown inside a smaller container than this view's native
    /// full-tab size (2026-08-19: `DeskGridDashboardView`'s merged
    /// Binder+Intel space, itself already inside the scaled tileBoard
    /// artboard - a real, reported complaint: "the display of fonts is
    /// horrible"). This view's own type sizes/padding were tuned for a
    /// full dashboard tab (`DashboardView`'s Map tab, still `embedded:
    /// false` there, unchanged); shrinking the loudest offenders here
    /// rather than leaving them at full-tab scale in a much smaller box.
    var embedded: Bool = false
    /// Phone full-screen mode (2026-08-24, explicit ask: "this is for the
    /// phone... its okay in ipad just here is bad so lets abridge" - tiny
    /// dots, generous 20pt margins eating screen width, and tapping a node
    /// pushed the detail panel in BELOW the canvas, shrinking it, on a
    /// screen with no room to spare). `embedded` already covers the two
    /// existing iPad shapes (full-tab vs the grid's shrunk merged-tile
    /// box) - this is a genuinely third shape, phone only, default false
    /// so neither existing iPad call site changes at all. Widens tap
    /// targets, drops side margins to near-zero, and moves the detail/
    /// route panel to a fixed-width column beside the canvas instead of a
    /// section below it.
    var phoneFullScreen: Bool = false

    private var horizontalPad: CGFloat { embedded ? 4 : (phoneFullScreen ? 8 : 20) }

    // Observed directly off the shared singleton (2026-08-27, same
    // subscription shape DeskGridDashboardView already uses for
    // DeskBoxBus) rather than threaded in as an init parameter - every one
    // of this view's 4 existing call sites keeps compiling unchanged.
    @ObservedObject private var activityBus = GenerationActivityBus.shared

    @State private var zoom: CGFloat = 1
    @State private var zoomAnchor: CGFloat = 1
    @State private var pan: CGSize = .zero
    @State private var panAnchor: CGSize = .zero
    @State private var selectedId: String?
    @State private var statusFilter: MapStatusKind?
    @State private var levelFilter: String?
    @State private var routeSteps: [RouteStep]?
    @State private var routeLoading = false
    @State private var showingRoute = false
    // Real, on-canvas animated reveal of "See path" - the trail lights up
    // one step at a time rather than just populating the side list, filling
    // the gap this file's own header doc already named ("the route panel's
    // mini interactive graph SVG - a plain step list stands in for that one
    // piece"). `pathRevealCount` is how many leading steps are lit; the
    // task drives it forward and is cancelled/restarted on every new route.
    @State private var pathRevealCount: Int = 0
    @State private var revealTask: Task<Void, Never>?
    // One shared breathing pulse every ZPD-ready node's glow halo reads -
    // a single repeating animation driving many views in unison reads as a
    // cohesive "alive" canvas rather than needing a per-node timer.
    @State private var pulsePhase = false

    // MARK: Ported status taxonomy (ConstellationGpsExplorer.tsx statusKind/KIND_COLOR/KIND_LABEL)

    enum MapStatusKind: CaseIterable { case stable, progress, needs, unknown }

    private func statusKind(_ status: String?) -> MapStatusKind {
        switch status ?? "" {
        case "mastered", "stable", "comeback_built", "ready_for_challenge": return .stable
        case "in_progress", "repairing": return .progress
        case "struggling", "open_gap": return .needs
        default: return .unknown
        }
    }

    private func kindColor(_ kind: MapStatusKind) -> Color {
        switch kind {
        case .stable: return MapColor.mastered
        case .progress: return MapColor.learning
        case .needs: return MapColor.gap
        case .unknown: return MapColor.lavenderSoft
        }
    }

    /// Filter-chip / detail-panel status pill wording.
    private func kindLabel(_ kind: MapStatusKind) -> String {
        switch kind {
        case .stable: return "Stable"
        case .progress: return "Repairing"
        case .needs: return "Open Gap"
        case .unknown: return "Unexplored"
        }
    }

    /// Bottom-legend wording - a friendlier register than the filter chips,
    /// exactly like the web version keeps two different label sets for the
    /// same 4 colors.
    private func legendLabel(_ kind: MapStatusKind) -> String {
        switch kind {
        case .stable: return "Got it"
        case .progress: return "Working on it"
        case .needs: return "Needs love"
        case .unknown: return "Not started"
        }
    }

    /// Ported `isMajorEdge` - the actual curriculum backbone
    /// (`prerequisite`) needs a moderate real-evidence bar; any other
    /// relation only earns a place on the map with an exceptionally strong
    /// weight. Everything else is the "hairball" of prior-only edges the web
    /// version explicitly filters out.
    private func isMajorEdge(_ edge: KnowledgeGraphEdge) -> Bool {
        edge.relation == "prerequisite" ? edge.weight > 0.25 : edge.weight > 0.45
    }

    // MARK: "Beautiful connections" (real Bezier curves, not straight lines)

    /// Deterministic per-edge curve direction - hashed from the edge's own
    /// endpoints so a given connection always bows the same way across
    /// redraws/pan/zoom, rather than picking a random direction each frame
    /// (which would read as flickering, not "alive").
    private func edgeCurveSign(_ edge: KnowledgeGraphEdge) -> CGFloat {
        var hasher = Hasher()
        hasher.combine(edge.from)
        hasher.combine(edge.to)
        return hasher.finalize() % 2 == 0 ? 1 : -1
    }

    /// A quadratic Bezier through a real midpoint offset - the concrete
    /// "smooth, considered edge curves" ask, versus a ruler-straight line.
    /// Bulge scales with (and is capped relative to) the segment's own
    /// length so short and long connections both read as gentle arcs rather
    /// than long ones flattening out or short ones over-bowing.
    private func curvedEdgePath(from a: CGPoint, to b: CGPoint, sign: CGFloat) -> Path {
        let dx = b.x - a.x, dy = b.y - a.y
        let length = max((dx * dx + dy * dy).squareRoot(), 0.001)
        let bulge = min(length * 0.14, 26) * sign
        let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
        let control = CGPoint(x: mid.x + (-dy / length) * bulge, y: mid.y + (dx / length) * bulge)
        var path = Path()
        path.move(to: a)
        path.addQuadCurve(to: b, control: control)
        return path
    }

    // MARK: Zone of proximal development (real, not cosmetic)

    /// Vygotsky's ZPD: not mastered yet, but reachable right now because the
    /// scaffolding under it is already in place - versus a node that's
    /// genuinely still out of reach. Every "untouched" node used to render
    /// identically dim regardless of which of those two it was; this
    /// recovers the distinction from data already on screen (no extra
    /// network call), mirroring the real pathfinder's own backward-
    /// propagation rule ("unknown presumed mastered only if chain successor
    /// is mastered" - `engine/planning/pathfinder.py`, per CLAUDE.md): an
    /// untouched node is ZPD-ready when every real `prerequisite` edge into
    /// it comes from an already-stable node, or it has no prerequisite
    /// edges at all (a foundational node).
    private var zpdReadyIds: Set<String> {
        let statusById = Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, statusKind($0.status)) })
        var ready: Set<String> = []
        for node in nodes where statusKind(node.status) == .unknown {
            let prereqEdges = edges.filter { $0.relation == "prerequisite" && $0.to == node.id }
            let blocked = prereqEdges.contains { (statusById[$0.from] ?? .unknown) != .stable }
            if !blocked { ready.insert(node.id) }
        }
        return ready
    }

    private enum ZPDZone { case mastered, active, ready, locked }

    private func zpdZone(_ node: KnowledgeGraphNode, zpdReady: Set<String>) -> ZPDZone {
        switch statusKind(node.status) {
        case .stable: return .mastered
        case .progress, .needs: return .active
        case .unknown: return zpdReady.contains(node.id) ? .ready : .locked
        }
    }

    private func label(for id: String) -> String {
        conceptDisplays[id]?.label ?? id.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private var levels: [String] {
        Array(Set(nodes.compactMap(\.level))).sorted()
    }

    private var visibleNodeIds: Set<String> {
        var filtered = nodes
        if let lf = levelFilter { filtered = filtered.filter { $0.level == lf } }
        if let sf = statusFilter { filtered = filtered.filter { statusKind($0.status) == sf } }
        return Set(filtered.map(\.id))
    }

    private var stats: (stable: Int, progress: Int, needs: Int, total: Int) {
        var stable = 0, progress = 0, needs = 0
        for n in nodes {
            switch statusKind(n.status) {
            case .stable: stable += 1
            case .progress: progress += 1
            case .needs: needs += 1
            case .unknown: break
            }
        }
        return (stable, progress, needs, nodes.count)
    }

    private var coveragePct: Int {
        stats.total == 0 ? 0 : Int((Double(stats.stable) / Double(stats.total) * 100).rounded())
    }

    // MARK: Real normalized layout (ports scalePositions. PCA x/y min-max fit)

    private struct Layout {
        var positions: [String: CGPoint] = [:]
        var studentMastery: CGPoint?
        var studentStrength: CGPoint?
    }

    private var layout: Layout {
        var bundle = Layout()
        var minX = Double.infinity, maxX = -Double.infinity
        var minY = Double.infinity, maxY = -Double.infinity
        for n in nodes {
            guard let x = n.x, let y = n.y else { continue }
            minX = min(minX, x); maxX = max(maxX, x)
            minY = min(minY, y); maxY = max(maxY, y)
        }
        if let sp = studentPoints {
            minX = min(minX, sp.mastery.x, sp.strength.x)
            maxX = max(maxX, sp.mastery.x, sp.strength.x)
            minY = min(minY, sp.mastery.y, sp.strength.y)
            maxY = max(maxY, sp.mastery.y, sp.strength.y)
        }
        guard minX.isFinite, maxX.isFinite, minY.isFinite, maxY.isFinite else { return bundle }
        let rangeX = max(maxX - minX, 0.0001)
        let rangeY = max(maxY - minY, 0.0001)
        func norm(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: (x - minX) / rangeX, y: (y - minY) / rangeY)
        }
        for n in nodes {
            guard let x = n.x, let y = n.y else { continue }
            bundle.positions[n.id] = norm(x, y)
        }
        if let sp = studentPoints {
            bundle.studentMastery = norm(sp.mastery.x, sp.mastery.y)
            bundle.studentStrength = norm(sp.strength.x, sp.strength.y)
        }
        return bundle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: embedded ? 8 : 10) {
            Text("Map")
                .font(.system(size: embedded ? 16 : 30, weight: .bold, design: .rounded))
                .foregroundColor(MapColor.ink)
                .padding(.horizontal, horizontalPad)
                .padding(.top, embedded ? 0 : 8)

            if !nodes.isEmpty {
                filterChips.padding(.horizontal, horizontalPad)
            }

            if nodes.isEmpty {
                emptyState.padding(.horizontal, horizontalPad)
            } else {
                let canvasCard = ZStack(alignment: .topTrailing) {
                    graphCanvas
                        .background(MapColor.canvasBg)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .strokeBorder(MapColor.ink.opacity(0.08), lineWidth: 1)
                        )
                        // Real, considered card styling (the light-lavender
                        // ask) instead of the old glassmorphism treatment -
                        // same soft-shadow-on-paper language as
                        // `DeskGridDashboardView.tileInnerCard`.
                        .shadow(color: .black.opacity(0.06), radius: 12, y: 6)
                    zoomControls.padding(10)
                }

                // Detail panel as a floating overlay, not a layout sibling
                // (2026-08-27, real bug fix: "if I press on something, the
                // dots on the screen move... is it logical?"). It wasn't -
                // canvasCard sat in the same HStack/VStack as the panel, so
                // inserting the panel shrank canvasCard's own width (phone)
                // or height (iPad), and EVERY node's screen position is
                // computed from that shrunk size (graphCanvas's own
                // GeometryReader) - the whole graph visibly resettled around
                // whichever node was tapped, which reads as random motion,
                // not a bug in any one node. canvasCard's frame is now fixed
                // regardless of selection; the panel floats on top with its
                // own card chrome (MapColor.cardPaper, same shadow language
                // as canvasCard) instead of taking space from it.
                if phoneFullScreen {
                    ZStack(alignment: .trailing) {
                        canvasCard
                        if let id = selectedId {
                            ScrollView(showsIndicators: false) {
                                detailOrRoutePanel(for: id)
                            }
                            .frame(width: 240, height: 340)
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(MapColor.cardPaper)
                                    .shadow(color: .black.opacity(0.16), radius: 16, y: 6)
                            )
                            .padding(.trailing, 8)
                            .transition(.move(edge: .trailing).combined(with: .opacity))
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, horizontalPad)
                    .animation(.easeInOut(duration: 0.22), value: selectedId)
                } else {
                    ZStack(alignment: .bottom) {
                        canvasCard
                        if let id = selectedId {
                            ScrollView(showsIndicators: false) {
                                detailOrRoutePanel(for: id)
                            }
                            .frame(maxHeight: 260)
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(MapColor.cardPaper)
                                    .shadow(color: .black.opacity(0.16), radius: 18, y: -4)
                            )
                            .padding(.bottom, 6)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, horizontalPad)
                    .animation(.easeInOut(duration: 0.22), value: selectedId)

                    legendRow.padding(.horizontal, horizontalPad)
                }
            }
        }
        .padding(.bottom, embedded ? 8 : 24)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) {
                pulsePhase = true
            }
        }
    }

    // MARK: Graph canvas

    private var graphCanvas: some View {
        GeometryReader { geo in
            let size = geo.size
            let pad: CGFloat = 28
            let innerW = size.width - pad * 2
            let innerH = size.height - pad * 2
            let scale = zoom
            let offset = CGSize(width: pan.width, height: pan.height)
            let bundle = layout
            let zpdReady = zpdReadyIds

            let screenPoint: (CGPoint) -> CGPoint = { norm in
                CGPoint(
                    x: pad + norm.x * innerW,
                    y: pad + norm.y * innerH
                )
            }
            let transformed: (CGPoint) -> CGPoint = { p in
                CGPoint(
                    x: size.width / 2 + (p.x - size.width / 2) * scale + offset.width,
                    y: size.height / 2 + (p.y - size.height / 2) * scale + offset.height
                )
            }

            ZStack {
                Canvas { context, _ in
                    // "Beautiful connections": a lavender-family curved
                    // Bezier per edge (not the old ink-gray straight line),
                    // weight-modulated opacity/width so real Beta-Binomial
                    // edge strength stays legible, and a soft glow pass
                    // under any edge touching the selected node.
                    for edge in edges where isMajorEdge(edge) {
                        guard
                            let a = bundle.positions[edge.from],
                            let b = bundle.positions[edge.to]
                        else { continue }
                        let pa = transformed(screenPoint(a))
                        let pb = transformed(screenPoint(b))
                        let path = curvedEdgePath(from: pa, to: pb, sign: edgeCurveSign(edge))
                        let lit = selectedId != nil && (edge.from == selectedId || edge.to == selectedId)
                        let weight = CGFloat(min(max(edge.weight, 0), 1))
                        if lit {
                            context.drawLayer { glow in
                                glow.addFilter(.blur(radius: 3))
                                glow.stroke(path, with: .color(MapColor.violetDeep.opacity(0.35)), lineWidth: 4)
                            }
                        }
                        context.stroke(
                            path,
                            with: .color(MapColor.violetDeep.opacity(lit ? 0.6 : 0.14 + weight * 0.2)),
                            lineWidth: (lit ? 1.8 : 1) + weight * 1.6
                        )
                    }

                    // Student mastery/strength embedding points - real PCA
                    // projections of "where you've been studying" vs "where
                    // you perform best" (ml/serve.py student_points), a
                    // gently bowed connector between them shows the
                    // displacement - curved like every other connection on
                    // this map now, and lavender-family instead of the old
                    // stray hardcoded `Color.purple`.
                    if let m = bundle.studentMastery, let st = bundle.studentStrength {
                        let pm = transformed(screenPoint(m))
                        let pst = transformed(screenPoint(st))
                        let line = curvedEdgePath(from: pm, to: pst, sign: 1)
                        context.stroke(line, with: .color(MapColor.violetDeep.opacity(0.55)), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                    }

                    // "See path" reveal trail - the real answer to "which
                    // ones do I click to see the next path": a genuine
                    // Beta-Binomial-weighted `RouteClient.plotRoute` result,
                    // lit segment by segment as `pathRevealCount` advances
                    // (driven by `loadRoute`'s reveal task), not a static
                    // overlay. Glow is a wide blurred pass under a crisp core
                    // stroke - Canvas has no native shadow-on-stroke.
                    if showingRoute, let steps = routeSteps, steps.count > 1 {
                        var trail = Path()
                        var any = false
                        for i in 0..<min(pathRevealCount, steps.count - 1) {
                            guard
                                let a = bundle.positions[steps[i].conceptId],
                                let b = bundle.positions[steps[i + 1].conceptId]
                            else { continue }
                            let pa = transformed(screenPoint(a))
                            let pb = transformed(screenPoint(b))
                            trail.addPath(curvedEdgePath(from: pa, to: pb, sign: 1))
                            any = true
                        }
                        if any {
                            context.drawLayer { glow in
                                glow.addFilter(.blur(radius: 5))
                                glow.stroke(trail, with: .color(MapColor.zpdReady.opacity(0.85)), lineWidth: 5)
                            }
                            context.stroke(trail, with: .color(MapColor.zpdReady), lineWidth: 2)
                        }
                    }
                }

                if let m = layout.studentMastery {
                    diamondMarker(filled: true, color: MapColor.ink, label: studentPoints?.mastery.label ?? "")
                        .position(transformed(screenPoint(m)))
                }
                if let st = layout.studentStrength {
                    diamondMarker(filled: false, color: MapColor.lavender, label: studentPoints?.strength.label ?? "")
                        .position(transformed(screenPoint(st)))
                }

                ForEach(nodes) { node in
                    if let norm = layout.positions[node.id] {
                        let p = transformed(screenPoint(norm))
                        nodeView(node, at: p, zpdReady: zpdReady)
                    }
                }

                if let labels = axisLabels {
                    Text(labels.x)
                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                        .foregroundColor(MapColor.inkSoft.opacity(0.55))
                        .position(x: size.width / 2, y: size.height - 8)
                    Text(labels.y)
                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                        .foregroundColor(MapColor.inkSoft.opacity(0.55))
                        .rotationEffect(.degrees(-90))
                        .position(x: 12, y: size.height / 2)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                SimultaneousGesture(
                    MagnificationGesture()
                        .onChanged { value in zoom = min(max(zoomAnchor * value, 0.5), 4) }
                        .onEnded { _ in zoomAnchor = zoom },
                    DragGesture()
                        .onChanged { value in
                            pan = CGSize(
                                width: panAnchor.width + value.translation.width,
                                height: panAnchor.height + value.translation.height
                            )
                        }
                        .onEnded { _ in panAnchor = pan }
                )
            )
        }
    }

    @ViewBuilder
    private func nodeView(_ node: KnowledgeGraphNode, at p: CGPoint, zpdReady: Set<String>) -> some View {
        let isSelected = selectedId == node.id
        let hasData = (node.eventCount ?? 0) > 0
        let kind = statusKind(node.status)
        let zone = zpdZone(node, zpdReady: zpdReady)
        // Ready/locked are both "unknown" under the mastery-status taxonomy,
        // but they mean opposite things for what to do next - give them
        // genuinely different colors instead of collapsing to one gray.
        let accent: Color = kind == .unknown
            ? (zone == .ready ? MapColor.zpdReady : MapColor.zpdLocked)
            : kindColor(kind)
        // Bigger dots on phone (2026-08-24, explicit ask: "isnot there a
        // bettwe way to show these dots... hard to navigate or see things
        // at all") - the iPad sizing was well under a real touch target
        // on a phone screen. iPad's own two shapes (embedded/full-tab)
        // are untouched.
        let radiusScale: CGFloat = phoneFullScreen ? 1.5 : 1
        let baseRadius: CGFloat = (isSelected ? (hasData ? 15 : 12.5) : (hasData ? 11 : 9.5)) * radiusScale
        // "Node size should encode something real" - real engagement
        // (eventCount), continuously, layered on top of the existing
        // hasData/isSelected step so more-practiced nodes read as very
        // slightly larger/closer, not just an on/off switch.
        let engagement = min(1, Double(node.eventCount ?? 0) / 8)
        let radius: CGFloat = baseRadius + CGFloat(engagement) * 2.2
        let mastery = min(1, max(0, node.mastery ?? 0))
        let dimmed = !visibleNodeIds.contains(node.id)
        let showLabel = isSelected || (node.eventCount ?? 0) > 3
        let stepIndex = routeStepIndex(for: node.id)
        let isRevealed = stepIndex.map { pathRevealCount > $0 } ?? false
        let isPendingOnPath = stepIndex.map { pathRevealCount <= $0 } ?? false
        let baseOpacity: Double = {
            if dimmed { return 0.3 }
            if hasData { return 1 }
            return zone == .ready ? 0.85 : 0.35
        }()

        ZStack {
            // Breathing glow halo - the ZPD's actual invitation: "not done,
            // but everything under this is." Only ready-unknown nodes with
            // no data yet get it; a node the student has already touched
            // reads through mastery/status instead.
            if zone == .ready, !hasData, !dimmed {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [MapColor.zpdReady.opacity(pulsePhase ? 0.38 : 0.16), .clear],
                            center: .center, startRadius: 0, endRadius: radius + 16
                        )
                    )
                    .frame(width: (radius + 16) * 2, height: (radius + 16) * 2)
                    .scaleEffect(pulsePhase ? 1.08 : 0.94)
            }

            if isRevealed {
                Circle()
                    .fill(MapColor.zpdReady.opacity(0.22))
                    .frame(width: (radius + 9) * 2, height: (radius + 9) * 2)
                    .overlay(Circle().stroke(MapColor.zpdReady.opacity(0.7), lineWidth: 1.5))
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            } else if isPendingOnPath {
                Circle()
                    .strokeBorder(MapColor.zpdReady.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
                    .frame(width: (radius + 9) * 2, height: (radius + 9) * 2)
            }

            // Generation-complete flash (2026-08-27) - same ring shape/
            // transition as the route-reveal ring above, reused rather
            // than a new visual invented for this. GenerationActivityBus
            // self-clears this after a few seconds, so it's a pop-in-then-
            // fade moment, not a persistent state.
            if activityBus.activity[node.id] == .ready {
                Circle()
                    .fill(MapColor.zpdReady.opacity(0.3))
                    .frame(width: (radius + 12) * 2, height: (radius + 12) * 2)
                    .overlay(Circle().stroke(MapColor.zpdReady, lineWidth: 2))
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
                    .animation(.easeOut(duration: 0.4), value: activityBus.activity[node.id])
            }

            if isSelected {
                Circle().fill(accent.opacity(0.12)).frame(width: (radius + 11) * 2, height: (radius + 11) * 2)
                    .overlay(Circle().stroke(accent.opacity(0.45), lineWidth: 1.5))
            }

            Button(action: {
                revealTask?.cancel()
                pathRevealCount = 0
                showingRoute = false
                routeSteps = nil
                selectedId = (selectedId == node.id) ? nil : node.id
            }) {
                ZStack {
                    Group {
                        if let url = ConceptIconLookup.url(forConceptId: node.id) {
                            SVGImageView(fileURL: url)
                        } else {
                            Circle().fill(MapColor.cardPaper)
                        }
                    }
                    .frame(width: radius * 2, height: radius * 2)
                    .clipShape(Circle())

                    // "3D if possible": SwiftUI has no lightweight scene
                    // graph suited to an interactive 2D node map, so
                    // RealityKit/SceneKit would be real overkill here. The
                    // achievable, real move is a depth CUE instead of
                    // literal geometry - a soft highlight suggesting a lit
                    // sphere sitting on the canvas rather than a flat
                    // painted circle. Plain normal-blend white-to-clear
                    // radial gradient, clipped to the same circle - no blend
                    // mode, so it can't bleed into the canvas layers below.
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color.white.opacity(0.5), Color.white.opacity(0)],
                                center: UnitPoint(x: 0.32, y: 0.26), startRadius: 0, endRadius: radius * 1.3
                            )
                        )
                        .frame(width: radius * 2, height: radius * 2)
                        .clipShape(Circle())
                        .allowsHitTesting(false)

                    // Status ring - the icon art is the same parchment badge
                    // regardless of progress, so this ring is what actually
                    // carries the got-it/working-on-it/needs-love signal.
                    Circle()
                        .stroke(accent, lineWidth: isSelected ? 2.6 : 1.6)
                        .frame(width: radius * 2, height: radius * 2)

                    // Mastery progress arc - real % as a partial ring,
                    // ported from the web's stroke-dasharray arc.
                    if mastery > 0.05 {
                        Circle()
                            .trim(from: 0, to: CGFloat(mastery))
                            .stroke(accent.opacity(0.85), style: StrokeStyle(lineWidth: 1.8, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .frame(width: (radius + 3.5) * 2, height: (radius + 3.5) * 2)
                    }
                }
                // The visible icon is only ~20-30pt across (real size, real
                // status ring) - well under Apple's 44pt minimum tap target
                // and the actual reported "so hard to touch the icons" bug.
                // This invisible padding enlarges the tappable area without
                // changing anything visual; .contentShape makes the padding
                // itself register taps (a Button's default hit area is its
                // rendered content, not its frame).
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Circle())
                // More depth: shadow scales with the same real engagement
                // signal driving radius above, so more-practiced (bigger)
                // nodes read as genuinely closer to the viewer. The
                // `.rotation3DEffect` tilt-on-selection is the one place a
                // literal (if very cheap, SwiftUI-native) 3D technique earns
                // its place here - a coin-like lift toward the viewer, not a
                // gimmick, and it costs nothing like a real 3D scene would.
                .shadow(color: MapColor.ink.opacity(0.16 + engagement * 0.14), radius: 3 + CGFloat(engagement) * 3, x: 0, y: 2 + CGFloat(engagement) * 2)
                .rotation3DEffect(.degrees(isSelected ? 12 : 0), axis: (x: 1, y: 0.35, z: 0), perspective: 0.4)
                .animation(.spring(response: 0.35, dampingFraction: 0.72), value: isSelected)
            }
            .buttonStyle(.plain)
            .opacity(baseOpacity)
            .accessibilityIdentifier("mapNode_\(node.id)")

            if showLabel {
                Text(label(for: node.id))
                    .font(.system(size: isSelected ? 9.5 : 8.5, weight: isSelected ? .bold : .medium, design: .rounded))
                    .foregroundColor(isSelected ? MapColor.ink : MapColor.inkSoft.opacity(0.72))
                    .fixedSize()
                    .offset(y: radius + 16)
                    .opacity(dimmed ? 0.3 : 1)
            }
        }
        .position(p)
    }

    private func diamondMarker(filled: Bool, color: Color, label: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 8, weight: .bold, design: .rounded))
                .foregroundColor(color)
                .fixedSize()
                .offset(y: 14)
            Spacer().frame(height: 0)
        }
        .overlay(
            DiamondShape()
                .fill(filled ? color : Color.clear)
                .overlay(DiamondShape().stroke(color, lineWidth: filled ? 1.2 : 2))
                .frame(width: 18, height: 18)
                .shadow(color: color.opacity(0.35), radius: 3, y: 2)
        )
    }

    private var zoomControls: some View {
        VStack(spacing: 6) {
            Button(action: { zoom = min(zoom * 1.25, 4); zoomAnchor = zoom }) {
                Image(systemName: "plus").font(.system(size: 12, weight: .bold))
            }
            Button(action: { zoom = max(zoom * 0.8, 0.5); zoomAnchor = zoom }) {
                Image(systemName: "minus").font(.system(size: 12, weight: .bold))
            }
            Button(action: { zoom = 1; zoomAnchor = 1; pan = .zero; panAnchor = .zero }) {
                Image(systemName: "arrow.counterclockwise").font(.system(size: 11, weight: .bold))
            }
        }
        .foregroundColor(MapColor.ink)
        .buttonStyle(.plain)
        .padding(8)
        .background(MapColor.cardPaper.opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 6, y: 3)
    }

    // MARK: Filter chips (ported filterRow)

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(label: "All status", active: statusFilter == nil) { statusFilter = nil }
                ForEach(MapStatusKind.allCases, id: \.self) { kind in
                    chip(label: kindLabel(kind), active: statusFilter == kind) {
                        statusFilter = (statusFilter == kind) ? nil : kind
                    }
                }
                if !levels.isEmpty {
                    Rectangle().fill(MapColor.ink.opacity(0.12)).frame(width: 1, height: 18)
                    chip(label: "All levels", active: levelFilter == nil) { levelFilter = nil }
                    ForEach(levels, id: \.self) { lv in
                        chip(label: lv.replacingOccurrences(of: "_", with: " "), active: levelFilter == lv) {
                            levelFilter = (levelFilter == lv) ? nil : lv
                        }
                    }
                }
            }
        }
    }

    private func chip(label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(active ? MapColor.ink.opacity(0.08) : Color.clear)
                )
                .foregroundColor(active ? MapColor.ink : MapColor.inkSoft.opacity(0.6))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(active ? MapColor.ink.opacity(0.35) : MapColor.ink.opacity(0.12), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: Legend + coverage (ported bottom legend)

    private var legendRow: some View {
        HStack {
            HStack(spacing: 10) {
                ForEach(MapStatusKind.allCases, id: \.self) { kind in
                    HStack(spacing: 4) {
                        Circle().fill(kindColor(kind)).frame(width: 7, height: 7)
                        Text(legendLabel(kind))
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundColor(MapColor.inkSoft.opacity(0.75))
                    }
                }
                // The one real distinction this pass adds: "untouched" used
                // to be a single gray bucket. Now the ZPD-ready subset (every
                // prerequisite already mastered) gets its own glowing color -
                // the honest answer to "which one do I click next."
                HStack(spacing: 4) {
                    Circle().fill(MapColor.zpdReady).frame(width: 7, height: 7)
                    Text("Ready to learn")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundColor(MapColor.inkSoft.opacity(0.75))
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 6) {
                    Text("Coverage").font(.system(size: 10, design: .rounded)).foregroundColor(MapColor.inkSoft.opacity(0.6))
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(MapColor.ink.opacity(0.08))
                            Capsule().fill(MapColor.mastered).frame(width: g.size.width * CGFloat(coveragePct) / 100)
                        }
                    }
                    .frame(width: 70, height: 5)
                }
                Text("\(stats.stable) of \(stats.total) stable")
                    .font(.system(size: 9, design: .rounded))
                    .foregroundColor(MapColor.inkSoft.opacity(0.55))
            }
        }
    }

    // MARK: Detail / Route panel (ported panel modes)

    @ViewBuilder
    private func detailOrRoutePanel(for id: String) -> some View {
        if showingRoute {
            routePanel(for: id)
        } else {
            detailPanel(for: id)
        }
    }

    private func detailPanel(for id: String) -> some View {
        guard let node = nodes.first(where: { $0.id == id }) else { return AnyView(EmptyView()) }
        let kind = statusKind(node.status)
        let masteryPct = Int((min(1, max(0, node.mastery ?? 0)) * 100).rounded())

        return AnyView(
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    HStack(spacing: 6) {
                        Circle().fill(kindColor(kind)).frame(width: 8, height: 8)
                        Text(kindLabel(kind))
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(kindColor(kind))
                    }
                    Spacer()
                    Button(action: { selectedId = nil }) {
                        Image(systemName: "xmark.circle.fill").foregroundColor(MapColor.inkSoft.opacity(0.4))
                    }
                    .buttonStyle(.plain)
                }

                Text(label(for: id))
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(MapColor.ink)

                if let blurb = conceptDisplays[id]?.blurb, !blurb.isEmpty {
                    Text(blurb)
                        .font(.system(size: 12, design: .rounded))
                        .foregroundColor(MapColor.inkSoft.opacity(0.75))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("HOW SOLID").font(.system(size: 10, weight: .semibold, design: .monospaced)).foregroundColor(MapColor.inkSoft.opacity(0.5))
                    HStack(spacing: 8) {
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Capsule().fill(MapColor.ink.opacity(0.08))
                                Capsule().fill(kindColor(kind)).frame(width: g.size.width * CGFloat(masteryPct) / 100)
                            }
                        }.frame(height: 6)
                        Text("\(masteryPct)%").font(.system(size: 11, weight: .semibold, design: .rounded)).foregroundColor(MapColor.inkSoft)
                    }
                }

                HStack(spacing: 8) {
                    Button(action: { onOpenConcept(id) }) {
                        Text("Open lesson \u{2192}").font(.system(size: 13, weight: .semibold, design: .rounded)).frame(maxWidth: .infinity).padding(.vertical, 9)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(kindColor(kind))

                    Button(action: { Task { await loadRoute(for: id) } }) {
                        Text("See path").font(.system(size: 13, weight: .medium, design: .rounded)).frame(maxWidth: .infinity).padding(.vertical, 9)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("mapSeePath")
                }
                Button(action: { onQuickPractice(id) }) {
                    Text("Quick practice").font(.system(size: 13, weight: .medium, design: .rounded)).frame(maxWidth: .infinity).padding(.vertical, 9)
                }
                .buttonStyle(.bordered)
            }
            .padding(14)
            .mapCard(accent: kindColor(kind))
        )
    }

    private func routePanel(for targetId: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Button(action: {
                    revealTask?.cancel()
                    pathRevealCount = 0
                    showingRoute = false
                }) {
                    Label("Back", systemImage: "chevron.left").font(.system(size: 12, weight: .semibold, design: .rounded))
                }
                .buttonStyle(.plain)
                Spacer()
                Text("Your Next Route").font(.system(size: 14, weight: .bold, design: .rounded)).foregroundColor(MapColor.ink)
                Spacer()
                Color.clear.frame(width: 40)
            }

            if routeLoading {
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Building your path\u{2026}").font(.system(size: 12, design: .rounded)).foregroundColor(MapColor.inkSoft)
                }
            } else if let steps = routeSteps, !steps.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(steps.enumerated()), id: \.element.id) { i, step in
                        HStack(spacing: 10) {
                            Text("\(i + 1)")
                                .font(.system(size: 11, weight: .heavy, design: .rounded))
                                .frame(width: 20, height: 20)
                                // Two solid fills, not an opacity wash - a
                                // low-alpha `ink` over a light paper card
                                // would leave the white numeral unreadable
                                // (that trick only worked on the old dark
                                // theme, where `ink` was near-white).
                                .background(step.isTarget ? MapColor.ink : MapColor.violetDeep)
                                .foregroundColor(.white)
                                .clipShape(Circle())
                            VStack(alignment: .leading, spacing: 1) {
                                Text(label(for: step.conceptId))
                                    .font(.system(size: 13, weight: step.isTarget ? .bold : .medium, design: .rounded))
                                    .foregroundColor(MapColor.ink)
                                Text(step.reason)
                                    .font(.system(size: 11, design: .rounded))
                                    .foregroundColor(MapColor.inkSoft.opacity(0.7))
                            }
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                }
                Button(action: { onOpenConcept(steps.first?.conceptId ?? targetId) }) {
                    Text("Open \(label(for: steps.first?.conceptId ?? targetId)) \u{2192}")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
            } else {
                Text("Route unavailable - the ML service may be warming up. Try again in a moment.")
                    .font(.system(size: 12, design: .rounded))
                    .foregroundColor(MapColor.inkSoft)
            }
        }
        .padding(14)
        .mapCard(accent: MapColor.zpdReady)
    }

    private func loadRoute(for id: String) async {
        revealTask?.cancel()
        pathRevealCount = 0
        showingRoute = true
        routeLoading = true
        routeSteps = await RouteClient.plotRoute(targetConceptId: id)
        routeLoading = false
        guard let steps = routeSteps, !steps.isEmpty else { return }
        revealTask = Task { @MainActor in
            for i in 0...steps.count {
                if Task.isCancelled { return }
                withAnimation(.easeOut(duration: 0.45)) { pathRevealCount = i }
                try? await Task.sleep(nanoseconds: 260_000_000)
            }
        }
    }

    /// Index of a concept within the currently-loading/loaded route, if any
    /// - drives both the canvas trail and each node's individual reveal.
    private func routeStepIndex(for id: String) -> Int? {
        guard showingRoute, let steps = routeSteps else { return nil }
        return steps.firstIndex { $0.conceptId == id }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Text("Your map is still empty")
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .foregroundColor(MapColor.ink)
            Text("Once you've practiced a few concepts, they'll show up here as a real map of what connects to what.")
                .font(.system(size: 13, design: .rounded))
                .foregroundColor(MapColor.inkSoft.opacity(0.72))
                .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 40)
    }
}

private struct DiamondShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        p.closeSubpath()
        return p
    }
}

// Light-lavender redesign (2026-08-21). Historical note, kept for context -
// this view ports `ConstellationGpsExplorer.tsx`, which imported BOTH
// `ConstellationGpsLab.module.css` (its own near-black/lime "constellation"
// theme - #050505 canvas, #e8eaed text) AND `DashboardPanels.module.css`
// (cream/dark-green chalkboard tokens) for shared panel chrome - the web
// original was already two clashing token sets, and the ported Swift 4-token
// model picked the constellation-specific (dark) values since the canvas is
// the dominant visual.
//
// That dark/glassmorphism direction is retired as of tonight. Diagnosed
// alongside a real, live complaint ("looks like horror"): a stray hardcoded
// `Color.purple` edge, `#00875a`/`#4361ee`/`#d63e3e`/`#9aabb6` web status
// colors that matched nothing else in this app, `.ultraThinMaterial`
// glassmorphism, and zero visual transition into the bright
// `Color(white: 0.985)` card this view actually renders inside from
// `DeskGridDashboardView` (`viewingKnowledgeGraphInBinder`). Two competing
// directions were on the table (a dark cinematic "Deep Field" treatment vs.
// this light Binder-embedded one) - explicit, final call after seeing both:
// "definitely a light lavender map with beautiful dots and beautiful
// connections. Make it look even 3D if possible."
//
// Rebuilt on tokens this app already uses for real elsewhere (confirmed hex
// values from `DeskGridDashboardView`'s `tileInnerCard`/`KnowledgeGraphCanvas`,
// not invented from scratch): warm cream canvas, lavender as the primary
// conceptual/edge color family, and the SAME mastered/learning/gap status
// colors `KnowledgeGraphCanvas` already uses - so the small in-tile preview
// and this full interactive map finally agree with each other. File-scoped
// (not shared) to avoid a redeclaration conflict, same pattern already
// established across these files.
private enum MapColor {
    static let ink = Color(mapHex: "143a2e")
    // Dark-on-light needs a higher opacity floor than the old theme's
    // light-on-near-black did to stay legible at the same relative
    // "soft" call sites throughout this file (chained `.opacity(_:)`
    // multiplies) - raised from that theme's 0.72 accordingly.
    static let inkSoft = ink.opacity(0.85)
    static let canvasBg = Color(mapHex: "fff8e9")
    static let cardPaper = Color(white: 0.985)
    // Lavender family - the map's real primary conceptual color per the
    // product ask, not an invented accent.
    static let lavender = Color(mapHex: "b19cd9")
    static let lavenderSoft = Color(mapHex: "b7aed6")
    static let violetDeep = Color(mapHex: "5b3e8f")
    // Status colors - identical hex values to `KnowledgeGraphCanvas`'s
    // already-approved mastered/in_progress/struggling palette, reused
    // rather than reinvented.
    static let mastered = Color(mapHex: "3fae5a")
    static let learning = Color(mapHex: "d9a441")
    static let gap = Color(mapHex: "c1121f")
    // ZPD-ready invitation glow: the app's own lime "go" accent (`c4f547`,
    // the same color real CTA capsules use throughout `DeskGridDashboardView`),
    // and the muted taupe (`8a8478`, also already real in this app) a
    // genuinely locked node recedes into.
    static let zpdReady = Color(mapHex: "c4f547")
    static let zpdLocked = Color(mapHex: "8a8478")
}

private extension View {
    /// Warm paper card: the same near-white fill + soft shadow
    /// `DeskGridDashboardView.tileInnerCard` uses everywhere else in this
    /// app, with a thin accent-tinted border for per-panel identity -
    /// replaces the old dark `.ultraThinMaterial` glassmorphism treatment
    /// entirely (removed, not merely retinted, per the redesign above).
    func mapCard(accent: Color) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(MapColor.cardPaper)
                    .shadow(color: .black.opacity(0.08), radius: 10, y: 5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(accent.opacity(0.35), lineWidth: 1.2)
            )
    }
}

private extension Color {
    init(mapHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
