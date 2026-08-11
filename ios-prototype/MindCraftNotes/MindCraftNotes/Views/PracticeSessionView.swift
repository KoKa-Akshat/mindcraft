import SwiftUI

/// A real, concept-targeted practice session - formula card, then
/// `QuestionView` (Round 12: modular ACT field - question / diagram / graph
/// / writing boxes per the raccoon design brief). PencilKit + MyScript live
/// in the writing module. Not the Dashboard "Work" tab (`WorkPracticeView`).
struct PracticeSessionView: View {
    let targetConceptIds: [String]
    /// Real mastery/status for the target concept(s), threaded from
    /// `DashboardView`'s already-live `KnowledgeGraphClient.progress` (the
    /// SAME data the Contents roadmap tiles render) - drives
    /// `QuestionBankLoader.recommendedLevel(forStatus:)` so this session
    /// isn't hardcoded to one level. `nil` (e.g. the unauthenticated test
    /// harness, or a concept never rated) falls through to L1, matching the
    /// real gap-scan rule's "hard"/fresh-start default.
    var conceptStatus: String? = nil
    /// When true, lives inside the Field Desk ACT stage - no NavigationStack
    /// raccoon / "ACT Field Book" / Close chrome; Home closes the overlay.
    var embeddedInDesk: Bool = false
    var onClose: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = DrawingStore()
    @State private var selectedIndex = 0
    /// Round 8, item 3: show the real per-concept formula/rules card
    /// (`FormulaCardView`, a lightweight port of `Practice.tsx`'s
    /// `pPhase === 'explore'` screen) before the first question, same as
    /// web's Weekly Review walkthrough already does ahead of a topic's
    /// question batch. Only gated for the real target-concept flow - the
    /// `targetConceptIds.isEmpty` fallback below (`SampleQuestion.all`) has
    /// no single concept to build a card around, so it skips straight to
    /// questions same as before.
    @State private var showFormulaCard = true
    /// Last question index per concept set - survives Binder minimize.
    @AppStorage("actPractice.resumeConceptKey") private var resumeConceptKey = ""
    @AppStorage("actPractice.resumeIndex") private var resumeIndex = 0
    @AppStorage("actPractice.resumePastFormula") private var resumePastFormula = false

    private var conceptKey: String {
        targetConceptIds.joined(separator: "|")
    }

    /// Real fix (Akshat's live-device report: "make sure the algorithm is
    /// working," surfaced concretely as "Question 1 of 180" - every level of
    /// a concept's ENTIRE bank dumped into one unbounded session, the old
    /// `QuestionBankLoader.questions(forConcept:)` call this replaced). Now
    /// level-gated + batch-capped, matching how a real practice mission on
    /// web actually works (CLAUDE.md: `getQuestions(conceptId, level,
    /// count, ...)`) instead of "everything, in bank order."
    private var questions: [SampleQuestion] {
        guard !targetConceptIds.isEmpty else { return SampleQuestion.all }
        let level = QuestionBankLoader.recommendedLevel(forStatus: conceptStatus)
        let session = QuestionBankLoader.session(forConcepts: targetConceptIds, preferredLevel: level)
        return session.isEmpty ? SampleQuestion.all : session
    }

    /// Real label for the formula card's header - read off the first actual
    /// bank question's own `conceptLabel` (already resolved by
    /// `QuestionBankLoader`) rather than re-deriving one from the raw
    /// concept id, so it matches exactly what the question banner itself
    /// will show one screen later.
    private var formulaConceptLabel: String {
        questions.first?.conceptLabel
            ?? targetConceptIds.first?.replacingOccurrences(of: "_", with: " ").capitalized
            ?? ""
    }

    var body: some View {
        Group {
            if embeddedInDesk {
                embeddedBody
            } else {
                shellBody
            }
        }
        // Stable id for the concept set - restore last question when the
        // Binder minimized mid-session (same concepts), else start fresh.
        .id(conceptKey)
        .onAppear { restoreResumePosition() }
        .onChange(of: selectedIndex) { _, idx in
            resumeConceptKey = conceptKey
            resumeIndex = idx
            resumePastFormula = !showFormulaCard
        }
        .onChange(of: showFormulaCard) { _, showing in
            resumeConceptKey = conceptKey
            resumePastFormula = !showing
        }
    }

