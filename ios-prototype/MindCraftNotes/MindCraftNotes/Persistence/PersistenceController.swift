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

        container.loadPersistentStores { [container] _, error in
            guard let error = error as NSError? else { return }
            // A disk-full or corrupted on-disk store must not be an
            // unrecoverable launch crash for a shipping app - log loudly,
            // then fall back to an in-memory store so the app still opens.
            // A student losing local drawing history on a rare
            // corrupt-store event is far better than the app being
            // permanently unable to launch on that device.
            print("PersistenceController: Core Data failed to load persistent store, falling back to in-memory store: \(error), \(error.userInfo)")
            let fallbackDescription = NSPersistentStoreDescription()
            fallbackDescription.url = URL(fileURLWithPath: "/dev/null")
            container.persistentStoreDescriptions = [fallbackDescription]
            container.loadPersistentStores { _, fallbackError in
                if let fallbackError = fallbackError as NSError? {
                    print("PersistenceController: in-memory fallback store also failed to load: \(fallbackError), \(fallbackError.userInfo)")
                }
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }
}
