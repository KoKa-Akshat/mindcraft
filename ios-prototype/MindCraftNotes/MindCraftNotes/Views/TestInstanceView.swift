import SwiftUI
import WebKit

/// **test-instance · Document cook (McCreary stack)**
/// Product showcase: drop any PDF/book/notes/syllabus → McCreary pipeline
/// cooks a learning graph + MicroSim labs + Bloom quizzes. Live sims load
/// from `dmccreary.github.io/microsims`. Demo seed uses ACT Prep Guide
/// structure; cook story is document-agnostic.
struct TestInstanceView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = TestInstanceStore()
    @State private var tab: Tab = .home
    @State private var openChapter: TestChapter?
    @State private var openSim: TestMicroSim?
    @State private var labFilter: String = "All"
    @State private var learnSegment: LearnSegment = .chapters
    /// Inline Story reader index (0-based) - chapters show here, not buried in sheets.
    @State private var storyIndex = 0
    @State private var quizIndex = 0
    @State private var selectedChoice: Int?
    @State private var checked = false
    @State private var correctCount = 0
    @State private var expandedFAQ: String?
    @State private var selectedDocId: String = "act_prep"

    /// Parallel to ACT Field Book tabs: Home / Graph / Labs / Story / Quiz.
    private enum Tab: String, CaseIterable, Identifiable {
        case home = "Home"
        case graph = "Graph"
        case labs = "Labs"
        case story = "Story"
        case quiz = "Quiz"
        var id: String { rawValue }

        var systemImage: String {
            switch self {
            case .home: return "house.fill"
            case .graph: return "point.3.connected.trianglepath.dotted"
            case .labs: return "play.rectangle.fill"
            case .story: return "book.pages.fill"
            case .quiz: return "checkmark.seal.fill"
            }
        }
    }

    private enum LearnSegment: String, CaseIterable, Identifiable {
        case chapters = "Chapters"
        case glossary = "Glossary"
        case faq = "FAQ"
        var id: String { rawValue }
    }

    var body: some View {
        ZStack {
            // Same chalkboard language as ACT Field Book / DeskBackground.
            CookDeskBackground()

            VStack(spacing: 0) {
                heroBar
                if store.seed == nil {
                    Spacer()
                    if let err = store.loadError {
                        Text(err)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(Color(tiHex: "ff8a80"))
                            .padding()
                            .multilineTextAlignment(.center)
                    } else {
                        ProgressView().tint(Color(tiHex: "c4f547"))
                    }
                    Spacer()
                } else {
                    Group {
                        switch tab {
                        case .home: homePane
                        case .graph: graphPane
                        case .labs: labsPane
                        case .story: storyReaderPane
                        case .quiz: practicePane
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                    cookBottomTabs
                }
            }
        }
        .sheet(item: $openChapter) { ch in chapterSheet(ch) }
        .fullScreenCover(item: $openSim) { sim in
            MicroSimBrowser(sim: sim) { openSim = nil }
        }
        .onAppear { store.load() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("testInstanceRoot")
    }

    // MARK: - Hero (title + leave - tabs live in the bottom bar)

    private var heroBar: some View {
        HStack(spacing: 12) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { tab = .home }
            } label: {
                HStack(spacing: 0) {
                    Text("ACT")
                        .foregroundColor(Color(tiHex: "f4efe2"))
                    Text(" Cook")
                        .foregroundColor(Color(tiHex: "c4f547"))
                }
                .font(.system(size: 22, weight: .bold, design: .rounded))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Home")

            Spacer(minLength: 8)

            if let seed = store.seed {
                Text("\(seed.chapters.count) stories · \(seed.questions.count) quiz")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "c4f547"))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Color.black.opacity(0.28)))
            }

            DeskHomeButton(action: { dismiss() }, accessibilityId: "testInstanceHome")
            Text(verbatim: "")
                .accessibilityIdentifier("testInstanceClose")
                .frame(width: 0, height: 0)
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    /// Labeled bottom tabs - icon-only nav made Story/Quiz easy to miss.
    private var cookBottomTabs: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases) { t in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { tab = t }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: t.systemImage)
                            .font(.system(size: 18, weight: .semibold))
                        Text(t.rawValue)
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(tab == t ? Color(tiHex: "0c1207") : Color(tiHex: "f4efe2").opacity(0.72))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(tab == t ? Color(tiHex: "c4f547") : Color.clear)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t.rawValue)
                .accessibilityIdentifier("testInstanceTab_\(t.rawValue)")
            }
        }
        .padding(6)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.black.opacity(0.35))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
        .padding(.top, 4)
    }

    // MARK: - Digest (cooked PDF → study cockpit)

    private var selectedDocument: TestDocumentType? {
        let docs = store.seed?.documentTypes ?? []
        return docs.first { $0.id == selectedDocId } ?? docs.first
    }

    /// Home - clear launch into Stories + Quiz (graph/concepts live under Graph).
    private var homePane: some View {
        let concepts = (store.seed?.learningGraph.concepts ?? [])
            .filter { $0.category != "Source" && $0.category != "Factory" }
        let chapters = store.seed?.chapters ?? []
        let questions = store.seed?.questions ?? []
        let labs = store.seed?.microsims ?? []

        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Official ACT Prep Guide")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2"))
                    Text("\(chapters.count) stories · \(questions.count) quiz questions · \(labs.count) labs · \(concepts.count) concepts")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2").opacity(0.6))
                }

                HStack(spacing: 12) {
                    Button {
                        storyIndex = 0
                        tab = .story
                    } label: {
                        Label("Read stories", systemImage: "book.pages.fill")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color(tiHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("testInstanceDigestReadFirst")

                    Button { tab = .quiz } label: {
                        Label("Take quiz", systemImage: "checkmark.seal.fill")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color(tiHex: "9fd6ac")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("testInstanceCTA_quiz")
                }

                Text("Stories")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "f4efe2"))

                ForEach(Array(chapters.enumerated()), id: \.element.id) { idx, ch in
                    Button {
                        storyIndex = idx
                        tab = .story
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(idx + 1)")
                                .font(.system(size: 15, weight: .heavy, design: .rounded))
                                .foregroundColor(Color(tiHex: "0c1207"))
                                .frame(width: 32, height: 32)
                                .background(Circle().fill(Color(tiHex: "c4f547")))
                            VStack(alignment: .leading, spacing: 4) {
                                Text(ch.title)
                                    .font(.system(size: 15, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(tiHex: "f4efe2"))
                                    .multilineTextAlignment(.leading)
                                Text(ch.body)
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(tiHex: "f4efe2").opacity(0.55))
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .foregroundColor(Color(tiHex: "c4f547"))
                        }
                        .padding(14)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Color.white.opacity(0.07))
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("testInstanceChapter_\(ch.id)")
                }

                HStack(spacing: 10) {
                    cookLaunchPad("Labs", "\(labs.count) live", "play.rectangle.fill", .labs)
                    cookLaunchPad("Graph", "\(concepts.count) concepts", "point.3.connected.trianglepath.dotted", .graph)
                }

                if !labs.isEmpty {
                    Text("Featured labs")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2"))
                    featuredSimRow(ids: selectedDocument?.featuredSimIds
                                   ?? Array(labs.prefix(4).map(\.id)))
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 4)
            .padding(.bottom, 28)
        }
        .accessibilityIdentifier("testInstanceDigest")
    }

    private func cookLaunchPad(_ title: String, _ blurb: String, _ system: String, _ jump: Tab) -> some View {
        Button { tab = jump } label: {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: system)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color(tiHex: "c4f547"))
                Text(title)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "f4efe2"))
                Text(blurb)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(tiHex: "f4efe2").opacity(0.55))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(tiHex: "14261c").opacity(0.9))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("testInstanceDigestArtifact_\(jump.rawValue)")
    }

    private func cookSparkCard(eyebrow: String, title: String, system: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: system)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(Color(tiHex: "0c1207"))
                .frame(width: 32, height: 32)
                .background(Circle().fill(Color(tiHex: "c4f547")))
            VStack(alignment: .leading, spacing: 2) {
                Text(eyebrow)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "0c1207").opacity(0.55))
                    .textCase(.uppercase)
                Text(title)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "0c1207"))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(tiHex: "c4f547"))
        )
    }

    private func cookConceptTile(_ c: TestConcept) -> some View {
        Button { tab = .graph } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(c.bloom)
                        .font(.system(size: 9, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(tiHex: "0c1207"))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color(tiHex: "c4f547")))
                    Spacer(minLength: 0)
                }
                Text(c.label)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "f4efe2"))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(c.prereqs.isEmpty ? "Foundation" : "← \(c.prereqs.count) prereq")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundColor(Color(tiHex: "9fd6ac"))
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.white.opacity(0.06))
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("testInstanceConcept_\(c.id)")
    }

    private var learnNowCTARow: some View {
        HStack(spacing: 10) {
            Button { tab = .labs } label: {
                Label("Open Labs", systemImage: "play.circle.fill")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Color(tiHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("testInstanceCTA_labs")

            Button { tab = .quiz } label: {
                Label("Take Quiz", systemImage: "checkmark.seal.fill")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Color(tiHex: "9fd6ac")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("testInstanceCTA_quiz")
        }
    }

    @ViewBuilder
    private var cookStudioCard: some View {
        let docs = store.seed?.documentTypes ?? []
        if !docs.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "wand.and.stars")
                        .foregroundColor(Color(tiHex: "c4f547"))
                    Text("COOK STUDIO")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .tracking(0.7)
                        .foregroundColor(Color(tiHex: "c4f547"))
                }
                Text("Fake-drop a document type - see what the cook produces")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(tiHex: "e8f6ec"))

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(docs) { doc in
                            Button {
                                selectedDocId = doc.id
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(doc.kind.uppercased())
                                        .font(.system(size: 9, weight: .bold, design: .rounded))
                                        .foregroundColor(selectedDocId == doc.id
                                                         ? Color(tiHex: "0c1207").opacity(0.55)
                                                         : Color(tiHex: "c4f547"))
                                    Text(doc.title)
                                        .font(.system(size: 12, weight: .bold, design: .rounded))
                                        .foregroundColor(selectedDocId == doc.id
                                                         ? Color(tiHex: "0c1207")
                                                         : Color(tiHex: "e8f6ec"))
                                        .lineLimit(2)
                                        .frame(width: 132, alignment: .leading)
                                }
                                .padding(12)
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(selectedDocId == doc.id
                                              ? Color(tiHex: "c4f547")
                                              : Color.white.opacity(0.07))
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("testInstanceDoc_\(doc.id)")
                        }
                    }
                }

                if let doc = selectedDocument {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(doc.form)
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.55))
                        Text(doc.blurb)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.8))
                            .fixedSize(horizontal: false, vertical: true)
                        Text(doc.pain)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.55))
                            .fixedSize(horizontal: false, vertical: true)

                        Text("AFTER · cook output")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .tracking(0.6)
                            .foregroundColor(Color(tiHex: "c4f547"))
                            .padding(.top, 2)

                        HStack(spacing: 8) {
                            cookedChip("\(doc.cookedConcepts)", "concepts")
                            cookedChip("\(doc.cookedLabs)", "labs")
                            cookedChip("\(doc.cookedQuiz)", "quiz")
                        }

                        ForEach(doc.produces, id: \.self) { line in
                            Label(line, systemImage: "checkmark.circle.fill")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(tiHex: "9fd6ac"))
                        }

                        if let labels = doc.sampleConceptLabels, !labels.isEmpty {
                            Text("Graph preview · \(labels.joined(separator: " · "))")
                                .font(.system(size: 11, weight: .medium, design: .monospaced))
                                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.45))
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.black.opacity(0.25)))
                    .accessibilityIdentifier("testInstanceCookOutput")
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.06))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(tiHex: "c4f547").opacity(0.45), lineWidth: 1.5))
            )
            .accessibilityIdentifier("testInstanceCookStudio")
        }
    }

    private func cookedChip(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundColor(Color(tiHex: "c4f547"))
            Text(label)
                .font(.system(size: 10, weight: .semibold, design: .rounded))
                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.5))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.06)))
    }

    @ViewBuilder
    private var sourceBookCard: some View {
        if let book = store.seed?.sourceBook {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    Image(systemName: "doc.richtext.fill")
                        .font(.system(size: 28))
                        .foregroundColor(Color(tiHex: "c4f547"))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("DEMO SEED · richest example")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .tracking(0.7)
                            .foregroundColor(Color(tiHex: "c4f547"))
                        Text(book.title)
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "e8f6ec"))
                        Text("\(book.pages) pages · \(book.form) · \(book.publisher)")
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.55))
                    }
                }
                Text(book.pain)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(book.contains, id: \.self) { line in
                        Label(line, systemImage: "bookmark.fill")
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(tiHex: "9fd6ac"))
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.06))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(tiHex: "c4f547").opacity(0.35), lineWidth: 1))
            )
            .accessibilityIdentifier("testInstanceSourceBook")
        }
    }

    private func statCard(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundColor(Color(tiHex: "c4f547"))
            Text(label)
                .font(.system(size: 10, weight: .semibold, design: .rounded))
                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
    }

    private func featuredSimRow(ids: [String]) -> some View {
        let sims = (store.seed?.microsims ?? []).filter { ids.contains($0.id) }
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(sims) { sim in
                    Button { openSim = sim } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Image(systemName: "play.circle.fill")
                                .foregroundColor(Color(tiHex: "c4f547"))
                            Text(sim.title)
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(Color(tiHex: "e8f6ec"))
                                .lineLimit(2)
                            Text(sim.hook)
                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.45))
                        }
                        .padding(12)
                        .frame(width: 150, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.07)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Levels

    private var levelsPane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Five levels - any document you drop")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "e8f6ec"))
                Text("Same ladder as intelligent-textbooks: static PDF/notes → graph → MicroSims → adaptive quiz → agent tutor. Works on prep guides, chapters, lectures, syllabi.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.55))

                ForEach(store.seed?.levels ?? []) { lvl in
                    HStack(alignment: .top, spacing: 12) {
                        Text("L\(lvl.level)")
                            .font(.system(size: 16, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(Color(tiHex: "c4f547")))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(lvl.name)
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(tiHex: "e8f6ec"))
                            Text(lvl.blurb)
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.65))
                        }
                    }
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
                    .accessibilityIdentifier("testInstanceLevel_\(lvl.level)")
                }

                if let sim = store.sim(id: "learning-modality-effectiveness") {
                    Button { openSim = sim } label: {
                        Label("Open Learning Modalities MicroSim", systemImage: "play.circle.fill")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color(tiHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Graph (ACT concept map → ready Story / Quiz / Lab)

    /// Student-facing ACT subjects only - hide factory/source cook nodes.
    private static let actGraphCategories: Set<String> = [
        "English", "Math", "Science", "Reading", "Writing", "Strategy"
    ]

    private var graphPane: some View {
        let concepts = (store.seed?.learningGraph.concepts ?? [])
            .filter { Self.actGraphCategories.contains($0.category) }
        let categories = Array(Set(concepts.map(\.category))).sorted()
        let chapters = store.seed?.chapters ?? []
        let questions = store.seed?.questions ?? []
        let labs = (store.seed?.microsims ?? []).filter { $0.category != "Pipeline" }

        return ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your ACT map")
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2"))
                    Text("\(concepts.count) concepts · tap Story, Quiz, or Lab when ready")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2").opacity(0.55))
                }
                .padding(.horizontal, 18)

                // Ready content - in-app destinations only (no external graph sims).
                HStack(spacing: 8) {
                    graphReadyChip("Stories", "\(chapters.count)", "book.pages.fill") {
                        storyIndex = 0
                        tab = .story
                    }
                    graphReadyChip("Quiz", "\(questions.count)", "checkmark.seal.fill") {
                        quizIndex = 0
                        selectedChoice = nil
                        checked = false
                        tab = .quiz
                    }
                    graphReadyChip("Labs", "\(labs.count)", "play.rectangle.fill") {
                        labFilter = "All"
                        tab = .labs
                    }
                }
                .padding(.horizontal, 18)

                ForEach(categories, id: \.self) { cat in
                    Text(cat.uppercased())
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .tracking(0.7)
                        .foregroundColor(Color(tiHex: "c4f547"))
                        .padding(.horizontal, 18)
                        .padding(.top, 6)

                    ForEach(concepts.filter { $0.category == cat }) { c in
                        conceptReadyCard(c)
                            .padding(.horizontal, 18)
                    }
                }
            }
            .padding(.top, 4)
            .padding(.bottom, 24)
        }
        .accessibilityIdentifier("testInstanceGraph")
    }

    private func graphReadyChip(
        _ title: String,
        _ count: String,
        _ system: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Label(title, systemImage: system)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "0c1207"))
                Text("\(count) ready")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(tiHex: "0c1207").opacity(0.6))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(tiHex: "c4f547"))
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("testInstanceGraphReady_\(title)")
    }

    private func conceptReadyCard(_ c: TestConcept) -> some View {
        let storyIdx = chapterIndex(forConcept: c.id)
        let quizIdx = questionIndex(forConcept: c.id)
        let lab = lab(forConcept: c)

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                Circle().fill(Color(tiHex: "c4f547")).frame(width: 8, height: 8).padding(.top, 6)
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(c.label)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "e8f6ec"))
                        Spacer()
                        Text(c.bloom)
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(Color(tiHex: "c4f547").opacity(0.85)))
                    }
                    Text(c.prereqs.isEmpty ? "Foundational" : "Needs \(c.prereqs.count) earlier skill\(c.prereqs.count == 1 ? "" : "s")")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(Color(tiHex: "9fd6ac"))
                }
            }

            HStack(spacing: 8) {
                conceptJumpButton("Story", enabled: storyIdx != nil) {
                    if let storyIdx {
                        storyIndex = storyIdx
                        tab = .story
                    }
                }
                conceptJumpButton("Quiz", enabled: quizIdx != nil) {
                    if let quizIdx {
                        quizIndex = quizIdx
                        selectedChoice = nil
                        checked = false
                        tab = .quiz
                    }
                }
                conceptJumpButton("Lab", enabled: true) {
                    if let lab {
                        openSim = lab
                    } else {
                        labFilter = preferredLabFilter(for: c.category)
                        tab = .labs
                    }
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.06))
        )
        .accessibilityIdentifier("testInstanceConcept_\(c.id)")
    }

    private func conceptJumpButton(
        _ title: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(enabled ? Color(tiHex: "0c1207") : Color(tiHex: "f4efe2").opacity(0.35))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    Capsule().fill(
                        enabled ? Color(tiHex: "c4f547") : Color.white.opacity(0.08)
                    )
                )
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityIdentifier("testInstanceConceptJump_\(title)")
    }

    private func chapterIndex(forConcept id: String) -> Int? {
        store.seed?.chapters.firstIndex { $0.concepts.contains(id) }
    }

    private func questionIndex(forConcept id: String) -> Int? {
        store.seed?.questions.firstIndex { $0.conceptId == id }
    }

    private func lab(forConcept c: TestConcept) -> TestMicroSim? {
        let sims = store.seed?.microsims ?? []
        // Prefer the chapter’s attached lab when this concept appears in a story.
        if let ch = store.seed?.chapters.first(where: { $0.concepts.contains(c.id) }),
           let sim = store.sim(id: ch.microsimId),
           sim.category != "Pipeline" {
            return sim
        }
        // Otherwise first non-pipeline lab tagged for this ACT subject.
        return sims.first {
            $0.category != "Pipeline" && ($0.actSubjects?.contains(c.category) == true)
        }
    }

    private func preferredLabFilter(for category: String) -> String {
        switch category {
        case "Math": return "Math Labs"
        case "Science": return "Science Labs"
        case "English", "Reading", "Writing": return "Language Labs"
        default: return "All"
        }
    }

    // MARK: - Labs

    private var labsPane: some View {
        let all = store.seed?.microsims ?? []
        let cats = ["All"] + Array(Set(all.map(\.category))).sorted()
        let filtered = labFilter == "All" ? all : all.filter { $0.category == labFilter }
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Labs")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "f4efe2"))
                Spacer()
                Text("\(all.count) live")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "c4f547"))
                Button { tab = .quiz } label: {
                    Text("Quiz \u{2192}")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "0c1207"))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(Color(tiHex: "c4f547")))
                }
                .buttonStyle(.plain)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(cats, id: \.self) { c in
                        Button(c) { labFilter = c }
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(labFilter == c ? Color(tiHex: "0c1207") : Color(tiHex: "e8f6ec"))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(labFilter == c ? Color(tiHex: "c4f547") : Color.white.opacity(0.08)))
                            .buttonStyle(.plain)
                    }
                }
            }

            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(filtered) { sim in
                        Button { openSim = sim } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(sim.category)
                                        .font(.system(size: 9, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(tiHex: "c4f547"))
                                    Spacer()
                                    Image(systemName: "play.fill")
                                        .font(.system(size: 11))
                                        .foregroundColor(Color(tiHex: "c4f547"))
                                }
                                Text(sim.title)
                                    .font(.system(size: 14, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(tiHex: "e8f6ec"))
                                    .lineLimit(2)
                                Text(sim.blurb)
                                    .font(.system(size: 11, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.5))
                                    .lineLimit(3)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.07)))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("testInstanceSim_\(sim.id)")
                    }
                }
            }
        }
    }

    // MARK: - Story reader (full chapter body inline)

    @ViewBuilder
    private var storyReaderPane: some View {
        let chapters = store.seed?.chapters ?? []
        if chapters.isEmpty {
            Text("No stories in this cook yet.")
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .foregroundColor(Color(tiHex: "f4efe2").opacity(0.7))
                .padding(18)
        } else {
            let idx = min(max(0, storyIndex), chapters.count - 1)
            let ch = chapters[idx]
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Text("Story")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2"))
                    Text("\(idx + 1) of \(chapters.count)")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "c4f547"))
                    Spacer()
                    Button {
                        if idx > 0 { storyIndex = idx - 1 }
                    } label: {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(width: 36, height: 36)
                            .background(Circle().fill(Color(tiHex: "c4f547").opacity(idx > 0 ? 1 : 0.35)))
                    }
                    .buttonStyle(.plain)
                    .disabled(idx == 0)

                    Button {
                        if idx + 1 < chapters.count {
                            storyIndex = idx + 1
                        } else {
                            tab = .quiz
                        }
                    } label: {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(width: 36, height: 36)
                            .background(Circle().fill(Color(tiHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("testInstanceStoryNext")
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 10)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Array(chapters.enumerated()), id: \.element.id) { i, item in
                            Button {
                                storyIndex = i
                            } label: {
                                Text("\(i + 1). \(item.title)")
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundColor(i == idx ? Color(tiHex: "0c1207") : Color(tiHex: "f4efe2"))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(
                                        Capsule().fill(i == idx ? Color(tiHex: "c4f547") : Color.white.opacity(0.1))
                                    )
                                    .lineLimit(1)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("testInstanceChapter_\(item.id)")
                        }
                    }
                    .padding(.horizontal, 18)
                }
                .padding(.bottom, 12)

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(ch.title)
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))

                        Text(ch.body)
                            .font(.system(size: 16, weight: .medium, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207").opacity(0.88))
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("testInstanceStoryBody")

                        Text("What you’ll walk away with")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207").opacity(0.7))
                            .padding(.top, 4)

                        ForEach(ch.outcomes, id: \.self) { o in
                            Label(o, systemImage: "checkmark.circle.fill")
                                .font(.system(size: 14, weight: .medium, design: .rounded))
                                .foregroundColor(Color(tiHex: "0c1207").opacity(0.8))
                        }

                        HStack(spacing: 10) {
                            if let sim = store.sim(id: ch.microsimId) {
                                Button { openSim = sim } label: {
                                    Label("Open lab", systemImage: "play.circle.fill")
                                        .font(.system(size: 14, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(tiHex: "f4efe2"))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                        .background(RoundedRectangle(cornerRadius: 12).fill(Color(tiHex: "143a2e")))
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("testInstanceOpenChapterSim")
                            }

                            Button {
                                if idx + 1 < chapters.count {
                                    storyIndex = idx + 1
                                } else {
                                    tab = .quiz
                                }
                            } label: {
                                Text(idx + 1 < chapters.count ? "Next story" : "Take quiz")
                                    .font(.system(size: 14, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(tiHex: "0c1207"))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(tiHex: "c4f547")))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.top, 6)
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(Color(tiHex: "faf6ef"))
                            .shadow(color: .black.opacity(0.25), radius: 16, x: 0, y: 8)
                    )
                    .padding(.horizontal, 18)
                    .padding(.bottom, 20)
                }
            }
            .padding(.top, 2)
        }
    }

    // MARK: - Learn (glossary / FAQ kept for seed depth; Story uses reader above)

    private var learnPane: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Story")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "f4efe2"))
                Spacer()
                Button { tab = .quiz } label: {
                    Text("Quiz \u{2192}")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "0c1207"))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(Color(tiHex: "c4f547")))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 18)

            HStack(spacing: 6) {
                ForEach(LearnSegment.allCases) { seg in
                    Button(seg.rawValue) { learnSegment = seg }
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(learnSegment == seg ? Color(tiHex: "0c1207") : Color(tiHex: "e8f6ec"))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Capsule().fill(learnSegment == seg ? Color(tiHex: "c4f547") : Color.white.opacity(0.08)))
                        .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(.horizontal, 18)

            ScrollView {
                switch learnSegment {
                case .chapters: chaptersBlock
                case .glossary: glossaryBlock
                case .faq: faqBlock
                }
            }
            .padding(.horizontal, 18)
        }
        .padding(.top, 4)
    }

    private var chaptersBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(store.seed?.chapters ?? []) { ch in
                Button { openChapter = ch } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(ch.title)
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))
                        Text(ch.body)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207").opacity(0.65))
                            .lineLimit(3)
                        Text("Outcomes · \(ch.outcomes.joined(separator: " · "))")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207").opacity(0.5))
                            .lineLimit(2)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Color(tiHex: "c4f547")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("testInstanceChapter_\(ch.id)")
            }
        }
    }

    private var glossaryBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ISO 11179–style glossary (glossary-generator skill)")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.5))
            ForEach(store.seed?.glossary ?? []) { g in
                VStack(alignment: .leading, spacing: 4) {
                    Text(g.term)
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "c4f547"))
                    Text(g.definition)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.75))
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
            }
        }
    }

    private var faqBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("FAQ (faq-generator skill) - tap to expand")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.5))
            ForEach(store.seed?.faqs ?? []) { f in
                VStack(alignment: .leading, spacing: 6) {
                    Button {
                        expandedFAQ = expandedFAQ == f.question ? nil : f.question
                    } label: {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(f.category.uppercased())
                                    .font(.system(size: 9, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(tiHex: "c4f547"))
                                Text(f.question)
                                    .font(.system(size: 14, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(tiHex: "e8f6ec"))
                                    .multilineTextAlignment(.leading)
                            }
                            Spacer()
                            Image(systemName: expandedFAQ == f.question ? "chevron.up" : "chevron.down")
                                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.5))
                        }
                    }
                    .buttonStyle(.plain)
                    if expandedFAQ == f.question {
                        Text(f.answer)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.7))
                    }
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
            }
        }
    }

    // MARK: - Pipeline

    private var pipelinePane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Skills pipeline → any document")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "e8f6ec"))
                Text("dmccreary/claude-skills: ingest → graph → chapters → MicroSims → quizzes → ship a Desk learning instance. Demo seed is the Prep Guide; the factory is document-agnostic.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.55))

                if let sim = store.sim(id: "book-gen-workflow") {
                    Button { openSim = sim } label: {
                        Label("Open Book Build Workflow MicroSim", systemImage: "play.circle.fill")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color(tiHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                }

                ForEach(store.seed?.pipeline ?? []) { step in
                    HStack(alignment: .top, spacing: 12) {
                        Text(step.step)
                            .font(.system(size: 16, weight: .heavy, design: .monospaced))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(width: 32, height: 32)
                            .background(Circle().fill(Color(tiHex: "c4f547")))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(step.title)
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(tiHex: "e8f6ec"))
                            Text(step.detail)
                                .font(.system(size: 12, weight: .medium, design: .rounded))
                                .foregroundColor(Color(tiHex: "e8f6ec").opacity(0.65))
                            Text(step.skill)
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundColor(Color(tiHex: "9fd6ac"))
                        }
                    }
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
                    .accessibilityIdentifier("testInstancePipe_\(step.step)")
                }
            }
        }
    }

    // MARK: - Quiz

    @ViewBuilder
    private var practicePane: some View {
        let qs = store.seed?.questions ?? []
        if qs.isEmpty {
            VStack(spacing: 12) {
                Text("No quiz questions loaded")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(Color(tiHex: "f4efe2"))
                if let err = store.loadError {
                    Text(err)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(Color(tiHex: "ff8a80"))
                        .multilineTextAlignment(.center)
                } else {
                    Text("Open Home and try again - the cook seed should include 16 items.")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2").opacity(0.65))
                        .multilineTextAlignment(.center)
                }
            }
            .padding(24)
        } else {
            let q = qs[min(quizIndex, qs.count - 1)]
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Text("Quiz")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2"))
                    Text("Question \(quizIndex + 1) of \(qs.count)")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(tiHex: "c4f547"))
                    Spacer()
                    Text("\(correctCount) correct")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(tiHex: "f4efe2").opacity(0.55))
                    Button {
                        if quizIndex + 1 < qs.count {
                            quizIndex += 1
                            selectedChoice = nil
                            checked = false
                        } else {
                            tab = .home
                        }
                    } label: {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .frame(width: 36, height: 36)
                            .background(Circle().fill(Color(tiHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("testInstanceNextTop")
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 10)
                .accessibilityIdentifier("testInstanceQuizProgress")

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text(q.bloom)
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .foregroundColor(Color(tiHex: "0c1207"))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(Color(tiHex: "c4f547")))
                            Spacer()
                        }

                        Text(q.prompt)
                            .font(.system(size: 18, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(tiHex: "0c1207"))
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("testInstanceQuizPrompt")

                        ForEach(Array(q.choices.enumerated()), id: \.offset) { i, choice in
                            Button {
                                if !checked { selectedChoice = i }
                            } label: {
                                HStack(alignment: .top, spacing: 10) {
                                    Text(["A", "B", "C", "D"][min(i, 3)])
                                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                                        .foregroundColor(Color(tiHex: "0c1207"))
                                        .frame(width: 28, height: 28)
                                        .background(Circle().fill(choiceColor(i, answer: q.answerIndex)))
                                    Text(choice)
                                        .font(.system(size: 15, weight: .medium, design: .rounded))
                                        .foregroundColor(Color(tiHex: "0c1207"))
                                        .multilineTextAlignment(.leading)
                                    Spacer(minLength: 0)
                                }
                                .padding(12)
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color.white.opacity(selectedChoice == i ? 0.85 : 0.55))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(Color(tiHex: "143a2e").opacity(selectedChoice == i ? 0.35 : 0.12), lineWidth: 1.5)
                                        )
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("testInstanceChoice_\(i)")
                        }

                        if checked {
                            Text(selectedChoice == q.answerIndex ? "Correct." : "Not quite.")
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(selectedChoice == q.answerIndex
                                                 ? Color(tiHex: "247a4d")
                                                 : Color(tiHex: "b3261e"))
                            Text(q.explain)
                                .font(.system(size: 14, weight: .medium, design: .rounded))
                                .foregroundColor(Color(tiHex: "0c1207").opacity(0.75))
                                .accessibilityIdentifier("testInstanceExplain")
                        }

                        HStack(spacing: 12) {
                            if !checked {
                                Button("Check") {
                                    checked = true
                                    if selectedChoice == q.answerIndex { correctCount += 1 }
                                }
                                .disabled(selectedChoice == nil)
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(tiHex: "0c1207"))
                                .padding(.horizontal, 18)
                                .padding(.vertical, 10)
                                .background(Capsule().fill(Color(tiHex: "c4f547").opacity(selectedChoice == nil ? 0.4 : 1)))
                                .accessibilityIdentifier("testInstanceCheck")
                            } else {
                                Button(quizIndex + 1 < qs.count ? "Next question" : "Finish") {
                                    if quizIndex + 1 < qs.count {
                                        quizIndex += 1
                                        selectedChoice = nil
                                        checked = false
                                    } else {
                                        tab = .home
                                    }
                                }
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(tiHex: "0c1207"))
                                .padding(.horizontal, 18)
                                .padding(.vertical, 10)
                                .background(Capsule().fill(Color(tiHex: "c4f547")))
                                .accessibilityIdentifier("testInstanceNext")
                            }
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(Color(tiHex: "faf6ef"))
                            .shadow(color: .black.opacity(0.25), radius: 16, x: 0, y: 8)
                    )
                    .padding(.horizontal, 18)
                    .padding(.bottom, 20)
                }
            }
        }
    }

    private func choiceColor(_ i: Int, answer: Int) -> Color {
        if !checked {
            return selectedChoice == i ? Color(tiHex: "c4f547") : Color(tiHex: "c4f547").opacity(0.55)
        }
        if i == answer { return Color(tiHex: "c4f547") }
        if i == selectedChoice { return Color(tiHex: "ff8a80") }
        return Color(tiHex: "c4f547").opacity(0.35)
    }

    private func chapterSheet(_ ch: TestChapter) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(ch.body)
                        .font(.system(size: 15, weight: .medium, design: .rounded))
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Learning outcomes")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                    ForEach(ch.outcomes, id: \.self) { o in
                        Label(o, systemImage: "checkmark.circle")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                    }
                    if let sim = store.sim(id: ch.microsimId) {
                        Button {
                            openChapter = nil
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { openSim = sim }
                        } label: {
                            Label("Open MicroSim · \(sim.title)", systemImage: "play.circle.fill")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(tiHex: "0c1207"))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color(tiHex: "c4f547")))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("testInstanceOpenChapterSim")
                    }
                }
                .padding(20)
            }
            .navigationTitle(ch.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { openChapter = nil }
                }
            }
        }
    }
}

