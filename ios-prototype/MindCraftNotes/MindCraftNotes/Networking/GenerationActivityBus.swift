import Foundation

/// Shared "is anything generating right now, and for which concept"
/// signal (2026-08-27) - same singleton-`ObservedObject` shape as
/// `DeskBoxBus`, so any view that already knows how to subscribe to that
/// one knows how to subscribe to this one. Written to by generation
/// clients/stores that already know the real concept id they're working on
/// (see `GeneratedPracticeStore`); read by `KnowledgeMapView` to pop a node
/// into a lit ring the moment its content is ready. Neither
/// `generate-sim.ts` nor `generate-book.ts` ever echoes a concept id back
/// on a running poll (confirmed by reading both handlers) - only the
/// caller knows what it asked for, so this bus is told directly rather
/// than parsed out of a server response.
enum GenerationPhase: Equatable {
    case running(String)
    case ready
}

/// One row in the human-readable activity feed (2026-08-27, explicit ask:
/// "I don't see a transcript of what's what's how's knowledge moving, what's
/// happening here... how's knowledge being generated, API calls, like a
/// little transcript showing summaries of what's happening... as these
/// independent neurons fire up"). Separate from `activity` above on
/// purpose: `activity` only ever keys on a REAL Knowledge Map concept id
/// (map-lighting needs one to know which node to light), but sim/book
/// generation elsewhere in the app (JesseCallSession, DesignStudioView,
/// CreateBookView, ArchiveWorkflowView) only ever has a freeform `topic`
/// string, never guaranteed to be a real ontology id - Phase 1's own doc
/// comment flagged this as the reason those call sites weren't wired to
/// `activity` at all. The log doesn't have that constraint: it's fine to
/// say "Generating: photosynthesis" even when nothing lights up on the Map.
struct ActivityLogEntry: Identifiable, Equatable {
    let id: String
    let title: String
    let status: Status
    let date: Date

    enum Status: Equatable {
        case running(String)
        case ready
        case failed(String)
    }
}

@MainActor
final class GenerationActivityBus: ObservableObject {
    static let shared = GenerationActivityBus()

    @Published private(set) var activity: [String: GenerationPhase] = [:]
    @Published private(set) var log: [ActivityLogEntry] = []
    private var clearTasks: [String: Task<Void, Never>] = [:]
    private static let maxLogEntries = 12

    private init() {}

    func setRunning(_ phase: String, for conceptId: String) {
        clearTasks[conceptId]?.cancel()
        clearTasks[conceptId] = nil
        activity[conceptId] = .running(phase)
        upsertLog(id: conceptId, title: humanized(conceptId), status: .running(phase))
    }

    /// A transient flash, not a permanent state change - the node's real
    /// state (mastery, eventCount) takes over once the student actually
    /// opens what just generated. Self-clears after a few seconds so a
    /// forgotten/abandoned generation doesn't leave a node lit forever.
    /// (The LOG entry is not cleared with it - a finished feed row is
    /// still useful to read after the map's own flash has faded; it only
    /// scrolls off once maxLogEntries pushes it out.)
    func markReady(_ conceptId: String) {
        clearTasks[conceptId]?.cancel()
        activity[conceptId] = .ready
        upsertLog(id: conceptId, title: humanized(conceptId), status: .ready)
        clearTasks[conceptId] = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled else { return }
            self?.activity[conceptId] = nil
            self?.clearTasks[conceptId] = nil
        }
    }

    func clear(_ conceptId: String) {
        clearTasks[conceptId]?.cancel()
        clearTasks[conceptId] = nil
        activity[conceptId] = nil
    }

    /// Log-only start for a topic-string generation (sim/book) that can't
    /// drive map-lighting - see this type's own doc comment. `id` should be
    /// stable across the start/finish/fail trio for one attempt (a UUID
    /// string minted by the caller) so `finish`/`fail` replace the right row
    /// instead of appending a duplicate.
    func logStart(id: String, title: String, phase: String) {
        upsertLog(id: id, title: title, status: .running(phase))
    }

    func logFinish(id: String, title: String) {
        upsertLog(id: id, title: title, status: .ready)
    }

    func logFail(id: String, title: String, reason: String) {
        upsertLog(id: id, title: title, status: .failed(reason))
    }

    private func upsertLog(id: String, title: String, status: ActivityLogEntry.Status) {
        log.removeAll { $0.id == id }
        log.insert(ActivityLogEntry(id: id, title: title, status: status, date: Date()), at: 0)
        if log.count > Self.maxLogEntries {
            log.removeLast(log.count - Self.maxLogEntries)
        }
    }

    /// GeneratedPracticeStore only has a raw concept slug on hand, not the
    /// concept's real display label (no shared id->label lookup exists in
    /// this app today) - "linear_equations" -> "Linear equations" is a
    /// readable fallback, not a claim of being the canonical label.
    private func humanized(_ conceptId: String) -> String {
        conceptId.replacingOccurrences(of: "_", with: " ").prefix(1).uppercased()
            + conceptId.replacingOccurrences(of: "_", with: " ").dropFirst()
    }
}
