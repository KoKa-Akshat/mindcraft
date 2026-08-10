import Foundation

/// Decodes the bundled `Resources/conceptStories.json` export (real story
/// text for all 42 concepts, copied verbatim from
/// `app/src/data/conceptStories.json` - see
/// `app/scripts/exportConceptStoriesForNative.mjs`).
private struct ConceptStoryWire: Decodable {
    let conceptName: String
    let story: String
    let protagonist: String?
    let settingLine: String?
}

/// The "PROTAGONIST · SETTING" byline shown above a chapter's story text -
/// real per-concept data from `questionContextFrames.json` (e.g. "Leonhard
/// Euler · St. Petersburg, 1734" for functions_basics), not invented.
struct ConceptStoryContext {
    let protagonist: String?
    let settingLine: String?
}

enum ConceptStoryLoader {
    static func story(for conceptId: String) -> String? {
        stories[conceptId]?.story
    }

    static func context(for conceptId: String) -> ConceptStoryContext? {
        guard let wire = stories[conceptId] else { return nil }
        return ConceptStoryContext(protagonist: wire.protagonist, settingLine: wire.settingLine)
    }

    private static let stories: [String: ConceptStoryWire] = {
        guard
            let url = Bundle.main.url(forResource: "conceptStories", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let wire = try? JSONDecoder().decode([String: ConceptStoryWire].self, from: data)
        else {
            return [:]
        }
        return wire
    }()
}

/// Splits a concept's story text into short advancing beats, then groups
/// beats into 2-5 pages sized toward an even per-page share of the total -
/// a direct port of `ConceptChapterPage.tsx`'s `storyBeats()`/`storyPages()`
/// (including the fix, from earlier this same session, for the bug where
/// only page 1 ever rendered). Kept byte-for-byte equivalent in behavior so
/// native and web paginate the exact same story the exact same way.
enum StoryPaginator {
    private static let targetPageChars = 550
    private static let minPages = 2
    private static let maxPages = 5

    static func beats(from text: String) -> [String] {
        let paragraphs = text
            .split(separator: "\n", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { $0.count > 15 }

        var result: [String] = []
        for paragraph in paragraphs {
            if paragraph.count <= 260 {
                result.append(paragraph)
                continue
            }
            let sentences = splitIntoSentences(paragraph)
            var buffer = ""
            for sentence in sentences {
                let s = sentence.trimmingCharacters(in: .whitespaces)
                guard !s.isEmpty else { continue }
                if !buffer.isEmpty && (buffer + " " + s).count > 240 {
                    result.append(buffer)
                    buffer = s
                } else {
                    buffer = buffer.isEmpty ? s : "\(buffer) \(s)"
                }
            }
            if !buffer.isEmpty { result.append(buffer) }
        }
        return result
    }

    static func pages(from text: String) -> [[String]] {
        let allBeats = beats(from: text)
        guard !allBeats.isEmpty else {
            return [["Your chapter opens here - the scene is already waiting."]]
        }
        let totalLen = allBeats.reduce(0) { $0 + $1.count }
        let targetPages = min(maxPages, max(minPages, Int((Double(totalLen) / Double(targetPageChars)).rounded())))
        let perPageBudget = Double(totalLen) / Double(targetPages)

        var pages: [[String]] = []
        var current: [String] = []
        var currentLen = 0
        for beat in allBeats {
            if !current.isEmpty && Double(currentLen + beat.count) > perPageBudget {
                pages.append(current)
                current = []
                currentLen = 0
            }
            current.append(beat)
            currentLen += beat.count
        }
        if !current.isEmpty { pages.append(current) }

        func pageLen(_ page: [String]) -> Int { page.reduce(0) { $0 + $1.count } }
        while pages.count > targetPages {
            var bestIdx = 0
            var bestSum = Int.max
            for i in 0..<(pages.count - 1) {
                let sum = pageLen(pages[i]) + pageLen(pages[i + 1])
                if sum < bestSum {
                    bestSum = sum
                    bestIdx = i
                }
            }
            let merged = pages[bestIdx] + pages[bestIdx + 1]
            pages.replaceSubrange(bestIdx...(bestIdx + 1), with: [merged])
        }
        return pages
    }

    /// Regex-based sentence splitter matching the web's
    /// `/[^.!?]+[.!?]+(?:\s|$)/g` pattern.
    private static func splitIntoSentences(_ text: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: "[^.!?]+[.!?]+(?:\\s|$)") else { return [text] }
        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, range: range)
        if matches.isEmpty { return [text] }
        return matches.compactMap { Range($0.range, in: text).map { String(text[$0]) } }
    }
}
