import Foundation

/// The student's chosen Jesse voice (2026-08-20, explicit ask: "so people
/// can pick one voice after log in and it's seamless from here"). Closes a
/// real gap: three graded Kokoro voices (`KokoroVoice`) were already built
/// and server-validated, but every call site hardcoded the `.heart`
/// default, so `.bella` and `.michael` were unreachable in the shipped app.
/// This is a UI/wiring fix, not a new voice - see JESSE_VOICE_TTS_SPEC.md
/// at the repo root for the separate, bigger, not-yet-approved question of
/// replacing self-hosted Kokoro with a commercial TTS vendor to fix the
/// cold-start voice-quality flip. That's Blake's call given it's ongoing
/// spend; this file only concerns which of the three existing voices plays.
///
/// UserDefaults-backed, same lightweight local-pref pattern as
/// `StudentLanguagePreference` - a voice choice is a device/session
/// preference, not account data that needs to sync server-side.
enum StudentVoicePreference {
    private static let key = "studentJesseVoice"
    private static let chosenKey = "studentJesseVoiceChosen"

    /// True once the student has gone through `VoiceChoiceView` at least
    /// once - gates whether AuthGate shows that picker again on a later
    /// launch. Only relevant when the student's chosen language uses Kokoro
    /// at all (see `StudentLanguage.usesKokoro`); a Spanish-language
    /// student never sees this picker, since Kokoro has no Spanish voice
    /// for any of these three to matter.
    static var hasChosen: Bool {
        UserDefaults.standard.bool(forKey: chosenKey)
    }

    static var current: KokoroVoice {
        get {
            guard let raw = UserDefaults.standard.string(forKey: key),
                  let voice = KokoroVoice(rawValue: raw)
            else { return .heart }
            return voice
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: key)
            UserDefaults.standard.set(true, forKey: chosenKey)
        }
    }
}
