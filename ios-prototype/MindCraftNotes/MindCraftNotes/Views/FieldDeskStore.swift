import Foundation
import UniformTypeIdentifiers

/// Local-first Field Desk persistence - native mirror of the web desk's
/// IndexedDB/localStorage slice used by Drop → File → Binder / Intel /
/// Connect (`js/upload.js`, `js/connectLinks.js`, `js/home.js`).
/// Same `deskOs.*` key family as `DeskGoalStore`.
@MainActor
final class FieldDeskStore: ObservableObject {
    struct FiledItem: Identifiable, Codable, Equatable {
        let id: String
        var title: String
        var course: String
        var note: String
        var createdAt: String
        /// Original filename when dropped from Files/Photos; empty for manual.
        var sourceName: String
    }

    struct CalendarEvent: Identifiable, Codable, Equatable {
        let id: String
        var day: String
        var title: String
    }

    struct MailItem: Identifiable, Codable, Equatable {
        let id: String
        var subject: String
        var from: String
    }

    /// Port of `js/connectLinks.js` CONNECTORS - instruction steps + local mark.
    struct Connector: Identifiable, Equatable {
        let id: String
        let title: String
        let kind: String
        let meta: String
        let steps: [String]
    }

    static let connectors: [Connector] = [
        Connector(
            id: "gmail",
            title: "Gmail",
            kind: "mail",
            meta: "Your school Gmail on this desk",
            steps: [
                "Sign in to Gmail with your school Google account on this iPad.",
                "Tap Connect Gmail + Calendar below.",
                "When Google asks, allow MindCraft to read mail and calendar.",
                "Then use the envelope icon anytime to open your inbox.",
            ]
        ),
        Connector(
            id: "gcal",
            title: "Calendar",
            kind: "calendar",
            meta: "Apple Calendar or Google Calendar",
            steps: [
                "Add your school account in iPad Settings → Calendar → Accounts.",
                "Or connect Gmail + Calendar from the mail box (one Google prompt).",
                "Your real Google or Apple Calendar week shows on the calendar card automatically.",
                "Tap Mark as connected when your week looks right.",
            ]
        ),
        Connector(
            id: "gdrive",
            title: "Google Drive",
            kind: "files",
            meta: "Your files stay in your Drive · AI read-only",
            steps: [
                "On drive.google.com, create a folder named exactly: MindCraft Desk",
                "Drop only the school PDFs and notes you want MindCraft to see into that folder.",
                "Tap Connect Google Drive below and sign in with the same Google account.",
                "Approve read-only access to that folder (not your whole Drive).",
                "MindCraft’s Ask/AI can read files inside MindCraft Desk only. Nothing else. You can revoke anytime in Google Account → Security → Third-party access.",
            ]
        ),
        Connector(
            id: "moodle",
            title: "Moodle",
            kind: "school",
            meta: "Courses and files",
            steps: [
                "Open your school Moodle site and sign in.",
                "Open a course you are taking.",
                "Download the PDFs or notes you need.",
                "Tap File upload below, then Mark as connected.",
            ]
        ),
    ]

    private static let itemsKey = "deskOs.fieldDeskItems"
    private static let intelKey = "deskOs.intelLines"
    private static let connectKey = "deskOs.connect"
    private static let eventsKey = "deskOs.calendarEvents"
    private static let mailKey = "deskOs.mailItems"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    @Published private(set) var items: [FiledItem] = []
    @Published private(set) var intelLines: [String] = []
    /// connectorId → ISO timestamp string (web `deskOs.connect` shape).
    @Published private(set) var connectAt: [String: String] = [:]
    @Published private(set) var events: [CalendarEvent] = []
    @Published private(set) var mail: [MailItem] = []

    init() {
        items = Self.decode([FiledItem].self, key: Self.itemsKey) ?? []
        intelLines = Self.decode([String].self, key: Self.intelKey) ?? []
        connectAt = Self.decode([String: String].self, key: Self.connectKey) ?? [:]
        // Web stores `{ id: { at: "..." } }` - accept that shape too.
        if connectAt.isEmpty, let nested = Self.decode([String: [String: String]].self, key: Self.connectKey) {
            connectAt = nested.compactMapValues { $0["at"] }
        }
        events = Self.decode([CalendarEvent].self, key: Self.eventsKey) ?? []
        mail = Self.decode([MailItem].self, key: Self.mailKey) ?? []
    }

