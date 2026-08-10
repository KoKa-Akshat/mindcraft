import Foundation
import FirebaseAuth

/// Desk Operator Ask client → `POST /api/desk-ask` on the shared webhook.
/// Same Firebase Bearer auth as HomeworkClient / web jarvis.
enum DeskAskClient {
    private static let webhookBase = "https://mindcraft-webhook.vercel.app"

    struct BinderItem: Encodable {
        let title: String
        let course: String
    }

    struct CalendarEvent: Encodable {
        let day: String
        let title: String
    }

    struct DeskContext: Encodable {
        let intelLines: [String]
        let binderItems: [BinderItem]
        let calendarEvents: [CalendarEvent]
        let connected: [String]
        let openSurface: String
    }

    struct Action: Equatable {
        let type: String
        let payload: String?
    }

    struct Result {
        let reply: String
        let actions: [Action]
        let fallback: Bool
    }

    enum AskError: Error {
        case notSignedIn
        case unavailable
    }

    static func ask(message: String, context: DeskContext) async -> Result? {
        guard let user = Auth.auth().currentUser else { return nil }
        guard let token = try? await user.getIDToken() else { return nil }
        guard let url = URL(string: "\(webhookBase)/api/desk-ask") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 45

        let body: [String: Any] = [
            "message": message,
            "studentId": user.uid,
            "deskContext": [
                "intelLines": context.intelLines,
                "binderItems": context.binderItems.map { ["title": $0.title, "course": $0.course] },
                "calendarEvents": context.calendarEvents.map { ["day": $0.day, "title": $0.title] },
                "connected": context.connected,
                "openSurface": context.openSurface,
            ],
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse,
              http.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let reply = json["reply"] as? String
        else {
            return nil
        }

        let rawActions = (json["actions"] as? [[String: Any]]) ?? []
        let actions: [Action] = rawActions.compactMap { row in
            guard let type = row["type"] as? String else { return nil }
            return Action(type: type, payload: row["payload"] as? String)
        }
        return Result(
            reply: reply.trimmingCharacters(in: .whitespacesAndNewlines),
            actions: actions,
            fallback: (json["fallback"] as? Bool) ?? false
        )
    }

    /// Local keyword fallback when the webhook is unreachable.
    static func localFallback(message: String, context: DeskContext) -> Result {
        let s = message.lowercased()
        if s.contains("mail") || s.contains("gmail") || s.contains("inbox") {
            let wantsReply = s.contains("reply") || s.contains("response") || s.contains("send")
                || s.contains("top") || s.contains("ready")
            if wantsReply {
                return Result(
                    reply: "Opening your top mail with a ready reply. Edit it, then hit Send.",
                    actions: [Action(type: "open_gmail_top_reply", payload: nil)],
                    fallback: true
                )
            }
            return Result(reply: "Opening your Gmail box.", actions: [Action(type: "open_gmail", payload: nil)], fallback: true)
        }
        if s.contains("apply") || s.contains("job") || s.contains("resume") {
            return Result(reply: "Opening Apply today.", actions: [Action(type: "open_apply", payload: nil)], fallback: true)
        }
        if s.contains("connect") || s.contains("moodle") {
            return Result(reply: "Opening Connect.", actions: [Action(type: "open_connect", payload: nil)], fallback: true)
        }
        if s.contains("cal") || s.contains("week") || s.contains("schedule") {
            if context.calendarEvents.isEmpty {
                return Result(
                    reply: "No events this week yet. Connect Gmail + Calendar to load your real week.",
                    actions: [Action(type: "refresh_calendar", payload: nil)],
                    fallback: true
                )
            }
            let bits = context.calendarEvents.prefix(4).map { "\($0.day) · \($0.title)" }.joined(separator: "; ")
            return Result(
                reply: "From your calendar: \(bits).",
                actions: [Action(type: "refresh_calendar", payload: nil)],
                fallback: true
            )
        }
        if s.contains("workflow") || s.contains("organize") || s.contains("recommend")
            || s.contains("what should") || s.contains("next") || s.contains("job") {
            let hasCal = context.connected.contains { $0.lowercased().contains("gcal") || $0.lowercased().contains("cal") }
            let hasMail = context.connected.contains { $0.lowercased().contains("gmail") || $0.lowercased().contains("mail") }
            if hasMail || hasCal {
                return Result(
                    reply: "Kickstart Apply today with your linked mail/calendar context.",
                    actions: [
                        Action(type: "prepend_intel", payload: "Agent · Kickstart Apply today from linked connectors"),
                        Action(type: "open_apply", payload: nil),
                    ],
                    fallback: true
                )
            }
            return Result(
                reply: "Link Gmail or Calendar first so Ask can start a workflow.",
                actions: [Action(type: "open_connect", payload: nil)],
                fallback: true
            )
        }
        return Result(
            reply: "I heard you. Ask what to do next, organize your week, or open mail.",
            actions: [],
            fallback: true
        )
    }
}
