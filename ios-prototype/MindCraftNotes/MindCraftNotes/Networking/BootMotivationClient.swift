import Foundation
import FirebaseAuth

/// Short AI line for the Malevolent Shrine boot slide.
enum BootMotivationClient {
    private static let webhookBase = "https://mindcraft-webhook.vercel.app"

    private static let fallbacks = [
        "It's tuff you opened MindCraft today, champ.",
        "You showed up. The shrine noticed.",
        "One quiet open. That's how wild work starts.",
        "Glad you're here. Let's make today count.",
        "Desk is warm. Your move, legend.",
        "Small open, big day. You've got this.",
    ]

    static func fallbackLine() -> String {
        fallbacks.randomElement() ?? fallbacks[0]
    }

    /// Asks the desk agent for one short motivating line. Falls back locally if offline.
    static func fetchLine() async -> String {
        guard let user = Auth.auth().currentUser,
              let token = try? await user.getIDToken(),
              let url = URL(string: "\(webhookBase)/api/desk-ask")
        else {
            return fallbackLine()
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 8

        let prompt = """
        Write ONE short motivating line for a student who just opened The Desk by MindCraft.
        Max 14 words. Warm, specific, no hashtags, no emoji spam, no quotation marks.
        Tone like: Glad you opened The Desk today.
        Reply with ONLY the line.
        """
        let body: [String: Any] = [
            "message": prompt,
            "studentId": user.uid,
            "deskContext": [
                "intelLines": [] as [String],
                "binderItems": [] as [[String: String]],
                "calendarEvents": [] as [[String: String]],
                "connected": [] as [String],
                "openSurface": "boot",
            ],
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse,
              http.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              var reply = json["reply"] as? String
        else {
            return fallbackLine()
        }

        reply = reply
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "\"“”"))
        if let nl = reply.firstIndex(of: "\n") {
            reply = String(reply[..<nl]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard !reply.isEmpty else { return fallbackLine() }
        if reply.count > 96 {
            return fallbackLine()
        }
        return reply
    }
}
