import SwiftUI

/// Round 9, priority 5. Real port of `app/src/pages/Practice.tsx`'s
/// `startWeeklyWalkthrough()` / `beginWeeklySlotSession()` / `weeklyWalkSlots`
/// state machine - the actual web "Weekly Review" pattern: for EACH topic,
/// a story beat, then that topic's formula/concept card, then that topic's
/// question batch, looping to the next topic's story beat until every slot
/// is done. This REPLACES what the hero bar's "Weekly Review" badge
/// previously opened (`DashboardView.openWork(with: weeklyReviewConceptIds)`
/// → a flat `PracticeSessionView` - one combined question list across all
/// the target concepts with only ONE formula card, for the first concept
/// only, no per-topic story beat, no "Topic X of Y" framing) - that was a
/// practice session merely LABELED "weekly review," not the real guided
/// walkthrough web actually ships.
///
/// Web's `WeeklyPaperSlot.role` (`strengthen`/`stretch`/`review`) drives a
/// one-line framing sentence on the story-beat screen
/// (`Practice.tsx` ~2099-2105) - ported verbatim below as
/// `WeeklyReviewSlotRole.framingLine`. `DashboardView.weeklyReviewSlots`
/// assigns roles the same way `weeklyReviewConceptIds` already picked these
/// three real signals: today's-spark concept → `.strengthen`, learn-next
/// concept → `.stretch`, the first Contents lane's next two concepts →
/// `.review` - real signals already computed there, just now carrying a role
/// tag instead of being flattened into one plain id list.
struct WeeklyReviewSlot: Identifiable {
    let conceptId: String
    let label: String
    let role: WeeklyReviewSlotRole
    var id: String { conceptId }
}

enum WeeklyReviewSlotRole {
    case strengthen, stretch, review

    /// Verbatim port of `Practice.tsx`'s per-role framing line
    /// (~2100-2104).
    var framingLine: String {
        switch self {
        case .strengthen: return "A weak spot we\u{2019}re strengthening."
        case .stretch: return "Something new to stretch into."
        case .review: return "A light review pass."
        }
    }
}

/// Owns the whole walkthrough's state machine. `conceptStatus` is the same
/// live `graphClient.progress` mastery/status map `DashboardView` already
/// threads into a plain `PracticeSessionView` (there, only for the FIRST
/// target concept - here, real per-slot lookups, since each slot needs its
/// own level recommendation exactly like web re-derives `level` per slot in
/// `beginWeeklySlotSession()`).
struct WeeklyReviewWalkthroughView: View {
    let slots: [WeeklyReviewSlot]
    let conceptStatus: [String: String]
    var embeddedInDesk: Bool = false
    var onClose: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = DrawingStore()
    @State private var slotIndex = 0
    @State private var phase: Phase = .story
    @State private var questionIndex = 0
    @State private var slotQuestions: [SampleQuestion] = []

    private enum Phase { case story, formula, session }

    private var currentSlot: WeeklyReviewSlot? {
        slots.indices.contains(slotIndex) ? slots[slotIndex] : nil
    }

    private func closeWalkthrough() {
        if let onClose { onClose() } else { dismiss() }
    }

