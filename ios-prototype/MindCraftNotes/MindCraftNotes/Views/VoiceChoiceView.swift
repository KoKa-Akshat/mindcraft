import SwiftUI
import AVFoundation

/// One-time Jesse voice picker, shown right after language choice, before
/// the dashboard (2026-08-20, explicit ask: "so people can pick one voice
/// after log in and it's seamless from here"). Mirrors LanguageChoiceView's
/// shape exactly - same once-per-install gate, same call-site pattern in
/// AuthGate - but adds a real audio preview per option, since a voice
/// choice is meaningless without hearing it first. StudentVoicePreference
/// gates AuthGate's own call site, not this view.
struct VoiceChoiceView: View {
    var onChosen: () -> Void

    @State private var selected: KokoroVoice = .heart
    @State private var previewingVoice: KokoroVoice?
    @State private var player: AVAudioPlayer?
    @State private var playerDelegate: PreviewPlayerDelegate?
    @State private var previewFailed = false

    var body: some View {
        ZStack {
            Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer(minLength: 0)

                VStack(spacing: 8) {
                    Text("ONE MORE THING")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .tracking(1.5)
                        .foregroundColor(.white.opacity(0.55))
                    Text("Pick Jesse's voice")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("Tap to hear a sample. You can tell us anytime it changes.")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.65))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                VStack(spacing: 12) {
                    ForEach(KokoroVoice.allCases) { voice in
                        voiceRow(voice)
                    }
                }
                .padding(.horizontal, 32)

                if previewFailed {
                    Text("Couldn't load a preview just now. You can still pick a voice, we'll use it once the connection's better.")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.5))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }

                Button {
                    StudentVoicePreference.current = selected
                    onChosen()
                } label: {
                    Text("Continue")
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 32)
                .accessibilityIdentifier("voiceChoiceContinue")

                Spacer(minLength: 0)
                Spacer(minLength: 0)
            }
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "voice-choice").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("voiceChoiceRoot")
                .allowsHitTesting(false)
        }
    }

    private func voiceRow(_ voice: KokoroVoice) -> some View {
        let isSelected = selected == voice
        return Button {
            selected = voice
            preview(voice)
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(isSelected ? Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255) : Color.white.opacity(0.1))
                        .frame(width: 40, height: 40)
                    if previewingVoice == voice {
                        ProgressView()
                            .tint(isSelected ? Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255) : .white)
                    } else {
                        Image(systemName: "play.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(isSelected ? Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255) : .white.opacity(0.75))
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(voice.displayName)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text(voice.blurb)
                        .font(.system(size: 12.5, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.55))
                }
                Spacer(minLength: 0)
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(isSelected ? 0.08 : 0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isSelected ? Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255).opacity(0.6) : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("voiceChoice_\(voice.rawValue)")
    }

    private func preview(_ voice: KokoroVoice) {
        previewingVoice = voice
        previewFailed = false
        Task {
            let wav = await KokoroTTSClient.synthesize(text: KokoroVoice.previewLine, voice: voice)
            await MainActor.run {
                guard previewingVoice == voice else { return }
                previewingVoice = nil
                guard let wav, let newPlayer = try? AVAudioPlayer(data: wav) else {
                    previewFailed = true
                    return
                }
                let delegate = PreviewPlayerDelegate()
                newPlayer.delegate = delegate
                playerDelegate = delegate
                player = newPlayer
                try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
                try? AVAudioSession.sharedInstance().setActive(true)
                newPlayer.play()
            }
        }
    }
}

/// Keeps the AVAudioPlayer's delegate alive for the duration of playback -
/// AVAudioPlayer only holds a weak reference to its delegate.
private final class PreviewPlayerDelegate: NSObject, AVAudioPlayerDelegate {}
