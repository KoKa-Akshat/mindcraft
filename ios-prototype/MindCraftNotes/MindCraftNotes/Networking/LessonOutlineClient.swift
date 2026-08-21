import Foundation
import FirebaseAuth

/// Server-side, platform-funded lesson-outline generation
/// (POST /api/generate-lesson-outline) - real fix, 2026-08-21, for direct
/// live feedback: Jesse's "build me a lesson" fallback used to require the
/// STUDENT to bring their own personal Anthropic/Groq key
/// (StudentAIKeyStore) just to use a core feature at all. "The API key
/// should not be a problem, right? I'm sure there's one working API key.
/// Make sure Vercel knows that too." They're right - the platform already
/// pays for generation elsewhere (generate-sim.ts, same budget-capped
/// pattern this endpoint copies server-side). StudentAIKeyStore itself is
/// untouched and still real for the flows that are genuinely meant to be
/// bring-your-own-key (homework help, study plans) - this client is only
/// for the one flow that shouldn't have ever depended on that.
enum LessonOutlineClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/generate-lesson-outline")!

    enum GenerateError: Error {
        case notSignedIn
        case rateLimited(reason: String)
        case failed(reason: String)
    }

    static func generate(
        topic: String,
        knownConceptIds: [String],
        referenceMaterial: String? = nil
    ) async -> Result<LessonOutline, GenerateError> {
        guard let token = try? await Auth.auth().currentUser?.getIDToken() else {
            return .failure(.notSignedIn)
        }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        var body: [String: Any] = ["topic": topic, "knownConceptIds": knownConceptIds]
        if let referenceMaterial { body["referenceMaterial"] = referenceMaterial }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse
        else { return .failure(.failed(reason: "Network error")) }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return .failure(.failed(reason: "Bad response"))
        }

        if http.statusCode == 429 {
            return .failure(.rateLimited(reason: json["reason"] as? String ?? "Rate limited"))
        }
        guard http.statusCode == 200, let outlineJSON = json["outline"] as? [String: Any] else {
            return .failure(.failed(reason: json["reason"] as? String ?? "Generation failed"))
        }
        guard let outlineData = try? JSONSerialization.data(withJSONObject: outlineJSON),
              let outline = try? JSONDecoder().decode(LessonOutline.self, from: outlineData)
        else {
            return .failure(.failed(reason: "Couldn't parse outline"))
        }
        return .success(outline)
    }
}
