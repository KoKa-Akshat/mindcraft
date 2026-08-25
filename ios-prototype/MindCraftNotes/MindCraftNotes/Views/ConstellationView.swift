import SwiftUI

/// Phone's "Continue your work" destination (2026-08-24, explicit ask:
/// "continue your work should show me my knowledge map and also have a
/// Archive button on the bottom left so that i can go see the sims... we
/// dont show dans book we show stars you can click"). Not a new
/// visualization - the same real `KnowledgeMapView` the grid dashboard
/// already embeds (itself ported directly from the web's
/// `ConstellationGpsExplorer.tsx`, see that file's own doc comment), just
/// given the whole phone screen at its native full-tab scale
/// (`embedded: false`, matching `DashboardView`'s own Map tab) instead of
/// the grid's shrunk-down `embedded: true` mode - phone doesn't need to
/// compromise type sizes for a smaller merged container the way the grid
/// dashboard does.
///
/// Owns its own `KnowledgeGraphClient` rather than threading one down
/// from `FieldDeskView` - this is the only phone destination that needs
/// graph data, and every other full-screen destination in this app
/// (ResumeAgentView, DesignStudioView, CreateCanvasView...) already
/// follows the same "own what you need, don't thread state through a
/// parent that doesn't otherwise use it" shape.
struct ConstellationView: View {
    var onClose: () -> Void
    var onOpenArchive: () -> Void
    /// Shared with DeskPhoneDashboardView's Gurukul card (2026-08-24,
    /// explicit ask: "displaying the number of content on Gurukul vs
    /// Dash") - injected from FieldDeskView rather than owned here, so
    /// both places read the exact same load instead of two separate
    /// fetches racing/disagreeing.
    @ObservedObject var knowledgeGraphClient: KnowledgeGraphClient

    private let conceptDisplays: [String: ConceptDisplay] = TocDataLoader.loadConceptDisplays()

    private let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
    private let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)
    private let cream = Color(red: 255 / 255, green: 248 / 255, blue: 233 / 255)

    var body: some View {
        ZStack {
            cream.ignoresSafeArea()

            if knowledgeGraphClient.nodes.isEmpty {
                VStack(spacing: 10) {
                    if knowledgeGraphClient.isLoading {
                        ProgressView()
                    }
                    Text(knowledgeGraphClient.isLoading
                         ? "Loading your knowledge map…"
                         : "No concepts mapped yet - practice something to start filling in the sky.")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(ink.opacity(0.55))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
            } else {
                KnowledgeMapView(
                    nodes: knowledgeGraphClient.nodes,
                    edges: knowledgeGraphClient.edges,
                    studentPoints: knowledgeGraphClient.studentPoints,
                    axisLabels: knowledgeGraphClient.axisLabels,
                    conceptDisplays: conceptDisplays,
                    // Same honest non-destination the grid dashboard's own
                    // embed uses (see its call site's comment) - a real
                    // concept-detail/practice hand-off is a follow-up, not
                    // silently faked here either.
                    onOpenConcept: { _ in },
                    onQuickPractice: { _ in },
                    embedded: false,
                    phoneFullScreen: true
                )
            }
        }
        .overlay(alignment: .bottomTrailing) {
            // Impact-weighted mastery (2026-08-24, explicit ask - see
            // ConceptImpactScore.swift's own doc comment). Bottom-trailing,
            // opposite corner from the Archive button below, so neither
            // collides with KnowledgeMapView's own top chrome (legend/
            // filter chips) or the Done capsule.
            if let weighted = ConceptImpactScore.impactWeightedMastery(
                nodes: knowledgeGraphClient.nodes, edges: knowledgeGraphClient.edges
            ) {
                Text("\(Int((weighted * 100).rounded()))% impact-weighted mastery")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(ink)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color.white))
                    .padding(.bottom, 16)
                    .padding(.trailing, 16)
                    .accessibilityIdentifier("constellationImpactWeightedMastery")
            }
        }
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(ink)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(lime))
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 16)
            .accessibilityIdentifier("constellationDone")
        }
        .overlay(alignment: .bottomLeading) {
            Button(action: onOpenArchive) {
                HStack(spacing: 6) {
                    Image(systemName: "archivebox.fill")
                    Text("Archive")
                }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color.white))
            }
            .buttonStyle(.plain)
            .padding(.bottom, 16)
            .padding(.leading, 16)
            .accessibilityIdentifier("constellationArchive")
        }
        .accessibilityIdentifier("constellationView")
    }
}
