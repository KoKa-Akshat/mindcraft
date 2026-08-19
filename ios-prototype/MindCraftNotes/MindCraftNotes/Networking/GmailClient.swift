import Foundation
import GoogleSignIn
#if canImport(UIKit)
import UIKit
#endif

/// Student's **real Gmail** (+ Calendar read) via Google OAuth.
/// Not AgentMail. Login scopes stay openid/email/profile; these are added
/// only when the student taps Connect (or the sleeping box mascot).
///
/// Level 2 scope (`JESSE_CENTRAL_AI_PLAN.md`): this is a **data connector**,
/// not an agent. It does not reason, does not converse, and does not make
/// LLM calls. Central Jesse (`JesseCallSession`) is the only student-facing
/// agent; this client just reads/sends mail and reads the week.
///
/// | Surface | Can | Cannot |
/// |---|---|---|
/// | **Gmail (Email Summaries)** | Read inbox (`gmail.readonly`), send drafts (`gmail.send`) once `hasGmailScope` | Touch Calendar, Moodle, Drive, or Binder; invent mail |
/// | **Gcal** | Read this week's events (`calendar.readonly`) once `hasCalendarScope` | Create/edit events, send mail, or fetch Moodle |
///
/// Intel is not this connector — it only displays what Gmail/Gcal (and
/// others) already fetched. Binder is the write-target, not a permission
/// this client holds. Moodle is a separate client (`MoodleClient`).
@MainActor
final class GmailClient: ObservableObject {
    static let shared = GmailClient()

    static let gmailReadonly = "https://www.googleapis.com/auth/gmail.readonly"
    static let gmailSend = "https://www.googleapis.com/auth/gmail.send"
    static let calendarReadonly = "https://www.googleapis.com/auth/calendar.readonly"

    static let connectScopes = [gmailReadonly, gmailSend, calendarReadonly]

    struct Message: Identifiable, Equatable {
        let id: String
        var threadId: String
        var from: String
        var fromEmail: String
        var subject: String
        var snippet: String
        var dateLabel: String
        var rfcMessageId: String
    }

    struct CalendarItem: Identifiable, Equatable {
        let id: String
        let day: String
        let title: String
    }

    @Published private(set) var messages: [Message] = []
    @Published private(set) var week: [CalendarItem] = []
    @Published private(set) var isBusy = false
    @Published private(set) var hasGmailScope = false
    @Published private(set) var hasCalendarScope = false
    @Published private(set) var hasSendScope = false
    @Published var lastError: String?
    @Published var enableApiURL: URL?
    @Published var toast: String?

    /// Called after a successful inbox fetch (Field Desk pushes top mail → Intel).
    var onInboxLoaded: (([Message]) -> Void)?

    static let gmailEnableURL = URL(
        string: "https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=1024068467805"
    )!
    static let calendarEnableURL = URL(
        string: "https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=1024068467805"
    )!

