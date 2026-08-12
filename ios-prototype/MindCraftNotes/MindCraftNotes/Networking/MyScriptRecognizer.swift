import Foundation
import CoreGraphics
import PencilKit

/// Handwriting → LaTeX recognizer.
///
/// Default stub so the Xcode target always compiles (CI + fresh clones).
/// If you have MindCraft MyScript Cloud credentials locally, replace the
/// body of `recognizeLatex` with the real API call — keep this file's
/// public signature stable.
enum MyScriptRecognizer {
    static func recognizeLatex(drawing: PKDrawing, canvasSize: CGSize) async throws -> String {
        throw NSError(
            domain: "MyScriptRecognizer",
            code: 1,
            userInfo: [
                NSLocalizedDescriptionKey:
                    "Handwriting recognition is not configured in this build.",
            ]
        )
    }
}
