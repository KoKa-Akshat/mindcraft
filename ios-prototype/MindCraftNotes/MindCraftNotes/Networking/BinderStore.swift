import Foundation
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage

/// One saved item in a student's Binder — Memo / Doc / BYOB. Mirrors the
/// `binder_items` Firestore schema documented on the firestore.rules match
/// block: `studentId`/`type`/`title`/`body`/`source`/`storageRefs`/
/// `createdAt`/`updatedAt`. "Books" (the ACT map / concept-story library) is
/// read-only reference content and never appears here.
struct BinderItem: Identifiable, Equatable {
    let id: String
    var type: String
    var title: String
    var body: String
    var source: String
    var storageRefs: [String]
    var createdAt: Date
    var updatedAt: Date
}

enum BinderStoreError: Error {
    case notSignedIn
}

/// Real-time mirror of the top-level `binder_items` Firestore collection,
/// filtered to the signed-in student — the durable backing store for the
/// Binder's Memo / Doc / BYOB tabs in `worlds/deskweb/desk.html` (loaded via
/// `StandaloneDeskView`). Same auth-state-driven listener lifecycle as
/// `FirestoreStudentStore` / `SessionNotesClient` (deliberately independent
/// of both, for the same reason those two document on themselves).
///
/// **Resilience**: a write that fails (offline, etc.) is queued into a small
/// UserDefaults-backed pending list (matching `CustomInstanceStore`'s local
/// persistence pattern) and retried the next time this store subscribes —
/// i.e. next sign-in or next launch. This is the fix for the underlying bug
/// this feature replaces: the old note composer's `/api/marketing-note`
/// fetch failed silently with no retry path at all.
@MainActor
final class BinderStore: ObservableObject {
    @Published private(set) var items: [BinderItem] = []

    private let db = Firestore.firestore()
    private lazy var storage = Storage.storage()
    private var itemsListener: ListenerRegistration?
    private var authStateHandle: NSObjectProtocol?
    private var currentUid: String?

