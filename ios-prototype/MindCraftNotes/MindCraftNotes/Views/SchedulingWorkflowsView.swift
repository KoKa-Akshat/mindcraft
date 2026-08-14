import SwiftUI

/// Doodle-style scheduling workflows on the Field Desk.
/// Group Poll / Sign-up / 1:1 are in-house (Gmail + GCal). Booking → Calendly.
/// Layout language matches Studio Create: floating board, center stage, side tools.
struct SchedulingWorkflowsView: View {
    var onClose: () -> Void
    var onOpenApplyToday: (() -> Void)? = nil
    var calendlyURL: URL = URL(string: "https://calendly.com/joinmindcraft/30min")!

    private enum Phase: Equatable {
        case picker
        case editor(Kind)
    }

    enum Kind: String, CaseIterable, Identifiable {
        case poll, signup, oneOne
        var id: String { rawValue }
        var title: String {
            switch self {
            case .poll: return "Group Poll"
            case .signup: return "Sign-up Sheet"
            case .oneOne: return "1:1"
            }
        }
        var blurb: String {
            switch self {
            case .poll: return "Find the time that works best for everyone. Calendar free/busy + Gmail invites."
            case .signup: return "Workshops, office hours, events — people claim the seat they want."
            case .oneOne: return "Offer open times. They pick one. GCal blocks + Gmail confirmation."
            }
        }
        var accent: Color {
            switch self {
            case .poll: return Color(swHex: "c4a484")
            case .signup: return Color(swHex: "1f6b4a")
            case .oneOne: return Color(swHex: "72c74a")
            }
        }
        var icon: String {
            switch self {
            case .poll: return "circle.grid.2x2.fill"
            case .signup: return "list.bullet.rectangle.fill"
            case .oneOne: return "person.2.fill"
            }
        }
        var defaults: (title: String, note: String, slots: [String]) {
            switch self {
            case .poll:
                return (
                    "When works for study hall?",
                    "Pick every time you can make. We’ll lock the best overlap.",
                    ["Tue 4:00–4:30 PM", "Tue 5:00–5:30 PM", "Wed 3:30–4:00 PM", "Thu 4:00–4:30 PM"]
                )
            case .signup:
                return (
                    "Office hours sign-up",
                    "One seat per slot. Claim yours before it fills.",
                    ["Mon 12:00 · Seat 1", "Mon 12:30 · Seat 1", "Wed 4:00 · Seat 1", "Wed 4:30 · Seat 1"]
                )
            case .oneOne:
                return (
                    "Book a 1:1 with me",
                    "Open windows this week. Pick one — Calendar + Gmail handle the rest.",
                    ["Fri 10:00 AM", "Fri 11:00 AM", "Sat 2:00 PM", "Sun 4:00 PM"]
                )
            }
        }
    }

    @State private var phase: Phase = .picker
    @State private var titleText = ""
    @State private var noteText = ""
    @State private var slots: [String] = []
    @State private var slides: [Slide] = []
    @State private var aiPrompt = ""
    @State private var toast: String?

    private struct Slide: Identifiable, Equatable {
        let id: Int
        var label: String
        var body: String
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.22)
                .ignoresSafeArea()
                .onTapGesture { /* keep desk dim; close via ← */ }

