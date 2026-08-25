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
/// the `.binderOverlay` overlay, `showJesseCallSheet`) -
/// "one thing owns the screen at a time" is already true of every one of
/// those, so this view doesn't need its own card-ownership state machine,
/// just buttons that call into what's already there.
struct DeskPhoneDashboardView: View {
    var studentName: String
    /// Shared with ConstellationView (2026-08-24, explicit ask:
    /// "displaying the number of content on Gurukul vs Dash... both ipad
    /// and ios") - one load, owned by FieldDeskView, read here for
    /// Gurukul's subtitle instead of a second separate fetch.
    @ObservedObject var knowledgeGraphClient: KnowledgeGraphClient
    var onContinueWork: () -> Void
    var onLearn: () -> Void
    var onDesign: () -> Void
    var onLeverage: () -> Void
    var onOpenSettings: () -> Void
    var onOpenFriends: () -> Void
    var onLogout: () -> Void

    private let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
    private let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)
    private let cream = Color(red: 255 / 255, green: 248 / 255, blue: 233 / 255)

    /// This view sits inside FieldDeskView's outer `.ignoresSafeArea()`
    /// canvas (2026-08-24, found while fixing the Dynamic Island collision
    /// below) - a plain `.padding(.top, 8)` was standing in for the real
    /// safe area and was wrong on every Dynamic Island phone. Reading the
    /// key window directly instead of trusting a passed-down safe area
    /// value survives GeometryReader ancestors elsewhere in FieldDeskView
    /// stripping that value from the environment.
    private var topSafeAreaInset: CGFloat {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow })?
            .safeAreaInsets.top ?? 47
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Your Desk")
                            .font(.mcContent(size: 30, weight: .semibold))
                            .foregroundColor(ink)
                        Text("Welcome back, \(studentName).")
                            .font(.mcChrome(size: 15))
                            .foregroundColor(ink.opacity(0.6))
                    }
                    Spacer(minLength: 12)
                    // Top-right account row (2026-08-24, explicit ask) -
                    // grid dashboard already has Settings (onOpenManage)
                    // and Friends (viewingFriends/FriendsView) reachable
                    // from its bottom dock, and Sign out via the hub's
                    // door-icon convention (DeskShellView) - none of the
                    // three existed anywhere on phone. Same actions/icons,
                    // just surfaced here since phone has no dock/hub.
                    HStack(spacing: 10) {
                        topIcon("gearshape.fill", identifier: "deskPhoneTop_Settings", action: onOpenSettings)
                        topIcon("person.2.fill", identifier: "deskPhoneTop_Friends", action: onOpenFriends)
                        topIcon("door.left.hand.open", identifier: "deskPhoneTop_Logout", action: onLogout)
                    }
                    .padding(.top, 4)
                }
                .padding(.top, topSafeAreaInset + 8)

                feedCard(
                    title: "Constellation",
                    subtitle: "Your knowledge map - tap a star to see where you stand.",
                    system: "sparkles",
                    identifier: "deskPhoneCard_Continue",
                    action: onContinueWork
                )
                learnCard
                feedCard(
                    title: "Design",
                    subtitle: "Sketch out a layout or a flow with Jesse.",
                    system: "square.on.square.dashed",
                    identifier: "deskPhoneCard_Design",
                    action: onDesign
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

    private func topIcon(_ system: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(ink)
                .frame(width: 36, height: 36)
                .background(Circle().fill(Color.white))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    /// Gurukul (2026-08-24) - phone parity fix: `onLearn` used to open the
    /// old pre-merge `LearnStudioView`, but the grid dashboard already
    /// merged Learn+Practice into one AI study companion box back on
    /// 2026-08-23 (`StudyCompanionView`, see its own doc comment). This
    /// card was still pointing at the stale destination and a separate
    /// "Practice" card still existed alongside it - both wrong on phone
    /// now. `onLearn` is kept as the closure name (identifier/param
    /// churn not worth it for an internal name), but FieldDeskView's call
    /// site now wires it to the same `.studyCompanion` overlay insert the
    /// grid's Gurukul box uses, so both idioms open the identical screen.
    /// Raccoon treatment same as the iPad module box (2026-08-22/23
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
                    Text("Gurukul")
                        .font(.mcContent(size: 19, weight: .semibold))
                        .foregroundColor(ink)
                    // Impact-weighted mastery (2026-08-24, explicit ask -
                    // see ConceptImpactScore.swift's own doc comment).
                    // Falls back to the plain description before the
                    // graph has loaded or if it's still empty.
                    if let weighted = ConceptImpactScore.impactWeightedMastery(
                        nodes: knowledgeGraphClient.nodes, edges: knowledgeGraphClient.edges
                    ) {
                        Text("\(Int((weighted * 100).rounded()))% impact-weighted mastery")
                            .font(.mcChrome(size: 13))
                            .foregroundColor(ink.opacity(0.6))
                    } else {
                        Text("Your books, lessons, and talking it through with Jesse.")
                            .font(.mcChrome(size: 13))
                            .foregroundColor(ink.opacity(0.6))
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(ink.opacity(0.35))
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.white))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskPhoneCard_Learn")
    }

    /// Icon chip instead of a bare gray SF Symbol (2026-08-24) - same
    /// ink-circle-badge motif `mascotModuleBox` uses on PencilWork/Kamana
    /// in the grid dashboard, just promoted from a small corner badge to
    /// the row's primary icon. Deliberately NOT the raccoon-on-every-row
    /// treatment that pattern also uses: six identical raccoon shapes down
    /// one vertical list would cost the at-a-glance scannability distinct
    /// glyphs give a settings-style row list, for brand consistency this
    /// row order doesn't need. Learn keeps the plain raccoon below,
    /// matching Gurukul's own box.
    private func feedCard(title: String, subtitle: String, system: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(ink)
                    Image(systemName: system)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(cream)
                }
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
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.white))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}
