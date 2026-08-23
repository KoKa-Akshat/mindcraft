import SwiftUI

/// Full job card. Nothing hidden: apply-by, live status, why, packet, and
/// every reach-out with the exact match rule that put them on this job.
struct JobOSRoleDetailView: View {
    @ObservedObject var store: JobOSStore
    @ObservedObject private var addOn = JobOSAddOnStore.shared
    let roleId: String
    /// See `JobOSShellView`'s own doc comment on this same parameter -
    /// threaded explicitly through the `.sheet` boundary rather than via
    /// `@EnvironmentObject`, which `.sheet` content doesn't inherit.
    var resumeDraft: ResumeAgentDraft? = nil
    var onClose: () -> Void
    var onLogApplied: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if let role = store.role(id: roleId) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            header(role)
                            applyBy(role)
                            posting(role)
                            why(role)
                            fit(role)
                            packet(role)
                            reachOut(role)
                            applyBar(role)
                        }
                        .padding(20)
                    }
                    .background(Color(jobHex: "f7f3ee"))
                    .navigationTitle(role.company)
                } else {
                    Text("This role is no longer on the board.")
                        .font(.system(size: 15, weight: .medium, design: .rounded))
                        .padding(20)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", action: onClose)
                }
            }
        }
    }

    private func header(_ role: JobOSRole) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(role.role)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundColor(Color(jobHex: "1c1a17"))
            Text([role.company, role.location].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(Color(jobHex: "8a8478"))
            HStack(spacing: 8) {
                chip(role.actionLane, fill: "c4f547")
                chip(role.processStatus, fill: "efe8dc")
                chip(role.liveStatus, fill: role.liveStatus == "Verify posting" ? "f3d9a4" : "9fd6ac")
            }
        }
    }

    private func applyBy(_ role: JobOSRole) -> some View {
        section("Apply by") {
            if let deadline = role.deadline, !deadline.isEmpty {
                Text(deadline)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(Color(jobHex: "143a2e"))
                Text("Date on this card. Confirm on the posting before you treat it as final.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(jobHex: "8a8478"))
            } else {
                Text("No date on file")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(Color(jobHex: "143a2e"))
                Text("Rolling, not posted, or we have not checked. Last checked \(role.lastChecked ?? "never").")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(jobHex: "8a8478"))
            }
        }
    }

    private func posting(_ role: JobOSRole) -> some View {
        section("The posting") {
            fact("Live status", role.liveStatus)
            fact("Last checked", role.lastChecked ?? "Never")
            fact("Role URL", role.roleUrl.isEmpty ? "None — do not claim this listing is live." : role.roleUrl)
            fact("Careers", role.careerUrl.isEmpty ? "None" : role.careerUrl)
            if let url = URL(string: role.roleUrl), !role.roleUrl.isEmpty {
                Link(destination: url) {
                    labelButton("Open role posting", fill: "9fd6ac")
                }
            }
            if let url = URL(string: role.careerUrl), !role.careerUrl.isEmpty, role.careerUrl != role.roleUrl {
                Link(destination: url) {
                    labelButton("Open careers page", fill: "efe8dc")
                }
            }
        }
    }

    private func why(_ role: JobOSRole) -> some View {
        section("Why this role") {
            Text(role.why.isEmpty ? "No why written yet." : role.why)
                .font(.system(size: 14, weight: .medium, design: .rounded))
            fact("Next action", role.nextAction.isEmpty ? "—" : role.nextAction)
        }
    }

    private func fit(_ role: JobOSRole) -> some View {
        section("Fit") {
            fact("Score", role.fitScore.map { "\($0)" } ?? "Not scored")
            fact("Eligibility", role.eligibility.isEmpty ? "—" : role.eligibility)
            fact("Lane", role.actionLane)
            fact("Process", role.processStatus)
            if role.applied {
                fact("Applied on", role.dateApplied ?? "Logged, no date")
            }
        }
    }

    private func packet(_ role: JobOSRole) -> some View {
        section("Your packet") {
            HStack(spacing: 10) {
                packetChip("Resume", role.resumeReady)
                packetChip("Cover letter", role.coverLetterReady)
            }
        }
    }

    /// Gated behind the real Mac alumni add-on entitlement (2026-08-22) -
    /// this whole section is the LinkedIn-graph/CRM alumni-matching layer
    /// being sold as a paid add-on to Mac students specifically.
    @ViewBuilder
    private func reachOut(_ role: JobOSRole) -> some View {
        if addOn.hasMacAlumniAddOn {
            reachOutContent(role)
        } else {
            section("Reach out to") {
                Text("Alumni-network matching is a Macalester add-on. Ask your program lead to enable it.")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(jobHex: "8a8478"))
            }
        }
    }

    private func reachOutContent(_ role: JobOSRole) -> some View {
        let people = store.reachOuts(for: role)
        return section("Reach out to") {
            Text("Ranked from your LinkedIn graph, then CRM. Each card shows the match rule. We do not scrape LinkedIn. OpenID cannot see connections.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(jobHex: "8a8478"))

            if people.isEmpty {
                Text("No first-degree match and no CRM row for this company. Import Connections.csv or add a person.")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(jobHex: "efe8dc")))
            }

            ForEach(Array(people.enumerated()), id: \.element.id) { idx, person in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("\(idx + 1). \(person.name)")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                        Spacer()
                        Text(person.source)
                            .font(.system(size: 10, weight: .heavy, design: .rounded))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color(jobHex: "c4f547")))
                    }
                    if !person.title.isEmpty {
                        Text(person.title)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                    }
                    Text(person.companyLabel)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color(jobHex: "8a8478"))
                    labeled("Why they are here", person.whyShown)
                    labeled("Match rule", person.matchRule)
                    labeled("Ask", person.bestAsk.isEmpty ? "Write a 15-minute advice note. Do not ask for a job in the first line." : person.bestAsk)
                    labeled("Outreach", person.status)
                    HStack(spacing: 14) {
                        if let url = URL(string: person.profileUrl), !person.profileUrl.isEmpty {
                            Link(destination: url) {
                                Text("Open LinkedIn")
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(jobHex: "143a2e"))
                                    .underline()
                            }
                        } else {
                            Text("No LinkedIn URL on file.")
                                .font(.system(size: 12, weight: .medium, design: .rounded))
                                .foregroundColor(Color(jobHex: "8a8478"))
                        }
                        // Opens a real compose window, prefilled, never
                        // sent (2026-08-18, explicit ask: the matcher
                        // already knows who and why, nothing turned that
                        // into a drafted email). No email address exists
                        // on `JobOSReachOut`/the LinkedIn CSV/CRM import -
                        // never invent one - so "to" opens blank; the
                        // student fills it in themselves.
                        Button {
                            GmailClient.shared.openComposeDraft(
                                to: "",
                                subject: draftEmailSubject(role: role, person: person),
                                body: draftEmailBody(role: role, person: person)
                            )
                        } label: {
                            Text("Draft email")
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(Color(jobHex: "143a2e"))
                                .underline()
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("jobOSReachOutDraftEmail")
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.white))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(jobHex: "d9d2c5"), lineWidth: 1))
            }
        }
    }

    private func applyBar(_ role: JobOSRole) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if role.applied {
                Text("Logged Applied \(role.dateApplied ?? ""). We did not submit this for you.")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
            } else {
                Button(action: onLogApplied) {
                    labelButton("I submitted — log Applied", fill: "c4f547")
                }
                .buttonStyle(.plain)
                Text("Only tap this after you actually submit. The desk never applies for you.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(jobHex: "8a8478"))
            }
        }
    }

    private func draftEmailSubject(role: JobOSRole, person: JobOSReachOut) -> String {
        "Quick question about \(role.company)"
    }

    /// Built only from real, already-on-screen data - the matched
    /// person's own `whyShown`/`matchRule`, the role's own `why` (fit),
    /// and (2026-08-18, explicit ask) a one-line hook from the student's
    /// own resume draft skills/roles when one has actually been built
    /// (`resumeDraft` can be nil/empty - a fresh student who hasn't
    /// talked to Jesse about their resume yet - in which case that hook
    /// is skipped entirely rather than inventing one).
    private func draftEmailBody(role: JobOSRole, person: JobOSReachOut) -> String {
        var lines: [String] = []
        lines.append("Hi \(person.name.split(separator: " ").first.map(String.init) ?? person.name),")
        lines.append("")
        lines.append("I'm a student looking into \(role.role) at \(role.company) (\(person.matchRule)).")
        if !role.why.isEmpty {
            lines.append(role.why)
        }
        if let draft = resumeDraft {
            let skillsHook = draft.skills.prefix(3).joined(separator: ", ")
            if !skillsHook.isEmpty {
                lines.append("A bit about me: \(skillsHook).")
            } else if let firstRole = draft.roles.first, !firstRole.title.isEmpty {
                lines.append("A bit about me: currently \(firstRole.title)\(firstRole.org.isEmpty ? "" : " at \(firstRole.org)").")
            }
        }
        lines.append("")
        lines.append("Would you have 15 minutes for a quick call? I'd love to hear about your own path.")
        lines.append("")
        lines.append("Thank you,")
        return lines.joined(separator: "\n")
    }

    private func section<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundColor(Color(jobHex: "8a8478"))
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(jobHex: "d9d2c5"), lineWidth: 1))
    }

    private func fact(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .foregroundColor(Color(jobHex: "8a8478"))
            Text(value)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .textSelection(.enabled)
        }
    }

    private func labeled(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .foregroundColor(Color(jobHex: "8a8478"))
            Text(value)
                .font(.system(size: 13, weight: .medium, design: .rounded))
        }
    }

    private func chip(_ title: String, fill: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .heavy, design: .rounded))
            .foregroundColor(Color(jobHex: "0c1207"))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Capsule().fill(Color(jobHex: fill)))
    }

    private func packetChip(_ title: String, _ ready: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: ready ? "checkmark.square.fill" : "square")
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
        }
        .foregroundColor(Color(jobHex: ready ? "143a2e" : "8a8478"))
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color(jobHex: ready ? "c4f547" : "efe8dc")))
    }

    private func labelButton(_ title: String, fill: String) -> some View {
        Text(title)
            .font(.system(size: 15, weight: .bold, design: .rounded))
            .foregroundColor(Color(jobHex: "0c1207"))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(jobHex: fill)))
    }
}
