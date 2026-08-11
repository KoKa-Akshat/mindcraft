import SwiftUI

/// Macalester **Apply today** workflow board - designed from Akshat’s paper
/// sketch: asset pipeline on top (resume / writing / links) + roles table
/// (Role · Comp · Apply by · Contacts · Resume · Cover Letter). Role opens
/// a detail sheet. Seeded from the Job Search Command Center + LinkedIn CRM.
struct MacalesterApplyWorkflowView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @StateObject private var store = MacalesterApplyStore()
    @State private var openRole: MacalesterRole?
    @State private var toast: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color(wfHex: "0c1207").ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        pipelineBoard
                        rolesTable
                        contactsStrip
                    }
                    .padding(20)
                    .padding(.bottom, 28)
                }

                if let toast {
                    VStack {
                        Spacer()
                        Text(toast)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(wfHex: "0c1207"))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Capsule().fill(Color(wfHex: "c4f547")))
                            .padding(.bottom, 24)
                    }
                    .allowsHitTesting(false)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundColor(Color(wfHex: "c4f547"))
                }
            }
            .sheet(item: $openRole) { role in
                roleDetail(role)
                    .presentationDetents([.medium, .large])
            }
            .onAppear { store.load() }
            .accessibilityIdentifier("macalesterApplyWorkflow")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(store.seed?.title ?? "Apply today")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(Color(wfHex: "f4efe2"))
            Text(store.seed?.subtitle ?? "Macalester pipeline")
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(Color(wfHex: "c4f547"))
            Text("Workflow space · fill boxes below · tap a role to open it")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(wfHex: "f4efe2").opacity(0.55))
        }
    }

    /// Sketch top: upload resume · creative writing · +3 links.
    private var pipelineBoard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("WORKFLOW SPACE")
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .tracking(0.8)
                    .foregroundColor(Color(wfHex: "c4f547"))
                Spacer()
                Text("+ \(store.assets.filter { $0.kind == "link" }.count) links")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(Color(wfHex: "f4efe2").opacity(0.55))
            }

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())],
                spacing: 10
            ) {
                ForEach(store.assets) { asset in
                    Button {
                        flash(asset.status == "ready"
                              ? "\(asset.title) · ready"
                              : "\(asset.title) · drop lands next (agent wiring)")
                    } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: assetIcon(asset))
                                    .font(.system(size: 14, weight: .bold))
                                Spacer()
                                Circle()
                                    .fill(asset.status == "ready"
                                          ? Color(wfHex: "c4f547")
                                          : Color.white.opacity(0.2))
                                    .frame(width: 8, height: 8)
                            }
                            .foregroundColor(Color(wfHex: "0c1207"))
                            Text(asset.title)
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(Color(wfHex: "0c1207"))
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(asset.detail)
                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                .foregroundColor(Color(wfHex: "0c1207").opacity(0.55))
                                .lineLimit(2)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(asset.status == "ready"
                                      ? Color(wfHex: "c4f547")
                                      : Color(wfHex: "f4efe2").opacity(0.88))
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("wfAsset_\(asset.id)")
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color(wfHex: "c4f547").opacity(0.35), lineWidth: 1.5)
                )
        )
    }

    private var rolesTable: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ROLES")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(Color(wfHex: "c4f547"))

            // Column headers (sketch).
            HStack(spacing: 0) {
                headerCell("Role", flex: 2.2)
                headerCell("Comp", flex: 0.8)
                headerCell("Apply by", flex: 1.0)
                headerCell("Contacts", flex: 1.4)
                headerCell("Resume", flex: 0.7)
                headerCell("CL", flex: 0.55)
            }
            .padding(.horizontal, 4)

            ForEach(Array(store.roles.enumerated()), id: \.element.id) { idx, role in
                Button { openRole = role } label: {
                    HStack(spacing: 0) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(idx + 1). \(role.role)")
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(Color(wfHex: "c4f547"))
                                .multilineTextAlignment(.leading)
                                .underline()
                            Text(role.company)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundColor(Color(wfHex: "f4efe2").opacity(0.7))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(minWidth: 0)
                        .layoutPriority(2.2)

                        Text(compLabel(role))
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(wfHex: "f4efe2").opacity(0.85))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .layoutPriority(0.8)

                        Text(role.deadline ?? "-")
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(wfHex: "f4efe2").opacity(0.85))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .layoutPriority(1.0)

                        Text(role.contacts.isEmpty ? "-" : role.contacts)
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(Color(wfHex: "f4efe2").opacity(0.75))
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .layoutPriority(1.4)

                        statusDot(role.resumeReady)
                            .frame(maxWidth: .infinity)
                            .layoutPriority(0.7)

                        statusDot(role.coverLetterReady)
                            .frame(maxWidth: .infinity)
                            .layoutPriority(0.55)
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.white.opacity(role.applied ? 0.04 : 0.08))
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("wfRole_\(role.id)")
                .accessibilityLabel("Open \(role.role) at \(role.company)")
            }
        }
    }

    private var contactsStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("LINKEDIN · CONTACTS")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(Color(wfHex: "c4f547"))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(store.contacts) { c in
                        Button {
                            if let url = URL(string: c.profileUrl), !c.profileUrl.isEmpty {
                                openURL(url)
                            } else {
                                flash("No profile URL for \(c.name)")
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(c.name)
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(wfHex: "0c1207"))
                                    .lineLimit(2)
                                Text(c.company)
                                    .font(.system(size: 11, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(wfHex: "0c1207").opacity(0.6))
                                    .lineLimit(1)
                                Text(c.warmth)
                                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                                    .foregroundColor(Color(wfHex: "143a2e"))
                                    .lineLimit(2)
                            }
                            .padding(12)
                            .frame(width: 180, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color(wfHex: "c4f547"))
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("wfContact_\(c.id)")
                    }
                }
            }
        }
    }

    private func roleDetail(_ role: MacalesterRole) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(role.role)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                    Text("\(role.company) · \(role.location)")
                        .foregroundColor(.secondary)
                    Label(role.actionLane, systemImage: "arrow.triangle.branch")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                    if let fit = role.fitScore {
                        Text("Fit \(fit) · \(role.eligibility)")
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                    }
                    Text(role.why)
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                    Text("Next")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .foregroundColor(.secondary)
                    Text(role.nextAction)
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                    if !role.contacts.isEmpty {
                        Text("Contacts · \(role.contacts)")
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                    }
                    if let url = URL(string: role.roleUrl), !role.roleUrl.isEmpty {
                        Link(destination: url) {
                            Label("Open role posting", systemImage: "arrow.up.right.square")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(wfHex: "0c1207"))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color(wfHex: "c4f547")))
                        }
                    }
                }
                .padding(20)
            }
            .navigationTitle(role.company)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { openRole = nil }
                }
            }
        }
    }

    private func headerCell(_ title: String, flex: CGFloat) -> some View {
        Text(title)
            .font(.system(size: 10, weight: .heavy, design: .rounded))
            .foregroundColor(Color(wfHex: "f4efe2").opacity(0.45))
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(flex)
    }

    private func statusDot(_ ready: Bool) -> some View {
        Image(systemName: ready ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(ready ? Color(wfHex: "c4f547") : Color.white.opacity(0.25))
    }

    private func compLabel(_ role: MacalesterRole) -> String {
        if let fit = role.fitScore { return "fit \(fit)" }
        return "-"
    }

    private func assetIcon(_ asset: MacalesterAsset) -> String {
        switch asset.kind {
        case "resume": return "doc.fill"
        case "writing": return "pencil.line"
        default: return "link"
        }
    }

    private func flash(_ message: String) {
        toast = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if toast == message { toast = nil }
        }
    }
}

