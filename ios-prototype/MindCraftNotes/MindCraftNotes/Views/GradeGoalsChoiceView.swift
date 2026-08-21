import SwiftUI
import FirebaseAuth
import FirebaseFirestore

/// One-time grade/goals onboarding screen (2026-08-21, explicit live ask:
/// "Ask the grade or goals at onboarding. They can either write grades and
/// their goals, or they can just write their goals. For grades, say
/// 'other' because they could be old people trying to learn too... or
/// teachers trying to help students through sims."). Closes the real gap
/// found the same night: Jesse's lesson generation now adapts to a
/// student's grade (`generate-lesson-outline.ts`), but no iOS onboarding
/// flow ever set the `users/{uid}.grade` field it reads - every iOS
/// student was ungraded by construction.
///
/// Mirrors VoiceChoiceView's shape exactly - same once-per-install gate
/// pattern, same call-site position in MindCraftNotesApp.swift - as the
/// last onboarding step before the dashboard, since it's about who the
/// student IS rather than a consent/preference gate.
///
/// Writes to the SAME Firestore fields the web app already reads/writes -
/// `grade: number` (app/src/pages/ConceptChapterPage.tsx,
/// bookPersonalization.ts) and `goals: { tags: [], text: string }`
/// (app/src/lib/diagnosticSeed.ts) - not a parallel iOS-only schema, so a
/// student who used the web app first isn't overwritten with an empty
/// profile, and one set on either platform is visible from both.
struct GradeGoalsChoiceView: View {
    var onDone: () -> Void

    private static let gradeOptions: [Int?] = [6, 7, 8, 9, 10, 11, 12, nil] // nil = "Other"

    @State private var selectedGrade: Int?
    @State private var otherSelected = false
    @State private var goalsText = ""
    @State private var isSaving = false

    private let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
    private let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)
    private let limeInk = Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255)

    private var canContinue: Bool {
        selectedGrade != nil || otherSelected || !goalsText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ZStack {
            ink.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    Spacer(minLength: 12)

                    VStack(spacing: 8) {
                        Text("ONE LAST THING")
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .tracking(1.5)
                            .foregroundColor(.white.opacity(0.55))
                        Text("Tell Jesse a bit about you")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)
                        Text("Grade, goals, or both - whatever helps Jesse pitch lessons at the right level. You can change this anytime.")
                            .font(.system(size: 14, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.65))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        sectionLabel("GRADE (OPTIONAL)")
                        gradeGrid
                    }
                    .padding(.horizontal, 32)

                    VStack(alignment: .leading, spacing: 10) {
                        sectionLabel("GOALS (OPTIONAL)")
                        TextEditor(text: $goalsText)
                            .font(.system(size: 15, design: .rounded))
                            .foregroundColor(.white)
                            .scrollContentBackground(.hidden)
                            .frame(height: 90)
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(Color.white.opacity(0.06))
                            )
                            .overlay(alignment: .topLeading) {
                                if goalsText.isEmpty {
                                    Text("e.g. \"prepping for the ACT,\" \"just curious about how things work,\" \"helping my students with sims\"")
                                        .font(.system(size: 13, design: .rounded))
                                        .foregroundColor(.white.opacity(0.35))
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 18)
                                        .allowsHitTesting(false)
                                }
                            }
                            .accessibilityIdentifier("gradeGoalsGoalsText")
                    }
                    .padding(.horizontal, 32)

                    Button {
                        Task { await save() }
                    } label: {
                        HStack(spacing: 8) {
                            if isSaving { ProgressView().tint(limeInk) }
                            Text(canContinue ? "Continue" : "Skip for now")
                        }
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundColor(limeInk)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(lime))
                    }
                    .buttonStyle(.plain)
                    .disabled(isSaving)
                    .padding(.horizontal, 32)
                    .accessibilityIdentifier("gradeGoalsContinue")

                    Spacer(minLength: 12)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "grade-goals-choice").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("gradeGoalsRoot")
                .allowsHitTesting(false)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .heavy, design: .rounded))
            .tracking(1)
            .foregroundColor(.white.opacity(0.5))
    }

    private var gradeGrid: some View {
        let columns = [GridItem(.adaptive(minimum: 64), spacing: 10)]
        return LazyVGrid(columns: columns, spacing: 10) {
            ForEach(Array(Self.gradeOptions.enumerated()), id: \.offset) { _, option in
                gradeChip(option)
            }
        }
    }

    private func gradeChip(_ option: Int?) -> some View {
        let isOther = option == nil
        let isSelected = isOther ? otherSelected : (selectedGrade == option)
        return Button {
            if isOther {
                otherSelected = true
                selectedGrade = nil
            } else {
                selectedGrade = option
                otherSelected = false
            }
        } label: {
            Text(isOther ? "Other" : "\(option!)")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(isSelected ? limeInk : .white.opacity(0.8))
                .frame(minWidth: 56)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(isSelected ? lime : Color.white.opacity(0.06))
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(isOther ? "gradeGoalsGrade_other" : "gradeGoalsGrade_\(option!)")
    }

    private func save() async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }

        let uid = Auth.auth().currentUser?.uid
        let trimmedGoals = goalsText.trimmingCharacters(in: .whitespacesAndNewlines)

        // "Other" (adults, teachers, anyone outside 6-12) deliberately
        // writes NO grade field at all - the schema is a real school-grade
        // number (generate-lesson-outline.ts pitches vocabulary/rigor by
        // it), and a sentinel value would just be a wrong grade rather
        // than an honest "not applicable." Their real context lives in
        // goals.text instead, which the model reads as free-text framing.
        if let uid {
            var patch: [String: Any] = [:]
            if let selectedGrade { patch["grade"] = selectedGrade }
            if !trimmedGoals.isEmpty { patch["goals"] = ["tags": [], "text": trimmedGoals] }
            if !patch.isEmpty {
                try? await Firestore.firestore().collection("users").document(uid).setData(patch, merge: true)
            }
        }
        StudentGradeGoalsPreference.hasChosen = true
        onDone()
    }
}

/// UserDefaults-backed "have we shown this once" gate, same shape as
/// StudentVoicePreference/StudentLanguagePreference - the actual grade/
/// goals VALUES live in Firestore (account data, cross-device), only
/// whether the screen has been shown lives locally.
enum StudentGradeGoalsPreference {
    private static let chosenKey = "studentGradeGoalsChosen"

    static var hasChosen: Bool {
        get { UserDefaults.standard.bool(forKey: chosenKey) }
        set { UserDefaults.standard.set(newValue, forKey: chosenKey) }
    }
}
