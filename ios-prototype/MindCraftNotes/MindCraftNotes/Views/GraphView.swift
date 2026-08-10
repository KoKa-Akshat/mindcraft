import SwiftUI

/// A live graphing box: type a polynomial in x, see it plotted immediately,
/// fully native (SwiftUI Canvas), no external graphing service. This is the
/// "expression to graph" half of handwriting-to-graph; the "handwriting to
/// expression" half is a separate, bigger decision (hosted OCR vs
/// self-hosted vs on-device) not built yet, this view takes typed text as a
/// stand-in input for that until that decision is made. The text field also
/// reads the polynomial-relevant LaTeX subset (see PolynomialExpression),
/// not just the bare-caret syntax shown in the placeholder.
struct GraphView: View {
    @State private var expressionText: String
    @State private var parsed: PolynomialExpression?
    @State private var errorMessage: String?

    /// Real per-question data (NATIVE_APP_BUILD_PLAN.md round 7: Akshat's
    /// live-device report, "we have questions with graphs images" not
    /// rendering - traced to this view always defaulting to a generic
    /// `x^2+5x+6` regardless of the actual question, the exact bug web's own
    /// `plottablePoints.ts` doc comment describes fixing). When the current
    /// question's own text describes discrete points on axes
    /// (`PlottablePointsExtractor.extractPoints`), they're plotted as real
    /// labeled markers instead of/alongside the curve - a question about
    /// "the distance between (4,10) and (9,2)" now actually shows those two
    /// points, not an unrelated parabola.
    let points: [PlottablePointsExtractor.Point]

    /// Was a plain `let -10...10` - now widens to comfortably fit real
    /// points when they're given (a point like `(9,2)` plotting just barely
    /// inside, or a real question's coordinates falling outside, the fixed
    /// -10...10 window would otherwise clip or crowd them).
    private var xRange: ClosedRange<Double> {
        guard !points.isEmpty else { return -10...10 }
        let xs = points.map(\.x)
        let lo = min(xs.min() ?? -10, -1)
        let hi = max(xs.max() ?? 10, 1)
        let pad = max((hi - lo) * 0.2, 1)
        return (lo - pad)...(hi + pad)
    }

    /// Normally defaults to the bare-caret placeholder expression. UI tests
    /// seed a LaTeX sample via `UI_TEST_GRAPH_EXPRESSION` instead of typing
    /// live into the field: XCUITest's synthetic tap-to-focus on this
    /// specific TextField (nested in a ScrollView, behind a segmented-Picker
    /// swap) proved unable to reliably establish keyboard focus in the
    /// Simulator across five separate real fixes (settle delay, waiting for
    /// the keyboard, coordinate tap, removing the canvas's own competing
    /// first-responder claim, a full simulator reboot with hardware-keyboard
    /// passthrough confirmed off) despite the same interaction working fine
    /// for an actual person. Seeding via launch environment tests the real
    /// thing that matters, LaTeX parsing and plotting, without depending on
    /// that flaky synthetic-focus path.
    /// Set by QuestionView whenever a new MyScript recognition result comes
    /// back, so a handwritten expression can replace whatever is currently
    /// typed. Not a Binding since QuestionView owns the recognition
    /// lifecycle (loading/error state) independently of this view's own
    /// typed-text editing; onChange below is the one-way hand-off.
    var recognizedExpression: String?