// MARK: - Workflows library (dock entry)

/// Lists workflows the student has access to; opens Macalester Job OS.
struct WorkflowLibraryView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var market: WorkflowMarketStore
    var onOpenApplyToday: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        market.buy("application_tracker")
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            onOpenApplyToday()
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "doc.text.fill")
                                .foregroundColor(Color(wfHex: "0c1207"))
                                .frame(width: 36, height: 36)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Color(wfHex: "c4f547")))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Resume builder")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                Text("Job OS space · resume, roles, apply packet")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                    }
                    .accessibilityIdentifier("workflowOpen_resumeBuilder")

                    Button {
                        market.buy("application_tracker")
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            onOpenApplyToday()
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "briefcase.fill")
                                .foregroundColor(Color(wfHex: "0c1207"))
                                .frame(width: 36, height: 36)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Color(wfHex: "c4f547")))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Apply today")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                Text("Workflow space + roles table · one paper board")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                    }
                    .accessibilityIdentifier("workflowOpen_applyToday")
                } header: {
                    Text("Your workflows")
                }

                Section {
                    ForEach(WorkflowMarketStore.catalog.filter { $0.id != "application_tracker" }) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                    .font(.system(size: 15, weight: .bold, design: .rounded))
                                    .foregroundColor(.secondary)
                                Text(item.blurb)
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(.secondary.opacity(0.8))
                            }
                            Spacer()
                            Text("Soon")
                                .font(.system(size: 11, weight: .heavy, design: .rounded))
                                .foregroundColor(.secondary)
                        }
                        .opacity(0.65)
                    }
                } header: {
                    Text("Coming later")
                }
            }
            .navigationTitle("Workflows")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .accessibilityIdentifier("workflowLibrary")
        }
    }
}

// MARK: - Store + models

@MainActor
final class MacalesterApplyStore: ObservableObject {
    @Published var seed: MacalesterApplySeed?
    @Published var loadError: String?

    var assets: [MacalesterAsset] { seed?.assets ?? [] }
    var roles: [MacalesterRole] { seed?.roles ?? [] }
    var contacts: [MacalesterContact] { seed?.contacts ?? [] }

    func load() {
        let url = Bundle.main.url(forResource: "macalesterApplySeed", withExtension: "json")
            ?? Bundle.main.url(forResource: "macalesterApplySeed", withExtension: "json", subdirectory: "Resources")
        guard let url else {
            loadError = "macalesterApplySeed.json missing"
            return
        }
        do {
            seed = try JSONDecoder().decode(MacalesterApplySeed.self, from: Data(contentsOf: url))
        } catch {
            loadError = error.localizedDescription
        }
    }
}

struct MacalesterApplySeed: Codable {
    let id: String
    let title: String
    let subtitle: String
    let school: String
    let ownerNote: String
    let assets: [MacalesterAsset]
    let roles: [MacalesterRole]
    let contacts: [MacalesterContact]
}

struct MacalesterAsset: Codable, Identifiable {
    let id: String
    let title: String
    let kind: String
    let status: String
    let detail: String
}

struct MacalesterRole: Codable, Identifiable {
    let id: String
    let rank: Int
    let actionLane: String
    let company: String
    let role: String
    let location: String
    let fitScore: Int?
    let eligibility: String
    let deadline: String?
    let applied: Bool
    let contacts: String
    let processStatus: String
    let nextAction: String
    let roleUrl: String
    let careerUrl: String
    let why: String
    let resumeReady: Bool
    let coverLetterReady: Bool
}

struct MacalesterContact: Codable, Identifiable {
    let id: String
    let name: String
    let company: String
    let role: String
    let location: String
    let warmth: String
    let status: String
    let profileUrl: String
    let bestAsk: String
    let notes: String
}

private extension Color {
    init(wfHex hex: String) {
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
