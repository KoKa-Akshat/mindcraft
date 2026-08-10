import Foundation

/// The single narrative frame a question is shown inside, matching the real
/// web product's "concept-lock" pattern: one story per concept, reused
/// across every question in that concept rather than a fresh unrelated
/// scene each time (see WORLD_VISION.md in the main site repo, and
/// app/src/data/conceptStories.json / questionContextFrames.json, both read
/// only, not modified). This prototype only has one concept, so only one
/// story exists here, but the shape is built so a second concept would just
/// add a second `ConceptStory`, not restructure this type.
struct ConceptStory {
    let protagonist: String
    let settingLine: String
    /// The short, per-question bridge line shown with every question in
    /// this concept, taken verbatim from questionContextFrames.json's
    /// `questionBridge` field for fractions_decimals.
    let bridgeLine: String
    /// A short excerpt from the concept's full story
    /// (conceptStories.json's `story` field for fractions_decimals, first
    /// paragraph, verbatim), used as a text-based stand-in for a story
    /// illustration in the swappable graph/story box. This prototype has
    /// no art asset pipeline, so a short passage of the real narrative text
    /// stands in for what would otherwise be a hand-drawn scene.
    let excerpt: String
}

extension ConceptStory {
    static let fractionsDecimals = ConceptStory(
        protagonist: "Simon Stevin",
        settingLine: "Antwerp, the Low Countries, 1585",
        bridgeLine: "Simon slides the ledger toward you. Break the whole into parts. Every tenth counts.",
        excerpt: """
        In 1585, in the war-torn Low Countries, a bookkeeper named Simon Stevin watched \
        grown men suffer over arithmetic. Army paymasters divided wages among soldiers by \
        candlelight, wrestling twelfths of guilders and seventh-parts of florins until the \
        numbers swam. Merchants argued over interest calculations that took days and were \
        still disputed. Stevin, who kept accounts for a prince and dug canals for cities, \
        saw the same monster everywhere he went: the space between whole numbers, wild and \
        unnamed.
        """
    )
}

/// A single practice question shown next to the writable canvas.
///
/// Content is borrowed read only from the real MindCraft Eedi-sourced
/// question bank (app/src/data/eediQuestions.json, not modified), filtered
/// to `conceptId == "fractions_decimals"`. `rawQuestion`/`rawChoices` are
/// copied exactly as they appear there, LaTeX delimiters and all, so
/// nothing about the math itself is rewritten by hand; `prompt`/`choices`
/// below are a rendering step on top of that raw text (see
/// LaTeXDisplayText), not a different set of values.
struct SampleQuestion: Identifiable, Hashable {
    let id: String
    let conceptId: String
    let rawQuestion: String
    let rawChoices: [String]
    let correctIndex: Int
    /// Difficulty tier (1-3), same scale `questionBank.ts`'s `getQuestions`
    /// uses. Defaults to 1 for the hand-authored `SampleQuestion.all` fixture
    /// (which predates this field); `QuestionBankLoader` passes the real
    /// per-question level from the bundled export. Carried through to
    /// `OutcomeClient.recordOutcome` so `/record-outcomes` gets a real level,
    /// not a hardcoded guess.
    var level: Int = 1

    static func == (lhs: SampleQuestion, rhs: SampleQuestion) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// Only `fractions_decimals` has a real, hand-authored `ConceptStory` in
    /// this prototype (see `ConceptStory`'s doc comment) - every other
    /// concept, now that `QuestionBankLoader` pulls real questions across
    /// all 27 ACT-tested concepts, honestly has none yet rather than
    /// wrongly reusing Simon Stevin's fractions narrative for, say, a
    /// geometry question. `QuestionView` shows a plain (storyless) header
    /// when this is nil.
    var story: ConceptStory? {
        conceptId == "fractions_decimals" ? .fractionsDecimals : nil
    }

    /// Plain, readable text derived from `rawQuestion`, since this
    /// prototype has no LaTeX renderer yet. See LaTeXDisplayText's doc
    /// comment for exactly what this step does and does not change.
    var prompt: String { LaTeXDisplayText.plainText(from: rawQuestion) }
    var choices: [String] { rawChoices.map(LaTeXDisplayText.plainText(from:)) }

    /// Human readable concept label for the header chip.
    var conceptLabel: String {
        conceptId
            .split(separator: "_")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}

extension SampleQuestion {
    /// Five real fractions_decimals questions from the bank, picked because
    /// each reads cleanly as plain text with no diagram (no
    /// "(Diagram: ...)" alt text baked into the string) and no deeply
    /// nested LaTeX, while together covering a spread of what this concept
    /// actually asks: simplifying a fraction, decimal division, a three-way
    /// fraction/decimal/percent conversion, adding mixed numbers, and a
    /// two-student reasoning check across percent/fraction/decimal forms.
    static let all: [SampleQuestion] = [
        // eedi_37: fraction simplification. Pure symbols, no diagram.
        SampleQuestion(
            id: "eedi_37",
            conceptId: "fractions_decimals",
            rawQuestion: "Write this fraction as simply as possible:\n\\(\\frac{9}{12}\\)",
            rawChoices: ["\\(\\frac{3}{6}\\)", "\\(\\frac{2}{6}\\)", "\\(\\frac{3}{4}\\)", "\\(\\frac{9}{12}\\)"],
            correctIndex: 2
        ),
        // eedi_7: decimal division by 10. Pure arithmetic, no diagram.
        SampleQuestion(
            id: "eedi_7",
            conceptId: "fractions_decimals",
            rawQuestion: "\\(43.2 \\div 10=\\)",
            rawChoices: ["4.32", "0.432", "33.2", "43.02"],
            correctIndex: 0
        ),
        // eedi_211: chains decimal, fraction, and percent for the same
        // value, the throughline of the whole concept. No diagram.
        SampleQuestion(
            id: "eedi_211",
            conceptId: "fractions_decimals",
            rawQuestion: "\\(0.6=\\frac{3}{5}=? \\%\\)",
            rawChoices: ["\\(50 \\%\\)", "\\(35 \\%\\)", "\\(60 \\%\\)", "\\(6 \\%\\)"],
            correctIndex: 2
        ),
        // eedi_202: adding two mixed numbers, answer left as a mixed
        // number. Pure symbols, no diagram.
        SampleQuestion(
            id: "eedi_202",
            conceptId: "fractions_decimals",
            rawQuestion: "\\(2 \\frac{1}{5}+1 \\frac{2}{5}=\\) Leave your answer as a mixed number",
            rawChoices: ["\\(3 \\frac{3}{5}\\)", "\\(\\frac{18}{5}\\)", "\\(\\frac{18}{10}\\)", "\\(3 \\frac{3}{10}\\)"],
            correctIndex: 0
        ),
        // eedi_337: a two-student reasoning check spanning percent,
        // decimal, and fraction in one question. Plain text word problem,
        // no diagram, and a good stretch question after the four
        // calculation-only ones above.
        SampleQuestion(
            id: "eedi_337",
            conceptId: "fractions_decimals",
            rawQuestion: "Jo and Paul are arguing about percentages.\nJo says \\(52 \\%=0.052\\)\nPaul says \\(52 \\%<\\frac{20}{41}\\)\nWho is correct?",
            rawChoices: ["Only Jo", "Only Paul", "Both Jo and Paul", "Neither is correct"],
            correctIndex: 3
        ),
    ]
}
