import Foundation

/// Moodle connector — **read-only** assignments and grades for this student.
///
/// Level 2 scope (`JESSE_CENTRAL_AI_PLAN.md`): this is a data connector, not
/// an agent. It does not reason, does not converse, and does not make LLM
/// calls. Central Jesse (`JesseCallSession`) is the only student-facing
/// agent; Moodle just fetches. Intel may *display* what this client already
/// pulled. Binder may *store* a filing of it. Neither of those is this
/// connector, and this connector never writes back to Moodle.
///
/// | Can | Cannot |
/// |---|---|
/// | Read enrolled courses, assignments, grade items the student token can see | Submit work, post forum, change grades, send mail |
/// | Store a site URL + token after a successful login | Invent / sample homework when nothing is connected |
/// | Surface an honest error when the school uses SSO-only login | Touch Gmail, Calendar, Drive, or Binder |
///
/// **Auth (Moodle Mobile web services, not a guess):**
/// 1. `POST {site}/login/token.php` with `username`, `password`,
///    `service=moodle_mobile_app` → `{ "token": "…" }`.
///    SSO-only schools reject this; that's a real limitation, not a bug
///    to paper over with fake data.
/// 2. `POST {site}/webservice/rest/server.php` (`wstoken`, `wsfunction`,
///    `moodlewsrestformat=json`):
///    - `core_webservice_get_site_info` → `userid`
///    - `core_enrol_get_users_courses`
///    - `mod_assign_get_assignments`
///    - `gradereport_user_get_grade_items` (per course)
///
/// The school must have **Mobile app web services** and the **REST protocol**
/// enabled. Student-role tokens only see the calling user's own enrolments.
@MainActor
final class MoodleClient: ObservableObject {
    static let shared = MoodleClient()

    struct Assignment: Identifiable, Equatable {
        let id: String
        let courseName: String
        let name: String
        let dueLabel: String
        let submitted: Bool
    }

    struct Grade: Identifiable, Equatable {
        let id: String
        let courseName: String
        let itemName: String
        let gradeLabel: String
    }

    @Published private(set) var isBusy = false
    @Published private(set) var isConnected = false
    @Published private(set) var siteHost: String?
    @Published private(set) var assignments: [Assignment] = []
    @Published private(set) var grades: [Grade] = []
    @Published var lastError: String?

    private static let siteKey = "deskOs.moodle.site"
    private static let tokenKey = "deskOs.moodle.token"
    private static let userIdKey = "deskOs.moodle.userId"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    private var token: String?
    private var userId: Int?

    private init() {
        if Self.uiTesting { return }
        let site = UserDefaults.standard.string(forKey: Self.siteKey)
        let token = UserDefaults.standard.string(forKey: Self.tokenKey)
        let userId = UserDefaults.standard.object(forKey: Self.userIdKey) as? Int
        if let site, let token, !token.isEmpty, let userId {
            self.siteHost = site
            self.token = token
            self.userId = userId
            self.isConnected = true
        }
    }

    /// Username/password → Moodle token. Password is not persisted.
    func connect(siteURL: String, username: String, password: String) async {
        lastError = nil
        let site = Self.normalizeSite(siteURL)
        guard let site else {
            lastError = "Enter your school Moodle URL (https://moodle.school.edu)."
            return
        }
        let user = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !user.isEmpty, !password.isEmpty else {
            lastError = "Moodle username and password are both needed."
            return
        }

        isBusy = true
        defer { isBusy = false }

        do {
            let token = try await Self.requestToken(site: site, username: user, password: password)
            let info = try await Self.rest(site: site, token: token, function: "core_webservice_get_site_info")
            guard let uid = info["userid"] as? Int else {
                lastError = "Moodle signed in but didn’t return a user id."
                return
            }
            self.token = token
            self.userId = uid
            self.siteHost = site
            self.isConnected = true
            if !Self.uiTesting {
                UserDefaults.standard.set(site, forKey: Self.siteKey)
                UserDefaults.standard.set(token, forKey: Self.tokenKey)
                UserDefaults.standard.set(uid, forKey: Self.userIdKey)
            }
            await refresh()
        } catch {
            lastError = (error as? MoodleError)?.message
                ?? "Couldn’t reach Moodle. Check the URL — SSO-only schools can’t mint a mobile token this way."
        }
    }

    func disconnect() {
        token = nil
        userId = nil
        siteHost = nil
        isConnected = false
        assignments = []
        grades = []
        lastError = nil
        if !Self.uiTesting {
            UserDefaults.standard.removeObject(forKey: Self.siteKey)
            UserDefaults.standard.removeObject(forKey: Self.tokenKey)
            UserDefaults.standard.removeObject(forKey: Self.userIdKey)
        }
    }

    func refresh() async {
        guard isConnected, let site = siteHost, let token, let userId else { return }
        isBusy = true
        defer { isBusy = false }
        lastError = nil
        do {
            let coursesJSON = try await Self.rest(
                site: site,
                token: token,
                function: "core_enrol_get_users_courses",
                extra: ["userid": "\(userId)"]
            )
            let courses = Self.parseCourses(coursesJSON)
            let courseIds = courses.map(\.id)
            let assignJSON = try await Self.rest(
                site: site,
                token: token,
                function: "mod_assign_get_assignments",
                extra: Self.indexed("courseids", courseIds.map(String.init))
            )
            assignments = Self.parseAssignments(assignJSON, courses: courses)

            var nextGrades: [Grade] = []
            for course in courses.prefix(12) {
                let gradeJSON = try await Self.rest(
                    site: site,
                    token: token,
                    function: "gradereport_user_get_grade_items",
                    extra: ["courseid": "\(course.id)", "userid": "\(userId)"]
                )
                nextGrades.append(contentsOf: Self.parseGrades(gradeJSON, courseName: course.name))
            }
            grades = nextGrades
        } catch {
            lastError = (error as? MoodleError)?.message ?? "Moodle fetch failed."
        }
    }

