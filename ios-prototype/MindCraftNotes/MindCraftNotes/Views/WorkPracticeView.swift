import SwiftUI
import PhotosUI
import FirebaseAuth

/// The Dashboard's "Work" tab - real "homework + solver in one place",
/// ported from `WorkStudio.tsx`: photo upload → real webhook parse → real
/// Firestore `homework_sessions` session, "paste a problem" → real
/// `/recommend-ingredients` hint cards, real "Recent" list. Visual chrome
/// rebuilt to match the real web screenshot exactly (2026-07-25 smoke test:
/// "work should look like this") - warm paper background, ring-binder spine
/// down the left edge, wizard + speech-bubble hero, dashed-border drop card,
/// lavender drop-zone pill, mint "Get hints" pill - instead of plain iOS
/// system chrome (`.borderedProminent`/`.secondarySystemGroupedBackground`).
/// All the real networking/state below is unchanged from the prior pass.
struct WorkPracticeView: View {
    @State private var photoItem: PhotosPickerItem?
    @State private var stage: Stage = .idle
    @State private var statusText = ""
    @State private var errorText = ""
    @State private var parsedQuestions: [HomeworkQuestion] = []
    @State private var recentSessions: [HomeworkSession] = []
    @State private var solverText = ""
    @State private var hintCards: [IngredientHintsClient.HintCard] = []
    @State private var hintsLoading = false
    @State private var hintsError = ""

    private enum Stage { case idle, reading, error }

    private var tip: String {
        switch stage {
        case .reading: return "Hang tight, I'm reading your pages\u{2026}"
        default:
            return solverText.trimmingCharacters(in: .whitespaces).isEmpty
                ? "Drop a worksheet PDF, or paste a stuck problem below."
                : "Nice. Hit Get hints and I'll walk you through it."
        }
    }

