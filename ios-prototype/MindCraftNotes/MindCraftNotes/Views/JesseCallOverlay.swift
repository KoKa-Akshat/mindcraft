import SwiftUI

/// The persistent "still on the line" pill - rendered once at
/// `DeskShellView`'s root (see that file), ABOVE `FieldDeskView`, not
/// inside it. That placement is deliberate: `FieldDeskView` is the app's
/// highest-risk file (its own doc comment explains the recurring touch-
/// blocking overlay bug class), and this pill has nothing to do with that
/// bug class since it's a small, non-blocking indicator rather than a
/// full-screen overlay - but rendering it as FieldDeskView's *sibling*
/// rather than adding yet another conditional inside that file's already
/// enormous ZStack keeps it that way. Visible on any screen the moment a
/// call is active, tap to reopen the full call sheet.
struct JesseCallPill: View {
    @ObservedObject var call: JesseCallSession
    var onTap: () -> Void

    var body: some View {
        if call.isActive {
            Button(action: onTap) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(call.isListening ? Color(jesseHex: "ff6b6b") : Color(jesseHex: "c4f547"))
                        .frame(width: 8, height: 8)
                    Text(pillLabel)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Capsule().fill(Color.black.opacity(0.82)))
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.18), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("jesseCallPill")
            .padding(.top, 10)
            .padding(.trailing, 14)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    private var pillLabel: String {
        if call.isThinking { return "Jesse is thinking…" }
        if call.isListening { return "Listening…" }
        if call.isSpeaking { return "Jesse" }
        if call.isPaused { return "Jesse · paused" }
        return "Jesse · on the line"
    }
}

/// Full call view - real transcript, real pause/end, native mic control.
/// Deliberately plain (no WKWebView, no web JS speech APIs) so the call
/// keeps running in `JesseCallSession` regardless of whether this sheet
/// itself is open; dismissing it does not end the call, only `End call`
/// does.
struct JesseCallSheetView: View {
    @ObservedObject var call: JesseCallSession
    var onClose: () -> Void
    var onEnd: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Jesse")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                Spacer()
                Button("Close", action: onClose)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(20)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(call.turns) { turn in
                            turnBubble(turn)
                        }
                        if call.isListening, !call.liveTranscript.isEmpty {
                            turnBubble(JesseCallTurn(id: "live", speaker: "student", text: call.liveTranscript, at: Date()))
                                .opacity(0.6)
                        }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(.horizontal, 20)
                }
                .onChange(of: call.turns.count) { _, _ in
                    withAnimation { proxy.scrollTo("bottom") }
                }
            }

            if let status = call.status {
                Text(status)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(jesseHex: "ff9f9f"))
                    .padding(.top, 6)
            }

            controls
                .padding(20)
        }
        .background(Color(jesseHex: "0c1512").ignoresSafeArea())
    }

    private func turnBubble(_ turn: JesseCallTurn) -> some View {
        let isJesse = turn.speaker == "jesse"
        return HStack {
            if isJesse { Spacer(minLength: 40) }
            Text(turn.text)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(.white)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(isJesse ? Color(jesseHex: "1f3d2e") : Color(jesseHex: "23262b"))
                )
            if !isJesse { Spacer(minLength: 40) }
        }
        .id(turn.id)
    }

    private var controls: some View {
        HStack(spacing: 16) {
            Button(action: { call.isPaused ? call.resume() : call.pause() }) {
                Image(systemName: call.isPaused ? "play.fill" : "pause.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 48, height: 48)
                    .background(Circle().fill(Color.white.opacity(0.12)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("jesseCallPauseResume")

            Button(action: { call.isListening ? call.stopListening() : call.startListening() }) {
                Image(systemName: call.isListening ? "mic.fill" : "mic")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(Color(jesseHex: "0c1207"))
                    .frame(width: 64, height: 64)
                    .background(Circle().fill(call.isListening ? Color(jesseHex: "ff6b6b") : Color(jesseHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .disabled(call.isPaused || call.isThinking || call.isSpeaking)
            .accessibilityIdentifier("jesseCallMic")

            Button(action: onEnd) {
                Image(systemName: "phone.down.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 48, height: 48)
                    .background(Circle().fill(Color(jesseHex: "b0473f")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("jesseCallEnd")
        }
        .frame(maxWidth: .infinity)
    }
}

private extension Color {
    init(jesseHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
