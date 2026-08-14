import SwiftUI
import WebKit

/// The Open Learning Archive (113 free intelligent textbooks), embedded
/// in-app as a module so students don't have to leave The Desk to browse it.
/// Loads the live marketing page directly rather than bundling a duplicate
/// copy of the data/UI into the app - one source of truth, always current.
struct OpenLearningArchiveView: View {
    var onClose: () -> Void

    private static let archiveURL = URL(string: "https://joinmindcraft.com/dans-archive.html")!
    private static let paper = Color(red: 255 / 255, green: 248 / 255, blue: 233 / 255)
    private static let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)

    var body: some View {
        ZStack(alignment: .topLeading) {
            Self.paper.ignoresSafeArea()

            ArchiveWebView(url: Self.archiveURL)
                .ignoresSafeArea()

            Button(action: onClose) {
                HStack(spacing: 7) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .heavy))
                    Text("Back to Desk")
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                }
                .foregroundColor(Self.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(
                    Capsule()
                        .fill(Color.white.opacity(0.95))
                        .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
                )
            }
            .buttonStyle(.plain)
            .padding(.top, 16)
            .padding(.leading, 16)
            .accessibilityIdentifier("archiveModuleClose")
            .accessibilityLabel("Back to Desk")
        }
        .accessibilityIdentifier("archiveModuleRoot")
    }
}

private struct ArchiveWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero)
        view.backgroundColor = UIColor(red: 255 / 255, green: 248 / 255, blue: 233 / 255, alpha: 1)
        view.scrollView.backgroundColor = view.backgroundColor
        if #available(iOS 16.4, *) {
            view.isInspectable = true
        }
        view.accessibilityIdentifier = "archiveModuleWebView"
        view.load(URLRequest(url: url))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
