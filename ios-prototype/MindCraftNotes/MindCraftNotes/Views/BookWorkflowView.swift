import SwiftUI

/// Jesse book-creation workflow (Assignment F, 2026-08-18 rebuild) - fully
/// native now, no WKWebView. The old web page (`agent_work/product/
/// desk_os/workflows/book/`) ran its OWN browser call (`SpeechRecognition`
/// + `speechSynthesis`, hold-to-talk) at the exact same time the native
/// `JesseRailView` sat decoratively on the right - two independent "talk to
/// Jesse" experiences on one screen. This view now drives the real
/// `/api/book-agent` loop through the ONE native call
/// (`JesseCallSession.askJesseBook`, `context == "book"`) and just renders
/// `jesseCall.bookDraft` as it updates - no local draft state of its own.
///
/// Left side keeps the shape that was already called out as good (draft/
/// chapters card, publish button) but as real native tools/boxes instead of
/// an embedded page: a "what we need from you" checklist that means
/// something even before a call has started, the chapters themselves, and
/// - once there's at least one chapter - a real "send to a tutor for
/// review" step via `TutorDirectoryClient` + the student's own
/// `GmailClient`. Publish still writes straight to Binder
/// (`BinderStore.addBook`), same native-side bridge Resume's "apply" uses.
struct BookWorkflowView: View {
    var onClose: () -> Void
    var studentName: String = "there"
    var onPublished: ((String, String) -> Void)? = nil

    @EnvironmentObject private var jesseCall: JesseCallSession
    @StateObject private var binder = BinderStore()
    @StateObject private var tutorDirectory = TutorDirectoryClient()
    @Environment(\.openURL) private var openURL

    private enum PublishState: Equatable {
        case idle
        case publishing
        case done(String)
        case failed(String)
    }

    @State private var publishState: PublishState = .idle
    @State private var sendingTutorId: String?
    @State private var sendResult: (tutorId: String, message: String, failed: Bool)?

    private var draft: BookAgentDraft { jesseCall.bookDraft ?? .empty }
    private var canPublish: Bool { !draft.title.isEmpty && !draft.chapters.isEmpty }

