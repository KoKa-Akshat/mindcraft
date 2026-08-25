import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

/// Local-first Apply today board - `deskOs.jobOs.state.v2` UserDefaults JSON,
/// now ALSO synced to `users/{uid}/jobOS/state` in Firestore (2026-08-22 -
/// the old "Firestore stub" comment is resolved for real here, not deferred
/// again, since this board is becoming a sellable asset - see the Mac
/// alumni add-on work in JobOSAddOn.swift). Local persist stays as the
/// instant-load/offline cache; Firestore is the real source of truth that
/// syncs in behind it, same "local-first, synced honestly" shape
/// GmailDigestStore already proves out in this codebase. Starts empty
/// (asset boxes only). Roles stay blank until the student uploads a resume
/// and connects LinkedIn.
@MainActor
final class JobOSStore: ObservableObject {
    /// v2 drops the old personal campus seed that was auto-loaded into v1.
    private static let stateKey = "deskOs.jobOs.state.v2"
    private static let graphKey = "deskOs.jobOs.linkedinGraph.v1"
    private static let legacyStateKey = "deskOs.jobOs.state"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    @Published private(set) var state: JobOSState
    @Published private(set) var graph: JobOSLinkedInGraph
    @Published private(set) var loadError: String?
    @Published var toast: String?

    private let db = Firestore.firestore()
    private var firestoreListener: ListenerRegistration?
    private var authStateHandle: NSObjectProtocol?
    private var currentUid: String?
    /// True once a real snapshot (even an empty/non-existent one) has come
    /// back from Firestore for the current uid - distinguishes "haven't
    /// heard from Firestore yet" (don't push local state up, might race a
    /// listener that's about to deliver real remote data) from "Firestore
    /// confirmed there's nothing there yet" (a genuinely fresh student,
    /// safe to push the current local state up as the seed).
    private var hasReceivedFirstSnapshot = false

    init() {
        // Drop legacy personal dump so students never see Akshat’s tracker.
        if !Self.uiTesting {
            UserDefaults.standard.removeObject(forKey: Self.legacyStateKey)
        }

        if ProcessInfo.processInfo.arguments.contains("--ui-testing-jobos") {
            // Verification-only seed (2026-08-25, Phase 3 role-list
            // redesign) - real roles never ship preloaded (see this
            // class's own doc comment), this exists purely so the new
            // card row + Link(destination:) can be screenshotted on a
            // device with no tap automation available.
            state = Self.uiTestingSeed()
        } else if let saved = Self.loadSaved() {
            state = saved
        } else if let seeded = Self.loadBundleSeed() {
            state = seeded
            Self.persist(seeded)
        } else {
            state = Self.emptyStarter()
            loadError = "macalesterApplySeed.json missing from bundle"
        }
        graph = Self.loadGraph() ?? .empty

        subscribeToFirestore()
    }

    deinit {
        firestoreListener?.remove()
        if let authStateHandle {
            Auth.auth().removeStateDidChangeListener(authStateHandle)
        }
    }

    // MARK: - Firestore sync

