import SwiftUI
import UniformTypeIdentifiers

/// **Apply today** - one solid paper board with neat inner boxes.
/// Whole board is movable + ↘ resizable. Parks on the right empty desk space.
/// Starts empty until resume upload + LinkedIn connect.
struct JobOSShellView: View {
    var onClose: (() -> Void)? = nil
    /// True when embedded in a fixed-width pane (Resume's left content
    /// area) rather than shown full-screen with open desk space around it.
    /// `placeOnRight` sizes the board to ~48% of whatever canvas it's given
    /// and hugs the right edge - correct for a free-drag desk card with
    /// room to roam, but inside an already-narrow pane that left over half
    /// of it looking blank ("that left screen is pretty much blank there").
    /// This makes the board fill the pane instead.
    var fillsAvailableSpace: Bool = false

    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = JobOSStore()
    @State private var openRole: JobOSRole?
    @State private var confirmApplyId: String?
    @State private var showAddRole = false
    @State private var showAddContact = false
    @State private var showSync = false
    @State private var showResumeImporter = false
    @State private var showLinkedInSheet = false
    @State private var showWritingSheet = false
    @State private var linkDraftId: String?
    @State private var linkDraftURL = ""

    // One board shell (desk-card language).
    @State private var boardSize = CGSize(width: 520, height: 620)
    @State private var boardOrigin = CGPoint(x: 0, y: 56)
    @State private var boardDrag: CGSize = .zero
    @State private var boardFocused = true
    @State private var resizeStart: CGSize?
    @State private var didPlace = false
    @State private var didSeedForUITesting = false

