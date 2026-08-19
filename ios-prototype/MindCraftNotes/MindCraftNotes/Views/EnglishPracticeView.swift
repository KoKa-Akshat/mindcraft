import SwiftUI

/// English speaking/writing practice (2026-08-19) - a live spoken
/// conversation with Jesse, not a generated-content screen. Deliberately
/// the simplest possible shell around the shared `JesseRailView`: no
/// document/draft panel like Resume or Book have, because there is no
/// document here, just the conversation itself (see
/// `webhook/lib/handlers/english-practice.ts`'s own scope note - this
/// steers conversation tone, it does not generate chapters/curriculum).
struct EnglishPracticeView: View {
    var onClose: () -> Void
    var studentName: String = "there"

    @EnvironmentObject private var jesseCall: JesseCallSession

    private var goalState: EnglishPracticeGoal? { jesseCall.englishPracticeState }

    var body: some View {
        ZStack {
            Color(red: 255 / 255, green: 248 / 255, blue: 233 / 255).ignoresSafeArea()
            EnglishPracticeDottedGrid().ignoresSafeArea()

            VStack(spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("PRACTICE ENGLISH")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .tracking(1)
                        .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.5))
                    Text("Talk with Jesse")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                    // Shows what Jesse has actually learned once she's said
                    // it - honest reflection of real extracted state, not a
                    // static description of the feature.
                    if let goalState, !goalState.goal.isEmpty {
                        Text(goalState.deadline.isEmpty ? "Working on: \(goalState.goal)" : "Working on: \(goalState.goal) · \(goalState.deadline)")
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.65))
                            .accessibilityIdentifier("englishPracticeGoalLine")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 6)

                JesseRailView(studentName: studentName, context: "englishPractice")
                    .frame(maxWidth: 640)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 28)
            .padding(.top, 60)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)))
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 16)
            .accessibilityIdentifier("englishPracticeDone")
            .accessibilityLabel("Done")
        }
        .statusBarHidden(true)
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "english-practice").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("englishPracticeRoot")
                .allowsHitTesting(false)
        }
    }
}

/// Same dotted-grid treatment every other full-screen panel in this app
/// carries (Resume, Design Studio) - duplicated per-file rather than
/// shared, matching this codebase's existing convention for this exact
/// visual.
private struct EnglishPracticeDottedGrid: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 16
            for x in stride(from: 8, through: size.width, by: step) {
                for y in stride(from: 8, through: size.height, by: step) {
                    let dot = Path(ellipseIn: CGRect(x: x, y: y, width: 1.4, height: 1.4))
                    context.fill(dot, with: .color(Color(red: 215 / 255, green: 208 / 255, blue: 194 / 255)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}
