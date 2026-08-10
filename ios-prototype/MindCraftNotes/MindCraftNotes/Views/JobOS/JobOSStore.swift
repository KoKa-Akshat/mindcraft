import Foundation
import Combine

/// Local-first Apply today board - `deskOs.jobOs.state.v2` UserDefaults JSON.
/// Starts empty (asset boxes only). Roles stay blank until the student uploads
/// a resume and connects LinkedIn. Firestore stub: `users/{uid}/jobOS/*`.
@MainActor
final class JobOSStore: ObservableObject {
    /// v2 drops the old personal campus seed that was auto-loaded into v1.
    private static let stateKey = "deskOs.jobOs.state.v2"
    private static let legacyStateKey = "deskOs.jobOs.state"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    @Published private(set) var state: JobOSState
    @Published private(set) var loadError: String?
    @Published var toast: String?

    init() {
        // Drop legacy personal dump so students never see Akshat’s tracker.
        if !Self.uiTesting {
            UserDefaults.standard.removeObject(forKey: Self.legacyStateKey)
        }

        if let saved = Self.loadSaved() {
            state = saved
        } else if let seeded = Self.loadBundleSeed() {
            state = seeded
            Self.persist(seeded)
        } else {
            state = Self.emptyStarter()
            loadError = "macalesterApplySeed.json missing from bundle"
        }
    }

    /// Board unlocks after resume upload + LinkedIn connect.
    var isBoardReady: Bool {
        hasResume && hasLinkedIn
    }

    var hasResume: Bool {
        state.assets.contains { $0.kind == "resume" && $0.status == "ready" }
    }

    var hasLinkedIn: Bool {
        state.assets.contains {
            $0.id == "link_linkedin" && $0.status == "ready"
        }
    }

    var linkCount: Int {
        state.assets.filter { $0.kind == "link" && $0.status == "ready" }.count
    }

    // MARK: - Derived

    var topStrip: [JobOSQueueItem] {
        state.queue.filter { !$0.done }.sorted { $0.rank < $1.rank }.prefix(5).map { $0 }
    }

    var openRoles: [JobOSRole] {
        state.roles
            .filter { !["Closed", "Skipped"].contains($0.processStatus) }
            .sorted { $0.rank < $1.rank }
    }

    var kpiApplied: Int { state.roles.filter(\.applied).count }
    var kpiQueueLeft: Int { state.queue.filter { !$0.done }.count }
    var kpiOutreachDue: Int {
        state.contacts.filter {
            let s = $0.status.lowercased()
            return s.contains("sent") || s.contains("follow")
        }.count
    }
    var kpiInterviews: Int {
        state.roles.filter {
            ["Screen", "Interview", "Offer"].contains($0.processStatus)
        }.count
    }

    // MARK: - Mutations (honest. Applied/Done only via explicit calls)

    func toggleQueueDone(_ id: String, confirmed: Bool) {
        guard confirmed else {
            flash("Confirm before marking Done")
            return
        }
        guard let i = state.queue.firstIndex(where: { $0.id == id }) else { return }
        state.queue[i].done.toggle()
        log("queue", "Done? → \(state.queue[i].done ? "Yes" : "No") · \(state.queue[i].whoWhat)")
        save()
    }

    func markApplied(_ roleId: String, confirmed: Bool) {
        guard confirmed else {
            flash("Confirm you submitted before Applied=Yes")
            return
        }
        guard let i = state.roles.firstIndex(where: { $0.id == roleId }) else { return }
        state.roles[i].applied = true
        state.roles[i].dateApplied = JobOSTime.dayStamp()
        if state.roles[i].processStatus == "Not Started" {
            state.roles[i].processStatus = "Applied"
        }
        state.roles[i].lastChecked = JobOSTime.dayStamp()
        log("apply", "Applied · \(state.roles[i].company) · \(state.roles[i].role)")
        save()
        flash("Logged Applied · \(state.roles[i].company)")
    }