    var body: some View {
        Group {
            if embeddedInDesk {
                embeddedBody
            } else {
                NavigationStack {
                    walkthroughContent
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button("Close") { closeWalkthrough() }
                            }
                        }
                }
            }
        }
    }

    private var embeddedBody: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                DeskHomeButton(action: closeWalkthrough, accessibilityId: "actWeeklyHome")
                Text("Weekly Review")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(weeklyHex: "1C1A17"))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(weeklyHex: "F7F3EE").opacity(0.98))

            walkthroughContent
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(weeklyHex: "F7F3EE"))
    }

    @ViewBuilder
    private var walkthroughContent: some View {
        Group {
            if let slot = currentSlot {
                switch phase {
                case .story:
                    WeeklyStoryBeatView(
                        slot: slot,
                        topicNumber: slotIndex + 1,
                        topicCount: slots.count,
                        onContinue: { phase = .formula }
                    )
                case .formula:
                    FormulaCardView(
                        conceptId: slot.conceptId,
                        conceptLabel: slot.label,
                        walkthroughTagline: "Weekly Review \u{00B7} Topic \(slotIndex + 1) of \(slots.count)",
                        startButtonLabel: "Start these questions \u{2192}",
                        embeddedInDesk: embeddedInDesk,
                        onClose: closeWalkthrough,
                        onStartPractice: {
                            slotQuestions = questionsForSlot(slot)
                            questionIndex = 0
                            phase = .session
                        }
                    )
                case .session:
                    VStack(spacing: 0) {
                        weeklySessionNav
                        if questionIndex < slotQuestions.count {
                            // .id forces a fresh QuestionView per question
                            // - same reason PracticeSessionView does this
                            // (round 7): without it, @State like
                            // selectedChoice/checked survives across a
                            // question swap.
                            QuestionView(question: slotQuestions[questionIndex], store: store)
                                .id(slotQuestions[questionIndex].id)
                        } else {
                            // A slot whose bank pool came back empty
                            // (shouldn't happen given real concept ids,
                            // but never silently hang the walkthrough on
                            // it) - same "don't block the whole
                            // walkthrough on one bad slot" rule web's own
                            // `startWeeklyWalkthrough()` doc comment
                            // states, applied per-slot here too.
                            emptySlotState
                        }
                    }
                    .background(Color(weeklyHex: "F7F3EE"))
                    .navigationBarTitleDisplayMode(.inline)
                }
            } else {
                WeeklyReviewCompleteView(topicCount: slots.count, onDone: closeWalkthrough)
            }
        }
    }

    /// Same level-recommendation rule `PracticeSessionView` already uses
    /// (`QuestionBankLoader.recommendedLevel(forStatus:)`), applied per-slot
    /// - matches web's `beginWeeklySlotSession()` re-deriving `level` fresh
    /// for whichever slot is current, rather than one level for the whole
    /// walkthrough. `limit: 6` is a real, deliberately SHORTER batch than a
    /// plain practice session's 12 - a weekly review topic is meant to be a
    /// quick pass across several topics, not a full mission per topic (the
    /// same "don't dump 180 questions on the student" lesson
    /// `QuestionBankLoader.session`'s own doc comment already learned,
    /// applied at walkthrough scale: 6 questions × several topics stays a
    /// reasonable single sitting).
    private func questionsForSlot(_ slot: WeeklyReviewSlot) -> [SampleQuestion] {
        let level = QuestionBankLoader.recommendedLevel(forStatus: conceptStatus[slot.conceptId])
        return QuestionBankLoader.session(forConcepts: [slot.conceptId], preferredLevel: level, limit: 6)
    }

    /// Real prev/next + "Topic X of Y · Question A of B" navigator - same
    /// simple free-navigation pattern `PracticeSessionView.questionNav`
    /// already established (round 7), extended with the topic dimension.
    /// Advancing past the slot's last question loops to the NEXT slot's
    /// story beat (`advance()` below) instead of ending outright - the
    /// actual walkthrough loop, mirroring web's `finishSession()` advancing
    /// `weeklyWalkIndex` when more slots remain.
    private var weeklySessionNav: some View {
        // Next arrow pinned trailing - same language as stories / practice.
        HStack(spacing: 12) {
            Button(action: goBack) {
                Image(systemName: "arrow.left")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.7)))
            }
            .disabled(slotIndex == 0 && questionIndex == 0)
            .opacity(slotIndex == 0 && questionIndex == 0 ? 0.35 : 1)

            VStack(alignment: .leading, spacing: 2) {
                Text("Topic \(slotIndex + 1) of \(slots.count)")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(Color(weeklyHex: "6F6A61"))
                Text("Question \(min(questionIndex + 1, slotQuestions.count)) of \(slotQuestions.count)")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
            }
            .accessibilityIdentifier("weeklyWalkthroughProgress")

            Spacer(minLength: 8)

            Button(action: advance) {
                Image(systemName: "arrow.right")
                    .font(.system(size: 15, weight: .bold))
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.white.opacity(0.85)))
            }
            .accessibilityIdentifier("weeklyWalkthroughNext")
        }
        .foregroundColor(Color(weeklyHex: "1C1A17"))
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(weeklyHex: "F7F3EE"))
    }

    private var emptySlotState: some View {
        VStack(spacing: 14) {
            Spacer()
            Text("No questions ready for this topic yet.")
                .font(.system(size: 15, weight: .semibold, design: .rounded))
            Button(slotIndex + 1 < slots.count ? "Next topic \u{2192}" : "Finish") { advance() }
                .buttonStyle(.borderedProminent)
            Spacer()
        }
    }

    private func goBack() {
        if questionIndex > 0 {
            questionIndex -= 1
        } else if slotIndex > 0 {
            slotIndex -= 1
            phase = .story
        }
    }

    private func advance() {
        if questionIndex + 1 < slotQuestions.count {
            questionIndex += 1
        } else if slotIndex + 1 < slots.count {
            slotIndex += 1
            phase = .story
        } else {
            // Past the last question of the last slot - currentSlot still
            // resolves to a real slot (slotIndex unchanged), so bump it out
            // of range to fall through to WeeklyReviewCompleteView.
            slotIndex = slots.count
        }
    }
}

