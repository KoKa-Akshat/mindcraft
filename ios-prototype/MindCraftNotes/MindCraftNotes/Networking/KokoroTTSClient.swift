import Foundation

/// Native client for `POST /api/tts` - real Kokoro-generated speech (see
/// webhook/lib/handlers/tts.ts's doc comment for the full "why Kokoro, why
/// these three voices" reasoning). Only the three curated voices are ever
/// sent: `.heart` (default, warm American), `.bella` (brighter, chapter
/// read-aloud), `.michael` (calm male guide) - the server enforces this too,
/// but keeping it an enum here means a typo can't silently fall through to
/// some other Kokoro voice never actually chosen for this product.
enum KokoroVoice: String {
    case heart = "af_heart"
    case bella = "af_bella"
    case michael = "am_michael"
}

enum KokoroTTSClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/tts")!

    /// Returns WAV audio data, or nil on any failure (network, cold-start
    /// timeout, server error) so the caller can fall back to native
    /// AVSpeechSynthesizer rather than the call going silent.
    static func synthesize(text: String, voice: KokoroVoice = .heart) async -> Data? {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        // A cold container may need ~30s to download the model before it
        // can generate anything - see the handler's own doc comment. This
        // is generous on top of that for real network variance.
        request.timeoutInterval = 55
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
