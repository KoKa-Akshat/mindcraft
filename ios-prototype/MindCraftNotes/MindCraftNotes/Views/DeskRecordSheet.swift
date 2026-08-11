import SwiftUI

/// Live coffee-shop transcribe for Field Desk Record.
/// Uses on-device Apple Speech (free, no API key) + course tagging from binder heuristics.
struct DeskRecordSheet: View {
    @ObservedObject var store: FieldDeskStore
    var onClose: () -> Void

    @StateObject private var speech = SpeechCaptureController()
    @State private var tagCourse: String = "Inbox"
    @State private var customTag: String = ""
    @State private var note: String = ""

    private var courseChoices: [String] {
        var list = ["Inbox", "Lecture", "Meeting", "ACT", "Chem", "Math", "History", "Jobs"]
        for c in store.courses where !list.contains(c) {
            list.append(c)
        }
        return list
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Live transcribe")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(recHex: "8a8478"))
            Text("On-device speech · free · tags into Binder + intel")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(recHex: "6f6a61"))

            HStack(spacing: 10) {
                Button {
                    speech.toggle()
                } label: {
                    Label(
                        speech.isListening ? "Stop" : "Start mic",
                        systemImage: speech.isListening ? "stop.circle.fill" : "mic.circle.fill"
                    )
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(Color(recHex: "0c1207"))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color(recHex: speech.isListening ? "f4a261" : "c4f547")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskRecordToggle")

                if let status = speech.status {
                    Text(status)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(recHex: "8a8478"))
                } else if speech.isListening {
                    Text("Listening…")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(recHex: "247a4d"))
                }
            }

            // While listening, pin the live tail so new words stay on screen.
            // When stopped, fall back to an editable field.
            Group {
                if speech.isListening {
                    liveTranscriptScroller
                } else {
                    TextEditor(text: Binding(
                        get: { speech.transcript.isEmpty ? note : speech.transcript },
                        set: { newValue in
                            note = newValue
                            speech.transcript = newValue
                        }
                    ))
                    .scrollContentBackground(.hidden)
                    .padding(12)
                }
            }
            .frame(minHeight: 160, maxHeight: 280)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color(recHex: "c4a484").opacity(0.45), lineWidth: 1)
                    )
            )
            .accessibilityIdentifier("deskRecordTranscript")

            Text("Tag")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(recHex: "8a8478"))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(courseChoices, id: \.self) { course in
                        Button {
                            tagCourse = course
                        } label: {
                            Text(course)
                                .font(.system(size: 12, weight: .heavy, design: .rounded))
                                .foregroundColor(Color(recHex: tagCourse == course ? "0c1207" : "1c1a17"))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(
                                    Capsule().fill(
                                        tagCourse == course
                                        ? Color(recHex: "c4f547")
                                        : Color(recHex: "e8e2d8")
                                    )
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            TextField("Custom tag (optional)", text: $customTag)
                .textFieldStyle(.roundedBorder)

            Button {
                fileTranscript()
            } label: {
                Text("File to Binder + intel")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(recHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(recHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .disabled(liveText.isEmpty)
            .accessibilityIdentifier("deskRecordFile")

            Spacer(minLength: 0)
        }
        .padding(24)
        .onDisappear { speech.stop() }
    }

    private var liveTranscriptScroller: some View {
        ScrollViewReader { proxy in
            ScrollView {
                Text(speech.transcript.isEmpty ? "Listening… speak and words appear here." : speech.transcript)
                    .font(.system(size: 16, weight: .medium, design: .rounded))
                    .foregroundColor(Color(recHex: speech.transcript.isEmpty ? "8a8478" : "1c1a17"))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .id("transcriptBody")
                Color.clear
                    .frame(height: 1)
                    .id("transcriptTail")
            }
            .onChange(of: speech.transcript) { _, _ in
                withAnimation(.easeOut(duration: 0.15)) {
                    proxy.scrollTo("transcriptTail", anchor: .bottom)
                }
            }
            .onAppear {
                proxy.scrollTo("transcriptTail", anchor: .bottom)
            }
        }
    }

    private var liveText: String {
        let t = speech.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty { return t }
        return note.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func fileTranscript() {
        let body = liveText
        guard !body.isEmpty else { return }
        speech.stop()
        let custom = customTag.trimmingCharacters(in: .whitespacesAndNewlines)
        let course = custom.isEmpty ? tagCourse : custom
        let guessed = FieldDeskStore.guessCoursePublic(from: body)
        let resolved = (course == "Inbox" && guessed != "Inbox") ? guessed : course
        let title = "Transcript · \(Self.shortStamp())"
        store.addManualNote(title: title, course: resolved, body: body)
        store.prependIntel("Transcript · \(resolved) · \(String(body.prefix(60)))")
        onClose()
    }

    private static func shortStamp() -> String {
        let f = DateFormatter()
        f.dateFormat = "MMM d · h:mm a"
        return f.string(from: Date())
    }
}

private extension Color {
    init(recHex hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b: UInt64
        switch cleaned.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (1, 1, 1)
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
