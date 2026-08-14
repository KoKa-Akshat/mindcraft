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
    static let folderNames = ["The Desk", "MindCraft Desk"]
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
    @Published var lastError: String?
    @Published var enableApiURL: URL?
    @Published var toast: String?

    private init() { refreshScopeStatus() }

    var isConnected: Bool { hasDriveScope && folderName != nil }

    func refreshScopeStatus() {
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            hasDriveScope = false
            return
        }
        hasDriveScope = (user.grantedScopes ?? []).contains { $0.lowercased().contains("drive") }
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