    init() {
        // Same guard as FirestoreStudentStore.init() / SessionNotesClient.init()
        // — Auth.auth() crashes without a configured default FirebaseApp.
        guard FirebaseBootstrap.isConfigured else { return }
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.subscribe(to: user)
        }
    }

    deinit {
        itemsListener?.remove()
        if let authStateHandle {
            Auth.auth().removeStateDidChangeListener(authStateHandle)
        }
    }

    private func subscribe(to user: User?) {
        itemsListener?.remove()
        itemsListener = nil
        items = []
        currentUid = user?.uid
        guard let user else { return }

        itemsListener = db.collection("binder_items")
            .whereField("studentId", isEqualTo: user.uid)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self, let snapshot else { return }
                self.items = snapshot.documents
                    .compactMap(Self.decode)
                    .sorted { $0.createdAt > $1.createdAt }
            }

        flushPendingWrites(for: user.uid)
    }

    private static func decode(_ doc: QueryDocumentSnapshot) -> BinderItem? {
        let data = doc.data()
        guard let type = data["type"] as? String else { return nil }
        return BinderItem(
            id: doc.documentID,
            type: type,
            title: data["title"] as? String ?? "",
            body: data["body"] as? String ?? "",
            source: data["source"] as? String ?? "manual",
            storageRefs: data["storageRefs"] as? [String] ?? [],
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue() ?? Date(),
            updatedAt: (data["updatedAt"] as? Timestamp)?.dateValue() ?? Date()
        )
    }

    // MARK: - Create / update

    @discardableResult
    func addMemo(title: String, body: String, source: String = "manual") -> String {
        create(type: "memo", title: title, body: body, source: source, storageRefs: [])
    }

    @discardableResult
    func addDoc(title: String, body: String, source: String) -> String {
        create(type: "doc", title: title, body: body, source: source, storageRefs: [])
    }

    /// Uploads each local file to Storage at `binder/{studentId}/{itemId}/{filename}`,
    /// then writes the `binder_items` doc with `type: "byob"`,
    /// `source: "upload"`. A single file failing to upload doesn't drop the
    /// whole book — the record is still created with whichever files made it.
    func addByob(title: String, body: String, fileURLs: [URL]) async -> Result<String, Error> {
        guard let uid = currentUid ?? Auth.auth().currentUser?.uid else {
            return .failure(BinderStoreError.notSignedIn)
        }
        let itemId = db.collection("binder_items").document().documentID
        var refs: [String] = []
        for url in fileURLs {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else { continue }
            let path = "binder/\(uid)/\(itemId)/\(url.lastPathComponent)"
            let ref = storage.reference(withPath: path)
            do {
                _ = try await ref.putDataAsync(data)
                refs.append(path)
            } catch {
                continue
            }
        }
        let payload: [String: Any] = [
            "studentId": uid,
            "type": "byob",
            "title": title,
            "body": body,
            "source": "upload",
            "storageRefs": refs,
            "createdAt": FieldValue.serverTimestamp(),
            "updatedAt": FieldValue.serverTimestamp(),
        ]
        do {
            try await db.collection("binder_items").document(itemId).setData(payload)
            return .success(itemId)
        } catch {
            queuePendingWrite(id: itemId, studentId: uid, type: "byob", title: title, body: body, source: "upload", storageRefs: refs)
            return .failure(error)
        }
    }

    /// Update an existing item's title/body in place (used when a Doc/
    /// Presentation tile is edited after its initial save). Same
    /// failure-queues-locally contract as `create`/`addByob` — a failed edit
    /// must not vanish silently, that's the exact bug this store replaces.
    /// The retry re-`setData`s the full record (not a merge), which is safe
    /// here since `flushPendingWrites` only ever runs for a doc id this
    /// device already created or successfully fetched into `items`.
    func update(id: String, title: String, body: String) {
        guard let existing = items.first(where: { $0.id == id }),
              let uid = currentUid ?? Auth.auth().currentUser?.uid else {
            db.collection("binder_items").document(id).setData([
                "title": title,
                "body": body,
                "updatedAt": FieldValue.serverTimestamp(),
            ], merge: true)
            return
        }
        db.collection("binder_items").document(id).setData([
            "title": title,
            "body": body,
            "updatedAt": FieldValue.serverTimestamp(),
        ], merge: true) { [weak self] error in
            guard let self, let error else { return }
            print("BinderStore: update failed, queued locally - \(error)")
            self.queuePendingWrite(
                id: id, studentId: uid, type: existing.type, title: title,
                body: body, source: existing.source, storageRefs: existing.storageRefs,
                createdAt: existing.createdAt
            )
        }
    }

    func delete(_ id: String) {
        db.collection("binder_items").document(id).delete()
    }

    @discardableResult
    private func create(type: String, title: String, body: String, source: String, storageRefs: [String]) -> String {
        guard let uid = currentUid ?? Auth.auth().currentUser?.uid else { return "" }
        let itemId = db.collection("binder_items").document().documentID
        let payload: [String: Any] = [
            "studentId": uid,
            "type": type,
            "title": title,
            "body": body,
            "source": source,
            "storageRefs": storageRefs,
            "createdAt": FieldValue.serverTimestamp(),
            "updatedAt": FieldValue.serverTimestamp(),
        ]
        db.collection("binder_items").document(itemId).setData(payload) { [weak self] error in
            guard let self, let error else { return }
            print("BinderStore: create failed, queued locally - \(error)")
            self.queuePendingWrite(id: itemId, studentId: uid, type: type, title: title, body: body, source: source, storageRefs: storageRefs)
        }
        return itemId
    }

    // MARK: - Web bridge entry point

    /// One entry point for the `desk.html` `deskAction` bridge's
    /// `binderSave` message (`{type, title, body, source, id?, clientId?}`).
    /// - If `id` is present, updates that existing item.
    /// - Otherwise creates a new item and returns its freshly-minted id so
    ///   the caller can resolve the web side's `clientId` back to it.
    @discardableResult
    func handleBridgeSave(type: String, title: String, body: String, source: String, id: String?) -> String {
        if let id, !id.isEmpty {
            update(id: id, title: title, body: body)
            return id
        }
        return create(type: type, title: title, body: body, source: source, storageRefs: [])
    }

    // MARK: - Pending-write queue (resilience)

    private static let pendingKey = "binderStore.pendingWrites"

    private struct PendingWrite: Codable {
        let localId: String
        let studentId: String
        let type: String
        let title: String
        let body: String
        let source: String
        let storageRefs: [String]
        let createdAt: Date
    }

    /// `createdAt` defaults to now (correct for a fresh `create`/`addByob`
    /// failure). `update()`'s retry passes the item's TRUE original
    /// `createdAt` explicitly — otherwise a queued edit-retry would silently
    /// overwrite a real item's creation date with the retry time once
    /// `flushPendingWrites` replays it.
    private func queuePendingWrite(id: String, studentId: String, type: String, title: String, body: String, source: String, storageRefs: [String], createdAt: Date = Date()) {
        var pending = Self.loadPending()
        pending.removeAll { $0.localId == id }
        pending.append(PendingWrite(localId: id, studentId: studentId, type: type, title: title, body: body, source: source, storageRefs: storageRefs, createdAt: createdAt))
        Self.savePending(pending)
    }

    private func removePendingWrite(localId: String) {
        var pending = Self.loadPending()
        pending.removeAll { $0.localId == localId }
        Self.savePending(pending)
    }

    private static func loadPending() -> [PendingWrite] {
        guard let data = UserDefaults.standard.data(forKey: pendingKey),
              let decoded = try? JSONDecoder().decode([PendingWrite].self, from: data) else { return [] }
        return decoded
    }

    private static func savePending(_ items: [PendingWrite]) {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: pendingKey)
        }
    }

    /// Retries anything left over from a failed write, scoped to the
    /// now-signed-in student (a pending item from a different account on a
    /// shared device is never flushed under the wrong uid). Reuses the same
    /// client-generated doc id from the original attempt so a retry can
    /// never create a duplicate.
    private func flushPendingWrites(for uid: String) {
        let pending = Self.loadPending().filter { $0.studentId == uid }
        guard !pending.isEmpty else { return }
        for write in pending {
            let payload: [String: Any] = [
                "studentId": write.studentId,
                "type": write.type,
                "title": write.title,
                "body": write.body,
                "source": write.source,
                "storageRefs": write.storageRefs,
                "createdAt": Timestamp(date: write.createdAt),
                "updatedAt": FieldValue.serverTimestamp(),
            ]
            db.collection("binder_items").document(write.localId).setData(payload) { [weak self] error in
                guard let self, error == nil else { return }
                self.removePendingWrite(localId: write.localId)
            }
        }
    }
}
