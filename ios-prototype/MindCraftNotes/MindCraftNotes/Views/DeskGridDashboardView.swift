import SwiftUI

/// Fixed-tile dashboard grid, built directly from the reference PDF Akshat
/// sent (`Presentation Screen.pdf`, pages 4-5 - see
/// `agent_work/product/field_desk_create_redesign_2026-08-15/BRIEF.md`
/// section 6). Confirmed with him this is a genuinely new, rigid
/// auto-arranging dashboard, NOT a reskin of Field Desk's free-drag card
/// canvas (`FieldDeskView`'s `movableCard`) - tiles here are not draggable,
/// they resize and reflow on their own as a real dashboard would.
///
/// Page 4 baseline: five tiles - Intel and Moodle stacked in a narrow left
/// column, Binder large and dominant spanning the full height in the
/// middle, Email Summaries and Gcal stacked in a narrow right column.
/// Page 5: adding Memo appends a fourth column and every existing column
/// shrinks to make room (a proportional-width reflow, not an overlay), with
/// one combined toolbar underneath everything. Not-yet-connected tiles
/// (Moodle) show a plain placeholder rather than faking real content.
struct DeskGridDashboardView: View {
    var onOpenBinder: () -> Void = {}
    var onClose: () -> Void = {}

    @State private var memoAdded = false
    @State private var memoDraft = ""
    @State private var searchQuery = ""

    private let gap: CGFloat = 14
    /// Column width weights - Binder is meaningfully wider than the stacked
    /// narrow columns either side of it, matching the PDF reference.
    private let narrowWeight: CGFloat = 1
    private let binderWeight: CGFloat = 1.7

    private var totalWeight: CGFloat {
        narrowWeight + binderWeight + narrowWeight + (memoAdded ? narrowWeight : 0)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            GeometryReader { geo in
                let colWidth = { (weight: CGFloat) in
                    (geo.size.width - gap * (memoAdded ? 3 : 2)) * weight / totalWeight
                }
                HStack(spacing: gap) {
                    VStack(spacing: gap) {
                        tile(.intel)
                        tile(.moodle)
                    }
                    .frame(width: colWidth(narrowWeight))

                    tile(.binder)
                        .frame(width: colWidth(binderWeight))

                    VStack(spacing: gap) {
                        tile(.emailSummaries)
                        tile(.gcal)
                    }
                    .frame(width: colWidth(narrowWeight))

                    if memoAdded {
                        tile(.memo)
                            .frame(width: colWidth(narrowWeight))
                            .transition(.asymmetric(
                                insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal: .opacity
                            ))
                    }
                }
                .padding(.horizontal, 18)
                .frame(height: geo.size.height, alignment: .top)
            }
            toolbar
        }
        .background(Color(gridHex: "0c1108").ignoresSafeArea())
        .animation(.spring(response: 0.45, dampingFraction: 0.82), value: memoAdded)
        .accessibilityIdentifier("deskGridDashboard")
    }

    private var header: some View {
        HStack {
            Text("Dashboard")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundColor(.white.opacity(0.92))
            Spacer()
            Button("Done", action: onClose)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "0c1207"))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Capsule().fill(Color(gridHex: "c4f547")))
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskGridDashboardDone")
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    // MARK: - Tiles

    private enum TileKind {
        case intel, moodle, binder, emailSummaries, gcal, memo

        var title: String {
            switch self {
            case .intel: return "Intel"
            case .moodle: return "Moodle"
            case .binder: return "Binder"
            case .emailSummaries: return "Email Summaries"
            case .gcal: return "Gcal"
            case .memo: return "Memo"
            }
        }

        var systemImage: String {
            switch self {
            case .intel: return "sparkles"
            case .moodle: return "graduationcap.fill"
            case .binder: return "books.vertical.fill"
            case .emailSummaries: return "envelope.fill"
            case .gcal: return "calendar"
            case .memo: return "note.text"
            }
        }

        /// Only Moodle has no real connection yet - shows a placeholder
        /// sign rather than faked content, per Akshat's own instruction.
        var isConnected: Bool { self != .moodle }
    }

    @ViewBuilder
    private func tile(_ kind: TileKind) -> some View {
        let isBinder = kind == .binder
        Button {
            if kind == .binder { onOpenBinder() }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: kind.systemImage)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Color(gridHex: "c4f547"))
                    Text(kind.title)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(.white.opacity(0.9))
                    Spacer(minLength: 0)
                }
                if kind.isConnected {
                    Spacer(minLength: 0)
                    if isBinder {
                        Text("Open ACT Field Book →")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(.white.opacity(0.6))
                    }
                } else {
                    Spacer(minLength: 0)
                    Text("Not connected yet")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(.white.opacity(0.35))
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white.opacity(isBinder ? 0.09 : 0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(
                        kind.isConnected ? Color.white.opacity(0.12) : Color.white.opacity(0.08),
                        style: kind.isConnected ? StrokeStyle(lineWidth: 1) : StrokeStyle(lineWidth: 1, dash: [5, 4])
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(!isBinder)
        .accessibilityIdentifier("deskGridTile_\(kind.title)")
    }

    // MARK: - Toolbar (one merged bar - search + add, not two stacked)

    private var toolbar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.white.opacity(0.4))
                TextField("Search the dashboard…", text: $searchQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.9))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Capsule().fill(Color.white.opacity(0.08)))

            Spacer(minLength: 0)

            Button {
                withAnimation { memoAdded.toggle() }
            } label: {
                Label(memoAdded ? "Remove Memo" : "Add Memo", systemImage: memoAdded ? "minus.circle.fill" : "plus.circle.fill")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gridHex: "0c1207"))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color(gridHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("deskGridDashboardAddMemo")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(
            Color.black.opacity(0.35)
                .overlay(Divider().background(Color.white.opacity(0.08)), alignment: .top)
        )
        .accessibilityIdentifier("deskGridDashboardToolbar")
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