// MARK: - MicroSim browser

struct MicroSimBrowser: View {
    let sim: TestMicroSim
    var onClose: () -> Void

    var body: some View {
        NavigationStack {
            MicroSimWebView(url: URL(string: sim.url)!)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(sim.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", action: onClose)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        if let url = URL(string: sim.url) {
                            ShareLink(item: url) { Image(systemName: "safari") }
                        }
                    }
                }
        }
        .accessibilityIdentifier("testInstanceSimBrowser")
    }
}

struct MicroSimWebView: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.scrollView.isScrollEnabled = true
        view.load(URLRequest(url: url))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

// MARK: - Store + models

@MainActor
final class TestInstanceStore: ObservableObject {
    @Published var seed: TestInstanceSeed?
    @Published var loadError: String?

    func load() {
        let url = Bundle.main.url(forResource: "testInstanceSeed", withExtension: "json")
            ?? Bundle.main.url(forResource: "testInstanceSeed", withExtension: "json", subdirectory: "Resources")
        guard let url else {
            loadError = "testInstanceSeed.json missing from app bundle"
            return
        }
        do {
            let data = try Data(contentsOf: url)
            seed = try JSONDecoder().decode(TestInstanceSeed.self, from: data)
            loadError = nil
        } catch {
            loadError = "Failed to decode testInstanceSeed.json: \(error.localizedDescription)"
        }
    }

