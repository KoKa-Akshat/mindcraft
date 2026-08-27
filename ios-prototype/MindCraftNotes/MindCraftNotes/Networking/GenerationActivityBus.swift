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

@MainActor
final class GenerationActivityBus: ObservableObject {
    static let shared = GenerationActivityBus()

    @Published private(set) var activity: [String: GenerationPhase] = [:]
    private var clearTasks: [String: Task<Void, Never>] = [:]

    private init() {}

    func setRunning(_ phase: String, for conceptId: String) {
        clearTasks[conceptId]?.cancel()
        clearTasks[conceptId] = nil
        activity[conceptId] = .running(phase)
    }

    /// A transient flash, not a permanent state change - the node's real
    /// state (mastery, eventCount) takes over once the student actually
    /// opens what just generated. Self-clears after a few seconds so a
    /// forgotten/abandoned generation doesn't leave a node lit forever.
    func markReady(_ conceptId: String) {
        clearTasks[conceptId]?.cancel()
        activity[conceptId] = .ready
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
}
