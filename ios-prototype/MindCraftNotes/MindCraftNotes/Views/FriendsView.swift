import SwiftUI
import EventKit

/// Friends content — embedded inline in the Manage hub's "Tutors nearby"
/// slot (swaps in when Connect is tapped, swaps back out on tap again).
/// No longer a separate full-screen destination - that pushed to a whole
/// new screen instead of updating in place, which is what was actually
/// wanted. Two sections: friends the student added, and tutors from the
/// platform's tutor directory (no separate "booked tutors" tracking
/// exists yet, so this uses the full tutor roster — the honest, practical
/// scope given what data actually exists today). Each row can send a
/// QCal invite.
struct FriendsView: View {
    var studentName: String = "there"

    @StateObject private var friendsStore = FriendsStore()
    @StateObject private var tutorClient = TutorDirectoryClient()
    @State private var newName = ""
    @State private var newEmail = ""

    @State private var pendingEvent: EKEvent?
    @State private var pendingPerson: (name: String, email: String)?
    @State private var calendarAccessDenied = false
    @Environment(\.openURL) private var openURL

    private static let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
    private static let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                addFriendCard

                sectionHeader("Friends")
                if friendsStore.friends.isEmpty {
                    Text("No friends added yet. Add one above.")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(Self.ink.opacity(0.5))
                } else {
                    VStack(spacing: 10) {
                        ForEach(friendsStore.friends) { friend in
                            personRow(
                                name: friend.name,
                                subtitle: friend.email.isEmpty ? "No email on file" : friend.email,
                                email: friend.email
                            ) {
                                friendsStore.removeFriend(friend.id)
                            }
                        }
                    }
                }

                sectionHeader("Tutors")
                if tutorClient.tutors.isEmpty {
                    ProgressView().padding(.vertical, 12)
                } else {
                    VStack(spacing: 10) {
                        ForEach(tutorClient.tutors) { tutor in
                            personRow(
                                name: tutor.displayName,
                                subtitle: tutor.subjects.joined(separator: " · "),
                                email: ""
                            )
                        }
                    }
                }
            }
            .padding(4)
            .padding(.bottom, 50)
        }
        .accessibilityIdentifier("friendsInlineSection")
        .sheet(item: Binding(
            get: { pendingEvent.map { IdentifiableEvent(event: $0) } },
            set: { if $0 == nil { pendingEvent = nil } }
        )) { wrapper in
            EventEditView(event: wrapper.event, eventStore: EKEventStore()) { action in
                pendingEvent = nil
                guard action == .saved, let person = pendingPerson,
                      let url = QCalInvite.mailURL(
                        to: person.email, name: person.name,
                        eventTitle: wrapper.event.title ?? "Study session",
                        start: wrapper.event.startDate
                      )
                else { return }
                openURL(url)
            }
        }
        .alert("Calendar access needed", isPresented: $calendarAccessDenied) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Enable Calendar access for The Desk in Settings to send an invite.")
        }
    }

    private var addFriendCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Add a friend")
                .font(.system(size: 13, weight: .heavy, design: .rounded))
                .foregroundColor(Self.ink.opacity(0.6))
            HStack(spacing: 8) {
                TextField("Name", text: $newName)
                    .textFieldStyle(.plain)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.white))
                TextField("Email (optional)", text: $newEmail)
                    .textFieldStyle(.plain)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.white))
                Button {
                    friendsStore.addFriend(name: newName, email: newEmail)
                    newName = ""
                    newEmail = ""
                } label: {
                    Text("Add")
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                        .foregroundColor(Self.ink)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Self.lime))
                }
                .buttonStyle(.plain)
                .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                .accessibilityIdentifier("friendsAddButton")
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.white.opacity(0.6)))
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 17, weight: .bold, design: .rounded))
            .foregroundColor(Self.ink)
    }

    private func personRow(
        name: String, subtitle: String, email: String, onRemove: (() -> Void)? = nil
    ) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Self.ink.opacity(0.1))
                .frame(width: 38, height: 38)
                .overlay(Text(String(name.prefix(1))).font(.system(size: 15, weight: .bold, design: .rounded)).foregroundColor(Self.ink))
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 14, weight: .bold, design: .rounded)).foregroundColor(Self.ink)
                Text(subtitle).font(.system(size: 12, weight: .medium, design: .rounded)).foregroundColor(Self.ink.opacity(0.5))
            }
            Spacer()
            Button {
                Task { await sendQCalInvite(name: name, email: email) }
            } label: {
                Text("QCal invite")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundColor(Self.ink)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Self.lime.opacity(0.7)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("qcalInvite_\(name)")
            if let onRemove {
                Button(action: onRemove) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Self.ink.opacity(0.4))
                        .frame(width: 26, height: 26)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.6)))
    }

    private func sendQCalInvite(name: String, email: String) async {
        guard let event = await QCalInvite.requestAccessAndBuildEvent(
            title: "Study session with \(name)",
            notes: email.isEmpty ? "Scheduled via The Desk." : "Scheduled via The Desk. Contact: \(email)"
        ) else {
            calendarAccessDenied = true
            return
        }
        pendingPerson = (name, email)
        pendingEvent = event
    }
}

private struct IdentifiableEvent: Identifiable {
    let event: EKEvent
    var id: ObjectIdentifier { ObjectIdentifier(event) }
}