/// Real port of `Practice.tsx`'s `pPhase === 'weekly-story'` screen
/// (~2074-2125): "Weekly Review · Topic X of Y" tagline, concept icon +
/// label, the role framing line, then a short story-beat section (real
/// protagonist + setting line from `ConceptStoryLoader` - same bundled
/// `conceptStories.json` `ConceptChapterView` already reads - falling back
/// to the story's own opening sentence, then a plain "Up next" line, exactly
/// web's own three-tier fallback: `story?.settingLine || opener ||
/// \`Up next: ${storyLabel}.\``), and a "Continue →" button into the formula
/// card. Same paper palette as `FormulaCardView`/`QuestionView` (this is the
/// same `.exploreScreen`/`.exploreCard` CSS class web reuses for both
/// screens).
private struct WeeklyStoryBeatView: View {
    let slot: WeeklyReviewSlot
    let topicNumber: Int
    let topicCount: Int
    let onContinue: () -> Void

    @Environment(\.dismiss) private var dismiss

    private enum Paper {
        static let bg = Color(weeklyHex: "F7F3EE")
        static let sheet = Color(weeklyHex: "FBF8F4")
        static let edge = Color(weeklyHex: "E2D8CA")
        static let ink = Color(weeklyHex: "1C1A17")
        static let inkKatha = Color(weeklyHex: "232F4E")
        static let inkDim = Color(weeklyHex: "6F6A61")
        static let accentBlue = Color(weeklyHex: "1D3A8A")
    }

    /// Same three-tier fallback as web's `opener` (`story?.story.split(...)[0]`):
    /// first sentence of the real story text, roughly split on
    /// sentence-ending punctuation - a lightweight local version of
    /// `StoryPaginator`'s own (private) sentence splitter, not a full port,
    /// since only the FIRST sentence is ever needed here.
    private var openerSentence: String? {
        guard let story = ConceptStoryLoader.story(for: slot.conceptId) else { return nil }
        let trimmed = story.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let range = trimmed.range(of: "[.!?]", options: .regularExpression) {
            return String(trimmed[..<range.upperBound])
        }
        return trimmed
    }

    var body: some View {
        ZStack {
            Paper.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Button(action: { dismiss() }) {
                        Text("\u{2190} Back")
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Paper.inkDim)
                    }
                    .buttonStyle(.plain)

                    VStack(alignment: .leading, spacing: 22) {
                        Text("Weekly Review \u{00B7} Topic \(topicNumber) of \(topicCount)")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(Paper.accentBlue)
                            .accessibilityIdentifier("weeklyWalkthroughTagline")

                        VStack(alignment: .leading, spacing: 6) {
                            Text(slot.label)
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundColor(Paper.inkKatha)
                            Text(slot.role.framingLine)
                                .font(.system(size: 14, design: .serif))
                                .foregroundColor(Paper.inkDim)
                        }

                        let context = ConceptStoryLoader.context(for: slot.conceptId)
                        VStack(alignment: .leading, spacing: 8) {
                            Text("\u{1F4D6} \(context?.protagonist ?? slot.label)")
                                .font(.system(size: 12, weight: .heavy, design: .rounded))
                                .tracking(0.6)
                                .foregroundColor(Paper.inkDim)
                            Text(context?.settingLine ?? openerSentence ?? "Up next: \(slot.label).")
                                .font(.system(size: 15, design: .serif))
                                .foregroundColor(Paper.ink)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        Button(action: onContinue) {
                            Text("Continue \u{2192}")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(weeklyHex: "164B52"))
                                .padding(.horizontal, 30)
                                .padding(.vertical, 14)
                                .background(Capsule().fill(Color(weeklyHex: "C4F547")))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("weeklyStoryContinueButton")
                    }
                    .padding(28)
                    .background(Paper.sheet)
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Paper.edge, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .padding(24)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
        }
    }
}

/// Shown once every slot is done - no direct single web equivalent (web's
/// walkthrough just returns to `/dashboard` after the last slot's
/// `finishSession()`), but a real completion beat here is a reasonable
/// native touch rather than an abrupt dismiss with no acknowledgement.
private struct WeeklyReviewCompleteView: View {
    let topicCount: Int
    let onDone: () -> Void

    var body: some View {
        ZStack {
            Color(weeklyHex: "F7F3EE").ignoresSafeArea()
            VStack(spacing: 16) {
                Text("\u{2713}")
                    .font(.system(size: 40, weight: .bold))
                    .foregroundColor(Color(weeklyHex: "1F6B45"))
                Text("Weekly Review complete")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(Color(weeklyHex: "1C1A17"))
                Text("You worked through \(topicCount) topic\(topicCount == 1 ? "" : "s") today.")
                    .font(.system(size: 14, design: .serif))
                    .foregroundColor(Color(weeklyHex: "6F6A61"))
                Button("Back to journal", action: onDone)
                    .buttonStyle(.borderedProminent)
                    .tint(Color(weeklyHex: "1F6B45"))
                    .accessibilityIdentifier("weeklyWalkthroughDoneButton")
            }
        }
    }
}

private extension Color {
    init(weeklyHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