    func setProcessStatus(_ roleId: String, status: String) {
        guard let i = state.roles.firstIndex(where: { $0.id == roleId }) else { return }
        state.roles[i].processStatus = status
        if status == "Closed" || status == "Skipped" {
            // keep history - never delete
        }
        log("status", "\(state.roles[i].company) → \(status)")
        save()
    }

    func setActionLane(_ roleId: String, lane: String) {
        guard let i = state.roles.firstIndex(where: { $0.id == roleId }) else { return }
        state.roles[i].actionLane = lane
        save()
    }

    func toggleAssetReady(_ assetId: String) {
        guard let i = state.assets.firstIndex(where: { $0.id == assetId }) else { return }
        let ready = state.assets[i].status != "ready"
        state.assets[i].status = ready ? "ready" : "empty"
        state.assets[i].markedAt = ready ? JobOSTime.isoNow() : nil
        log("asset", "\(state.assets[i].title) → \(state.assets[i].status)")
        save()
    }

    func markResumeUploaded(fileName: String) {
        guard let i = state.assets.firstIndex(where: { $0.kind == "resume" }) else { return }
        state.assets[i].status = "ready"
        state.assets[i].detail = fileName
        state.assets[i].markedAt = JobOSTime.isoNow()
        log("asset", "Resume uploaded · \(fileName)")
        save()
        flash("Resume ready · \(fileName)")
    }

    func markWritingReady(note: String) {
        guard let i = state.assets.firstIndex(where: { $0.kind == "writing" }) else { return }
        let label = note.trimmingCharacters(in: .whitespacesAndNewlines)
        state.assets[i].status = "ready"
        state.assets[i].detail = label.isEmpty ? "Writing samples ready" : label
        state.assets[i].markedAt = JobOSTime.isoNow()
        log("asset", "Writing ready")
        save()
        flash("Writing pieces ready")
    }

    func connectLinkedIn(profileUrl: String) {
        let url = profileUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty else { flash("Paste your LinkedIn URL"); return }
        guard let i = state.assets.firstIndex(where: { $0.id == "link_linkedin" }) else { return }
        state.assets[i].status = "ready"
        state.assets[i].detail = url
        state.assets[i].markedAt = JobOSTime.isoNow()
        log("linkedin", "Connected · \(url)")
        save()
        flash("LinkedIn connected")
    }

    func disconnectLinkedIn() {
        guard let i = state.assets.firstIndex(where: { $0.id == "link_linkedin" }) else { return }
        state.assets[i].status = "empty"
        state.assets[i].detail = "Paste your profile URL"
        state.assets[i].markedAt = nil
        log("linkedin", "Disconnected")
        save()
        flash("LinkedIn removed")
    }

    func setExtraLink(assetId: String, url: String) {
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let i = state.assets.firstIndex(where: { $0.id == assetId && $0.kind == "link" }) else { return }
        guard assetId != "link_linkedin" else { return }
        if trimmed.isEmpty {
            state.assets[i].status = "empty"
            state.assets[i].detail = "Portfolio · GitHub · site"
            state.assets[i].markedAt = nil
            state.assets[i].title = "+ Link"
        } else {
            state.assets[i].status = "ready"
            state.assets[i].detail = trimmed
            state.assets[i].title = linkTitle(from: trimmed)
            state.assets[i].markedAt = JobOSTime.isoNow()
        }
        save()
    }

    private func linkTitle(from url: String) -> String {
        if let host = URL(string: url)?.host?.replacingOccurrences(of: "www.", with: "") {
            return host
        }
        return "Link"
    }

    func updateContactStatus(_ id: String, status: String) {
        guard let i = state.contacts.firstIndex(where: { $0.id == id }) else { return }
        state.contacts[i].status = status
        log("crm", "\(state.contacts[i].name) → \(status)")
        save()
    }

