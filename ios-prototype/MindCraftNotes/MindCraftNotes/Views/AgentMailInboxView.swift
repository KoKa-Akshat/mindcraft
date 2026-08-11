import SwiftUI

/// Live Inbox powered by AgentMail - empty state matches AgentMail Console
/// (“This is a real email inbox…”); message detail mirrors Gmail’s
/// “✨ Suggested reply” card with Reply / Forward actions that send via API.
struct AgentMailInboxView: View {
    @StateObject private var client = AgentMailClient.shared
    @EnvironmentObject private var studentStore: FirestoreStudentStore
    @State private var draftKey = ""
    @State private var selected: AgentMailMessage?
    @State private var detail: AgentMailMessageDetail?
    @State private var showCompose = false
    @State private var composeTo = ""
    @State private var composeSubject = ""
    @State private var composeBody = ""
    @State private var status: String?

    var body: some View {
        Group {
            if let selected {
                messageDetail(selected)
            } else if !client.isConfigured {
                setupView
            } else if !client.hasInbox {
                createInboxView
            } else {
                inboxList
            }
        }
        .background(Color(amHex: "0a0a0a"))
        .task {
            if client.isConfigured, client.hasInbox {
                await client.refreshMessages()
            }
        }
        .sheet(isPresented: $showCompose) {
            composeSheet
        }
    }

    // MARK: - Setup (API key)

