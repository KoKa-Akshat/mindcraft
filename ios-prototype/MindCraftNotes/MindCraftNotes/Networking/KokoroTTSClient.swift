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
    // Moved off Vercel serverless onto an always-on Fly.io machine
    // (2026-08-20, see ../../JESSE_VOICE_TTS_SPEC.md) - same kokoro-js
    // logic, same three voices, same request/response contract
    // (webhook/fly-tts/server.js), just never cold. Real measured warm
    // latency after deploy: 3.3s round-trip for one line, confirmed via a
    // live curl test, not assumed - see the spec's "Open questions"
    // section, now answered.
    private static let endpoint = URL(string: "https://mindcraft-tts.fly.dev/")!

    /// Returns WAV audio data, or nil on any failure (network, server
    /// error) so the caller can fall back to native AVSpeechSynthesizer
    /// rather than the call going silent.
    static func synthesize(text: String, voice: KokoroVoice = .heart) async -> Data? {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        // Was 6s, deliberately tight to fail fast out of a COLD Vercel
        // container into the native fallback (see git history / the spec
        // for that era's reasoning). That tradeoff doesn't apply anymore -
        // the Fly.io host never cold-starts (min_machines_running: 1), so
        // there's no cold path to race against. 12s gives real network
        // variance (observed warm: ~3.3s) headroom without the old
        // rushed-fallback behavior, while still bailing to native well
        // before a student would call the app "frozen."
        request.timeoutInterval = 12
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