    private func subscribeToFirestore() {
        guard FirebaseBootstrap.isConfigured, !Self.uiTesting else { return }
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.subscribeToDoc(for: user)
        }
    }

    private func subscribeToDoc(for user: User?) {
        firestoreListener?.remove()
        firestoreListener = nil
        hasReceivedFirstSnapshot = false
        currentUid = user?.uid
        guard let user else { return }

        let docRef = db.collection("users").document(user.uid).collection("jobOS").document("state")
        firestoreListener = docRef.addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            self.hasReceivedFirstSnapshot = true
            guard let snapshot, snapshot.exists, let remote = try? snapshot.data(as: JobOSState.self) else {
                // No remote doc yet for this student - push the current
                // local state up as the real seed, rather than silently
                // leaving Firestore empty until the next local mutation.
                self.pushToFirestore()
                return
            }
            self.state = remote
            Self.persist(remote)
        }
    }

    /// Fire-and-forget, matching every other store in this codebase
    /// (GmailDigestStore, BinderStore) - a failed write shouldn't block the
    /// student from seeing the state they already have locally.
    private func pushToFirestore() {
        guard FirebaseBootstrap.isConfigured, !Self.uiTesting else { return }
        guard let uid = currentUid ?? Auth.auth().currentUser?.uid else { return }
        let docRef = db.collection("users").document(uid).collection("jobOS").document("state")
        try? docRef.setData(from: state)
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
        graph.profileUrl = url
        save()
        flash("LinkedIn connected")
    }

    /// Jesse resume agent → Apply today board. Local UserDefaults; no fake postings.
    func ingestFromJesse(fileName: String, linkedinUrl: String, suggestions: [(company: String, role: String, why: String, query: String)]) {
        if !fileName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            markResumeUploaded(fileName: fileName)
        } else if !hasResume {
            markResumeUploaded(fileName: "Jesse draft")
        }
        let li = linkedinUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        if !li.isEmpty {
            connectLinkedIn(profileUrl: li)
        }
        for (idx, row) in suggestions.prefix(3).enumerated() {
            let company = row.company.trimmingCharacters(in: .whitespacesAndNewlines)
            let role = row.role.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !company.isEmpty, !role.isEmpty else { continue }
            let already = state.roles.contains {
                $0.company.localizedCaseInsensitiveCompare(company) == .orderedSame
                    && $0.role.localizedCaseInsensitiveCompare(role) == .orderedSame
            }
            guard !already else { continue }
            addRole(
                company: company,
                role: role,
                location: "",
                lane: "Prepare",
                fit: 84 - idx * 4,
                url: "",
                why: row.why.isEmpty ? row.query : row.why
            )
        }
        flash("Jesse handed this to Apply today")
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
        why: String,
        deadline: String? = nil,
        careerUrl: String? = nil,
        source: String = "manual",
        verificationStatus: String? = nil
    ) {
        let c = company.trimmingCharacters(in: .whitespacesAndNewlines)
        let r = role.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !c.isEmpty, !r.isEmpty else { flash("Company + role required"); return }
        let nextRank = (state.roles.map(\.rank).max() ?? 0) + 1
        let due = deadline?.trimmingCharacters(in: .whitespacesAndNewlines)
        let careers = careerUrl?.trimmingCharacters(in: .whitespacesAndNewlines)
        var item = JobOSRole(
            id: "role_\(UUID().uuidString.prefix(8))",
            rank: nextRank,
            actionLane: lane,
            company: c,
            role: r,
            location: location,
            fitScore: fit,
            eligibility: fit >= 88 ? "Strong" : (fit >= 80 ? "Plausible" : "Verify Requirements"),
            deadline: (due?.isEmpty == false) ? due : nil,
            applied: false,
            dateApplied: nil,
            contacts: "",
            processStatus: "Not Started",
            nextAction: "Open listing and confirm requirements.",
            roleUrl: url,
            careerUrl: (careers?.isEmpty == false) ? (careers ?? url) : url,
            why: why.isEmpty ? "Added from Macalester Job OS." : why,
            resumeReady: state.assets.contains { $0.kind == "resume" && $0.status == "ready" },
            coverLetterReady: false,
            liveStatus: url.isEmpty ? "Verify posting" : "Live signal",
            lastChecked: JobOSTime.dayStamp(),
            source: source,
            verificationStatus: verificationStatus,
            discoveredAt: source == "discovery" ? JobOSTime.isoNow() : nil
        )
        item.contacts = JobOSReachOutBuilder.namesLine(reachOuts(for: item))
        state.roles.append(item)
        log("add_role", "\(c) · \(r) · reach-out \(item.contacts.isEmpty ? "none" : item.contacts)")
        save()
        flash(item.contacts.isEmpty ? "Added · \(c)" : "Added · \(c) · \(item.contacts)")
    }

    func reachOuts(for role: JobOSRole) -> [JobOSReachOut] {
        JobOSReachOutBuilder.build(role: role, graph: graph, crm: state.contacts)
    }

    func role(id: String) -> JobOSRole? {
        state.roles.first { $0.id == id }
    }

    func refreshReachOutLabels() {
        for i in state.roles.indices {
            state.roles[i].contacts = JobOSReachOutBuilder.namesLine(reachOuts(for: state.roles[i]))
        }
    }

    func addContact(name: String, company: String, profileUrl: String, bestAsk: String) {
        upsertContact(
            JobOSContact(
                id: "crm_\(UUID().uuidString.prefix(8))",
                name: name,
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
        )
    }

    /// Merge CRM rows by name+company. Never marks outreach sent.
    @discardableResult
    func upsertContact(_ incoming: JobOSContact) -> Bool {
        let n = incoming.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { flash("Name required"); return false }
        let company = incoming.company.trimmingCharacters(in: .whitespacesAndNewlines)
        if let i = state.contacts.firstIndex(where: {
            $0.name.localizedCaseInsensitiveCompare(n) == .orderedSame
                && $0.company.localizedCaseInsensitiveCompare(company) == .orderedSame
        }) {
            var row = state.contacts[i]
            if !incoming.role.isEmpty { row.role = incoming.role }
            if !incoming.location.isEmpty { row.location = incoming.location }
            if !incoming.warmth.isEmpty { row.warmth = incoming.warmth }
            if !incoming.profileUrl.isEmpty { row.profileUrl = incoming.profileUrl }
            if !incoming.bestAsk.isEmpty { row.bestAsk = incoming.bestAsk }
            if !incoming.notes.isEmpty { row.notes = incoming.notes }
            state.contacts[i] = row
            refreshReachOutLabels()
            log("crm", "Updated · \(n) · \(company)")
            save()
            flash("Updated contact · \(n)")
            return false
        }
        let item = JobOSContact(
            id: incoming.id.isEmpty ? "crm_\(UUID().uuidString.prefix(8))" : incoming.id,
            name: n,
            company: company,
            role: incoming.role,
            location: incoming.location,
            warmth: incoming.warmth,
            status: incoming.status.isEmpty ? "Not Contacted" : incoming.status,
            profileUrl: incoming.profileUrl,
            bestAsk: incoming.bestAsk,
            notes: incoming.notes,
            nextFollowUp: incoming.nextFollowUp
        )
        state.contacts.insert(item, at: 0)
        refreshReachOutLabels()
        log("add_contact", "\(n) · \(company)")
        save()
        flash("Contact added · \(n)")
        return true
    }

    func importLinkedInConnections(text: String, source: String) {
        let parsed = JobOSLinkedInImport.parseCSV(text)
        guard !parsed.isEmpty else {
            flash("No people found. Use Connections.csv or Name | Company | Title | URL | past:Augeo")
            return
        }
        var added = 0
        for person in parsed {
            let exists = graph.people.contains {
                (!$0.profileUrl.isEmpty && $0.profileUrl.caseInsensitiveCompare(person.profileUrl) == .orderedSame)
                    || $0.displayName.localizedCaseInsensitiveCompare(person.displayName) == .orderedSame
            }
            if exists {
                if let i = graph.people.firstIndex(where: {
                    $0.displayName.localizedCaseInsensitiveCompare(person.displayName) == .orderedSame
                }) {
                    var row = graph.people[i]
                    if !person.currentCompany.isEmpty { row.currentCompany = person.currentCompany }
                    if !person.currentTitle.isEmpty { row.currentTitle = person.currentTitle }
                    if !person.profileUrl.isEmpty { row.profileUrl = person.profileUrl }
                    if !person.pastCompanies.isEmpty { row.pastCompanies = person.pastCompanies }
                    if !person.school.isEmpty { row.school = person.school }
                    graph.people[i] = row
                }
                continue
            }
            graph.people.insert(person, at: 0)
            added += 1
        }
        graph.importedAt = JobOSTime.isoNow()
        graph.source = source
        refreshReachOutLabels()
        log("linkedin_graph", "Imported \(parsed.count) · new \(added) · source \(source)")
        save()
        flash("LinkedIn graph · \(graph.people.count) people")
    }

    func upsertLinkedInPerson(_ person: JobOSLinkedInPerson) {
        if let i = graph.people.firstIndex(where: {
            $0.displayName.localizedCaseInsensitiveCompare(person.displayName) == .orderedSame
        }) {
            graph.people[i] = person
        } else {
            graph.people.insert(person, at: 0)
        }
        refreshReachOutLabels()
        save()
    }

    /// Explicit design load — not a silent seed. Does not mark Applied.
    func loadAugeoDesignExample() {
        markResumeUploaded(fileName: "Design example resume")
        connectLinkedIn(profileUrl: "https://www.linkedin.com/in/")
        upsertLinkedInPerson(
            JobOSLinkedInPerson(
                id: "li_alhareth",
                displayName: "Alhareth Ali",
                firstName: "Alhareth",
                lastName: "Ali",
                profileUrl: "https://www.linkedin.com/in/alharethali",
                currentCompany: "Chamfr",
                currentTitle: "AI/ML Intern",
                pastCompanies: ["Kigo", "Augeo"],
                school: "Macalester College",
                connectedOn: nil,
                degree: "1st",
                notes: "You said Hareth is a 1st-degree connection. 2024 Augeo internship, SWE on Kigo. LinkedIn export would only show Chamfr unless past: is added."
            )
        )
        upsertContact(
            JobOSContact(
                id: "crm_augeo_hareth",
                name: "Alhareth Ali",
                company: "Augeo",
                role: "Software Engineer intern, Kigo (2024)",
                location: "St. Paul, MN",
                warmth: "LinkedIn 1st · Macalester · interned on Kigo",
                status: "Not Contacted",
                profileUrl: "https://www.linkedin.com/in/alharethali",
                bestAsk: "How did the 2024 intern cycle actually run, and who should I write first?",
                notes: "Also goes by Hareth. Thanked Huldah Philips and Devan Grose publicly.",
                nextFollowUp: nil
            )
        )
        upsertContact(
            JobOSContact(
                id: "crm_augeo_devan",
                name: "Devan Grose",
                company: "Kigo",
                role: "Staff Software Engineer (Kigo, 2023–2024)",
                location: "Seattle / St. Paul",
                warmth: "Named as Deven — Hareth’s intern mentor",
                status: "Not Contacted",
                profileUrl: "https://www.linkedin.com/in/devangrose",
                bestAsk: "If you still talk to the Kigo/Augeo eng team, who owns intern hiring?",
                notes: "User said Deven. Public spelling Devan Grose. Mentored Alhareth Ali. Left Kigo Dec 2024.",
                nextFollowUp: nil
            )
        )
        upsertContact(
            JobOSContact(
                id: "crm_augeo_huldah",
                name: "Huldah Cooper",
                company: "Augeo",
                role: "Vice President, People",
                location: "St. Paul, MN",
                warmth: "Macalester intern pipeline — intern-program owner",
                status: "Not Contacted",
                profileUrl: "https://www.linkedin.com/in/huldah-c-ab5521184/",
                bestAsk: "How 2027 intern recruiting runs, and who owns Kigo/tech intern seats.",
                notes: "User said Hulda Phillips. LinkedIn Huldah C. Site: Huldah Cooper.",
                nextFollowUp: nil
            )
        )
        upsertContact(
            JobOSContact(
                id: "crm_augeo_kristal",
                name: "David Kristal",
                company: "Augeo",
                role: "Founder, CEO & Co-Chairman",
                location: "St. Paul, MN",
                warmth: "Cold executive — intro via People, not a first ping",
                status: "Not Contacted",
                profileUrl: "https://www.linkedin.com/in/david-kristal-47490a/",
                bestAsk: "Do not cold-ask the CEO for an intern seat.",
                notes: "User said David Crystal. Public spelling Kristal.",
                nextFollowUp: nil
            )
        )
        if !state.roles.contains(where: { $0.company.localizedCaseInsensitiveCompare("Augeo") == .orderedSame }) {
            addRole(
                company: "Augeo",
                role: "Summer intern / local tech (verify cycle)",
                location: "St. Paul, MN",
                lane: "Network First",
                fit: 82,
                url: "",
                why: "St. Paul loyalty/engagement shop. Kigo is an Augeo company — Hareth interned there. No intern listing live on 2026-08-15.",
                deadline: nil,
                careerUrl: "https://recruiting.paylocity.com/recruiting/jobs/All/bbb7ef82-fe4e-45d2-acc1-c18505da0567/Augeo-Affinity-Marketing"
            )
        }
        refreshReachOutLabels()
        log("design_example", "Loaded Augeo example. Not Applied. Hareth is 1st-degree via Kigo/Augeo alias + past employer.")
        save()
        flash("Augeo example loaded · Hareth should appear on the job")
    }

    /// Nothing anywhere in the UI previously showed how old
    /// `state.lastSyncedAt` actually was (confirmed by reading every call
    /// site - `runDailySyncStub` writes it, nothing reads it back)
    /// (2026-08-18, explicit ask: "flag whether the stub should at least
    /// surface staleness"). This is that flag, made real: a plain age
    /// readout, not a fix for the stub itself staying a stub.
    var syncStalenessLabel: String {
        guard let raw = state.lastSyncedAt, let date = ISO8601DateFormatter().date(from: raw) else {
            return "Never synced"
        }
        let days = Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 0
        switch days {
        case ..<1: return "Synced today"
        case 1: return "Synced 1 day ago"
        default: return "Synced \(days) days ago"
        }
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
        graph = .empty
        log("reset", "Cleared Apply today board + LinkedIn graph")
        save()
        flash("Board cleared · upload to start")
    }

    private static func uiTestingSeed() -> JobOSState {
        var state = emptyStarter()
        state.assets = state.assets.map { asset in
            var asset = asset
            if asset.id == "resume" || asset.id == "link_linkedin" { asset.status = "ready" }
            return asset
        }
        state.roles = [
            JobOSRole(
                id: "seed-1", rank: 0, actionLane: "Apply Now", company: "Anthropic", role: "Software Engineering Intern",
                location: "San Francisco, CA", fitScore: 92, eligibility: "Eligible", deadline: "Sep 12",
                applied: false, dateApplied: nil, contacts: "", processStatus: "Not Started", nextAction: "Apply",
                roleUrl: "https://www.anthropic.com/careers", careerUrl: "https://www.anthropic.com/careers",
                why: "", resumeReady: true, coverLetterReady: false, liveStatus: "Confirmed live", lastChecked: nil
            ),
            JobOSRole(
                id: "seed-2", rank: 1, actionLane: "Apply + Outreach", company: "Google", role: "STEP Intern",
                location: "Mountain View, CA", fitScore: 78, eligibility: "Eligible", deadline: "Oct 1",
                applied: true, dateApplied: "Aug 20", contacts: "", processStatus: "Applied", nextAction: "Wait",
                roleUrl: "https://careers.google.com", careerUrl: "https://careers.google.com",
                why: "", resumeReady: true, coverLetterReady: false, liveStatus: "Confirmed live", lastChecked: nil
            ),
            JobOSRole(
                id: "seed-3", rank: 2, actionLane: "Prepare", company: "Local Startup", role: "Product Intern",
                location: "Remote", fitScore: nil, eligibility: "Unknown", deadline: nil,
                applied: false, dateApplied: nil, contacts: "", processStatus: "Not Started", nextAction: "Research",
                roleUrl: "", careerUrl: "",
                why: "", resumeReady: false, coverLetterReady: false, liveStatus: "Verify posting", lastChecked: nil
            )
        ]
        return state
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
        Self.persistGraph(graph)
        pushToFirestore()
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

    private static func persistGraph(_ graph: JobOSLinkedInGraph) {
        guard !uiTesting else { return }
        guard let data = try? JSONEncoder().encode(graph) else { return }
        UserDefaults.standard.set(data, forKey: graphKey)
    }

    private static func loadSaved() -> JobOSState? {
        guard !uiTesting else { return nil }
        guard let data = UserDefaults.standard.data(forKey: stateKey) else { return nil }
        return try? JSONDecoder().decode(JobOSState.self, from: data)
    }

    private static func loadGraph() -> JobOSLinkedInGraph? {
        guard !uiTesting else { return nil }
        guard let data = UserDefaults.standard.data(forKey: graphKey) else { return nil }
        return try? JSONDecoder().decode(JobOSLinkedInGraph.self, from: data)
    }

    private static func loadBundleSeed() -> JobOSState? {
        let url = Bundle.main.url(forResource: "macalesterApplySeed", withExtension: "json")
            ?? Bundle.main.url(forResource: "macalesterApplySeed", withExtension: "json", subdirectory: "Resources")
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(JobOSBundleSeed.self, from: data).asState()
    }
}
