import SwiftUI

/// Movable **Gmail** workflow box on Field Desk.
/// Real Gmail inbox (+ Calendar permission in the same Google sheet). Not AgentMail.
struct GmailWorkflowBoxView: View {
    var onClose: () -> Void
    var onConnected: ((_ calendarToo: Bool) -> Void)? = nil
    var onDisconnected: (() -> Void)? = nil
    var onInboxLoaded: (([GmailClient.Message]) -> Void)? = nil
    /// When true, show setup + force a fresh Google connect sheet.
    var startInReconnect: Bool = false
    /// When true, after inbox loads open a ready-to-send reply for the top mail.
    var startWithTopReply: Bool = false
    /// Fills its given frame instead of floating as a draggable/resizable
    /// desk card (2026-08-27, same convention DesignStudioView/
    /// ResumeAgentView already use for their own content-viewer slot) - for
    /// DeskGridDashboardView's Binder content-viewer, which replaced the
    /// floating GmailWorkflowBoxView overlay that used to sit on top of
    /// everything ("Gmail same opens on its own... blend it into the page
    /// neatly").
    var embedded: Bool = false

    @StateObject private var client = GmailClient.shared
    @StateObject private var digestClient = GmailDigestClient.shared
    @StateObject private var digestStore = GmailDigestStore.shared
    @StateObject private var drive = DriveClient.shared
    /// Matches the desk screenshot size the student set (≈438×359 on iPad).
    @State private var boardSize = CGSize(width: 440, height: 360)
    @State private var boardOrigin = CGPoint(x: 0, y: 48)
    @State private var boardDrag: CGSize = .zero
    @State private var boardFocused = true
    @State private var resizeStart: CGSize?
    @State private var didPlace = false
    @State private var didOpenTopReply = false
    @State private var selected: GmailClient.Message?
    @State private var draft = ""
    @State private var sending = false

    var body: some View {
        if embedded {
            embeddedBody
        } else {
            floatingBody
        }
    }

