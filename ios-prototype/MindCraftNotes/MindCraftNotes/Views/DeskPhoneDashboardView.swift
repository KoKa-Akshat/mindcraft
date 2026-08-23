import SwiftUI

/// The Work Dashboard's phone layout (2026-08-23, explicit ask from the
/// original product spec: "on phone, modules become horizontal cards in a
/// vertical scrolling feed... tapping a card makes it own the full
/// screen... Jesse rises as a bottom sheet... one thing owns the screen
/// at a time"). Deliberately NOT a scaled-down `DeskGridDashboardView` -
/// that view's whole layout (left workspace + right module boxes on one
/// 1440x810 artboard) has no honest translation to a narrow screen.
///
/// This is a "dumb" presentational menu on purpose: every card's action is
/// a plain closure into destinations `FieldDeskView` ALREADY owns as real,
/// working full-screen presentations (`showLearnStudio`, `showResumeAgent`,
/// the `.createCanvas`/`.binderOverlay` overlays, `showJesseCallSheet`) -
/// "one thing owns the screen at a time" is already true of every one of
/// those, so this view doesn't need its own card-ownership state machine,
/// just buttons that call into what's already there.
struct DeskPhoneDashboardView: View {
    var studentName: String
    var onContinueWork: () -> Void
    var onLearn: () -> Void
    var onPractice: () -> Void
    var onCreate: () -> Void
    var onAnswer: () -> Void
    var onLeverage: () -> Void

    private let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
    private let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)
    private let cream = Color(red: 255 / 255, green: 248 / 255, blue: 233 / 255)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Your Desk")
                    .font(.mcContent(size: 30, weight: .semibold))
                    .foregroundColor(ink)
                    .padding(.top, 8)

                feedCard(
                    title: "Continue your work",
                    subtitle: "Pick up your Knowledge Map and books right where you left off.",
                    system: "book.closed.fill",
                    identifier: "deskPhoneCard_Continue",
                    action: onContinueWork
                )
                learnCard
                feedCard(
                    title: "Practice",
                    subtitle: "Talk it through with Jesse, out loud.",
                    system: "waveform.and.mic",
                    identifier: "deskPhoneCard_Practice",
                    action: onPractice
                )
                feedCard(
                    title: "Create",
                    subtitle: "Turn an idea into a presentation, doc, or book.",
                    system: "wand.and.stars",
                    identifier: "deskPhoneCard_Create",
                    action: onCreate
                )
                feedCard(
                    title: "Answer",
                    subtitle: "Ask Jesse anything about what you're working on.",
                    system: "bubble.left.and.bubble.right.fill",
                    identifier: "deskPhoneCard_Answer",
                    action: onAnswer
                )
                feedCard(
                    title: "Leverage",
                    subtitle: "Build your resume, one conversation at a time.",
                    system: "briefcase.fill",
                    identifier: "deskPhoneCard_Leverage",
                    action: onLeverage
                )
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 32)
        }
        .background(cream.ignoresSafeArea())
        .accessibilityIdentifier("deskPhoneDashboard")
    }

    /// Learn gets the raccoon, same as the iPad module box (2026-08-22/23
    /// precedent) - `JesseRailView.raccoonImage` is the one shared asset
    /// every Jesse surface in this app already reuses, not a new image.
    private var learnCard: some View {
        Button(action: onLearn) {
            HStack(spacing: 14) {
                JesseRailView.raccoonImage
                    .resizable()
                    .scaledToFit()
                    .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Learn")
                        .font(.mcContent(size: 19, weight: .semibold))
                        .foregroundColor(ink)
                    Text("Your books, lessons, and knowledge paths.")
                        .font(.mcChrome(size: 13))
                        .foregroundColor(ink.opacity(0.6))
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(ink.opacity(0.35))
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 84, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.white))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskPhoneCard_Learn")
    }

    private func feedCard(title: String, subtitle: String, system: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: system)
                    .font(.system(size: 22, weight: .medium))
                    .foregroundColor(ink)
                    .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.mcContent(size: 19, weight: .semibold))
                        .foregroundColor(ink)
                    Text(subtitle)
                        .font(.mcChrome(size: 13))
                        .foregroundColor(ink.opacity(0.6))
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(ink.opacity(0.35))
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 84, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.white))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}
