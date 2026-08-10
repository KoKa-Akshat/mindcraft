import Foundation

/// Decodes the bundled `Resources/conceptContent.json` export - real
/// per-concept `keyRules`/`tips`/`watchOut`/optional `formula`/`examples`,
/// copied verbatim from `app/src/lib/conceptContent.ts`'s
/// `CONCEPT_CONTENT: Record<string, ConceptContent>` (36 concepts, 989 lines
/// on web) via `vite-node` running a one-shot export script against the real
/// TS module (not hand-transcribed - see NATIVE_APP_BUILD_PLAN.md's round 8
/// write-up for the exact export command), so every field is byte-for-byte
/// the same copy web's own Weekly Review walkthrough reads.
struct ConceptContent: Decodable {
    let id: String
    let label: String
    let emoji: String
    let tagline: String
    let keyRules: [String]
    let tips: [String]
    let watchOut: [String]
    let formula: String?
    let examples: [ConceptExample]
    let examWeight: String?
}

struct ConceptExample: Decodable {
    let problem: String
    let solution: String
}

enum ConceptContentLoader {
    /// `nil` for any concept without curated content yet (real - only 36 of
    /// 42 concepts have a hand-written `ConceptContent` entry on web; the
    /// formula-card step gracefully skips its body for these, same as
    /// `Practice.tsx`'s own `content ? (...) : weeklyWalkSlots ? (...) :
    /// null` fallback).
    static func content(for conceptId: String) -> ConceptContent? {
        all[conceptId]
    }

    private static let all: [String: ConceptContent] = {
        guard
            let url = Bundle.main.url(forResource: "conceptContent", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let decoded = try? JSONDecoder().decode([String: ConceptContent].self, from: data)
        else {
            return [:]
        }
        return decoded
    }()
}
