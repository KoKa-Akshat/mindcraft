import SwiftUI

/// Study Session - the tabbed, chapter-by-chapter lesson view (2026-08-19,
/// Assignment L in CURSOR_HANDOFF.md - explicit ask, reference a real
/// product screenshot of a medical-chart dashboard: dark panel, a rounded-
/// pill tab row across the top, a scrollable content area, a bottom
/// progress strip). Overlays `DeskGridDashboardView` in screen space (same
/// pattern as `bottomDock`/`leftSidebar` there) rather than a
/// `.fullScreenCover` - the dashboard stays mounted underneath, matching
/// the explicit ask: "the dash was changing... right now, what will
/// happen instead is that once that happens, the dash stays."
///
/// Honest scope, not faked: `WorkDashboardLesson.chapters` is one page of
/// real content per chapter today (`chapterBody(at:)`), not the "5, 10,
/// however many pages" a chapter might eventually need - that needs the
/// richer, structured content-generation pipeline referenced in
/// `mindcraft-content-engine`'s own in-progress work, not yet wired to
/// produce per-chapter multi-page content this app can consume. The arrow
/// navigation here is built so a future `[ChapterPage]` array slots in
/// without a rewrite - `chapterBody(at:)` is already the one seam a
/// future multi-page chapter would extend.
struct StudySessionView: View {
    let lesson: WorkDashboardLesson
    var onClose: () -> Void
    var onOpenMicroSim: (MicroSimRecord) -> Void

    private enum Tab: Equatable {
        case chapter(Int)
        case sources
    }

    @State private var activeTab: Tab = .chapter(0)

    private var chapterCount: Int { lesson.chapters.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            header
            tabRow
            Divider().overlay(Color.white.opacity(0.12))
            content
            if chapterCount > 1 {
                progressStrip
            }
        }
        .padding(28)
        .frame(maxWidth: 1100, maxHeight: 720)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color(studyHex: "2b2b2e"))
                .shadow(color: .black.opacity(0.4), radius: 30, y: 12)
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(0.55).ignoresSafeArea())
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "study-session").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("studySessionRoot")
                .allowsHitTesting(false)
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.12)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("studySessionClose")

            VStack(alignment: .leading, spacing: 2) {
                Text(lesson.topic.capitalized)
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                Text(sourceLabel)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.5))
            }
            Spacer(minLength: 0)
        }
    }

    private var sourceLabel: String {
        switch lesson.source {
        case .archive(let bookTitle): return "From your archive · \(bookTitle)"
        case .generated: return "AI-generated outline"
        }
    }

    private var tabRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Array(lesson.chapters.enumerated()), id: \.offset) { index, title in
                    tabPill(title, isActive: activeTab == .chapter(index)) {
                        activeTab = .chapter(index)
                    }
                    .accessibilityIdentifier("studySessionTab_\(index)")
                }
                tabPill("Sources", isActive: activeTab == .sources) {
                    activeTab = .sources
                }
                .accessibilityIdentifier("studySessionTab_sources")
            }
        }
    }

    private func tabPill(_ title: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(isActive ? Color(studyHex: "1c1c1e") : .white.opacity(0.85))
                .lineLimit(1)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Capsule().fill(isActive ? Color.white : Color.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        HStack(spacing: 12) {
            arrowButton("chevron.left", enabled: canGoBack) { step(-1) }
            ScrollView {
                Group {
                    switch activeTab {
                    case .chapter(let index):
                        chapterContent(index)
                    case .sources:
                        sourcesContent
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            arrowButton("chevron.right", enabled: canGoForward) { step(1) }
        }
        .frame(maxHeight: .infinity)
    }

    private func chapterContent(_ index: Int) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(lesson.chapterBody(at: index))
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("studySessionChapterBody_\(index)")

            if index == 0, let question = lesson.question {
                VStack(alignment: .leading, spacing: 6) {
                    Text("PRACTICE")
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                        .tracking(0.6)
                        .foregroundColor(.white.opacity(0.5))
                    Text(question)
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.9))
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.06)))
            }

            if !lesson.microsims.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("INTERACTIVE SIMULATIONS")
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                        .tracking(0.6)
                        .foregroundColor(.white.opacity(0.5))
                    ForEach(lesson.microsims) { sim in
                        Button { onOpenMicroSim(sim) } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "play.circle.fill")
                                Text(sim.title)
                            }
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(Color(studyHex: "c4f547"))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var sourcesContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            if lesson.citations.isEmpty {
                Text("AI-generated - no archive source for this lesson.")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.6))
            } else {
                ForEach(lesson.citations) { citation in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(citation.pageTitle)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text(citation.bookTitle)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.6))
                        if let url = URL(string: citation.url) {
                            Link(citation.url, destination: url)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundColor(Color(studyHex: "c4f547"))
                        }
                    }
                    .padding(.bottom, 6)
                }
            }
        }
        .accessibilityIdentifier("studySessionSources")
    }

    private func arrowButton(_ system: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(enabled ? .white : .white.opacity(0.25))
                .frame(width: 34, height: 34)
                .background(Circle().fill(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    private var progressStrip: some View {
        HStack(spacing: 8) {
            ForEach(0..<chapterCount, id: \.self) { index in
                Circle()
                    .fill(activeTab == .chapter(index) ? Color.white : Color.white.opacity(0.25))
                    .frame(width: 7, height: 7)
                    .onTapGesture { activeTab = .chapter(index) }
                    .accessibilityIdentifier("studySessionProgress_\(index)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private var canGoBack: Bool {
        if case .chapter(let index) = activeTab { return index > 0 }
        return true
    }

    private var canGoForward: Bool {
        if case .sources = activeTab { return false }
        return true
    }

    private func step(_ delta: Int) {
        switch activeTab {
        case .chapter(let index):
            let next = index + delta
            if next < 0 { return }
            if next >= chapterCount {
                activeTab = .sources
            } else {
                activeTab = .chapter(next)
            }
        case .sources:
            if delta < 0, chapterCount > 0 {
                activeTab = .chapter(chapterCount - 1)
            }
        }
    }
}

private extension Color {
    init(studyHex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(red: r, green: g, blue: b)
    }
}