    var body: some View {
        GeometryReader { proxy in
            let canvas = proxy.size
            ZStack(alignment: .topLeading) {
                // Transparent pad: desk shows on the left. Board is solid cream.
                paperBoard
                    .frame(width: boardSize.width, height: boardSize.height)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .stroke(
                                boardFocused ? Color(jobHex: "247a4d") : Color(jobHex: "c4a484"),
                                lineWidth: boardFocused ? 2.2 : 1.4
                            )
                    )
                    .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
                    .overlay(alignment: .bottomTrailing) {
                        if boardFocused { resizeGrip }
                    }
                    .offset(
                        x: boardOrigin.x + boardDrag.width,
                        y: boardOrigin.y + boardDrag.height
                    )
                    .gesture(moveGesture)
                    .zIndex(10)

                if let toast = store.toast {
                    VStack {
                        Spacer()
                        Text(toast)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(jobHex: "0c1207"))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Capsule().fill(Color(jobHex: "c4f547")))
                            .padding(.bottom, 28)
                    }
                    .allowsHitTesting(false)
                }
            }
            // Only the board should steal hits; empty desk space passes through.
            .contentShape(boardHitPath(in: canvas))
            .onAppear {
                guard !didPlace else { return }
                if fillsAvailableSpace { placeFilled(in: canvas) } else { placeOnRight(in: canvas) }
                didPlace = true
            }
            .onChange(of: canvas) { _, newSize in
                guard !didPlace else { return }
                if fillsAvailableSpace { placeFilled(in: newSize) } else { placeOnRight(in: newSize) }
                didPlace = true
            }
        }
        .sheet(item: $openRole) { role in
            JobOSRoleDetailView(
                store: store,
                roleId: role.id,
                onClose: { openRole = nil },
                onLogApplied: {
                    openRole = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        confirmApplyId = role.id
                    }
                }
            )
            .presentationDetents([.large])
        }
        .sheet(isPresented: $showAddRole) { AddRoleSheet(store: store) }
        .sheet(isPresented: $showAddContact) { AddContactSheet(store: store) }
        .sheet(isPresented: $showSync) {
            NavigationStack {
                DailySyncPane(store: store)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") { showSync = false }
                        }
                    }
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showLinkedInSheet) {
            LinkedInConnectSheet(store: store).presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showWritingSheet) {
            WritingReadySheet(store: store).presentationDetents([.medium])
        }
        .sheet(isPresented: Binding(
            get: { linkDraftId != nil },
            set: { if !$0 { linkDraftId = nil; linkDraftURL = "" } }
        )) {
            ExtraLinkSheet(
                url: $linkDraftURL,
                onSave: {
                    if let id = linkDraftId { store.setExtraLink(assetId: id, url: linkDraftURL) }
                    linkDraftId = nil
                    linkDraftURL = ""
                },
                onCancel: {
                    linkDraftId = nil
                    linkDraftURL = ""
                }
            )
            .presentationDetents([.height(260)])
        }
        .fileImporter(
            isPresented: $showResumeImporter,
            allowedContentTypes: [.pdf, .plainText, .rtf, .data],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                store.markResumeUploaded(fileName: urls.first?.lastPathComponent ?? "resume.pdf")
            case .failure:
                store.flash("Couldn’t open that file")
            }
        }
        .alert("Mark Applied?", isPresented: Binding(
            get: { confirmApplyId != nil },
            set: { if !$0 { confirmApplyId = nil } }
        )) {
            Button("I submitted it") {
                if let id = confirmApplyId { store.markApplied(id, confirmed: true) }
                confirmApplyId = nil
            }
            Button("Cancel", role: .cancel) { confirmApplyId = nil }
        } message: {
            Text("Only confirm if you actually submitted.")
        }
        .accessibilityIdentifier("jobOSRoot")
        .onAppear { seedForUITestingIfNeeded() }
    }

    /// Seeds a realistic LinkedIn Connections.csv import through the real
    /// `JobOSLinkedInImport.parseCSV` / `store.importLinkedInConnections`
    /// path (not fabricated `JobOSLinkedInPerson` structs) so UI tests can
    /// exercise the actual CSV parser + alias matcher end to end. Only the
    /// file-picker step is bypassed — a `UIDocumentPickerViewController`
    /// can't be driven from XCUITest — everything downstream (paste-based
    /// past-company augmentation, LinkedIn URL connect, add role, reach-out
    /// matching) still happens through real UI interaction in the test.
    private func seedForUITestingIfNeeded() {
        guard !didSeedForUITesting else { return }
        guard ProcessInfo.processInfo.arguments.contains("--ui-testing-job-os-seed") else { return }
        didSeedForUITesting = true
        store.markResumeUploaded(fileName: "test-resume.pdf")
        store.importLinkedInConnections(text: Self.seedConnectionsCSV, source: "csv")
    }

    /// Real-shaped LinkedIn Connections.csv export: "Notes:" preamble
    /// paragraph (quoted, may contain commas), a blank line, then the
    /// official header. Per the spec (`MATCH_RULES.md`), the export only
    /// ever carries *current* Company — Alhareth's Kigo/Augeo history is
    /// deliberately absent here and added later via the paste `past:`
    /// mechanism, exactly as a real student would have to.
    private static let seedConnectionsCSV = """
        Notes:
        "When exporting your connection data, you will only see the data for connections that were made after 2015. LinkedIn does not currently support export of connections made prior to 2015 due to changes in our privacy practices."


        First Name,Last Name,URL,Email Address,Company,Position,Connected On
        Alhareth,Ali,https://www.linkedin.com/in/alharethali,,Chamfr,AI/ML Intern,15 Jan 2025
        Jordan,Rivera,https://www.linkedin.com/in/jordanrivera,,Wells Fargo,Analyst,02 Mar 2024
        """

    // MARK: - Placement / move / resize

    private func boardHitPath(in canvas: CGSize) -> Path {
        let rect = CGRect(
            x: boardOrigin.x + boardDrag.width,
            y: boardOrigin.y + boardDrag.height,
            width: boardSize.width,
            height: boardSize.height
        )
        return Path(roundedRect: rect, cornerRadius: 22)
    }

    private func placeOnRight(in canvas: CGSize) {
        let w = min(540, max(420, canvas.width * 0.48))
        let h = min(680, max(520, canvas.height - 100))
        boardSize = CGSize(width: w, height: h)
        boardOrigin = CGPoint(
            x: max(24, canvas.width - w - 28),
            y: 52
        )
        boardDrag = .zero
        boardFocused = true
    }

    /// Nearly the whole pane, small margin all round - still draggable/
    /// resizable afterward (the gestures are unconditional), just doesn't
    /// start out looking like a small card lost in empty space.
    private func placeFilled(in canvas: CGSize) {
        let w = max(320, canvas.width - 48)
        let h = max(420, canvas.height - 80)
        boardSize = CGSize(width: w, height: h)
        boardOrigin = CGPoint(x: 24, y: 40)
        boardDrag = .zero
        boardFocused = true
    }

    private var moveGesture: some Gesture {
        DragGesture(minimumDistance: boardFocused ? 8 : 10_000)
            .onChanged { value in
                guard boardFocused else { return }
                boardDrag = value.translation
            }
            .onEnded { value in
                guard boardFocused else { return }
                boardOrigin.x += value.translation.width
                boardOrigin.y += value.translation.height
                boardDrag = .zero
            }
    }

    private var resizeGrip: some View {
        ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(Color(jobHex: "143a2e").opacity(0.55))
                .frame(width: 22, height: 3)
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(Color(jobHex: "143a2e").opacity(0.55))
                .frame(width: 3, height: 22)
        }
        .frame(width: 30, height: 30)
        .padding(8)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 1)
                .onChanged { value in
                    boardFocused = true
                    if resizeStart == nil { resizeStart = boardSize }
                    let start = resizeStart ?? boardSize
                    boardSize = CGSize(
                        width: min(720, max(360, start.width + value.translation.width)),
                        height: min(860, max(420, start.height + value.translation.height))
                    )
                }
                .onEnded { _ in resizeStart = nil }
        )
        .accessibilityIdentifier("jobOSResize")
        .accessibilityLabel("Resize Apply today")
    }

    // MARK: - Solid paper board

    private var paperBoard: some View {
        VStack(spacing: 0) {
            headerBar
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    workflowBoxes
                    rolesBoxes
                }
                .padding(16)
                .padding(.bottom, 28)
            }
        }
        .background(Color(jobHex: "f7f3ee"))
    }

    private var headerBar: some View {
        HStack(spacing: 10) {
            Button {
                if let onClose { onClose() } else { dismiss() }
            } label: {
                Text("Close")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(jobHex: "143a2e"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(Color.white))
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text("Apply today")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(Color(jobHex: "1c1a17"))
                Text(boardFocused ? "Drag to move · ↘ resize" : "Tap board to move")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(jobHex: "8a8478"))
            }

            Spacer()

            Text(store.isBoardReady ? "Ready" : "Set up")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundColor(Color(jobHex: "0c1207"))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    Capsule().fill(store.isBoardReady ? Color(jobHex: "c4f547") : Color(jobHex: "e8e1d4"))
                )

            Menu {
                if store.isBoardReady {
                    Button("Add role", systemImage: "plus") { showAddRole = true }
                    Button("Add contact", systemImage: "person.badge.plus") { showAddContact = true }
                    Button("Daily sync note", systemImage: "arrow.triangle.2.circlepath") { showSync = true }
                    Divider()
                }
                if store.hasLinkedIn {
                    Button("Remove LinkedIn", systemImage: "link.badge.minus", role: .destructive) {
                        store.disconnectLinkedIn()
                    }
                }
                Button("Load Augeo design example", systemImage: "person.2") {
                    store.loadAugeoDesignExample()
                }
                Button("Clear board", systemImage: "trash", role: .destructive) {
                    store.clearBoard()
                }
            } label: {
                Image(systemName: "ellipsis.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(Color(jobHex: "143a2e"))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.88))
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color(jobHex: "d9d2c5")).frame(height: 1)
        }
    }

    // MARK: - Workflow boxes (sketch top)

    private var workflowBoxes: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Workflow space")
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .foregroundColor(Color(jobHex: "8a8478"))

            Text(store.isBoardReady
                  ? "Tap a role below to open it"
                  : "Upload resume + connect LinkedIn. Roles stay empty until then.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(jobHex: "8a8478"))

            // Row 1: three big boxes
            HStack(spacing: 10) {
                assetBox("resume")
                assetBox("writing")
                assetBox("link_linkedin")
            }
            .frame(height: 118)

            // Row 2: + links + note
            HStack(spacing: 10) {
                ForEach(store.state.assets.filter { $0.kind == "link" && $0.id != "link_linkedin" }) { asset in
                    Button {
                        linkDraftId = asset.id
                        linkDraftURL = asset.status == "ready" ? asset.detail : ""
                    } label: {
                        boxShell(ready: asset.status == "ready") {
                            VStack(alignment: .leading, spacing: 6) {
                                Image(systemName: "link")
                                    .font(.system(size: 13, weight: .bold))
                                Text(asset.title)
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .lineLimit(1)
                                Text(asset.status == "ready" ? "Connected" : "Add link")
                                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                                    .opacity(0.55)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("jobOSAsset_\(asset.id)")
                }

                boxShell(ready: false, fill: Color(jobHex: "efe8dc")) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("note")
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(jobHex: "8a8478"))
                        Text(store.linkCount > 0
                              ? "+ \(store.linkCount) links ready"
                              : "Nothing loaded yet")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                    }
                }
            }
            .frame(height: 88)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color(jobHex: "d9d2c5"), lineWidth: 1.2)
        )
    }

    @ViewBuilder
    private func assetBox(_ id: String) -> some View {
        if let asset = store.state.assets.first(where: { $0.id == id }) {
            Button { handleAssetTap(asset) } label: {
                boxShell(ready: asset.status == "ready") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: assetIcon(asset))
                                .font(.system(size: 14, weight: .bold))
                            Spacer()
                            Circle()
                                .fill(asset.status == "ready"
                                      ? Color(jobHex: "247a4d")
                                      : Color(jobHex: "d9d2c5"))
                                .frame(width: 8, height: 8)
                        }
                        Text(asset.title)
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(asset.status == "ready" ? shortReadyLabel(asset) : asset.detail)
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .opacity(0.55)
                            .lineLimit(2)
                        Spacer(minLength: 0)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("jobOSAsset_\(asset.id)")
        }
    }

    private func boxShell<Content: View>(
        ready: Bool,
        fill: Color? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .foregroundColor(Color(jobHex: "1c1a17"))
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(fill ?? (ready ? Color(jobHex: "c4f547") : Color(jobHex: "f7f3ee")))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color(jobHex: "d9d2c5"), lineWidth: 1.1)
            )
    }

    // MARK: - Roles boxes (sketch bottom)

    private var rolesBoxes: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Roles")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(jobHex: "8a8478"))
                Spacer()
                if store.isBoardReady {
                    Button { showAddRole = true } label: {
                        Label("Add", systemImage: "plus")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(Color(jobHex: "0c1207"))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(Color(jobHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("jobOSAddRoleButton")
                }
            }

            HStack(spacing: 6) {
                ForEach(["Role", "Comp", "Apply by", "Reach out", "Resume", "CL"], id: \.self) { title in
                    Text(title)
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(jobHex: "efe8dc"))
                        )
                }
            }

            if !store.isBoardReady {
                VStack(spacing: 10) {
                    Image(systemName: "tray")
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundColor(Color(jobHex: "c4a484"))
                    Text("Nothing here yet")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                    Text("Fill the boxes above first.")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                    HStack(spacing: 8) {
                        stepChip("1 Resume", store.hasResume)
                        stepChip("2 LinkedIn", store.hasLinkedIn)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color(jobHex: "d9d2c5"), style: StrokeStyle(lineWidth: 1.2, dash: [6, 4]))
                )
            } else if store.openRoles.isEmpty {
                VStack(spacing: 8) {
                    Text("You’re set up")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                    Text("Add your first role. Nothing is preloaded.")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                    Button { showAddRole = true } label: {
                        Text("Add role")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(Color(jobHex: "0c1207"))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(Capsule().fill(Color(jobHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 22)
            } else {
                ForEach(Array(store.openRoles.prefix(16).enumerated()), id: \.element.id) { idx, role in
                    Button { openRole = role } label: {
                        HStack(spacing: 6) {
                            cell {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(idx + 1). \(role.role)")
                                        .font(.system(size: 12, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(jobHex: "247a4d"))
                                        .underline()
                                        .lineLimit(2)
                                    Text(role.company)
                                        .font(.system(size: 10, weight: .medium, design: .rounded))
                                        .foregroundColor(Color(jobHex: "8a8478"))
                                }
                            }
                            cell {
                                Text(role.fitScore.map { "\($0)" } ?? "-")
                                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                            }
                            cell {
                                Text(role.deadline ?? "-")
                                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                            }
                            cell {
                                Text(reachOutCell(role))
                                    .font(.system(size: 10, weight: .medium, design: .rounded))
                                    .lineLimit(2)
                            }
                            cell {
                                Image(systemName: role.resumeReady ? "checkmark.square.fill" : "square")
                                    .foregroundColor(role.resumeReady ? Color(jobHex: "247a4d") : Color(jobHex: "d9d2c5"))
                            }
                            cell {
                                Image(systemName: role.coverLetterReady ? "checkmark.square.fill" : "square")
                                    .foregroundColor(role.coverLetterReady ? Color(jobHex: "247a4d") : Color(jobHex: "d9d2c5"))
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("jobOSRole_\(role.id)")
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color(jobHex: "d9d2c5"), lineWidth: 1.2)
        )
    }

    private func stepChip(_ title: String, _ done: Bool) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .heavy, design: .rounded))
            .foregroundColor(done ? Color(jobHex: "0c1207") : Color(jobHex: "8a8478"))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Capsule().fill(done ? Color(jobHex: "c4f547") : Color(jobHex: "efe8dc")))
    }

    private func cell<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .foregroundColor(Color(jobHex: "1c1a17"))
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .padding(8)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color(jobHex: "f7f3ee")))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(jobHex: "e4ddd0"), lineWidth: 1))
    }

    // MARK: - Actions / helpers

    private func handleAssetTap(_ asset: JobOSAsset) {
        boardFocused = true
        switch asset.id {
        case "resume": showResumeImporter = true
        case "writing": showWritingSheet = true
        case "link_linkedin":
            showLinkedInSheet = true
        default:
            linkDraftId = asset.id
            linkDraftURL = asset.status == "ready" ? asset.detail : ""
        }
    }

    private func shortReadyLabel(_ asset: JobOSAsset) -> String {
        switch asset.kind {
        case "resume": return asset.detail
        case "writing": return "Samples ready"
        default:
            if asset.id == "link_linkedin" { return "Connected · tap to add people" }
            return "Linked"
        }
    }

    private func assetIcon(_ asset: JobOSAsset) -> String {
        switch asset.id {
        case "resume": return "doc.badge.arrow.up"
        case "writing": return "pencil.line"
        case "link_linkedin": return "person.crop.circle.badge.checkmark"
        default: return "link"
        }
    }

    private func reachOutCell(_ role: JobOSRole) -> String {
        let line = JobOSReachOutBuilder.namesLine(store.reachOuts(for: role))
        return line.isEmpty ? "—" : line
    }
}