    func connector(id: String) -> Connector? {
        Self.connectors.first { $0.id == id }
    }

    func isConnected(_ id: String) -> Bool {
        connectAt[id] != nil
    }

    /// Core desk tools linked — Connect UI then lives in `+` as placeable widgets.
    var allConnectorsLinked: Bool {
        Self.connectors.allSatisfy { isConnected($0.id) }
    }

    /// Courses that currently have at least one filed item, sorted.
    var courses: [String] {
        Array(Set(items.map(\.course))).sorted()
    }

    func items(in course: String) -> [FiledItem] {
        items.filter { $0.course == course }.sorted { $0.createdAt > $1.createdAt }
    }

    /// Heuristic classify - stands in for web `classifyFile()` until a real
    /// LLM classify call lands. Filename tokens → course guess; title from
    /// basename. Honest stub, not faked intelligence.
    func fileDrop(sourceName: String, explicitTitle: String? = nil, course: String? = nil, note: String = "") {
        let base = (sourceName as NSString).deletingPathExtension
        let trimmedTitle = explicitTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let title = trimmedTitle.isEmpty ? (base.isEmpty ? "Untitled drop" : base) : trimmedTitle
        let trimmedCourse = course?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let resolvedCourse = trimmedCourse.isEmpty
            ? Self.guessCourse(from: sourceName + " " + title)
            : trimmedCourse
        let item = FiledItem(
            id: UUID().uuidString,
            title: title,
            course: resolvedCourse,
            note: note,
            createdAt: Self.isoNow(),
            sourceName: sourceName
        )
        items.insert(item, at: 0)
        Self.encode(items, key: Self.itemsKey)
        prependIntel("Filed · \(item.title) → \(item.course)")
    }

    func addManualNote(title: String, course: String, body: String) {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let c = course.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !c.isEmpty else { return }
        fileDrop(sourceName: "", explicitTitle: t, course: c, note: body)
    }

    func prependIntel(_ line: String) {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        intelLines.insert(trimmed, at: 0)
        if intelLines.count > 40 { intelLines = Array(intelLines.prefix(40)) }
        Self.encode(intelLines, key: Self.intelKey)
    }

    /// Web `markConnected(id)` - local only, survives refresh.
    /// Also files an agent workflow hint into intel so Ask can build on it.
    @discardableResult
    func markConnected(_ id: String) -> Bool {
        guard Self.connectors.contains(where: { $0.id == id }) else { return false }
        guard connectAt[id] == nil else { return false }
        let at = Self.isoNow()
        connectAt[id] = at
        Self.encode(connectAt, key: Self.connectKey)
        if let c = connector(id: id) {
            prependIntel("Linked · \(c.title.replacingOccurrences(of: "Connect ", with: ""))")
        }
        if let tip = Self.agentHint(forConnected: Array(connectAt.keys), justLinked: id) {
            prependIntel(tip)
        }
        return true
    }

    /// Short agent recommendations from the current connector set.
    /// Connectors are enablers: mail + calendar + Moodle unlock desk workflows.
    static func agentHint(forConnected ids: [String], justLinked: String? = nil) -> String? {
        let set = Set(ids.map { $0.lowercased() })
        let linked = justLinked?.lowercased()
        if linked == "gcal" || (set.contains("gcal") && linked == nil) {
            if set.contains("gmail") {
                return "Agent · pull dues from mail into this calendar week"
            }
            return "Agent · organize this week's todos on Calendar"
        }
        if linked == "gmail" {
            if set.contains("gcal") {
                return "Agent · match inbox deadlines to Calendar, then Apply today"
            }
            return "Agent · skim inbox, file key mails into intel"
        }
        if linked == "gdrive" {
            return "Agent · Ask can read only your MindCraft Desk Drive folder"
        }
        if linked == "moodle" {
            return "Agent · file Moodle drops into Binder by course"
        }
        if set.contains("gmail") && set.contains("gcal") && set.contains("gdrive") {
            return "Agent · desk linked · Ask can use mail, calendar, and Drive folder"
        }
        if set.contains("gmail") && set.contains("gcal") && set.contains("moodle") {
            return "Agent · desk fully linked · Ask can start multi-tool workflows"
        }
        if set.contains("gmail") && set.contains("gcal") {
            return "Agent · try Ask: organize my week and open Apply today"
        }
        return nil
    }

