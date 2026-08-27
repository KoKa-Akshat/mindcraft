import SwiftUI

/// Full-screen host for a live-generated practice session - owns
/// `GeneratedPracticeStore`, N-of-M navigation, and the loading/error
/// states the static-bank `PracticeSessionView` never needed (its
/// `questions` array is always available synchronously). Entirely separate
/// screen and state from `PracticeSessionView` by design - see
/// `GeneratedPracticeStore`'s own doc comment.
struct GeneratedPracticeView: View {
    let conceptId: String
    let conceptLabel: String
    let level: Int
    var examType: String? = nil
    var onClose: () -> Void

    @StateObject private var store = GeneratedPracticeStore()
    @State private var selectedIndex = 0

    var body: some View {
        VStack(spacing: 0) {
            header
            content
        }
        .background(Color.white.ignoresSafeArea())
        .task {
            store.start(conceptId: conceptId, level: level, examType: examType)
        }
        .accessibilityIdentifier("generatedPracticeView")
    }

    private var header: some View {
        HStack {
            Text(conceptLabel)
                .font(.system(size: 15, weight: .bold, design: .rounded))
            Spacer()
            if !store.questions.isEmpty {
                // "+" while more are still generating - the loaded-so-far
                // count is real, the eventual total isn't known until the
                // second call lands.
                Text("Question \(selectedIndex + 1) of \(store.questions.count)\(store.isLoadingMore ? "+" : "")")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(.secondary)
            }
            Button("Done", action: onClose)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .accessibilityIdentifier("generatedPracticeDone")
        }
        .padding(16)
    }

    @ViewBuilder
    private var content: some View {
        if let error = store.errorMessage, store.questions.isEmpty {
            errorState(error)
        } else if store.questions.isEmpty {
            loadingState
        } else {
            VStack(spacing: 0) {
                GeneratedQuestionView(question: store.questions[selectedIndex])
                    .id(store.questions[selectedIndex].id)
                navRow
            }
        }
    }

    private var loadingState: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("Building your \(conceptLabel) practice…")
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Text(message)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Try again") {
                store.start(conceptId: conceptId, level: level, examType: examType)
            }
            .font(.system(size: 14, weight: .bold, design: .rounded))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var navRow: some View {
        HStack {
            Button("Back") { selectedIndex = max(0, selectedIndex - 1) }
                .disabled(selectedIndex == 0)
            Spacer()
            if selectedIndex < store.questions.count - 1 {
                Button("Next") { selectedIndex += 1 }
                    .accessibilityIdentifier("generatedPracticeNext")
            } else if store.isLoadingMore {
                HStack(spacing: 6) {
                    ProgressView().scaleEffect(0.7)
                    Text("More loading…")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)
                }
            }
        }
        .font(.system(size: 14, weight: .bold, design: .rounded))
        .padding(16)
    }
}
