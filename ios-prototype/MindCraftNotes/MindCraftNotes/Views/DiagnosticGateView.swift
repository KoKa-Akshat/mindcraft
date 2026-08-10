import SwiftUI

/// Real gap-scan gate shown before the Dashboard for any student who hasn't
/// completed one yet (`DiagnosticClient.isComplete()`), matching web's
/// `Dashboard.tsx` redirect-to-`/diagnostic` behavior - one rating per
/// concept, hard/kinda/easy, exactly like `Diagnostic.tsx`'s per-concept
/// confidence step. On finish, submits the same real `/seed-assessment` +
/// Firestore write web does, then calls `onComplete()` so DashboardView can
/// show the real Dashboard immediately without a re-launch.
///
/// Grouped by the real `TocSection` lanes (Diagnostic.module.css's
/// `.confGrid` - "three boxes separate so they dont have to scroll"), not a
/// single flat 29-row list - that flat version read as "one item per line"
/// with no visual grouping or brand color at all (plain system gray/blue
/// buttons), a real usability + brand miss against the web original.
struct DiagnosticGateView: View {
    let sections: [TocSection]
    let conceptDisplays: [String: ConceptDisplay]
    let onComplete: () -> Void

    @State private var confidence: [String: Confidence] = [:]
    @State private var isSubmitting = false

    private var conceptIds: [String] { sections.flatMap(\.conceptIds) }
    private var allRated: Bool { confidence.count == conceptIds.count }

    private let columns = [GridItem(.adaptive(minimum: 300, maximum: 420), spacing: 16, alignment: .top)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Quick gap scan")
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .foregroundStyle(gateInk)
                        Text("Rate how each of these feels right now - this seeds your real starting point, no pressure to be exact.")
                            .font(.system(size: 14, design: .rounded))
                            .foregroundStyle(gateInk.opacity(0.6))
                    }

                    LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
                        ForEach(sections) { section in
                            SectionRatingBox(
                                section: section,
                                conceptDisplays: conceptDisplays,
                                confidence: confidence,
                                onSelect: { id, level in confidence[id] = level }
                            )
                        }
                    }
                }
                .padding(20)
            }
            .background(Color(hex: "faf6ef"))
            .safeAreaInset(edge: .bottom) {
                Button {
                    isSubmitting = true
                    Task {
                        await DiagnosticClient.submit(confidence: confidence)
                        isSubmitting = false
                        onComplete()
                    }
                } label: {
                    if isSubmitting {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Start my Dashboard").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(hex: "247a4d"))
                .controlSize(.large)
                .disabled(!allRated || isSubmitting)
                .padding(16)
                .background(.regularMaterial)
            }
        }
    }
}

private struct SectionRatingBox: View {
    let section: TocSection
    let conceptDisplays: [String: ConceptDisplay]
    let confidence: [String: Confidence]
    let onSelect: (String, Confidence) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(section.title)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundStyle(Color(hex: section.ink))

            VStack(alignment: .leading, spacing: 12) {
                ForEach(section.conceptIds, id: \.self) { id in
                    ConceptRatingRow(
                        label: conceptDisplays[id]?.label ?? id.replacingOccurrences(of: "_", with: " ").capitalized,
                        accent: Color(hex: section.accent),
                        selected: confidence[id],
                        onSelect: { onSelect(id, $0) }
                    )
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: section.washTop), Color(hex: section.washBottom)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(hex: section.ink).opacity(0.12), lineWidth: 1)
        )
    }
}

private struct ConceptRatingRow: View {
    let label: String
    let accent: Color
    let selected: Confidence?
    let onSelect: (Confidence) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 13.5, weight: .semibold, design: .rounded))
                .foregroundStyle(gateInk)
            HStack(spacing: 6) {
                ForEach([Confidence.hard, .kinda, .easy], id: \.self) { level in
                    let isOn = selected == level
                    Button(levelLabel(level)) { onSelect(level) }
                        .font(.system(size: 11.5, weight: .semibold, design: .rounded))
                        .buttonStyle(.plain)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(isOn ? accent : Color.white.opacity(0.55))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .stroke(accent.opacity(isOn ? 0 : 0.35), lineWidth: 1)
                        )
                        .foregroundStyle(isOn ? .white : gateInk.opacity(0.75))
                }
            }
        }
    }

    private func levelLabel(_ c: Confidence) -> String {
        switch c {
        case .hard: return "Hard"
        case .kinda: return "Kinda"
        case .easy: return "Easy"
        }
    }
}

/// `--login-ink` (#143a2e) - same real ink token LoginView.swift now uses,
/// so the gate reads as the same app as the rest of the sign-in-adjacent
/// flow rather than default system colors.
private let gateInk = Color(hex: "143a2e")

/// File-scoped so it can't clash with any other file's own `Color(hex:)`.
private extension Color {
    init(hex: String) {
        var sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if sanitized.hasPrefix("#") { sanitized.removeFirst() }
        var value: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&value)
        let r = Double((value & 0xFF0000) >> 16) / 255
        let g = Double((value & 0x00FF00) >> 8) / 255
        let b = Double(value & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
