import Foundation

/// Owns the progressively-arriving question set for a live-generated
/// practice session. Deliberately separate from `PracticeSessionView`'s own
/// `questions` (a plain synchronous computed property with no loading
/// state) rather than refactoring it - that computed property is shared
/// with `WeeklyReviewWalkthroughView` and backs the well-tested static-bank
/// flow, which stays completely untouched by this.
@MainActor
final class GeneratedPracticeStore: ObservableObject {
    @Published private(set) var questions: [GeneratedQuestionWire] = []
    @Published private(set) var isLoadingMore = false
    @Published private(set) var errorMessage: String?

    private var loadTask: Task<Void, Never>?

    func start(conceptId: String, level: Int, examType: String? = nil, total: Int = 8, bridgeFrom: String? = nil) {
        loadTask?.cancel()
        questions = []
        errorMessage = nil
        isLoadingMore = total > 1

        loadTask = Task {
            let result = await GeneratedQuestionsClient.requestProgressive(
                conceptId: conceptId, level: level, examType: examType, total: total, bridgeFrom: bridgeFrom
            ) { [weak self] first in
                self?.questions = first
            }
            guard !Task.isCancelled else { return }
            if let result {
                questions = result
            } else if questions.isEmpty {
                errorMessage = "Couldn't generate questions for this topic right now - try again in a moment."
            }
            isLoadingMore = false
        }
    }

    deinit {
        loadTask?.cancel()
    }
}
