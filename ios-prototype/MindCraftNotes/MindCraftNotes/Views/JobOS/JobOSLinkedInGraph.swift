import Foundation

/// LinkedIn graph for Apply today.
///
/// Honest contract (no scrape, no OpenID magic):
/// - LinkedIn OpenID does **not** include connections or Experience.
/// - The student imports a Connections CSV (Settings → Data privacy →
///   Get a copy of your data → Connections) or pastes people.
/// - We match those people to a role by **company name**, including
///   current job, past jobs, and a documented alias table.
/// - Every reach-out card shows the exact rule that put them there.
struct JobOSLinkedInGraph: Codable, Equatable {
    var profileUrl: String
    var importedAt: String?
    var source: String
    var people: [JobOSLinkedInPerson]

    static let empty = JobOSLinkedInGraph(
        profileUrl: "",
        importedAt: nil,
        source: "",
        people: []
    )
}

struct JobOSLinkedInPerson: Codable, Identifiable, Equatable {
    let id: String
    var displayName: String
    var firstName: String
    var lastName: String
    var profileUrl: String
    var currentCompany: String
    var currentTitle: String
    var pastCompanies: [String]
    var school: String
    var connectedOn: String?
    var degree: String
    var notes: String
}

/// One person to show on a job. Built only from graph + CRM. Never invented.
struct JobOSReachOut: Identifiable, Equatable {
    let id: String
    var name: String
    var title: String
    var companyLabel: String
    var source: String
    var matchRule: String
    var whyShown: String
    var bestAsk: String
    var profileUrl: String
    var warmthRank: Int
    var status: String
    var kind: String
}

enum JobOSCompanyMatch {
    /// Known parent/child and trading-name joins. Keep this list visible
    /// on the job card via `matchRule` — do not hide aliasing.
    static let families: [[String]] = [
        [
            "augeo",
            "augeo affinity marketing",
            "augeo marketing",
            "augeo workplace",
            "augeo workplace engagement",
            "kigo",
            "kigo llc",
            "heaps",
            "heaps by augeo"
        ]
    ]

    /// Legal-suffix / filler words the spec says to strip (`MATCH_RULES.md`
    /// "Normalize"). Stripped as **whole tokens only** — the previous
    /// implementation ran `String.replacingOccurrences` per token, which
    /// deletes raw substrings anywhere they appear, not whole words. That
    /// mangled ordinary company names that merely *contain* one of these
    /// letter sequences: "Coinbase" -> "inbase" ("co"), "Cognizant" ->
    /// "gnizant" ("co"), "Scotiabank Corp" -> "s tiabank" ("co" inside
    /// "Scotiabank"). Worse, because "corp" is itself a substring of
    /// "corporation" and sits earlier in the old token list, stripping
    /// "corp" first ate the front of "corporation" and left garbage
    /// ("XYZ Corporation" -> "xyz oration") — so the exact pair the spec
    /// calls out ("corp" / "corporation") never actually normalized to the
    /// same key. Tokenizing on non-alphanumeric boundaries first and then
    /// dropping only whole tokens that exactly equal a suffix word fixes
    /// both: "XYZ Corp" and "XYZ Corporation" both canon to "xyz", and
    /// "Coinbase" is left intact.
    private static let suffixWords: Set<String> = [
        "inc", "llc", "ltd", "corp", "corporation", "company", "co", "the"
    ]

    static func canon(_ raw: String) -> String {
        var s = raw.lowercased()
        s = s.replacingOccurrences(of: "&", with: " and ")
        let boundary = CharacterSet.alphanumerics.inverted
        let words = s.components(separatedBy: boundary)
            .filter { !$0.isEmpty && !suffixWords.contains($0) }
        return words.joined(separator: " ")
    }

    static func family(of raw: String) -> Set<String> {
        let key = canon(raw)
        guard !key.isEmpty else { return [] }
        for group in families where group.contains(key) {
            return Set(group)
        }
        return [key]
    }

