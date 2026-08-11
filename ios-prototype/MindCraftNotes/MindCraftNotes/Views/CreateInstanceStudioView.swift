import SwiftUI
import UniformTypeIdentifiers

/// Hub “Create an instance” - upload materials (Figma / web Cook a Field Book
/// spirit). Files become a custom desk instance on the hub.
struct CreateInstanceStudioView: View {
    var onCreated: (CustomInstance) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var subject = "Custom"
    @State private var prompt = ""
    @State private var files: [String] = []
    @State private var showImporter = false
    @State private var cooking = false
    @State private var note: String?

    private let subjects = ["ACT Math", "Piano", "Biology", "Chemistry", "History", "Custom"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Cook a Field Book")
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                    Text("Upload notes, PDFs, or slides. We’ll bind them into a new instance on your desk - same idea as the web studio.")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)

                    TextField("Instance name", text: $name)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("createInstanceName")

                    Picker("Subject", selection: $subject) {
                        ForEach(subjects, id: \.self) { Text($0) }
                    }
                    .pickerStyle(.menu)

                    TextField("What should this book help with?", text: $prompt, axis: .vertical)
                        .lineLimit(3...6)
                        .textFieldStyle(.roundedBorder)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Uploads")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                        if files.isEmpty {
                            Text("No files yet - drop at least one.")
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .foregroundColor(.secondary)
                        } else {
                            ForEach(files, id: \.self) { f in
                                Label(f, systemImage: "doc.fill")
                                    .font(.system(size: 13, weight: .medium, design: .rounded))
                            }
                        }
                        Button {
                            showImporter = true
                        } label: {
                            Label("Upload files…", systemImage: "arrow.up.doc")
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(Color(shellHex: "0c1207"))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color(shellHex: "c4f547")))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("createInstanceUpload")
                    }
                    .padding(14)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                            .foregroundColor(Color.primary.opacity(0.25))
                    )

                    Button {
                        cook()
                    } label: {
                        Text(cooking ? "Binding…" : "Create instance")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(RoundedRectangle(cornerRadius: 14).fill(Color(shellHex: "111111")))
                    }
                    .buttonStyle(.plain)
                    .disabled(cooking)
                    .accessibilityIdentifier("createInstanceCook")

                    if let note {
                        Text(note)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(.orange)
                    }
                }
                .padding(20)
            }
            .navigationTitle("Create instance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .fileImporter(
                isPresented: $showImporter,
                allowedContentTypes: [.item, .pdf, .plainText, .image, .rtf],
                allowsMultipleSelection: true
            ) { result in
                if case .success(let urls) = result {
                    for url in urls {
                        let accessed = url.startAccessingSecurityScopedResource()
                        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                        files.append(url.lastPathComponent)
                    }
                }
            }
        }
        .accessibilityIdentifier("createInstanceStudio")
    }

    private func cook() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            note = "Name this instance first"
            return
        }
        guard !files.isEmpty else {
            note = "Upload at least one file (Figma / studio flow)"
            return
        }
        cooking = true
        // Lightweight bind - full extract→tag→generate pipeline is web
        // `createBook.js`; native keeps the durable instance + file list.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            let inst = CustomInstance(
                id: "custom_\(Int(Date().timeIntervalSince1970))",
                name: trimmed,
                subject: subject,
                prompt: prompt,
                files: files
            )
            CustomInstanceStore.shared.add(inst)
            cooking = false
            onCreated(inst)
            dismiss()
        }
    }
}

struct CustomInstance: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let subject: String
    let prompt: String
    let files: [String]
}

@MainActor
final class CustomInstanceStore: ObservableObject {
    static let shared = CustomInstanceStore()
    private static let key = "deskOs.customInstances"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    @Published private(set) var instances: [CustomInstance] = []

    init() {
        if Self.uiTesting {
            instances = []
            return
        }
        if let data = UserDefaults.standard.data(forKey: Self.key),
           let decoded = try? JSONDecoder().decode([CustomInstance].self, from: data) {
            instances = decoded
        }
    }

    func add(_ inst: CustomInstance) {
        instances.insert(inst, at: 0)
        persist()
    }

    private func persist() {
        guard !Self.uiTesting else { return }
        if let data = try? JSONEncoder().encode(instances) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }
}
