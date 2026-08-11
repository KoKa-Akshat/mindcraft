import Foundation
import FirebaseAuth
import FirebaseFirestore

/// One parsed homework question - mirrors `HomeworkQuestion` in
/// `app/src/lib/homework.ts` exactly (same field names) so a session created
/// natively decodes correctly on web and vice versa.
struct HomeworkQuestion: Codable, Identifiable {
    let id: String
    let number: String?
    let text: String
    let choices: [String]?
    let figureNote: String?
}

struct HomeworkSession: Identifiable {
    let id: String
    let title: String
    let questions: [HomeworkQuestion]
    let status: String
}

/// Real homework upload → parse → session flow, ported from
/// `homework.ts`'s `parseHomeworkPages`/`createHomeworkSession`/
/// `listHomeworkSessions` - same webhook endpoint
/// (`https://mindcraft-webhook.vercel.app/api/parse-homework`), same
/// Firestore `homework_sessions` collection/field shape. The underlying
/// LLM parsing service can genuinely be down (see CLAUDE.md. Anthropic
/// credits exhausted at various points), so a real failure here is expected
/// behavior, not a bug to hide: surfaces the same honest
/// "couldn't read/parse" states web shows rather than pretending success.
enum HomeworkClient {
    private static let webhookBase = "https://mindcraft-webhook.vercel.app"

    enum ParseResult {
        case success(questions: [HomeworkQuestion])
        case unavailable
        case notSignedIn
    }

    static func parseAndCreateSession(imageData: Data, fileName: String) async -> (result: ParseResult, sessionId: String?) {
        guard let user = Auth.auth().currentUser else { return (.notSignedIn, nil) }
        guard let token = try? await user.getIDToken() else { return (.notSignedIn, nil) }

        let base64 = imageData.base64EncodedString()
        guard let url = URL(string: "\(webhookBase)/api/parse-homework") else { return (.unavailable, nil) }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "pages": [["imageBase64": base64]],
        ])

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawQuestions = json["questions"] as? [[String: Any]],
              !rawQuestions.isEmpty
        else {
            return (.unavailable, nil)
        }

        let questions: [HomeworkQuestion] = rawQuestions.enumerated().map { i, q in
            HomeworkQuestion(
                id: "q\(i)",
                number: q["number"] as? String,
                text: q["text"] as? String ?? "",
                choices: q["choices"] as? [String],
                figureNote: q["figureNote"] as? String
            )
        }

        let sessionId = await createSession(uid: user.uid, fileName: fileName, questions: questions)
        return (.success(questions: questions), sessionId)
    }

    private static func createSession(uid: String, fileName: String, questions: [HomeworkQuestion]) async -> String? {
        let db = Firestore.firestore()
        let title = titleFromFileName(fileName)
        let now = Date().timeIntervalSince1970 * 1000
        let payload: [String: Any] = [
            "studentId": uid,
            "title": title,
            "sourceFileName": fileName,
            "pageCount": 1,
            "questions": (try? questions.map { q -> [String: Any] in
                var dict: [String: Any] = ["id": q.id, "text": q.text]
                if let number = q.number { dict["number"] = number }
                if let choices = q.choices { dict["choices"] = choices }
                if let figureNote = q.figureNote { dict["figureNote"] = figureNote }
                return dict
            }) ?? [],
            "currentIndex": 0,
            "status": "in_progress",
            "createdAt": now,
            "updatedAt": now,
        ]
        let ref = try? await db.collection("homework_sessions").addDocument(data: payload)
        return ref?.documentID
    }

    private static func titleFromFileName(_ name: String) -> String {
        let base = (name as NSString).deletingPathExtension
            .replacingOccurrences(of: "[_-]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        return base.isEmpty ? "Homework" : "Homework \u{00B7} \(base)"
    }

    static func listRecentSessions(uid: String, max: Int = 4) async -> [HomeworkSession] {
        let db = Firestore.firestore()
        guard let snapshot = try? await db.collection("homework_sessions")
            .whereField("studentId", isEqualTo: uid)
            .order(by: "updatedAt", descending: true)
            .limit(to: max)
            .getDocuments()
        else { return [] }

        return snapshot.documents.map { doc in
            let data = doc.data()
            let rawQuestions = data["questions"] as? [[String: Any]] ?? []
            let questions = rawQuestions.enumerated().map { i, q in
                HomeworkQuestion(
                    id: q["id"] as? String ?? "q\(i)",
                    number: q["number"] as? String,
                    text: q["text"] as? String ?? "",
                    choices: q["choices"] as? [String],
                    figureNote: q["figureNote"] as? String
                )
            }
            return HomeworkSession(
                id: doc.documentID,
                title: data["title"] as? String ?? "Homework",
                questions: questions,
                status: data["status"] as? String ?? "in_progress"
            )
        }
    }
}

/// Real "paste a problem" solver - ported from `getIngredientCards()` in
/// `mlApi.ts`, same `/recommend-ingredients` endpoint on the live ML engine
/// (HF Spaces bridge, same base URL `KnowledgeGraphClient` already calls).
enum IngredientHintsClient {
    struct HintCard {
        let title: String
        let body: String
    }

    private static let baseURL = "https://joinmindcraft-mindcraft-ml.hf.space"

    static func hints(for problemText: String) async -> [HintCard]? {
        guard let user = Auth.auth().currentUser, let token = try? await user.getIDToken() else { return nil }
        guard let url = URL(string: "\(baseURL)/recommend-ingredients") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "student_id": user.uid,
            "problem_text": problemText,
            "max_cards": 4,
        ])

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawCards = json["cards"] as? [[String: Any]]
        else {
            return nil
        }
        return rawCards.map { HintCard(title: $0["title"] as? String ?? "Hint", body: $0["body"] as? String ?? "") }
    }
}
