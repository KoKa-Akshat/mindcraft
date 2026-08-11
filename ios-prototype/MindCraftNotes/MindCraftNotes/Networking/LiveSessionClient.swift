import Foundation
import FirebaseAuth
import FirebaseFirestore

/// Real native port of `app/src/lib/liveSession.ts` - the "Call" live
/// co-working data layer (NATIVE_APP_BUILD_PLAN.md "New product surfaces
/// since 2026-07-25" §1). Same Firestore project (`mindcraft-93858`), same
/// collection/field names verbatim, same trust boundary (`firestore.rules`'
/// `liveSessions` block is the real gate - everything here is fail-soft on
/// top of it, same spirit as the web file's own doc comment: a dropped
/// write must never throw into the caller for a nice-to-have collaboration
/// feature). No WebRTC, no new backend - pure Firestore reads/writes, the
/// same SDK `FirestoreStudentStore`/`KnowledgeGraphClient` already use.
enum LiveSessionContextType: String {
    case question, weekly_paper, worksheet
}

enum LiveSessionAuthorRole: String {
    case student, tutor, parent
}

enum LiveSessionStatus: String {
    case active, ended
}

struct LiveSessionEntry: Identifiable, Equatable {
    let id: String
    let studentId: String
    let tutorId: String?
    let contextType: LiveSessionContextType
    let conceptId: String?
    let conceptName: String?
    let questionText: String?
    let status: LiveSessionStatus
    let createdAt: Date?
    let lastActivityAt: Date?
    let endedAt: Date?
}

/// Firestore's wire format for one ink point - flat `{x,y,p}` objects, NOT
/// `[x,y,p]` tuples. Real constraint ported from `liveSession.ts`'s own doc
/// comment: "Firestore rejects arrays whose elements are themselves arrays
/// ('Nested arrays are not supported')" - confirmed there against the
/// emulator, not a guess; `points: [[Double]]` (an array of point-tuples)
/// would hit exactly that error, so every point is written as a small dict.
struct LiveStrokePoint: Equatable {
    let x: Double
    let y: Double
    let p: Double

    var firestoreDict: [String: Any] { ["x": x, "y": y, "p": p] }

    static func from(_ raw: Any) -> LiveStrokePoint? {
        guard let dict = raw as? [String: Any] else { return nil }
        return LiveStrokePoint(
            x: (dict["x"] as? NSNumber)?.doubleValue ?? 0,
            y: (dict["y"] as? NSNumber)?.doubleValue ?? 0,
            p: (dict["p"] as? NSNumber)?.doubleValue ?? 0
        )
    }
}

struct LiveStrokeEntry: Identifiable, Equatable {
    let id: String
    let authorId: String
    let authorRole: LiveSessionAuthorRole
    let points: [LiveStrokePoint]
}

enum LiveSessionClient {
    private static let db = Firestore.firestore()
    private static let collectionName = "liveSessions"
    private static let strokesSubcollection = "strokes"

    /// `STALE_MS` ported verbatim (`liveSession.ts`): no presence/heartbeat
    /// protocol for v1 - a session with no activity for this long is treated
    /// as "not live" everywhere staleness is checked.
    static let staleInterval: TimeInterval = 20 * 60

    /// `users/{uid}.tutorId` - the SAME field `CallButton.tsx` reads to
    /// decide whether to show itself at all ("hidden entirely when the
    /// student has no linked tutor... a live session with no one to join is
    /// a dead end"). One-shot read, not a subscription - matches how
    /// `CallButton.tsx` receives this as a plain prop rather than its own
    /// live listener.
    static func fetchTutorId(for uid: String) async -> String? {
        guard let snapshot = try? await db.collection("users").document(uid).getDocument() else {
            return nil
        }
        return snapshot.data()?["tutorId"] as? String
    }

    struct CreateInput {
        let studentId: String
        let tutorId: String?
        let contextType: LiveSessionContextType
        var questionId: String?
        var conceptId: String?
        var conceptName: String?
        var questionText: String?
    }

    /// Creates a new live session and returns its id, or nil on failure
    /// (fail-soft - callers should treat nil as "Call didn't start, try
    /// again," matching `createLiveSession`'s own doc comment).
    static func createSession(_ input: CreateInput) async -> String? {
        guard !input.studentId.isEmpty else { return nil }
        var payload: [String: Any] = [
            "studentId": input.studentId,
            "tutorId": input.tutorId as Any,
            "contextType": input.contextType.rawValue,
            "questionId": input.questionId as Any,
            "conceptId": input.conceptId as Any,
            "conceptName": input.conceptName as Any,
            "questionText": input.questionText as Any,
            // Worksheet-context-only fields (NATIVE_APP_BUILD_PLAN.md's
            // "write on your worksheet" feature 2) - always null from this
            // call site, which only ever creates 'question' context sessions
            // (the practice-session Call button). Included so the wire shape
            // matches `LiveSessionDoc` exactly, not a partial subset.
            "pageImage": NSNull(),
            "pageIndex": NSNull(),
            "pageCount": NSNull(),
            "status": LiveSessionStatus.active.rawValue,
            "createdAt": FieldValue.serverTimestamp(),
            "lastActivityAt": FieldValue.serverTimestamp(),
            "endedAt": NSNull(),
        ]
        if input.tutorId == nil { payload["tutorId"] = NSNull() }
        do {
            let ref = try await db.collection(collectionName).addDocument(data: payload)
            return ref.documentID
        } catch {
            return nil
        }
    }

