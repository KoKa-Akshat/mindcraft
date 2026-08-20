import Foundation

/// The student's chosen voice-conversation language (2026-08-19, explicit
/// ask: "accommodate voice in Nepali language and Spanish language...
/// which they choose at the start after login"). Nepali is deliberately
/// NOT a case here yet - Apple's on-device speech recognition and speech
/// synthesis have no Nepali support at all (confirmed: not in
/// SFSpeechRecognizer.supportedLocales()), so real Nepali voice needs a
/// separate third-party STT/TTS integration, a genuinely different and
/// bigger project than adding a locale Apple already supports. Don't add
/// a Nepali case here as a stub that silently produces English audio -
/// that would be worse than the honest gap this file currently has.
enum StudentLanguage: String, CaseIterable, Identifiable {
    case english = "en-US"
    case spanish = "es-ES"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .english: return "English"
        case .spanish: return "Español"
        }
    }

    /// `SFSpeechRecognizer` locale identifier - same raw value, kept as a
    /// named accessor so call sites read as "the recognizer locale," not
    /// an unexplained reuse of `rawValue`.
    var recognizerLocaleIdentifier: String { rawValue }

    /// `AVSpeechSynthesisVoice(language:)` identifier - same identifier
    /// space as the recognizer locale for both languages here, kept as its
    /// own accessor since Kokoro's own voice tags follow a different
    /// convention (see `kokoroVoiceIfSupported` below) and a future
    /// language might need these two to diverge.
    var synthesisLanguageIdentifier: String { rawValue }

    /// Kokoro TTS only ever exposes 3 real, graded, all-English voices in
    /// this app (see webhook/lib/handlers/tts.ts's own doc comment on why
    /// - af_heart/af_bella/am_michael, no Spanish voice among them).
    /// Non-English languages fall back to the native AVSpeechSynthesizer
    /// voice, which has real, good Spanish voices built into iOS - this is
    /// a real, working voice, not a degraded stand-in, just not Kokoro's.
    var usesKokoro: Bool {
        switch self {
        case .english: return true
        case .spanish: return false
        }
    }
}

/// UserDefaults-backed, same lightweight local-pref pattern this app
/// already uses elsewhere (the `deskOs.*` key family) rather than a new
/// Firestore field - a voice-language choice is a device/session
/// preference, not account data that needs to sync or be queried
/// server-side.
enum StudentLanguagePreference {
    private static let key = "studentVoiceLanguage"
    private static let chosenKey = "studentVoiceLanguageChosen"

    /// True once the student has gone through the one-time picker
    /// (`LanguageChoiceView`) at least once - gates whether AuthGate shows
    /// that picker again on a later launch.
    static var hasChosen: Bool {
        UserDefaults.standard.bool(forKey: chosenKey)
    }

    static var current: StudentLanguage {
        get {
            guard let raw = UserDefaults.standard.string(forKey: key),
                  let lang = StudentLanguage(rawValue: raw)
            else { return .english }
            return lang
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: key)
            UserDefaults.standard.set(true, forKey: chosenKey)
        }
    }
}