    func sim(id: String) -> TestMicroSim? {
        seed?.microsims.first { $0.id == id }
    }
}

struct TestInstanceSeed: Codable {
    let id: String
    let title: String
    let subtitle: String
    let tagline: String
    let attribution: String
    let mission: String
    let documentTypes: [TestDocumentType]?
    let sourceBook: TestSourceBook?
    let stats: TestStats
    let levels: [TestLevel]
    let learningGraph: TestLearningGraph
    let chapters: [TestChapter]
    let microsims: [TestMicroSim]
    let glossary: [TestGlossaryEntry]
    let faqs: [TestFAQ]
    let pipeline: [TestPipelineStep]
    let questions: [TestQuestion]
    let tourStops: [TestTourStop]
}

struct TestDocumentType: Codable, Identifiable {
    let id: String
    let title: String
    let kind: String
    let form: String
    let pages: Int?
    let blurb: String
    let pain: String
    let produces: [String]
    let cookedConcepts: Int
    let cookedLabs: Int
    let cookedQuiz: Int
    let sampleConceptLabels: [String]?
    let featuredSimIds: [String]?
}

struct TestSourceBook: Codable {
    let title: String
    let pages: Int
    let publisher: String
    let form: String
    let isbn: String?
    let contains: [String]
    let pain: String
    let githubDoes: [TestCookStep]
}