    var body: some View {
        ZStack(alignment: .leading) {
            // Phase 5 (2026-08-06): verified against the live
            // `WorkStudio.module.css` + `WorkStudio.tsx` directly - `<WorkStudio>`
            // renders inside Dashboard's `<main className={s.canvasStage}>`
            // (Dashboard.tsx:783/963) unconditionally, same as every other tab,
            // so the real page backdrop IS the dark chalkboard, not paper. The
            // component's own light lavender/mint/cream card colors below are
            // NOT stale, though. WorkStudio.module.css still hardcodes them
            // literally (`#f5f3ff`/`#8dffc0`/`#fffdf8` etc.), unconverted to the
            // `--ink-*`/`--paper-*` vars the chalkboard migration introduced
            // elsewhere. Net real result: light paper cards floating on a dark
            // desk, which is what this now renders.
            WorkDeskBackground().ignoresSafeArea()
            RingBinderSpine().frame(width: 32).ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    heroRow
                    dropCard
                    if !parsedQuestions.isEmpty {
                        parsedQuestionsSection
                    }
                    if !recentSessions.isEmpty {
                        recentSection
                    }
                }
                .padding(.leading, 44)
                .padding(.trailing, 24)
                .padding(.vertical, 22)
            }
        }
        .task {
            if let uid = Auth.auth().currentUser?.uid {
                recentSessions = await HomeworkClient.listRecentSessions(uid: uid)
            }
        }
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task { await handlePicked(newItem) }
        }
    }

    private var heroRow: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Work")
                    .font(.system(size: 34, weight: .heavy, design: .rounded))
                    .italic()
                    // `stageInk`, not `ink`: this text sits directly on the dark
                    // `WorkDeskBackground` (no card behind it, confirmed against
                    // WorkStudio.tsx:130 - `.title` on bare `.root`), so it needs
                    // the light stage ink, same as every other tab's heading text
                    // directly on `.canvasStage`. `ink` (dark) is for text inside
                    // the light paper cards below, where it's genuinely correct.
                    .foregroundColor(WorkColor.stageInk)
                Text("Homework + solver in one place")
                    .font(.system(size: 14, design: .serif))
                    .foregroundColor(WorkColor.stageInk.opacity(0.75))
            }

            Spacer()

            if let uiImage = UIImage(named: "wizard-doodle-cheer") {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 58, height: 58)
                    .padding(.top, 4)
            }

            Text(tip)
                .font(.system(size: 13.5, design: .rounded))
                .italic()
                .foregroundColor(WorkColor.ink)
                .frame(maxWidth: 210, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(WorkColor.paper)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(WorkColor.ink, lineWidth: 1.5)
                        )
                )
        }
    }

    private var dropCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            PhotosPicker(selection: $photoItem, matching: .images) {
                Text(stage == .reading ? statusText : "Drop PDF / photo here")
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .italic()
                    .foregroundColor(WorkColor.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 16)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(WorkColor.lavender)
                    )
            }
            .buttonStyle(.plain)
            .disabled(stage == .reading)

            Text("OR PASTE A PROBLEM")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .tracking(1.4)
                .foregroundColor(WorkColor.inkSoft.opacity(0.55))

            ZStack(alignment: .topLeading) {
                if solverText.isEmpty {
                    Text("e.g. Solve 2x + 5 = 13\u{2026}")
                        .font(.system(size: 15, design: .serif))
                        .foregroundColor(WorkColor.inkSoft.opacity(0.45))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $solverText)
                    .font(.system(size: 15, design: .serif))
                    .foregroundColor(WorkColor.ink)
                    .scrollContentBackground(.hidden)
                    .padding(8)
            }
            .frame(height: 220)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(WorkColor.paper)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(WorkColor.ink.opacity(0.18), lineWidth: 1)
                    )
            )

            Button {
                Task { await getHints() }
            } label: {
                Group {
                    if hintsLoading {
                        ProgressView()
                    } else {
                        Text("Get hints \u{2192}")
                    }
                }
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .italic()
                .foregroundColor(hintsEnabled ? WorkColor.ink : WorkColor.ink.opacity(0.35))
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(hintsEnabled ? WorkColor.mint : WorkColor.mint.opacity(0.4))
                )
            }
            .buttonStyle(.plain)
            .disabled(!hintsEnabled)

            if !hintsError.isEmpty {
                Text(hintsError).font(.system(size: 12, design: .rounded)).foregroundColor(.red)
            }
            if !errorText.isEmpty {
                Text(errorText).font(.system(size: 12, design: .rounded)).foregroundColor(.red)
            }

            ForEach(Array(hintCards.enumerated()), id: \.offset) { _, card in
                VStack(alignment: .leading, spacing: 4) {
                    Text(card.title).font(.system(size: 13, weight: .bold, design: .rounded)).foregroundColor(WorkColor.ink)
                    Text(card.body).font(.system(size: 13, design: .rounded)).foregroundColor(WorkColor.inkSoft)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 8).fill(WorkColor.mint.opacity(0.12)))
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(style: StrokeStyle(lineWidth: 1.4, dash: [6, 5]))
                .foregroundColor(WorkColor.ink.opacity(0.28))
        )
    }

    private var hintsEnabled: Bool {
        !solverText.trimmingCharacters(in: .whitespaces).isEmpty && !hintsLoading
    }

    private var parsedQuestionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("From your upload").font(.system(size: 14, weight: .bold, design: .rounded)).foregroundColor(WorkColor.ink)
            ForEach(parsedQuestions) { q in
                VStack(alignment: .leading, spacing: 4) {
                    if let number = q.number {
                        Text("Question \(number)").font(.system(size: 12, weight: .semibold, design: .rounded)).foregroundColor(WorkColor.accent)
                    }
                    Text(q.text).font(.system(size: 14, design: .serif)).foregroundColor(WorkColor.ink)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 8).fill(WorkColor.paper))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(WorkColor.ink.opacity(0.1), lineWidth: 1))
            }
        }
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent").font(.system(size: 14, weight: .bold, design: .rounded)).foregroundColor(WorkColor.inkSoft)
            ForEach(recentSessions) { session in
                Button(session.title) { parsedQuestions = session.questions }
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(WorkColor.accent)
            }
        }
    }

    private func handlePicked(_ item: PhotosPickerItem) async {
        errorText = ""
        stage = .reading
        statusText = "Opening on your canvas\u{2026}"
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            errorText = "Couldn't read that photo. Try a clearer shot."
            stage = .error
            return
        }
        let (result, sessionId) = await HomeworkClient.parseAndCreateSession(imageData: data, fileName: "worksheet.jpg")
        switch result {
        case .success(let questions):
            parsedQuestions = questions
            stage = .idle
            if sessionId != nil, let uid = Auth.auth().currentUser?.uid {
                recentSessions = await HomeworkClient.listRecentSessions(uid: uid)
            }
        case .unavailable:
            errorText = "Couldn't find questions on that page. Try another photo, or the homework helper may be temporarily unavailable."
            stage = .error
        case .notSignedIn:
            errorText = "Please sign in again."
            stage = .error
        }
    }

    private func getHints() async {
        hintsError = ""
        hintsLoading = true
        defer { hintsLoading = false }
        switch await IngredientHintsClient.hints(for: solverText) {
        case .cards(let cards):
            hintCards = cards
        case .keyRejected:
            hintsError = "That AI key was rejected. Open Settings to update it."
        case .unavailable:
            hintsError = "Homework help is temporarily unavailable - try again in a bit."
        }
    }
}

