import SwiftUI

/// The first real display surface for the ZPD/session-report pipeline
/// shipped tonight (sim telemetry -> generate-session-report.ts -> Firestore).
/// Deliberately simple - a plain, readable list, not a dashboard - since the
/// underlying signal (a handful of Gemini-written paragraphs) doesn't yet
/// support anything richer, and a padded-out "analytics" look would be
/// dishonest about how much real data is actually behind it.
struct SessionReportsView: View {
    var onClose: () -> Void

    @State private var reports: [SessionReport] = []
    @State private var isLoading = true
    @State private var hasLoadedOnce = false

    private let ink = Color(gridHex: "143a2e")
    private let cream = Color(gridHex: "fff8e9")

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && !hasLoadedOnce {
                    ProgressView().tint(ink)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if reports.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            ForEach(reports) { report in
                                reportCard(report)
                            }
                        }
                        .padding(20)
                    }
                }
            }
            .background(cream.ignoresSafeArea())
            .navigationTitle("Session Reports")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", action: onClose)
                }
            }
        }
        .task {
            reports = await SessionReportsClient.fetchRecent()
            isLoading = false
            hasLoadedOnce = true
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 34))
                .foregroundColor(ink.opacity(0.3))
            Text("No session reports yet")
                .font(.system(size: 17, weight: .semibold, design: .rounded))
                .foregroundColor(ink.opacity(0.7))
            Text("A short report is written automatically after a Work Dashboard call with Jesse ends.")
                .font(.system(size: 13, design: .rounded))
                .foregroundColor(ink.opacity(0.45))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func reportCard(_ report: SessionReport) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(Self.displayDate(report.createdAt))
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(ink.opacity(0.45))
                Spacer()
                if report.simEventCount > 0 {
                    Label("\(report.simEventCount) sim interaction\(report.simEventCount == 1 ? "" : "s")", systemImage: "sparkles")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(ink.opacity(0.45))
                }
            }
            Text(report.report)
                .font(.system(size: 15, design: .rounded))
                .foregroundColor(ink.opacity(0.9))
                .lineSpacing(4)
            if !report.topWeaknesses.isEmpty {
                Text("Worth practicing: " + report.topWeaknesses.joined(separator: ", "))
                    .font(.system(size: 12, design: .rounded).italic())
                    .foregroundColor(ink.opacity(0.5))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(ink.opacity(0.08)))
    }

    private static func displayDate(_ iso: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: iso) else { return "" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

private extension Color {
    init(gridHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
