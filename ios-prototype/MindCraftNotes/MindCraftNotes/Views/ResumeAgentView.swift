import SwiftUI
import WebKit
import PDFKit
import UniformTypeIdentifiers

/// Jesse resume agent (Assignment H, 2026-08-18 rebuild) - the native call
/// drives a real profile draft (`JesseCallSession.askJesseResume`,
/// `context == "resume"`, hits `/api/resume-agent`). The old web-page import
/// path (LinkedIn paste / Drive folder / PDF upload via a WKWebView, and its
/// `ingestFromJesse` bridge into `JobOSStore`) is gone (2026-08-27) - its own
/// UI entry point (`importToggle`) had already been silently dropped from
/// `body` on 2026-08-25, leaving the WKWebView bridge live but unreachable,
/// which is how a student ended up with stale, ungrounded "suggested roles"
/// (real professional job postings, not something a high schooler is
/// eligible for) sitting on their board with no way to have generated them
/// through the current UI. Removed rather than re-wired: native voice +
/// PDFKit upload (`handleResumeUpload` below) already cover real extraction,
/// and `resume-agent.ts`'s prompt is now fixed to only suggest high-school-
/// appropriate roles regardless. `JesseRailView` on the right, same shared
/// card every screen with Jesse carries.
///
/// Apply Today/JobOS folded in here rather than staying a separate
/// top-level Flow (explicit ask - "that box should be in the resume box").
/// `JobOSStore`/`JobOSShellView` themselves are untouched - full
/// role/contact/application-tracking depth stays real, just reached from
/// inside Resume now instead of as a peer entry point.
struct ResumeAgentView: View {
    var onClose: () -> Void
    var studentName: String = "there"
    /// Fires once, right when the web page's own "apply" message has
    /// finished ingesting into JobOSStore (real side effect the caller may
    /// still want - e.g. filing a resume-draft artifact) - Resume itself
    /// stays open and shows Apply Today as a nested cover rather than
    /// closing, unlike the old flow this replaces.
    var onApply: (() -> Void)? = nil
    /// True when this renders inside the Work Dashboard's binder content-
    /// viewer instead of full-screen (2026-08-22, in-binder consolidation).
    /// Defaults false so FieldDeskView's existing full-screen presentation
    /// is unaffected. `scale`'s own math needs no change either way - it
    /// already derives from whatever GeometryReader frame this view is
    /// given, not the screen's own bounds.
    var embedded: Bool = false
    /// UI-testing-only entry point (2026-08-25) - jumps straight to the
    /// Applications/JobOS panel for on-device verification screenshots,
    /// same no-tap-automation need as `--ui-testing-resume` itself.
    var startInApplications: Bool = false

    private enum ContentMode { case profile, applications }

    @State private var mode: ContentMode = .profile
    @StateObject private var jobOSStore = JobOSStore()
    @EnvironmentObject private var jesseCall: JesseCallSession
    @State private var showResumeImporter = false
    @State private var uploadError: String?
    @State private var uploading = false

    private var draft: ResumeAgentDraft { jesseCall.resumeDraft ?? .empty }
    /// Whether there's a real profile to show yet - a returning student
    /// (resumeDraft now persists, 2026-08-25) lands straight on their
    /// draft; a genuinely new one sees the upload-or-talk opening choice.
    private var hasProfile: Bool {
        !draft.name.isEmpty || !draft.headline.isEmpty || !draft.skills.isEmpty || !draft.roles.isEmpty
    }

