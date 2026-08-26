import SwiftUI
import WebKit
import FirebaseAuth

/// Jesse archive workflow — live `/desk-os/workflows/archive/`. Textbook
/// cards, story-color workspace boxes, book reader with Dan McCreary's
/// live MicroSims, and a time/interest study plan. Same WKWebView-bridge
/// shape as `ResumeAgentView` - the desk-os HTML/JS is the source of truth,
/// this is just the native shell around it.
struct ArchiveWorkflowView: View {
    var onClose: () -> Void

    @EnvironmentObject private var jesseCall: JesseCallSession

    // Real `/recommend` (mode: exam) weakness signal - same source
    // DashboardView's "today's spark" badge reads (`RouteClient.fetchExamProfile()`).
    // Threaded into the web agent as soft context only: the deterministic
    // mastery engine stays the source of truth for WHAT is weak, Jesse (the
    // LLM in archive-rag.ts) decides in language whether it's worth
    // mentioning at all, never forced into an unrelated answer.
    @State private var weakness: (id: String, label: String)?
    /// startCall() began the shared JesseCallSession but nothing ever showed
    /// it - a real gap (calling Jesse here produced no visible transcript
    /// at all). Same JesseCallSheetView already used at the Hub and from
    /// the Flows dock.
    @State private var showJesseCallSheet = false

    /// Consolidates Dan McCreary's archive (the existing web page) with the
    /// real, validated book concept graphs built tonight - explicit ask:
    /// "Archive for browsing Dan's archive + the books we built." ACT Field
    /// Book is NOT folded in here - it already has its own real, working
    /// entry point inside Binder's popup, and relocating it wasn't a clear
    /// win worth the risk of breaking that existing path; flagging this
    /// scoping call rather than silently doing it or silently skipping it.
    ///
    /// `.simulations` added 2026-08-22 per explicit live ask: "all the
    /// simulations we have should also be shown on the archive... the
    /// simulations first... then there's a little toggle at the top which
    /// changes it to book view." Real, gated sims already exist per-concept
    /// on every Chapter Library book (`AssembledBookSection.simHtml`,
    /// `BookLibraryClient`) — this just surfaces them directly instead of
    /// requiring a teacher to open a whole book to find one. Listed FIRST
    /// (and set as the default tab below) to match "simulations first."
    // `.books` (bundled book-concept-graph browser) removed 2026-08-23,
    // explicit ask: "remove the books completely from the archive and keep
    // just simulations" - real thin/placeholder content compared to the
    // real sims here, and `LearnStudioView`'s own "Study a Book" picker
    // already covers the same underlying data for anyone who wants it.
    private enum ArchiveTab: String, CaseIterable, Identifiable {
        case simulations = "Simulations"
        case dan = "Dan's Archive"
        var id: String { rawValue }
    }
    @State private var tab: ArchiveTab = .simulations