// MARK: - Sheets

private struct LinkedInConnectSheet: View {
    @ObservedObject var store: JobOSStore
    @Environment(\.dismiss) private var dismiss
    @State private var url = ""
    @State private var paste = ""
    @State private var showCSV = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("LinkedIn")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                    Text("OpenID cannot see your connections or Experience. We do not scrape. Profile URL unlocks the board. People come from a Connections.csv or a paste.")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))

                    Text("1. Your profile")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                    TextField("https://www.linkedin.com/in/…", text: $url)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(jobHex: "d9d2c5")))
                        .accessibilityIdentifier("jobOSLinkedInURLField")
                    Button {
                        store.connectLinkedIn(profileUrl: url)
                    } label: {
                        Text("Save profile URL")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(jobHex: "0c1207"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 14).fill(Color(jobHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("jobOSLinkedInURLSave")

                    Text("2. People you can reach")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                    Text("LinkedIn → Settings → Data privacy → Get a copy of your data → Connections. The official CSV only has current Company. Add past:Kigo,Augeo on a paste line if they interned there.")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                    Text("On this desk: \(store.graph.people.count) people")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))

                    Button { showCSV = true } label: {
                        Text("Import Connections.csv")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(jobHex: "0c1207"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 14).fill(Color(jobHex: "9fd6ac")))
                    }
                    .buttonStyle(.plain)

                    Text("Or paste")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                    Text("Name | Current company | Title | https://linkedin.com/in/… | past:OldCo,ParentCo | school:Your campus")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                    TextEditor(text: $paste)
                        .frame(minHeight: 88)
                        .scrollContentBackground(.hidden)
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                        .accessibilityIdentifier("jobOSLinkedInPasteField")
                    Button {
                        store.importLinkedInConnections(text: paste, source: "paste")
                        paste = ""
                    } label: {
                        Text("Add pasted people")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(jobHex: "0c1207"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 14).fill(Color(jobHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("jobOSLinkedInPasteSubmit")

                    Button("Done") { dismiss() }
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("jobOSLinkedInDone")
                }
                .padding(20)
            }
            .background(Color(jobHex: "f7f3ee"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
            .fileImporter(
                isPresented: $showCSV,
                allowedContentTypes: [.commaSeparatedText, .plainText, .text],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }
                    let got = url.startAccessingSecurityScopedResource()
                    defer { if got { url.stopAccessingSecurityScopedResource() } }
                    if let text = try? String(contentsOf: url, encoding: .utf8) {
                        store.importLinkedInConnections(text: text, source: "csv")
                    } else {
                        store.flash("Couldn’t read that file")
                    }
                case .failure:
                    store.flash("Couldn’t open that file")
                }
            }
            .onAppear {
                if url.isEmpty { url = store.graph.profileUrl }
            }
        }
    }
}

