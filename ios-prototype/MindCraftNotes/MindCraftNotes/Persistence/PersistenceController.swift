import CoreData

/// Core Data stack for the prototype.
///
/// Core Data instead of raw SQLite because the data here is structured
/// (one row per question, keyed by questionId, holding a PKDrawing blob
/// plus a timestamp) and NSPersistentContainer already gives incremental,
/// background-safe saves through its background context support. A hand
/// rolled SQLite layer would have to reimplement the same threading and
/// migration safety Core Data already provides, for no real benefit at
/// this scale (three questions, one drawing each).
struct PersistenceController {
    // The UI test target launches with this argument so every test run
    // starts from a known empty store instead of whatever a previous run
    // (or a person poking at the simulator) left on disk. Production runs
    // never pass this argument, so this has no effect outside testing.
    static let shared = PersistenceController(
        inMemory: ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")
    )

    let container: NSPersistentContainer

    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "MindCraftNotes")

        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }

        container.loadPersistentStores { _, error in
            if let error = error as NSError? {
                // A loud crash here is correct for a prototype: silently
                // continuing with no working store would hide data loss
                // instead of surfacing it immediately during development.
                fatalError("Core Data failed to load persistent store: \(error), \(error.userInfo)")
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }
}
