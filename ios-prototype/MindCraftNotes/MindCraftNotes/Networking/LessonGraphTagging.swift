import Foundation
import FirebaseAuth

/// The client-side half of the content-growth pipeline documented in
/// mindcraft/CONTENT_GROWTH_PIPELINE.md - a generated Study Session lesson
/// gets tagged into the live concept ontology (`LessonGraphIngestClient`),
/// and a student's real engagement with it (viewing a chapter) gets logged
/// separately from graded mastery evidence (`EngagementClient`), matching
/// the server's own SessionEvent-vs-LearningEvent split (see that doc's
/// "Grounding in the literature" section for why the two must never merge:
/// engine/features.py sums every SessionEvent's outcome regardless of type,
/// so an ungraded exposure event has no safe value to hand it there).

/// Pure slug logic - MUST match `ml/mindcraft_graph/loaders/lesson_tagger.py`'s
/// `slugify`/`tag_lesson_to_graph` exactly, or a chapter viewed here would
/// log an engagement event against a concept_id the server never minted.
/// Computed independently client-side (rather than round-tripping the
/// server's `/ingest-lesson-graph` response back into `WorkDashboardLesson`)
/// specifically to avoid a race: a student can switch chapter tabs before
/// that background ingest call returns, or it can fail outright (a bad
/// graph, a network blip) - the concept_id a chapter maps to must not
/// depend on that call having already succeeded.
enum LessonSlug {
    // ASCII-only on purpose - Python's regex is `[^a-z0-9]+`, plain ASCII,
    // not Unicode-aware. `CharacterSet.lowercaseLetters` IS Unicode-aware
    // (keeps "é", "ñ", ...) and would silently diverge from the server for
    // any non-ASCII title - caught before shipping by running the real
    // Python slugify side-by-side on "Café Culture" and comparing.
    private static let asciiLowerAlnum = Set("abcdefghijklmnopqrstuvwxyz0123456789")

    static func slugify(_ text: String) -> String {
        let lowered = text.lowercased()
        var result = ""
        var lastWasSeparator = false
        for char in lowered {
            if asciiLowerAlnum.contains(char) {
                result.append(char)
                lastWasSeparator = false
            } else if !lastWasSeparator {
                result.append("_")
                lastWasSeparator = true
            }
        }
        while result.hasPrefix("_") { result.removeFirst() }
        while result.hasSuffix("_") { result.removeLast() }
        return result.isEmpty ? "untitled" : result
    }

    /// Mirrors `tag_lesson_to_graph`'s per-chapter id assignment, including
    /// its collision dedup (`base_slug`, `base_slug_2`, `base_slug_3`, ...).
    static func conceptIds(topic: String, chapterTitles: [String]) -> [String] {
        let subjectId = slugify(topic)
        var seen: [String: Int] = [:]
        return chapterTitles.map { title in
            let base = slugify(title)
            let count = seen[base, default: 0]
            seen[base] = count + 1
            let slug = count == 0 ? base : "\(base)_\(count + 1)"
            return "\(subjectId)::\(slug)"
        }
    }

    static func subjectId(topic: String) -> String { slugify(topic) }
}

/// `POST /api/ingest-lesson-graph` (webhook proxy - the ml service's own
/// /ingest-lesson-graph is deliberately service-key-only, see that
/// endpoint's docstring in ml/serve.py, so the app can't call it directly).
/// Best-effort by design: called right after Jesse finishes a *generated*
/// lesson (never for archive-matched ones - those concepts either already
/// exist or are a separate, not-yet-designed question), fire-and-forget so
/// ontology bookkeeping never delays the student hearing their lesson.
/// Failure here means the lesson's concepts aren't in the live ontology yet
/// (so a later /record-outcomes on its practice question would 400 on an
/// unknown concept_id) - logged, not surfaced to the student; generation
/// itself already succeeded and that's what they're waiting on.
enum LessonGraphIngestClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/ingest-lesson-graph")!

    static func ingest(topic: String, chapterTitles: [String]) async {
        guard !chapterTitles.isEmpty else { return }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "topic": topic,
            "chapterTitles": chapterTitles,
        ])

        guard
            let (_, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse
        else {
            print("[LessonGraphIngestClient] request failed for topic: \(topic)")
            return
        }
        if http.statusCode != 200 {
            print("[LessonGraphIngestClient] ingest failed (\(http.statusCode)) for topic: \(topic)")
        }
    }
}

/// `POST /record-engagement` - direct to the ml service (same auth shape as
/// `OutcomeClient`: a real Firebase ID token, per-student, NOT the
/// service-key path). Deliberately separate from `OutcomeClient.recordOutcome`
/// - this never touches mastery, see the file-level doc comment above.
enum EngagementError: Error { case notSignedIn }

enum EngagementClient {
    private static let baseURL = "https://joinmindcraft-mindcraft-ml.hf.space"

    @discardableResult
    static func recordEngagement(
        subjectId: String,
        conceptId: String,
        eventType: String,
        metadata: [String: String] = [:]
    ) async -> Bool {
        guard let user = Auth.auth().currentUser else { return false }
        guard let url = URL(string: "\(baseURL)/record-engagement") else { return false }

        guard let token = try? await user.getIDToken() else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "student_id": user.uid,
            "subject_id": subjectId,
            "concept_id": conceptId,
            "event_type": eventType,
            "metadata": metadata,
        ])

        guard
            let (_, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse
        else { return false }
        return http.statusCode == 200
    }
}