    private let stageInk = Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255)
    private let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)
    private let cream = Color(red: 255 / 255, green: 248 / 255, blue: 233 / 255)
    /// Text meant to sit DIRECTLY on the stage background (no local pill/
    /// card fill of its own) - `cream` reads fine on the dark stage, but
    /// the same cream text on the embedded cream PAGE (see the background
    /// swap above) would be nearly invisible. Buttons with their own opaque
    /// fill (the lime "Upload" pill, the black/red "Talk to Jesse" pill)
    /// don't use this - their own fill provides contrast regardless of the
    /// page behind them.
    private var stageOnPageText: Color {
        embedded ? Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255) : cream
    }
    /// Same reasoning as stageOnPageText, for the two subtle white-wash
    /// pills ("Let's talk it through", transcript lines) that read as a
    /// faint lighter patch against the dark stage but would be nearly
    /// invisible against the cream page.
    private var stageWashFill: Color {
        embedded ? Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.08) : Color.white.opacity(0.12)
    }

    var body: some View {
        Group {
            if mode == .profile {
                // Gurukul-style dark stage (2026-08-25, explicit ask:
                // "it should look like Jesse(Gurukul) feature... expand
                // the dark all over the screen like gurukul not in a
                // box"). StudyCompanionView's own `stage` is never boxed
                // into the old fixed-1440x810-artboard-scaled-and-
                // letterboxed layout every other mode/screen in this file
                // uses (see ResumeArtboard/`pin` below) - it just fills
                // whatever space it's given, so this does the same
                // instead of pinning `resumeStage` inside a scaled box
                // with visible dark margins around it. Applications/Import
                // below keep the old artboard system untouched -
                // JobOSShellView's paper-board look and the web import
                // page aren't part of this redesign.
                ZStack {
                    if embedded {
                        // Real bug, live testing 2026-08-27: "Gantabya does
                        // not blend in either. Like, it's just a black
                        // screen." The dark Gurukul-stage treatment below
                        // was built for a full-screen destination
                        // (2026-08-25 ask: "expand the dark all over the
                        // screen like gurukul") - Gantabya isn't one
                        // anymore, it renders inside the cream dashboard's
                        // own Binder content-viewer slot, so painting a
                        // near-black stage there is exactly what "doesn't
                        // blend" looks like. Same cream the dashboard's own
                        // page uses (DeskGridDashboardView's
                        // Color(gridHex: "fff8e9")), not a new color.
                        Color(red: 255 / 255, green: 248 / 255, blue: 233 / 255).ignoresSafeArea()
                    } else {
                        stageInk.ignoresSafeArea()
                        RadialGradient(
                            colors: [Color(red: 26 / 255, green: 36 / 255, blue: 16 / 255).opacity(0.9), stageInk],
                            center: .center, startRadius: 40, endRadius: 520
                        ).ignoresSafeArea()
                    }
                    resumeStage
                }
            } else if mode == .applications {
                // Same full-bleed treatment as .profile above (2026-08-25,
                // explicit ask after seeing it on-device: "make sure it
                // blends with the screen perfectly right now looks cut
                // off and ugly") - JobOSShellView used to sit inside the
                // old fixed-artboard `contentBox`, scaled/pinned/rounded/
                // shadowed next to a separate JesseRailView pairing, which
                // is exactly what produced the visible letterboxed margins
                // around both panels. JobOSShellView doesn't need a call
                // rail alongside it (it has its own header/menu), so it
                // just fills the screen on its own now, same as the stage.
                JobOSShellView(onClose: { mode = .profile }, resumeDraft: jesseCall.resumeDraft, fillsAvailableSpace: true)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea(edges: embedded ? [] : .all)
        .overlay(alignment: .topTrailing) {
            // Hidden in .applications (2026-08-25) - JobOSShellView now
            // fills the whole pane edge to edge (see the fillsAvailableSpace
            // branch above) and reaches this same top-right corner with its
            // own "Close" pill, which already goes back to .profile. Two
            // overlapping exit buttons here was a real regression from that
            // fix, not a pre-existing design - this one now yields to it.
            if mode != .applications {
                Button(action: onClose) {
                    Text("Done")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)))
                }
                .buttonStyle(.plain)
                .padding(.top, 12)
                .padding(.trailing, 16)
                .accessibilityIdentifier("resumeAgentBack")
                .accessibilityLabel("Done")
            }
        }
        .statusBarHidden(!embedded)
        .onAppear {
            if startInApplications { mode = .applications }
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "resume").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("resumeAgentRoot")
                .allowsHitTesting(false)
        }
    }

    // MARK: - Gurukul-style stage (2026-08-25)

    private var firstName: String {
        let trimmed = studentName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != "there" else { return "there" }
        return trimmed.split(separator: " ").first.map(String.init) ?? trimmed
    }

    private var isResumeCallLive: Bool {
        jesseCall.isActive && jesseCall.context == "resume"
    }

    private var resumeOrbState: JesseOrbView.OrbState {
        if jesseCall.isSpeaking { return .speaking }
        if jesseCall.isThinking { return .thinking }
        if jesseCall.isListening { return .listening }
        if !isResumeCallLive { return .closed }
        return .idle
    }

    private var resumeStatusCaption: String {
        switch resumeOrbState {
        case .speaking: return "Jesse is talking"
        case .thinking: return "reasoning"
        case .listening: return "listening, go ahead"
        case .closed: return hasProfile ? "off the line, tap to keep going" : "ready when you are"
        case .idle: return "on the line"
        }
    }

    /// Orb + call control (left) plus either the upload-or-talk opening
    /// choice or the live draft (right) - same two-column shape as
    /// StudyCompanionView's own stage, not a new layout invented for this
    /// screen.
    private var resumeStage: some View {
        HStack(alignment: .top, spacing: 24) {
            VStack(spacing: 14) {
                JesseOrbView(state: resumeOrbState, buildFraction: nil)
                    .frame(width: 132, height: 132)
                Text(resumeStatusCaption)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(stageOnPageText.opacity(0.55))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)
                Button {
                    if isResumeCallLive { _ = jesseCall.end() } else { startTalking() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: isResumeCallLive ? "phone.down.fill" : "phone.fill")
                        Text(isResumeCallLive ? "End call" : "Talk to Jesse")
                    }
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(isResumeCallLive ? Color(red: 176 / 255, green: 71 / 255, blue: 63 / 255) : Color.black))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("resumeAgentCallJesse")
                Spacer(minLength: 0)
            }
            .frame(width: 180)

            if !hasProfile && !isResumeCallLive {
                resumeIntakeChoice
            } else {
                resumeDraftPanel
            }
        }
        .padding(28)
    }

    /// The opening moment (explicit ask: "Hey, I need a resume to work
    /// with, do you have one to upload... or go into conversational
    /// mode"). Shown only once - the instant either path produces real
    /// content (hasProfile) or a call starts, this gives way to
    /// `resumeDraftPanel` and never comes back for a returning student
    /// (resumeDraft persists, see that property's own doc comment).
    private var resumeIntakeChoice: some View {
        VStack(alignment: .leading, spacing: 18) {
            Spacer(minLength: 0)
            Text("Hey \(firstName), I need a resume to work with.")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(stageOnPageText)
                .fixedSize(horizontal: false, vertical: true)
            Text("Got one already? Upload it and I'll pull your real details from it. Or we can just talk it through - tell me what you've done and I'll build it as you go.")
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .foregroundColor(stageOnPageText.opacity(0.7))
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
            if let uploadError {
                Text(uploadError)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(embedded ? Color(red: 176 / 255, green: 71 / 255, blue: 63 / 255) : Color(red: 232 / 255, green: 135 / 255, blue: 122 / 255))
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 12) {
                Button {
                    showResumeImporter = true
                } label: {
                    HStack(spacing: 8) {
                        if uploading {
                            ProgressView().tint(stageInk)
                        } else {
                            Image(systemName: "doc.badge.arrow.up")
                        }
                        Text(uploading ? "Reading\u{2026}" : "Upload my resume")
                    }
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(stageInk)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 13)
                    .background(Capsule().fill(lime))
                }
                .buttonStyle(.plain)
                .disabled(uploading)
                .accessibilityIdentifier("resumeAgentUpload")

                Button(action: startTalking) {
                    HStack(spacing: 8) {
                        Image(systemName: "phone.fill")
                        Text("Let's talk it through")
                    }
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(stageOnPageText)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 13)
                    .background(Capsule().fill(stageWashFill))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("resumeAgentTalk")
            }
            Spacer(minLength: 0)
        }
        .fileImporter(isPresented: $showResumeImporter, allowedContentTypes: [.pdf, .plainText]) { result in
            Task { await handleResumeUpload(result) }
        }
    }

    /// Draft-in-progress + live transcript, once either exists.
    private var resumeDraftPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            if isResumeCallLive {
                if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty {
                    resumeTranscriptLine(jesseCall.liveTranscript, live: true)
                } else if let last = jesseCall.turns.last(where: { $0.speaker == "student" })?.text {
                    resumeTranscriptLine(last, live: false)
                }
            }
            resumePanel
        }
    }

    private func resumeTranscriptLine(_ text: String, live: Bool) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .medium, design: .rounded))
            .foregroundColor(stageOnPageText.opacity(live ? 0.75 : 0.9))
            .lineLimit(2)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Capsule().fill(embedded ? stageWashFill : Color.white.opacity(live ? 0.1 : 0.16)))
            .opacity(live ? 0.85 : 1)
    }

    private func startTalking() {
        if !jesseCall.isActive || jesseCall.context != "resume" {
            jesseCall.begin(context: "resume", studentName: studentName)
        }
        jesseCall.startListening()
    }

    /// Real PDF/text extraction (2026-08-25, closing a genuine gap - see
    /// ResumeAgentClient's own doc comment: the server has always accepted
    /// sources.resumeText, nothing native ever sent it). PDFKit only -
    /// DOCX needs a real parser this app doesn't have; a .docx pick here
    /// would just fail cleanly below rather than silently mis-read it.
    private func handleResumeUpload(_ result: Result<URL, Error>) async {
        uploadError = nil
        switch result {
        case .failure(let error):
            uploadError = "Couldn't open that file: \(error.localizedDescription)"
        case .success(let url):
            uploading = true
            defer { uploading = false }
            guard url.startAccessingSecurityScopedResource() else {
                uploadError = "Couldn't access that file - try again."
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }
            let fileName = url.lastPathComponent
            var text = ""
            if url.pathExtension.lowercased() == "pdf" {
                text = PDFDocument(url: url)?.string ?? ""
            } else {
                text = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
            }
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                uploadError = "Couldn't read any text out of that file - try a different export, or just talk it through instead."
                return
            }
            jesseCall.submitResumeUpload(text: trimmed, fileName: fileName, studentName: studentName)
        }
    }

    // MARK: - Native profile panel (Assignment H)

    private var resumePanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                resumeHeader
                resumeTools
                resumeProfile
            }
            .padding(22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.08), radius: 14, y: 6)
        )
        .accessibilityIdentifier("resumeAgentProfilePanel")
    }

    private var resumeHeader: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("YOUR RESUME")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .tracking(1.1)
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.5))
            Text(draft.name.isEmpty ? "Your name" : draft.name)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
            Text("Keep talking to Jesse - tell them about your school, skills, and roles, and this fills in as you go.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.6))
        }
    }

    private var resumeTools: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("WHAT WE NEED FROM YOU")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.45))
            resumeToolRow(
                done: !draft.name.isEmpty && !draft.headline.isEmpty,
                title: "Who you are",
                detail: draft.headline.isEmpty ? "Your name and a line that sounds like you." : draft.headline
            )
            resumeToolRow(
                done: !draft.skills.isEmpty,
                title: "Skills",
                detail: draft.skills.isEmpty ? "What you're good at - even the small stuff counts." : draft.skills.joined(separator: ", ")
            )
            resumeToolRow(
                done: !draft.roles.isEmpty,
                title: "Experience",
                detail: draft.roles.isEmpty ? "A job, project, or club - anything you did the work for." : "\(draft.roles.count) role\(draft.roles.count == 1 ? "" : "s") so far"
            )
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255)))
    }

    private func resumeToolRow(done: Bool, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .foregroundColor(done ? Color(red: 36 / 255, green: 122 / 255, blue: 77 / 255) : Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.3))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                Text(detail)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private var resumeProfile: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("DRAFT")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.45))
            if draft.roles.isEmpty && draft.skills.isEmpty {
                Text("Nothing yet - jump on a call and start talking.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.5))
            } else {
                if !draft.skills.isEmpty {
                    // Plain wrapped text, not an HStack of chips - an HStack
                    // doesn't wrap onto a second line in SwiftUI and this
                    // list can grow past one row width.
                    Text(draft.skills.joined(separator: "  \u{00b7}  "))
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255).opacity(0.35)))
                }
                ForEach(Array(draft.roles.enumerated()), id: \.offset) { _, role in
                    VStack(alignment: .leading, spacing: 4) {
                        Text([role.title, role.org].filter { !$0.isEmpty }.joined(separator: " \u{00b7} "))
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                        ForEach(role.bullets, id: \.self) { bullet in
                            Text("\u{2022} \(bullet)")
                                .font(.system(size: 12.5, weight: .medium, design: .rounded))
                                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.75))
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255)))
                }
            }
        }
        .accessibilityIdentifier("resumeAgentDraft")
    }

}

