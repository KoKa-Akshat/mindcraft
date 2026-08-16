import Foundation

/// Page bus for the Work dashboard. **Not** a second LLM.
///
/// Central Jesse (`JesseCallSession`) is the only agent the student talks
/// to. Intel / Moodle / Binder / Email / Gcal are scoped helpers on this
/// page: they report what they already fetched, they can ask neighbors to
/// temporarily shrink, and Jesse can quote them. They do not converse on
/// their own and they do not call an LLM.
///
/// Presentation's specialized sub-agent is still a later pass — this bus
/// is the hook that agent would join, not that agent itself.
@MainActor
final class DeskBoxBus: ObservableObject {
    static let shared = DeskBoxBus()

    enum Box: String, CaseIterable {
        case jesse
        case intel
        case moodle
        case binder
        case email
        case gcal
    }

    /// Which box currently borrowed space from its neighbors. Nil = rest.
    @Published private(set) var hungry: Box?
    @Published var intelLines: [String] = []
    @Published var binderTitles: [String] = []

    private init() {}

    func requestSpace(for box: Box) {
        guard box != .jesse else { return }
        hungry = box
    }

    func releaseSpace() {
        hungry = nil
    }

    /// If `box` is the one that grew, tapping elsewhere restores the board.
    func releaseIfHungry(_ box: Box) {
        if hungry == box { hungry = nil }
    }

    func neighbors(of box: Box) -> [Box] {
        switch box {
        case .email: return [.gcal, .binder]
        case .gcal: return [.email, .binder]
        case .intel: return [.moodle, .binder]
        case .moodle: return [.intel, .binder]
        case .binder: return [.intel, .moodle, .email, .gcal]
        case .jesse: return Box.allCases.filter { $0 != .jesse }
        }
    }

    /// What Jesse reads before replying on this page. Empty sections are
    /// omitted so a disconnected box does not invent mail.
    func briefing() -> String {
        var parts: [String] = [
            "You are Jesse, the only voice. The Work boxes are helpers — quote them, do not pretend to be them.",
        ]
        let email = emailReport()
        if !email.isEmpty { parts.append("EMAIL BOX:\n\(email)") }
        let cal = calendarReport()
        if !cal.isEmpty { parts.append("CALENDAR BOX:\n\(cal)") }
        let moodle = moodleReport()
        if !moodle.isEmpty { parts.append("MOODLE BOX:\n\(moodle)") }
        if !binderTitles.isEmpty {
            parts.append("BINDER BOX:\n" + binderTitles.prefix(6).map { "- \($0)" }.joined(separator: "\n"))
        }
        if !intelLines.isEmpty {
            parts.append("INTEL BOX:\n" + intelLines.prefix(6).map { "- \($0)" }.joined(separator: "\n"))
        }
        return parts.joined(separator: "\n\n")
    }

    /// Local answer when the student is clearly asking a box, so Jesse
    /// talks *to* that helper instead of only hitting archive-RAG.
    func directAnswer(for message: String) -> String? {
        let q = message.lowercased()
        if mentions(q, [
            "this page", "these boxes", "the boxes", "all the boxes",
            "brief me", "catch me up", "what's going on", "whats going on",
            "what do you see", "what's on my desk", "whats on my desk",
        ]) {
            return pageBrief()
        }
        if mentions(q, ["email", "inbox", "gmail", "mail", "summar"]) {
            requestSpace(for: .email)
            let report = emailReport()
            return report.isEmpty
                ? "Email isn't showing mail yet. If Gmail is connected I'll pull the inbox — otherwise tap the sleeping mascot on Email Summaries."
                : "From Email Summaries:\n\(report)"
        }
        if mentions(q, ["calendar", "gcal", "week", "schedule", "event"]) {
            requestSpace(for: .gcal)
            let report = calendarReport()
            return report.isEmpty
                ? "Calendar is quiet. Connect Gcal or I have no week to read."
                : "From Gcal:\n\(report)"
        }
        if mentions(q, ["moodle", "homework", "assignment", "grade"]) {
            requestSpace(for: .moodle)
            let report = moodleReport()
            return report.isEmpty
                ? "Moodle isn't connected, so I don't have assignments."
                : "From Moodle:\n\(report)"
        }
        if mentions(q, ["binder", "filed", "notes I saved"]) {
            requestSpace(for: .binder)
            return binderTitles.isEmpty
                ? "Binder is empty. Nothing filed yet."
                : "From Binder:\n" + binderTitles.prefix(8).map { "- \($0)" }.joined(separator: "\n")
        }
        if mentions(q, ["intel"]) {
            requestSpace(for: .intel)
            return intelLines.isEmpty
                ? "Intel is empty until the other boxes fetch something."
                : "From Intel:\n" + intelLines.prefix(8).map { "- \($0)" }.joined(separator: "\n")
        }
        return nil
    }

    /// Jesse reads every helper on this page and quotes them in one turn.
    func pageBrief() -> String {
        var chunks: [String] = []
        let email = emailReport()
        if !email.isEmpty { chunks.append("Email Summaries:\n\(email)") }
        let cal = calendarReport()
        if !cal.isEmpty { chunks.append("Gcal:\n\(cal)") }
        let moodle = moodleReport()
        if !moodle.isEmpty { chunks.append("Moodle:\n\(moodle)") }
        if !binderTitles.isEmpty {
            chunks.append("Binder:\n" + binderTitles.prefix(6).map { "- \($0)" }.joined(separator: "\n"))
        }
        if !intelLines.isEmpty {
            chunks.append("Intel:\n" + intelLines.prefix(6).map { "- \($0)" }.joined(separator: "\n"))
        }
        if chunks.isEmpty {
            return "I asked every box on this page. Email, Gcal, Moodle, Binder, and Intel are all quiet — connect a helper or file something and I’ll read it."
        }
        return "I asked the boxes on this page:\n\n" + chunks.joined(separator: "\n\n")
    }

    func emailReport() -> String {
        if let digest = GmailDigestClient.shared.digest {
            var lines = [digest.headline]
            lines.append(contentsOf: digest.actionItems.prefix(4).map { "Need you: \($0.subject) — \($0.why)" })
            lines.append(contentsOf: digest.fyi.prefix(3).map { "FYI: \($0.subject)" })
            return lines.filter { !$0.isEmpty }.joined(separator: "\n")
        }
        if let saved = GmailDigestStore.shared.history.first {
            var lines = [saved.headline]
            lines.append(contentsOf: saved.actionItems.prefix(4).map { "Need you: \($0.subject) — \($0.why)" })
            return lines.filter { !$0.isEmpty }.joined(separator: "\n")
        }
        let subjects = GmailClient.shared.messages.prefix(5).map(\.subject).filter { !$0.isEmpty }
        if subjects.isEmpty { return "" }
        return "Latest mail:\n" + subjects.map { "- \($0)" }.joined(separator: "\n")
    }

    func calendarReport() -> String {
        let week = GmailClient.shared.week
        if week.isEmpty { return "" }
        return week.prefix(8).map { "\($0.day) · \($0.title)" }.joined(separator: "\n")
    }

    func moodleReport() -> String {
        let client = MoodleClient.shared
        guard client.isConnected else { return "" }
        var lines = client.assignments.prefix(6).map { "\($0.courseName): \($0.name) (\($0.dueLabel))" }
        lines.append(contentsOf: client.grades.prefix(4).map { "\($0.itemName): \($0.gradeLabel)" })
        return lines.joined(separator: "\n")
    }

    private func mentions(_ q: String, _ keys: [String]) -> Bool {
        keys.contains { q.contains($0) }
    }
}