    /// Marks a session ended. Fail-soft (matches `endLiveSession`'s own
    /// empty-catch - meant to be safely callable from a view teardown path
    /// where throwing would be actively harmful).
    static func endSession(_ sessionId: String) async {
        guard !sessionId.isEmpty else { return }
        try? await db.collection(collectionName).document(sessionId).setData([
            "status": LiveSessionStatus.ended.rawValue,
            "endedAt": FieldValue.serverTimestamp(),
        ], merge: true)
    }

    /// Appends one COMPLETED stroke (never overwrites another author's
    /// strokes - additive, one doc per stroke, so two people drawing at once
    /// never clobber each other) and best-effort bumps `lastActivityAt`.
    /// Fail-soft at every step, matching `appendLiveStroke`'s own two
    /// independent try/catch blocks: a dropped stroke or a missed activity
    /// bump must never surface as an error to the drawing surface.
    static func appendStroke(
        sessionId: String,
        authorId: String,
        authorRole: LiveSessionAuthorRole,
        points: [LiveStrokePoint]
    ) async {
        guard !sessionId.isEmpty, !authorId.isEmpty, !points.isEmpty else { return }
        do {
            _ = try await db.collection(collectionName).document(sessionId)
                .collection(strokesSubcollection)
                .addDocument(data: [
                    "authorId": authorId,
                    "authorRole": authorRole.rawValue,
                    "points": points.map { $0.firestoreDict },
                    "createdAt": FieldValue.serverTimestamp(),
                ])
        } catch {
            return
        }
        try? await db.collection(collectionName).document(sessionId).setData(
            ["lastActivityAt": FieldValue.serverTimestamp()], merge: true
        )
    }

    /// Realtime subscription to the session doc itself (status header, used
    /// to show "ended"/staleness). Fails soft to nil so a missing/denied doc
    /// never blocks the caller.
    static func subscribeSession(_ sessionId: String, onChange: @escaping (LiveSessionEntry?) -> Void) -> ListenerRegistration? {
        guard !sessionId.isEmpty else {
            onChange(nil)
            return nil
        }
        return db.collection(collectionName).document(sessionId).addSnapshotListener { snapshot, _ in
            guard let snapshot, snapshot.exists, let data = snapshot.data() else {
                onChange(nil)
                return
            }
            onChange(LiveSessionEntry(
                id: snapshot.documentID,
                studentId: data["studentId"] as? String ?? "",
                tutorId: data["tutorId"] as? String,
                contextType: LiveSessionContextType(rawValue: data["contextType"] as? String ?? "") ?? .question,
                conceptId: data["conceptId"] as? String,
                conceptName: data["conceptName"] as? String,
                questionText: data["questionText"] as? String,
                status: LiveSessionStatus(rawValue: data["status"] as? String ?? "") ?? .active,
                createdAt: (data["createdAt"] as? Timestamp)?.dateValue(),
                lastActivityAt: (data["lastActivityAt"] as? Timestamp)?.dateValue(),
                endedAt: (data["endedAt"] as? Timestamp)?.dateValue()
            ))
        }
    }

    /// Realtime subscription to the strokes subcollection, oldest-first so a
    /// replay renders in the order they were drawn - same ordering
    /// `subscribeLiveStrokes` uses. Fails soft to an empty list.
    static func subscribeStrokes(_ sessionId: String, onChange: @escaping ([LiveStrokeEntry]) -> Void) -> ListenerRegistration? {
        guard !sessionId.isEmpty else {
            onChange([])
            return nil
        }
        return db.collection(collectionName).document(sessionId)
            .collection(strokesSubcollection)
            .order(by: "createdAt", descending: false)
            .addSnapshotListener { snapshot, _ in
                guard let snapshot else {
                    onChange([])
                    return
                }
                let entries: [LiveStrokeEntry] = snapshot.documents.map { doc in
                    let data = doc.data()
                    let rawPoints = data["points"] as? [Any] ?? []
                    return LiveStrokeEntry(
                        id: doc.documentID,
                        authorId: data["authorId"] as? String ?? "",
                        authorRole: LiveSessionAuthorRole(rawValue: data["authorRole"] as? String ?? "") ?? .student,
                        points: rawPoints.compactMap { LiveStrokePoint.from($0) }
                    )
                }
                onChange(entries)
            }
    }

    /// Pure staleness check, ported verbatim from `isLiveSessionStale` - a
    /// session counts as live only while `status == .active` AND its last
    /// activity (or creation time, if no stroke has landed yet) is within
    /// `staleInterval`.
    static func isStale(status: LiveSessionStatus, lastActivityAt: Date?, createdAt: Date?, now: Date = Date()) -> Bool {
        if status != .active { return true }
        guard let last = lastActivityAt ?? createdAt else { return false }
        return now.timeIntervalSince(last) > staleInterval
    }
}
