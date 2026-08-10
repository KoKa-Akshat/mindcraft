import UIKit

/// Real per-concept chapter scene art - ported from `storyArt.ts`'s
/// `storyArtFor()`: a dedicated generated image per concept when one
/// exists, else a theme-family fallback, same precedence, same theme
/// grouping regex. All 47 real images (42 concept-specific + 5 theme
/// fallbacks) are bundled as a folder reference in
/// `Resources/storyArt/` - downloaded once with the app, not fetched at
/// runtime, so a chapter's art shows instantly with no network wait.
enum StoryArtLoader {
    static func image(forConcept conceptId: String) -> UIImage? {
        if let generated = loadImage(named: "story-\(conceptId)") {
            return generated
        }
        return loadImage(named: themeFallbackName(for: conceptId))
    }

    private static func loadImage(named name: String) -> UIImage? {
        guard
            let url = Bundle.main.url(forResource: name, withExtension: "jpg", subdirectory: "storyArt"),
            let data = try? Data(contentsOf: url)
        else {
            return nil
        }
        return UIImage(data: data)
    }

    /// Direct port of `storyArt.ts`'s `themeFallback()` regex groupings.
    private static func themeFallbackName(for conceptId: String) -> String {
        if matches(conceptId, "probabil|stat|combinator|matrix|complex") { return "story-probability" }
        if matches(conceptId, "quadrat|poly|exponent|function|log|sequence|trig|conic") { return "story-quadratics" }
        if matches(conceptId, "circle|triangle|angle|area|volume|geo|line") { return "mindcraft-cover-hero" }
        return "story-fractions"
    }

    private static func matches(_ text: String, _ pattern: String) -> Bool {
        (try? NSRegularExpression(pattern: pattern).firstMatch(in: text, range: NSRange(text.startIndex..., in: text))) != nil
    }
}
