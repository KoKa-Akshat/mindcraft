import Foundation
import GoogleSignIn
import PDFKit
#if canImport(UIKit)
import UIKit
#endif

/// Folder-scoped Google Drive read. OAuth is `drive.readonly`; the app only
/// lists files inside a folder named **The Desk** (legacy: MindCraft Desk).
@MainActor
final class DriveClient: ObservableObject {
    static let shared = DriveClient()

    static let driveReadonly = "https://www.googleapis.com/auth/drive.readonly"
    /// Narrowest write scope that still lets the app manage its own
    /// archive file - grants access only to files/folders THIS app
    /// creates, never the student's other Drive content (unlike the
    /// broad `drive` scope). Separate from `driveReadonly`, which only
    /// ever reads inside the student-curated "The Desk" folder below -
    /// mixing an app-written archive into that folder would be confusing
    /// for a student who put it together themselves.
    static let driveFile = "https://www.googleapis.com/auth/drive.file"
    static let folderNames = ["The Desk", "MindCraft Desk"]
    /// Dedicated, app-owned folder for the mail archive - distinct from
    /// the read-only "The Desk" folder above.
    static let archiveFolderName = "MindCraft Mail Archive"
    static let archiveFileName = "mail_archive.json"
    static let enableURL = URL(
        string: "https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=1024068467805"
    )!

    struct DeskFile: Identifiable, Equatable {
        let id: String
        let name: String
        let mime: String
        var text: String
    }

    @Published private(set) var files: [DeskFile] = []
    @Published private(set) var folderName: String?
    @Published private(set) var isBusy = false
    @Published private(set) var hasDriveScope = false
    @Published private(set) var hasDriveFileScope = false
    @Published private(set) var isArchiving = false
    @Published var lastError: String?
    @Published var enableApiURL: URL?
    @Published var toast: String?

    private init() { refreshScopeStatus() }

    var isConnected: Bool { hasDriveScope && folderName != nil }