    private func restoreResumePosition() {
        guard resumeConceptKey == conceptKey, !conceptKey.isEmpty else {
            selectedIndex = 0
            showFormulaCard = !targetConceptIds.isEmpty
            return
        }
        if resumePastFormula { showFormulaCard = false }
        let maxIdx = max(0, questions.count - 1)
        selectedIndex = min(max(0, resumeIndex), maxIdx)
    }

    /// Device-full shell. NavigationStack + Close (legacy ACT cover path).
    private var shellBody: some View {
        NavigationStack {
            Group {
                if showFormulaCard && !targetConceptIds.isEmpty {
                    FormulaCardView(
                        conceptId: targetConceptIds[0],
                        conceptLabel: formulaConceptLabel,
                        onStartPractice: { showFormulaCard = false }
                    )
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Close") { dismiss() }
                        }
                    }
                } else {
                    VStack(spacing: 0) {
                        questionNav
                        if selectedIndex < questions.count {
                            QuestionView(question: questions[selectedIndex], store: store)
                                .id(questions[selectedIndex].id)
                        }
                    }
                    .background(ActField.fieldBg)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .principal) {
                            HStack(spacing: 10) {
                                ActRaccoonBadge(size: 34)
                                Text("ACT Field Book")
                                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                                    .foregroundColor(ActField.ink)
                            }
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Close") { dismiss() }
                        }
                    }
                    .toolbarBackground(ActField.fieldBg, for: .navigationBar)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbarColorScheme(.light, for: .navigationBar)
                }
            }
        }
    }

    /// In-stage practice: Home only (no mascot / ACT title / Close), content
    /// pushed up so the writing module gets real Pencil hit area.
    private var embeddedBody: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                DeskHomeButton(
                    action: { (onClose ?? { dismiss() })() },
                    accessibilityId: "actPracticeHome"
                )
                Text(showFormulaCard ? formulaConceptLabel : "Practice")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(ActField.ink)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(ActField.fieldBg.opacity(0.98))

            if showFormulaCard && !targetConceptIds.isEmpty {
                FormulaCardView(
                    conceptId: targetConceptIds[0],
                    conceptLabel: formulaConceptLabel,
                    embeddedInDesk: true,
                    onClose: { (onClose ?? { dismiss() })() },
                    onStartPractice: { showFormulaCard = false }
                )
            } else {
                VStack(spacing: 0) {
                    questionNav
                    if selectedIndex < questions.count {
                        QuestionView(question: questions[selectedIndex], store: store)
                            .id(questions[selectedIndex].id)
                    }
                }
                .background(ActField.fieldBg)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ActField.fieldBg)
        // Keep Pencil strokes from being clipped by a parent stage radius.
        .compositingGroup()
    }

    /// A real prev/next + "N of M" navigator - replaces a `.segmented`
    /// Picker that broke visibly with 10+ items (labels compressed into
    /// illegible repeating glyphs at that width), same fix pattern already
    /// used for ConceptChapterView's page navigation. Recolored this round
    /// onto the real paper palette (`#f7f3ee` page / `#1c1a17` ink) - see
    /// `body`'s doc comment for why the teal read was stale.
    private var questionNav: some View {
        // Prev left · counter · next arrow pinned top-trailing (stories parity).
        HStack(spacing: 12) {
            Button(action: { selectedIndex = max(0, selectedIndex - 1) }) {
                Image(systemName: "arrow.left")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(ActField.card))
            }
            .disabled(selectedIndex == 0)
            .opacity(selectedIndex == 0 ? 0.35 : 1)
            .accessibilityIdentifier("questionNavPrev")

            Text("Question \(selectedIndex + 1) of \(questions.count)")
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundColor(ActField.ink)

            Spacer(minLength: 8)

            Button(action: { selectedIndex = min(questions.count - 1, selectedIndex + 1) }) {
                Image(systemName: "arrow.right")
                    .font(.system(size: 15, weight: .bold))
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(ActField.card))
            }
            .accessibilityIdentifier("questionNavNext")
            .disabled(selectedIndex >= questions.count - 1)
            .opacity(selectedIndex >= questions.count - 1 ? 0.35 : 1)
        }
        .foregroundColor(ActField.ink)
        .padding(.horizontal, 16)
        .padding(.vertical, embeddedInDesk ? 6 : 10)
        .background(ActField.fieldBg.opacity(0.96))
        .overlay(Rectangle().fill(ActField.edge.opacity(0.7)).frame(height: 1), alignment: .bottom)
    }
}

private extension Color {
    init(sessionHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
