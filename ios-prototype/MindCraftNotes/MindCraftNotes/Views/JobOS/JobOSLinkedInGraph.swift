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

    static func canon(_ raw: String) -> String {
        var s = raw.lowercased()
        s = s.replacingOccurrences(of: "&", with: " and ")
        let junk = [
            ",", ".", "inc", "llc", "ltd", "corp", "corporation",
            "company", "co", "the ", "  "
        ]
        for token in junk {
            s = s.replacingOccurrences(of: token, with: " ")
        }
        return s.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
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

    private static func warmthForCRM(_ contact: JobOSContact) -> Int {
        let blob = (contact.warmth + contact.role + contact.notes).lowercased()
        if blob.contains("1st") || blob.contains("connection") { return 2 }
        if blob.contains("intern") || blob.contains("people") || blob.contains("pipeline") { return 3 }
        if blob.contains("ceo") || blob.contains("cold") || blob.contains("executive") { return 6 }
        if blob.contains("verify") { return 7 }
        return 5
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

    private static func splitCSV(_ line: String) -> [String] {
        var out: [String] = []
        var cur = ""
        var quoted = false
        for ch in line {
            if ch == "\"" {
                quoted.toggle()
            } else if ch == ",", !quoted {
                out.append(cur)
                cur = ""
            } else {
                cur.append(ch)
            }
        }
        out.append(cur)
        return out
    }
}
