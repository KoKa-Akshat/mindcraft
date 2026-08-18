import Foundation

/// One role in a Jesse-guided resume draft. Mirrors
/// `webhook/lib/handlers/resume-agent.ts`'s `ResumeRole` field-for-field.
struct ResumeAgentRole: Codable, Equatable {
    var title: String
    var org: String
    var when: String
    var bullets: [String]
}

/// A suggested role direction (a search query, not a fake job posting) -
/// mirrors `SuggestedRole` in `resume-agent.ts`.
struct ResumeAgentSuggestion: Codable, Equatable, Identifiable {
    var company: String
    var role: String
    var why: String
    var query: String

    var id: String { company + role + query }
}

/// The resume-in-progress every turn sends and receives. Mirrors
/// `resume-agent.ts`'s `ResumeDraft` exactly.
struct ResumeAgentDraft: Codable, Equatable {
    var name: String
    var headline: String
    var school: String
    var email: String
    var location: String
    var skills: [String]
    var roles: [ResumeAgentRole]
    var education: [String]
    var projects: [String]
    var files: [String]
    var linkedinUrl: String
    var drive: Bool

    static let empty = ResumeAgentDraft(
        name: "", headline: "", school: "", email: "", location: "",
        skills: [], roles: [], education: [], projects: [], files: [],
        linkedinUrl: "", drive: false
    )
}

/// Native client for `POST /api/resume-agent` - the same stateless endpoint
/// `agent_work/product/desk_os/workflows/resume/agent.js`'s `askJesse()`
/// calls, so `JesseCallSession`'s native call can drive the exact same
/// resume-building loop the web page used to. Same self-contained pattern
/// as `BookAgentClient` (this app's other native port of a web `agent.js`
/// request/response cycle).
enum ResumeAgentClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/resume-agent")!

    struct Reply {
        let reply: String
        let draft: ResumeAgentDraft
        let readyToApply: Bool
        let suggestedRoles: [ResumeAgentSuggestion]
    }

    private struct ResponseWire: Decodable {
        let reply: String?
        let draft: ResumeAgentDraft?
        let readyToApply: Bool?
        let suggestedRoles: [ResumeAgentSuggestion]?
    }

    /// `sources` mirrors `agent.js`'s own object but is empty by default -
    /// the native call is a voice-only conversation for now (no LinkedIn
    /// paste/Drive/PDF upload wired into this loop yet, see
    /// CURSOR_HANDOFF.md Assignment H). Real, honest scope: this drives
    /// name/headline/skills/roles from what the student says, nothing more,
    /// nothing fabricated to look like it does.
    static func ask(message: String, draft: ResumeAgentDraft) async -> Reply? {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 25
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "message": message,
            "draft": [
                "name": draft.name,
                "headline": draft.headline,
                "school": draft.school,
                "email": draft.email,
                "location": draft.location,
                "skills": draft.skills,
                "roles": draft.roles.map { ["title": $0.title, "org": $0.org, "when": $0.when, "bullets": $0.bullets] },
                "education": draft.education,
                "projects": draft.projects,
                "files": draft.files,
                "linkedinUrl": draft.linkedinUrl,
                "drive": draft.drive,
            ],
            "sources": [String: Any](),
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let decoded = try? JSONDecoder().decode(ResponseWire.self, from: data),
            let reply = decoded.reply
        else { return nil }

        return Reply(
            reply: reply,
            draft: decoded.draft ?? draft,
            readyToApply: decoded.readyToApply ?? false,
            suggestedRoles: decoded.suggestedRoles ?? []
        )
    }
}
