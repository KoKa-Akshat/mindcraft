import SwiftUI

/// One-time language picker shown right after login, before the dashboard
/// (2026-08-19, explicit ask: "accommodate voice in... Spanish language...
/// which they choose at the start after login"). Sets
/// StudentLanguagePreference.current, which gates the recognizer locale,
/// the native TTS voice, and whether Kokoro is even attempted (see
/// JesseCallSession.speak/recognizer). Shown exactly once per install -
/// StudentLanguagePreference.hasChosen gates AuthGate's own call site, not
/// this view - reachable again later from Settings if a student wants to
/// switch (not built in this pass; flagging so "change my language" isn't
/// assumed to already exist).
struct LanguageChoiceView: View {
    var onChosen: () -> Void

    var body: some View {
        ZStack {
            Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer(minLength: 0)

                VStack(spacing: 8) {
                    Text("WELCOME TO THE DESK")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .tracking(1.5)
                        .foregroundColor(.white.opacity(0.55))
                    Text("Choose your language")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("Jesse will listen and speak in this language during calls.")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.65))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                VStack(spacing: 12) {
                    ForEach(StudentLanguage.allCases) { language in
                        Button {
                            StudentLanguagePreference.current = language
                            onChosen()
                        } label: {
                            HStack {
                                Text(language.displayName)
                                    .font(.system(size: 17, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255))
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255).opacity(0.5))
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 16)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("languageChoice_\(language.rawValue)")
                    }
                }
                .padding(.horizontal, 32)

                Spacer(minLength: 0)
                Spacer(minLength: 0)
            }
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "language-choice").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("languageChoiceRoot")
                .allowsHitTesting(false)
        }
    }
}
