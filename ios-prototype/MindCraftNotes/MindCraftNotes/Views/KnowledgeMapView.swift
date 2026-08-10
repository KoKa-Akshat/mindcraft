import SwiftUI

/// The Dashboard's "Map" tab - ported directly from the real web
/// `ConstellationGpsExplorer.tsx` (2026-07-25 "implement it a to z from the
/// dashboard" pass), not an invented substitute. Uses the SAME real data the
/// web component reads from `GET /knowledge-graph/{uid}`
/// (`ml/serve.py:knowledge_graph_endpoint`): real PCA-projected node
/// positions (`x`/`y`. NOT a synthetic layout), real ontology edges with
/// Beta-Binomial weights, real student mastery/strength embedding points,
/// real PCA axis labels. Ports: the `statusKind`/`KIND_COLOR`/`KIND_LABEL`
/// 4-state palette (distinct from the Home tab's `STATUS_COLOR` - this
/// screen intentionally uses the Map's own real colors, e.g. `#00875a`
/// stable-green), the `isMajorEdge` filter (prerequisite edges >0.25 weight,
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
        case .stable: return Color(mapHex: "00875a")
        case .progress: return Color(mapHex: "4361ee")
        case .needs: return Color(mapHex: "d63e3e")
        case .unknown: return Color(mapHex: "9aabb6")
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
        VStack(alignment: .leading, spacing: 10) {
            Text("Map")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .foregroundColor(MapColor.ink)
                .padding(.horizontal, 20)
                .padding(.top, 8)

            if !nodes.isEmpty {
                filterChips.padding(.horizontal, 20)
            }

            if nodes.isEmpty {
                emptyState.padding(.horizontal, 20)
            } else {
                ZStack(alignment: .topTrailing) {
                    graphCanvas
                        .background(MapColor.canvasBg)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .strokeBorder(MapColor.ink.opacity(0.08), lineWidth: 1)
                        )
                    zoomControls.padding(10)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, 20)

                legendRow.padding(.horizontal, 20)

                if let id = selectedId {
                    detailOrRoutePanel(for: id).padding(.horizontal, 20).padding(.bottom, 4)
                }
            }
        }
        .padding(.bottom, 24)
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
                    for edge in edges where isMajorEdge(edge) {
                        guard
                            let a = bundle.positions[edge.from],
                            let b = bundle.positions[edge.to]
                        else { continue }
                        var path = Path()
                        path.move(to: transformed(screenPoint(a)))
                        path.addLine(to: transformed(screenPoint(b)))
                        let lit = selectedId != nil && (edge.from == selectedId || edge.to == selectedId)
                        context.stroke(
                            path,
                            with: .color(lit ? MapColor.ink.opacity(0.45) : MapColor.ink.opacity(0.1)),
                            lineWidth: lit ? 1.6 : 1
                        )
                    }

                    // Student mastery/strength embedding points - real PCA
                    // projections of "where you've been studying" vs "where
                    // you perform best" (ml/serve.py student_points), a
                    // dashed line between them shows the displacement.
                    if let m = bundle.studentMastery, let st = bundle.studentStrength {
                        var line = Path()
                        line.move(to: transformed(screenPoint(m)))
                        line.addLine(to: transformed(screenPoint(st)))
                        context.stroke(line, with: .color(.purple.opacity(0.5)), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                    }
                }

                if let m = layout.studentMastery {
                    diamondMarker(filled: true, color: Color(mapHex: "4361ee"), label: studentPoints?.mastery.label ?? "")
                        .position(transformed(screenPoint(m)))
                }
                if let st = layout.studentStrength {
                    diamondMarker(filled: false, color: .purple, label: studentPoints?.strength.label ?? "")
                        .position(transformed(screenPoint(st)))
                }

                ForEach(nodes) { node in
                    if let norm = layout.positions[node.id] {
                        let p = transformed(screenPoint(norm))
                        nodeView(node, at: p)
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
    private func nodeView(_ node: KnowledgeGraphNode, at p: CGPoint) -> some View {
        let isSelected = selectedId == node.id
        let hasData = (node.eventCount ?? 0) > 0
        let kind = statusKind(node.status)
        let accent = kindColor(kind)
        let radius: CGFloat = isSelected ? (hasData ? 15 : 12.5) : (hasData ? 11 : 9.5)
        let mastery = min(1, max(0, node.mastery ?? 0))
        let dimmed = !visibleNodeIds.contains(node.id)
        let showLabel = isSelected || (node.eventCount ?? 0) > 3

        ZStack {
            if isSelected {
                Circle().fill(accent.opacity(0.12)).frame(width: (radius + 11) * 2, height: (radius + 11) * 2)
                    .overlay(Circle().stroke(accent.opacity(0.45), lineWidth: 1.5))
            }

            Button(action: {
                if selectedId == node.id {
                    selectedId = nil
                    showingRoute = false
                    routeSteps = nil
                } else {
                    selectedId = node.id
                    showingRoute = false
                    routeSteps = nil
                }
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
            }
            .buttonStyle(.plain)
            .opacity(dimmed ? 0.3 : (hasData ? 1 : 0.62))

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
        .background(.white.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
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
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 6) {
                    Text("Coverage").font(.system(size: 10, design: .rounded)).foregroundColor(MapColor.inkSoft.opacity(0.6))
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(MapColor.ink.opacity(0.08))
                            Capsule().fill(Color(mapHex: "00875a")).frame(width: g.size.width * CGFloat(coveragePct) / 100)
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
                }
                Button(action: { onQuickPractice(id) }) {
                    Text("Quick practice").font(.system(size: 13, weight: .medium, design: .rounded)).frame(maxWidth: .infinity).padding(.vertical, 9)
                }
                .buttonStyle(.bordered)
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(MapColor.cardPaper)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(kindColor(kind).opacity(0.25), lineWidth: 1))
            )
        )
    }

    private func routePanel(for targetId: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Button(action: { showingRoute = false }) {
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
                                .background(step.isTarget ? MapColor.ink : MapColor.ink.opacity(0.3))
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
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(MapColor.cardPaper)
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(MapColor.ink.opacity(0.12), lineWidth: 1))
        )
    }

    private func loadRoute(for id: String) async {
        showingRoute = true
        routeLoading = true
        routeSteps = await RouteClient.plotRoute(targetConceptId: id)
        routeLoading = false
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

// Phase 5 (2026-08-06): the Map tab ports `ConstellationGpsExplorer.tsx`,
// which imports BOTH `ConstellationGpsLab.module.css` (its own near-black/
// lime "constellation" theme - #050505 canvas, #e8eaed text, confirmed via
// the live file, NOT the Dashboard's cream/dark-green chalkboard tokens)
// AND `DashboardPanels.module.css` (whose `--ink-*`/`--paper-*` vars cascade
// from the Dashboard's `.canvasStage`) for shared panel chrome. This 4-token
// Swift model can't represent both exactly; picked the constellation-specific
// values since they're what the map canvas itself (the dominant visual) uses.
// File-scoped (not shared) to avoid a redeclaration conflict, same pattern
// already established across these files.
private enum MapColor {
    static let ink = Color(mapHex: "e8eaed")
    static let inkSoft = Color(mapHex: "e8eaed").opacity(0.72)
    static let cardPaper = Color(mapHex: "162d22")
    static let canvasBg = Color(mapHex: "050505")
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