struct TestCookStep: Codable, Identifiable {
    var id: String { step }
    let step: String
    let detail: String
}

struct TestStats: Codable {
    let microsimsInLibrary: Int
    let skillsAvailable: Int
    let showcaseSims: Int
    let showcaseConcepts: Int
    let showcaseQuestions: Int
    let textbookLevels: Int
    let sourcePages: Int?
}

struct TestLevel: Codable, Identifiable {
    var id: Int { level }
    let level: Int
    let name: String
    let blurb: String
    let conceptId: String
}

struct TestLearningGraph: Codable {
    let concepts: [TestConcept]
}

struct TestConcept: Codable, Identifiable {
    let id: String
    let label: String
    let bloom: String
    let prereqs: [String]
    let category: String
}

struct TestChapter: Codable, Identifiable {
    let id: String
    let title: String
    let concepts: [String]
    let body: String
    let microsimId: String
    let outcomes: [String]
}

struct TestMicroSim: Codable, Identifiable {
    let id: String
    let title: String
    let blurb: String
    let category: String
    let hook: String
    let url: String
    let actSubjects: [String]?
}

struct TestGlossaryEntry: Codable, Identifiable {
    var id: String { term }
    let term: String
    let definition: String
}

struct TestFAQ: Codable, Identifiable {
    var id: String { question }
    let question: String
    let category: String
    let answer: String
}

struct TestPipelineStep: Codable, Identifiable {
    var id: String { step }
    let step: String
    let title: String
    let detail: String
    let skill: String
}

struct TestTourStop: Codable, Identifiable {
    let id: String
    let title: String
    let blurb: String
    let tab: String
}

struct TestQuestion: Codable, Identifiable {
    let id: String
    let conceptId: String
    let bloom: String
    let prompt: String
    let choices: [String]
    let answerIndex: Int
    let explain: String
}

/// Chalkboard field matching ACT Field Book / DeskBackground.
private struct CookDeskBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(tiHex: "1c3228"),
                    Color(tiHex: "14261c"),
                    Color(tiHex: "0f1f18")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [Color(tiHex: "c4f547").opacity(0.10), .clear],
                center: UnitPoint(x: 0.88, y: 0.08),
                startRadius: 0,
                endRadius: 420
            )
            RadialGradient(
                colors: [Color(tiHex: "1d3a8a").opacity(0.18), .clear],
                center: UnitPoint(x: 0.12, y: 0.92),
                startRadius: 0,
                endRadius: 480
            )
        }
        .ignoresSafeArea()
    }
}

private extension Color {
    init(tiHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
