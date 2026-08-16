import SwiftUI

/// **ACT Field Book as its own Desk instance** - empty canvas + dash + notes
/// box + a thin tool strip. Not Field Desk wallpaper / Connect / Binder.
/// From Binder: minimize returns to Field Desk; practice progress resumes.
struct ActInstanceShellView: View {
    /// When presented from Field Desk Binder, minimize closes the cover
    /// without wiping saved practice/notes. Falls back to `dismiss()`.
    var onMinimize: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var studentStore: FirestoreStudentStore
    @EnvironmentObject private var authService: AuthService

    @AppStorage("actInstance.scratchNotes") private var scratchNotes: String = ""
    @State private var showNotes = true
    @State private var askDraft = ""

    private func minimizeToBinder() {
        (onMinimize ?? { dismiss() })()
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ActEmptyCanvasBackground()

                VStack(spacing: 0) {
                    topBar
                    HStack(alignment: .top, spacing: 12) {
                        // House lands on dash Home; Minimize (below) returns to Binder.
                        DashboardView(embeddedInDesk: true)
                            .environmentObject(studentStore)
                            .environmentObject(authService)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 20, style: .continuous)
                                    .stroke(Color.white.opacity(0.10), lineWidth: 1)
                            )
                            .shadow(color: .black.opacity(0.35), radius: 18, y: 8)

                        if showNotes {
                            notesBox
                                .frame(width: min(280, max(220, proxy.size.width * 0.22)))
                                .transition(.move(edge: .trailing).combined(with: .opacity))
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 4)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                    toolsStrip
                        .padding(.horizontal, 14)
                        .padding(.bottom, 12)
                        .padding(.top, 8)
                }
            }
        }
        .ignoresSafeArea(.keyboard)
        .statusBarHidden(true)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("actInstanceShell")
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Text("ACT Field Book")
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundColor(.white.opacity(0.92))
            Spacer(minLength: 0)
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { showNotes.toggle() }
            } label: {
                Label(showNotes ? "Hide notes" : "Notes", systemImage: "note.text")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(actShellHex: "0c1207"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(actShellHex: "9fd6ac")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("actInstanceNotesToggle")

            // "Done" - standard label across every screen except the
            // dashboard itself (which gets "Exit").
            Button(action: minimizeToBinder) {
                Text("Done")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(actShellHex: "0c1207"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(actShellHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("actInstanceDone")
            .accessibilityLabel("Minimize to Binder")
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    private var notesBox: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Notes")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(actShellHex: "1c1a17"))
                Spacer()
                Text("scratch")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(actShellHex: "8a8478"))
            }
            TextEditor(text: $scratchNotes)
                .font(.system(size: 14, design: .serif))
                .scrollContentBackground(.hidden)
                .foregroundColor(Color(actShellHex: "1c1a17"))
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(actShellHex: "f7f3ee").opacity(0.92))
                )
                .accessibilityIdentifier("actInstanceNotesEditor")
            Text("Jot while you map · work · practice. Stays on this device.")
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundColor(Color(actShellHex: "6f6a61"))
        }
        .padding(12)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.92))
                .shadow(color: .black.opacity(0.25), radius: 14, y: 6)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color(actShellHex: "c4f547").opacity(0.35), lineWidth: 1)
        )
    }

    // One real toolbar, not two stacked ones: this used to lead with three
    // Map/Work/Notes chips - two permanently disabled ("dash owns tabs," so
    // they never did anything) and the third a redundant second Notes
    // toggle duplicating `topBar`'s real one. Just the Ask bar now; the tab
    // navigation that actually works lives in `DashboardView` above this.
    private var toolsStrip: some View {
        HStack(spacing: 8) {
            TextField("Ask this page…", text: $askDraft)
                .textFieldStyle(.plain)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.9))
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(Capsule().fill(Color.white.opacity(0.08)))
            Button("Ask") {
                askDraft = ""
            }
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundColor(Color(actShellHex: "0c1207"))
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(Capsule().fill(Color(actShellHex: "c4f547")))
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.black.opacity(0.35))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
        .accessibilityIdentifier("actInstanceTools")
    }
}

/// Soft empty canvas - not the Field Desk photo wallpaper.
private struct ActEmptyCanvasBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(actShellHex: "101820"),
                    Color(actShellHex: "0c141c"),
                    Color(actShellHex: "081018")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Canvas { ctx, size in
                let step: CGFloat = 32
                for x in stride(from: 0, through: size.width, by: step) {
                    for y in stride(from: 0, through: size.height, by: step) {
                        let r = CGRect(x: x, y: y, width: 1.4, height: 1.4)
                        ctx.fill(Path(ellipseIn: r), with: .color(.white.opacity(0.06)))
                    }
                }
            }
            RadialGradient(
                colors: [Color(actShellHex: "c4f547").opacity(0.08), .clear],
                center: UnitPoint(x: 0.85, y: 0.12),
                startRadius: 0,
                endRadius: 420
            )
            RadialGradient(
                colors: [Color(actShellHex: "1d3a8a").opacity(0.18), .clear],
                center: UnitPoint(x: 0.12, y: 0.88),
                startRadius: 0,
                endRadius: 480
            )
        }
        .ignoresSafeArea()
    }
}

/// Instances the Field Desk Binder can launch (dynamic hub + customs).
enum DeskBoundInstance: Identifiable, Hashable {
    case actFieldBook
    case testCook
    case custom(id: String, name: String, subject: String)

    var id: String {
        switch self {
        case .actFieldBook: return "act_main"
        case .testCook: return "test_main"
        case .custom(let id, _, _): return "custom_\(id)"
        }
    }

    var title: String {
        switch self {
        case .actFieldBook: return "ACT Field Book"
        case .testCook: return "Doc → Cook"
        case .custom(_, let name, _): return name
        }
    }

    var badge: String {
        switch self {
        case .actFieldBook: return "ACT"
        case .testCook: return "Cook"
        case .custom(_, _, let subject): return subject
        }
    }

    var systemImage: String {
        switch self {
        case .actFieldBook: return "book.closed.fill"
        case .testCook: return "doc.badge.gearshape.fill"
        case .custom: return "books.vertical.fill"
        }
    }

    static func builtinsPlusCustoms(_ customs: [CustomInstance]) -> [DeskBoundInstance] {
        // Binder centerpiece is ACT (lives in Field Desk stage). Doc→Cook
        // stays on the hub test-instance card, not here.
        var list: [DeskBoundInstance] = [.actFieldBook]
        list.append(contentsOf: customs.map { .custom(id: $0.id, name: $0.name, subject: $0.subject) })
        return list
    }
}

private extension Color {
    init(actShellHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
