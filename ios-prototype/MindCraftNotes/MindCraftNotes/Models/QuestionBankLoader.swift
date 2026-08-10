import Foundation

/// Decodes one real question from the bundled `Resources/questionBank.json`
/// export (see `app/scripts/exportQuestionBankForNative.mjs`, which runs the
/// REAL `getQuestions()` from `app/src/lib/questionBank.ts` - this is not a
/// hand-copied or invented question set, it's the actual bank). Only the
/// fields this prototype's `QuestionView` actually renders are modeled;
/// the exported JSON carries more (explanation, hints, format, etc.) that
/// isn't consumed yet.
private struct BankQuestionWire: Decodable {
    let id: String
    let conceptId: String
    let level: Int
    let question: String
    let choices: [String]
    let correctIndex: Int
}

/// Loads + decodes the bundled `questionBank.json` once, then serves real
/// questions by concept id - the data source `WorkPracticeView` (and,
/// eventually, the Weekly Review flow) pulls from instead of the 5
/// hardcoded fractions_decimals-only `SampleQuestion.all`.
enum QuestionBankLoader {
    static let all: [SampleQuestion] = loadAll()

    /// Real questions for one concept, any level, in the order the bundled
    /// export wrote them (already deduped by id at export time).
    static func questions(forConcept conceptId: String) -> [SampleQuestion] {
        all.filter { $0.conceptId == conceptId }
    }

    /// Real, level-gated + batch-capped session for one or more concepts -
    /// what `PracticeSessionView` actually plays, replacing the old
    /// `questions(forConcept:)` call (which returned EVERY level for a
    /// concept unfiltered, e.g. "Question 1 of 180" for `fractions_decimals`
    /// - a real functional bug Akshat flagged live on-device: "make sure the
    /// algorithm is working," not just the paint). Web's real practice
    /// sessions are always level/mission-scoped (`getQuestions(conceptId,
    /// level, count, ...)`, CLAUDE.md's `questionBank.ts` contract, and the
    /// gap-scan level gating in `lib/bridgePractice.ts`: `easy` → L3 only,
    /// `kinda` → L2, `hard` → L1) - never "hand the student the entire bank
    /// at once." Native doesn't have per-student gap-scan confidence wired
    /// into this call site yet, so `preferredLevel` is a reasonable stand-in
    /// derived from the SAME real mastery/status data the Contents roadmap
    /// already reads (`tocDotState`, see `recommendedLevel(for:)` below) -
    /// struggling/untouched concepts start at L1, in-progress at L2, mastered
    /// concepts get L3 as a real review/challenge rep - rather than a fixed
    /// constant.
    ///
    /// Falls back to the next level down, then to every level, rather than
    /// ever returning an empty session (a concept with only L2/L3 authored
    /// content must still be playable from a "start at L1" recommendation).
    /// Capped to `limit` questions - a real practice "mission" length, not
    /// an unbounded scroll through the whole bank.
    static func session(forConcepts conceptIds: [String], preferredLevel: Int, limit: Int = 12) -> [SampleQuestion] {
        let pool = conceptIds.flatMap { questions(forConcept: $0) }
        guard !pool.isEmpty else { return [] }
        for level in [preferredLevel, preferredLevel - 1, preferredLevel + 1] where (1...3).contains(level) {
            let atLevel = pool.filter { $0.level == level }
            if !atLevel.isEmpty { return Array(atLevel.prefix(limit)) }
        }
        return Array(pool.prefix(limit))
    }

    /// Real port of the gap-scan level-gating RULE (`easy` → L3, `kinda` →
    /// L2, `hard` → L1 - `lib/bridgePractice.ts`, CLAUDE.md's "Level gating
    /// after scan"), adapted to the data native actually has at this call
    /// site: live concept `status` (`tocDotState`, the SAME classification
    /// the Contents roadmap tiles already render), not a gap-scan confidence
    /// rating. Struggling/never-touched → start at L1 (the "hard"/fresh-start
    /// case); in-progress → L2; mastered → L3 as a review rep. Honest about
    /// being an adaptation, not a verbatim port, since the confidence-rating
    /// input this rule was designed for doesn't exist on this screen.
    static func recommendedLevel(forStatus status: String?) -> Int {
        switch tocDotState(status ?? "untouched") {
        case .complete: return 3
        case .progress: return 2
        case .needs, .locked: return 1
        }
    }

    private static let byId: [String: SampleQuestion] = Dictionary(all.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

    /// Resolves a bookmarked question id (`users/{uid}.bookmarkedQuestions`,
    /// same field `dashboardPersonalization.ts` reads) to its real question,
    /// for the Notes tab's bookmarked-equations section.
    static func question(byId id: String) -> SampleQuestion? {
        byId[id]
    }

    private static func loadAll() -> [SampleQuestion] {
        guard
            let url = Bundle.main.url(forResource: "questionBank", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let wire = try? JSONDecoder().decode([BankQuestionWire].self, from: data)
        else {
            return []
        }
        return wire.map { w in
            SampleQuestion(
                id: w.id,
                conceptId: w.conceptId,
                rawQuestion: w.question,
                rawChoices: w.choices,
                correctIndex: w.correctIndex,
                level: w.level
            )
        }
    }
}