    func refreshScopeStatus() {
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            hasDriveScope = false
            hasDriveFileScope = false
            return
        }
        let scopes = (user.grantedScopes ?? []).map { $0.lowercased() }
        hasDriveScope = scopes.contains { $0.contains("drive") }
        hasDriveFileScope = scopes.contains { $0.contains("drive.file") || $0.contains("auth/drive ") || $0 == "https://www.googleapis.com/auth/drive" }
    }

    func connectAndReadFolder() async -> [DeskFile] {
        lastError = nil
        enableApiURL = nil
        refreshScopeStatus()

        guard let presenter = Self.topViewController() else {
            lastError = "Couldn’t open Google permission sheet."
            return []
        }

        isBusy = true
        defer { isBusy = false }

        do {
            if !hasDriveScope {
                _ = try await Self.signIn(from: presenter, scopes: [Self.driveReadonly])
                refreshScopeStatus()
                if !hasDriveScope, let user = GIDSignIn.sharedInstance.currentUser {
                    _ = try await Self.addScopes([Self.driveReadonly], user: user, from: presenter)
                    refreshScopeStatus()
                }
            }
            guard hasDriveScope else {
                lastError = "Google didn’t share Drive. Tap again and allow The Desk."
                return []
            }
            return try await readDeskFolder()
        } catch {
            if Self.isCancel(error) { return [] }
            let ns = error as NSError
            if ns.code == 403 {
                enableApiURL = Self.enableURL
                lastError = "Turn on the Drive API for this Google project, then tap again."
            } else {
                lastError = "Couldn’t connect Drive. Use the school Google account."
            }
            return []
        }
    }

    private func readDeskFolder() async throws -> [DeskFile] {
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            lastError = "Google session missing."
            return []
        }
        let token = try await Self.refreshUser(user).accessToken.tokenString

        var folderId: String?
        var foundName: String?
        for name in Self.folderNames {
            let q = "name='\(name)' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            guard let url = Self.filesURL(query: q, fields: "files(id,name)") else { continue }
            let json = try await Self.getJSON(url: url, token: token)
            if let row = (json["files"] as? [[String: Any]])?.first, let id = row["id"] as? String {
                folderId = id
                foundName = (row["name"] as? String) ?? name
                break
            }
        }

        guard let folderId, let foundName else {
            lastError = "Create a Drive folder named exactly The Desk, then tap again."
            folderName = nil
            files = []
            return []
        }

        guard let listURL = Self.filesURL(
            query: "'\(folderId)' in parents and trashed=false",
            fields: "files(id,name,mimeType)"
        ) else { return [] }

        let list = try await Self.getJSON(url: listURL, token: token)
        let rows = (list["files"] as? [[String: Any]]) ?? []
        var out: [DeskFile] = []
        for row in rows.prefix(8) {
            guard let id = row["id"] as? String else { continue }
            let name = (row["name"] as? String) ?? "file"
            let mime = (row["mimeType"] as? String) ?? ""
            let text = (try? await extractText(id: id, name: name, mime: mime, token: token)) ?? ""
            if text.count >= 40 || name.lowercased().contains("resume") || name.lowercased().contains("linkedin") {
                out.append(DeskFile(id: id, name: name, mime: mime, text: String(text.prefix(8000))))
            }
        }
        folderName = foundName
        files = out
        flash("Drive · \(foundName) · \(out.count) files")
        return out
    }

    // MARK: - Mail archive (student's own Drive as a durable data store)

    struct ArchivedEmail: Codable {
        var date: String
        var from: String
        var subject: String
        var snippet: String
        var why: String
    }

    /// Appends `messages` (already-fetched inbox previews, paired with the
    /// AI digest's per-message reasoning where available) to a single
    /// growing JSON log in a dedicated, app-owned Drive folder - "the
    /// emails... like a data moat in their own Google Drive": durable,
    /// student-owned, outside MindCraft's own backend. Requests
    /// `drive.file` the first time (separate from `driveReadonly`, which
    /// this feature doesn't need at all - archiving doesn't read "The
    /// Desk" folder). Read-modify-write, not a true API-level append:
    /// `drive.file` scope only ever sees files this app itself created, so
    /// reading the existing archive back to merge new entries in is safe
    /// and always available to a session that holds the scope.
    @discardableResult
    func archiveEmails(_ messages: [GmailClient.Message], digest: GmailDigestClient.Digest?) async -> Bool {
        lastError = nil
        refreshScopeStatus()
        guard let presenter = Self.topViewController() else {
            lastError = "Couldn't open Google permission sheet."
            return false
        }

        isArchiving = true
        defer { isArchiving = false }

        do {
            if !hasDriveFileScope {
                _ = try await Self.signIn(from: presenter, scopes: [Self.driveFile])
                refreshScopeStatus()
                if !hasDriveFileScope, let user = GIDSignIn.sharedInstance.currentUser {
                    _ = try await Self.addScopes([Self.driveFile], user: user, from: presenter)
                    refreshScopeStatus()
                }
            }
            guard hasDriveFileScope else {
                lastError = "Google didn't share Drive write access. Tap again and allow The Desk."
                return false
            }
            guard let user = GIDSignIn.sharedInstance.currentUser else {
                lastError = "Google session missing."
                return false
            }
            let token = try await Self.refreshUser(user).accessToken.tokenString

            let why: [String: String] = Dictionary(
                uniqueKeysWithValues: ((digest?.actionItems ?? []) + (digest?.fyi ?? [])).map { ($0.subject, $0.why) }
            )
            let newEntries = messages.map {
                ArchivedEmail(date: $0.dateLabel, from: $0.from, subject: $0.subject, snippet: $0.snippet, why: why[$0.subject] ?? "")
            }

            let folderId = try await findOrCreateFolder(name: Self.archiveFolderName, token: token)
            let (fileId, existing) = try await findOrCreateArchiveFile(in: folderId, token: token)

            // Dedupe on (from, subject, date) so re-archiving the same
            // fetched inbox (e.g. a second "Archive to Drive" tap) doesn't
            // pile up duplicate entries.
            var seen = Set(existing.map { "\($0.from)|\($0.subject)|\($0.date)" })
            var merged = existing
            for entry in newEntries {
                let key = "\(entry.from)|\(entry.subject)|\(entry.date)"
                guard !seen.contains(key) else { continue }
                seen.insert(key)
                merged.append(entry)
            }

            let data = try JSONEncoder().encode(merged)
            try await Self.uploadMedia(fileId: fileId, data: data, token: token)
            flash("Archived \(newEntries.count) email\(newEntries.count == 1 ? "" : "s") to Drive")
            return true
        } catch {
            if Self.isCancel(error) { return false }
            lastError = "Couldn't archive to Drive right now."
            return false
        }
    }

    private func findOrCreateFolder(name: String, token: String) async throws -> String {
        let q = "name='\(name)' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if let url = Self.filesURL(query: q, fields: "files(id,name)") {
            let json = try await Self.getJSON(url: url, token: token)
            if let row = (json["files"] as? [[String: Any]])?.first, let id = row["id"] as? String {
                return id
            }
        }
        let created = try await Self.postJSON(
            url: URL(string: "https://www.googleapis.com/drive/v3/files")!,
            token: token,
            body: ["name": name, "mimeType": "application/vnd.google-apps.folder"]
        )
        guard let id = created["id"] as? String else {
            throw NSError(domain: "DriveClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "Couldn't create archive folder"])
        }
        return id
    }

    /// Returns the file id and its currently-stored entries (empty if the
    /// file was just created).
    private func findOrCreateArchiveFile(in folderId: String, token: String) async throws -> (String, [ArchivedEmail]) {
        let q = "name='\(Self.archiveFileName)' and '\(folderId)' in parents and trashed=false"
        if let url = Self.filesURL(query: q, fields: "files(id,name)") {
            let json = try await Self.getJSON(url: url, token: token)
            if let row = (json["files"] as? [[String: Any]])?.first, let id = row["id"] as? String {
                let mediaURL = URL(string: "https://www.googleapis.com/drive/v3/files/\(id)?alt=media")!
                let text = (try? await Self.getText(url: mediaURL, token: token)) ?? ""
                let existing = (try? JSONDecoder().decode([ArchivedEmail].self, from: Data(text.utf8))) ?? []
                return (id, existing)
            }
        }
        let created = try await Self.postJSON(
            url: URL(string: "https://www.googleapis.com/drive/v3/files")!,
            token: token,
            body: ["name": Self.archiveFileName, "parents": [folderId], "mimeType": "application/json"]
        )
        guard let id = created["id"] as? String else {
            throw NSError(domain: "DriveClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "Couldn't create archive file"])
        }
        return (id, [])
    }

    private static func uploadMedia(fileId: String, data: Data, token: String) async throws {
        var req = URLRequest(url: URL(string: "https://www.googleapis.com/upload/drive/v3/files/\(fileId)?uploadType=media")!)
        req.httpMethod = "PATCH"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = data
        let (respData, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let body = String(data: respData, encoding: .utf8) ?? ""
            throw NSError(domain: "DriveClient", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: "Upload failed \(body.prefix(120))"])
        }
    }

    private func extractText(id: String, name: String, mime: String, token: String) async throws -> String {
        if mime == "application/vnd.google-apps.document" {
            let url = URL(string: "https://www.googleapis.com/drive/v3/files/\(id)/export?mimeType=text/plain")!
            return try await Self.getText(url: url, token: token)
        }
        if mime == "text/plain" || name.lowercased().hasSuffix(".txt") {
            let url = URL(string: "https://www.googleapis.com/drive/v3/files/\(id)?alt=media")!
            return try await Self.getText(url: url, token: token)
        }
        if mime == "application/pdf" || name.lowercased().hasSuffix(".pdf") {
            let url = URL(string: "https://www.googleapis.com/drive/v3/files/\(id)?alt=media")!
            let data = try await Self.getData(url: url, token: token)
            return Self.pdfText(data)
        }
        return ""
    }

    private static func pdfText(_ data: Data) -> String {
        guard let doc = PDFDocument(data: data) else { return "" }
        var out = ""
        for i in 0..<doc.pageCount {
            out += doc.page(at: i)?.string ?? ""
            out += "\n"
            if out.count > 8000 { break }
        }
        return out
    }

    private static func filesURL(query: String, fields: String) -> URL? {
        var c = URLComponents(string: "https://www.googleapis.com/drive/v3/files")
        c?.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "pageSize", value: "20"),
            URLQueryItem(name: "fields", value: fields),
            URLQueryItem(name: "supportsAllDrives", value: "true"),
            URLQueryItem(name: "includeItemsFromAllDrives", value: "true"),
        ]
        return c?.url
    }

    func flash(_ message: String) {
        toast = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in
            if self?.toast == message { self?.toast = nil }
        }
    }

    private static func signIn(from presenter: UIViewController, scopes: [String]) async throws -> GIDSignInResult {
        try await withCheckedThrowingContinuation { cont in
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter, hint: nil, additionalScopes: scopes) { result, error in
                if let error { cont.resume(throwing: error) }
                else if let result { cont.resume(returning: result) }
                else { cont.resume(throwing: URLError(.badServerResponse)) }
            }
        }
    }

    private static func addScopes(_ scopes: [String], user: GIDGoogleUser, from presenter: UIViewController) async throws -> GIDSignInResult? {
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
        let data = try await getData(url: url, token: token)
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    private static func getText(url: URL, token: String) async throws -> String {
        let data = try await getData(url: url, token: token)
        return String(data: data, encoding: .utf8) ?? ""
    }

    private static func postJSON(url: URL, token: String, body: [String: Any]) async throws -> [String: Any] {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let respBody = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "DriveClient", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode) \(respBody.prefix(160))"])
        }
        if data.isEmpty { return [:] }
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    private static func getData(url: URL, token: String) async throws -> Data {
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let body = String(data: data, encoding: .utf8) ?? ""
            if http.statusCode == 403 {
                throw NSError(domain: "DriveClient", code: 403, userInfo: [NSLocalizedDescriptionKey: "Drive API off. \(body.prefix(80))"])
            }
            throw NSError(domain: "DriveClient", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode)"])
        }
        return data
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
