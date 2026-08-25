import SwiftUI
import UIKit

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
    /// Optional controls shown to the right of "Just now"/"On the line" in
    /// the header row - the Work dashboard's Memo/Transcribe/Email/Calendar
    /// icons (2026-08-18, explicit ask: "the icons should be on the right
    /// of Just now not above"). Type-erased and defaulted nil so every
    /// other screen carrying this shared card (Resume/Book/Learn/
    /// Presentation/Design Studio) compiles unchanged.
    var headerTrailing: AnyView? = nil
    /// Tighter spacing/padding, and drops the least essential line ("or
    /// continue in chat") - the Work dashboard's Intel slot shrank to a
    /// compact stacked-column box (2026-08-18) too small for this card's
    /// normal spacing without truncating the call button/transcript.
    /// Every other screen carrying this card keeps the roomier default.
    var compact: Bool = false

    @EnvironmentObject private var jesseCall: JesseCallSession
    @State private var instructionLog: [String] = []

    /// The MindCraft raccoon mark, real asset (`Resources/stickers/
    /// raccoon-mascot.png`, same loading pattern `StickerCatalog` already
    /// uses) - not the placeholder smiley. Cached once per process, same
    /// reasoning as `StickerCatalog.imageCache`. Not `private` - reused
    /// directly by `DeskGridDashboardView`'s search-field icon swap
    /// (2026-08-18) rather than a second copy of the same loading logic.
    static let raccoonImage: Image = {
        if let url = Bundle.main.url(forResource: "raccoon-mascot", withExtension: "png", subdirectory: "stickers"),
           let data = try? Data(contentsOf: url),
           let uiImage = UIImage(data: data) {
            return Image(uiImage: uiImage)
        }
        return Image(systemName: "face.smiling")
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 14) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.black)
                    Self.raccoonImage
                        .resizable()
                        .scaledToFit()
                        .frame(width: compact ? 20 : 30, height: compact ? 20 : 30)
                }
                .frame(width: compact ? 36 : 52, height: compact ? 36 : 52)
                VStack(alignment: .leading, spacing: 4) {
                    JesseMiniWaveform(active: jesseCall.isSpeaking || jesseCall.isListening)
                    Text(jesseCall.isActive ? "On the line" : "Just now")
                        .font(.mcChrome(size: 11, weight: .semibold))
                        .foregroundColor(Color(jrHex: "143a2e").opacity(0.45))
                }
                Spacer(minLength: 0)
                if let headerTrailing {
                    headerTrailing
                }
            }

            // The static "Hi {name}, Jesse here." greeting box was removed
            // (2026-08-21, explicit ask: "move the call button up... remove
            // [the greeting] so we have more space") - it was redundant with
            // the avatar + waveform + "On the line"/"Just now" status right
            // above, which already says Jesse is present. The call button
            // now sits directly under the header instead of a full box-height
            // below it.
            HStack(spacing: 10) {
                Button(action: jesseCall.isActive ? endCall : jumpOnCall) {
                    HStack {
                        Image(systemName: jesseCall.isActive ? "phone.down.fill" : "phone.fill")
                        Text(jesseCall.isActive ? "End call" : "Jump on a call with Jesse")
                        Spacer(minLength: 0)
                        if !jesseCall.isActive, !compact { Image(systemName: "arrow.right") }
                    }
                    .font(.mcChrome(size: compact ? 12 : 14, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, compact ? 12 : 16)
                    .padding(.vertical, compact ? 9 : 14)
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
                            .font(.system(size: compact ? 13 : 16, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: compact ? 36 : 48, height: compact ? 36 : 48)
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
                ScrollViewReader { scrollProxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            // Most-recent-turn highlight (2026-08-21, explicit
                            // ask: "shows the most recent text highlighted") -
                            // only when nothing newer (a live in-progress
                            // transcript line) is about to render below it.
                            let mostRecentId = (jesseCall.isListening && !jesseCall.liveTranscript.isEmpty)
                                ? nil : jesseCall.turns.last?.id
                            ForEach(jesseCall.turns) { turn in
                                transcriptLine(turn.speaker == "jesse" ? "Jesse" : studentName, turn.text)
                                    .id(turn.id)
                                    .padding(.horizontal, turn.id == mostRecentId ? 8 : 0)
                                    .padding(.vertical, turn.id == mostRecentId ? 5 : 0)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .fill(turn.id == mostRecentId ? Color(jrHex: "c4f547").opacity(0.35) : Color.clear)
                                    )
                            }
                            if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty {
                                transcriptLine(studentName, jesseCall.liveTranscript)
                                    .opacity(0.55)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 5)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .fill(Color(jrHex: "c4f547").opacity(0.35))
                                    )
                                    .id("liveTranscript")
                            }
                            ForEach(Array(instructionLog.enumerated()), id: \.offset) { offset, line in
                                transcriptLine("Dock", line)
                                    .id("instruction-\(offset)")
                            }
                            if jesseCall.isThinking {
                                Text("Jesse is working")
                                    .font(.mcChrome(size: 12, weight: .semibold))
                                    .foregroundColor(Color(jrHex: "247a4d"))
                                    .id("thinking")
                            }
                        }
                    }
                    // Keeps the most recent line in view as the conversation
                    // grows, instead of staying pinned at the top (2026-08-18,
                    // explicit ask - this box got taller once Binder/Intel
                    // merged, so there's more to scroll through now).
                    .onChange(of: jesseCall.turns.count) { _, _ in scrollToBottom(scrollProxy) }
                    .onChange(of: jesseCall.liveTranscript) { _, _ in scrollToBottom(scrollProxy) }
                    .onChange(of: instructionLog.count) { _, _ in scrollToBottom(scrollProxy) }
                    .onChange(of: jesseCall.isThinking) { _, _ in scrollToBottom(scrollProxy) }
                }
                // Taller now that the removed greeting box freed real
                // vertical space (2026-08-21, explicit ask: "use most of the
                // margins and reduce the padding").
                .frame(maxHeight: compact ? 110 : 280)
                .padding(compact ? 5 : 8)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(jrHex: "f3f1ec"))
                )
                .accessibilityIdentifier("jesseRailTranscript")
            }

            if !compact {
                Text("or continue in chat")
                    .font(.mcChrome(size: 12, weight: .medium))
                    .foregroundColor(Color(jrHex: "143a2e").opacity(0.4))
                    .frame(maxWidth: .infinity)
            }

            if let status = jesseCall.status {
                Text(status)
                    .font(.mcChrome(size: 11, weight: .medium))
                    .foregroundColor(Color(jrHex: "b0473f"))
            }

            Spacer(minLength: 0)
        }
        .padding(compact ? 8 : 14)
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
        jesseCall.begin(context: context, studentName: studentName)
        jesseCall.startListening()
    }

    private func endCall() {
        _ = jesseCall.end()
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        let target: String? = {
            if jesseCall.isThinking { return "thinking" }
            if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty { return "liveTranscript" }
            if !instructionLog.isEmpty { return "instruction-\(instructionLog.count - 1)" }
            return jesseCall.turns.last?.id
        }()
        guard let target else { return }
        withAnimation(.easeOut(duration: 0.2)) {
            proxy.scrollTo(target, anchor: .bottom)
        }
    }

    private func transcriptLine(_ who: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(who.uppercased())
                .font(.mcChrome(size: 9, weight: .heavy))
                .tracking(0.6)
                .foregroundColor(Color(jrHex: "143a2e").opacity(0.4))
            Text(text)
                .font(.mcChrome(size: 13, weight: .medium))
                .foregroundColor(Color(jrHex: "143a2e"))
        }
    }
}

/// Moved here from CreateCanvasView.swift when that file was deleted
/// (2026-08-25, "we dont need create anywhere") - a real, shared
/// dependency (also used by LearnStudioView), not per-file boilerplate
/// like this file's own dotted-grid siblings elsewhere in the app, so it
/// needed a real home rather than just disappearing with the rest of that
/// file. `jrHex` below already carries the same color this used as
/// `createHex` there.
struct JesseMiniWaveform: View {
    var active: Bool

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<7, id: \.self) { i in
                Capsule()
                    .fill(Color(jrHex: "247a4d").opacity(active ? 0.95 : 0.35))
                    .frame(width: 3, height: active ? CGFloat([8, 14, 20, 12, 18, 10, 7][i]) : 7)
            }
        }
        // Real bug (reported: bars kept pulsing after ending a call/
        // transcribe): a `.repeatForever` animation bound only via
        // `value:` doesn't reliably cancel when that value flips back to
        // false - a known SwiftUI quirk. Fix: only repeat WHILE active;
        // the return-to-rest transition uses a normal, non-repeating
        // animation instead of trying to interrupt a live infinite loop.
        .animation(active ? .easeInOut(duration: 0.28).repeatForever(autoreverses: true) : .easeInOut(duration: 0.2), value: active)
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