private struct WritingReadySheet: View {
    @ObservedObject var store: JobOSStore
    @Environment(\.dismiss) private var dismiss
    @State private var note = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("Creative writing pieces")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                Text("Mark this box when your samples are ready.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(jobHex: "8a8478"))
                TextField("Optional note", text: $note)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(jobHex: "d9d2c5")))
                Button {
                    store.markWritingReady(note: note)
                    dismiss()
                } label: {
                    Text("Mark ready")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(Color(jobHex: "0c1207"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color(jobHex: "c4f547")))
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(20)
            .background(Color(jobHex: "f7f3ee"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }
}

private struct ExtraLinkSheet: View {
    @Binding var url: String
    var onSave: () -> Void
    var onCancel: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("Add link")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                TextField("https://…", text: $url)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(jobHex: "d9d2c5")))
                Button(action: onSave) {
                    Text("Save link")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(Color(jobHex: "0c1207"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color(jobHex: "c4f547")))
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(20)
            .background(Color(jobHex: "f7f3ee"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
            }
        }
    }
}

struct DailySyncPane: View {
    @ObservedObject var store: JobOSStore
    @State private var note = ""
    @State private var focus = "mix"
    @State private var rebuild = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Daily sync")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                Text("Agent mounts later. Never marks Applied for you.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(jobHex: "8a8478"))
                Picker("Focus", selection: $focus) {
                    Text("Mix").tag("mix")
                    Text("Quant").tag("quant")
                    Text("Strategy").tag("strategy")
                }
                .pickerStyle(.segmented)
                TextEditor(text: $note)
                    .frame(minHeight: 90)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                Toggle("Rebuild today list from pipeline", isOn: $rebuild)
                    .tint(Color(jobHex: "c4f547"))
                Button {
                    store.runDailySyncStub(note: note, focus: focus, rebuildQueue: rebuild)
                    note = ""
                } label: {
                    Text("Save sync note")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(Color(jobHex: "0c1207"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color(jobHex: "c4f547")))
                }
                .buttonStyle(.plain)
            }
            .padding(20)
        }
        .background(Color(jobHex: "f7f3ee"))
    }
}