    static func related(_ a: String, _ b: String) -> Bool {
        let left = family(of: a)
        let right = family(of: b)
        return !left.isDisjoint(with: right)
    }

    static func companies(on person: JobOSLinkedInPerson) -> [String] {
        ([person.currentCompany] + person.pastCompanies)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}

enum JobOSReachOutBuilder {
    static func build(role: JobOSRole, graph: JobOSLinkedInGraph, crm: [JobOSContact]) -> [JobOSReachOut] {
        var rows: [JobOSReachOut] = []
        var seen = Set<String>()

        for person in graph.people {
            guard let hit = match(person: person, roleCompany: role.company) else { continue }
            let key = person.displayName.lowercased()
            guard seen.insert(key).inserted else { continue }
            rows.append(hit)
        }

        for contact in crm {
            let key = contact.name.lowercased()
            let companyHit = JobOSCompanyMatch.related(contact.company, role.company)
            guard companyHit else { continue }
            if let idx = rows.firstIndex(where: { $0.name.lowercased() == key }) {
                if !contact.bestAsk.isEmpty { rows[idx].bestAsk = contact.bestAsk }
                if !contact.profileUrl.isEmpty, rows[idx].profileUrl.isEmpty {
                    rows[idx].profileUrl = contact.profileUrl
                }
                if !contact.status.isEmpty { rows[idx].status = contact.status }
                continue
            }
            rows.append(
                JobOSReachOut(
                    id: contact.id,
                    name: contact.name,
                    title: contact.role,
                    companyLabel: contact.company,
                    source: "CRM",
                    matchRule: "CRM company “\(contact.company)” matches role company “\(role.company)” via \(aliasNote(contact.company, role.company)).",
                    whyShown: contact.warmth.isEmpty ? "Added to this company on your desk." : contact.warmth,
                    bestAsk: contact.bestAsk,
                    profileUrl: contact.profileUrl,
                    warmthRank: warmthForCRM(contact),
                    status: contact.status.isEmpty ? "Not Contacted" : contact.status,
                    kind: "crm"
                )
            )
        }

        return rows.sorted { $0.warmthRank < $1.warmthRank }
    }

    static func namesLine(_ rows: [JobOSReachOut]) -> String {
        let names = rows.map(\.name)
        if names.isEmpty { return "" }
        if names.count <= 3 { return names.joined(separator: " · ") }
        return names.prefix(3).joined(separator: " · ") + " +\(names.count - 3)"
    }

    private static func match(person: JobOSLinkedInPerson, roleCompany: String) -> JobOSReachOut? {
        let current = person.currentCompany
        let pastHits = person.pastCompanies.filter { JobOSCompanyMatch.related($0, roleCompany) }
        let currentHit = JobOSCompanyMatch.related(current, roleCompany)
        guard currentHit || !pastHits.isEmpty else { return nil }

        let tenure: String
        if currentHit {
            tenure = "Works at \(current.isEmpty ? roleCompany : current) now"
        } else {
            tenure = "Worked at \(pastHits.joined(separator: ", ")) — not there now"
        }

        let schoolNote = person.school.isEmpty ? "" : " · \(person.school)"
        let rule = currentHit
            ? "LinkedIn 1st · current company matches “\(roleCompany)” via \(aliasNote(current, roleCompany))."
            : "LinkedIn 1st · past company \(pastHits.joined(separator: ", ")) matches “\(roleCompany)” via \(aliasNote(pastHits.first ?? "", roleCompany))."

        return JobOSReachOut(
            id: person.id,
            name: person.displayName,
            title: person.currentTitle,
            companyLabel: currentHit ? current : (pastHits.first ?? roleCompany),
            source: "LinkedIn \(person.degree.isEmpty ? "1st" : person.degree)",
            matchRule: rule,
            whyShown: "\(tenure)\(schoolNote).",
            bestAsk: currentHit
                ? "Ask how this team hires and who owns intern seats."
                : "Ask how the intern cycle actually ran, and who to write first.",
            profileUrl: person.profileUrl,
            warmthRank: currentHit ? 1 : 2,
            status: "Not Contacted",
            kind: "linkedin"
        )
    }