    var body: some View {
        // No wrapper .accessibilityIdentifier on the outer ZStack: applying
        // one to a composite view like this clobbers the identifier of the
        // nested Done button below it (confirmed via a real UI test - the
        // button rendered and worked, but XCUITest queries for either
        // identifier failed until this wrapper identifier was removed; same
        // pattern already documented on SchedulingWorkflowsView).
        ZStack(alignment: .top) {
            Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255).ignoresSafeArea()
            switch tab {
            case .simulations:
                ArchiveSimulationsBrowseView()
            case .dan:
                ArchiveWorkflowWebView(weakness: weakness)
                    .ignoresSafeArea()
            }
            VStack {
                Picker("", selection: $tab) {
                    ForEach(ArchiveTab.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(width: 420)
                .padding(.top, 12)
                .accessibilityIdentifier("archiveTabPicker")
                Spacer()
            }
            VStack {
                HStack(spacing: 8) {
                    Spacer()
                    // Native call - genuinely separate from the WKWebView's
                    // own "meet" screen (JS Web Speech API, dies with this
                    // view). This one keeps running via JesseCallSession
                    // even after Done is tapped.
                    Button(action: startCall) {
                        Label(jesseCall.isActive ? "On call" : "Call Jesse", systemImage: "phone.fill")
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Capsule().fill(jesseCall.isActive ? Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255) : Color.white.opacity(0.94)))
                    }
                    .buttonStyle(.plain)
                    .disabled(jesseCall.isActive)
                    .accessibilityIdentifier("archiveCallJesse")

                    Button(action: onClose) {
                        Text("Done")
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Capsule().fill(Color.white.opacity(0.94)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("archiveWorkflowBack")
                    .accessibilityLabel("Done")
                }
                .padding(.top, 12)
                .padding(.trailing, 16)
                Spacer()
            }
        }
        .statusBarHidden(true)
        .task { await loadWeakness() }
        .sheet(isPresented: $showJesseCallSheet) {
            JesseCallSheetView(
                call: jesseCall,
                onClose: { showJesseCallSheet = false },
                onEnd: {
                    jesseCall.end()
                    showJesseCallSheet = false
                }
            )
        }
    }

    private func startCall() {
        jesseCall.begin(context: "archive", studentWeakness: weakness.map { (conceptId: $0.id, label: $0.label) })
        showJesseCallSheet = true
    }

    /// Doesn't block or delay the web view's own load - resolves in the
    /// background (HF Space cold start can take seconds) and is injected
    /// into the page whenever it lands, before or after `didFinish`. A
    /// student with no evidence yet, or if the call fails, simply gets the
    /// archive with no weakness context - never a blocking spinner over Jesse.
    private func loadWeakness() async {
        guard let profile = await RouteClient.fetchExamProfile(),
              let worst = profile.topWeaknesses.min(by: { $0.strength < $1.strength })
        else { return }
        let displays = TocDataLoader.loadConceptDisplays()
        let label = displays[worst.conceptId]?.label
            ?? worst.conceptId.replacingOccurrences(of: "_", with: " ").capitalized
        weakness = (id: worst.conceptId, label: label)
    }
}

/// "Simulations first" browse view — explicit live ask, 2026-08-22: "all
/// the simulations we have should also be shown on the archive... the
/// simulations first, where teachers can write simulations and pull one to
/// use for their classes." Shows the full three-store union
/// `ArchiveSimsLoader.loadAll()` now produces (Chapter Library book sims +
/// the generated_sims library + Dan McCreary's extracted MicroSim corpus —
/// see that loader's doc comment for the data bug the union fixed), instead
/// of requiring a teacher to open a whole book to find a sim inside it.
///
/// Honest scope note: "pull one to use for their classes" reuses the real,
/// existing Binder mechanism (`BinderStore.addChapterBook`) — Binder has no
/// concept of a standalone, single-simulation item today, only a book
/// pointer, so "using" a sim files its WHOLE book into the Binder (the sim
/// itself is one page inside it). Building true per-simulation Binder items
/// would need a new item type and Firestore rule/shape change; not done
/// here without that being a deliberate call, not a silent gap. Similarly,
/// "teachers can write simulations" routes to the same real, on-demand,
/// gated generation pipeline Jesse's Tier-3 fallback already uses
/// (`BookGenerationClient`) rather than a from-scratch authoring tool —
/// teachers describe a topic in plain language, the same real pipeline
/// (fit check -> generate -> render -> gate) builds it.
private struct ArchiveSimulationsBrowseView: View {
    @StateObject private var binder = BinderStore()
    @State private var sims: [ArchiveSimEntry] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var selectedSim: ArchiveSimEntry?
    @State private var showGenerateSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading the simulation library\u{2026}")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if sims.isEmpty {
                    VStack(spacing: 8) {
                        Text(loadError ?? "No simulations synced yet.")
                            .font(.system(size: 14, weight: .medium, design: .rounded))
                            .foregroundColor(.secondary)
                        Button("Write the first one") { showGenerateSheet = true }
                            .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 14)], spacing: 14) {
                            ForEach(sims) { sim in
                                Button { selectedSim = sim } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(sim.section.simTitle ?? sim.section.title)
                                            .font(.system(size: 14, weight: .bold, design: .rounded))
                                            .foregroundColor(.primary)
                                            .lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                        Text(sim.bookTitle)
                                            .font(.system(size: 11, weight: .medium, design: .rounded))
                                            .foregroundColor(.secondary)
                                            .lineLimit(1)
                                        Spacer(minLength: 0)
                                        // "Try it" text label removed
                                        // (2026-08-23, explicit ask: "remove
                                        // the try it button... just the play
                                        // button is fine because it works") -
                                        // the whole card is still the one
                                        // real tap target, this is just its
                                        // visual affordance now.
                                        Image(systemName: "play.fill")
                                            .font(.system(size: 13, weight: .heavy))
                                            .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                                    }
                                    .padding(12)
                                    .frame(height: 110, alignment: .topLeading)
                                    .frame(maxWidth: .infinity)
                                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white))
                                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.black.opacity(0.06)))
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("archiveSim_\(sim.id)")
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .navigationTitle("Simulations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showGenerateSheet = true } label: {
                        Label("Write one", systemImage: "plus.circle.fill")
                    }
                    .accessibilityIdentifier("archiveSimGenerate")
                }
            }
        }
        .task { await load() }
        // fullScreenCover, not .sheet (2026-08-23, explicit ask: "use the
        // entire simulations box to show them the sim") - same fix as the
        // dashboard's own Archive sim player.
        .fullScreenCover(item: $selectedSim) { sim in
            ArchiveSimPlayerSheet(sim: sim, binder: binder)
        }
        .sheet(isPresented: $showGenerateSheet) {
            ArchiveGenerateSimSheet(onGenerated: mergeInSims)
        }
        .accessibilityIdentifier("archiveSimulationsBrowse")
    }

    private func load() async {
        isLoading = true
        loadError = nil
        let loaded = await ArchiveSimsLoader.loadAll()
        if loaded.isEmpty { loadError = "Couldn't reach the library right now." }
        sims = loaded
        isLoading = false
    }

    private func mergeInSims(from book: AssembledBook) {
        let newOnes = book.chapters.flatMap(\.sections)
            .filter { $0.simHtml != nil }
            .map { ArchiveSimEntry(id: "\(book.subjectId)_\($0.conceptId)", bookSubjectId: book.subjectId, bookTitle: book.title, section: $0) }
        let existingIds = Set(sims.map(\.id))
        sims.append(contentsOf: newOnes.filter { !existingIds.contains($0.id) })
        // Same ordering ArchiveSimsLoader.loadAll produces (source rank,
        // then book, then title) so a fresh generation doesn't scramble
        // the store-grouped list it lands in.
        sims.sort { lhs, rhs in
            if lhs.source != rhs.source { return lhs.source < rhs.source }
            if lhs.bookTitle != rhs.bookTitle { return lhs.bookTitle < rhs.bookTitle }
            return (lhs.section.simTitle ?? lhs.section.title) < (rhs.section.simTitle ?? rhs.section.title)
        }
    }
}

