import SwiftUI

// MARK: - Workflows library (dock entry)

/// Lists workflows the student has access to; opens Resume agent or Job OS.
///
/// Split out of the old `MacalesterApplyWorkflowView.swift` (2026-08-20 dead
/// code pass): that file's own top-level `MacalesterApplyWorkflowView` view
/// had zero live references and was deleted, but this sibling type in the
/// same file is a real, live call site (`FieldDeskView`'s `showWorkflowLibrary`
/// fullScreenCover) — kept here on its own so the dead view could go without
/// taking a still-used one down with it.
struct WorkflowLibraryView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var market: WorkflowMarketStore
    var onOpenResumeBuilder: () -> Void = {}
    var onOpenArchive: () -> Void = {}
    var onOpenBook: () -> Void = {}
    var onOpenApplyToday: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            onOpenResumeBuilder()
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "doc.text.fill")
                                .foregroundColor(Color(wfHex: "0c1207"))
                                .frame(width: 36, height: 36)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Color(wfHex: "c4f547")))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Resume builder")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                Text("Jesse · voice, LinkedIn, Drive folder")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                    }
                    .accessibilityIdentifier("workflowOpen_resumeBuilder")

                    Button {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            onOpenArchive()
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "books.vertical.fill")
                                .foregroundColor(Color(wfHex: "0c1207"))
                                .frame(width: 36, height: 36)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Color(wfHex: "c4f547")))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Open Learning Archive")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                Text("Jesse · exact page, live MicroSim, study plan")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                    }
                    .accessibilityIdentifier("workflowOpen_archive")

                    Button {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            onOpenBook()
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "book.pages.fill")
                                .foregroundColor(Color(wfHex: "0c1207"))
                                .frame(width: 36, height: 36)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Color(wfHex: "c4f547")))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Create a book")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                Text("Jesse · hop on a call, write your own book")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                    }
                    .accessibilityIdentifier("workflowOpen_book")

                    Button {
                        market.buy("application_tracker")
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            onOpenApplyToday()
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "briefcase.fill")
                                .foregroundColor(Color(wfHex: "0c1207"))
                                .frame(width: 36, height: 36)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Color(wfHex: "c4f547")))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Apply today")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                Text("Workflow space + roles table · one paper board")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                    }
                    .accessibilityIdentifier("workflowOpen_applyToday")
                } header: {
                    Text("Your workflows")
                }

                Section {
                    ForEach(WorkflowMarketStore.catalog.filter { $0.id != "application_tracker" }) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                    .font(.system(size: 15, weight: .bold, design: .rounded))
                                    .foregroundColor(.secondary)
                                Text(item.blurb)
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(.secondary.opacity(0.8))
                            }
                            Spacer()
                            Text("Soon")
                                .font(.system(size: 11, weight: .heavy, design: .rounded))
                                .foregroundColor(.secondary)
                        }
                        .opacity(0.65)
                    }
                } header: {
                    Text("Coming later")
                }
            }
            .navigationTitle("Workflows")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .accessibilityIdentifier("workflowLibrary")
        }
    }
}

private extension Color {
    init(wfHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