    private static func aliasNote(_ a: String, _ b: String) -> String {
        let fa = JobOSCompanyMatch.family(of: a)
        let fb = JobOSCompanyMatch.family(of: b)
        if fa.count > 1 || fb.count > 1 {
            let joined = fa.union(fb).sorted().joined(separator: " / ")
            return "alias family (\(joined))"
        }
        return "exact/normalized name"
    }

    /// Rank tiers from `MATCH_RULES.md` "Rank" (1/2 are the LinkedIn-graph
    /// hits assigned in `match(person:roleCompany:)` below; CRM rows only
    /// ever land in 3-6):
    ///   3 CRM intern-pipeline / People · 4 Other CRM · 5 Cold executive ·
    ///   6 Verify-first (incomplete identity)
    ///
    /// The previous version checked "intern" / "people" / "pipeline" BEFORE
    /// "ceo" / "cold" / "executive", so any cold-executive contact whose own
    /// warmth note happened to *mention* "People" (e.g. "intro via People,
    /// not a first ping" — the department, not the pipeline) got bucketed
    /// into the warm intern-pipeline tier instead of the cautioned
    /// cold-executive tier. That's not a hypothetical: it happened to the
    /// app's own worked example (`loadAugeoDesignExample`) — David Kristal,
    /// the Augeo CEO, whose `bestAsk` literally says "Do not cold-ask the
    /// CEO for an intern seat," was ranking ahead of "Other CRM" contacts
    /// and tied with genuinely warm intern-pipeline people. Checking the
    /// cold/verify signals first (most specific, safety-relevant) fixes it.
    private static func warmthForCRM(_ contact: JobOSContact) -> Int {
        let blob = (contact.warmth + " " + contact.role + " " + contact.notes).lowercased()
        if blob.contains("verify") { return 6 }
        if blob.contains("cold") || blob.contains("ceo") || blob.contains("executive") || blob.contains("founder") { return 5 }
        if blob.contains("intern") || blob.contains("pipeline") || blob.contains("people") { return 3 }
        return 4
    }
}

enum JobOSLinkedInImport {
    /// Official LinkedIn Connections.csv, including the notes preamble.
    static func parseCSV(_ raw: String) -> [JobOSLinkedInPerson] {
        let lines = raw.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
        guard let headerIdx = lines.firstIndex(where: {
            let low = $0.lowercased()
            return low.contains("first name") && (low.contains("company") || low.contains("url"))
        }) else { return parsePaste(raw) }

        let header = splitCSV(lines[headerIdx]).map { $0.lowercased() }
        let firstI = header.firstIndex(where: { $0.contains("first name") })
        let lastI = header.firstIndex(where: { $0.contains("last name") })
        let urlI = header.firstIndex(where: { $0 == "url" || $0.contains("profile") })
        let companyI = header.firstIndex(where: { $0 == "company" })
        let positionI = header.firstIndex(where: { $0.contains("position") || $0.contains("title") })
        let connectedI = header.firstIndex(where: { $0.contains("connected") })

        var people: [JobOSLinkedInPerson] = []
        for line in lines.dropFirst(headerIdx + 1) {
            if line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { continue }
            let cols = splitCSV(line)
            func col(_ idx: Int?) -> String {
                guard let idx, idx < cols.count else { return "" }
                return cols[idx].trimmingCharacters(in: .whitespacesAndNewlines)
            }
            let first = col(firstI)
            let last = col(lastI)
            let name = [first, last].filter { !$0.isEmpty }.joined(separator: " ")
            guard !name.isEmpty else { continue }
            people.append(
                JobOSLinkedInPerson(
                    id: "li_\(UUID().uuidString.prefix(8))",
                    displayName: name,
                    firstName: first,
                    lastName: last,
                    profileUrl: col(urlI),
                    currentCompany: col(companyI),
                    currentTitle: col(positionI),
                    pastCompanies: [],
                    school: "",
                    connectedOn: col(connectedI),
                    degree: "1st",
                    notes: "Imported from LinkedIn Connections.csv. Past jobs are blank unless you add them — LinkedIn’s export only sends current Company."
                )
            )
        }
        return people
    }

