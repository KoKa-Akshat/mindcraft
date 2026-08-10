import CoreData
import PencilKit

/// Loads and incrementally persists one PKDrawing per question.
///
/// Two things matter here per the prototype's persistence requirement:
///
/// 1. Incremental, not just on-close: `scheduleSave` is called from the
///    PKCanvasViewDelegate drawing-changed callback (see CanvasView), so a
///    crash or force quit loses at most the last debounce window of work,
///    not the whole session.
/// 2. Off the main thread: every read and write here runs inside a Core
///    Data background context (`newBackgroundContext()` + `perform`), never
///    on the view context tied to the main thread. Encoding a PKDrawing to
///    Data and writing it to disk is exactly the kind of "additional
///    processing beyond what PKCanvasView gives for free" the prototype
///    brief calls out as needing to stay off the UI thread.
///
/// The debounce (0.4s) exists so a fast flurry of pen strokes does not
/// become one synchronous Core Data save per delegate callback. Each new
/// stroke cancels the pending save and reschedules it; `saveNow` bypasses
/// the debounce for the moments that must not lose work (backgrounding,
/// switching questions).
@MainActor
final class DrawingStore: ObservableObject {
    private let container: NSPersistentContainer
    private var saveTask: Task<Void, Never>?
    private let debounceNanoseconds: UInt64 = 400_000_000 // 0.4s

    init(container: NSPersistentContainer = PersistenceController.shared.container) {
        self.container = container
    }

    /// Loads the saved drawing for a question, or an empty drawing if none
    /// exists yet. Runs entirely on a background context.
    func loadDrawing(for questionId: String) async -> PKDrawing {
        let backgroundContext = container.newBackgroundContext()
        return await backgroundContext.perform {
            let request = QuestionDrawing.fetchRequest()
            request.predicate = NSPredicate(format: "questionId == %@", questionId)
            request.fetchLimit = 1

            guard
                let match = try? backgroundContext.fetch(request).first,
                let data = match.drawingData
            else {
                return PKDrawing()
            }
            return (try? PKDrawing(data: data)) ?? PKDrawing()
        }
    }

    /// Debounced incremental save. Safe to call on every drawing-changed
    /// delegate callback.
    func scheduleSave(drawing: PKDrawing, for questionId: String) {
        saveTask?.cancel()
        saveTask = Task { [debounceNanoseconds] in
            try? await Task.sleep(nanoseconds: debounceNanoseconds)
            if Task.isCancelled { return }
            await self.persist(drawing: drawing, questionId: questionId)
        }
    }

    /// Immediate save, bypassing the debounce. Call this whenever the
    /// student navigates away from a question so work in the debounce
    /// window is never silently dropped.
    func saveNow(drawing: PKDrawing, for questionId: String) {
        saveTask?.cancel()
        saveTask = nil
        Task {
            await persist(drawing: drawing, questionId: questionId)
        }
    }

    private func persist(drawing: PKDrawing, questionId: String) async {
        // dataRepresentation() and the Core Data write both happen inside
        // the background context's perform block, off the main actor.
        let backgroundContext = container.newBackgroundContext()
        await backgroundContext.perform {
            let data = drawing.dataRepresentation()

            let request = QuestionDrawing.fetchRequest()
            request.predicate = NSPredicate(format: "questionId == %@", questionId)
            request.fetchLimit = 1

            let record = (try? backgroundContext.fetch(request).first) ?? QuestionDrawing(context: backgroundContext)
            record.questionId = questionId
            record.drawingData = data
            record.updatedAt = Date()

            do {
                try backgroundContext.save()
            } catch {
                // Prototype-level logging only. A shipped build would
                // route this to real telemetry and a retry policy.
                print("DrawingStore: save failed for \(questionId): \(error)")
            }
        }
    }
}
