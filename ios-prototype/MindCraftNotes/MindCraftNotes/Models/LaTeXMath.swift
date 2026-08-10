import Foundation

/// Shared low level LaTeX text surgery used by two different callers in
/// this prototype:
///   - PolynomialExpression's LaTeX normalizer (Models/PolynomialExpression.swift),
///     which needs a numeric-over-numeric \frac{a}{b} turned into a computed
///     decimal so the existing bare-caret polynomial grammar can evaluate it.
///   - LaTeXDisplayText (Models/LaTeXDisplayText.swift), which needs the
///     same \frac{a}{b} turned into readable "a/b" text for a question card,
///     with no evaluation at all: a bank question showing \frac{9}{12}
///     should read "9/12" on screen, not the simplified or decimal value,
///     since simplifying might BE the question being asked.
///
/// Both callers want the same brace matching and delimiter stripping, just
/// a different answer to "what does this \frac mean here". That one
/// decision is left to each caller as a closure; this file has no opinion
/// on it.
///
/// Boundary (both callers inherit this): only the LaTeX that shows up in
/// plain polynomial expressions and simple GCSE/ACT style arithmetic
/// questions is handled here: math-mode delimiters ($, $$, \(, \), \[, \]),
/// \left/\right sizing commands, \frac{}{}, and a handful of spacing
/// commands. Nested fractions, matrices, integrals, and other general LaTeX
/// math are explicitly out of scope for this prototype, not an oversight.
enum LaTeXMath {
    /// Removes math-mode wrappers and \left/\right sizing commands. These
    /// carry no mathematical meaning of their own, they only tell a real
    /// LaTeX renderer how to size a delimiter, so dropping each command
    /// together with the specific delimiter character it sizes is safe.
    /// A plain, unsized parenthesis is left alone on purpose: this
    /// prototype's polynomial grammar still does not support grouping
    /// parentheses, so a lone "(" left behind after this pass is a
    /// deliberate signal that the input used something out of scope, not a
    /// silent bug.
    static func stripDelimiters(_ text: String) -> String {
        var result = text
        result = result.replacingOccurrences(of: "$$", with: "")
        result = result.replacingOccurrences(of: "$", with: "")
        result = result.replacingOccurrences(of: "\\(", with: "")
        result = result.replacingOccurrences(of: "\\)", with: "")
        result = result.replacingOccurrences(of: "\\[", with: "")
        result = result.replacingOccurrences(of: "\\]", with: "")
        for delimiter in ["(", ")", "[", "]", "|", "."] {
            result = result.replacingOccurrences(of: "\\left\(delimiter)", with: "")
            result = result.replacingOccurrences(of: "\\right\(delimiter)", with: "")
        }
        return result
    }

    /// Drops LaTeX spacing commands that have no numeric meaning.
    static func stripSpacingCommands(_ text: String) -> String {
        var result = text
        for command in ["\\,", "\\;", "\\!", "\\quad", "\\qquad"] {
            result = result.replacingOccurrences(of: command, with: "")
        }
        return result
    }

    /// Finds every \frac{a}{b} in `text` and asks `transform` what to do
    /// with the raw (unparsed) numerator/denominator text.
    ///
    /// - If `transform` returns a String, that \frac{a}{b} is replaced with
    ///   it.
    /// - If `transform` returns nil, that particular \frac{a}{b} is left
    ///   exactly as written and the search continues past it, rather than
    ///   looping forever on a fraction the caller cannot handle (e.g. a
    ///   variable in the numerator, which PolynomialExpression's numeric
    ///   transform intentionally refuses).
    ///
    /// Only single level braces are matched (no nested \frac inside \frac),
    /// which covers every fraction either caller actually needs.
    static func replaceFractions(in text: String, transform: (String, String) -> String?) -> String {
        guard let regex = try? NSRegularExpression(pattern: "\\\\frac\\{([^{}]*)\\}\\{([^{}]*)\\}") else {
            return text
        }
        var result = text
        var searchStart = result.startIndex
        while searchStart < result.endIndex,
              let match = regex.firstMatch(in: result, range: NSRange(searchStart..<result.endIndex, in: result)) {
            guard let fullRange = Range(match.range, in: result),
                  let numRange = Range(match.range(at: 1), in: result),
                  let denRange = Range(match.range(at: 2), in: result) else { break }
            let numerator = String(result[numRange])
            let denominator = String(result[denRange])
            if let replacement = transform(numerator, denominator) {
                result.replaceSubrange(fullRange, with: replacement)
                // The replacement text never itself contains another
                // \frac (both current callers only ever produce plain text
                // or a plain number), so restarting the scan from the top
                // is simple and safe, and these strings are always short.
                searchStart = result.startIndex
            } else {
                searchStart = fullRange.upperBound
            }
        }
        return result
    }
}