    func addRole(
        company: String,
        role: String,
        location: String,
        lane: String,
        fit: Int,
        url: String,
        why: String
    ) {
        let c = company.trimmingCharacters(in: .whitespacesAndNewlines)
        let r = role.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !c.isEmpty, !r.isEmpty else { flash("Company + role required"); return }
        let nextRank = (state.roles.map(\.rank).max() ?? 0) + 1
        let item = JobOSRole(
            id: "role_\(UUID().uuidString.prefix(8))",
            rank: nextRank,
            actionLane: lane,
            company: c,
            role: r,
            location: location,
            fitScore: fit,
            eligibility: fit >= 88 ? "Strong" : (fit >= 80 ? "Plausible" : "Verify Requirements"),
            deadline: nil,
            applied: false,
            dateApplied: nil,
            contacts: "",
            processStatus: "Not Started",
            nextAction: "Open listing and confirm requirements.",
            roleUrl: url,
            careerUrl: url,
            why: why.isEmpty ? "Added from Macalester Job OS." : why,
            resumeReady: state.assets.contains { $0.kind == "resume" && $0.status == "ready" },
            coverLetterReady: false,
            liveStatus: url.isEmpty ? "Verify posting" : "Live signal",
            lastChecked: JobOSTime.dayStamp()
        )
        state.roles.append(item)
        log("add_role", "\(c) · \(r)")
        save()
        flash("Added · \(c)")
    }

    func addContact(name: String, company: String, profileUrl: String, bestAsk: String) {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { flash("Name required"); return }
        let item = JobOSContact(
            id: "crm_\(UUID().uuidString.prefix(8))",
            name: n,
            company: company,
            role: "",
            location: "",
            warmth: "Macalester network",
            status: "Not Contacted",
            profileUrl: profileUrl,
            bestAsk: bestAsk,
            notes: "",
            nextFollowUp: nil
        )
        state.contacts.insert(item, at: 0)
        log("add_contact", n)
        save()
        flash("Contact added · \(n)")
    }

    /// Daily Sync stub - agent not mounted yet. Logs note + rebuilds a
    /// lightweight queue from open Apply Now / Apply + Outreach roles.
    func runDailySyncStub(note: String, focus: String, rebuildQueue: Bool) {
        let body = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !body.isEmpty {
            state.syncNotes.insert(
                JobOSSyncNote(
                    id: UUID().uuidString,
                    createdAt: JobOSTime.isoNow(),
                    body: body,
                    focus: focus
                ),
                at: 0
            )
        }
        if rebuildQueue {
            rebuildQueueFromPipeline(focus: focus)
        }
        state.lastSyncedAt = JobOSTime.isoNow()
        log(
            "daily_sync",
            "Stub sync · focus=\(focus) · queue=\(state.queue.count) · agent not mounted"
        )
        save()
        flash("Daily sync stub saved · agent mounts later")
    }

    func rebuildQueueFromPipeline(focus: String) {
        var items: [JobOSQueueItem] = []
        var rank = 1

        // Follow-ups / interviews first
        for role in state.roles where ["Screen", "Interview"].contains(role.processStatus) {
            items.append(
                JobOSQueueItem(
                    id: "q_auto_\(rank)",
                    rank: rank,
                    type: "Follow-up",
                    whoWhat: "\(role.company) - \(role.role)",
                    why: "Active \(role.processStatus.lowercased())",
                    nextStep: role.nextAction.isEmpty ? "Prep and follow up." : role.nextAction,
                    link: role.roleUrl,
                    due: "TODAY",
                    done: false
                )
            )
            rank += 1
            if rank > 3 { break }
        }

        let preferQuant = focus.lowercased().contains("quant")
        let applyLanes = Set(["Apply Now", "Apply + Outreach"])
        let candidates = state.roles
            .filter { applyLanes.contains($0.actionLane) && !$0.applied && $0.processStatus == "Not Started" }
            .sorted { ($0.fitScore ?? 0) > ($1.fitScore ?? 0) }

        for role in candidates {
            if preferQuant {
                let blob = (role.role + role.company + role.why).lowercased()
                if !(blob.contains("quant") || blob.contains("trading") || blob.contains("alpha")
                     || blob.contains("research") || blob.contains("prop")) {
                    continue
                }
            }
            items.append(
                JobOSQueueItem(
                    id: "q_auto_\(rank)",
                    rank: rank,
                    type: "Apply",
                    whoWhat: "\(role.company) - \(role.role)",
                    why: role.eligibility,
                    nextStep: role.nextAction.isEmpty
                        ? "Open posting, confirm requirements, submit resume."
                        : role.nextAction,
                    link: role.roleUrl,
                    due: "TODAY",
                    done: false
                )
            )
            rank += 1
            if items.count >= 10 { break }
        }

        // Warm outreach
        for contact in state.contacts where contact.status == "Not Contacted" || contact.status.isEmpty {
            items.append(
                JobOSQueueItem(
                    id: "q_auto_\(rank)",
                    rank: rank,
                    type: "Outreach",
                    whoWhat: "\(contact.name) · \(contact.company)",
                    why: contact.warmth,
                    nextStep: contact.bestAsk.isEmpty
                        ? "Draft 15-min advice note."
                        : contact.bestAsk,
                    link: contact.profileUrl,
                    due: "TODAY",
                    done: false
                )
            )
            rank += 1
            if items.count >= 12 { break }
        }

        if items.isEmpty {
            items = state.queue
        }
        state.queue = items
    }