    /// `Name | Company | Title | https://linkedin.com/in/… | past:Augeo,Kigo | school:Macalester`
    static func parsePaste(_ raw: String) -> [JobOSLinkedInPerson] {
        var people: [JobOSLinkedInPerson] = []
        for line in raw.split(whereSeparator: \.isNewline) {
            let text = String(line).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty, !text.lowercased().hasPrefix("name |") else { continue }
            let parts = text.split(separator: "|").map {
                $0.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            guard let name = parts.first, !name.isEmpty else { continue }
            var company = parts.count > 1 ? parts[1] : ""
            var title = parts.count > 2 ? parts[2] : ""
            var url = parts.first(where: { $0.lowercased().contains("linkedin.com") }) ?? ""
            var past: [String] = []
            var school = ""
            for part in parts {
                let low = part.lowercased()
                if low.hasPrefix("past:") {
                    past = part.dropFirst(5).split(separator: ",").map {
                        $0.trimmingCharacters(in: .whitespacesAndNewlines)
                    }
                } else if low.hasPrefix("school:") {
                    school = String(part.dropFirst(7)).trimmingCharacters(in: .whitespacesAndNewlines)
                } else if company.isEmpty, !part.contains("linkedin.com") {
                    company = part
                } else if title.isEmpty, !part.contains("linkedin.com"), part != company {
                    title = part
                }
            }
            if url.isEmpty, let found = parts.first(where: { $0.contains("http") }) {
                url = found
            }
            people.append(
                JobOSLinkedInPerson(
                    id: "li_\(UUID().uuidString.prefix(8))",
                    displayName: name,
                    firstName: name.split(separator: " ").first.map(String.init) ?? name,
                    lastName: name.split(separator: " ").dropFirst().joined(separator: " "),
                    profileUrl: url,
                    currentCompany: company,
                    currentTitle: title,
                    pastCompanies: past,
                    school: school,
                    connectedOn: nil,
                    degree: "1st",
                    notes: "Pasted. Past companies must be listed after past: — LinkedIn CSV does not include them."
                )
            )
        }
        return people
    }

    /// RFC 4180 (what LinkedIn's export actually uses): a literal `"` inside
    /// a quoted field is written as a doubled `""`, not a bare `"`. The
    /// previous version toggled `quoted` on every `"` unconditionally, so
    /// `""` inside a quoted field (e.g. a Position/Company value like
    /// `Senior "Growth" Lead`) flipped quoted off-then-on instead of
    /// emitting one literal `"` — silently dropping the character and, if
    /// the field also contained a comma, splitting it in the wrong place.
    /// A one-token lookahead for the doubled-quote case fixes it.
    private static func splitCSV(_ line: String) -> [String] {
        var out: [String] = []
        var cur = ""
        var quoted = false
        let chars = Array(line)
        var i = 0
        while i < chars.count {
            let ch = chars[i]
            if ch == "\"" {
                if quoted, i + 1 < chars.count, chars[i + 1] == "\"" {
                    cur.append("\"")
                    i += 2
                    continue
                }
                quoted.toggle()
            } else if ch == ",", !quoted {
                out.append(cur)
                cur = ""
            } else {
                cur.append(ch)
            }
            i += 1
        }
        out.append(cur)
        return out
    }
}