/// The notebook's left-margin ring-binder holes - a small recurring detail
/// (`DASHBOARD_NOTEBOOK_SPEC.md`'s spiral-ring system) not yet ported to any
/// native screen; added here since it's exactly what distinguished the real
/// Work tab screenshot from native's plain system-background version.
private struct RingBinderSpine: View {
    var body: some View {
        GeometryReader { geo in
            let count = max(Int(geo.size.height / 70), 4)
            VStack(spacing: 0) {
                ForEach(0..<count, id: \.self) { i in
                    Circle()
                        .strokeBorder(WorkColor.ink.opacity(0.35), lineWidth: 1.5)
                        .background(Circle().fill(WorkColor.paper))
                        .frame(width: 11, height: 11)
                        .frame(maxHeight: .infinity)
                        .opacity(i % 3 == 1 ? 1 : 0.55)
                }
            }
        }
        .overlay(
            Rectangle().fill(WorkColor.ink.opacity(0.12)).frame(width: 1),
            alignment: .trailing
        )
    }
}

// Phase 5 (2026-08-06): ink/paper/lavender/mint below are UNCHANGED - verified
// still-correct against the live `WorkStudio.module.css` (not stale, unlike
// most other screens this phase). Only `stageInk` is new (for text on the
// bare dark backdrop, see body's comment above) and `accent` changed: the
// old `1d3a8a` blue had no match anywhere in the live CSS (confirmed via a
// full-file grep. WorkStudio.module.css has no blue at all), so it was
// likely never verified in the first place; replaced with the app's one
// real, confirmed, consistently-used interactive accent (brand green,
// matches DeskColor.brandGreen / FindTutor's shared `--green` token) rather
// than leave an ungrounded guess in place.
private enum WorkColor {
    static let ink = Color(workHex: "2a2430")
    static let inkSoft = Color(workHex: "3a2f55")
    static let accent = Color(workHex: "54b948")
    static let stageInk = Color(workHex: "f4efe2")
    static let paper = Color(red: 255.0 / 255, green: 253.0 / 255, blue: 248.0 / 255)
    static let lavender = Color(workHex: "e4dcf5")
    static let mint = Color(workHex: "b8f0c8")
}

/// Same dark chalkboard treatment as `DashboardView`'s `DeskBackground`
/// (Dashboard.module.css `.canvasStage`, 2026-08-06 redesign) - file-scoped
/// duplicate, same reasoning as `WorkColor` itself (avoids a cross-file
/// redeclaration conflict rather than sharing one struct).
private struct WorkDeskBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(workHex: "1c3228"),
                    Color(workHex: "14261c"),
                    Color(workHex: "0f1f18"),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [Color(workHex: "b9e86f").opacity(0.14), .clear],
                center: UnitPoint(x: 0.85, y: 0.08),
                startRadius: 0,
                endRadius: 460
            )
            RadialGradient(
                colors: [Color(workHex: "1d3a8a").opacity(0.22), .clear],
                center: UnitPoint(x: 0.15, y: 0.9),
                startRadius: 0,
                endRadius: 460
            )
        }
    }
}

private extension Color {
    init(workHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