    func clearBoard() {
        let fresh = Self.loadBundleSeed() ?? Self.emptyStarter()
        state = fresh
        log("reset", "Cleared Apply today board")
        save()
        flash("Board cleared · upload to start")
    }

    private static func emptyStarter() -> JobOSState {
        JobOSState(
            school: "Your campus",
            title: "Apply today",
            subtitle: "Upload resume · connect LinkedIn · then add roles",
            assets: [
                JobOSAsset(id: "resume", title: "Upload resume", kind: "resume", status: "empty", detail: "PDF from Files", markedAt: nil),
                JobOSAsset(id: "writing", title: "Creative writing pieces", kind: "writing", status: "empty", detail: "Essays · memos · samples", markedAt: nil),
                JobOSAsset(id: "link_linkedin", title: "Connect LinkedIn", kind: "link", status: "empty", detail: "Paste your profile URL", markedAt: nil),
                JobOSAsset(id: "link_2", title: "+ Link", kind: "link", status: "empty", detail: "Portfolio · GitHub · site", markedAt: nil),
                JobOSAsset(id: "link_3", title: "+ Link", kind: "link", status: "empty", detail: "Calendly · other", markedAt: nil)
            ],
            roles: [],
            contacts: [],
            queue: [],
            syncNotes: [],
            sourceLog: [],
            actionLanes: ["Apply Now", "Apply + Outreach", "Prepare", "Network First", "Monitor"],
            processStatuses: ["Not Started", "Applied", "Screen", "Interview", "Offer", "Closed", "Skipped"],
            lastSyncedAt: nil
        )
    }

    // MARK: - Persist

    private func save() {
        Self.persist(state)
        // Firestore stub - agent mount will push users/{uid}/jobOS/state.
        // Intentionally no network write yet (honest local-first).
    }

    private func log(_ type: String, _ detail: String) {
        state.sourceLog.insert(
            JobOSSourceEvent(
                id: UUID().uuidString,
                createdAt: JobOSTime.isoNow(),
                eventType: type,
                detail: detail,
                agent: "job-os-local"
            ),
            at: 0
        )
        if state.sourceLog.count > 80 {
            state.sourceLog = Array(state.sourceLog.prefix(80))
        }
    }

    func flash(_ message: String) {
        toast = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in
            if self?.toast == message { self?.toast = nil }
        }
    }

    private static func persist(_ state: JobOSState) {
        guard !uiTesting else { return }
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: stateKey)
    }

    private static func loadSaved() -> JobOSState? {
        guard !uiTesting else { return nil }
        guard let data = UserDefaults.standard.data(forKey: stateKey) else { return nil }
        return try? JSONDecoder().decode(JobOSState.self, from: data)
    }

    private static func loadBundleSeed() -> JobOSState? {
        let url = Bundle.main.url(forResource: "macalesterApplySeed", withExtension: "json")
            ?? Bundle.main.url(forResource: "macalesterApplySeed", withExtension: "json", subdirectory: "Resources")
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(JobOSBundleSeed.self, from: data).asState()
    }
}
