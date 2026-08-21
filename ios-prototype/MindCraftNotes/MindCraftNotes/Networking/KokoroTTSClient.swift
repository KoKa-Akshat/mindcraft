import Foundation

/// Native client for `POST /api/tts` - real Kokoro-generated speech (see
/// webhook/lib/handlers/tts.ts's doc comment for the full "why Kokoro, why
/// these three voices" reasoning). Only the three curated voices are ever
/// sent: `.heart` (default, warm American), `.bella` (brighter, chapter
/// read-aloud), `.michael` (calm male guide) - the server enforces this too,
/// but keeping it an enum here means a typo can't silently fall through to
/// some other Kokoro voice never actually chosen for this product.
enum KokoroVoice: String, CaseIterable, Identifiable {
    case heart = "af_heart"
    case bella = "af_bella"
    case michael = "am_michael"

    var id: String { rawValue }

    /// Student-facing name for `VoiceChoiceView` - the raw Kokoro tags
    /// (`af_heart`, `am_michael`) are an internal grading/gender-code
    /// convention, not something to show a student picking a voice.
    var displayName: String {
        switch self {
        case .heart: return "Warm"
        case .bella: return "Bright"
        case .michael: return "Calm"
        }
    }

    var blurb: String {
        switch self {
        case .heart: return "Steady and warm. The default."
        case .bella: return "A bit brighter, more energy."
        case .michael: return "A calm, even-paced male guide."
        }
    }

    /// Fixed line every voice previews with in `VoiceChoiceView`, so the
    /// only variable a student is judging is the voice itself.
    static let previewLine = "Hi, I'm Jesse. I'll sound like this when we talk."
}

enum KokoroTTSClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/tts")!

    /// Returns WAV audio data, or nil on any failure (network, cold-start
    /// timeout, server error) so the caller can fall back to native
    /// AVSpeechSynthesizer rather than the call going silent.
    static func synthesize(text: String, voice: KokoroVoice = .heart) async -> Data? {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        // Was 55s (generous headroom for a ~96MB cold-start model
        // download, see the handler's own doc comment) - but that meant a
        // cold container made EVERY reply in a live conversation sit
        // silent for up to 55s before falling back to the native voice
        // already built as the fallback path below. Real, live complaint
        // (2026-08-19): "it takes forever to load and then say what it
        // wants to say." A warm container generates in low single-digit
        // seconds; failing fast into the native fallback beats waiting
        // through a cold download mid-conversation - speed over Kokoro's
        // nicer voice when the two trade off. A keep-warm cron ping was
        // considered but not added - Vercel's Hobby plan only supports
        // daily-granularity crons, nowhere near frequent enough to keep a
        // function warm, so this timeout fix is the real, working
        // solution, not a stopgap for a companion fix that doesn't exist.
        request.timeoutInterval = 6
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "text": text,
            "voice": voice.rawValue,
        ])

        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            !data.isEmpty
        else { return nil }

        return data
    }
}
