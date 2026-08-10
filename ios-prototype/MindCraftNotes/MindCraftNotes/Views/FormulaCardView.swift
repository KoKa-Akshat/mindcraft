import SwiftUI

/// **Round 8, item 3**: a lightweight native port of `Practice.tsx`'s
/// `pPhase === 'explore'` screen - the formula/concept card Weekly Review
/// already shows before a topic's question batch on web, sourced from
/// `app/src/lib/conceptContent.ts`'s `CONCEPT_CONTENT` (real per-concept
/// `keyRules`/`tips`/`watchOut`/optional `formula`/`examples`). Wired as a
/// real step ahead of `QuestionView` in the native "Begin practice" flow
/// (`PracticeSessionView`), not just for the Weekly Review walkthrough web
/// scopes it to. Akshat's ask this round was for every "Begin practice"
/// entry to show this first.
///
/// `CONCEPT_CONTENT` itself was exported verbatim from the real TS module
/// via a one-shot `vite-node` script (not hand-transcribed) into
/// `Resources/conceptContent.json`, decoded by `ConceptContentLoader` - see
/// that file's doc comment for the exact export mechanism.
///
/// Colors ported from the same real cascade-resolved paper palette
/// `QuestionView` now uses (`.matteShell .exploreCard { background:
/// var(--paper-sheet); border: 1px solid var(--paper-edge); color:
/// var(--paper-ink) }`, `.matteShell .exploreList li`/`.exampleQ` →
/// `var(--paper-ink-dim)`, `.exploreFormula`/`.exploreExample` →
/// `var(--paper-sheet-recessed)` - all verified directly against
/// `Practice.module.css`'s "PAPER STANDARDIZATION" + "FIELD JOURNAL" blocks,
/// same source QuestionView's own doc comment documents in full).
/// `.startPracticeBtn` is the one piece of this screen NEVER touched by
/// either later override pass (grepped `startPracticeBtn` across the whole
/// file - exactly one declaration) so it keeps its original lime
/// `--accent` (`#C4F547`) / dark teal-green `#164B52` text treatment.
struct FormulaCardView: View {
    let conceptId: String
    let conceptLabel: String

    /// Round 9: the Weekly Review walkthrough (`WeeklyReviewWalkthroughView`)
    /// reuses this exact screen as its per-topic formula card - literal web
    /// parity, since `Practice.tsx`'s `pPhase === 'explore'` block IS this
    /// same screen for both a plain practice session AND the walkthrough,
    /// distinguished only by an extra "Weekly Review · Topic X of Y" line
    /// (`weeklyWalkSlots &&` branch, ~Practice.tsx:2144) and its CTA reading
    /// "Start these questions →" instead of "Start Practice →"
    /// (~Practice.tsx:2225). Both default to the plain-session values so the
    /// existing `PracticeSessionView` call site is unaffected. Declared
    /// BEFORE `onStartPractice` (not after) so that closure stays the LAST
    /// parameter in the struct's memberwise init - keeps every call site
    /// (old and new) free to pass it as a normal trailing closure.
    var walkthroughTagline: String? = nil
    var startButtonLabel: String = "Start Practice \u{2192}"
    /// Desk-stage: story-card chrome (not full-bleed bright paper).
    var embeddedInDesk: Bool = false
    var onClose: (() -> Void)? = nil

    let onStartPractice: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var content: ConceptContent? { ConceptContentLoader.content(for: conceptId) }

    private enum Paper {
        static let bg = Color(formulaHex: "F7F3EE")
        static let sheet = Color(formulaHex: "FBF8F4")
        static let sheetRecessed = Color(formulaHex: "F1EADF")
        static let edge = Color(formulaHex: "E2D8CA")
        static let ink = Color(formulaHex: "1C1A17")
        static let inkKatha = Color(formulaHex: "232F4E")
        static let inkDim = Color(formulaHex: "6F6A61")
        static let accentBlue = Color(formulaHex: "1D3A8A")
        static let watchOut = Color(formulaHex: "FDBA74")
        static let watchOutDot = Color(formulaHex: "FB923C")
        static let bulletDot = Color(formulaHex: "54B948")
        static let startBg = Color(formulaHex: "C4F547")
        static let startText = Color(formulaHex: "164B52")
        // Story-card cousins (ConceptChapterView chalkboard).
        static let storyInk = Color(formulaHex: "F4EFE2")
        static let storyInkDim = Color(formulaHex: "F4EFE2").opacity(0.72)
        static let storyAccent = Color(formulaHex: "B9E86F")
        static let storyRecessed = Color(formulaHex: "0F1F18")
        static let storyEdge = Color(formulaHex: "B9E86F").opacity(0.28)
    }

    private var cardInk: Color { embeddedInDesk ? Paper.storyInk : Paper.ink }
    private var cardInkDim: Color { embeddedInDesk ? Paper.storyInkDim : Paper.inkDim }
    private var cardInkStrong: Color { embeddedInDesk ? Paper.storyInk : Paper.inkKatha }
    private var cardAccent: Color { embeddedInDesk ? Paper.storyAccent : Paper.accentBlue }
    private var cardRecessed: Color { embeddedInDesk ? Paper.storyRecessed : Paper.sheetRecessed }
    private var cardEdge: Color { embeddedInDesk ? Paper.storyEdge : Paper.edge }