/// Full-screen player for one sim, opened from `ArchiveSimulationsBrowseView`.
private struct ArchiveSimPlayerSheet: View {
    let sim: ArchiveSimEntry
    @ObservedObject var binder: BinderStore
    @Environment(\.dismiss) private var dismiss
    @State private var addedToBinder = false
    /// Same on-open content fetch as `ArchiveChapterSimView` (the Work
    /// dashboard's player): un-bundled Dan's-archive sims carry no html
    /// until opened - /api/microsims assembles it on demand.
    @State private var remoteHTML: String?
    @State private var remoteFailed = false

    var body: some View {
        NavigationStack {
            Group {
                if let html = sim.section.simHtml ?? remoteHTML {
                    InlineSimWebView(html: html)
                } else if let microSimId = sim.microSimId, !remoteFailed {
                    ProgressView("Fetching from Dan's archive\u{2026}")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .task {
                            if let html = await MicroSimCatalogClient.fetchHTML(id: microSimId) {
                                remoteHTML = html
                            } else {
                                remoteFailed = true
                            }
                        }
                } else {
                    Text("This simulation isn't available right now.")
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle(sim.section.simTitle ?? sim.section.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    // Files the sim's whole book into the Binder - see this
                    // view's parent doc comment for why that's the real
                    // granularity Binder supports today, not just this page.
                    // Only chapter-book sims HAVE a book to file; on the
                    // generated / Dan's-archive stores this would silently
                    // file a book pointer nothing can open.
                    if sim.source == .chapterBook {
                        Button(addedToBinder ? "Added to Binder" : "Use in class") {
                            binder.addChapterBook(title: sim.bookTitle, subjectId: sim.bookSubjectId)
                            addedToBinder = true
                        }
                        .disabled(addedToBinder)
                        .accessibilityIdentifier("archiveSimUseInClass")
                    }
                }
            }
        }
    }
}

/// "Teachers can write simulations" — routes to the real, gated, on-demand
/// generation pipeline (`BookGenerationClient`) rather than a bespoke
/// authoring UI. Real latency (up to several minutes) and real cost per
/// attempt, same honesty this app already surfaces elsewhere for
/// generation waits.
struct ArchiveGenerateSimSheet: View {
    var onGenerated: (AssembledBook) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var topic = ""
    @State private var isGenerating = false
    @State private var chaptersReady = 0
    @State private var totalChapters = 0
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Describe what you want to teach")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                Text("Jesse builds a real, gated lesson with simulations \u{2014} usually a few minutes, and it costs real money to generate, so make it count.")
                    .font(.system(size: 12, design: .rounded))
                    .foregroundColor(.secondary)
                TextField("e.g. \u{201c}Newton's laws for 9th grade\u{201d}", text: $topic)
                    .textFieldStyle(.roundedBorder)
                    .disabled(isGenerating)
                if isGenerating {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text(totalChapters > 0 ? "\(chaptersReady) of \(totalChapters) chapters ready\u{2026}" : "Starting\u{2026}")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.secondary)
                    }
                }
                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 12, design: .rounded))
                        .foregroundColor(.red)
                }
                Spacer()
                Button(isGenerating ? "Building\u{2026}" : "Generate") { Task { await generate() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(topic.trimmingCharacters(in: .whitespaces).isEmpty || isGenerating)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .navigationTitle("Write a new simulation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }.disabled(isGenerating)
                }
            }
        }
    }

    private func generate() async {
        isGenerating = true
        errorMessage = nil
        let verdict = await BookGenerationClient.generate(topic: topic) { ready, total in
            chaptersReady = ready
            totalChapters = total
        }
        isGenerating = false
        switch verdict {
        case .verified(let book, _, _, _):
            onGenerated(book)
            dismiss()
        case .noGoodResult(let reason):
            errorMessage = reason ?? "Couldn't build a good lesson from that topic \u{2014} try rephrasing it."
        case .rateLimited(let reason):
            errorMessage = reason ?? "Generation is rate-limited right now \u{2014} try again shortly."
        case .unavailable(let reason):
            errorMessage = reason ?? "Couldn't reach the generation service."
        }
    }
}

