import Foundation
import WebKit

/// Serves bundled web surfaces to WKWebView over a custom `mcworld://`
/// scheme — the app owns them fully, no remote hosting, no cache-busting.
///
/// `mcworld://kitchen/index.html?embed=1&desk=1` → `<bundle>/world2/index.html`
/// `mcworld://desk/desk.html`                    → `<bundle>/deskweb/desk.html`
final class KitchenSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "mcworld"

    /// Tasks WebKit has stopped — never call back into them (NSException risk).
    private var stoppedTasks = Set<ObjectIdentifier>()
    private let lock = NSLock()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let isDesk = urlSchemeTask.request.url?.host?.lowercased() == "desk"
        let folder = isDesk ? "deskweb" : "world2"
        guard
            let url = urlSchemeTask.request.url,
            let root = Bundle.main.resourceURL?.appendingPathComponent(folder, isDirectory: true)
        else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        var relPath = url.path
        if relPath.isEmpty || relPath == "/" { relPath = isDesk ? "/desk.html" : "/index.html" }
        // Resolve and confine to the bundled folder.
        let fileURL = root.appendingPathComponent(String(relPath.dropFirst())).standardizedFileURL
        guard fileURL.path.hasPrefix(root.standardizedFileURL.path) else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        let taskID = ObjectIdentifier(urlSchemeTask)

        // Models/textures run tens of MB — read off-main, reply on main.
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let data = try? Data(contentsOf: fileURL)
            DispatchQueue.main.async {
                guard let self, !self.isStopped(taskID) else { return }
                if let data {
                    let headers = [
                        "Content-Type": Self.mimeType(for: fileURL.pathExtension.lowercased()),
                        "Content-Length": String(data.count),
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "no-cache",
                    ]
                    let response = HTTPURLResponse(
                        url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers
                    )!
                    urlSchemeTask.didReceive(response)
                    urlSchemeTask.didReceive(data)
                    urlSchemeTask.didFinish()
                } else {
                    // Soft 404 (favicons, optional assets) — keep the page alive.
                    let response = HTTPURLResponse(
                        url: url, statusCode: 404, httpVersion: "HTTP/1.1",
                        headerFields: ["Content-Length": "0"]
                    )!
                    urlSchemeTask.didReceive(response)
                    urlSchemeTask.didFinish()
                }
                self.forget(taskID)
            }
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock()
        stoppedTasks.insert(ObjectIdentifier(urlSchemeTask))
        lock.unlock()
    }

    private func isStopped(_ id: ObjectIdentifier) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return stoppedTasks.contains(id)
    }

    private func forget(_ id: ObjectIdentifier) {
        lock.lock()
        stoppedTasks.remove(id)
        lock.unlock()
    }

    private static func mimeType(for ext: String) -> String {
        switch ext {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json", "map": return "application/json"
        case "webmanifest": return "application/manifest+json"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "gif": return "image/gif"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "glb": return "model/gltf-binary"
        case "gltf": return "model/gltf+json"
        case "bin", "drc": return "application/octet-stream"
        case "wasm": return "application/wasm"
        case "basis", "ktx2": return "application/octet-stream"
        case "mp3": return "audio/mpeg"
        case "ogg": return "audio/ogg"
        case "wav": return "audio/wav"
        case "m4a": return "audio/mp4"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf": return "font/ttf"
        case "txt", "md": return "text/plain"
        default: return "application/octet-stream"
        }
    }
}
