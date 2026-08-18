import SwiftUI

/// The one "Jesse is here" card design, shared by every screen that carries
/// it - extracted from `CreateCanvasView.jesseRail` (Presentation/GDoc's
/// original, proven implementation) rather than each screen growing its own
/// slightly-different copy. Avatar + greeting + one call button + inline
/// transcript, all in one box at one fixed position, whether or not a call
/// is live - never a separate box that appears only once a call starts
/// (that read as teleporting to a new tab instead of the conversation just
/// continuing, the exact mistake `jesseRail`'s own doc comment already
/// names and avoids).
struct JesseRailView: View {
    var studentName: String
    var context: String

    @EnvironmentObject private var jesseCall: JesseCallSession
    @State private var instructionLog: [String] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(jrHex: "e8f3ec"))
                    Image(systemName: "face.smiling")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundColor(Color(jrHex: "247a4d"))
                }
                .frame(width: 52, height: 52)
                VStack(alignment: .leading, spacing: 4) {
                    JesseMiniWaveform(active: jesseCall.isSpeaking || jesseCall.isListening)
                    Text(jesseCall.isActive ? "On the line" : "Just now")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(jrHex: "143a2e").opacity(0.45))
                }
                Spacer(minLength: 0)
            }

            Text("Hi \(studentName), Jesse here.")
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundColor(Color(jrHex: "143a2e"))
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(jrHex: "eef1ec"))
                )

            HStack(spacing: 10) {
                Button(action: jesseCall.isActive ? endCall : jumpOnCall) {
                    HStack {
                        Image(systemName: jesseCall.isActive ? "phone.down.fill" : "phone.fill")
                        Text(jesseCall.isActive ? "End call" : "Jump on a call with Jesse")
                        Spacer(minLength: 0)
                        if !jesseCall.isActive { Image(systemName: "arrow.right") }
                    }
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(Capsule().fill(jesseCall.isActive ? Color(jrHex: "b0473f") : Color.black))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("jesseRailCall")

                // Listening starts automatically once the call connects
                // (see jumpOnCall) - this toggle is for muting mid-call,
                // matching JesseCallOverlay's own mic button
                // (tap-to-toggle, never hold-to-talk, per CLAUDE.md).
                if jesseCall.isActive {
                    Button {
                        jesseCall.isListening ? jesseCall.stopListening() : jesseCall.startListening()
                    } label: {
                        Image(systemName: jesseCall.isListening ? "mic.fill" : "mic.slash.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 48, height: 48)
                            .background(Circle().fill(jesseCall.isListening ? Color(jrHex: "247a4d") : Color(jrHex: "8a8478")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("jesseRailMic")
                }
            }

            // Auto-transcribes inline, on the screen itself - not a separate
            // full-screen call sheet. This IS the "live call thing" - the
            // same jesseCall.turns/liveTranscript state a modal sheet would
            // show, just rendered in place instead of behind a second
            // presentation.
            if !jesseCall.turns.isEmpty || !instructionLog.isEmpty || jesseCall.isListening || jesseCall.isThinking {
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(jesseCall.turns) { turn in
                            transcriptLine(turn.speaker == "jesse" ? "Jesse" : studentName, turn.text)
                        }
                        if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty {
                            transcriptLine(studentName, jesseCall.liveTranscript)
                                .opacity(0.55)
                        }
                        ForEach(Array(instructionLog.enumerated()), id: \.offset) { _, line in
                            transcriptLine("Dock", line)
                        }
                        if jesseCall.isThinking {
                            Text("Jesse is working")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(jrHex: "247a4d"))
                        }
                    }
                }
                .frame(maxHeight: 240)
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(jrHex: "f3f1ec"))
                )
                .accessibilityIdentifier("jesseRailTranscript")
            }

            Text("or continue in chat")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(jrHex: "143a2e").opacity(0.4))
                .frame(maxWidth: .infinity)

            if let status = jesseCall.status {
                Text(status)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(jrHex: "b0473f"))
            }

            Spacer(minLength: 0)
        }
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.08), radius: 14, y: 6)
        )
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "jesse-rail").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("jesseRail")
                .allowsHitTesting(false)
        }
    }

    /// `begin()` only starts the call session - it never starts speech
    /// capture on its own (confirmed reading JesseCallSession.swift
    /// directly). The original full-screen call sheet required an
    /// explicit separate mic tap for this; auto-starting it here is the
    /// actual fix for "why isn't it transcribing what I say" - talking
    /// should just work the moment the call connects, not require knowing
    /// about a second control first.
    private func jumpOnCall() {
        jesseCall.begin(context: context)
        jesseCall.startListening()
    }

    private func endCall() {
        _ = jesseCall.end()
    }

    private func transcriptLine(_ who: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(who.uppercased())
                .font(.system(size: 9, weight: .heavy, design: .rounded))
                .tracking(0.6)
                .foregroundColor(Color(jrHex: "143a2e").opacity(0.4))
            Text(text)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(jrHex: "143a2e"))
        }
    }
}

private extension Color {
    init(jrHex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(red: r, green: g, blue: b)
    }
}