private struct ArchiveWorkflowWebView: UIViewRepresentable {
    var weakness: (id: String, label: String)?

    static var archiveURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.archiveWorkflowURL"),
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://mindcraft-93858.web.app/desk-os/workflows/archive/?v=a4")!
    }

    func makeCoordinator() -> Coord { Coord() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { view.isInspectable = true }
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        context.coordinator.load(into: view, ucc: config.userContentController, url: Self.archiveURL)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.setWeakness(weakness, webView: uiView)
    }

    final class Coord: NSObject, WKNavigationDelegate, WKUIDelegate {
        private var didFinishLoad = false
        private var pendingWeakness: (id: String, label: String)?
        private var injectedId: String?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didFinishLoad = true
            inject(into: webView)
        }

        /// `/api/archive-rag` now requires a signed-in Firebase Bearer token
        /// (2026-08-25, was fully open). Fetches the token and installs it as
        /// a `.atDocumentStart` user script BEFORE `load()` is ever called,
        /// then loads - not a post-`didFinish` `evaluateJavaScript` (the
        /// first version of this fix): this page auto-fires a request on
        /// load when opened via its own `?q=` deep link (`agent.js`'s
        /// load-time `ask(q)`), which could race ahead of an async
        /// post-load injection and silently ship with no Authorization
        /// header. A document-start user script is present before any of
        /// the page's own scripts run, so there's no window where that race
        /// is possible.
        @MainActor
        func load(into webView: WKWebView, ucc: WKUserContentController, url: URL) {
            Task { @MainActor in
                if let token = try? await Auth.auth().currentUser?.getIDToken(),
                   let data = try? JSONEncoder().encode(token),
                   let json = String(data: data, encoding: .utf8) {
                    let script = WKUserScript(
                        source: "window.__mcAuthToken = \(json);",
                        injectionTime: .atDocumentStart,
                        forMainFrameOnly: true
                    )
                    ucc.addUserScript(script)
                }
                webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
            }
        }

        /// Called from `updateUIView` on every SwiftUI update - a no-op once
        /// the same concept id has already been injected, so this is safe to
        /// call repeatedly while the page is loading or long after.
        func setWeakness(_ weakness: (id: String, label: String)?, webView: WKWebView) {
            pendingWeakness = weakness
            if didFinishLoad { inject(into: webView) }
        }

        private func inject(into webView: WKWebView) {
            guard let weakness = pendingWeakness, weakness.id != injectedId else { return }
            injectedId = weakness.id
            struct Payload: Encodable { let conceptId: String; let label: String }
            guard
                let data = try? JSONEncoder().encode(Payload(conceptId: weakness.id, label: weakness.label)),
                let json = String(data: data, encoding: .utf8)
            else { return }
            // Read lazily by agent.js at the moment it builds the archive-rag
            // request body, not on a load event - so injection order (before
            // or after the page's own top-level script runs) never matters.
            webView.evaluateJavaScript("window.__mcWeakness = \(json);")
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }
    }
}