    // MARK: - HTTP

    private struct CourseRef {
        let id: Int
        let name: String
    }

    private struct MoodleError: Error {
        let message: String
    }

    private static func normalizeSite(_ raw: String) -> String? {
        var trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        if !trimmed.contains("://") { trimmed = "https://\(trimmed)" }
        guard let url = URL(string: trimmed), let host = url.host, !host.isEmpty else { return nil }
        let scheme = url.scheme ?? "https"
        var path = url.path
        if path.hasSuffix("/") { path.removeLast() }
        return "\(scheme)://\(host)\(path)"
    }

    private static func requestToken(site: String, username: String, password: String) async throws -> String {
        guard let url = URL(string: "\(site)/login/token.php") else {
            throw MoodleError(message: "Bad Moodle URL.")
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.httpBody = form([
            "username": username,
            "password": password,
            "service": "moodle_mobile_app",
        ])
        let (data, _) = try await URLSession.shared.data(for: req)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        if let err = json["error"] as? String, !err.isEmpty {
            throw MoodleError(message: err)
        }
        guard let token = json["token"] as? String, !token.isEmpty else {
            throw MoodleError(message: "Moodle didn’t return a token. The school may require SSO instead of a mobile login.")
        }
        return token
    }

    private static func rest(site: String, token: String, function: String, extra: [String: String] = [:]) async throws -> Any {
        guard let url = URL(string: "\(site)/webservice/rest/server.php") else {
            throw MoodleError(message: "Bad Moodle URL.")
        }
        var fields = extra
        fields["wstoken"] = token
        fields["wsfunction"] = function
        fields["moodlewsrestformat"] = "json"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.httpBody = form(fields)
        let (data, _) = try await URLSession.shared.data(for: req)
        let json = try JSONSerialization.jsonObject(with: data)
        if let obj = json as? [String: Any], let msg = obj["message"] as? String, obj["exception"] != nil {
            throw MoodleError(message: msg)
        }
        return json
    }

    private static func form(_ fields: [String: String]) -> Data {
        fields.map { key, value in
            let k = key.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? key
            let v = value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
            return "\(k)=\(v)"
        }
        .joined(separator: "&")
        .data(using: .utf8) ?? Data()
    }

    private static func indexed(_ name: String, _ values: [String]) -> [String: String] {
        var out: [String: String] = [:]
        for (i, value) in values.enumerated() {
            out["\(name)[\(i)]"] = value
        }
        return out
    }

    private static func parseCourses(_ json: Any) -> [CourseRef] {
        let rows = json as? [[String: Any]] ?? []
        return rows.compactMap { row in
            guard let id = row["id"] as? Int else { return nil }
            let name = (row["fullname"] as? String) ?? (row["shortname"] as? String) ?? "Course \(id)"
            return CourseRef(id: id, name: name)
        }
    }

    private static func parseAssignments(_ json: Any, courses: [CourseRef]) -> [Assignment] {
        let names = Dictionary(uniqueKeysWithValues: courses.map { ($0.id, $0.name) })
        let root = json as? [String: Any] ?? [:]
        let courseRows = root["courses"] as? [[String: Any]] ?? []
        var out: [Assignment] = []
        for course in courseRows {
            let cid = course["id"] as? Int ?? 0
            let cname = names[cid] ?? (course["fullname"] as? String) ?? "Course"
            let assigns = course["assignments"] as? [[String: Any]] ?? []
            for row in assigns {
                let id = row["id"] as? Int ?? out.count
                let name = row["name"] as? String ?? "Assignment"
                let due = row["duedate"] as? Int ?? 0
                let dueLabel = due > 0 ? Self.dueString(TimeInterval(due)) : "No due date"
                out.append(Assignment(
                    id: "\(cid)-\(id)",
                    courseName: cname,
                    name: name,
                    dueLabel: dueLabel,
                    submitted: false
                ))
            }
        }
        return out
    }

    private static func parseGrades(_ json: Any, courseName: String) -> [Grade] {
        let root = json as? [String: Any] ?? [:]
        let usergrades = root["usergrades"] as? [[String: Any]] ?? []
        var out: [Grade] = []
        for ug in usergrades {
            let items = ug["gradeitems"] as? [[String: Any]] ?? []
            for item in items {
                let id = item["id"] as? Int ?? out.count
                let name = (item["itemname"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                guard !name.isEmpty else { continue }
                let label = (item["gradeformatted"] as? String)
                    ?? (item["percentageformatted"] as? String)
                    ?? "—"
                out.append(Grade(
                    id: "\(courseName)-\(id)",
                    courseName: courseName,
                    itemName: name,
                    gradeLabel: label
                ))
            }
        }
        return out
    }

    private static func dueString(_ epoch: TimeInterval) -> String {
        let date = Date(timeIntervalSince1970: epoch)
        let f = DateFormatter()
        f.dateFormat = "EEE d MMM"
        return f.string(from: date)
    }
}
