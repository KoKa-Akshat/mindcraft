import SwiftUI

/// One-time AI-processing disclosure + consent gate, shown once right after
/// login, before anything else (including language/voice choice) - App
/// Store Review Guideline 5.1.2(i) (current as of Nov 13, 2025) requires
/// explicit in-app disclosure and an explicit affirmative action before a
/// student's content is sent to a third-party AI provider; a Privacy Policy
/// link alone is no longer sufficient. Mirrors LanguageChoiceView/
/// VoiceChoiceView's exact shape (same palette, same once-per-install gate
/// pattern, same call-site position in AuthGate) - this is simply the
/// earliest gate now, since consent should happen before any AI feature
/// (Jesse, homework help, resume drafting) could possibly run.
struct AIDisclosureConsentView: View {
    var onAgreed: () -> Void

    var body: some View {
        ZStack {
            Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer(minLength: 0)

                VStack(spacing: 8) {
                    Text("BEFORE WE START")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .tracking(1.5)
                        .foregroundColor(.white.opacity(0.55))
                    Text("How Jesse actually works")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 24)

                VStack(alignment: .leading, spacing: 16) {
                    disclosureLine(
                        icon: "waveform",
                        text: "When you talk to Jesse, ask for homework help, or generate written content like a resume, what you type or say is sent to an AI provider (Anthropic or Groq) to write the response."
                    )
                    disclosureLine(
                        icon: "checkmark.shield",
                        text: "Those providers don't use your content to train their own models under our agreement with them, and we never sell your data."
                    )
                    disclosureLine(
                        icon: "mic.slash",
                        text: "Voice conversations are transcribed to text for processing. We don't keep the raw audio afterward."
                    )
                }
                .padding(20)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.white.opacity(0.06)))
                .padding(.horizontal, 24)

                Link("Read the full privacy policy", destination: URL(string: "https://joinmindcraft.com/privacy.html")!)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255))
                    .accessibilityIdentifier("aiDisclosurePrivacyLink")

                Button {
                    AIDisclosurePreference.hasConsented = true
                    onAgreed()
                } label: {
                    Text("I understand, continue")
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 32)
                .padding(.top, 4)
                .accessibilityIdentifier("aiDisclosureAgree")

                Spacer(minLength: 0)
                Spacer(minLength: 0)
            }
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "ai-disclosure").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("aiDisclosureRoot")
                .allowsHitTesting(false)
        }
    }

    private func disclosureLine(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255))
                .frame(width: 20)
                .padding(.top, 1)
            Text(text)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