    /// Clear a local connect mark (tap again to disconnect).
    @discardableResult
    func disconnect(_ id: String) -> Bool {
        guard connectAt[id] != nil else { return false }
        connectAt.removeValue(forKey: id)
        Self.encode(connectAt, key: Self.connectKey)
        if let c = connector(id: id) {
            prependIntel("Disconnected · \(c.title.replacingOccurrences(of: "Connect ", with: ""))")
        }
        return true
    }

    /// Link if off, unlink if on.
    @discardableResult
    func toggleConnected(_ id: String) -> Bool {
        if isConnected(id) { return disconnect(id) }
        return markConnected(id)
    }

    /// Demo calendar week - also marks Google Calendar connected (web parity).
    func loadSampleWeek() {
        replaceEvents([
            CalendarEvent(id: "e1", day: "Mon", title: "AP Chem · Stoichiometry problem set"),
            CalendarEvent(id: "e2", day: "Tue", title: "Algebra II quiz · Quadratics"),
            CalendarEvent(id: "e3", day: "Wed", title: "History essay outline due"),
            CalendarEvent(id: "e4", day: "Thu", title: "Lab report · titration"),
            CalendarEvent(id: "e5", day: "Fri", title: "ACT practice block · 45 min"),
        ])
        if markConnected("gcal") == false {
            prependIntel("Calendar · week ready")
        }
    }

    func replaceEvents(_ next: [CalendarEvent]) {
        events = next
        Self.encode(events, key: Self.eventsKey)
    }

    /// Demo school inbox - marks Gmail connected (web Mail → Sample).
    func loadSampleMail() {
        mail = [
            MailItem(id: "m1", subject: "Homework portal · Quadratic set due Fri", from: "ms.park@school.edu"),
            MailItem(id: "m2", subject: "Chem lab groups posted", from: "dr.nguyen@school.edu"),
            MailItem(id: "m3", subject: "Counseling: ACT registration reminder", from: "office@school.edu"),
        ]
        Self.encode(mail, key: Self.mailKey)
        if markConnected("gmail") == false {
            prependIntel("Mail · sample inbox refreshed")
        }
    }

    func clearAllForTesting() {
        items = []
        intelLines = []
        connectAt = [:]
        events = []
        mail = []
        Self.encode(items, key: Self.itemsKey)
        Self.encode(intelLines, key: Self.intelKey)
        Self.encode(connectAt, key: Self.connectKey)
        Self.encode(events, key: Self.eventsKey)
        Self.encode(mail, key: Self.mailKey)
    }

    static func guessCoursePublic(from text: String) -> String {
        guessCourse(from: text)
    }

    private static func guessCourse(from text: String) -> String {
        let lower = text.lowercased()
        if lower.contains("calc") || lower.contains("math") || lower.contains("algebra") { return "Math" }
        if lower.contains("phys") { return "Physics" }
        if lower.contains("chem") { return "Chemistry" }
        if lower.contains("hist") { return "History" }
        if lower.contains("eng") || lower.contains("essay") || lower.contains("lit") { return "English" }
        if lower.contains("bio") { return "Biology" }
        if lower.contains("piano") || lower.contains("music") { return "Music" }
        if lower.contains("act") { return "ACT Prep" }
        if lower.contains("job") || lower.contains("interview") || lower.contains("resume") { return "Jobs" }
        return "Inbox"
    }

    private static func isoNow() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }

    private static func decode<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard !uiTesting, let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func encode<T: Encodable>(_ value: T, key: String) {
        guard !uiTesting else { return }
        if let data = try? JSONEncoder().encode(value) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