    private init() {
        refreshScopeStatus()
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--ui-testing-gmail-digest") || args.contains("--ui-testing-gmail-dashboard") {
            seedForTesting(messages: Self.testingInbox)
        }
    }

    /// Shared by the Gmail overlay digest test and the Work-tile summaries test.
    static let testingInbox: [Message] = [
        Message(
            id: "1", threadId: "t1", from: "Ms. Park", fromEmail: "park@school.edu",
            subject: "Quadratic problem set due Friday",
            snippet: "Please submit problems 1-20 by Friday 3pm. Late work not accepted.",
            dateLabel: "Mon", rfcMessageId: ""
        ),
        Message(
            id: "2", threadId: "t2", from: "Dr. Nguyen", fromEmail: "nguyen@school.edu",
            subject: "Lab groups posted",
            snippet: "Check the portal for your assigned lab group for the titration experiment.",
            dateLabel: "Tue", rfcMessageId: ""
        ),
    ]

    var isConnected: Bool { hasGmailScope }

    /// Real Google session (not the UI-test seed). Dashboard uses this so
    /// it can show seeded subjects without waiting on `/api/gmail-digest`.
    var hasLiveGoogleUser: Bool {
        !isSeededForTesting && GIDSignIn.sharedInstance.currentUser != nil
    }

    /// Set once by `seedForTesting`, so `refreshScopeStatus()` (called from
    /// `GmailWorkflowBoxView.onAppear` right after a seed, among other
    /// places) doesn't immediately stomp the seeded scope back to false -
    /// there's genuinely no real `GIDSignIn` user in this environment, so
    /// the normal "no user -> no scope" path would otherwise always win.
    private var isSeededForTesting = false

    /// Test-only seam, gated to `--ui-testing-in-memory` (never reachable
    /// in a real launch): this environment can't provide a real signed-in
    /// Google account, so a UI test that needs to exercise the inbox/digest
    /// UI has no other way to get `messages` populated.
    func seedForTesting(messages: [Message]) {
        guard ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory") else { return }
        isSeededForTesting = true
        hasGmailScope = true
        self.messages = messages
    }

    /// Work dashboard calls this on appear so an already-connected Google
    /// session actually refills the Email / Gcal tiles (scopes live on
    /// GIDSignIn; inbox/week do not persist).
    func restoreSessionIfNeeded() async {
        guard !isSeededForTesting else { return }
        if GIDSignIn.sharedInstance.currentUser == nil {
            await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
                GIDSignIn.sharedInstance.restorePreviousSignIn { _, _ in
                    cont.resume()
                }
            }
        }
        refreshScopeStatus()
    }

    func refreshScopeStatus() {
        guard !isSeededForTesting else { return }
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            hasGmailScope = false
            hasCalendarScope = false
            hasSendScope = false
            return
        }
        let scopes = user.grantedScopes ?? []
        hasGmailScope = scopes.contains { $0.lowercased().contains("gmail") }
        hasSendScope = scopes.contains { $0.lowercased().contains("gmail.send") }
        hasCalendarScope = scopes.contains { $0.lowercased().contains("calendar") }
    }

    /// One Google sheet: Gmail read + send + Calendar read.
    /// Pass `force: true` to show Google again even if scopes already look granted.
    func connectGoogleMailAndCalendar(force: Bool = false) async {
        lastError = nil
        enableApiURL = nil
        refreshScopeStatus()
        if hasGmailScope && !force {
            await fetchInbox()
            return
        }

        guard let presenter = Self.topViewController() else {
            lastError = "Couldn’t open Google permission sheet."
            return
        }

        isBusy = true
        defer { isBusy = false }

        do {
            // Fresh Google sheet with mail + calendar scopes (works for first connect and reconnect).
            _ = try await Self.signIn(from: presenter, scopes: Self.connectScopes)
            refreshScopeStatus()
            if hasGmailScope {
                flash(hasCalendarScope ? "Gmail + Calendar connected" : "Gmail connected")
                await fetchInbox()
                if hasCalendarScope { _ = await fetchCalendarWeek() }
            } else {
                // Some sessions need an explicit addScopes pass after sign-in.
                if let user = GIDSignIn.sharedInstance.currentUser {
                    _ = try await Self.addScopes(Self.connectScopes, user: user, from: presenter)
                    refreshScopeStatus()
                }
                if hasGmailScope {
                    flash(hasCalendarScope ? "Gmail + Calendar connected" : "Gmail connected")
                    await fetchInbox()
                    if hasCalendarScope { _ = await fetchCalendarWeek() }
                } else {
                    lastError = "Google didn’t share mail access. Tap Connect again and allow MindCraft."
                }
            }
        } catch {
            if Self.isCancel(error) { return }
            lastError = "Couldn’t connect. Sign in with your school Google account and allow access."
        }
    }

    /// Clear local inbox UI so the student can connect again from the box / Connect card.
    func disconnectForReconnect() {
        messages = []
        lastError = nil
        enableApiURL = nil
        // Keep Google session for desk login; scopes remain until revoked in Google Account.
        // UI treats this as "needs connect" until they tap Connect again.
        hasGmailScope = false
        hasSendScope = false
        hasCalendarScope = false
        flash("Disconnected · tap Connect to link again")
    }

    func fetchInbox() async {
        guard !isSeededForTesting else { return }
        lastError = nil
        enableApiURL = nil
        refreshScopeStatus()
        guard hasGmailScope else {
            lastError = "Connect Gmail first."
            return
        }
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            lastError = "Google session missing."
            return
        }

        isBusy = true
        defer { isBusy = false }

        do {
            let refreshed = try await Self.refreshUser(user)
            let token = refreshed.accessToken.tokenString
            let list = try await Self.getJSON(
                url: URL(string: "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX")!,
                token: token
            )
            let ids = (list["messages"] as? [[String: Any]])?.compactMap { $0["id"] as? String } ?? []
            var rows: [Message] = []
            for id in ids.prefix(20) {
                let detail = try await Self.getJSON(
                    url: URL(string: "https://gmail.googleapis.com/gmail/v1/users/me/messages/\(id)?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=Reply-To")!,
                    token: token
                )
                let payload = detail["payload"] as? [String: Any]
                let headers = (payload?["headers"] as? [[String: Any]]) ?? []
                func header(_ name: String) -> String {
                    headers.first {
                        ($0["name"] as? String)?.lowercased() == name.lowercased()
                    }?["value"] as? String ?? ""
                }
                let fromRaw = header("From")
                let replyTo = header("Reply-To")
                rows.append(
                    Message(
                        id: id,
                        threadId: (detail["threadId"] as? String) ?? id,
                        from: Self.shortFrom(fromRaw),
                        fromEmail: Self.emailFrom(replyTo.isEmpty ? fromRaw : replyTo),
                        subject: header("Subject").isEmpty ? "(no subject)" : header("Subject"),
                        snippet: (detail["snippet"] as? String) ?? "",
                        dateLabel: Self.shortDate(header("Date")),
                        rfcMessageId: header("Message-ID")
                    )
                )
            }
            messages = rows
            onInboxLoaded?(rows)
            if rows.isEmpty { flash("Inbox empty") }
        } catch {
            let text = error.localizedDescription
            if text.contains("Gmail API has not been used") || text.contains("403") {
                lastError = "Mail isn’t ready to load yet. Tap Try again in a minute. If it still fails, ask your MindCraft admin to finish school mail setup."
                enableApiURL = Self.gmailEnableURL
                if let match = text.range(of: #"https://[^\s"]+"#, options: .regularExpression) {
                    let urlStr = String(text[match]).trimmingCharacters(in: CharacterSet(charactersIn: ".,"))
                    if let url = URL(string: urlStr) { enableApiURL = url }
                }
            } else {
                lastError = "Couldn’t load your inbox right now. Check your connection and try again."
            }
        }
    }

    /// Next 7 days from the student's primary Google Calendar (same OAuth session as Gmail).
    func fetchCalendarWeek() async -> [CalendarItem] {
        lastError = nil
        refreshScopeStatus()
        guard hasCalendarScope else { return [] }
        guard let user = GIDSignIn.sharedInstance.currentUser else { return [] }

        do {
            let refreshed = try await Self.refreshUser(user)
            let token = refreshed.accessToken.tokenString
            let cal = Calendar.current
            let start = cal.startOfDay(for: Date())
            guard let end = cal.date(byAdding: .day, value: 7, to: start) else { return [] }
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime]
            var comps = URLComponents(string: "https://www.googleapis.com/calendar/v3/calendars/primary/events")!
            comps.queryItems = [
                URLQueryItem(name: "timeMin", value: iso.string(from: start)),
                URLQueryItem(name: "timeMax", value: iso.string(from: end)),
                URLQueryItem(name: "singleEvents", value: "true"),
                URLQueryItem(name: "orderBy", value: "startTime"),
                URLQueryItem(name: "maxResults", value: "10"),
            ]
            guard let url = comps.url else { return [] }
            let json = try await Self.getJSON(url: url, token: token)
            let items = (json["items"] as? [[String: Any]]) ?? []
            let dayFmt = DateFormatter()
            dayFmt.dateFormat = "EEE"
            let parseISO = ISO8601DateFormatter()
            parseISO.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let parseISO2 = ISO8601DateFormatter()
            parseISO2.formatOptions = [.withInternetDateTime]
            let parseDay = DateFormatter()
            parseDay.calendar = Calendar(identifier: .gregorian)
            parseDay.locale = Locale(identifier: "en_US_POSIX")
            parseDay.dateFormat = "yyyy-MM-dd"

            let rows = items.compactMap { ev -> CalendarItem? in
                let id = (ev["id"] as? String) ?? UUID().uuidString
                let summary = (ev["summary"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
                let title = (summary?.isEmpty == false) ? summary! : "Event"
                let startObj = ev["start"] as? [String: Any]
                let date: Date?
                if let dt = startObj?["dateTime"] as? String {
                    date = parseISO.date(from: dt) ?? parseISO2.date(from: dt)
                } else if let d = startObj?["date"] as? String {
                    date = parseDay.date(from: d)
                } else {
                    date = nil
                }
                guard let when = date else { return nil }
                return CalendarItem(id: id, day: dayFmt.string(from: when), title: title)
            }
            week = rows
            return rows
        } catch {
            let text = error.localizedDescription
            if text.contains("Calendar API") || text.contains("403") {
                enableApiURL = Self.calendarEnableURL
            }
            return []
        }
    }

    /// Suggested reply the student can edit, then Send.
    func suggestedReply(for message: Message) -> String {
        let topic = message.subject
            .replacingOccurrences(of: "Re: ", with: "", options: .caseInsensitive)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return """
        Hi \(message.from.split(separator: " ").first.map(String.init) ?? "there"),

        Thanks for your email about \(topic.isEmpty ? "this" : topic).

        I’ve read your note and will follow up with a clear next step shortly. If there’s a deadline or anything urgent, reply and I’ll prioritize it.

        Best,
        """
    }

    func sendReply(to message: Message, body: String) async -> Bool {
        lastError = nil
        refreshScopeStatus()
        guard hasSendScope || hasGmailScope else {
            lastError = "Reconnect Gmail and allow send."
            return false
        }
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            lastError = "Google session missing."
            return false
        }
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            lastError = "Reply is empty."
            return false
        }
        guard !message.fromEmail.isEmpty else {
            lastError = "No reply address on that message."
            return false
        }

        isBusy = true
        defer { isBusy = false }

        do {
            let refreshed = try await Self.refreshUser(user)
            let token = refreshed.accessToken.tokenString
            let subject = message.subject.lowercased().hasPrefix("re:")
                ? message.subject
                : "Re: \(message.subject)"
            var rfc = ""
            rfc += "To: \(message.fromEmail)\r\n"
            rfc += "Subject: \(subject)\r\n"
            if !message.rfcMessageId.isEmpty {
                rfc += "In-Reply-To: \(message.rfcMessageId)\r\n"
                rfc += "References: \(message.rfcMessageId)\r\n"
            }
            rfc += "Content-Type: text/plain; charset=UTF-8\r\n"
            rfc += "\r\n"
            rfc += trimmed

            let raw = Data(rfc.utf8).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")

            var payload: [String: Any] = ["raw": raw]
            if !message.threadId.isEmpty {
                payload["threadId"] = message.threadId
            }
            _ = try await Self.postJSON(
                url: URL(string: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send")!,
                token: token,
                body: payload
            )
            flash("Sent")
            return true
        } catch {
            lastError = "Send failed. \(error.localizedDescription)"
            return false
        }
    }

    func flash(_ message: String) {
        toast = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in
            if self?.toast == message { self?.toast = nil }
        }
    }

    // MARK: - Google helpers

    private static func signIn(from presenter: UIViewController, scopes: [String]) async throws -> GIDSignInResult {
        try await withCheckedThrowingContinuation { cont in
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter, hint: nil, additionalScopes: scopes) { result, error in
                if let error { cont.resume(throwing: error) }
                else if let result { cont.resume(returning: result) }
                else { cont.resume(throwing: URLError(.badServerResponse)) }
            }
        }
    }

    private static func addScopes(
        _ scopes: [String],
        user: GIDGoogleUser,
        from presenter: UIViewController
    ) async throws -> GIDSignInResult? {
        try await withCheckedThrowingContinuation { cont in
            user.addScopes(scopes, presenting: presenter) { result, error in
                if let error { cont.resume(throwing: error) }
                else { cont.resume(returning: result) }
            }
        }
    }

    private static func refreshUser(_ user: GIDGoogleUser) async throws -> GIDGoogleUser {
        try await withCheckedThrowingContinuation { cont in
            user.refreshTokensIfNeeded { user, error in
                if let error { cont.resume(throwing: error) }
                else if let user { cont.resume(returning: user) }
                else { cont.resume(throwing: URLError(.userAuthenticationRequired)) }
            }
        }
    }

    private static func getJSON(url: URL, token: String) async throws -> [String: Any] {
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.throwIfBad(resp, data: data)
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    private static func postJSON(url: URL, token: String, body: [String: Any]) async throws -> [String: Any] {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.throwIfBad(resp, data: data)
        if data.isEmpty { return [:] }
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    private static func throwIfBad(_ resp: URLResponse, data: Data) throws {
        if let http = resp as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw NSError(
                domain: "GmailClient",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode) \(body.prefix(160))"]
            )
        }
    }

    private static func shortFrom(_ raw: String) -> String {
        if let start = raw.firstIndex(of: "<"), start > raw.startIndex {
            return String(raw[..<start]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return raw
    }

    private static func emailFrom(_ raw: String) -> String {
        if let start = raw.firstIndex(of: "<"), let end = raw.firstIndex(of: ">"), start < end {
            return String(raw[raw.index(after: start)..<end])
        }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.contains("@") ? trimmed : ""
    }

    /// Opens a real, prefilled, UNSENT compose window - never calls the
    /// Gmail REST API to create it (that needs the `gmail.compose` scope;
    /// this app only ever requested `gmail.send`, and widening the granted
    /// scope means re-consent for every already-connected student for one
    /// button). Tries the Gmail app's own compose deep link first (same
    /// account context a signed-in student already expects), falls back to
    /// the universal `mailto:` scheme (opens whatever mail app the device
    /// has configured) if Gmail isn't installed - either way, a live
    /// compose UI opens with the student in full control of Send, same
    /// posture as "we never submit applications" elsewhere in Job OS.
    @discardableResult
    func openComposeDraft(to: String, subject: String, body: String) -> Bool {
        #if canImport(UIKit)
        func encode(_ s: String) -> String {
            s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        }
        let toParam = encode(to)
        let subjectParam = encode(subject)
        let bodyParam = encode(body)

        if let gmailURL = URL(string: "googlegmail://co?to=\(toParam)&subject=\(subjectParam)&body=\(bodyParam)"),
           UIApplication.shared.canOpenURL(gmailURL) {
            UIApplication.shared.open(gmailURL)
            return true
        }
        if let mailtoURL = URL(string: "mailto:\(toParam)?subject=\(subjectParam)&body=\(bodyParam)") {
            UIApplication.shared.open(mailtoURL)
            return true
        }
        return false
        #else
        return false
        #endif
    }

    private static func shortDate(_ raw: String) -> String {
        let parts = raw.split(separator: " ")
        if parts.count >= 4 { return parts.prefix(4).joined(separator: " ") }
        return String(raw.prefix(22))
    }

    private static func isCancel(_ error: Error) -> Bool {
        let ns = error as NSError
        return ns.domain == "com.google.GIDSignIn" && ns.code == -5
    }

    private static func topViewController() -> UIViewController? {
        #if canImport(UIKit)
        let scenes = UIApplication.shared.connectedScenes
        guard let windowScene = (scenes.first { $0.activationState == .foregroundActive } as? UIWindowScene)
            ?? (scenes.first as? UIWindowScene) else { return nil }
        guard let root = windowScene.windows.first(where: \.isKeyWindow)?.rootViewController
            ?? windowScene.windows.first?.rootViewController else { return nil }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        return top
        #else
        return nil
        #endif
    }
}
