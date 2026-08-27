import Foundation
import FirebaseAuth

/// `POST /api/generate-book` — on-demand, gated multi-chapter book
/// generation, closing Tier 3 of Jesse's lesson lookup
/// (JesseCallSession.askJesseWorkDashboard): a topic missing from the
/// Chapter Library, the bundled book graphs, and the archive used to fall
/// through to a single raw, ungated LLM call with zero sims and thin text.
/// This runs the SAME real, gated pipeline the overnight cron uses, on an
/// ad-hoc concept graph decomposed from the topic on the spot. Verified
/// live 2026-08-21: real end-to-end run on "enterprise technology equity
/// research" (the exact topic that produced garbage before this) yielded
/// 3 gate-passed chapters, 2 real embedded sims, ~4 minutes, $3.60.
///
/// Decodes straight into `AssembledBook` (AssembledBookModels.swift) — the
/// SAME model the Chapter Library (Tier 0) already uses, since this
/// endpoint's `book` field is `book_assembler.AssembledBook.to_dict()`
/// verbatim, the identical shape `get-book.ts` returns for a real
/// pre-built subject. A result from here is structurally indistinguishable
/// from a Tier-0 book, so the CALLER should route it through the exact
/// same `openedChapterBook`/`BookReaderView` path Tier 0 uses, not the
/// older, sim-less `WorkDashboardLesson`/`StudySessionView` pipeline.
///
/// Mirrors GeneratedSimClient's start/poll job pattern, with two real,
/// deliberate differences from design review:
///
///   - Its OWN timeout, not GeneratedSimClient's 180s ceiling. That number
///     was sized for ONE sim; a book job runs 4-6 concept+gate pipelines
///     plus 2-3 sims concurrently and is bound by the SLOWEST branch, not
///     the average. 8 minutes is real headroom, not a guess copied from
///     1/5th the work.
///   - Paced spoken progress via `chaptersReady`/`totalChapters` on every
///     poll, not one static "hang tight" line — a multi-minute silent
///     wait reads as a hang on a VOICE interface, not progress.
enum BookGenerationClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/generate-book")!
    private static let pollIntervalSeconds: UInt64 = 5
    private static let maxWaitSeconds: TimeInterval = 480

    enum Verdict: Equatable {
        /// `costUsd` is nil on a cache hit (the webhook only computes/sends
        /// it on a real terminal job, see generate-book.ts) - the caller
        /// should treat `cached: true` as the authority for "don't show a
        /// generation-stats badge," not merely `costUsd == nil`.
        case verified(AssembledBook, cached: Bool, costUsd: Double?, elapsedSeconds: Double)
        case noGoodResult(reason: String?)
        case rateLimited(reason: String?)
        case unavailable(String?)
    }

    private struct Envelope: Decodable {
        let status: String?
        let jobId: String?
        let cached: Bool?
        let book: AssembledBook?
        let reason: String?
        let chaptersReady: Int?
        let totalChapters: Int?
        let costUsd: Double?
        // Already on the wire (generate-book.ts) - this client just never
        // decoded it until now.
        let phase: String?
    }

    /// Starts a job and polls it to a terminal state. `onProgress` fires
    /// on every "running" poll with real chapter counts, so a caller can
    /// pace spoken filler instead of one static line during a genuinely
    /// multi-minute wait. Elapsed time is measured client-side (start of
    /// this call to the terminal response) rather than trusting server
    /// clocks to agree - it's also the more honest number for a student:
    /// how long THEY actually waited, not how long the job queue took.
    static func generate(
        topic: String,
        onProgress: @escaping (_ chaptersReady: Int, _ totalChapters: Int) -> Void = { _, _ in },
        onPhase: @escaping (String) -> Void = { _ in }
    ) async -> Verdict {
        let start = Date()
        // BYOK (2026-08-25) - same wiring as GeneratedSimClient.requestSim,
        // see StudentAIKeyStore.geminiKeyForServerGeneration's own doc
        // comment for the one-time exception this makes to "the key never
        // leaves the device." Omitted entirely when the student has no
        // Gemini key saved, so behavior is unchanged for them.
        var body: [String: Any] = ["topic": topic]
        if let key = await StudentAIKeyStore.shared.geminiKeyForServerGeneration() {
            body["studentGeminiKey"] = key
        }
        guard let envelope = await post(body) else {
            return .unavailable("Couldn't reach the generation service.")
        }
        switch envelope.status {
        case "passed":
            guard let book = envelope.book else {
                return .unavailable("The service reported success without a usable book.")
            }
            return .verified(book, cached: envelope.cached ?? false, costUsd: envelope.costUsd, elapsedSeconds: Date().timeIntervalSince(start))
        case "running":
            guard let jobId = envelope.jobId else {
                return .unavailable("The service accepted the job but returned no job id.")
            }
            return await poll(jobId: jobId, start: start, onProgress: onProgress, onPhase: onPhase)
        case "rate_limited":
            return .rateLimited(reason: envelope.reason)
        default:
            return .unavailable(envelope.reason)
        }
    }

    private static func poll(
        jobId: String, start: Date,
        onProgress: @escaping (Int, Int) -> Void,
        onPhase: @escaping (String) -> Void = { _ in }
    ) async -> Verdict {
        let deadline = Date().addingTimeInterval(maxWaitSeconds)
        while Date() < deadline {
            guard (try? await Task.sleep(nanoseconds: pollIntervalSeconds * 1_000_000_000)) != nil else {
                return .unavailable("The request was cancelled.")
            }
            guard let envelope = await post(["jobId": jobId]) else {
                return .unavailable("Lost contact with the generation service mid-job.")
            }
            switch envelope.status {
            case "running":
                onProgress(envelope.chaptersReady ?? 0, envelope.totalChapters ?? 0)
                onPhase(envelope.phase ?? "running")
                continue
            case "passed":
                guard let book = envelope.book else {
                    return .unavailable("The service reported success without a usable book.")
                }
                return .verified(book, cached: envelope.cached ?? false, costUsd: envelope.costUsd, elapsedSeconds: Date().timeIntervalSince(start))
            case "no_good_result":
                return .noGoodResult(reason: envelope.reason)
            default:
                return .unavailable(envelope.reason)
            }
        }
        return .unavailable("Building the full lesson took longer than expected.")
    }

    private static func post(_ body: [String: Any]) async -> Envelope? {
        guard let token = try? await Auth.auth().currentUser?.getIDToken() else { return nil }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard let (data, _) = try? await URLSession.shared.data(for: request) else { return nil }
        return try? JSONDecoder().decode(Envelope.self, from: data)
    }
}
