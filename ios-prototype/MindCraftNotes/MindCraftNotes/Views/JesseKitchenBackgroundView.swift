import SwiftUI
import WebKit

enum KitchenDeskAction: String {
    case wakeJesse
    case intel
    case connect
    case binder
    case memo
    case calendar
    case projects
    case notes
    case doc
    case gmail
    case gcal
    /// Polka vending screen tapped — enter the standalone Desk.
    case openDesk
}

/// Live Jesse’s Kitchen as the Field Desk space — full-bleed WebGL, auto-entered.
/// Sign taps post `deskAction` messages to open native panels.
struct JesseKitchenBackgroundView: UIViewRepresentable {
    var soundEnabled: Bool = false
    var onDeskAction: ((KitchenDeskAction) -> Void)?

    /// True when the world2 kitchen ships inside this app bundle.
    static var bundledKitchenAvailable: Bool {
        guard let root = Bundle.main.resourceURL else { return false }
        return FileManager.default.fileExists(
            atPath: root.appendingPathComponent("world2/index.html").path
        )
    }

    static var kitchenURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.jesseKitchenURL"),
           let url = URL(string: override) {
            return url
        }
        // Fully ours: serve the bundled world over mcworld:// (no remote host).
        if bundledKitchenAvailable {
            return URL(string: "\(KitchenSchemeHandler.scheme)://kitchen/index.html?embed=1&desk=1&v=local")!
        }
        var comps = URLComponents(string: "https://mindcraft-world1.web.app/")!
        comps.queryItems = [
            URLQueryItem(name: "embed", value: "1"),
            URLQueryItem(name: "desk", value: "1"),
            URLQueryItem(name: "v", value: "desk-zoom-8"),
        ]
        return comps.url!
    }

    /// Ask the live kitchen to leave any projects camera pose cleanly.
    static func exitProjectsCamera() {
        NotificationCenter.default.post(name: .mcKitchenExitProjects, object: nil)
    }

    var url: URL = Self.kitchenURL

    func makeCoordinator() -> Coordinator {
        Coordinator(onDeskAction: onDeskAction, soundEnabled: soundEnabled)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        // Bundled kitchen: mcworld:// serves world2/ straight from the app.
        config.setURLSchemeHandler(KitchenSchemeHandler(), forURLScheme: KitchenSchemeHandler.scheme)
        // Weak proxy — prevents WKWebView retain-cycle crashes on reopen.
        let proxy = WeakScriptMessageHandler(delegate: context.coordinator)
        context.coordinator.messageProxy = proxy
        config.userContentController.add(proxy, name: "deskAction")

        let boot = WKUserScript(
            source: Self.deskBootJavaScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(boot)

        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = true
        view.isUserInteractionEnabled = true
        view.backgroundColor = UIColor(red: 5/255, green: 10/255, blue: 8/255, alpha: 1)
        view.scrollView.backgroundColor = UIColor(red: 5/255, green: 10/255, blue: 8/255, alpha: 1)
        view.scrollView.isScrollEnabled = false
        view.scrollView.bounces = false
        view.scrollView.delaysContentTouches = false
        view.scrollView.canCancelContentTouches = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.navigationDelegate = context.coordinator
        if #available(iOS 16.4, *) {
            view.isInspectable = true
        }
        view.accessibilityIdentifier = "fieldDeskJesseKitchen"
        context.coordinator.webView = view
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 60)
        view.load(request)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onDeskAction = onDeskAction
        if context.coordinator.soundEnabled != soundEnabled {
            context.coordinator.soundEnabled = soundEnabled
            context.coordinator.applySound(uiView)
        }
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.stopLoading()
        uiView.navigationDelegate = nil
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "deskAction")
        coordinator.messageProxy = nil
        coordinator.webView = nil
        coordinator.enterTimer?.invalidate()
    }

    private static let deskBootJavaScript = """
    (function () {
      window.__MC_KITCHEN_MUTED__ = true;
      try {
        document.documentElement.classList.add('mc-desk-bg');
        var css = document.createElement('style');
        css.id = 'mc-desk-boot-css';
        css.textContent = [
          'html.mc-desk-bg, html.mc-desk-bg body { background:#050a08 !important; }',
          'html.mc-desk-bg #mc-badge,',
          'html.mc-desk-bg #mc-booking-link,',
          'html.mc-desk-bg .mc-cue,',
          'html.mc-desk-bg .mc-top-actions,',
          'html.mc-desk-bg .mc-booking-btn,',
          'html.mc-desk-bg #cooking,',
          'html.mc-desk-bg h1 { display:none !important; opacity:0 !important; pointer-events:none !important; }',
          // Invisible Start must NOT steal Projects / kitchen taps.
          'html.mc-desk-bg .start, html.mc-desk-bg .start.fadeIn, html.mc-desk-bg .start.fadeOut { opacity:0 !important; color:transparent !important; pointer-events:none !important; }',
          'html.mc-desk-bg .overlay { background:#050a08 !important; pointer-events:none !important; }',
          'html.mc-desk-bg canvas.webgl { width:100% !important; height:100% !important; display:block !important; pointer-events:auto !important; z-index:1 !important; }',
          'html.mc-desk-bg .mc-desk-sign-label,',
          'html.mc-desk-bg #mc-desk-label-wake-jesse,',
          'html.mc-desk-bg #mc-desk-label-connect { display:none !important; opacity:0 !important; pointer-events:none !important; }'
        ].join('');
        (document.head || document.documentElement).appendChild(css);
      } catch (e) {}

      function forceMute() {
        // Never fight an explicit unmute from the Field Desk volume control.
        if (window.__MC_KITCHEN_MUTED__ === false) return;
        try {
          window.__MC_KITCHEN_MUTED__ = true;
          if (window.Howler) { window.Howler.mute(true); window.Howler.volume(0); }
          if (window.experience && window.experience.sounds) window.experience.sounds.muted = true;
          if (typeof window.MC_setKitchenAudio === 'function') {
            window.MC_setKitchenAudio({ muted: true, volume: 0 });
          }
        } catch (e) {}
      }
      forceMute();
      var muteTries = 0;
      var muteTimer = setInterval(function () {
        muteTries += 1;
        if (window.__MC_KITCHEN_MUTED__ === false) {
          clearInterval(muteTimer);
          return;
        }
        forceMute();
        if (muteTries > 80) clearInterval(muteTimer);
      }, 250);

      // Strip About / Credits / Articles lettering the instant ramenShop exists.
      var stripTries = 0;
      var stripTimer = setInterval(function () {
        stripTries += 1;
        try {
          var rs = window.experience && window.experience.controller && window.experience.controller.ramenShop;
          if (rs) {
            ;['aboutMeBlack','aboutMeBlue','creditsBlack','creditsOrange','articlesRed','articlesWhite'].forEach(function (n) {
              if (rs[n]) rs[n].visible = false;
            });
            rs.__mcSignsStripped = true;
            document.querySelectorAll('.mc-desk-sign-label,#mc-desk-label-wake-jesse,#mc-desk-label-connect').forEach(function (el) {
              if (el && el.parentNode) el.parentNode.removeChild(el);
            });
            if (stripTries > 8) clearInterval(stripTimer);
          }
        } catch (e) {}
        if (stripTries > 200) clearInterval(stripTimer);
      }, 40);
    })();
    """

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var onDeskAction: ((KitchenDeskAction) -> Void)?
        var soundEnabled: Bool
        var messageProxy: WeakScriptMessageHandler?
        weak var webView: WKWebView?
        private var enterAttempts = 0
        var enterTimer: Timer?
        private var exitProjectsObserver: NSObjectProtocol?

        init(onDeskAction: ((KitchenDeskAction) -> Void)?, soundEnabled: Bool) {
            self.onDeskAction = onDeskAction
            self.soundEnabled = soundEnabled
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "deskAction" else { return }
            let raw: String?
            if let dict = message.body as? [String: Any] {
                raw = dict["action"] as? String
            } else {
                raw = message.body as? String
            }
            guard let raw,
                  let action = KitchenDeskAction(rawValue: raw) ?? KitchenDeskAction(rawValue: raw.lowercased())
                    ?? (raw == "wakeJesse" ? .wakeJesse : nil)
            else { return }
            DispatchQueue.main.async {
                self.onDeskAction?(action == .intel ? .wakeJesse : action)
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            kickAutoEnter(webView)
            applySound(webView)
            enterTimer?.invalidate()
            enterAttempts = 0
            // Root cause of the cold-load "unresponsive until I tap Projects"
            // bug: this used to give up after 10 tries (~4s). `kickAutoEnter`'s
            // JS is fully idempotent past the first successful tick — the
            // Start click and camera pose are each behind their own one-shot
            // guard (`__MC_DESK_ENTERED__` / `__MC_DESK_CAM_SET__`) — so
            // retrying longer never re-yanks the camera once it's entered,
            // it only widens the window to catch a slow *first* load (cold
            // cache: WebGL/texture assets not yet ready when the 3D scene's
            // own Start button appears). On a cold login that took longer
            // than ~4s to get there, the retry loop expired before the
            // custom camera pose / Start click ever fired, leaving the
            // kitchen camera parked off the intended framing — most signs
            // sat out of the tappable frame while whatever was still in
            // view (e.g. Projects) kept working, reading as "nothing
            // responds until I click Projects." Stays capped (not infinite)
            // so a genuinely broken remote host still gives up eventually.
            enterTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self, weak webView] timer in
                guard let self, let webView else {
                    timer.invalidate()
                    return
                }
                self.enterAttempts += 1
                self.kickAutoEnter(webView)
                if self.enterAttempts % 2 == 0 { self.applySound(webView) }
                // Stop once entered (see the `ok` completion below), or after
                // ~36s covers even a slow first-ever cold load.
                if self.enterAttempts > 90 { timer.invalidate() }
            }
            if let exitProjectsObserver {
                NotificationCenter.default.removeObserver(exitProjectsObserver)
            }
            exitProjectsObserver = NotificationCenter.default.addObserver(
                forName: .mcKitchenExitProjects,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.webView?.evaluateJavaScript(
                    "(function(){ try { if (window.MC_exitProjects) window.MC_exitProjects(); } catch (e) {} })();",
                    completionHandler: nil
                )
            }
        }

        deinit {
            if let exitProjectsObserver {
                NotificationCenter.default.removeObserver(exitProjectsObserver)
            }
            enterTimer?.invalidate()
        }

        func applySound(_ webView: WKWebView) {
            let muted = !soundEnabled
            let js = """
            (function () {
              window.__MC_KITCHEN_MUTED__ = \(muted ? "true" : "false");
              try {
                if (typeof window.MC_setKitchenAudio === 'function') {
                  return window.MC_setKitchenAudio({ muted: \(muted ? "true" : "false"), volume: \(muted ? "0" : "0.7") });
                }
                if (window.Howler) {
                  window.Howler.mute(\(muted ? "true" : "false"));
                  window.Howler.volume(\(muted ? "0" : "0.7"));
                  if (!\(muted ? "true" : "false") && window.Howler.ctx && window.Howler.ctx.resume) window.Howler.ctx.resume();
                }
                if (window.experience && window.experience.sounds) {
                  window.experience.sounds.muted = \(muted ? "true" : "false");
                  if (!\(muted ? "true" : "false") && window.experience.sounds.playCooking) {
                    try { window.experience.sounds.playCooking(); } catch (e) {}
                  }
                }
              } catch (e) {}
              return { muted: !!window.__MC_KITCHEN_MUTED__ };
            })();
            """
            webView.evaluateJavaScript(js, completionHandler: nil)
        }

        private func kickAutoEnter(_ webView: WKWebView) {
            let js = """
            (function () {
              document.documentElement.classList.add('mc-desk-bg');
              if (document.body) document.body.classList.add('mc-desk-bg');
              var cooking = document.getElementById('cooking');
              if (cooking) cooking.style.display = 'none';
              var btn = document.querySelector('.start') || document.getElementById('mc-start-btn');
              if (btn && !window.__MC_DESK_ENTERED__) {
                if (btn.style.display === 'inline' || btn.classList.contains('fadeIn') || getComputedStyle(btn).display !== 'none') {
                  window.__MC_DESK_ENTERED__ = true;
                  try { btn.click(); } catch (e) {}
                }
              }
              // Always neutralize Start after enter — it was an invisible full-center hit sink.
              if (btn) {
                btn.style.pointerEvents = 'none';
                btn.style.display = 'none';
                btn.setAttribute('aria-hidden', 'true');
              }
              try {
                var exp = window.experience;
                if (exp && exp.sizes && exp.sizes.resize) exp.sizes.resize();
                if (exp && exp.controller && exp.controller.logic) {
                  exp.controller.logic.mode = 'menu';
                  exp.controller.logic.buttonsLocked = false;
                }
                var rs = exp && exp.controller && exp.controller.ramenShop;
                if (rs) {
                  ;['aboutMeBlack','aboutMeBlue','creditsBlack','creditsOrange','articlesRed','articlesWhite'].forEach(function (n) {
                    if (rs[n]) rs[n].visible = false;
                  });
                  rs.__mcSignsStripped = true;
                }
                document.querySelectorAll('.mc-desk-sign-label,#mc-desk-label-wake-jesse,#mc-desk-label-connect').forEach(function (el) {
                  if (el && el.parentNode) el.parentNode.removeChild(el);
                });
                // Straight-on ramen face, slightly zoomed out (once).
                if (!window.__MC_DESK_CAM_SET__ && exp && exp.camera && exp.camera.instance && exp.camera.controls) {
                  window.__MC_DESK_CAM_SET__ = true;
                  var p = exp.camera.instance.position;
                  var t = exp.camera.controls.target;
                  p.x = -10.8; p.y = 0.35; p.z = -7.6;
                  t.x = 0.05; t.y = -0.15; t.z = -1.0;
                  if (exp.camera.camAngle && exp.camera.camAngle.default) exp.camera.camAngle.default();
                  if (exp.camera.controls.update) exp.camera.controls.update();
                  exp.camera.controls.enableRotate = true;
                  exp.camera.controls.enableZoom = true;
                }
                var canvas = document.querySelector('canvas.webgl');
                if (canvas) { canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.pointerEvents = 'auto'; }
                if (window.__MC_KITCHEN_MUTED__ !== false) {
                  if (window.Howler) { window.Howler.mute(true); window.Howler.volume(0); }
                  if (exp && exp.sounds) exp.sounds.muted = true;
                }
              } catch (e) {}
              return !!(window.__MC_DESK_ENTERED__);
            })();
            """
            webView.evaluateJavaScript(js) { [weak self] result, _ in
                if let ok = result as? Bool, ok {
                    self?.enterTimer?.invalidate()
                    NotificationCenter.default.post(name: .mcKitchenReady, object: nil)
                }
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            let host = url.host?.lowercased() ?? ""
            // Keep the kitchen inside the desk WebView — never bounce to dashboard/login.
            if host.contains("mindcraft-93858") || host.contains("localhost") || url.path.contains("dashboard") || url.path.contains("login") {
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

extension Notification.Name {
    static let mcKitchenExitProjects = Notification.Name("mcKitchenExitProjects")
    static let mcKitchenReady = Notification.Name("mcKitchenReady")
    /// Work-area Manage button → hub page (tutors map + workflow market).
    static let mcOpenHubFromDesk = Notification.Name("mcOpenHubFromDesk")
}

/// Breaks WKWebView ↔ coordinator retain cycles that crash on Field Desk reopen.
final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
