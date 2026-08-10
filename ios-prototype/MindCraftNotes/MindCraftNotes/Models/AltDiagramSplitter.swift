import Foundation

enum QuestionTextSegment {
    case text(String)
    case diagram(alt: String)
}

/// Splits a question's raw text on `(Diagram: ...)` callouts using a
/// balanced-parenthesis scan - direct port of `altDiagram.ts`'s
/// `splitAltDiagramSegments`, fixing the exact same real bug that fix
/// addressed: a naive regex stops at the FIRST `)`, truncating a callout
/// whose own alt-text contains coordinate pairs like "(4,10)" and leaking
/// the remainder as plain text right after, at full question-text size and
/// weight - the "caption bleeding into the question" bug, now fixed here
/// too before it ever shipped natively.
enum AltDiagramSplitter {
    static func split(_ text: String) -> [QuestionTextSegment] {
        let marker = "(Diagram:"
        var segments: [QuestionTextSegment] = []
        let chars = Array(text)
        var i = 0

        while i < chars.count {
            guard let markerRange = firstIndex(of: marker, in: chars, from: i) else {
                segments.append(.text(String(chars[i...])))
                break
            }
            if markerRange > i {
                segments.append(.text(String(chars[i..<markerRange])))
            }

            var depth = 0
            var end = -1
            var j = markerRange
            while j < chars.count {
                if chars[j] == "(" { depth += 1 }
                else if chars[j] == ")" {
                    depth -= 1
                    if depth == 0 { end = j; break }
                }
                j += 1
            }
            if end == -1 {
                segments.append(.text(String(chars[markerRange...])))
                break
            }
            let altStart = chars.index(chars.startIndex, offsetBy: markerRange + marker.count)
            let altEnd = chars.index(chars.startIndex, offsetBy: end)
            let alt = String(chars[altStart..<altEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
            segments.append(.diagram(alt: alt))
            i = end + 1
        }

        return segments.isEmpty ? [.text(text)] : segments
    }

    private static func firstIndex(of marker: String, in chars: [Character], from: Int) -> Int? {
        let markerChars = Array(marker)
        guard !markerChars.isEmpty, from < chars.count else { return nil }
        let limit = chars.count - markerChars.count
        guard from <= limit else { return nil }
        for start in from...limit {
            if Array(chars[start..<(start + markerChars.count)]) == markerChars {
                return start
            }
        }
        return nil
    }

    /// Light cleanup only (whitespace, trailing punctuation) - never invents
    /// content. Mirrors `humanizeAltCaption`.
    static func humanizeCaption(_ alt: String) -> String {
        let cleaned = alt.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return cleaned }
        let withPeriod = cleaned.range(of: "[.!?]$", options: .regularExpression) != nil ? cleaned : cleaned + "."
        return withPeriod.prefix(1).uppercased() + withPeriod.dropFirst()
    }
}