    var body: some View {
        HStack(spacing: 16) {
            bookPanel
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            JesseRailView(studentName: studentName, context: "book")
                .frame(width: 380)
        }
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(BookColor.cream.ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)))
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 16)
            .accessibilityIdentifier("bookWorkflowBack")
            .accessibilityLabel("Done")
        }
        .statusBarHidden(true)
        .task { await tutorDirectory.load() }
    }

    // MARK: - Left panel

    private var bookPanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                toolsBoxes
                chaptersSection
                if !draft.chapters.isEmpty {
                    tutorSection
                }
                publishButton
            }
            .padding(22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.12), radius: 16, y: 8)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "book-panel").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("bookWorkflowPanel")
                .allowsHitTesting(false)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("YOUR BOOK")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .tracking(1.1)
                .foregroundColor(BookColor.forest.opacity(0.5))
            Text(headline)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(BookColor.forest)
            Text("Talk to Jesse on the right - tell them what you want to teach, and chapters appear here as you go.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(BookColor.forest.opacity(0.6))
        }
        .accessibilityIdentifier("bookWorkflowHeader")
    }

    private var headline: String {
        if !draft.title.isEmpty { return draft.title }
        if !draft.topic.isEmpty { return draft.topic }
        return "Untitled book"
    }

    /// "What we need from you" tools/boxes - real state from the moment the
    /// screen opens, not a blank draft waiting silently for a call to start.
    private var toolsBoxes: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("WHAT WE NEED FROM YOU")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(BookColor.forest.opacity(0.45))
            toolRow(
                done: !draft.topic.isEmpty,
                title: "A topic",
                detail: draft.topic.isEmpty ? "Tell Jesse what you want to teach - any topic you know well enough to explain." : draft.topic
            )
            toolRow(
                done: !draft.chapters.isEmpty,
                title: "What you know",
                detail: draft.chapters.isEmpty
                    ? "Share what you already know - Jesse writes the first chapter from it."
                    : "\(draft.chapters.count) chapter\(draft.chapters.count == 1 ? "" : "s") so far"
            )
            toolRow(
                done: canPublish,
                title: "Ready to publish",
                detail: canPublish ? "Publish whenever you're ready, or keep adding chapters." : "Keep talking, or say \u{201c}publish\u{201d} when you're done."
            )
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(BookColor.cream))
        .accessibilityIdentifier("bookWorkflowTools")
    }

    private func toolRow(done: Bool, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .foregroundColor(done ? BookColor.green : BookColor.forest.opacity(0.3))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(BookColor.forest)
                Text(detail)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(BookColor.forest.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private var chaptersSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CHAPTERS")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(BookColor.forest.opacity(0.45))
            if draft.chapters.isEmpty {
                Text("Chapters will appear here as you talk.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(BookColor.forest.opacity(0.5))
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(BookColor.cream))
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(draft.chapters.enumerated()), id: \.offset) { index, chapter in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(chapter.title.isEmpty ? "Chapter \(index + 1)" : chapter.title)
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(BookColor.forest)
                            Text(chapter.body)
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .foregroundColor(BookColor.forest.opacity(0.75))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(BookColor.cream))
                        .accessibilityIdentifier("bookWorkflowChapter_\(index)")
                    }
                }
            }
        }
        .accessibilityIdentifier("bookWorkflowChapters")
    }

    // MARK: - Send to a tutor for review

    private var tutorSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("SEND TO A TUTOR FOR REVIEW")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(BookColor.forest.opacity(0.45))

            if tutorDirectory.isLoading && tutorDirectory.tutors.isEmpty {
                ProgressView().tint(BookColor.forest)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(tutorDirectory.tutors) { tutor in
                        tutorRow(tutor)
                    }
                }
            }

            if let sendResult {
                Text(sendResult.message)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(sendResult.failed ? BookColor.errorRed : BookColor.green)
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(BookColor.cream))
        .accessibilityIdentifier("bookWorkflowTutorSection")
    }

    private func tutorRow(_ tutor: Tutor) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(tutor.displayName)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(BookColor.forest)
                if !tutor.subjects.isEmpty {
                    Text(tutor.subjects.prefix(3).joined(separator: " \u{00b7} "))
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(BookColor.forest.opacity(0.55))
                }
            }
            Spacer(minLength: 0)
            Button {
                Task { await sendToTutor(tutor) }
            } label: {
                if sendingTutorId == tutor.id {
                    ProgressView().tint(.white)
                        .frame(width: 60, height: 30)
                        .background(Capsule().fill(BookColor.forest))
                } else {
                    Text(tutor.email.isEmpty ? "Book a call" : "Send")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Capsule().fill(BookColor.forest))
                }
            }
            .buttonStyle(.plain)
            .disabled(sendingTutorId != nil)
            .accessibilityIdentifier("bookWorkflowSendToTutor_\(tutor.id)")
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.white))
    }

    /// A tutor with no email on file gets Calendly instead - "book a call
    /// about the draft" rather than silently failing to send, or guessing
    /// at an address we don't actually have.
    private func sendToTutor(_ tutor: Tutor) async {
        guard tutor.email.isEmpty == false else {
            if let url = URL(string: tutor.calendlyUrl) { openURL(url) }
            return
        }
        sendingTutorId = tutor.id
        sendResult = nil

        let synthetic = GmailClient.Message(
            id: UUID().uuidString,
            threadId: "",
            from: tutor.displayName,
            fromEmail: tutor.email,
            subject: "\(studentName)'s book draft - could you take a look?",
            snippet: "",
            dateLabel: "",
            rfcMessageId: ""
        )
        let ok = await GmailClient.shared.sendReply(to: synthetic, body: renderDraftForEmail())
        sendingTutorId = nil
        if ok {
            sendResult = (tutor.id, "Sent to \(tutor.displayName).", false)
        } else {
            sendResult = (tutor.id, GmailClient.shared.lastError ?? "Couldn't send - try again, or book a call instead.", true)
        }
    }

    private func renderDraftForEmail() -> String {
        var lines: [String] = [headline, "", "Hi! I'm working on a short book and would love your feedback.", ""]
        for (index, chapter) in draft.chapters.enumerated() {
            lines.append(chapter.title.isEmpty ? "Chapter \(index + 1)" : chapter.title)
            lines.append(chapter.body)
            lines.append("")
        }
        lines.append("Thanks for taking a look!")
        lines.append(studentName)
        return lines.joined(separator: "\n")
    }

    // MARK: - Publish

    private var publishButton: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button(action: publish) {
                Text(publishState == .publishing ? "Publishing\u{2026}" : "Publish to Binder")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
            .background(Capsule().fill(canPublish ? Color.black : Color.black.opacity(0.3)))
            .disabled(!canPublish || publishState == .publishing)
            .accessibilityIdentifier("bookWorkflowPublish")

            switch publishState {
            case .done(let message):
                Text(message).font(.system(size: 12, weight: .semibold, design: .rounded)).foregroundColor(BookColor.green)
            case .failed(let message):
                Text(message).font(.system(size: 12, weight: .semibold, design: .rounded)).foregroundColor(BookColor.errorRed)
            case .idle, .publishing:
                EmptyView()
            }
        }
    }

    private func publish() {
        guard canPublish else { return }
        publishState = .publishing
        let bodyText = draft.chapters.enumerated().map { index, chapter -> String in
            let title = chapter.title.isEmpty ? "Chapter \(index + 1)" : chapter.title
            return "## \(title)\n\n\(chapter.body)"
        }.joined(separator: "\n\n")

        let itemId = binder.addBook(title: draft.title, body: bodyText)
        if itemId.isEmpty {
            publishState = .failed("Sign in to publish to your Binder")
        } else {
            publishState = .done("Filed to your Binder")
            onPublished?(draft.title, bodyText)
        }
    }
}

private enum BookColor {
    static let forest = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
    static let cream = Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255)
    static let green = Color(red: 36 / 255, green: 122 / 255, blue: 77 / 255)
    static let errorRed = Color(red: 0.7, green: 0.2, blue: 0.16)
}