    var body: some View {
        ZStack {
            if embeddedInDesk {
                LinearGradient(
                    colors: [Color(formulaHex: "1c3228"), Color(formulaHex: "14261c"), Color(formulaHex: "0f1f18")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                Paper.bg.ignoresSafeArea()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: embeddedInDesk ? 12 : 18) {
                    if !embeddedInDesk { backLink }
                    card
                }
                .padding(embeddedInDesk ? 12 : 24)
                .frame(maxWidth: embeddedInDesk ? .infinity : 760, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private var backLink: some View {
        Button(action: { (onClose ?? { dismiss() })() }) {
            Text("\u{2190} Back")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundColor(Paper.inkDim)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("formulaCardBackButton")
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: embeddedInDesk ? 14 : 22) {
            if let walkthroughTagline {
                Text(walkthroughTagline)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(cardAccent)
                    .accessibilityIdentifier("weeklyWalkthroughTagline")
            }

            header

            if let content {
                if let formula = content.formula {
                    Text(formula)
                        .font(.system(size: embeddedInDesk ? 15 : 16, weight: .bold, design: .rounded))
                        .foregroundColor(cardInkStrong)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(embeddedInDesk ? 12 : 14)
                        .background(cardRecessed)
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(cardEdge, lineWidth: 1))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .accessibilityIdentifier("formulaCardFormula")
                }

                if embeddedInDesk {
                    VStack(alignment: .leading, spacing: 12) {
                        section(title: "\u{1F4CB} KEY RULES", items: content.keyRules, dotColor: Paper.storyAccent)
                        section(title: "\u{1F4A1} PRO TIPS", items: content.tips, dotColor: Paper.storyAccent)
                    }
                } else {
                    HStack(alignment: .top, spacing: 24) {
                        section(title: "\u{1F4CB} KEY RULES", items: content.keyRules, dotColor: Paper.bulletDot)
                        section(title: "\u{1F4A1} PRO TIPS", items: content.tips, dotColor: Paper.bulletDot)
                    }
                }

                if !content.watchOut.isEmpty {
                    section(
                        title: "\u{26A0}\u{FE0F} WATCH OUT",
                        items: content.watchOut,
                        itemColor: embeddedInDesk ? Paper.watchOut : Paper.watchOut,
                        dotColor: Paper.watchOutDot
                    )
                }

                if !content.examples.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("\u{1F50D} WORKED EXAMPLES")
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .tracking(0.6)
                            .foregroundColor(cardInkDim)
                        VStack(spacing: 10) {
                            ForEach(Array(content.examples.enumerated()), id: \.offset) { _, example in
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(example.problem)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(cardInk)
                                    Text(example.solution)
                                        .font(.system(size: 13, weight: .medium, design: .rounded))
                                        .foregroundColor(cardAccent)
                                        .padding(.top, 6)
                                        .overlay(Rectangle().fill(cardEdge).frame(height: 1), alignment: .top)
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(cardRecessed)
                                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(cardEdge, lineWidth: 1))
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                        }
                    }
                }
            } else {
                // Real, graceful fallback matching web's own
                // `weeklyWalkSlots` no-content branch - skip the body, keep
                // the Start button, don't block the flow on a concept that
                // doesn't have curated content yet.
                Text("No formula sheet yet for this topic \u{2014} heading straight to the questions.")
                    .font(.system(size: 14, design: .serif))
                    .foregroundColor(cardInkDim)
            }

            Button(action: onStartPractice) {
                Text(startButtonLabel)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Paper.startText)
                    .padding(.horizontal, 30)
                    .padding(.vertical, 14)
                    .background(Capsule().fill(Paper.startBg))
                    .shadow(color: Paper.startBg.opacity(0.35), radius: 14, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("formulaCardStartPracticeButton")
        }
        .padding(embeddedInDesk ? 16 : 28)
        .background(
            Group {
                if embeddedInDesk {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color(formulaHex: "1c3228"), Color(formulaHex: "14261c"), Color(formulaHex: "0f1f18")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                } else {
                    Paper.sheet
                }
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: embeddedInDesk ? 18 : 20, style: .continuous)
                .strokeBorder(cardEdge, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: embeddedInDesk ? 18 : 20, style: .continuous))
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 16) {
            Text(content?.emoji ?? "\u{1F4D0}")
                .font(.system(size: embeddedInDesk ? 28 : 34))
                .frame(width: embeddedInDesk ? 48 : 56, height: embeddedInDesk ? 48 : 56)
                .background((embeddedInDesk ? Paper.storyAccent : Paper.bulletDot).opacity(0.12))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke((embeddedInDesk ? Paper.storyAccent : Paper.bulletDot).opacity(0.28), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 6) {
                Text(conceptLabel)
                    .font(.system(size: embeddedInDesk ? 20 : 24, weight: .bold, design: .rounded))
                    .foregroundColor(cardInkStrong)
                if let tagline = content?.tagline {
                    Text(tagline)
                        .font(.system(size: 14, design: .serif))
                        .foregroundColor(cardInkDim)
                }
                if let examWeight = content?.examWeight {
                    Text(examWeight)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(cardAccent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(cardAccent.opacity(0.14)))
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func section(title: String, items: [String], itemColor: Color? = nil, dotColor: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .tracking(0.6)
                .foregroundColor(cardInkDim)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(items, id: \.self) { item in
                    HStack(alignment: .top, spacing: 8) {
                        Text("\u{00B7}")
                            .font(.system(size: 16, weight: .heavy))
                            .foregroundColor(dotColor)
                        Text(item)
                            .font(.system(size: 13))
                            .foregroundColor(itemColor ?? cardInkDim)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension Color {
    init(formulaHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