    private var setupView: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Live Inbox")
                .font(.system(size: 22, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
            Text("Connect AgentMail so this desk can send + receive real email (summaries + suggested replies included).")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.55))
            Text("1. Create an API key at console.agentmail.to\n2. Paste it below\n3. We’ll create a @agentmail.to inbox for this desk")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)

            SecureField("AGENTMAIL_API_KEY (am_…)", text: $draftKey)
                .textFieldStyle(.plain)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
                .foregroundColor(.white)
                .accessibilityIdentifier("agentMailApiKeyField")

            Button {
                client.saveApiKey(draftKey)
                Task { await client.createInbox() }
            } label: {
                Text(client.isBusy ? "Working…" : "Save key + create inbox")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(amHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(amHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .disabled(draftKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || client.isBusy)
            .accessibilityIdentifier("agentMailSaveKey")

            if let err = client.lastError {
                Text(err)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(amHex: "ff8a80"))
            }
            Spacer()
        }
        .padding(20)
    }

    private var createInboxView: some View {
        VStack(spacing: 16) {
            Text("Live Inbox.")
                .font(.system(size: 22, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
            Image(systemName: "envelope")
                .font(.system(size: 36, weight: .light))
                .foregroundColor(.white.opacity(0.45))
            Text("API key saved. Create a real AgentMail inbox for this desk.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.55))
                .multilineTextAlignment(.center)
            Button {
                Task { await client.createInbox() }
            } label: {
                Text(client.isBusy ? "Creating…" : "Create inbox")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(amHex: "0c1207"))
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(Color(amHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("agentMailCreateInbox")
            if let err = client.lastError {
                Text(err)
                    .font(.system(size: 12))
                    .foregroundColor(Color(amHex: "ff8a80"))
            }
            Spacer()
        }
        .padding(24)
    }

    // MARK: - List

    private var inboxList: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Live Inbox.")
                    .font(.system(size: 20, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                Spacer()
                Button {
                    Task { await client.refreshMessages() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundColor(.white.opacity(0.75))
                }
                .accessibilityIdentifier("agentMailRefresh")
                Button { showCompose = true } label: {
                    Image(systemName: "square.and.pencil")
                        .foregroundColor(Color(amHex: "c4f547"))
                }
                .accessibilityIdentifier("agentMailCompose")
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 10)

            HStack(spacing: 8) {
                Text(client.inboxEmail ?? "…")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundColor(Color(amHex: "9fd6ac"))
                    .lineLimit(1)
                    .textSelection(.enabled)
                Button {
                    UIPasteboard.general.string = client.inboxEmail
                    status = "Address copied"
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white.opacity(0.5))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 12)

            Divider().overlay(Color.white.opacity(0.12))

            if client.messages.isEmpty {
                VStack(spacing: 12) {
                    Spacer(minLength: 40)
                    Image(systemName: "envelope")
                        .font(.system(size: 40, weight: .ultraLight))
                        .foregroundColor(.white.opacity(0.35))
                    Text("This is a real email inbox just created for you.")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.55))
                    Text("Send it an email and see it show up in real time.")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.4))
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("agentMailEmpty")
            } else {
                List {
                    ForEach(client.messages) { msg in
                        Button {
                            open(msg)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(msg.from ?? "Unknown")
                                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                                    .foregroundColor(.white)
                                Text(msg.subject ?? "(no subject)")
                                    .font(.system(size: 13, weight: .medium, design: .rounded))
                                    .foregroundColor(.white.opacity(0.85))
                                Text(SuggestedReplyEngine.summarize(
                                    subject: msg.subject,
                                    preview: msg.preview,
                                    body: nil
                                ))
                                .font(.system(size: 12, weight: .regular, design: .rounded))
                                .foregroundColor(.white.opacity(0.45))
                                .lineLimit(2)
                            }
                            .padding(.vertical, 4)
                        }
                        .listRowBackground(Color(amHex: "121212"))
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }

            if let status {
                Text(status)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(amHex: "c4f547"))
                    .padding(12)
            }
            if let err = client.lastError {
                Text(err)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(amHex: "ff8a80"))
                    .padding(12)
            }
        }
    }

    // MARK: - Detail (Gmail-like suggested reply)

    private func messageDetail(_ msg: AgentMailMessage) -> some View {
        let body = detail?.extracted_text ?? detail?.text ?? msg.preview ?? ""
        let summary = SuggestedReplyEngine.summarize(
            subject: msg.subject,
            preview: msg.preview,
            body: body
        )
        let suggestion = SuggestedReplyEngine.suggest(
            from: msg.from,
            subject: msg.subject,
            body: body,
            signer: studentStore.displayName == "there" ? "Akshat" : studentStore.displayName
        )

        return ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Button {
                        selected = nil
                        detail = nil
                    } label: {
                        Image(systemName: "chevron.left")
                            .foregroundColor(.white)
                    }
                    Text("Summarize this email.")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.55))
                    Spacer()
                }

                Text(summary)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(amHex: "c4f547"))
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
                    .accessibilityIdentifier("agentMailSummary")

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Circle()
                            .fill(Color.purple.opacity(0.7))
                            .frame(width: 36, height: 36)
                            .overlay(
                                Text(String((msg.from ?? "?").prefix(1)).lowercased())
                                    .foregroundColor(.white)
                                    .font(.system(size: 16, weight: .bold))
                            )
                        VStack(alignment: .leading, spacing: 2) {
                            Text(msg.from ?? "Unknown")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                            Text(msg.timestamp ?? "")
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundColor(.white.opacity(0.45))
                        }
                        Spacer()
                    }
                    Text(msg.subject ?? "(no subject)")
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                    Text(body.isEmpty ? "Loading body…" : body)
                        .font(.system(size: 14, weight: .regular, design: .rounded))
                        .foregroundColor(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.06)))

                VStack(alignment: .leading, spacing: 10) {
                    Label("Suggested reply", systemImage: "sparkles")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(.white.opacity(0.7))
                    Text(suggestion)
                        .font(.system(size: 14, weight: .regular, design: .rounded))
                        .foregroundColor(.white.opacity(0.9))
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.08)))
                        .accessibilityIdentifier("agentMailSuggestedReply")

                    HStack(spacing: 12) {
                        Button {
                            Task {
                                let ok = await client.reply(messageId: msg.message_id, text: suggestion)
                                status = ok ? "Reply sent" : (client.lastError ?? "Send failed")
                                if ok { selected = nil }
                            }
                        } label: {
                            Label("Reply", systemImage: "arrowshape.turn.up.left.fill")
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 18)
                                .padding(.vertical, 12)
                                .background(Capsule().fill(Color(amHex: "1a73e8")))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("agentMailReply")

                        Button {
                            composeTo = msg.from ?? ""
                            composeSubject = "Fwd: \(msg.subject ?? "")"
                            composeBody = body
                            showCompose = true
                        } label: {
                            Label("Forward", systemImage: "arrowshape.turn.up.right.fill")
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 18)
                                .padding(.vertical, 12)
                                .background(Capsule().fill(Color(amHex: "1a73e8")))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(18)
        }
        .task {
            detail = await client.getMessage(id: msg.message_id)
        }
    }

    private var composeSheet: some View {
        NavigationStack {
            Form {
                TextField("To", text: $composeTo)
                TextField("Subject", text: $composeSubject)
                TextField("Message", text: $composeBody, axis: .vertical)
                    .lineLimit(6...12)
            }
            .navigationTitle("Compose")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showCompose = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        Task {
                            let ok = await client.send(
                                to: composeTo,
                                subject: composeSubject,
                                text: composeBody
                            )
                            status = ok ? "Sent" : (client.lastError ?? "Failed")
                            if ok { showCompose = false }
                        }
                    }
                    .disabled(composeTo.isEmpty || composeBody.isEmpty)
                }
            }
        }
    }

    private func open(_ msg: AgentMailMessage) {
        selected = msg
        detail = nil
        Task { detail = await client.getMessage(id: msg.message_id) }
    }
}

private extension Color {
    init(amHex hex: String) {
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
