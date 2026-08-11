import Foundation

/// Parses a simple polynomial in x, e.g. "x^2+5x+6" or "2x^3 - 4x + 1",
/// and evaluates it at any given x. This is the tractable half of
/// "handwriting to graph": once an expression string exists (typed here for
/// now, eventually from handwriting recognition), turning it into a plotted
/// curve needs no external service, just parsing and evaluation.
///
/// Supported grammar, one term per +/- separated chunk:
///   term := [sign] [coefficient] ["x" ["^" exponent]]
/// Examples: "x^2", "5x", "-4x", "6", "-3x^2", "x"
/// Not supported: parentheses, other variables, non-polynomial functions.
/// That is a deliberate scope limit for this prototype, not an oversight.
///
/// LaTeX subset also accepted (additive, on top of the bare-caret grammar
/// above, see `normalizeLaTeX`), because MyScript's handwriting recognition
/// (the real future input, not wired up in this pass, see
/// PROTOTYPE_STATUS.md) outputs LaTeX, so this parser needs to already
/// read it:
///   - Braced exponents: "x^{2}" as well as the existing "x^2".
///   - Numeric-over-numeric fractions: "\frac{1}{2}x" is read as the
///     coefficient 0.5 times x, i.e. "0.5x". A variable in the numerator
///     or denominator, e.g. "\frac{x}{2}", is real general fraction
///     algebra and is explicitly NOT supported; it produces a clear parse
///     error rather than a silent wrong answer.
///   - Math-mode delimiters and sizing commands that carry no numeric
///     meaning are stripped: "\(", "\)", "\[", "\]", "$", "$$",
///     "\left(", "\right)" (and the other bracket/pipe/period variants),
///     plus spacing commands "\,", "\;", "\!", "\quad", "\qquad".
/// Anything else backslash-prefixed (integrals, matrices, general nested
/// LaTeX expressions, etc.) is out of scope and raises a parse error; this
/// parser is for polynomial-relevant LaTeX only, not a general LaTeX math
/// engine.
struct PolynomialExpression {
    struct Term {
        let coefficient: Double
        let power: Int
    }

    let terms: [Term]
    let originalText: String

    enum ParseError: Error, LocalizedError {
        case empty
        case invalidTerm(String)
        case unsupportedFraction
        case unsupportedLaTeX

        var errorDescription: String? {
            switch self {
            case .empty:
                return "Type an expression in x, like x^2+5x+6 or x^{2}+5x+6."
            case .invalidTerm(let raw):
                return "Could not read the term \"\(raw)\"."
            case .unsupportedFraction:
                return "Only numeric fractions like \\frac{1}{2} are supported, not a variable in the fraction."
            case .unsupportedLaTeX:
                return "That LaTeX syntax isn't supported here, only polynomial-style expressions."
            }
        }
    }

    /// Normalizes the polynomial-relevant LaTeX subset described in this
    /// type's doc comment down to the existing bare-caret grammar, so
    /// `parse` below has exactly one grammar to actually read. This is
    /// deliberately narrow, not a general LaTeX normalizer, see LaTeXMath
    /// for the lower level, shared text surgery this builds on.
    static func normalizeLaTeX(_ raw: String) -> String {
        var text = LaTeXMath.stripDelimiters(raw)
        text = LaTeXMath.stripSpacingCommands(text)
        text = replaceBracedExponents(in: text)
        text = LaTeXMath.replaceFractions(in: text) { numerator, denominator -> String? in
            guard let num = Double(numerator), let den = Double(denominator), den != 0 else {
                // A variable in the numerator/denominator: leave it as an
                // unresolved \frac so `parse` below can detect it and
                // raise ParseError.unsupportedFraction, instead of
                // guessing at what it might mean.
                return nil
            }
            return formatDecimal(num / den)
        }
        return text
    }

    /// "x^{2}" -> "x^2": the bare-caret grammar already reads an exponent
    /// as a run of digits right after "^", so unwrapping the braces is all
    /// that is needed.
    private static func replaceBracedExponents(in text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "\\^\\{([^{}]*)\\}") else { return text }
        var result = text
        var searchStart = result.startIndex
        while searchStart < result.endIndex,
              let match = regex.firstMatch(in: result, range: NSRange(searchStart..<result.endIndex, in: result)) {
            guard let fullRange = Range(match.range, in: result),
                  let groupRange = Range(match.range(at: 1), in: result) else { break }
            let inner = String(result[groupRange])
            result.replaceSubrange(fullRange, with: "^" + inner)
            searchStart = result.startIndex
        }
        return result
    }

    private static func formatDecimal(_ value: Double) -> String {
        if value == value.rounded() {
            return String(Int(value))
        }
        return String(value)
    }

    static func parse(_ raw: String) throws -> PolynomialExpression {
        let latexNormalized = normalizeLaTeX(raw)
        let cleaned = latexNormalized
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "−", with: "-") // some keyboards emit a real minus sign
        guard !cleaned.isEmpty else { throw ParseError.empty }

        // Anything backslash-prefixed still here failed to normalize above:
        // an unresolved \frac (variable numerator/denominator) or other
        // general LaTeX this parser does not attempt. Fail clearly rather
        // than feeding a literal backslash into the bare-caret grammar
        // below, which would just become a confusing "invalid term" error.
        if cleaned.contains("\\frac") {
            throw ParseError.unsupportedFraction
        }
        if cleaned.contains("\\") {
            throw ParseError.unsupportedLaTeX
        }

        // Split on + / - while keeping the sign attached to each term.
        var chunks: [String] = []
        var current = ""
        for (i, ch) in cleaned.enumerated() {
            if (ch == "+" || ch == "-") && i != 0 {
                if !current.isEmpty { chunks.append(current) }
                current = String(ch)
            } else {
                current.append(ch)
            }
        }
        if !current.isEmpty { chunks.append(current) }

        var terms: [Term] = []
        for chunk in chunks {
            terms.append(try parseTerm(chunk))
        }
        return PolynomialExpression(terms: terms, originalText: raw)
    }

    private static func parseTerm(_ raw: String) throws -> Term {
        var s = raw
        var sign = 1.0
        if s.hasPrefix("-") { sign = -1; s.removeFirst() }
        else if s.hasPrefix("+") { s.removeFirst() }

        guard let xIndex = s.firstIndex(where: { $0 == "x" || $0 == "X" }) else {
            // Pure constant term, e.g. "6"
            guard let value = Double(s), !s.isEmpty else { throw ParseError.invalidTerm(raw) }
            return Term(coefficient: sign * value, power: 0)
        }

        let coefficientPart = String(s[s.startIndex..<xIndex])
        let coefficient: Double
        if coefficientPart.isEmpty {
            coefficient = 1
        } else if let value = Double(coefficientPart) {
            coefficient = value
        } else {
            throw ParseError.invalidTerm(raw)
        }

        let afterX = s[s.index(after: xIndex)...]
        if afterX.isEmpty {
            return Term(coefficient: sign * coefficient, power: 1)
        }
        guard afterX.hasPrefix("^") else { throw ParseError.invalidTerm(raw) }
        let powerPart = afterX.dropFirst()
        guard let power = Int(powerPart) else { throw ParseError.invalidTerm(raw) }
        return Term(coefficient: sign * coefficient, power: power)
    }

    func evaluate(at x: Double) -> Double {
        terms.reduce(0) { partial, term in
            partial + term.coefficient * pow(x, Double(term.power))
        }
    }
}
