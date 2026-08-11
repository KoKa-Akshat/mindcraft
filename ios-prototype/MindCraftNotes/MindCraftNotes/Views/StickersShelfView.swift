import SwiftUI

/// Shared "Stickers" panel for the cover + dashboard wizard - direct port of
/// `RotatableSticker.tsx` + `StickersShelf.tsx`, verified against both live
/// files and `StickersShelf.module.css` (near-black `#080e14` panel,
/// `#fffdf7` text, gold `#f5d348` eyebrow, 3-column grid). See
/// `StickerCatalog.swift`'s doc comment for why this is the correct system
/// to port (not the orphaned Firestore drag-placement one).
private extension Color {
    init(stickerHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// Direct port of `RotatableSticker.tsx`: drag rotates the sticker in a
/// pseudo-3D perspective tilt (feels 3D without a real mesh), a short
/// press/tap without drag still fires `onTap`. Web clamps ry to ±38deg and
/// rx to ±28deg with a 0.35 sensitivity multiplier - ported verbatim.
struct RotatableStickerView: View {
    let image: UIImage?
    var size: CGFloat = 78
    var onTap: (() -> Void)?

    @State private var rx: Double = 0
    @State private var ry: Double = 0
    @GestureState private var dragTranslation: CGSize = .zero
    @State private var dragStartRX: Double = 0
    @State private var dragStartRY: Double = 0
    @State private var moved = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } else {
                Color.clear
            }
        }
        .frame(width: size, height: size)
        .shadow(color: .black.opacity(0.28), radius: 8, x: 0, y: 6)
        .rotation3DEffect(.degrees(rx + dragTiltX), axis: (x: 1, y: 0, z: 0), perspective: 0.4)
        .rotation3DEffect(.degrees(ry + dragTiltY), axis: (x: 0, y: 1, z: 0), perspective: 0.4)
        .gesture(
            DragGesture(minimumDistance: 0)
                .updating($dragTranslation) { value, state, _ in
                    state = value.translation
                }
                .onChanged { value in
                    if abs(value.translation.width) + abs(value.translation.height) > 4 {
                        moved = true
                    }
                }
                .onEnded { value in
                    ry = clampDegrees(dragStartRY + value.translation.width * 0.35, limit: 38)
                    rx = clampDegrees(dragStartRX - value.translation.height * 0.35, limit: 28)
                    dragStartRX = rx
                    dragStartRY = ry
                    if !moved {
                        onTap?()
                    }
                    moved = false
                }
        )
    }

    private var dragTiltX: Double {
        clampDegrees(dragStartRX - dragTranslation.height * 0.35, limit: 28) - rx
    }
    private var dragTiltY: Double {
        clampDegrees(dragStartRY + dragTranslation.width * 0.35, limit: 38) - ry
    }

    private func clampDegrees(_ value: Double, limit: Double) -> Double {
        min(limit, max(-limit, value))
    }
}

/// Direct port of `StickersShelf.tsx`. Two modes, same as web:
///  - `.equip` (Cover's "Stickers" pill): tap toggles pin, up to
///    `StickerCatalog.equipCap`, "tap to pin" eyebrow.
///  - `.mascot` (Dashboard wizard tap): tap picks ONE as the mascot skin and
///    closes, "tap to set your wizard" eyebrow.
enum StickersShelfMode {
    case equip
    case mascot
}

struct StickersShelfView: View {
    let mode: StickersShelfMode
    @ObservedObject var store: StickerStore
    let onClose: () -> Void

    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        ZStack {
            Color(stickerHex: "080e14").opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture { onClose() }

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(mode == .equip ? "TAP TO PIN · UP TO \(StickerCatalog.equipCap)" : "TAP TO SET YOUR WIZARD")
                            .font(.system(size: 10, weight: .heavy, design: .rounded))
                            .tracking(1.6)
                            .foregroundColor(Color(stickerHex: "f5d348").opacity(0.8))
                        Text("Stickers")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundColor(Color(stickerHex: "fffdf7"))
                    }
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(Color(stickerHex: "fffdf7"))
                            .frame(width: 36, height: 36)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(Color(stickerHex: "fffdf7").opacity(0.16), lineWidth: 1)
                            )
                    }
                }

                Text("Complimentary while we test. Yours free for now.")
                    .font(.system(size: 15, design: .serif))
                    .italic()
                    .foregroundColor(Color(stickerHex: "fffdf7").opacity(0.72))
                    .padding(.top, 10)

                ScrollView {
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(StickerCatalog.items) { item in
                            stickerCard(item)
                        }
                    }
                    .padding(.top, 14)
                }
            }
            .padding(22)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(stickerHex: "080e14").opacity(0.94))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(Color(stickerHex: "fffdf7").opacity(0.14), lineWidth: 1)
                    )
                    .shadow(color: .black.opacity(0.4), radius: 40, x: 0, y: 24)
            )
            .frame(maxWidth: 560, maxHeight: 720)
            .padding(20)
        }
    }

    private func stickerCard(_ item: StickerItem) -> some View {
        let equipped = store.equippedIds.contains(item.id)
        let isMascot = store.mascotId == item.id
        let on = mode == .equip ? equipped : isMascot
        let full = mode == .equip && !equipped && store.equippedIds.count >= StickerCatalog.equipCap

        func pick() {
            guard !full else { return }
            switch mode {
            case .equip: store.toggleEquip(item.id)
            case .mascot: store.setMascot(item.id); onClose()
            }
        }

        return VStack(spacing: 6) {
            RotatableStickerView(image: StickerCatalog.image(for: item), size: 72, onTap: full ? nil : pick)
            Button(action: pick) {
                VStack(spacing: 4) {
                    Text(item.name)
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(stickerHex: "fffdf7"))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                    HStack(spacing: 6) {
                        Text(String(format: "$%.2f", item.priceUsd))
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(Color(stickerHex: "fffdf7").opacity(0.42))
                            .strikethrough()
                        Text("FREE")
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .tracking(0.6)
                            .foregroundColor(Color(stickerHex: "b9e86f"))
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(full)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(on ? Color(stickerHex: "247a4d").opacity(0.22) : Color(stickerHex: "f5f5f5").opacity(0.04))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(on ? Color(stickerHex: "247a4d").opacity(0.85) : Color(stickerHex: "f5f5f5").opacity(0.12), lineWidth: on ? 2 : 1)
                )
        )
        .opacity(full ? 0.45 : 1)
    }
}
