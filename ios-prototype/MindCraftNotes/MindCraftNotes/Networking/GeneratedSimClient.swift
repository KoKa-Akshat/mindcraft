import Foundation
import FirebaseAuth

/// Feature gate for live, gated MicroSim generation
/// (LIVE_GATED_GENERATION_TEST_SPEC.md). Opened to every real install
/// 2026-08-19 - both preconditions this gate's own doc comment used to
/// name are now true: Blake is looped in on the deployed content-engine
/// service and its cost surface, and the webhook's placeholder attempt cap
/// has been replaced with a real $10/mo platform-wide dollar budget
/// (webhook/lib/generationBudget.ts), tracked from actual token usage the
/// service reports per job - not a guess. The content-engine Space is live
/// and verified (two real end-to-end generations, both gate-passed).
enum LiveGatedGeneration {
    static var isEnabled: Bool { true }
}

/// One gate-passed, verified generated simulation - the ONLY generated
/// shape a student may ever see (the webhook already refused to relay
/// anything that didn't clear fit-check -> render -> structural rubric ->
/// vision gate, and downgrades a "passed" payload with no renderable html
/// to an error). `html` is self-contained - js inlined server-side, same
/// end shape `MicroSimRecord.selfContainedHTML` produces for the bundled
/// McCreary sims - so rendering is one `loadHTMLString`, no assembly.
struct GeneratedSimResult: Equatable, Decodable, Identifiable {
    let title: String
    let description: String
    let html: String
    let conceptId: String
    let conceptLabel: String
    let learningObjectives: [String]
    let rubricPercentage: Double?
    let qualityGateScore: Int?
    let topic: String
    let topicSlug: String

    var id: String { topicSlug }
}

/// The two real outcomes the spec allows (verified, or an honest
/// no-good-with-reason) plus the two infrastructure states that are not
/// outcomes of generation at all: the budget cap saying no before anything
/// was attempted, and the service being unreachable/not deployed. Never a
/// partial result, never a loading-forever.
enum GeneratedSimVerdict: Equatable {
    case verified(GeneratedSimResult, cached: Bool)
    case noGoodResult(reason: String?, suggestedRetryTopic: String?)
    case rateLimited(reason: String?)
    case unavailable(String?)
}

/// `POST /api/generate-sim` (webhook proxy - see
/// webhook/lib/handlers/generate-sim.ts for the full contract). Genuinely
/// async on the wire: one start call returns a jobId, then this polls
/// until a terminal verdict - generation is a real 15-60+ second pipeline
/// per attempt, not a single blocking request an iOS view should sit on.
/// Auth is a real Firebase ID token (same shape as `EngagementClient`):
/// the endpoint can spend money per call, so the server identifies the
/// student by verified uid, never a client-supplied id.
enum GeneratedSimClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/generate-sim")!
    private static let pollIntervalSeconds: UInt64 = 3
    /// Hard ceiling on the whole poll loop - the honest alternative to
    /// loading-forever. Generous vs. the 15-60+s single-attempt estimate
    /// because the service may retry internally.
    private static let maxWaitSeconds: TimeInterval = 180

    /// The webhook's response envelope for both the start and poll shapes.
    private struct Envelope: Decodable {
        let status: String?
        let jobId: String?
        let cached: Bool?
        let result: GeneratedSimResult?
        let reason: String?
        let suggestedRetryTopic: String?
    }

    static func requestSim(topic: String) async -> GeneratedSimVerdict {
        guard let envelope = await post(["topic": topic]) else {
            return .unavailable("Couldn't reach the generation service.")
        }
        switch envelope.status {
        case "passed":
            guard let result = envelope.result else {
                // A "passed" without a result is a contract violation, and
                // showing something partial is the one thing this feature
                // must never do - treat it as unavailable, not success.
                return .unavailable("The service reported success without a result.")
            }
            return .verified(result, cached: envelope.cached ?? false)
        case "running":
            guard let jobId = envelope.jobId else {
                return .unavailable("The service accepted the job but returned no job id.")
            }
            return await poll(jobId: jobId)
        case "rate_limited":
            return .rateLimited(reason: envelope.reason)
        default:
            return .unavailable(envelope.reason)
        }
    }

    private static func poll(jobId: String) async -> GeneratedSimVerdict {
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
                continue
            case "passed":
                guard let result = envelope.result else {
                    return .unavailable("The service reported success without a result.")
                }
                return .verified(result, cached: envelope.cached ?? false)
            case "no_good_result":
                return .noGoodResult(reason: envelope.reason, suggestedRetryTopic: envelope.suggestedRetryTopic)
            default:
                return .unavailable(envelope.reason)
            }
        }
        return .unavailable("The quality check didn't finish in time.")
    }

    private static func post(_ body: [String: String]) async -> Envelope? {
        guard let user = Auth.auth().currentUser,
              let token = try? await user.getIDToken() else { return nil }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard let (data, _) = try? await URLSession.shared.data(for: request) else { return nil }
        // Status semantics live in the envelope's own `status` field (the
        // webhook mirrors it into HTTP codes for other callers) - decoding
        // regardless of HTTP status keeps the 429/503 reasons readable
        // here instead of collapsing them all into "request failed."
        return try? JSONDecoder().decode(Envelope.self, from: data)
    }
}
