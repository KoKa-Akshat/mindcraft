import PDFKit
import SwiftUI

/// "Upload OCR" (2026-08-24, explicit ask: "make it one upload and once
/// you upload the file appears in a screen and i can write on it does not
/// need anything else here"). Despite the name carried over from the
/// founder's own phrasing, this is deliberately NOT a text-extraction/AI
/// pipeline (HomeworkUploadPipeline already does real OCR for that, a
/// different job) - it's "scan a document in, then draw on it," so the
/// upload just needs to become a real, annotatable page. Reuses
/// `CanvasView` (PencilKit, already proven for palm-rejection/pencil+
/// finger drawing elsewhere in this app) directly over a rendered page
/// image, one `DrawingStore` id per page so multi-page PDFs each keep
/// their own independent drawing, same per-id persistence shape
/// `QuestionView` already relies on.
struct CoWorkAnnotateView: View {
    let fileName: String
    let pages: [UIImage]
    var onClose: () -> Void

    @StateObject private var store = DrawingStore()
    /// Stable per-open-session prefix so re-opening the same file twice
    /// doesn't collide with a still-in-flight debounced save under the
    /// same page ids - matches the "id per real drawing surface" shape
    /// DrawingStore already assumes, just synthesized instead of a real
    /// question id.
    private let sessionId = UUID().uuidString

    @State private var clearSignal = 0
    @State private var recognizeSignal = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 24) {
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, image in
                        GeometryReader { geo in
                            ZStack {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: geo.size.width)
                                CanvasView(
                                    questionId: "cowork_\(sessionId)_page\(index)",
                                    palmRejectionMode: .anyInput,
                                    store: store,
                                    clearSignal: $clearSignal,
                                    recognizeSignal: $recognizeSignal,
                                    onDrawingCaptured: nil,
                                    onStrokeCountChange: nil,
                                    onStrokeCompleted: nil
                                )
                                .frame(width: geo.size.width)
                            }
                        }
                        // Real aspect ratio per page, not a fixed guess -
                        // keeps the drawing layer aligned to the image
                        // underneath it regardless of the source
                        // document's own page shape.
                        .aspectRatio(image.size, contentMode: .fit)
                        .background(Color.white)
                        .cornerRadius(8)
                        .shadow(color: .black.opacity(0.12), radius: 8, y: 3)
                    }
                }
                .padding(16)
            }
            .background(Color(uiColor: .secondarySystemBackground).ignoresSafeArea())
            .navigationTitle(fileName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done", action: onClose)
                }
            }
        }
        .accessibilityIdentifier("coWorkAnnotateRoot")
    }
}

/// Real page rendering, not a placeholder - a PDF's pages via PDFKit's own
/// thumbnail renderer (same technique HomeworkUploadPipeline already uses
/// for its OCR fallback), or the photo itself as a single "page" when the
/// upload isn't a PDF at all.
enum CoWorkPageRenderer {
    static func renderPages(fileURL url: URL) -> [UIImage] {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return [] }

        if url.pathExtension.lowercased() == "pdf", let doc = PDFDocument(data: data) {
            var images: [UIImage] = []
            for i in 0..<doc.pageCount {
                guard let page = doc.page(at: i) else { continue }
                let pageRect = page.bounds(for: .mediaBox)
                let scale: CGFloat = 2
                let renderSize = CGSize(width: pageRect.width * scale, height: pageRect.height * scale)
                images.append(page.thumbnail(of: renderSize, for: .mediaBox))
            }
            return images
        }

        guard let image = UIImage(data: data) else { return [] }
        return [image]
    }
}
