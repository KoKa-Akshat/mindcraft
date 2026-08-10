import SwiftUI

/// Legacy XCUITest-only harness screen. NOT part of the real app's
/// navigation. `MindCraftNotesApp.swift`'s `AuthGate` is the real root for
/// every normal launch; this view only ever renders behind the explicit
/// `--ui-testing-content-view` launch argument (see that file's own doc
/// comment), which the tracked `MindCraftNotes.xcscheme` does not set -
/// confirmed directly, round 9, in response to Akshat's live report of
/// seeing a "Q1/Q2/Q3/Q4/Q5" pill-button row at the top of a question
/// screen. The REAL production question flow
/// (`DashboardView` → `PracticeSessionView` → `QuestionView`) has carried
/// no such picker since round 7, which replaced an early prototype's own
/// segmented question-switcher with the current prev/next "Question N of M"
/// navigator specifically because a segmented control broke visibly past a
/// few items (`PracticeSessionView.questionNav`'s own doc comment) - so this
/// file is very likely what Akshat actually saw, reached either via a
/// manually-toggled Xcode scheme launch argument or a build installed before
/// that round 7 fix, not a live bug in the current source.
///
/// Hardened anyway, round 9: the question-switcher `Picker` moved from a
/// full-width block sitting above the question (exactly "a row of pill
/// buttons at the very top") into the navigation bar's toolbar - same
/// segmented control, same accessible "Q1".."Q5" labels the 6 legacy
/// XCUITests that still exercise this harness depend on
/// (`app.buttons["Q2"].tap()` etc. in `MindCraftNotesUITests.swift`), just
/// compact nav-bar chrome instead of prominent inline UI, so even a
/// mistaken launch through this path no longer looks like a real feature.
struct ContentView: View {
    @StateObject private var store = DrawingStore()
    @State private var selectedIndex = 0

    private let questions = SampleQuestion.all

    var body: some View {
        NavigationStack {
            QuestionView(question: questions[selectedIndex], store: store)
                .navigationTitle("MindCraft Notes")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        Picker("Question", selection: $selectedIndex) {
                            ForEach(Array(questions.enumerated()), id: \.offset) { index, question in
                                Text("Q\(index + 1)").tag(index)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 320)
                    }
                }
        }
    }
}

#Preview {
    ContentView()
}
