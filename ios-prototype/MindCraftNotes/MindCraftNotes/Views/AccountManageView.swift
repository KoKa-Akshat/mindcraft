import SwiftUI
import FirebaseAuth
import FirebaseFirestore

/// Account settings from hub gear - username, billing + whitepaper, sign out.
struct AccountManageView: View {
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var studentStore: FirestoreStudentStore
    @Environment(\.dismiss) private var dismiss

    @State private var username: String = ""
    @State private var saveNote: String?
    @State private var showWhitepaper = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    sectionHeader("Profile")
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Username")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(.secondary)
                        TextField("Display name", text: $username)
                            .textFieldStyle(.roundedBorder)
                            .accessibilityIdentifier("manageUsernameField")
                        Button("Save username") {
                            Task { await saveUsername() }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(shellHex: "c4f547"))
                        .foregroundColor(Color(shellHex: "0c1207"))
                        .accessibilityIdentifier("manageSaveUsername")
                        if let email = authService.currentUser?.email {
                            Text(email)
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(16)
                    .background(cardBg)

                    sectionHeader("Billing")
                    VStack(alignment: .leading, spacing: 12) {
                        Text("MindCraft Beta · free while we ship Desk OS")
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                        Text("Plan changes, invoices, and seats land here. For now you are on the founder beta - no card required.")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(.secondary)
                        Text("Billing · Coming soon")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(Color.primary.opacity(0.08)))

                        Button {
                            showWhitepaper = true
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Whitepaper")
                                        .font(.system(size: 16, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(shellHex: "1c1a17"))
                                    Text("Mission, algorithm, and what we build.")
                                        .font(.system(size: 12, weight: .medium, design: .rounded))
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                Image(systemName: "doc.richtext")
                                    .foregroundColor(Color(shellHex: "c4f547"))
                            }
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color.primary.opacity(0.04))
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("manageWhitepaper")
                    }
                    .padding(16)
                    .background(cardBg)
                    .accessibilityIdentifier("manageBilling")

                    Button("Sign out") {
                        dismiss()
                        authService.signOut()
                    }
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(.red.opacity(0.85))
                    .padding(.top, 8)

                    if let saveNote {
                        Text(saveNote)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(shellHex: "54b948"))
                    }
                }
                .padding(20)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                username = studentStore.displayName == "there" ? "" : studentStore.displayName
            }
            .sheet(isPresented: $showWhitepaper) {
                MindCraftWhitepaperView()
            }
        }
        .accessibilityIdentifier("accountManage")
    }

    private var cardBg: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(Color(uiColor: .secondarySystemBackground))
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .tracking(0.8)
            .foregroundColor(.secondary)
    }

    private func saveUsername() async {
        let name = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            saveNote = "Enter a username"
            return
        }
        await studentStore.updateDisplayName(name)
        saveNote = "Username updated"
    }
}

/// Company-style whitepaper - mission, algorithm, what we do.
struct MindCraftWhitepaperView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("MindCraft Whitepaper")
                        .font(.system(size: 28, weight: .bold, design: .serif))
                    Text("Learning infrastructure that turns scattered school signals into a living Field Desk.")
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)

                    block(title: "Mission") {
                        bullet("Help students own their work - mail, calendar, notes, practice - in one desk.")
                        bullet("Make mastery visible with honest check-ins, not vanity scores.")
                        bullet("Keep humans in the loop while agents file, draft, and coach.")
                    }

                    block(title: "What we do") {
                        bullet("Desk OS instances (Field Desk, ACT Field Book, custom books) as durable workspaces.")
                        bullet("Connectors that land real artifacts into Binder + Intel.")
                        bullet("Practice grounded in a large ACT-aligned question bank with full-page writing.")
                        bullet("Live Call co-working and tutor discovery for real humans nearby.")
                    }

                    block(title: "The algorithm (plain English)") {
                        bullet("Signals - outcomes, check-ins, filed work - accumulate per instance.")
                        bullet("Mastery is evidence-gated: we show a percent only when you’ve checked in.")
                        bullet("Gap scan ranks weak concepts from practice outcomes (same family as the web gap map).")
                        bullet("Routing picks the next practice slice from weaknesses + curriculum structure.")
                        bullet("Agents assist (summaries, suggested replies, filing) - they don’t invent mastery.")
                    }

                    block(title: "Principles") {
                        bullet("Local-first where school OAuth is blocked; real Gmail for student mail.")
                        bullet("Never fake progress - empty states stay honest.")
                        bullet("Ship the desk students can feel, then deepen the agent.")
                    }

                    Text("© MindCraft · joinmindcraft.com")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)
                        .padding(.top, 8)
                }
                .padding(24)
            }
            .navigationTitle("Whitepaper")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .accessibilityIdentifier("mindcraftWhitepaper")
        }
    }

    private func block(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 18, weight: .bold, design: .rounded))
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemBackground))
        )
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("•")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Color(shellHex: "c4f547"))
            Text(text)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