            VStack(spacing: 0) {
                header
                Group {
                    switch phase {
                    case .picker:
                        pickerBody
                    case .editor:
                        editorBody
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(maxWidth: 1100)
            .frame(maxHeight: 740)
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(Color(swHex: "fffcf7"))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(Color(swHex: "143a2e").opacity(0.08), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.2), radius: 28, y: 12)
            .padding(20)

            if let toast {
                VStack {
                    Spacer()
                    Text(toast)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(swHex: "f4efe2"))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color(swHex: "1a2e24")))
                        .padding(.bottom, 36)
                }
                .allowsHitTesting(false)
            }
        }
        .accessibilityIdentifier("schedulingWorkflows")
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                switch phase {
                case .picker: onClose()
                case .editor: phase = .picker
                }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Color(swHex: "0c1207"))
                    .frame(width: 38, height: 38)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black.opacity(0.06), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("schedulingWorkflowsBack")

            Text(headerTitle)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundColor(Color(swHex: "0c1207"))

            Spacer()

            Text("Linked · Gmail · Calendar")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(swHex: "143a2e"))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Capsule().fill(Color(swHex: "c4f547").opacity(0.35)))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.black.opacity(0.06)).frame(height: 1)
        }
    }

    private var headerTitle: String {
        switch phase {
        case .picker: return "Select your workflow"
        case .editor(let k): return k.title
        }
    }

    private var pickerBody: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 8) {
                    Text("Select your workflow")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundColor(Color(swHex: "0c1207"))
                    Text("In-house for poll · sign-up · 1:1. Booking stays on Calendly.")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(swHex: "6f6a61"))
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 8)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                    ForEach(Kind.allCases) { kind in
                        workflowCard(
                            title: kind.title,
                            blurb: kind.blurb,
                            accent: kind.accent,
                            icon: kind.icon,
                            badge: "In-house",
                            onCreate: { openEditor(kind) },
                            onAI: { openEditor(kind); aiPrompt = aiSeed(for: kind); runAI() }
                        )
                    }
                    workflowCard(
                        title: "Booking Page",
                        blurb: "Your Calendly page — share once, let clients book in a few clicks.",
                        accent: Color(swHex: "3b82c4"),
                        icon: "calendar.badge.clock",
                        badge: "Calendly",
                        onCreate: { UIApplication.shared.open(calendlyURL) },
                        onAI: { flash("Customize booking in Calendly settings") }
                    )
                }

                if let onOpenApplyToday {
                    Button {
                        onClose()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            onOpenApplyToday()
                        }
                    } label: {
                        HStack {
                            Image(systemName: "briefcase.fill")
                            Text("Also: Apply today board")
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .foregroundColor(Color(swHex: "143a2e"))
                        .padding(14)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color.white))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black.opacity(0.06), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("schedulingOpenApplyToday")
                }
            }
            .padding(28)
        }
    }

    private func workflowCard(
        title: String,
        blurb: String,
        accent: Color,
        icon: String,
        badge: String,
        onCreate: @escaping () -> Void,
        onAI: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(swHex: "f3eee3"))
                    .frame(height: 110)
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 52, height: 52)
                            .background(RoundedRectangle(cornerRadius: 14).fill(accent))
                    )
                Text(badge)
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color(swHex: "143a2e")))
                    .padding(10)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)

            Text(title)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .padding(.horizontal, 14)
                .padding(.top, 12)
            Text(blurb)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(swHex: "6f6a61"))
                .padding(.horizontal, 14)
                .padding(.top, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(minHeight: 56, alignment: .topLeading)

            Button(action: onCreate) {
                Text("Create")
                    .font(.system(size: 14, weight: .heavy, design: .rounded))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(Capsule().stroke(Color(swHex: "0c1207"), lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 14)
            .padding(.top, 10)

            // AI customize sits under Create (the “wow” secondary)
            Button(action: onAI) {
                Text("AI customize")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(swHex: "143a2e"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(swHex: "c4f547").opacity(0.35)))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 14)
            .padding(.top, 8)
            .padding(.bottom, 14)
        }
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white)
                .shadow(color: Color(swHex: "143a2e").opacity(0.06), radius: 12, y: 6)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
        .accessibilityIdentifier("schedulingCard_\(title)")
    }

    private var editorBody: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Setup")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                Text("Studio-style board · edit then share")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(swHex: "6f6a61"))
                labeledField("Title", text: $titleText)
                labeledField("Note", text: $noteText, multi: true)
                Button {
                    slots.append(phaseKind == .signup ? "New seat · \(slots.count + 1)" : "New time window")
                } label: {
                    Text("+ Add time / seat")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .padding(10)
                        .background(Capsule().stroke(Color.black.opacity(0.1), lineWidth: 1))
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 8) {
                    TextField("AI customize…", text: $aiPrompt, axis: .vertical)
                        .lineLimit(3...5)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                    Button(action: runAI) {
                        Text("AI customize")
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(Color(swHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color(swHex: "c4f547").opacity(0.2)))
            }
            .padding(14)
            .frame(width: 240, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 18).fill(Color.white))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.black.opacity(0.06), lineWidth: 1))

            VStack(spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    LinearGradient(
                        colors: [Color(swHex: "143a2e").opacity(0.2), Color(swHex: "0c1207").opacity(0.75)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    VStack(alignment: .leading, spacing: 6) {
                        Text(titleText)
                            .font(.system(size: 30, weight: .regular))
                            .foregroundColor(.white)
                        Text(noteText)
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundColor(.white.opacity(0.9))
                    }
                    .padding(22)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                HStack(spacing: 8) {
                    actionChip("Share link →", lime: true) { flash("Share link copied (prototype)") }
                    actionChip("Send via Gmail") { flash("Gmail draft queued · desk mail") }
                    actionChip("Block on Calendar") { flash("Calendar holds placed (prototype)") }
                }
                .padding(12)
                .background(Color(swHex: "fffcf7"))
            }
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.black.opacity(0.06), lineWidth: 1))
            .shadow(color: Color(swHex: "143a2e").opacity(0.08), radius: 16, y: 8)

            VStack(alignment: .leading, spacing: 10) {
                Text("Slots")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                Text("From Calendar free windows (seed)")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(swHex: "6f6a61"))
                ForEach(Array(slots.enumerated()), id: \.offset) { idx, slot in
                    HStack {
                        Text(slot)
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                        Spacer()
                        Button("Remove") { slots.remove(at: idx) }
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(Color(swHex: "a33333"))
                    }
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(swHex: "f7f4ec")))
                }

                Text("Slideshow")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .padding(.top, 8)
                Text("Mute-friendly share deck")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(swHex: "6f6a61"))

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(slides) { slide in
                            VStack(spacing: 4) {
                                Text(slide.label)
                                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                                Text(slide.body)
                                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                                    .lineLimit(3)
                                    .multilineTextAlignment(.center)
                            }
                            .foregroundColor(Color(swHex: "f4efe2"))
                            .frame(width: 88, height: 120)
                            .padding(6)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(LinearGradient(colors: [Color(swHex: "143a2e"), Color(swHex: "2a5644")], startPoint: .topLeading, endPoint: .bottomTrailing))
                            )
                        }
                        Button(action: addSlide) {
                            VStack(spacing: 4) {
                                Text("+")
                                    .font(.system(size: 22, weight: .bold, design: .rounded))
                                Text("Add slide")
                                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                            }
                            .foregroundColor(Color(swHex: "143a2e"))
                            .frame(width: 88, height: 120)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color(swHex: "c4f547").opacity(0.4)))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [5])))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("schedulingAddSlide")
                    }
                }
            }
            .padding(14)
            .frame(width: 240, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 18).fill(Color.white))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.black.opacity(0.06), lineWidth: 1))
        }
        .padding(20)
    }

    private var phaseKind: Kind {
        if case .editor(let k) = phase { return k }
        return .poll
    }

    private func openEditor(_ kind: Kind) {
        let d = kind.defaults
        titleText = d.title
        noteText = d.note
        slots = d.slots
        slides = [Slide(id: 1, label: "Cover", body: d.title)]
        aiPrompt = ""
        phase = .editor(kind)
    }

    private func addSlide() {
        let n = slides.count + 1
        slides.append(Slide(id: n, label: "Slide \(n)", body: n == 2 ? "How it works" : "Beat \(n)"))
        flash("Slide added")
    }

    private func aiSeed(for kind: Kind) -> String {
        switch kind {
        case .poll: return "Make this a Friday ACT review poll for 6 friends"
        case .signup: return "Workshop: Desmos graphing lab, 8 seats"
        case .oneOne: return "College essay check-ins, 25 min each"
        }
    }

    private func runAI() {
        let p = aiPrompt.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !p.isEmpty else { flash("Type what you want AI to shape"); return }
        if p.contains("act") || p.contains("friday") {
            titleText = "Friday ACT review — when works?"
            noteText = "Quick group poll. Calendar checks free/busy; Gmail sends the invite."
            slots = ["Fri 4:00 PM", "Fri 5:00 PM", "Fri 6:00 PM", "Sat 11:00 AM"]
        } else if p.contains("desmos") || p.contains("workshop") || p.contains("seat") {
            titleText = "Desmos graphing lab"
            noteText = "8 seats. Claim one — reminder hits Gmail night before."
            slots = (1...8).map { "Wed 3:00 · Seat \($0)" }
        } else if p.contains("essay") || p.contains("college") || p.contains("25") {
            titleText = "College essay 1:1 (25 min)"
            noteText = "Pick a window. We block GCal and send a Meet note."
            slots = ["Mon 5:00 PM", "Tue 5:00 PM", "Thu 4:30 PM", "Sun 2:00 PM"]
        } else {
            titleText = titleText + " · AI pass"
            noteText = "AI shaped this from your note. Edit slots, then share."
        }
        if !slides.isEmpty { slides[0].body = titleText }
        flash("AI customize applied (local draft)")
    }

    private func labeledField(_ label: String, text: Binding<String>, multi: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundColor(Color(swHex: "6f6a61"))
            if multi {
                TextField(label, text: text, axis: .vertical)
                    .lineLimit(3...5)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(swHex: "faf8f3")))
            } else {
                TextField(label, text: text)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(swHex: "faf8f3")))
            }
        }
    }

    private func actionChip(_ title: String, lime: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(swHex: "0c1207"))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    Capsule().fill(lime ? Color(swHex: "c4f547") : Color.white)
                )
                .overlay(Capsule().stroke(Color.black.opacity(lime ? 0 : 0.08), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func flash(_ message: String) {
        toast = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if toast == message { toast = nil }
        }
    }
}

private extension Color {
    init(swHex: String) {
        let hex = swHex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: 1
        )
    }
}
