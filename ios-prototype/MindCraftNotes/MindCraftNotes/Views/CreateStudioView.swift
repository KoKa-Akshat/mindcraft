import SwiftUI
import PhotosUI

/// Work view — shrine-backed studio (TikTok / IG edits + AI tokens).
/// Opened from Field Desk “work” button.
struct CreateStudioView: View {
    @Binding var tokens: Int
    var onClose: () -> Void

    @State private var hook = ""
    @State private var caption = ""
    @State private var forTikTok = true
    @State private var forInstagram = true
    @State private var photoItem: PhotosPickerItem?
    @State private var clipLabel: String?
    @State private var busy = false
    @State private var toast: String?

    private let hookCost = 8
    private let captionCost = 12
    private let cookCost = 25

    var body: some View {
        ZStack {
            // Work view = floating shrine stage (white void), then dark cards on top.
            MalevolentShrineStage(showTitle: false)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            Color.black.opacity(0.28)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            VStack(spacing: 0) {
                topBar
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        hero
                        platforms
                        clipCard
                        copyCard
                        cookRow
                        Text("Work view · burn tokens for hooks, captions, and edit beats. Jesse’s stays one tap away.")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.55))
                            .padding(.top, 4)
                    }
                    .padding(20)
                    .padding(.bottom, 40)
                }
            }

            if let toast {
                VStack {
                    Spacer()
                    Text(toast)
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(createHex: "0c1207"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color(createHex: "c4f547")))
                        .padding(.bottom, 28)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .allowsHitTesting(false)
            }
        }
        .statusBarHidden(true)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("workView")
        .onChange(of: photoItem) { _, item in
            guard item != nil else { return }
            clipLabel = "Clip ready · vertical 9:16"
            ping("Clip dropped in")
        }
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Work")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                Text("Where wild work happens…")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.55))
            }
            Spacer()
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: 12, weight: .bold))
                Text("\(tokens)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .monospacedDigit()
                Text("tokens")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(createHex: "0c1207").opacity(0.7))
            }
            .foregroundColor(Color(createHex: "0c1207"))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color(createHex: "c4f547")))
            .accessibilityIdentifier("createStudioTokens")

            Button(action: onClose) {
                Text("jesse")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color.white.opacity(0.12)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("createStudioBackJesse")
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Make the cut people rewind")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(.white)
            Text("Drop a clip, spend a few tokens, ship a hook + caption pack for TikTok and Instagram.")
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.62))
        }
    }

    private var platforms: some View {
        HStack(spacing: 10) {
            platformChip("TikTok", on: $forTikTok, tint: "ff4ecd")
            platformChip("Instagram", on: $forInstagram, tint: "5ac8ff")
            Spacer()
        }
    }

    private func platformChip(_ title: String, on: Binding<Bool>, tint: String) -> some View {
        Button {
            on.wrappedValue.toggle()
        } label: {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(on.wrappedValue ? Color(createHex: "0c1207") : .white.opacity(0.75))
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(
                    Capsule().fill(on.wrappedValue ? Color(createHex: tint) : Color.white.opacity(0.1))
                )
        }
        .buttonStyle(.plain)
    }

    private var clipCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("CLIP")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.45))
            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 72, height: 96)
                    .overlay(
                        Image(systemName: clipLabel == nil ? "plus.viewfinder" : "film")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundColor(Color(createHex: "c4f547"))
                    )
                VStack(alignment: .leading, spacing: 6) {
                    Text(clipLabel ?? "No clip yet")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("Vertical 9:16 · under 30s hits hardest")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.5))
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Text(clipLabel == nil ? "Add clip or still" : "Swap clip")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(Color(createHex: "0c1207"))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(Color(createHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("createStudioAddClip")
                }
                Spacer(minLength: 0)
            }
        }
        .padding(16)
        .background(cardBg)
    }

    private var copyCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("COPY")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.45))

            TextField("Hook — first 1.5 seconds", text: $hook, axis: .vertical)
                .lineLimit(2...3)
                .textFieldStyle(.plain)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
                .foregroundColor(.white)
                .accessibilityIdentifier("createStudioHook")

            TextField("Caption + CTA", text: $caption, axis: .vertical)
                .lineLimit(3...5)
                .textFieldStyle(.plain)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
                .foregroundColor(.white)
                .accessibilityIdentifier("createStudioCaption")

            HStack(spacing: 10) {
                tokenButton("AI hook", cost: hookCost) { spend(hookCost, "Hook locked in") {
                    hook = sampleHook()
                }}
                tokenButton("AI caption", cost: captionCost) { spend(captionCost, "Caption cooked") {
                    caption = sampleCaption()
                }}
            }
        }
        .padding(16)
        .background(cardBg)
    }

    private var cookRow: some View {
        Button {
            spend(cookCost, "Edit pack ready · export next") {
                busy = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                    busy = false
                    if hook.isEmpty { hook = sampleHook() }
                    if caption.isEmpty { caption = sampleCaption() }
                }
            }
        } label: {
            HStack {
                if busy {
                    ProgressView().tint(Color(createHex: "0c1207"))
                } else {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 16, weight: .bold))
                }
                Text(busy ? "Cooking edit…" : "Cook edit · \(cookCost) tokens")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                Spacer()
            }
            .foregroundColor(Color(createHex: "0c1207"))
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(createHex: "c4f547"))
            )
        }
        .buttonStyle(.plain)
        .disabled(busy || (!forTikTok && !forInstagram))
        .accessibilityIdentifier("createStudioCook")
    }

    private var cardBg: some View {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(Color.white.opacity(0.06))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
    }

    private func tokenButton(_ title: String, cost: Int, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                Text("· \(cost)")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .opacity(0.7)
            }
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }

    private func spend(_ cost: Int, _ message: String, _ work: () -> Void) {
        guard tokens >= cost else {
            ping("Need \(cost - tokens) more tokens")
            return
        }
        tokens -= cost
        work()
        ping(message)
    }

    private func ping(_ message: String) {
        withAnimation(.easeInOut(duration: 0.2)) { toast = message }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.easeInOut(duration: 0.2)) {
                if toast == message { toast = nil }
            }
        }
    }

    private func sampleHook() -> String {
        let hooks = [
            "POV: your desk finally edits itself",
            "Wait for the cut at 0:07",
            "Nobody talks about this study hack…",
            "Stop scrolling — this 3-beat edit hits",
        ]
        return hooks.randomElement() ?? hooks[0]
    }

    private func sampleCaption() -> String {
        var parts: [String] = [
            "Built on MindCraft Create · save this for your next post.",
            forTikTok ? "#fyp #edits #mindcraft" : nil,
            forInstagram ? "#reels #creators" : nil,
            "Link in bio when you’re ready to cook more.",
        ].compactMap { $0 }
        return parts.joined(separator: " ")
    }
}

private extension Color {
    init(createHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
}
