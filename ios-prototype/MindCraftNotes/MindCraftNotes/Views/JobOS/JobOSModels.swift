import Foundation

/// Job OS - mirrors the Excel Command Center sheets/columns. Local UserDefaults
/// cache for instant load, synced to Firestore at `users/{uid}/jobOS/state`
/// (see JobOSStore's Firestore sync section) as the real source of truth.

struct JobOSState: Codable, Equatable {
    var school: String
    var title: String
    var subtitle: String
    var assets: [JobOSAsset]
    var roles: [JobOSRole]
    var contacts: [JobOSContact]
    var queue: [JobOSQueueItem]
    var syncNotes: [JobOSSyncNote]
    var sourceLog: [JobOSSourceEvent]
    var actionLanes: [String]
    var processStatuses: [String]
    var lastSyncedAt: String?
}

struct JobOSAsset: Codable, Identifiable, Equatable {
    let id: String
    var title: String
    var kind: String
    var status: String // ready | empty | linked
    var detail: String
    var markedAt: String?
}

struct JobOSRole: Codable, Identifiable, Equatable {
    let id: String
    var rank: Int
    var actionLane: String
    var company: String
    var role: String
    var location: String
    var fitScore: Int?
    var eligibility: String
    var deadline: String?
    var applied: Bool
    var dateApplied: String?
    var contacts: String
    var processStatus: String
    var nextAction: String
    var roleUrl: String
    var careerUrl: String
    var why: String
    var resumeReady: Bool
    var coverLetterReady: Bool
    var liveStatus: String
    var lastChecked: String?
    /// Added for the real discovery/reconciliation pipeline (2026-08-22).
    /// Deliberately Optional, not defaulted-non-Optional: JobOSState/JobOSRole
    /// are plain Codable with no custom decoder, so a non-Optional addition
    /// would throw decoding every already-persisted student's saved state,
    /// silently falling through to the seed/empty-starter path and wiping
    /// their real board on the next app update.
    var source: String? = nil             // "manual" | "jesse" | "discovery"
    var verificationStatus: String? = nil // "link_verified" | "llm_suggested" | "unverified"
    var discoveredAt: String? = nil
}

struct JobOSContact: Codable, Identifiable, Equatable {
    let id: String
    var name: String
    var company: String
    var role: String
    var location: String
    var warmth: String
    var status: String
    var profileUrl: String
    var bestAsk: String
    var notes: String
    var nextFollowUp: String?
}

struct JobOSQueueItem: Codable, Identifiable, Equatable {
    let id: String
    var rank: Int
    var type: String // Apply | Outreach | Follow-up | Drill | Prep
    var whoWhat: String
    var why: String
    var nextStep: String
    var link: String
    var due: String
    var done: Bool
}

struct JobOSSyncNote: Codable, Identifiable, Equatable {
    let id: String
    var createdAt: String
    var body: String
    var focus: String
}

struct JobOSSourceEvent: Codable, Identifiable, Equatable {
    let id: String
    var createdAt: String
    var eventType: String
    var detail: String
    var agent: String
}

// MARK: - Bundle seed (macalesterApplySeed.json)

struct JobOSBundleSeed: Codable {
    let id: String
    let title: String
    let subtitle: String
    let school: String
    let ownerNote: String
    let assets: [JobOSAsset]
    let roles: [SeedRole]
    let contacts: [SeedContact]
    let queue: [SeedQueue]?
    let actionLanes: [String]?
    let processStatuses: [String]?

    struct SeedRole: Codable {
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

    struct SeedContact: Codable {
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

    struct SeedQueue: Codable {
        let id: String
        let rank: Int
        let type: String
        let whoWhat: String
        let why: String
        let nextStep: String
        let link: String
        let due: String
        let done: Bool
    }

    func asState() -> JobOSState {
        JobOSState(
            school: school,
            title: title,
            subtitle: subtitle,
            assets: assets,
            roles: roles.map {
                JobOSRole(
                    id: $0.id,
                    rank: $0.rank,
                    actionLane: $0.actionLane,
                    company: $0.company,
                    role: $0.role,
                    location: $0.location,
                    fitScore: $0.fitScore,
                    eligibility: $0.eligibility,
                    deadline: $0.deadline,
                    applied: $0.applied,
                    dateApplied: nil,
                    contacts: $0.contacts,
                    processStatus: $0.processStatus,
                    nextAction: $0.nextAction,
                    roleUrl: $0.roleUrl,
                    careerUrl: $0.careerUrl,
                    why: $0.why,
                    resumeReady: $0.resumeReady,
                    coverLetterReady: $0.coverLetterReady,
                    liveStatus: $0.applied ? "In Progress" : "Verify posting",
                    lastChecked: nil
                )
            },
            contacts: contacts.map {
                JobOSContact(
                    id: $0.id,
                    name: $0.name,
                    company: $0.company,
                    role: $0.role,
                    location: $0.location,
                    warmth: $0.warmth,
                    status: $0.status,
                    profileUrl: $0.profileUrl,
                    bestAsk: $0.bestAsk,
                    notes: $0.notes,
                    nextFollowUp: nil
                )
            },
            queue: (queue ?? []).map {
                JobOSQueueItem(
                    id: $0.id,
                    rank: $0.rank,
                    type: $0.type,
                    whoWhat: $0.whoWhat,
                    why: $0.why,
                    nextStep: $0.nextStep,
                    link: $0.link,
                    due: $0.due,
                    done: $0.done
                )
            },
            syncNotes: [],
            sourceLog: [
                JobOSSourceEvent(
                    id: UUID().uuidString,
                    createdAt: JobOSTime.isoNow(),
                    eventType: "seed",
                    detail: ownerNote,
                    agent: "bundle"
                )
            ],
            actionLanes: actionLanes ?? [
                "Apply Now", "Apply + Outreach", "Prepare", "Network First", "Monitor"
            ],
            processStatuses: processStatuses ?? [
                "Not Started", "Applied", "Screen", "Interview", "Offer", "Closed", "Skipped"
            ],
            lastSyncedAt: nil
        )
    }
}

enum JobOSTime {
    static func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    static func dayStamp() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}
