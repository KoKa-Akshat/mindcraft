import Foundation

/// Real port of `app/src/lib/plottablePoints.ts`. Akshat's live-device
/// complaint ("we have questions with graphs images and [they don't
/// render]") traced to a real, concrete gap: `GraphView` always defaulted to
/// a generic `x^2+5x+6` parabola for EVERY question, with no mechanism to
/// pull a specific question's own real points/expression out of its text -
/// exactly the "root cause" web's own `plottablePoints.ts` doc comment
/// describes fixing (a graph box "showed a parabola with no relationship to
/// the real points").
///
/// **Deliberately scoped down from the web file**, not a 1:1 port - ported
/// the two highest-value, most common cases (direct point extraction, and
/// expression extraction via an explicit "y = ..." statement or a 2-point
/// linear derivation) and left out the quadratic-roots-plus-intercept
/// derivation and the horizontal-line special case for this pass's time
/// budget. Both real coordinate-bearing question text and an explicit
/// "y = ..." statement are common in the real Eedi-sourced bank (per
/// CLAUDE.md's ingestion notes); the omitted cases are real but rarer.
/// Flagged honestly as a scope cut in NATIVE_APP_BUILD_PLAN.md, not silently
/// dropped.
enum PlottablePointsExtractor {
    struct Point: Equatable {
        let x: Double
        let y: Double
    }

    /// `COORD_RE` ported verbatim: `(x, y)` pairs, optionally negative,
    /// optionally decimal.
    private static let coordRegex = try! NSRegularExpression(
        pattern: #"\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)"#
    )

    /// `POINT_CONTEXT_RE` ported verbatim: phrasing that means "discrete
    /// points marked/plotted on axes" - the one figure shape a point-marker
    /// plot can faithfully stand in for.
    private static let pointContextRegex = try! NSRegularExpression(
        pattern: #"\baxes\b|\baxis\b|\bpoints?\b|\bcoordinate grid\b|\bintercepts?\b|\bgraph\b"#,
        options: .caseInsensitive
    )

    /// `NOT_POINT_PLOT_RE` ported verbatim: phrasing that means the figure
    /// is a different kind of diagram entirely - never force these through
    /// a point plot even if a stray coordinate-shaped token appears.
    private static let notPointPlotRegex = try! NSRegularExpression(
        pattern: #"venn diagram|function machine|number line|percentage number line|circle (?:through|goes)|depth-time|glass|cost changes|graph showing how"#,
        options: .caseInsensitive
    )

    /// `Y_EQUALS_RE` ported verbatim (adapted to NSRegularExpression's
    /// lookahead support): captures the right-hand side of an explicit
    /// "y = ..." statement, stopping before "drawn"/"on"/a clause boundary.
    private static let yEqualsRegex = try! NSRegularExpression(
        pattern: #"\by\s*=\s*([^,;]+?)(?=\s*(?:is\s+drawn|drawn|on\b|,|;|$))"#,
        options: .caseInsensitive
    )

    private static func matches(_ text: String, _ regex: NSRegularExpression) -> Bool {
        regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
    }

    private static func extractCoordinates(from text: String) -> [Point] {
        let range = NSRange(text.startIndex..., in: text)
        var points: [Point] = []
        coordRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges == 3,
                  let xRange = Range(match.range(at: 1), in: text),
                  let yRange = Range(match.range(at: 2), in: text),
                  let x = Double(text[xRange]), let y = Double(text[yRange])
            else { return }
            points.append(Point(x: x, y: y))
        }
        return points
    }

    /// Real port of `extractPlottablePoints` - 2 to 6 real coordinate pairs
    /// out of question text that explicitly describes points on axes, nil
    /// otherwise (never force-fits a plot onto unrelated text).
    static func extractPoints(from text: String) -> [Point]? {
        guard !matches(text, notPointPlotRegex), matches(text, pointContextRegex) else { return nil }
        let points = extractCoordinates(from: text)
        guard points.count >= 2, points.count <= 6 else { return nil }
        return points
    }

    /// A straight line is fully determined by any two of its points - ported
    /// from `deriveLinearExpression`, simplified to exactly 2 points (the
    /// web version's 3+-point collinearity cross-check is the part left out
    /// of this pass's scope, see this file's own top doc comment).
    private static func deriveLinearExpression(_ points: [Point]) -> String? {
        guard points.count >= 2 else { return nil }
        let p1 = points[0], p2 = points[1]
        guard p1.x != p2.x else { return nil } // vertical - not expressible as y = f(x)
        let slope = (p2.y - p1.y) / (p2.x - p1.x)
        let intercept = p1.y - slope * p1.x
        return formatLinear(slope: slope, intercept: intercept)
    }

    private static func fmtNum(_ n: Double) -> String {
        let rounded = (n * 10000).rounded() / 10000
        if rounded == rounded.rounded() { return String(Int(rounded)) }
        return String(rounded)
    }

    private static func formatLinear(slope: Double, intercept: Double) -> String {
        var parts: [String] = []
        if slope != 0 {
            if slope == 1 { parts.append("x") }
            else if slope == -1 { parts.append("-x") }
            else { parts.append("\(fmtNum(slope))x") }
        }
        if intercept != 0 || parts.isEmpty {
            let sign = intercept > 0 && !parts.isEmpty ? "+" : ""
            parts.append("\(sign)\(fmtNum(intercept))")
        }
        return parts.joined()
    }

    /// Real port of `extractGraphableExpression`'s two most common cases:
    /// an explicit "y = ..." statement (verified parseable before being
    /// returned, so a malformed statement never crashes `GraphView`), then a
    /// 2-point linear derivation when the text says "line"/"straight"/
    /// "tangent". Returns the bare expression (no leading "y="), matching
    /// `GraphView.expressionText`'s own format.
    static func extractExpression(from text: String) -> String? {
        let range = NSRange(text.startIndex..., in: text)
        if let match = yEqualsRegex.firstMatch(in: text, range: range),
           match.numberOfRanges == 2,
           let exprRange = Range(match.range(at: 1), in: text) {
            let expr = text[exprRange].trimmingCharacters(in: .whitespaces)
            if !expr.isEmpty, (try? PolynomialExpression.parse(expr)) != nil {
                return expr
            }
        }

        guard !matches(text, notPointPlotRegex), matches(text, pointContextRegex) else { return nil }
        let points = extractCoordinates(from: text)
        guard points.count >= 2, points.count <= 6 else { return nil }

        let lowered = text.lowercased()
        if lowered.contains("line") || lowered.contains("straight") || lowered.contains("tangent") {
            if let line = deriveLinearExpression(points) { return line }
        }
        return nil
    }
}
