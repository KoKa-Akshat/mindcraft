import SwiftUI

/// Develop - the merged home for building things (2026-08-18, explicit ask:
/// "this entire thing is extremely well suited for Develop Studio... you can
/// combine workflows and books and design something called Develop... there
/// will be a toggle"). Neither `DesignStudioView` (the box/connector
/// workflow canvas) nor `BookWorkflowView` (the book-drafting flow) was
/// rewritten to get here - both are already complete, independently working
/// screens, so this is a thin toggle shell around them rather than a merge
/// of their internals. The toggle floats top-center, clear of each child's
/// own top-trailing "Done" button.
struct DevelopStudioView: View {
    var studentName: String
    var onClose: () -> Void

    enum Mode: String, CaseIterable, Identifiable {
        case workflows, books
        var id: String { rawValue }
        var label: String {
            switch self {
            case .workflows: return "Workflows"
            case .books: return "Books"
            }
        }
    }

    @State private var mode: Mode = .workflows

    var body: some View {
        ZStack {
            switch mode {
            case .workflows:
                DesignStudioView(studentName: studentName, onClose: onClose)
            case .books:
                BookWorkflowView(onClose: onClose, studentName: studentName)
            }
        }
        .overlay(alignment: .top) {
            HStack(spacing: 4) {
                ForEach(Mode.allCases) { candidate in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { mode = candidate }
                    } label: {
                        Text(candidate.label)
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(mode == candidate ? .white : Color(devHex: "143a2e"))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 9)
                            .background(
                                Capsule().fill(mode == candidate ? Color(devHex: "143a2e") : Color.clear)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("developToggle_\(candidate.rawValue)")
                }
            }
            .padding(4)
            .background(Capsule().fill(Color.white).shadow(color: .black.opacity(0.12), radius: 10, y: 4))
            .padding(.top, 18)
        }
    }
}

private extension Color {
    init(devHex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(red: r, green: g, blue: b)
    }
}
