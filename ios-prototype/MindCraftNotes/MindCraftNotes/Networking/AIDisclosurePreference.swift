import Foundation

/// Tracks whether a student has seen and agreed to `AIDisclosureConsentView`
/// - App Store Review Guideline 5.1.2(i) (current as of Nov 13, 2025) requires
/// explicit in-app disclosure and consent before sending personal data to a
/// third-party AI, not just a Privacy Policy link. This app routes real
/// content (Jesse voice transcripts, homework problems, resume/career
/// content, Gmail digest text) to Anthropic/Groq via the webhook - see
/// `privacy.html`'s "AI processing, disclosed plainly" section for the
/// full, matching disclosure text shown to students in-app.
///
/// Same once-per-install gate shape as `StudentLanguagePreference`/
/// `StudentVoicePreference` - `hasConsented` gates `AuthGate`'s call site.
enum AIDisclosurePreference {
    private static let key = "studentAIDisclosureConsented"

    static var hasConsented: Bool {
        get { UserDefaults.standard.bool(forKey: key) }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }
}