private struct AddRoleSheet: View {
    @ObservedObject var store: JobOSStore
    @Environment(\.dismiss) private var dismiss
    @State private var company = ""
    @State private var role = ""
    @State private var location = ""
    @State private var url = ""
    @State private var why = ""
    @State private var lane = "Apply Now"
    @State private var fit = 85

    var body: some View {
        NavigationStack {
            Form {
                TextField("Company", text: $company)
                    .accessibilityIdentifier("jobOSAddRoleCompany")
                TextField("Role", text: $role)
                    .accessibilityIdentifier("jobOSAddRoleRole")
                TextField("Location", text: $location)
                TextField("Role URL", text: $url)
                    .textInputAutocapitalization(.never)
                Picker("Action lane", selection: $lane) {
                    ForEach(store.state.actionLanes, id: \.self) { Text($0).tag($0) }
                }
                Stepper("Fit \(fit)", value: $fit, in: 70...100)
                TextField("Why it fits", text: $why, axis: .vertical)
                    .lineLimit(3...6)
            }
            .navigationTitle("Add role")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        store.addRole(
                            company: company, role: role, location: location,
                            lane: lane, fit: fit, url: url, why: why
                        )
                        dismiss()
                    }
                    .accessibilityIdentifier("jobOSAddRoleSubmit")
                }
            }
        }
    }
}

private struct AddContactSheet: View {
    @ObservedObject var store: JobOSStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var company = ""
    @State private var url = ""
    @State private var ask = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Company", text: $company)
                TextField("LinkedIn / profile URL", text: $url)
                    .textInputAutocapitalization(.never)
                TextField("Best ask", text: $ask, axis: .vertical)
                    .lineLimit(2...4)
            }
            .navigationTitle("Add contact")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        store.addContact(name: name, company: company, profileUrl: url, bestAsk: ask)
                        dismiss()
                    }
                }
            }
        }
    }
}

extension Color {
    init(jobHex hex: String) {
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
