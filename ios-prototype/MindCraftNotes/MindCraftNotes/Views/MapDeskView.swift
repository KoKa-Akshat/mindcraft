import SwiftUI

/// The new boot destination (2026-08-26, explicit ask: "in the main ios
/// dashboard we can show the knowledge graph... bring the map to dash").
/// Same real `KnowledgeMapView` the grid dashboard already embeds and
/// `ConstellationView` already gives the whole phone screen to - not a new
/// visualization, just a new call site: full-tab `embedded: false`, same
/// dark "Gurukul" stage `ConstellationView` already established ("a lit
/// instrument panel on a dark stage is a real, intentional look").
///
/// Owns its own `KnowledgeGraphClient` (matches `DeskGridDashboardView`'s
/// own ownership shape, not `ConstellationView`'s injected-from-FieldDeskView
/// one - this is iPad's own top-level destination, doesn't need to share
/// phone's client).
///
/// Dock is deliberately small: Binder/Calendar/Gmail are real, independent
/// `FieldDeskOverlay` members today, so they open directly, layered on top
/// of this view exactly like they already layer on top of
/// `.deskGridDashboard`. Memo and Flows are NOT independent overlays -
/// they're rails inside `DeskGridDashboardView` itself
/// (`dashboardStartRail`) - so rather than faking direct access to them
/// here, the dock's "Tiles" item reopens the grid dashboard (the previous
/// boot destination, demoted to a menu item, same shape as Jesse's Kitchen's
/// own hub being demoted to "The Desk · Manage" on 2026-08-15), where Memo/
/// Flows/Homework/Friends/Archive/Settings/etc. already all live in one
/// coherent place.
struct MapDeskView: View {
    var onOpenBinder: () -> Void
    var onOpenCalendar: () -> Void
    var onOpenGmail: () -> Void
    var onOpenTiles: () -> Void
    var onOpenConcept: (String) -> Void

    @StateObject private var knowledgeGraphClient = KnowledgeGraphClient()
    private let conceptDisplays: [String: ConceptDisplay] = TocDataLoader.loadConceptDisplays()

    // Same dark palette as ConstellationView/StudyCompanionView's Gurukul
    // stage - kept in sync deliberately, not re-derived, so "the map" looks
    // like the same place everywhere it shows up in this app.
    private let stageInk = Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255)
    private let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)
    private let cream = Color(red: 255 / 255, green: 248 / 255, blue: 233 / 255)

    var body: some View {
        ZStack {
            ZStack {
                stageInk.ignoresSafeArea()
                RadialGradient(
                    colors: [Color(red: 26 / 255, green: 36 / 255, blue: 16 / 255).opacity(0.9), stageInk],
                    center: .center, startRadius: 40, endRadius: 520
                )
                .ignoresSafeArea()
            }

            if knowledgeGraphClient.nodes.isEmpty {
                VStack(spacing: 10) {
                    if knowledgeGraphClient.isLoading {
                        ProgressView().tint(cream)
                    }
                    Text(knowledgeGraphClient.isLoading
                         ? "Loading your knowledge map…"
                         : "No concepts mapped yet - practice something to start filling in the sky.")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(cream.opacity(0.6))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
            } else {
                // Light "paper/instrument" card look stays untouched - see
                // ConstellationView's own doc comment on why that's kept as
                // the shared, deliberate look rather than reworked per call
                // site.
                KnowledgeMapView(
                    nodes: knowledgeGraphClient.nodes,
                    edges: knowledgeGraphClient.edges,
                    studentPoints: knowledgeGraphClient.studentPoints,
                    axisLabels: knowledgeGraphClient.axisLabels,
                    conceptDisplays: conceptDisplays,
                    onOpenConcept: onOpenConcept,
                    onQuickPractice: { _ in },
                    embedded: false
                )
            }
        }
        .overlay(alignment: .bottom) {
            dock
        }
        .task { await knowledgeGraphClient.load() }
        .accessibilityIdentifier("mapDeskView")
    }

    private var dock: some View {
        HStack(spacing: 8) {
            dockChip("Binder", system: "books.vertical.fill", identifier: "mapDeskDock_Binder", action: onOpenBinder)
            dockChip("Calendar", system: "calendar", identifier: "mapDeskDock_Calendar", action: onOpenCalendar)
            dockChip("Gmail", system: "envelope.fill", identifier: "mapDeskDock_Gmail", action: onOpenGmail)
            dockChip("Tiles", system: "square.grid.2x2.fill", identifier: "mapDeskDock_Tiles", action: onOpenTiles)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color.white.opacity(0.94)))
        .padding(.bottom, 16)
        .accessibilityIdentifier("mapDeskDock")
    }

    private func dockChip(_ title: String, system: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: system)
                Text(title)
            }
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundColor(stageInk)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}
