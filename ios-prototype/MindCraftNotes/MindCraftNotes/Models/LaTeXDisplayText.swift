import Foundation

/// Turns a LaTeX-flavored bank question or choice string (the format used
/// in app/src/data/eediQuestions.json, e.g. "\(0.6=\frac{3}{5}=? \%\)")
/// into plain, readable text for a screen that has no LaTeX renderer.
///
/// This is a rendering step only, never a math step: it never simplifies,
/// evaluates, or otherwise changes what a fraction or percentage IS, only
/// how it is written (see LaTeXMath's doc comment for the full shared
/// boundary). "\frac{9}{12}" becomes the text "9/12", not "3/4" and not
/// "0.75", so the on-screen question stays exactly what the bank says.
enum LaTeXDisplayText {
    static func plainText(from raw: String) -> String {
        var text = LaTeXMath.stripDelimiters(raw)
        text = LaTeXMath.stripSpacingCommands(text)
        text = LaTeXMath.replaceFractions(in: text) { numerator, denominator -> String? in
            "\(numerator)/\(denominator)"
        }
        text = text.replacingOccurrences(of: "\\%", with: "%")
        text = text.replacingOccurrences(of: "\\div", with: "\u{00F7}")
        text = text.replacingOccurrences(of: "\\times", with: "\u{00D7}")
        text = addOperatorSpacing(text)
        return collapseSpaces(text)
    }

    /// Adds a space on each side of =, <, >, and + so multi-part statements
    /// like "52%=0.052" or "1/5+1" read as "52% = 0.052" / "1/5 + 1"
    /// instead of running together. Minus is deliberately left alone, it is
    /// more often a sign in this data (e.g. "-0.34") than a binary
    /// operator, and spacing it unconditionally would misread negatives.
    private static func addOperatorSpacing(_ text: String) -> String {
        var result = ""
        let spacedOperators: Set<Character> = ["=", "<", ">", "+"]
        for ch in text {
            if spacedOperators.contains(ch) {
                if let last = result.last, last != " " { result.append(" ") }
                result.append(ch)
                result.append(" ")
            } else {
                result.append(ch)
            }
        }
        return result
    }

    /// Collapses accidental double spaces (a common side effect of the
    /// substitutions above) and trims each line, while keeping the
    /// question's own line breaks intact.
    private static func collapseSpaces(_ text: String) -> String {
        var result = text
        while result.contains("  ") {
            result = result.replacingOccurrences(of: "  ", with: " ")
        }
        return result
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .joined(separator: "\n")
    }
}
