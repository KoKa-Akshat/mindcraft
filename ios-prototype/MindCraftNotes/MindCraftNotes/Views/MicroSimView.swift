import SwiftUI
import WebKit

/// Thin `WKWebView` wrapper loading a `MicroSimRecord`'s real, self-contained
/// HTML directly (`loadHTMLString`, no server round trip needed - the sim's
/// own JS is already inlined by `MicroSimRecord.selfContainedHTML`). Same
/// `UIViewRepresentable` shape as `HomeworkDocumentPicker`/`EventEditView`
/// elsewhere in this app.
private struct MicroSimInlineWebView: UIViewRepresentable {
    let html: String
    /// The bundled McCreary sims resolve any residual relative references
    /// against Dan's real site; a generated sim has no such origin - its
    /// html is fully self-contained by contract (js inlined server-side,
    /// only the absolute p5.js CDN tag remains) - so it loads with no base
    /// rather than borrowing dmccreary.github.io as a false provenance.
    var baseURL: URL? = URL(string: "https://dmccreary.github.io/")

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.scrollView.bounces = false
        view.loadHTMLString(html, baseURL: baseURL)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// Real, interactive p5.js simulation viewer - opened from a matched
/// `MicroSimRecord` (see `MicroSimLoader.matching`). Credits Dan McCreary
/// directly on screen, same spirit as `archive-rag`'s own "credit Dan"
/// rule for the chapter-excerpt archive.
struct MicroSimView: View {
    let sim: MicroSimRecord
    var onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(sim.title)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                    Text("MicroSim by \(sim.creator)")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(.secondary)
                }
                Spacer(minLength: 0)
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("microSimClose")
            }
            .padding(14)
            MicroSimInlineWebView(html: sim.selfContainedHTML)
        }
        .background(Color.white)
        .accessibilityIdentifier("microSimView")
    }
}

/// Viewer for one gate-passed GENERATED simulation (closed test,
/// LIVE_GATED_GENERATION_TEST_SPEC.md) - same chrome as `MicroSimView`,
/// but the byline is honest about what this is: AI-generated content, the
/// first in this app's history to reach a student, disclosed in the same
/// spirit as `StudySessionView`'s "AI-generated outline" / "AI-generated -
/// no archive source" labels rather than a new disclosure convention. The
/// gate mention is factual (nothing renders here without having cleared
/// the full rubric + vision gate - the webhook refuses to relay anything
/// less), not a quality promise.
struct GeneratedSimView: View {
    let sim: GeneratedSimResult
    var onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(sim.title)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                    Text("AI-generated simulation - passed MindCraft's quality checks before being shown")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(.secondary)
                        .accessibilityIdentifier("generatedSimAttribution")
                }
                Spacer(minLength: 0)
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("generatedSimClose")
            }
            .padding(14)
            // Real bug fix (2026-08-23) - baseURL: nil was chosen here on
            // the theory that a fully-self-contained page doesn't need a
            // real origin; it does, because the one thing that's NOT
            // inlined is the remote p5.js CDN `<script>` tag, and WKWebView
            // can silently refuse cross-origin subresource loads from a
            // null-origin (`loadHTMLString(_:baseURL: nil)`) document - see
            // InlineSimWebView's own doc comment (MicroSimWebView.swift)
            // for the confirmed root cause. Falls through to
            // MicroSimInlineWebView's own real-https default instead.
            MicroSimInlineWebView(html: sim.html)
        }
        .background(Color.white)
        // NOT a plain .accessibilityIdentifier() on the root - that
        // reproduced this codebase's documented identifier-clobbering bug
        // class live (2026-08-19: the cover resolved as generatedSimView
        // but generatedSimAttribution/generatedSimClose inside it stopped
        // resolving entirely, caught by the first UI-test run of this
        // view). Same contain-group + invisible-marker fix
        // StudySessionView's own root already uses for the same reason.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "generated-sim").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("generatedSimView")
                .allowsHitTesting(false)
        }
    }
}
