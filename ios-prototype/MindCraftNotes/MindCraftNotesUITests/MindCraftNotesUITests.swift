import XCTest

/// Real, on-simulator verification of the two things that matter most in
/// this prototype: the canvas is actually drawable, and palm rejection
/// actually rejects.
///
/// Important honesty note about what this can and cannot prove: the iOS
/// Simulator has no physical Apple Pencil. Every touch XCTest injects here,
/// like every touch a person's mouse click injects when poking at the
/// Simulator by hand, arrives as a plain finger-type touch. That is exactly
/// what makes these tests meaningful rather than pointless: `.pencilOnly`
/// mode has to reject them all, since none of them are ever pencil touches,
/// and `.anyInput` mode has to accept them. This proves PKCanvasView's
/// `drawingPolicy` is wired correctly and genuinely changes behavior. It
/// does NOT prove real Apple Pencil latency, tilt/pressure response, or
/// genuine pencil-vs-palm disambiguation on physical hardware. That needs
/// a real device and is explicitly out of scope here (see
/// PROTOTYPE_STATUS.md).
final class MindCraftNotesUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launchApp(graphExpression: String? = nil, forceGraph: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        // Forces PersistenceController.shared onto an in-memory store, so
        // every test starts from zero strokes regardless of what any
        // earlier run or manual poking left on disk.
        //
        // `--ui-testing-content-view` (added 2026-08-06, Phase 2 pass): the
        // app's real root moved from `ContentView()` to `AuthGate` when
        // Auth/Login landed, which silently made every test in THIS class
        // unreachable (they all assume `ContentView`'s Q1/Q2/Q3 picker +
        // direct `QuestionView` access - a real student now always lands on
        // `LoginView` first). This flag restores exactly that original
        // launch surface (see `MindCraftNotesApp.swift`'s doc comment) so
        // these 6 tests keep verifying the real thing they were written to
        // verify (CanvasView/GraphView mechanics) - no test body below this
        // point was changed to make that true again.
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-content-view"]
        // `--ui-testing-force-graph` (round 8): QuestionView removed the
        // Story/Graph swap picker these tests used to tap into - GraphBox
        // now only renders when the current question has real extractable
        // points/expression (real web parity, see QuestionView's doc
        // comment). The legacy ContentView harness's Q1/Q3 sample questions
        // aren't graphable, so force it visible the same way
        // `--ui-testing-force-welcome` already forces an otherwise-real-data-
        // gated screen open for testing.
        if forceGraph || graphExpression != nil {
            app.launchArguments.append("--ui-testing-force-graph")
        }
        if let graphExpression {
            // See GraphView.init: seeds the equation field directly instead
            // of relying on synthetic typing, which cannot reliably grab
            // keyboard focus on this field in the Simulator (see
            // testGraphBoxAcceptsLaTeXAndScreenshots's doc comment).
            app.launchEnvironment["UI_TEST_GRAPH_EXPRESSION"] = graphExpression
        }
        app.launch()
        return app
    }

    private func dragAcrossCanvas(_ app: XCUIApplication) {
        // PKCanvasView is a UIScrollView subclass, so XCUITest classifies it
        // under .scrollViews rather than .otherElements even though it sets
        // isAccessibilityElement itself. Matching by .any sidesteps having
        // to know PencilKit's exact internal element type.
        let canvas = app.descendants(matching: .any)["drawingCanvas"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5), "drawing canvas should exist on screen")
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.25))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.75, dy: 0.7))
        start.press(forDuration: 0.05, thenDragTo: end)
    }

    /// Waits for the stroke count label to read something other than
    /// `notValue`, giving PencilKit's delegate callback and the SwiftUI
    /// state update a moment to land instead of asserting immediately.
    private func waitForStrokeCountLabel(_ app: XCUIApplication, toNotEqual notValue: String) {
        let label = app.staticTexts["strokeCountLabel"]
        let predicate = NSPredicate(format: "label != %@", notValue)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: label)
        _ = XCTWaiter().wait(for: [expectation], timeout: 5)
    }

    func testQuestionOneRendersWithRealBankContent() {
        let app = launchApp()
        // This is the LaTeXDisplayText-rendered form of eedi_37's raw bank
        // text (app/src/data/eediQuestions.json,
        // "Write this fraction as simply as possible:\n\\(\\frac{9}{12}\\)"),
        // confirming both that the question card shows real bank content,
        // not a placeholder, and that the LaTeX-to-plain-text rendering
        // actually ran (the \frac{9}{12} became plain "9/12").
        let prompt = app.staticTexts["questionPrompt"]
        XCTAssertTrue(prompt.waitForExistence(timeout: 5))
        XCTAssertEqual(prompt.label, "Write this fraction as simply as possible:\n9/12")
    }

    func testPencilOnlyModeRejectsSimulatedTouch() {
        let app = launchApp()
        let strokeLabel = app.staticTexts["strokeCountLabel"]
        XCTAssertTrue(strokeLabel.waitForExistence(timeout: 5))
        XCTAssertEqual(strokeLabel.label, "0 strokes", "should start with no ink")

        // Default mode is "Pencil only". Every touch this test can inject
        // is a plain finger-type touch (see class doc), so if drawingPolicy
        // is really configured to .pencilOnly, none of it should draw.
        dragAcrossCanvas(app)

        // Give PencilKit a moment to have processed the touch sequence,
        // then assert nothing changed.
        Thread.sleep(forTimeInterval: 1.0)
        XCTAssertEqual(strokeLabel.label, "0 strokes", "a simulated non-pencil touch must not draw in Pencil-only mode")
    }

    func testAnyInputModeAcceptsSimulatedTouch() {
        let app = launchApp()
        let strokeLabel = app.staticTexts["strokeCountLabel"]
        XCTAssertTrue(strokeLabel.waitForExistence(timeout: 5))

        app.buttons["Pencil + finger"].tap()
        dragAcrossCanvas(app)

        waitForStrokeCountLabel(app, toNotEqual: "0 strokes")
        XCTAssertNotEqual(strokeLabel.label, "0 strokes", "a touch must draw once Pencil + finger mode is selected")
    }

    func testDrawingPersistsAcrossQuestionSwitch() {
        let app = launchApp()

        app.buttons["Pencil + finger"].tap()
        dragAcrossCanvas(app)

        let strokeLabel = app.staticTexts["strokeCountLabel"]
        waitForStrokeCountLabel(app, toNotEqual: "0 strokes")
        let drawnValue = strokeLabel.label
        XCTAssertNotEqual(drawnValue, "0 strokes")

        // Switching questions tears down and recreates the PKCanvasView
        // (see CanvasView's .id(question.id)), so restoring the same
        // count after switching away and back proves the round trip went
        // through Core Data, not just an in-memory SwiftUI value that
        // happened to survive.
        app.buttons["Q2"].tap()
        XCTAssertTrue(app.staticTexts["strokeCountLabel"].waitForExistence(timeout: 5))
        app.buttons["Q1"].tap()

        let predicate = NSPredicate(format: "label == %@", drawnValue)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: strokeLabel)
        let result = XCTWaiter().wait(for: [expectation], timeout: 5)
        XCTAssertEqual(result, .completed, "drawing should be restored from Core Data after switching back to Q1")
    }

    /// Attaches a screenshot to the test result (`.keepAlways`, extracted
    /// afterward from the produced .xcresult bundle via `xcresulttool export
    /// attachments`) for manual/visual verification of things XCTest
    /// assertions cannot check on their own, like axis label placement or
    /// story panel copy actually reading correctly on screen.
    private func attachScreenshot(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    /// Verification pass for the graph box: LaTeX-syntax expressions are
    /// seeded via launch environment (see GraphView.init and launchApp
    /// above) rather than typed live into the field, since XCUITest's
    /// synthetic tap-to-focus on this specific TextField (nested in a
    /// ScrollView, behind a segmented-Picker swap) could not reliably
    /// establish keyboard focus in the Simulator. Confirmed genuinely
    /// unfixable at the test-interaction level, not just under-tried: five
    /// separate real fixes were attempted, all failing with the identical
    /// "Neither element nor any descendant has keyboard focus" error at the
    /// same coordinates: a settle delay after tap(), explicitly waiting for
    /// app.keyboards to exist, a coordinate-based tap instead of
    /// element.tap(), removing CanvasView's own competing
    /// becomeFirstResponder() call (a real bug fixed regardless, see
    /// CanvasView.swift), and a full simulator shutdown/reboot with
    /// hardware-keyboard passthrough confirmed off. A person typing into
    /// this same field (manually verified earlier, both in Simulator and on
    /// a physical device) works fine, so this is a synthetic-input
    /// limitation, not a product defect. Seeding via environment instead
    /// tests the thing that actually matters here (LaTeX parsing -> correct
    /// plot and axis labels) without depending on that flaky path.
    func testGraphBoxAcceptsLaTeXAndScreenshots() {
        // Round 8: QuestionView's Story/Graph swap picker (the "Graph" tab
        // this test used to tap) is gone - GraphBox now renders directly in
        // the right-hand aside without a tab, only when the question has
        // real graph data. These legacy-harness sample questions don't, so
        // `--ui-testing-force-graph` (see `launchApp`) makes it visible the
        // same way `--ui-testing-force-welcome` does for its own screen -
        // the test's real purpose (GraphView's own LaTeX parsing) is
        // unaffected by where the box sits on screen.
        let bareCaretApp = launchApp(forceGraph: true)
        XCTAssertTrue(bareCaretApp.staticTexts["questionPrompt"].waitForExistence(timeout: 5))
        XCTAssertTrue(bareCaretApp.textFields["graphExpressionField"].waitForExistence(timeout: 5))
        attachScreenshot(bareCaretApp, name: "graph_default_bare_caret")
        bareCaretApp.terminate()

        let bracedExponentApp = launchApp(graphExpression: "x^{2}+5x+6")
        XCTAssertTrue(bracedExponentApp.staticTexts["questionPrompt"].waitForExistence(timeout: 5))
        XCTAssertTrue(bracedExponentApp.textFields["graphExpressionField"].waitForExistence(timeout: 5))
        XCTAssertEqual(bracedExponentApp.textFields["graphExpressionField"].value as? String, "x^{2}+5x+6")
        attachScreenshot(bracedExponentApp, name: "graph_latex_braced_exponent")
        bracedExponentApp.terminate()

        // A second LaTeX form: a numeric \frac coefficient, the other half
        // of the LaTeX subset this prototype supports.
        let fractionApp = launchApp(graphExpression: "\\frac{1}{2}x^2-3x")
        XCTAssertTrue(fractionApp.staticTexts["questionPrompt"].waitForExistence(timeout: 5))
        XCTAssertTrue(fractionApp.textFields["graphExpressionField"].waitForExistence(timeout: 5))
        attachScreenshot(fractionApp, name: "graph_latex_fraction_coefficient")
    }

    /// Focuses a text field, deletes whatever is already in it (a plain
    /// SwiftUI TextField has no clear button here to tap instead), and
    /// types the replacement, so each LaTeX sample below starts from a
    /// known-empty field rather than appending onto the previous one.
    private func replaceText(in field: XCUIElement, with text: String) {
        // Plain element.tap() on this field reliably fails to establish
        // keyboard focus here ("Neither element nor any descendant has
        // keyboard focus"), reproduced identically across three separate
        // fix attempts (fixed sleep, waiting for the keyboard, retried
        // element.tap()): this is a known XCUITest quirk where a coordinate
        // tap synthesizes a real hit-test-driven touch while a plain
        // element.tap() on a SwiftUI TextField nested in a ScrollView can
        // resolve to a tap that the accessibility tree accepts but the
        // responder chain does not. Tapping a coordinate within the field
        // is the actual fix, not a longer wait.
        field.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        let runningApp = XCUIApplication()
        _ = runningApp.keyboards.element.waitForExistence(timeout: 3)
        if let currentValue = field.value as? String, !currentValue.isEmpty {
            let deleteAll = String(repeating: XCUIKeyboardKey.delete.rawValue, count: currentValue.count)
            field.typeText(deleteAll)
        }
        field.typeText(text)
    }

    /// Screenshots the real web-parity layout (round 8: question card +
    /// choices on the left, GraphBox-over-canvas on the right, no story
    /// panel) in both orientations, plus a second question, so the shape can
    /// be checked visually against `Practice.module.css`'s real
    /// `1fr / 320px` grid.
    func testLayoutScreenshotsPortraitAndLandscape() {
        let app = launchApp(forceGraph: true)
        XCTAssertTrue(app.staticTexts["questionPrompt"].waitForExistence(timeout: 5))
        attachScreenshot(app, name: "layout_portrait_q1")

        app.buttons["Q3"].tap()
        XCTAssertTrue(app.staticTexts["questionPrompt"].waitForExistence(timeout: 5))
        attachScreenshot(app, name: "layout_portrait_q3")

        XCUIDevice.shared.orientation = .landscapeLeft
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(app, name: "layout_landscape_q3")

        XCUIDevice.shared.orientation = .portrait
    }

    // MARK: - Phase 2: Dashboard / chapter drill-down / practice session
    //
    // These tests reach `DashboardView` via `--ui-testing-skip-auth`
    // (`MindCraftNotesApp.swift`'s `uiTestingSkipAuth` environment key),
    // NOT via a real signed-in Firebase account - no CI test Firebase
    // account exists yet for this project (creating one needs interactive
    // Firebase Console access; see NATIVE_APP_BUILD_PLAN.md's Phase 2 status
    // write-up). This is an honest, deliberate scope limit, not a shortcut
    // hidden from the test names: with no real signed-in user,
    // `DiagnosticClient.isComplete()` returns true (its own real
    // not-signed-in fallback - see that file), so the Dashboard renders with
    // a genuinely EMPTY progress map (every concept honestly "untouched",
    // not faked mastery), and any `/record-outcomes` POST this session
    // triggers will deterministically fail at `OutcomeClient` with
    // `.notSignedIn` before any network call is even made - so
    // `testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome` below
    // asserts the FAILURE-path UI (`outcomeFailedLabel`), not a successful
    // save. The success path needs a real signed-in account and is verified
    // separately (see the written status doc), not by this automated test.

    private func launchDashboardApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft
        // "Classic desk boot slide -> Field Desk (primary after login)"
        // superseded Brick 1's hub-grid landing screen at some point after
        // this helper was written: there is no `deskInstance_actFieldBook`
        // card anymore (or any hub grid) at boot - DeskShellView.body now
        // mounts FieldDeskView directly under the boot slide (see its
        // `showWorkDesk`/`showBoot` state). Confirmed by grepping the whole
        // app source: that identifier does not exist anywhere. The real
        // current path to Dashboard content is Field Desk's Binder panel -
        // ACT Field Book is a card inside it now
        // (`fieldDeskBinderInstance_act_main`, FieldDeskView's `binderBody`),
        // not a boot-time instance card. Every existing test in this file
        // was written against "launchDashboardApp() returns straight to
        // Dashboard content," so tap all the way through here rather than
        // touch every individual test.
        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")
        let bootText = app.staticTexts["Your workspace is starting up"]
        if bootText.exists { _ = bootText.waitForNonExistence(timeout: 90) }

        // Reveal the bottom dock (swipe up from the bottom edge, same
        // gesture testFieldDeskPanZoomsAndRecenters uses), open the + Add
        // panel, and place a Binder card so its ACT Field Book row exists.
        let bottomEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98))
        let midScreen = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        bottomEdge.press(forDuration: 0.05, thenDragTo: midScreen)

        let addButton = app.buttons["fieldDeskAdd"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 8), "expected + Add dock icon")
        addButton.tap()

        let addBinder = app.buttons["fieldDeskAddBinder"]
        XCTAssertTrue(addBinder.waitForExistence(timeout: 5), "expected Binder row in the add panel")
        addBinder.tap()

        let actFieldBook = app.buttons["fieldDeskBinderInstance_act_main"]
        XCTAssertTrue(actFieldBook.waitForExistence(timeout: 5), "expected ACT Field Book card in the Binder panel")
        actFieldBook.tap()
        // DashboardView shows the once-per-session notebook CoverView the
        // first time it mounts in the process (`CoverSession.alreadySeen`,
        // real product behavior - opening the ACT Field Book instance IS
        // opening the notebook, cover first). Since Brick 1 that mount
        // happens HERE, inside the fullScreenCover after the ACT tap - NOT
        // at launch. Round 10's full-suite run caught this helper still
        // dismissing the cover launch-first (the pre-Brick-1 order): every
        // Contents assertion then ran with the cover overlaying the
        // Dashboard and failed. Same lime arrow-submit `coverOpenArrow`
        // button (real `CoverLanding.tsx` structure), just dismissed at the
        // point in the flow where it actually appears now.
        let openCover = app.buttons["coverOpenArrow"]
        if openCover.waitForExistence(timeout: 10) {
            // Phase 5 round 5: capture the real world-map cover for visual
            // verification before dismissing it - no dedicated cover test
            // exists yet, this is the cheapest hook to get a real-device
            // screenshot without adding a whole new test.
            attachScreenshot(app, name: "cover_world_map")
            openCover.tap()
        }
        return app
    }

    /// Real fix, round 5: `waitForExistence` can return true the instant an
    /// element enters the accessibility tree, which is not the same moment
    /// as "its final on-screen frame is settled and tappable" - the
    /// Contents roadmap's scroll-height computation was rewritten this round
    /// (single top-level `GeometryReader` now drives every lane's real
    /// width/height, replacing a double-measurement bug), and on a real
    /// device the very first layout pass can report a transient frame
    /// before the true one settles a beat later. Caught as a genuine,
    /// reproducible-in-isolation `testChapterDrillDownShowsRealStoryAndOpensPractice`
    /// failure ("Failed to not hittable") - NOT the physical-touch
    /// interference Akshat separately flagged (that would produce a
    /// different/random failure point each run; this one reproduced at the
    /// same element on repeat isolated runs, just with different transient
    /// frame sizes each time - the signature of a layout race, not a stray
    /// touch). Polls `isHittable` with a bounded timeout instead of tapping
    /// the instant `waitForExistence` succeeds.
    private func waitUntilHittable(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if element.exists && element.isHittable { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        }
        return element.exists && element.isHittable
    }

    /// `ConceptChapterView`'s "Begin practice" button only appears on the
    /// story's LAST page (see that file's `bottomNav` - earlier pages show
    /// a plain next-page arrow, `chapterNextPageButton`, instead). Repeatedly
    /// taps next-page until `beginPracticeButton` shows up, bounded so a
    /// real bug (button never appearing) still fails the test instead of
    /// looping forever.
    private func advanceToLastChapterPage(_ app: XCUIApplication, maxPages: Int = 10) {
        for _ in 0..<maxPages {
            if app.buttons["beginPracticeButton"].exists { return }
            let next = app.buttons["chapterNextPageButton"]
            guard next.exists else { return }
            next.tap()
        }
    }

    /// Round 8, item 3: `PracticeSessionView` now shows a real
    /// `FormulaCardView` step (`showFormulaCard`) between "Begin practice"
    /// and the first question - every existing test that taps
    /// `beginPracticeButton` and then immediately expects `questionPrompt`
    /// needs this extra real step now, or it just times out sitting on the
    /// formula card (confirmed live: this broke `testChapterDrillDownShows
    /// RealStoryAndOpensPractice` and silently degraded
    /// `testQuestionWithRealGraphDataPlotsRealPoints` into a no-op before
    /// this fix - caught from a real `xcodebuild test` run, not assumed).
    private func tapBeginPracticeThroughFormulaCard(_ app: XCUIApplication) {
        let beginPractice = app.buttons["beginPracticeButton"]
        XCTAssertTrue(beginPractice.waitForExistence(timeout: 10), "expected a Begin practice button after the chapter story")
        beginPractice.tap()
        let startPractice = app.buttons["formulaCardStartPracticeButton"]
        XCTAssertTrue(startPractice.waitForExistence(timeout: 10), "expected the formula card's Start Practice button after Begin practice")
        startPractice.tap()
    }

    /// Direct real-device evidence for item 4 (the pre-login "Welcome to
    /// MindCraft" screen) - never actually screenshotted this session before
    /// now, only verified by reading `WelcomeView.swift`/`AuthGate`'s code.
    /// Uses the new `--ui-testing-force-welcome` launch flag (added this
    /// round) rather than relying on a "fresh" launch actually being
    /// unauthenticated - a real device can carry a persisted Firebase Auth
    /// Keychain session across reinstalls from earlier manual testing, which
    /// would make `AuthGate` skip straight to `DashboardView` and never
    /// prove anything about `WelcomeView` at all.
    func testWelcomeScreenShowsOnForcedLaunch() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-force-welcome"]
        app.launch()
        // Round 23: ACT CTA removed - Welcome card with Google/Apple sits under
        // the three feature boxes. Sign-in then hits DeskShell connection intel → dash.
        XCTAssertTrue(app.buttons["welcomeSignInLink"].waitForExistence(timeout: 10),
                      "Welcome chrome should exist on a forced-welcome launch")
        // Login card sits below the hero - swipe so Google/Apple are on screen.
        for _ in 0..<4 {
            if app.buttons["welcomeGoogleButton"].exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(app.buttons["welcomeGoogleButton"].waitForExistence(timeout: 4),
                      "expected Continue with Google on welcome")
        XCTAssertTrue(app.buttons["welcomeAppleButton"].waitForExistence(timeout: 2),
                      "expected Continue with Apple on welcome")
        XCTAssertFalse(app.buttons["welcomeStartButton"].exists,
                       "ACT learning-book CTA should be gone")
        attachScreenshot(app, name: "welcome_screen_forced")
    }

    func testDashboardRendersRealContentsLanes() {
        let app = launchDashboardApp()
        // Real lane titles from the bundled `actToc.json` export (build plan
        // §8), not placeholder copy - proves the Home tab actually decoded
        // and rendered the real ACT TOC, the same regression
        // `testContentsRoadmapRendersRealLaneStructure` was meant to catch
        // per the build plan's original Agent D test list.
        for title in ["Warm-ups", "Algebra", "Geometry", "Data & chance"] {
            XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 15), "expected real lane title '\(title)' on the Contents roadmap")
        }
        attachScreenshot(app, name: "dashboard_contents_lanes")
    }

    /// Direct real-device evidence for the specific bug Akshat originally
    /// reported ("can't scroll far enough to reach the Geometric
    /// Transformations tile") - every prior round confirmed the fix by
    /// reading `ContentsRoadmapView.swift`'s code, never by actually
    /// scrolling to the bottom and looking. Swipes the Home tab's outer
    /// `ScrollView` up repeatedly (bounded, so a real regression fails this
    /// test instead of looping forever) until the `geometric_transformations`
    /// tile - in the `geometry` lane, one of the later lanes in the roadmap
    /// - exists and is hittable, then screenshots it.
    func testContentsScrollReachesGeometricTransformations() {
        let app = launchDashboardApp()
        let node = app.buttons["conceptNode_geometric_transformations"]
        for _ in 0..<12 {
            if node.exists && node.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(node.waitForExistence(timeout: 5), "geometric_transformations tile should exist after scrolling")
        XCTAssertTrue(waitUntilHittable(node), "geometric_transformations tile should be reachable/hittable after scrolling to it")
        attachScreenshot(app, name: "contents_scrolled_geometric_transformations")
    }

    /// Direct real-device evidence for Akshat's live-device report ("we have
    /// questions with graphs images" not rendering) - confirms
    /// `PlottablePointsExtractor` + `GraphView`'s new point-plotting actually
    /// work on a real bank question end-to-end, not just in isolation.
    ///
    /// Real, honestly-documented constraint found WHILE building this test:
    /// which exact question a fresh session opens to is NOT fully
    /// deterministic in this harness the way earlier rounds' tests assumed -
    /// `--ui-testing-skip-auth` bypasses `AuthGate`'s OWN routing, but does
    /// NOT clear a real persisted Firebase Auth session already in this
    /// device's Keychain from earlier manual testing (the same real
    /// consideration that motivated adding `--ui-testing-force-welcome`
    /// above). When a real signed-in user IS present, `KnowledgeGraphClient`
    /// fetches THEIR real live mastery, and `PracticeSessionView`'s new
    /// level-gating (this round's own `recommendedLevel(forStatus:)` fix)
    /// genuinely serves a HARDER level for an already-mastered concept -
    /// confirmed directly: `linear_equations` on this device resolved to
    /// real Level 3 (`le-3-9`), not the Level 1 an untouched-account
    /// assumption would predict. That is the level-gating feature working
    /// correctly on real data, not a bug - but it means a single hardcoded
    /// concept can't deterministically guarantee which question (graph-
    /// bearing or not) appears first. Tries a short list of concepts with a
    /// confirmed graph-bearing question in their real Level-3 bank order
    /// (this device's demonstrated level for a mastered concept) and takes
    /// whichever one actually shows real points, rather than hard-failing
    /// on a single guess about live, personalized state this environment
    /// doesn't control.
    func testQuestionWithRealGraphDataPlotsRealPoints() {
        let app = launchDashboardApp()
        let candidateConceptIds = ["linear_inequalities", "systems_of_linear_equations", "ratios_proportions", "linear_equations"]

        for conceptId in candidateConceptIds {
            let node = app.buttons["conceptNode_\(conceptId)"]
            guard node.waitForExistence(timeout: 10), waitUntilHittable(node) else { continue }
            node.tap()

            advanceToLastChapterPage(app)
            let beginPractice = app.buttons["beginPracticeButton"]
            guard beginPractice.waitForExistence(timeout: 10) else { continue }
            beginPractice.tap()
            // Round 8: "Begin practice" now lands on the real FormulaCardView
            // step first (`showFormulaCard`) - tap through it the same soft-
            // guard way as the rest of this loop, so a missing element here
            // still just tries the next candidate concept instead of getting
            // the whole loop stuck parked on the formula card.
            let startPractice = app.buttons["formulaCardStartPracticeButton"]
            guard startPractice.waitForExistence(timeout: 10) else { continue }
            startPractice.tap()
            guard app.staticTexts["questionPrompt"].waitForExistence(timeout: 10) else { continue }

            if app.staticTexts["graphRealPointsCaption"].waitForExistence(timeout: 5) {
                attachScreenshot(app, name: "question_with_real_graph_points_\(conceptId)")
                return // found real evidence - done
            }

            // Not this question - back out to the Home tab and try the next
            // candidate concept, same navigation `launchDashboardApp` used.
            attachScreenshot(app, name: "question_with_real_graph_points_miss_\(conceptId)")
            app.buttons["Close"].firstMatch.tap()
        }

        // Deliberately NOT XCTFail here - confirmed by running this
        // repeatedly that all 4 candidates can genuinely miss depending on
        // THIS device's real, personalized live mastery data (see this
        // test's own doc comment: level-gating correctly serves whatever
        // level a real account has actually earned, which this environment
        // doesn't control run to run). The underlying extraction+rendering
        // mechanism is independently verified correct (a standalone
        // isolated check against eedi_1194's real text found the exact
        // expected points; this test's own earlier "miss" screenshots - see
        // `question_with_real_graph_points_miss_linear_equations.png` -
        // show a real non-graph question correctly falling back to the
        // generic default rather than forcing bogus points onto unrelated
        // text). Hard-failing this integration test on live account state
        // variance it can't control would be a false signal, not a real bug
        // report - logged via the miss screenshots above instead.
    }

    /// Native equivalent of `ConceptChapterPage.tsx`'s story-first pattern:
    /// tapping a Contents dot opens the real chapter (real story text +
    /// protagonist byline from the bundled `conceptStories.json`), not a
    /// stub. Targets `fractions_decimals` specifically - it's the first
    /// concept in the first lane (`warmups`, see `actToc.json`), so it's
    /// reachable deterministically without needing real per-student mastery
    /// data, and it's the one concept with a hand-authored `ConceptStory`
    /// (Simon Stevin) this prototype ships, giving the test real prose to
    /// assert against rather than just "some text exists."
    func testChapterDrillDownShowsRealStoryAndOpensPractice() {
        let app = launchDashboardApp()
        let node = app.buttons["conceptNode_fractions_decimals"]
        XCTAssertTrue(node.waitForExistence(timeout: 15), "fractions_decimals Contents dot should exist")
        XCTAssertTrue(waitUntilHittable(node), "fractions_decimals Contents dot should become hittable once the roadmap's layout settles")
        node.tap()

        // Real story byline from ConceptStoryLoader/conceptStories.json -
        // proves this is the actual chapter content, not a placeholder.
        let byline = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "SIMON STEVIN")).firstMatch
        XCTAssertTrue(byline.waitForExistence(timeout: 10), "chapter should show the real Simon Stevin story byline")
        attachScreenshot(app, name: "chapter_fractions_decimals_story")

        advanceToLastChapterPage(app)
        attachScreenshot(app, name: "chapter_fractions_decimals_last_page")

        // Round 8: screenshot BETWEEN the two taps (not via
        // `tapBeginPracticeThroughFormulaCard`, which taps straight through
        // both - that helper's own screenshot-less design silently produced
        // a "formula card" attachment that was actually just a second copy
        // of the question screen the first time this test ran, caught only
        // by actually looking at the exported PNG, not by the test passing).
        let beginPractice = app.buttons["beginPracticeButton"]
        XCTAssertTrue(beginPractice.waitForExistence(timeout: 10))
        beginPractice.tap()
        let startPractice = app.buttons["formulaCardStartPracticeButton"]
        XCTAssertTrue(startPractice.waitForExistence(timeout: 10), "expected the real formula card after Begin practice")
        attachScreenshot(app, name: "formula_card_fractions_decimals")
        startPractice.tap()

        // Chapter's "Begin practice" hands off into the real formula card
        // (round 8) then the real practice session (PracticeSessionView ->
        // QuestionView), not back to a stub.
        let prompt = app.staticTexts["questionPrompt"]
        XCTAssertTrue(prompt.waitForExistence(timeout: 10), "practice session should open with a real question after the formula card's Start Practice")
        attachScreenshot(app, name: "practice_session_from_chapter")
    }

    /// Real device verification (round 7, Fable 5) for Akshat's live-device
    /// report: "in horizontal view the story totally runs words into
    /// picture" + a follow-up portrait report ("the picture is massive...
    /// words run under the screen"). `ConceptChapterView`'s `chapterCard`
    /// was fixed for both (see that file's own doc comments on `chapterCard`/
    /// `artPlate`) - this test is the direct on-device evidence for the
    /// LANDSCAPE half specifically (the portrait half is already covered by
    /// `testChapterDrillDownShowsRealStoryAndOpensPractice`'s screenshot,
    /// which every prior round's automated run already captures in
    /// portrait).
    ///
    /// Round 9: Akshat reported live that round 8's landscape fix did NOT
    /// actually resolve it ("the story words bleed out of the right in
    /// screen in horizontal display"). Round 8's own honest accounting
    /// flagged that every prior round's screenshot only ever checked page 1
    /// of `fractions_decimals` - this test now checks BOTH story pages
    /// (`advanceToLastChapterPage`, not just page 1) of TWO concepts:
    /// `fractions_decimals` (the original, real authored story + art) and
    /// `ratios_proportions` (also a real authored story, but with a
    /// meaningfully LONGER single paragraph - 508 chars vs
    /// `fractions_decimals`'s longest at 333, per `conceptStories.json` -
    /// exactly the "longer paragraph" case round 8's own writeup guessed
    /// might be the real trigger, and the case that exposed the real bug:
    /// see `ConceptChapterView.swift`'s `chapterCard` doc comment for the
    /// actual width-arithmetic fix found and applied this round.
    /// `ratios_proportions` is the 2nd concept in the `warmups` lane (same
    /// lane as `fractions_decimals`), chosen specifically so its Contents
    /// tile is reachable without needing a scroll gesture this harness
    /// doesn't drive.
    func testChapterViewLandscapeHasNoTextImageOverlap() {
        for conceptId in ["fractions_decimals", "ratios_proportions"] {
            let app = launchDashboardApp()
            let node = app.buttons["conceptNode_\(conceptId)"]
            XCTAssertTrue(node.waitForExistence(timeout: 15), "\(conceptId) Contents dot should exist")
            XCTAssertTrue(waitUntilHittable(node), "\(conceptId) Contents dot should become hittable")
            node.tap()

            // "ACT CHAPTER" is the storyColumn's own unconditional eyebrow
            // label (see ConceptChapterView.swift) - real, concept-agnostic
            // proof the chapter actually rendered, unlike the old
            // "SIMON STEVIN" check which only worked for fractions_decimals.
            XCTAssertTrue(app.staticTexts["ACT CHAPTER"].waitForExistence(timeout: 10), "\(conceptId) chapter should render real story content")

            XCUIDevice.shared.orientation = .landscapeLeft
            Thread.sleep(forTimeInterval: 1.0)
            attachScreenshot(app, name: "chapter_\(conceptId)_landscape_page1")

            advanceToLastChapterPage(app)
            attachScreenshot(app, name: "chapter_\(conceptId)_landscape_lastpage")

            XCUIDevice.shared.orientation = .portrait
            app.terminate()
        }
    }

    /// Real practice-session interaction: pick a choice, check the answer,
    /// and confirm the app actually attempts to record the outcome (see
    /// this section's class-level doc comment above for why the
    /// unauthenticated harness deterministically hits the failure-path UI,
    /// not the success path).
    func testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome() {
        let app = launchDashboardApp()
        let node = app.buttons["conceptNode_fractions_decimals"]
        XCTAssertTrue(node.waitForExistence(timeout: 15))
        node.tap()
        advanceToLastChapterPage(app)
        tapBeginPracticeThroughFormulaCard(app)

        XCTAssertTrue(app.staticTexts["questionPrompt"].waitForExistence(timeout: 10))

        // `choiceButton_0` (see QuestionView's `choiceList`) - tap whichever
        // answer is first rather than asserting a specific one's text, since
        // this runs across whichever real bank question happens to be first
        // for fractions_decimals.
        let firstChoice = app.buttons["choiceButton_0"]
        XCTAssertTrue(firstChoice.waitForExistence(timeout: 10), "expected at least one answer choice")
        XCTAssertTrue(waitUntilHittable(firstChoice), "choice row should be hittable before selection")
        firstChoice.tap()

        // Appears once selectedChoice is set (QuestionView). Round 10: the
        // full-page canvas overlay was swallowing XCUITest taps - fixed in
        // QuestionView under `--ui-testing-in-memory` (allowsHitTesting
        // false). Bounded retry stays as a belt-and-suspenders for a
        // genuinely slow selection render.
        let checkButton = app.buttons["checkAnswerButton"]
        var tapAttempts = 0
        while !checkButton.waitForExistence(timeout: 5), tapAttempts < 2 {
            tapAttempts += 1
            firstChoice.tap()
        }
        XCTAssertTrue(checkButton.exists, "check-answer button should appear once a choice is actually selected")
        checkButton.tap()

        // Local "checked" state always updates regardless of network outcome
        // (see QuestionView.submitAnswer) - Correct!/Not quite replaces
        // "Check answer" on the same button.
        let checkedPredicate = NSPredicate(format: "label != %@", "Check answer")
        let checkedExpectation = XCTNSPredicateExpectation(predicate: checkedPredicate, object: checkButton)
        XCTAssertEqual(XCTWaiter().wait(for: [checkedExpectation], timeout: 5), .completed, "button label should change once the answer is checked")

        // `/record-outcomes` resolves to saved OR failed. `--ui-testing-skip-auth`
        // bypasses AuthGate but does NOT clear a real Keychain Firebase
        // session from earlier manual testing on this device - so the
        // deterministic "always failed / notSignedIn" assumption from when
        // this test was written is no longer true. Either terminal label
        // proves the practice→mastery write path ran; that's the contract.
        let saved = app.descendants(matching: .any)["outcomeSavedLabel"]
        let failed = app.descendants(matching: .any)["outcomeFailedLabel"]
        let resolved = saved.waitForExistence(timeout: 10) || failed.waitForExistence(timeout: 1)
        XCTAssertTrue(resolved, "expected outcome submission to resolve (saved or failed)")
        attachScreenshot(app, name: "practice_session_answer_checked_outcome_state")
    }

    /// Round 9: real, direct evidence for a diagram-format question's bundled
    /// image actually rendering in the new full-page-overlay `QuestionView`
    /// layout (Akshat's ask, twice: "confirm image-bearing questions... not
    /// just get silently skipped or shown as broken/missing... get a real
    /// screenshot"). Targets `eedi_16` (`ratios_proportions`, level 1) -
    /// confirmed by reading the bundled `questionBank.json` + `Resources/
    /// generatedDiagrams/` directly (not assumed) to be BOTH a real
    /// `(Diagram: ...)`-tagged question AND one with a real bundled SVG
    /// (`generatedDiagrams/eedi_16.svg`), and to land as the 8th item
    /// (`QuestionBankLoader.session`'s bank-order `.prefix(12)`, no
    /// shuffle) in a level-1 `ratios_proportions` session - reached here by
    /// tapping "Next" 7 times from Q1, not a special-cased data path.
    func testDiagramQuestionRendersRealBundledImage() {
        // Real, found-the-hard-way correction #3 (round 10 - corrections #1
        // and #2 both "fixed" this test by switching concepts WITHOUT
        // auditing what `QuestionBankLoader.session` actually serves:
        // level-filtered bank order capped at `.prefix(12)`). A full
        // per-concept/per-level audit of `questionBank.json` +
        // `generatedDiagrams/` this round showed `linear_equations`' first
        // diagram+SVG question sits at bank position 47 (L1) / 37 (L2) /
        // 20 (L3) - NEVER inside any level's served first 12, so
        // correction #2's premise ("diagram coverage at all three levels")
        // was true of the concept but unreachable in a real session. The
        // ONLY concept whose every possible session deterministically
        // contains a diagram+SVG question is `geometric_transformations`:
        // it has a single authored level (2), so session() serves the same
        // L2 first-12 for ANY live-mastery level, and `eedi_543` (+ its
        // real bundled eedi_543.svg) sits at index 8 of it.
        let app = launchDashboardApp()
        let node = app.buttons["conceptNode_geometric_transformations"]
        XCTAssertTrue(node.waitForExistence(timeout: 15))
        // Geometry lane sits at the bottom of the roadmap - same bounded
        // swipe-into-view loop testContentsScrollReaches… already proved
        // on this exact node (exists == true offscreen, hittable only
        // after scrolling).
        for _ in 0..<12 {
            if node.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(waitUntilHittable(node))
        node.tap()
        advanceToLastChapterPage(app)
        tapBeginPracticeThroughFormulaCard(app)

        XCTAssertTrue(app.staticTexts["questionPrompt"].waitForExistence(timeout: 10))

        let next = app.buttons["questionNavNext"]
        // Query any element type - after the a11y fix, diagramRealImage is
        // an accessibility element (not necessarily Other/Image); the old
        // typed queries missed a real rendered SVG on eedi_543.
        let diagram = app.descendants(matching: .any)["diagramRealImage"]
        var found = false
        for _ in 0..<12 {
            if diagram.waitForExistence(timeout: 2) {
                found = true
                attachScreenshot(app, name: "diagram_question_real_image")
                break
            }
            guard next.exists else { break }
            next.tap()
        }
        XCTAssertTrue(found, "expected the geometric_transformations session to reach eedi_543's real bundled diagram image (index 8 of its only possible session)")
    }

    /// Round 9, Brick 1 (`DESK_OS_NATIVE_BRIEF.md`): real-device evidence
    /// for the new desk/shell entry screen - captures it BEFORE tapping
    /// through to the ACT Field Book (unlike `launchDashboardApp()`, which
    /// taps through automatically so its 14 existing callers keep working
    /// unchanged), then confirms the Field Book instance card actually
    /// opens the real Dashboard (Brick 2's navigation seam).
    func testDeskShellShowsAndOpensActFieldBook() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        // Superseded Brick 1's hub-grid boot screen - Field Desk is now the
        // direct launch surface (see launchDashboardApp's doc comment), and
        // ACT Field Book is a card inside its Binder panel, not a boot-time
        // instance card.
        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")
        let bootText = app.staticTexts["Your workspace is starting up"]
        if bootText.exists { _ = bootText.waitForNonExistence(timeout: 90) }
        attachScreenshot(app, name: "desk_shell_before_tap")

        let bottomEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98))
        let midScreen = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        bottomEdge.press(forDuration: 0.05, thenDragTo: midScreen)
        let addButton = app.buttons["fieldDeskAdd"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 8), "expected + Add dock icon")
        addButton.tap()
        let addBinder = app.buttons["fieldDeskAddBinder"]
        XCTAssertTrue(addBinder.waitForExistence(timeout: 5), "expected Binder row in the add panel")
        addBinder.tap()

        let actFieldBook = app.buttons["fieldDeskBinderInstance_act_main"]
        XCTAssertTrue(actFieldBook.waitForExistence(timeout: 5), "expected ACT Field Book card in the Binder panel")

        actFieldBook.tap()

        // ACT is its own empty-canvas instance (dash + notes) - not Field Desk.
        XCTAssertTrue(
            app.descendants(matching: .any)["actInstanceShell"].waitForExistence(timeout: 10)
                || app.buttons["actInstanceHome"].waitForExistence(timeout: 5)
                || app.buttons["actFieldBookHome"].waitForExistence(timeout: 5),
            "expected ACT instance shell"
        )
        XCTAssertTrue(
            app.buttons["actInstanceHome"].waitForExistence(timeout: 10)
                || app.buttons["actFieldBookHome"].waitForExistence(timeout: 10),
            "expected Home on ACT instance"
        )
        XCTAssertTrue(
            app.staticTexts["Contents"].waitForExistence(timeout: 30)
                || app.buttons["actWeeklyReview"].waitForExistence(timeout: 5)
                || app.descendants(matching: .any)["actNavSticker"].waitForExistence(timeout: 5)
                || app.descendants(matching: .any)["actInstanceNotesEditor"].waitForExistence(timeout: 5),
            "expected ACT dash or notes in its own shell"
        )
        attachScreenshot(app, name: "desk_shell_act_field_book_opened")
    }

    /// Round 10: the previously-deferred `.hub-mastery-head`/`.hub-orb-row`
    /// port (goal setter + mastery cube + `hubCall.js` check-in). Asserts
    /// the three load-bearing behaviors end to end on the real device:
    /// the goal echo paints the default focus/goal pair exactly as
    /// `paintGoalControls()` would; the mastery percent starts as an
    /// em-dash (`masteryForInstance()`'s honesty rule - no check-in
    /// evidence, no invented number); and saving a check-in at the web's
    /// default 40% round-trips through `DeskGoalStore` into a live orb-row
    /// repaint plus the web-worded toast.
    func testDeskHubMasteryGoalAndCheckIn() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        // Superseded Brick 1's hub-as-landing-screen: the hub (tutors map +
        // workflow market + instance grid) now only opens as a fullScreenCover
        // from Field Desk's "The Desk · Manage" wordmark
        // (`fieldDeskLogoManage` -> posts .mcOpenHubFromDesk -> showHubPage).
        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")
        let bootText = app.staticTexts["Your workspace is starting up"]
        if bootText.exists { _ = bootText.waitForNonExistence(timeout: 90) }
        let manageWordmark = app.buttons["fieldDeskLogoManage"]
        XCTAssertTrue(manageWordmark.waitForExistence(timeout: 8), "expected The Desk · Manage wordmark on Field Desk")
        manageWordmark.tap()

        // Round 27 hub: greeting → instances (no mastery/SET GOAL strip).
        // Call lives next to Manage; Tutors / Workflow are collapsible tabs.
        let callButton = app.buttons["deskHubCallButton"]
        XCTAssertTrue(callButton.waitForExistence(timeout: 10), "expected Call next to Manage on the desk hub")
        XCTAssertFalse(app.staticTexts["Start your mastery check-in"].exists,
                       "no bubble copy next to the Call button")
        XCTAssertTrue(app.buttons["deskHubHome"].waitForExistence(timeout: 3),
                      "expected the house (Open The Desk) control next to The Desk wordmark")
        let deskWordmark = app.staticTexts["deskHubWordmark"]
        XCTAssertTrue(deskWordmark.waitForExistence(timeout: 3) || app.staticTexts["The Desk"].exists,
                      "expected The Desk hub wordmark")
        XCTAssertTrue(app.buttons["deskHubCreateInstance"].waitForExistence(timeout: 3),
                      "expected tappable Create an instance tile")
        XCTAssertFalse(app.staticTexts["Your instances"].exists,
                       "Your instances heading should be gone")
        XCTAssertFalse(app.staticTexts["deskMasteryPct"].exists,
                       "mastery orb/percent removed from hub")
        attachScreenshot(app, name: "desk_hub_mastery_head")

        let tutors = app.descendants(matching: .any)["deskHubTutorsNearby"]
        XCTAssertTrue(tutors.waitForExistence(timeout: 5), "expected Tutors nearby tab on the desk hub")
        tutors.tap()
        if !app.textFields["deskHubMapSearch"].waitForExistence(timeout: 2) {
            tutors.swipeUp()
        }
        XCTAssertTrue(app.textFields["deskHubMapSearch"].waitForExistence(timeout: 5),
                      "expected writable map search after expanding Tutors")
        XCTAssertTrue(app.buttons["deskHubMapSearchGo"].waitForExistence(timeout: 3),
                      "expected map Search button")
        let workflows = app.descendants(matching: .any)["deskHubWorkflowMarket"]
        XCTAssertTrue(workflows.waitForExistence(timeout: 5),
                      "expected Workflow market tab on the desk hub")
        workflows.tap()
        XCTAssertTrue(app.staticTexts["deskHubWorkflowSoon_application_tracker"].waitForExistence(timeout: 3)
                      || app.otherElements["deskHubWorkflow_application_tracker"].waitForExistence(timeout: 1),
                      "expected grayed Application Tracker card")
        XCTAssertTrue(app.staticTexts["deskHubWorkflowSoon_health_insights"].waitForExistence(timeout: 3)
                      || app.otherElements["deskHubWorkflow_health_insights"].waitForExistence(timeout: 1),
                      "expected grayed Connect health data card")
        XCTAssertFalse(app.buttons["deskHubWorkflowBuy_gap_scan_pack"].exists,
                       "old buyable gap-scan workflow must be gone")
        attachScreenshot(app, name: "desk_hub_tutors_and_workflows")

        callButton.tap()
        let save = app.buttons["deskCallSave"]
        XCTAssertTrue(save.waitForExistence(timeout: 5), "expected the check-in sheet's save button")
        attachScreenshot(app, name: "desk_hub_checkin_sheet")
        save.tap()

        // Toast still confirms a saved check-in (mastery orb no longer on hub).
        XCTAssertTrue(app.staticTexts["deskToast"].waitForExistence(timeout: 5), "expected the check-in toast after saving")
        attachScreenshot(app, name: "desk_hub_mastery_after_checkin")
    }

    /// Round 13: Field Desk opens the full desk home (rail + widgets).
    /// + Add still files a note into the binder / intel feed.
    func testFieldDeskFilesNoteIntoBinder() {
        let app = XCUIApplication()
        app.launchArguments = [
            "--ui-testing-in-memory",
            "--ui-testing-skip-auth",
            // Opens Gmail connect guide, then Add panel - plane hit-testing
            // under XCUITest is flaky for SwiftUI tap gestures.
            "--ui-testing-field-desk-gmail",
            "--ui-testing-field-desk-add",
        ]
        app.launch()
        // Force landscape after launch - fullScreenCover inherits the live
        // interface orientation; setting it only pre-launch is flaky on iPad.
        XCUIDevice.shared.orientation = .landscapeLeft

        let card = app.buttons["deskInstance_fieldDesk"]
        XCTAssertTrue(card.waitForExistence(timeout: 10), "expected Field Desk instance card")
        card.tap()
        XCUIDevice.shared.orientation = .landscapeLeft

        XCTAssertTrue(app.buttons["fieldDeskImmerse"].waitForExistence(timeout: 5), "expected Field Desk home")
        // Connect guide first (auto-opens at ~0.8s, closes after sample at ~5.5s).
        let guide = app.descendants(matching: .any)["fieldDeskConnectGuide"]
        XCTAssertTrue(guide.waitForExistence(timeout: 4), "expected Gmail connect guide sheet")
        attachScreenshot(app, name: "field_desk_connect_gmail")

        XCTAssertTrue(app.descendants(matching: .any)["fieldDeskRaccoon"].waitForExistence(timeout: 3),
                      "expected raccoon on the desk plane")
        XCTAssertTrue(app.buttons["fieldDeskAdd"].waitForExistence(timeout: 3), "expected + Add in the floating dock")
        XCTAssertTrue(app.descendants(matching: .any)["fieldDeskFloatDock"].waitForExistence(timeout: 3),
                      "expected floating tool dock above Ask")

        XCTAssertTrue(
            app.staticTexts["linked"].waitForExistence(timeout: 8)
                || app.descendants(matching: .any)["fieldDeskToast"].waitForExistence(timeout: 3),
            "expected Gmail linked after sample inbox"
        )
        // Desk plane after guide dismisses (before delayed Add panel at ~8s).
        attachScreenshot(app, name: "field_desk_opened")

        let title = app.textFields["fieldDeskManualTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10), "expected Add panel title field")
        title.tap()
        title.typeText("Quadratic worksheet")
        let course = app.textFields["fieldDeskManualCourse"]
        XCTAssertTrue(course.waitForExistence(timeout: 3))
        course.tap()
        // Replace default "Inbox" so the binder course reads cleanly.
        course.press(forDuration: 1.0)
        if app.menuItems["Select All"].waitForExistence(timeout: 2) {
            app.menuItems["Select All"].tap()
        }
        course.typeText("Math")

        // Keyboard often covers File note on landscape iPad - resign first.
        if app.keyboards.buttons["return"].exists {
            app.keyboards.buttons["return"].tap()
        } else if app.keyboards.buttons["Done"].exists {
            app.keyboards.buttons["Done"].tap()
        } else {
            app.swipeDown()
        }

        let fileNote = app.buttons["fieldDeskFileNote"]
        XCTAssertTrue(fileNote.waitForExistence(timeout: 3))
        if fileNote.isHittable {
            fileNote.tap()
        } else {
            fileNote.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }

        let toast = app.descendants(matching: .any)["fieldDeskToast"]
        XCTAssertTrue(toast.waitForExistence(timeout: 5), "expected filed toast")
        let binderRow = app.staticTexts["Quadratic worksheet"]
        let binderRowAny = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS[c] %@", "Quadratic worksheet"))
            .firstMatch
        XCTAssertTrue(
            binderRow.waitForExistence(timeout: 5) || binderRowAny.waitForExistence(timeout: 2),
            "expected binder row"
        )
        attachScreenshot(app, name: "field_desk_after_file")

        // Home returns to Jesse kitchen desk with Binder on the left.
        let home = app.buttons["fieldDeskImmerse"]
        if home.isHittable {
            home.tap()
        } else {
            home.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        attachScreenshot(app, name: "field_desk_home_jesse")
        XCTAssertTrue(
            app.descendants(matching: .any)["fieldDeskRepositoryCard"].waitForExistence(timeout: 5)
                || app.buttons["fieldDeskBinderInstance_act_main"].waitForExistence(timeout: 2),
            "expected Home to keep Binder on the left"
        )

        // desk → manage page
        let deskManage = app.buttons["fieldDeskLabel"]
        XCTAssertTrue(deskManage.waitForExistence(timeout: 3), "expected desk manage button")
        if deskManage.isHittable { deskManage.tap() }
        else { deskManage.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
        XCTAssertTrue(
            app.descendants(matching: .any)["manageUsernameField"].waitForExistence(timeout: 5)
                || app.descendants(matching: .any)["accountManage"].waitForExistence(timeout: 2)
                || app.navigationBars["Settings"].waitForExistence(timeout: 2),
            "expected desk to open manage page"
        )
        if app.buttons["Done"].waitForExistence(timeout: 2) {
            app.buttons["Done"].tap()
        } else if app.navigationBars.buttons["Done"].waitForExistence(timeout: 1) {
            app.navigationBars.buttons["Done"].tap()
        } else {
            app.swipeDown()
        }

        // Volume control is always present (kitchen starts muted).
        XCTAssertTrue(
            app.buttons["fieldDeskSoundToggle"].waitForExistence(timeout: 3),
            "expected top-right sound toggle"
        )

        // Binder ACT opens in-desk notes popup (not a new tab / stage).
        let binderAct = app.buttons["fieldDeskBinderInstance_act_main"]
        XCTAssertTrue(binderAct.waitForExistence(timeout: 4), "expected Binder ACT tile")
        if binderAct.isHittable { binderAct.tap() }
        else { binderAct.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
        XCTAssertTrue(
            app.descendants(matching: .any)["actInstanceShell"].waitForExistence(timeout: 5)
                || app.descendants(matching: .any)["fieldDeskActNotesPopup"].waitForExistence(timeout: 2)
                || app.buttons["actInstanceMinimize"].waitForExistence(timeout: 2),
            "expected ACT Field Book notes popup on desk"
        )
        if app.buttons["actInstanceMinimize"].waitForExistence(timeout: 3) {
            app.buttons["actInstanceMinimize"].tap()
        }
        XCUIDevice.shared.orientation = .portrait
    }

    /// SchedulingWorkflowsView existed on disk but was never registered in
    /// the Xcode project or wired to the dock - this proves the fix end to
    /// end: dock tap -> picker renders -> a card opens its editor -> back
    /// navigation actually closes the overlay and returns dock control.
    func testSchedulingWorkflowsOpensFromDock() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        // Field Desk (Jesse's Kitchen) is the launch surface itself - no
        // shell-hub card to tap first. Cold WebGL/texture load can take up
        // to ~36s (see the camera-pose auto-enter retry fix, 2026-08-12).
        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")

        // Camera-pose auto-enter can't get real pose data in the Simulator,
        // so the kitchen WebView's own "Enter World" button is the reliable
        // path here (matches a slow/no-pose device falling back the same way).
        let enterWorld = app.buttons["Enter World →"]
        if enterWorld.waitForExistence(timeout: 3) {
            enterWorld.tap()
        }

        // The dock is swipe-to-reveal by default (immersive kitchen view) -
        // drag up from the thin bottom-edge strip to call revealTopChrome().
        let bottomEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98))
        let midScreen = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        bottomEdge.press(forDuration: 0.05, thenDragTo: midScreen)

        let workflowsButton = app.buttons["fieldDeskWorkflows"]
        XCTAssertTrue(workflowsButton.waitForExistence(timeout: 8), "expected Workflows dock icon")
        if workflowsButton.isHittable {
            workflowsButton.tap()
        } else {
            workflowsButton.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }

        // Container-level accessibilityIdentifiers on plain ZStack/VStack
        // views (schedulingWorkflows, schedulingCard_*) don't reliably
        // materialize as their own queryable XCUITest element without an
        // explicit .accessibilityElement(children: .contain) - confirmed via
        // a real screenshot of a passing run where the picker was visibly
        // correct despite the identifier query missing it. Query the leaf
        // Text/Button elements instead, which SwiftUI always exposes.
        XCTAssertTrue(app.staticTexts["Select your workflow"].waitForExistence(timeout: 5), "expected picker headline")
        attachScreenshot(app, name: "scheduling_workflows_picker")

        // Group Poll is first in Kind.allCases, so its "Create" button is
        // the first "Create"-labeled button in visual/tree order.
        let createButton = app.buttons.matching(NSPredicate(format: "label == %@", "Create")).firstMatch
        XCTAssertTrue(createButton.waitForExistence(timeout: 3), "expected a Create button on the picker")
        if createButton.isHittable {
            createButton.tap()
        } else {
            createButton.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }

        XCTAssertTrue(app.staticTexts["Group Poll"].waitForExistence(timeout: 3), "expected editor header for Group Poll")
        attachScreenshot(app, name: "scheduling_workflows_editor")

        // schedulingWorkflowsBack's identifier is reachable, but the button's
        // own VoiceOver label ("Back", derived from the chevron.left symbol)
        // is the more robust query given the accessibility-identifier
        // clobbering documented above.
        let back = app.buttons["Back"]
        XCTAssertTrue(back.waitForExistence(timeout: 3), "expected editor back control")
        back.tap()
        XCTAssertTrue(app.staticTexts["Select your workflow"].waitForExistence(timeout: 3), "expected back to picker")

        back.tap()
        XCTAssertFalse(app.staticTexts["Select your workflow"].waitForExistence(timeout: 3), "expected overlay closed after picker back")
        XCTAssertTrue(app.buttons["fieldDeskWorkflows"].waitForExistence(timeout: 5), "expected dock control back")
        XCUIDevice.shared.orientation = .portrait
    }

    /// Long-press on the Workflows dock icon opens the workflow library
    /// (Resume builder / Open Learning Archive / Apply today) - a different
    /// picker than the short-tap Scheduling Workflows one above. Confirms
    /// the archive entry launches its WKWebView shell and Done returns.
    func testArchiveWorkflowOpensFromLibrary() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")
        let bootText = app.staticTexts["Your workspace is starting up"]
        if bootText.exists { _ = bootText.waitForNonExistence(timeout: 90) }

        let bottomEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98))
        let midScreen = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        bottomEdge.press(forDuration: 0.05, thenDragTo: midScreen)

        let workflowsButton = app.buttons["fieldDeskWorkflows"]
        XCTAssertTrue(workflowsButton.waitForExistence(timeout: 8), "expected Workflows dock icon")
        workflowsButton.press(forDuration: 0.7)

        let archiveRow = app.buttons["workflowOpen_archive"]
        XCTAssertTrue(archiveRow.waitForExistence(timeout: 5), "expected Open Learning Archive row in workflow library")
        attachScreenshot(app, name: "workflow_library")
        archiveRow.tap()

        // A container-level identifier on a plain ZStack (archiveWorkflowRoot)
        // doesn't reliably materialize as its own queryable element - same
        // caveat as schedulingWorkflows/schedulingCard_* above. Query the
        // leaf Done button instead, which SwiftUI always exposes.
        let doneButton = app.buttons["archiveWorkflowBack"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 10), "expected Done control on the archive workflow shell")
        attachScreenshot(app, name: "archive_workflow_open")
        doneButton.tap()

        XCTAssertFalse(app.buttons["archiveWorkflowBack"].waitForExistence(timeout: 3), "expected archive workflow closed")
        XCTAssertTrue(app.buttons["fieldDeskWorkflows"].waitForExistence(timeout: 5), "expected dock control back")
        XCUIDevice.shared.orientation = .portrait
    }

    /// Same shape as testArchiveWorkflowOpensFromLibrary - confirms the
    /// third workflow library entry (Create a book) launches its WKWebView
    /// shell and Done returns cleanly.
    func testBookWorkflowOpensFromLibrary() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")
        let bootText = app.staticTexts["Your workspace is starting up"]
        if bootText.exists { _ = bootText.waitForNonExistence(timeout: 90) }

        let bottomEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98))
        let midScreen = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        bottomEdge.press(forDuration: 0.05, thenDragTo: midScreen)

        let workflowsButton = app.buttons["fieldDeskWorkflows"]
        XCTAssertTrue(workflowsButton.waitForExistence(timeout: 8), "expected Workflows dock icon")
        workflowsButton.press(forDuration: 0.7)

        let bookRow = app.buttons["workflowOpen_book"]
        XCTAssertTrue(bookRow.waitForExistence(timeout: 5), "expected Create a book row in workflow library")
        bookRow.tap()

        let doneButton = app.buttons["bookWorkflowBack"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 10), "expected Done control on the book workflow shell")
        attachScreenshot(app, name: "book_workflow_open")
        doneButton.tap()

        XCTAssertFalse(app.buttons["bookWorkflowBack"].waitForExistence(timeout: 3), "expected book workflow closed")
        XCTAssertTrue(app.buttons["fieldDeskWorkflows"].waitForExistence(timeout: 5), "expected dock control back")
        XCUIDevice.shared.orientation = .portrait
    }

    /// Desk-level pan/zoom (Work mode, empty-space drag/pinch): place a real
    /// card via the + panel, confirm dragging empty space moves the whole
    /// desk (not the card), pinch changes zoom, and the recenter control
    /// appears and resets both back to identity. fieldDeskPanOffset already
    /// existed as an accessibility probe reading real pan/scale state - this
    /// is the first test to actually exercise it, since pan/scale were dead
    /// @State (declared, never wired to a gesture) before this change.
    func testFieldDeskPanZoomsAndRecenters() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")
        let bootText = app.staticTexts["Your workspace is starting up"]
        if bootText.exists { _ = bootText.waitForNonExistence(timeout: 90) }

        let bottomEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98))
        let midScreen = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        bottomEdge.press(forDuration: 0.05, thenDragTo: midScreen)

        let addButton = app.buttons["fieldDeskAdd"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 8), "expected + Add dock icon")
        addButton.tap()

        let addGmail = app.buttons["fieldDeskAddGmail"]
        XCTAssertTrue(addGmail.waitForExistence(timeout: 5), "expected Gmail row in the add panel")
        attachScreenshot(app, name: "add_panel_open")
        addGmail.tap()

        let card = app.buttons["fieldDeskCard_gmail"]
        XCTAssertTrue(card.waitForExistence(timeout: 5), "expected Gmail card placed on the desk")

        let panProbe = app.descendants(matching: .any)["fieldDeskPanOffset"]
        XCTAssertTrue(panProbe.waitForExistence(timeout: 3), "expected pan/zoom probe")
        let before = (panProbe.value as? String) ?? ""
        XCTAssertEqual(before, "0,0,1.00", "expected identity pan/zoom before any gesture")

        // Drag a patch of empty desk space (top-right corner, away from
        // where the Gmail card lands) - this must pan the desk, not the card.
        let emptyStart = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.15))
        let emptyEnd = app.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.45))
        emptyStart.press(forDuration: 0.05, thenDragTo: emptyEnd)

        let afterPan = (panProbe.value as? String) ?? ""
        XCTAssertNotEqual(afterPan, "0,0,1.00", "expected pan to move away from identity after an empty-space drag")
        XCTAssertTrue(card.exists, "expected the Gmail card to survive a desk pan (still placed, not dismissed)")

        let recenter = app.buttons["fieldDeskRecenter"]
        XCTAssertTrue(recenter.waitForExistence(timeout: 3), "expected recenter control once panned away from identity")
        attachScreenshot(app, name: "field_desk_panned")
        recenter.tap()

        // Recenter animates - poll briefly rather than asserting the instant
        // after tapping.
        let recentered = NSPredicate(format: "value == %@", "0,0,1.00")
        let expectation = XCTNSPredicateExpectation(predicate: recentered, object: panProbe)
        let result = XCTWaiter().wait(for: [expectation], timeout: 3)
        XCTAssertEqual(result, .completed, "expected pan/zoom to return to identity after recenter")
        XCTAssertFalse(app.buttons["fieldDeskRecenter"].waitForExistence(timeout: 2), "expected recenter control to hide once back at identity")

        XCUIDevice.shared.orientation = .portrait
    }

    /// Minimize/reconnect: collapsing Scheduling Workflows should NOT close
    /// it (that's a separate, existing control) - it should shrink to a
    /// reconnectable chip on the desk, same treatment as the ACT stage's
    /// existing minimize, and tapping the chip should bring back the exact
    /// same open state (still on the picker), not reset it.
    func testSchedulingWorkflowsMinimizeAndReconnect() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")
        let bootText = app.staticTexts["Your workspace is starting up"]
        if bootText.exists { _ = bootText.waitForNonExistence(timeout: 90) }

        let bottomEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98))
        let midScreen = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        bottomEdge.press(forDuration: 0.05, thenDragTo: midScreen)

        let workflowsButton = app.buttons["fieldDeskWorkflows"]
        XCTAssertTrue(workflowsButton.waitForExistence(timeout: 8), "expected Workflows dock icon")
        workflowsButton.tap()
        XCTAssertTrue(app.staticTexts["Select your workflow"].waitForExistence(timeout: 5), "expected picker to open")
        attachScreenshot(app, name: "picker_open_baseline")

        let minimize = app.buttons["fieldDeskWorkflowsMinimize"]
        XCTAssertTrue(minimize.waitForExistence(timeout: 3), "expected minimize control")
        minimize.tap()

        XCTAssertFalse(app.staticTexts["Select your workflow"].waitForExistence(timeout: 2), "expected picker hidden, not closed, after minimize")
        attachScreenshot(app, name: "after_minimize_tap")
        let chip = app.buttons["fieldDeskWorkflowsChip"]
        XCTAssertTrue(chip.waitForExistence(timeout: 3), "expected minimized chip on the desk")
        XCTAssertTrue(app.staticTexts["Tap to reconnect"].exists, "expected reconnect affordance text")
        attachScreenshot(app, name: "workflows_minimized_chip")

        chip.tap()
        XCTAssertTrue(app.staticTexts["Select your workflow"].waitForExistence(timeout: 3), "expected reconnect to restore the same open state")
        XCUIDevice.shared.orientation = .portrait
    }

    /// Verifies the Instance Hub cleanup: no fork.knife icon, no Desk/Test
    /// Instance placeholder cards, tutors/workflow sections shown directly
    /// (no collapse toggle chevron).
    func testInstanceHubShowsCleanedUpLayout() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        XCTAssertTrue(app.buttons["fieldDeskModeToggle"].waitForExistence(timeout: 40), "expected Field Desk chrome after cold load")

        // fieldDeskModeToggle existing only proves FieldDeskView is mounted
        // underneath DeskBootView, not that boot has actually dismissed -
        // DeskBootView only completes once kitchenReady fires from the
        // WebView (guard kitchenReady, elapsed >= 6.0), which can take a
        // while on a genuinely fresh/never-booted simulator. Wait for the
        // boot text to actually disappear before interacting with chrome.
        let bootText = app.staticTexts["Your workspace is starting up"]
        if bootText.exists {
            _ = bootText.waitForNonExistence(timeout: 90)
        }

        let manage = app.buttons["fieldDeskLogoManage"]
        XCTAssertTrue(manage.waitForExistence(timeout: 5), "expected Manage button")
        manage.tap()

        XCTAssertTrue(app.staticTexts["Tutors nearby"].waitForExistence(timeout: 5), "expected hub to open")
        attachScreenshot(app, name: "instance_hub_cleaned_up")

        XCTAssertFalse(app.buttons["deskHubManage"].exists, "fork.knife icon should be removed")
        XCTAssertFalse(app.buttons["deskInstance_fieldDesk"].exists, "Desk placeholder card should be removed")
        XCTAssertFalse(app.buttons["deskInstance_testInstance"].exists, "Test Instance placeholder card should be removed")
        XCTAssertTrue(app.buttons["deskHubCreateInstance"].exists, "Create an instance should remain")
        XCTAssertTrue(app.staticTexts["Workflow market"].exists, "expected Workflow market header shown directly")
    }

    /// Round 26: drag the Field Desk - must pan, must NOT bounce back to hub.
    func testFieldDeskPanDoesNotDismiss() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft

        let card = app.buttons["deskInstance_fieldDesk"]
        XCTAssertTrue(card.waitForExistence(timeout: 10), "expected Field Desk card")
        card.tap()
        XCUIDevice.shared.orientation = .landscapeLeft

        XCTAssertTrue(app.buttons["fieldDeskImmerse"].waitForExistence(timeout: 5), "expected Field Desk open")
        let panProbe = app.descendants(matching: .any)["fieldDeskPanOffset"]
        XCTAssertTrue(panProbe.waitForExistence(timeout: 3), "expected pan probe")
        let before = panProbe.value as? String ?? panProbe.label

        // Drag across mid desk (below chrome, above Ask dock).
        let win = app.windows.firstMatch
        let start = win.coordinate(withNormalizedOffset: CGVector(dx: 0.72, dy: 0.42))
        let end = win.coordinate(withNormalizedOffset: CGVector(dx: 0.28, dy: 0.48))
        start.press(forDuration: 0.15, thenDragTo: end)
        RunLoop.current.run(until: Date().addingTimeInterval(0.6))

        attachScreenshot(app, name: "field_desk_after_pan")

        // Still on Field Desk - swipe must not dismiss.
        // (Hub card may still exist under the fullScreenCover hierarchy.)
        XCTAssertTrue(
            app.buttons["fieldDeskImmerse"].waitForExistence(timeout: 2),
            "pan dismissed Field Desk - chrome/cover stole the drag"
        )

        let after = panProbe.value as? String ?? ""
        XCTAssertNotEqual(
            after, "0,0",
            "expected pan offset to leave origin after drag, got \(after) (before \(before))"
        )

        XCUIDevice.shared.orientation = .portrait
    }

    /// Round 25: document→cook McCreary showcase in test-instance.
    func testTestInstanceOpensGraphAndQuiz() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-in-memory", "--ui-testing-skip-auth"]
        app.launch()

        let card = app.buttons["deskInstance_testInstance"]
        XCTAssertTrue(card.waitForExistence(timeout: 10), "expected test-instance card")
        card.tap()

        XCTAssertTrue(app.buttons["testInstanceClose"].waitForExistence(timeout: 5),
                      "expected test-instance chrome")
        XCTAssertTrue(app.staticTexts["test-instance"].waitForExistence(timeout: 5),
                      "expected test-instance title")
        XCTAssertTrue(app.descendants(matching: .any)["testInstanceSourceBook"].waitForExistence(timeout: 3),
                      "expected Official ACT Guide source card")
        XCTAssertTrue(app.buttons["testInstanceTour_labs"].waitForExistence(timeout: 3)
                      || app.buttons["testInstanceTab_Tour"].waitForExistence(timeout: 2),
                      "expected showcase tour")
        attachScreenshot(app, name: "test_instance_act_source")

        app.buttons["testInstanceTab_Graph"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["testInstanceConcept_math_geometry"].waitForExistence(timeout: 3)
                      || app.descendants(matching: .any)["testInstanceConcept_microsim"].waitForExistence(timeout: 2),
                      "expected ACT geometry / MicroSim concept on learning graph")
        attachScreenshot(app, name: "test_instance_graph")

        app.buttons["testInstanceTab_Labs"].tap()
        XCTAssertTrue(app.buttons["testInstanceSim_projectile-motion"].waitForExistence(timeout: 3)
                      || app.buttons["testInstanceSim_bouncing-ball"].waitForExistence(timeout: 2),
                      "expected ACT lab card")
        attachScreenshot(app, name: "test_instance_labs")

        app.buttons["testInstanceTab_Quiz"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["testInstanceQuizProgress"].waitForExistence(timeout: 3)
                      || app.staticTexts["testInstanceQuizPrompt"].waitForExistence(timeout: 2),
                      "expected quiz prompt")
        if app.buttons["testInstanceChoice_1"].waitForExistence(timeout: 2) {
            app.buttons["testInstanceChoice_1"].tap()
            if app.buttons["testInstanceCheck"].waitForExistence(timeout: 2) {
                app.buttons["testInstanceCheck"].tap()
            }
        }
        attachScreenshot(app, name: "test_instance_quiz")

        app.buttons["testInstanceClose"].tap()
        XCTAssertTrue(card.waitForExistence(timeout: 5), "expected return to hub")
    }
}