    /// Just the inbox card, filling whatever frame it's given - no
    /// boardOrigin/boardDrag/resize math, since there's nothing to drag
    /// inside a fixed content-viewer slot.
    private var embeddedBody: some View {
        paperBoard
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(Color(gmHex: "c4a484"), lineWidth: 1.4)
            )
            .overlay(alignment: .bottom) {
                if let toast = client.toast {
                    Text(toast)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(gmHex: "0c1207"))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color(gmHex: "c4f547")))
                        .padding(.bottom, 16)
                        .allowsHitTesting(false)
                }
            }
            .onAppear {
                client.onInboxLoaded = { msgs in
                    onInboxLoaded?(msgs)
                    openTopReplyIfNeeded(msgs)
                }
                client.refreshScopeStatus()
                if startInReconnect {
                    client.disconnectForReconnect()
                    onDisconnected?()
                }
                if client.hasGmailScope {
                    Task {
                        await client.fetchInbox()
                        openTopReplyIfNeeded(client.messages)
                    }
                } else if startInReconnect {
                    Task { await client.connectGoogleMailAndCalendar(force: true) }
                }
            }
            .onChange(of: client.messages) { _, msgs in
                openTopReplyIfNeeded(msgs)
                guard !msgs.isEmpty else { return }
                Task {
                    await digestClient.summarize(msgs)
                    if let digest = digestClient.digest {
                        digestStore.save(digest, messageCount: msgs.count)
                    }
                }
            }
            .sheet(item: $selected) { msg in
                replySheet(msg).presentationDetents([.large, .medium])
            }
            .accessibilityIdentifier("gmailWorkflowRoot")
    }

    private var floatingBody: some View {
        GeometryReader { proxy in
            let canvas = proxy.size
            ZStack(alignment: .topLeading) {
                paperBoard
                    .frame(width: boardSize.width, height: boardSize.height)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .stroke(
                                boardFocused ? Color(gmHex: "247a4d") : Color(gmHex: "c4a484"),
                                lineWidth: boardFocused ? 2.2 : 1.4
                            )
                    )
                    .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
                    .overlay(alignment: .bottomTrailing) {
                        if boardFocused { resizeGrip }
                    }
                    .offset(
                        x: boardOrigin.x + boardDrag.width,
                        y: boardOrigin.y + boardDrag.height
                    )
                    .gesture(moveGesture)
                    .zIndex(10)

                if let toast = client.toast {
                    VStack {
                        Spacer()
                        Text(toast)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(gmHex: "0c1207"))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Capsule().fill(Color(gmHex: "c4f547")))
                            .padding(.bottom, 28)
                    }
                    .allowsHitTesting(false)
                }
            }
            .contentShape(boardHitPath())
            .onAppear {
                client.onInboxLoaded = { msgs in
                    onInboxLoaded?(msgs)
                    openTopReplyIfNeeded(msgs)
                }
                client.refreshScopeStatus()
                if startInReconnect {
                    client.disconnectForReconnect()
                    onDisconnected?()
                }
                guard !didPlace else { return }
                placeOnRight(in: canvas)
                didPlace = true
                if client.hasGmailScope {
                    Task {
                        await client.fetchInbox()
                        openTopReplyIfNeeded(client.messages)
                    }
                } else if startInReconnect {
                    Task { await client.connectGoogleMailAndCalendar(force: true) }
                }
            }
            .onChange(of: canvas) { _, newSize in
                guard !didPlace else { return }
                placeOnRight(in: newSize)
                didPlace = true
            }
            .onChange(of: client.messages) { _, msgs in
                openTopReplyIfNeeded(msgs)
                guard !msgs.isEmpty else { return }
                Task {
                    await digestClient.summarize(msgs)
                    if let digest = digestClient.digest {
                        digestStore.save(digest, messageCount: msgs.count)
                    }
                }
            }
        }
        .sheet(item: $selected) { msg in
            replySheet(msg).presentationDetents([.large, .medium])
        }
        .accessibilityIdentifier("gmailWorkflowRoot")
    }

    // MARK: - Board

    private var paperBoard: some View {
        VStack(spacing: 0) {
            headerBar
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if client.hasGmailScope {
                        digestSection
                        inboxSection
                    } else {
                        setupSection
                    }
                }
                .padding(16)
                .padding(.bottom, 28)
            }
        }
        .background(Color(gmHex: "f7f3ee"))
    }

    private var headerBar: some View {
        HStack(spacing: 10) {
            Button(action: onClose) {
                Text("Close")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gmHex: "143a2e"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(Color.white))
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text("Gmail")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gmHex: "1c1a17"))
                Text(client.hasGmailScope ? "Your inbox · tap a mail to reply" : "Connect your school Gmail")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gmHex: "8a8478"))
            }

            Spacer()

            Menu {
                if client.hasGmailScope {
                    Button("Refresh inbox", systemImage: "arrow.clockwise") {
                        Task { await client.fetchInbox() }
                    }
                }
                Button("Connect again", systemImage: "link") {
                    client.disconnectForReconnect()
                    onDisconnected?()
                    Task { await client.connectGoogleMailAndCalendar(force: true) }
                }
                if client.hasGmailScope {
                    Button("Disconnect", systemImage: "link.badge.minus", role: .destructive) {
                        client.disconnectForReconnect()
                        onDisconnected?()
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(Color(gmHex: "143a2e"))
                    .padding(4)
                    .background(Circle().fill(Color.white))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.88))
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color(gmHex: "d9d2c5")).frame(height: 1)
        }
    }

    private var setupSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Workflow space")
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .foregroundColor(Color(gmHex: "8a8478"))

            Text("Use the same school Gmail you already have. MindCraft does not create a new email address.")
                .font(.system(size: 13, weight: .medium, design: .rounded))

            VStack(alignment: .leading, spacing: 10) {
                stepRow(1) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Stay signed in to school Gmail")
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                        Link(destination: URL(string: "https://mail.google.com")!) {
                            Text("Open Gmail →")
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(Color(gmHex: "247a4d"))
                                .underline()
                        }
                    }
                }
                stepRow(2) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Connect once")
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                        Text("Tap the button below. Google will ask to share your mail and calendar with MindCraft.")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(Color(gmHex: "8a8478"))
                    }
                }
                stepRow(3) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("You’re in control")
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                        Text("You can remove MindCraft anytime in your Google Account → Security → Third-party access.")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(Color(gmHex: "8a8478"))
                        Link(destination: URL(string: "https://myaccount.google.com/permissions")!) {
                            Text("Manage Google access →")
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(Color(gmHex: "247a4d"))
                                .underline()
                        }
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color.white))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(gmHex: "d9d2c5"), lineWidth: 1.1))

            Button {
                Task {
                    await client.connectGoogleMailAndCalendar(force: true)
                    if client.hasGmailScope {
                        onConnected?(client.hasCalendarScope)
                    }
                }
            } label: {
                Text(client.isBusy ? "Connecting…" : "Connect Gmail + Calendar")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gmHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Color(gmHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .disabled(client.isBusy)
            .accessibilityIdentifier("gmailConnectButton")

            if let err = client.lastError {
                Text(err)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gmHex: "b42318"))
            }
        }
    }

    private func stepRow<Content: View>(_ n: Int, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(n)")
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .foregroundColor(Color(gmHex: "0c1207"))
                .frame(width: 22, height: 22)
                .background(Circle().fill(Color(gmHex: "c4f547")))
            content()
        }
    }

    /// AI triage of the current inbox batch - real Gmail read (already
    /// existed), the missing "summarize it" step. Auto-runs whenever
    /// `client.messages` changes (see .onChange above); the refresh button
    /// here is for re-running against the same batch without a full
    /// inbox reload. Persisted per-student via `GmailDigestStore` so this
    /// isn't just an ephemeral in-memory read - and archived into the
    /// student's OWN Drive (not MindCraft's backend) via "Archive to Drive",
    /// a durable data store outside this app entirely.
    private var digestSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Digest")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(gmHex: "8a8478"))
                Spacer()
                if digestClient.isBusy {
                    ProgressView().scaleEffect(0.7)
                } else if !client.messages.isEmpty {
                    Button {
                        Task {
                            await digestClient.summarize(client.messages)
                            if let digest = digestClient.digest {
                                digestStore.save(digest, messageCount: client.messages.count)
                            }
                        }
                    } label: {
                        Image(systemName: "sparkles")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(gmHex: "247a4d"))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gmailDigestRefresh")
                }
            }

            if let digest = digestClient.digest {
                VStack(alignment: .leading, spacing: 8) {
                    Text(digest.headline)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(gmHex: "1c1a17"))
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("gmailDigestHeadline")

                    ForEach(digest.actionItems) { item in
                        DeskContentRow(
                            title: item.subject,
                            subtitle: item.why.isEmpty ? nil : item.why,
                            dot: Color(gmHex: "c1121f"),
                            ink: Color(gmHex: "1c1a17"),
                            muted: Color(gmHex: "8a8478"),
                            showDivider: false,
                            compact: true
                        )
                    }
                    if !digest.fyi.isEmpty {
                        Text("\(digest.fyi.count) more, routine")
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(Color(gmHex: "8a8478"))
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(gmHex: "d9d2c5"), lineWidth: 1))

                Button {
                    Task { await drive.archiveEmails(client.messages, digest: digestClient.digest) }
                } label: {
                    Text(drive.isArchiving ? "Archiving…" : "Archive to Drive")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(Color(gmHex: "247a4d"))
                }
                .buttonStyle(.plain)
                .disabled(drive.isArchiving)
                .accessibilityIdentifier("gmailArchiveToDrive")

                if let err = drive.lastError {
                    Text(err)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(Color(gmHex: "b42318"))
                }
            } else if digestClient.isBusy {
                Text("Summarizing…")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gmHex: "8a8478"))
            }
        }
    }

    private var inboxSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Inbox")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(gmHex: "8a8478"))
                Spacer()
                Link(destination: URL(string: "https://mail.google.com")!) {
                    Text("Open in Gmail")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(Color(gmHex: "247a4d"))
                }
            }

            if let err = client.lastError {
                VStack(alignment: .leading, spacing: 12) {
                    Text(customerFacingError(err))
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(gmHex: "b42318"))
                        .fixedSize(horizontal: false, vertical: true)
                    Button {
                        Task { await client.fetchInbox() }
                    } label: {
                        Text("Try again")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(Color(gmHex: "0c1207"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color(gmHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gmailRetryInbox")
                    #if DEBUG
                    if let url = client.enableApiURL {
                        Link(destination: url) {
                            Text("Admin: enable Gmail API →")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(Color(gmHex: "247a4d"))
                                .underline()
                        }
                        .accessibilityIdentifier("gmailEnableApiLink")
                    }
                    #endif
                }
                .padding(.vertical, 8)
            } else if client.isBusy && client.messages.isEmpty {
                Text("Loading…")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gmHex: "8a8478"))
                    .padding(.vertical, 20)
            } else if client.messages.isEmpty {
                Text("No messages yet. Tap ↻ or open Gmail.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gmHex: "8a8478"))
                    .padding(.vertical, 20)
            } else {
                ForEach(client.messages) { msg in
                    Button {
                        draft = client.suggestedReply(for: msg)
                        selected = msg
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(msg.from)
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .lineLimit(1)
                                Spacer()
                                Text(msg.dateLabel)
                                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                                    .foregroundColor(Color(gmHex: "8a8478"))
                            }
                            Text(msg.subject)
                                .font(.system(size: 13, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(gmHex: "143a2e"))
                                .lineLimit(2)
                            Text(msg.snippet)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundColor(Color(gmHex: "8a8478"))
                                .lineLimit(2)
                        }
                        .foregroundColor(Color(gmHex: "1c1a17"))
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(gmHex: "e4ddd0"), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.65)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(gmHex: "d9d2c5"), lineWidth: 1.1))
    }

    private func replySheet(_ msg: GmailClient.Message) -> some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text(msg.subject)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                Text("From · \(msg.from)")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(gmHex: "8a8478"))
                Text(msg.snippet)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gmHex: "1c1a17").opacity(0.85))
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))

                Text("Suggested reply")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(gmHex: "8a8478"))

                TextEditor(text: $draft)
                    .frame(minHeight: 160)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(gmHex: "d9d2c5")))

                Button {
                    Task {
                        sending = true
                        let ok = await client.sendReply(to: msg, body: draft)
                        sending = false
                        if ok { selected = nil }
                    }
                } label: {
                    Text(sending ? "Sending…" : "Send")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(Color(gmHex: "0c1207"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color(gmHex: "c4f547")))
                }
                .buttonStyle(.plain)
                .disabled(sending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("gmailSendReply")

                Link(destination: URL(string: "https://mail.google.com/mail/u/0/#inbox/\(msg.id)")!) {
                    Text("Open in Gmail")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(gmHex: "247a4d"))
                }

                if let err = client.lastError {
                    Text(err)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color(gmHex: "b42318"))
                }
                Spacer(minLength: 0)
            }
            .padding(20)
            .background(Color(gmHex: "f7f3ee"))
            .navigationTitle("Reply")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { selected = nil }
                }
            }
        }
    }

    private func customerFacingError(_ raw: String) -> String {
        if raw.localizedCaseInsensitiveContains("api")
            || raw.localizedCaseInsensitiveContains("403")
            || raw.localizedCaseInsensitiveContains("disabled") {
            return "Mail isn’t ready to load yet. Tap Try again in a minute. If it still fails, ask your MindCraft admin to finish school mail setup."
        }
        return raw
    }

    // MARK: - Ask: top mail ready reply

    private func openTopReplyIfNeeded(_ msgs: [GmailClient.Message]) {
        guard startWithTopReply, !didOpenTopReply else { return }
        guard let top = msgs.first else { return }
        didOpenTopReply = true
        draft = client.suggestedReply(for: top)
        selected = top
    }

    // MARK: - Move / resize

    private func placeOnRight(in canvas: CGSize) {
        // Exact desk screenshot placement: mid-right, not full-height.
        // Measured from student screenshot ≈ 0.43×0.50 at (0.56, 0.40).
        let w = min(460, max(420, canvas.width * 0.43))
        let h = min(400, max(340, canvas.height * 0.50))
        boardSize = CGSize(width: w, height: h)
        boardOrigin = CGPoint(
            x: max(16, canvas.width - w - 20),
            y: max(48, canvas.height * 0.40)
        )
        boardDrag = .zero
        boardFocused = true
    }

    private func boardHitPath() -> Path {
        Path(roundedRect: CGRect(
            x: boardOrigin.x + boardDrag.width,
            y: boardOrigin.y + boardDrag.height,
            width: boardSize.width,
            height: boardSize.height
        ), cornerRadius: 22)
    }

    private var moveGesture: some Gesture {
        DragGesture(minimumDistance: boardFocused ? 8 : 10_000)
            .onChanged { value in
                guard boardFocused else { return }
                boardDrag = value.translation
            }
            .onEnded { value in
                guard boardFocused else { return }
                boardOrigin.x += value.translation.width
                boardOrigin.y += value.translation.height
                boardDrag = .zero
            }
    }

    private var resizeGrip: some View {
        ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 3).fill(Color(gmHex: "143a2e").opacity(0.55)).frame(width: 22, height: 3)
            RoundedRectangle(cornerRadius: 3).fill(Color(gmHex: "143a2e").opacity(0.55)).frame(width: 3, height: 22)
        }
        .frame(width: 30, height: 30)
        .padding(8)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 1)
                .onChanged { value in
                    boardFocused = true
                    if resizeStart == nil { resizeStart = boardSize }
                    let start = resizeStart ?? boardSize
                    boardSize = CGSize(
                        width: min(720, max(320, start.width + value.translation.width)),
                        height: min(780, max(280, start.height + value.translation.height))
                    )
                }
                .onEnded { _ in resizeStart = nil }
        )
    }
}

private extension Color {
    init(gmHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