    /// `points` and `initialExpression`: real per-question data, extracted
    /// from the question's OWN text (see `points`'s doc comment above) -
    /// `initialExpression` seeds the typed field the same way a UI-test
    /// environment seed or a MyScript recognition result would, just with a
    /// real, question-specific default instead of the generic placeholder.
    init(points: [PlottablePointsExtractor.Point] = [], initialExpression: String? = nil, recognizedExpression: String? = nil) {
        self.points = points
        self.recognizedExpression = recognizedExpression
        let seeded = ProcessInfo.processInfo.environment["UI_TEST_GRAPH_EXPRESSION"]
        if let seeded {
            _expressionText = State(initialValue: seeded)
        } else if let initialExpression {
            _expressionText = State(initialValue: initialExpression)
        } else if points.isEmpty {
            // No real per-question data at all - same friendly generic
            // placeholder this view always showed before this pass.
            _expressionText = State(initialValue: "x^2+5x+6")
        } else {
            // Real points with no derivable expression (e.g. "the distance
            // between these two points" - nothing to solve for a line/curve
            // through, the points themselves ARE the answer): show ONLY the
            // real points, not an unrelated generic curve alongside them.
            _expressionText = State(initialValue: "")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("y =")
                    .font(.title3)
                    .foregroundColor(.secondary)
                TextField("x^2+5x+6", text: $expressionText)
                    .font(.title3.monospaced())
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .accessibilityIdentifier("graphExpressionField")
                    .onChange(of: expressionText) { _, newValue in
                        reparse(newValue)
                    }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)

            Text("Also reads LaTeX, e.g. x^{2}+5x+6 or \\frac{1}{2}x-3")
                .font(.caption2)
                .foregroundColor(.secondary)
                .padding(.horizontal, 16)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 16)
            }

            Canvas { context, size in
                let yBounds = currentYRange
                drawAxes(context: context, size: size, yBounds: yBounds)
                if let parsed {
                    drawCurve(parsed, yBounds: yBounds, context: context, size: size)
                }
                if !points.isEmpty {
                    drawPoints(points, yBounds: yBounds, context: context, size: size)
                }
            }
            // Round 8: was the adaptive `.systemBackground` - this app never
            // sets `.preferredColorScheme`, so under system Dark Mode that
            // rendered near-black behind an otherwise explicitly light paper
            // card (`QuestionView`'s `rightColumn` now wraps this in a
            // `Paper.sheet`/`Paper.edge` card unconditionally). Fixed to the
            // same literal paper-sheet tone so the graph reads as part of
            // that card in both system appearances, matching web's own
            // GraphBox (its own light theme, independent of OS dark mode).
            .background(Color(red: 251 / 255, green: 248 / 255, blue: 244 / 255))
            .accessibilityIdentifier("graphCanvas")
            .padding(.horizontal, 16)
            .padding(.bottom, 16)

            if !points.isEmpty {
                Text("Real points from this question: " + points.map { "(\(formatTick($0.x, step: 1)), \(formatTick($0.y, step: 1)))" }.joined(separator: ", "))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
                    .accessibilityIdentifier("graphRealPointsCaption")
            }
        }
        .onAppear { reparse(expressionText) }
        .onChange(of: recognizedExpression) { _, newValue in
            guard let newValue else { return }
            expressionText = newValue
        }
    }

    /// The y-range currently in effect: the plotted expression's own range
    /// when there is one to plot; else, if there are real points but no
    /// curve, a range that comfortably fits them; else a plain default so
    /// axis ticks still have something sensible to show on an empty/errored
    /// graph.
    private var currentYRange: ClosedRange<Double> {
        if let parsed { return yRange(for: parsed) }
        if !points.isEmpty {
            let ys = points.map(\.y)
            let lo = min(ys.min() ?? -10, -1)
            let hi = max(ys.max() ?? 10, 1)
            let pad = max((hi - lo) * 0.2, 1)
            return (lo - pad)...(hi + pad)
        }
        return -10...10
    }

    /// Real fix alongside the points/expression wiring: an EMPTY
    /// `expressionText` (the deliberate "show only real points, no unrelated
    /// curve" state from `init` above) used to still run through
    /// `PolynomialExpression.parse("")`, which fails and surfaced a parse-
    /// error message under a graph that was never supposed to have a curve
    /// in the first place. Guarded separately so that state reads as
    /// "intentionally points-only," not "broken."
    private func reparse(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            parsed = nil
            errorMessage = nil
            return
        }
        do {
            parsed = try PolynomialExpression.parse(text)
            errorMessage = nil
        } catch {
            parsed = nil
            errorMessage = error.localizedDescription
        }
    }

    /// Samples the expression's own range so a parabola or cubic isn't
    /// clipped, rather than assuming a fixed y-window.
    private func yRange(for expression: PolynomialExpression) -> ClosedRange<Double> {
        var minY = Double.greatestFiniteMagnitude
        var maxY = -Double.greatestFiniteMagnitude
        var x = xRange.lowerBound
        while x <= xRange.upperBound {
            let y = expression.evaluate(at: x)
            if y.isFinite {
                minY = Swift.min(minY, y)
                maxY = Swift.max(maxY, y)
            }
            x += 0.1
        }
        if !minY.isFinite || !maxY.isFinite || minY == maxY {
            return -10...10
        }
        let padding = (maxY - minY) * 0.1
        return (minY - padding)...(maxY + padding)
    }

    /// Maps math coordinates to screen points for a given size and range.
    /// Both `drawAxes` (for tick/label placement) and `drawCurve` (for the
    /// plotted line) go through this one function so the axis labels can
    /// never drift out of sync with where the curve is actually drawn,
    /// which would happen if each built its own copy of this math.
    private func screenPoint(forX x: Double, y: Double, yBounds: ClosedRange<Double>, size: CGSize) -> CGPoint {
        let xSpan = xRange.upperBound - xRange.lowerBound
        let ySpan = yBounds.upperBound - yBounds.lowerBound
        let px = CGFloat((x - xRange.lowerBound) / xSpan) * size.width
        // Screen y grows downward, math y grows upward, flip it.
        let py = size.height - CGFloat((y - yBounds.lowerBound) / ySpan) * size.height
        return CGPoint(x: px, y: py)
    }

    /// A "nice" tick spacing (1/2/5 x a power of ten) for a given span, so
    /// the axis shows roughly `targetTicks` marks regardless of whether the
    /// current range is wide (a tall parabola) or narrow, instead of either
    /// a cluttered wall of labels or only one or two.
    private func niceStep(forSpan span: Double, targetTicks: Double = 8) -> Double {
        guard span.isFinite, span > 0 else { return 1 }
        let rawStep = span / targetTicks
        let magnitude = pow(10, floor(log10(rawStep)))
        let residual = rawStep / magnitude
        let niceResidual: Double
        if residual < 1.5 { niceResidual = 1 }
        else if residual < 3 { niceResidual = 2 }
        else if residual < 7 { niceResidual = 5 }
        else { niceResidual = 10 }
        let step = niceResidual * magnitude
        return step > 0 ? step : 1
    }

    /// Formats a tick value with just enough decimal places for its step
    /// size, e.g. whole numbers for a step of 1 or 2, one decimal for a
    /// step of 0.5, so labels stay compact instead of showing needless
    /// trailing digits like "2.000".
    private func formatTick(_ value: Double, step: Double) -> String {
        if step >= 1 {
            return String(Int(value.rounded()))
        }
        let decimals = max(1, Int(ceil(-log10(step))))
        return String(format: "%.\(decimals)f", value)
    }

    private func drawAxes(context: GraphicsContext, size: CGSize, yBounds: ClosedRange<Double>) {
        let axisColor = Color.secondary.opacity(0.45)
        let tickColor = Color.secondary.opacity(0.6)
        let labelColor = Color.secondary
        let tickLength: CGFloat = 4

        // Where the two axes actually cross on screen, clamped onto the
        // visible canvas so a curve that never touches y=0 (e.g. always
        // positive) still gets a horizontal reference line to read ticks
        // against, instead of it being drawn off screen.
        let originScreen = screenPoint(forX: 0, y: 0, yBounds: yBounds, size: size)
        let xAxisY = min(max(originScreen.y, 0), size.height)
        let yAxisX = min(max(originScreen.x, 0), size.width)

        var xAxisLine = Path()
        xAxisLine.move(to: CGPoint(x: 0, y: xAxisY))
        xAxisLine.addLine(to: CGPoint(x: size.width, y: xAxisY))
        var yAxisLine = Path()
        yAxisLine.move(to: CGPoint(x: yAxisX, y: 0))
        yAxisLine.addLine(to: CGPoint(x: yAxisX, y: size.height))
        context.stroke(xAxisLine, with: .color(axisColor), lineWidth: 1)
        context.stroke(yAxisLine, with: .color(axisColor), lineWidth: 1)

        // X axis ticks + numeric labels, skipping 0 (drawn once near the
        // origin below instead of on both axes).
        let xSpan = xRange.upperBound - xRange.lowerBound
        let xStep = niceStep(forSpan: xSpan)
        let xLabelAbove = xAxisY > size.height * 0.75 // near the bottom edge: put labels above the line instead of below, so they stay on screen
        var xTick = ceil(xRange.lowerBound / xStep) * xStep
        while xTick <= xRange.upperBound {
            if abs(xTick) > xStep * 0.001 {
                let p = screenPoint(forX: xTick, y: 0, yBounds: yBounds, size: size)
                var tickPath = Path()
                tickPath.move(to: CGPoint(x: p.x, y: xAxisY - tickLength))
                tickPath.addLine(to: CGPoint(x: p.x, y: xAxisY + tickLength))
                context.stroke(tickPath, with: .color(tickColor), lineWidth: 1)

                let labelPoint = CGPoint(x: p.x, y: xAxisY + (xLabelAbove ? -12 : 12))
                context.draw(
                    Text(formatTick(xTick, step: xStep)).font(.system(size: 9)).foregroundColor(labelColor),
                    at: labelPoint
                )
            }
            xTick += xStep
        }

        // Y axis ticks + numeric labels, same skip-zero rule.
        let ySpan = yBounds.upperBound - yBounds.lowerBound
        let yStep = niceStep(forSpan: ySpan)
        let yLabelRight = yAxisX < size.width * 0.25 // near the left edge: put labels to the right of the line instead of the left, so they stay on screen
        var yTick = ceil(yBounds.lowerBound / yStep) * yStep
        while yTick <= yBounds.upperBound {
            if abs(yTick) > yStep * 0.001 {
                let p = screenPoint(forX: 0, y: yTick, yBounds: yBounds, size: size)
                var tickPath = Path()
                tickPath.move(to: CGPoint(x: yAxisX - tickLength, y: p.y))
                tickPath.addLine(to: CGPoint(x: yAxisX + tickLength, y: p.y))
                context.stroke(tickPath, with: .color(tickColor), lineWidth: 1)

                let labelPoint = CGPoint(x: yAxisX + (yLabelRight ? 16 : -16), y: p.y)
                context.draw(
                    Text(formatTick(yTick, step: yStep)).font(.system(size: 9)).foregroundColor(labelColor),
                    at: labelPoint
                )
            }
            yTick += yStep
        }

        // A single "0" at the origin rather than one on each axis.
        context.draw(
            Text("0").font(.system(size: 9)).foregroundColor(labelColor),
            at: CGPoint(x: originScreen.x + (yLabelRight ? 10 : -10), y: xAxisY + (xLabelAbove ? -10 : 10))
        )
    }

    private func drawCurve(_ expression: PolynomialExpression, yBounds: ClosedRange<Double>, context: GraphicsContext, size: CGSize) {
        let xSpan = xRange.upperBound - xRange.lowerBound
        let ySpan = yBounds.upperBound - yBounds.lowerBound
        guard xSpan > 0, ySpan > 0 else { return }

        var path = Path()
        var started = false
        var x = xRange.lowerBound
        let step = xSpan / 400
        while x <= xRange.upperBound {
            let y = expression.evaluate(at: x)
            let p = screenPoint(forX: x, y: y, yBounds: yBounds, size: size)
            if p.y.isFinite {
                if !started {
                    path.move(to: p)
                    started = true
                } else {
                    path.addLine(to: p)
                }
            } else {
                started = false
            }
            x += step
        }
        context.stroke(path, with: .color(.accentColor), lineWidth: 2.5)
    }

    /// Real per-question point markers - filled circles + a small `(x, y)`
    /// label above each, matching the "labeled points on axes" figure this
    /// data is extracted from (`PlottablePointsExtractor.extractPoints`'s own
    /// doc comment: "a few labeled points on a set of axes"). Drawn in a
    /// distinct warm accent from the curve's own color so a question with
    /// BOTH a derived line AND its defining points stays visually legible as
    /// two separate layers, not one blended mess.
    private func drawPoints(_ points: [PlottablePointsExtractor.Point], yBounds: ClosedRange<Double>, context: GraphicsContext, size: CGSize) {
        let markerColor = Color(red: 0.96, green: 0.55, blue: 0.15) // warm amber, distinct from the curve's accentColor
        for point in points {
            let p = screenPoint(forX: point.x, y: point.y, yBounds: yBounds, size: size)
            guard p.x.isFinite, p.y.isFinite else { continue }
            let dotRect = CGRect(x: p.x - 4, y: p.y - 4, width: 8, height: 8)
            context.fill(Path(ellipseIn: dotRect), with: .color(markerColor))
            context.stroke(Path(ellipseIn: dotRect), with: .color(.white), lineWidth: 1.5)
            context.draw(
                Text("(\(formatTick(point.x, step: 1)), \(formatTick(point.y, step: 1)))")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(markerColor),
                at: CGPoint(x: p.x, y: p.y - 14)
            )
        }
    }
}

#Preview {
    GraphView()
}
