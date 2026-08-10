import UIKit

/// Ported from `app/src/lib/coverStickers.ts` - the real, currently-LIVE
/// sticker catalog (12 "Codex 3D transparent set" PNGs, commit `7a7d4dfb`).
///
/// Important finding from reading the live web source directly (not assumed):
/// there are TWO sticker systems in `app/src`, and only one of them is
/// actually reachable from any page. `app/src/lib/dashboardPersonalization.ts`
/// (`DashboardSticker`/`customStickers`, Firestore-persisted, free x/y
/// drag-placement + rotation) and its consumers `StickerLayer.tsx` /
/// `JournalStyleDrawer.tsx` are real, working code - but `JournalStyleDrawer`
/// has ZERO importers anywhere in `app/src` (confirmed via
/// `grep -rln "JournalStyleDrawer" app/src` → only the file itself) and
/// `<StickerLayer` has zero JSX call sites either. That system is dead code,
/// superseded by the simpler one below - do not port it, it would not match
/// the live product (the same "don't trust an adjacent file that sounds
/// authoritative" trap the build plan's Phase 5 section already flags for
/// `dashboardPersonalization.ts`'s `DEFAULT_THEME`).
///
/// The REAL live system is `coverStickers.ts` + `StickersShelf.tsx` +
/// `RotatableSticker.tsx`, with exactly two consumers (both verified in
/// `CoverLanding.tsx` / `Dashboard.tsx` / `WizardMascot.tsx`):
///   1. Cover "Stickers" pill -> `StickersShelf` in EQUIP mode -> up to
///      `StickerCatalog.equipCap` stickers pinned into 4 fixed corner slots
///      on the cover itself (`CoverLanding.tsx`'s `equipped` state).
///   2. Dashboard wizard-mascot sprite tap -> same `StickersShelf` in PICK
///      mode -> exactly one sticker becomes the wizard's skin
///      (`Dashboard.tsx`'s `mascotId` state, via `WizardMascot`'s
///      `onSpriteClick`).
/// Both persist CLIENT-SIDE ONLY (`localStorage` on web, ported here as
/// `UserDefaults` - not Firestore, there is no per-student sticker doc on
/// the live product). Pricing is shown but not enforced yet - soft launch
/// keeps every plan free (`canEquipCoverSticker()` always returns `true` on
/// web); ported the same way, no paywall gate here either.
struct StickerItem: Identifiable, Equatable {
    let id: String
    let name: String
    let blurb: String
    let imageName: String
    let priceUsd: Double
}

enum StickerCatalog {
    /// `COVER_STICKER_EQUIP_CAP` in `coverStickers.ts`.
    static let equipCap = 4

    /// Verbatim port of `COVER_STICKERS` (id/name/blurb/price) - art files
    /// are the same PNGs, copied byte-for-byte into `Resources/stickers/`
    /// from `app/src/assets/canvas/generated/dashboard-stickers-3d/`.
    static let items: [StickerItem] = [
        // Round 12 design brief: bring the owl mascot back - as a raccoon.
        StickerItem(id: "raccoon", name: "Field Raccoon", blurb: "Curious paws. Sharp eyes. Ready for the desk.", imageName: "raccoon-mascot", priceUsd: 0),
        StickerItem(id: "wizard-spark", name: "Palm of Sparks", blurb: "Catch a green idea mid-air.", imageName: "wizard-spark-3d", priceUsd: 2.99),
        StickerItem(id: "portal-journal", name: "Portal Journal", blurb: "Open a page. Fall into a galaxy.", imageName: "portal-journal-3d", priceUsd: 3.49),
        StickerItem(id: "constellation-compass", name: "True-North Notes", blurb: "Never lose the map of what matters.", imageName: "constellation-compass-3d", priceUsd: 2.49),
        StickerItem(id: "fraction-puzzle", name: "Fraction Puzzle", blurb: "Snap the pieces. Own the whole.", imageName: "fraction-puzzle-3d", priceUsd: 1.99),
        StickerItem(id: "launch-curve", name: "Launch Curve", blurb: "Ride the arc all the way up.", imageName: "launch-curve-3d", priceUsd: 3.99),
        StickerItem(id: "pencil-rocket", name: "No. 2 Liftoff", blurb: "Write hard. Burn bright.", imageName: "pencil-rocket-3d", priceUsd: 1.49),
        StickerItem(id: "explorer-pack", name: "Explorer Pack", blurb: "Pins for every world you have tried.", imageName: "explorer-pack-3d", priceUsd: 4.49),
        StickerItem(id: "constellation-telescope", name: "Nightwatch Scope", blurb: "Spot the next topic before dawn.", imageName: "constellation-telescope-3d", priceUsd: 3.49),
        StickerItem(id: "star-trophy", name: "Supernova Cup", blurb: "First place is a little radioactive.", imageName: "star-trophy-3d", priceUsd: 4.99),
        StickerItem(id: "study-calculator", name: "Clickety Spark", blurb: "Chunky buttons. Loud answers.", imageName: "study-calculator-3d", priceUsd: 0.99),
        StickerItem(id: "field-notes-bundle", name: "Field Notes Bundle", blurb: "Tied tight. Secrets optional.", imageName: "field-notes-bundle-3d", priceUsd: 2.99),
        StickerItem(id: "keybook", name: "Keyhole Codex", blurb: "Turn the key. Open the chapter.", imageName: "keybook-3d", priceUsd: 4.49),
    ]

    /// Round 12: raccoon replaces the owl/wizard default per the design
    /// brief title. Existing UserDefaults mascot ids still win when set.
    static let defaultMascotId = "raccoon"

    static func item(id: String) -> StickerItem? {
        items.first { $0.id == id }
    }

    /// Cached so repeated shelf opens / cover redraws don't re-decode PNGs
    /// from disk every frame - same reasoning as `StoryArtLoader`, just a
    /// simple dictionary cache since the catalog is small and fixed.
    private static var imageCache: [String: UIImage] = [:]

    static func image(for item: StickerItem) -> UIImage? {
        if let cached = imageCache[item.imageName] { return cached }
        guard
            let url = Bundle.main.url(forResource: item.imageName, withExtension: "png", subdirectory: "stickers"),
            let data = try? Data(contentsOf: url),
            let image = UIImage(data: data)
        else { return nil }
        imageCache[item.imageName] = image
        return image
    }
}

/// `UserDefaults`-backed store mirroring `coverStickers.ts`'s
/// `loadEquippedCoverStickers`/`saveEquippedCoverStickers`/
/// `loadMascotStickerId`/`saveMascotStickerId` (`localStorage` on web, same
/// key names carried over so a future real sync layer could reuse them).
/// Shared as a single `@StateObject` between `CoverView` (equip) and
/// `DashboardView` (mascot pick) via environment injection, same as web's
/// two components sharing the same localStorage keys implicitly.
final class StickerStore: ObservableObject {
    private static let equippedKey = "mc-cover-equipped-stickers-v2"
    private static let mascotKey = "mc-cover-mascot-sticker"

    @Published private(set) var equippedIds: [String]
    @Published private(set) var mascotId: String

    init() {
        let defaults = UserDefaults.standard
        let knownIds = Set(StickerCatalog.items.map(\.id))
        let storedEquipped = (defaults.stringArray(forKey: Self.equippedKey) ?? [])
            .filter { knownIds.contains($0) }
            .prefix(StickerCatalog.equipCap)
        equippedIds = Array(storedEquipped)
        let storedMascot = defaults.string(forKey: Self.mascotKey)
        mascotId = (storedMascot != nil && knownIds.contains(storedMascot!)) ? storedMascot! : StickerCatalog.defaultMascotId
    }

    /// Mirrors `toggleSticker()` in `CoverLanding.tsx`: tap an equipped one
    /// to remove it, tap an unequipped one to add (capped at `equipCap`,
    /// silently no-op past the cap - same as web).
    func toggleEquip(_ id: String) {
        if let idx = equippedIds.firstIndex(of: id) {
            equippedIds.remove(at: idx)
        } else if equippedIds.count < StickerCatalog.equipCap {
            equippedIds.append(id)
        } else {
            return
        }
        UserDefaults.standard.set(equippedIds, forKey: Self.equippedKey)
    }

    func removeEquipped(_ id: String) {
        guard equippedIds.contains(id) else { return }
        equippedIds.removeAll { $0 == id }
        UserDefaults.standard.set(equippedIds, forKey: Self.equippedKey)
    }

    func setMascot(_ id: String) {
        guard StickerCatalog.item(id: id) != nil else { return }
        mascotId = id
        UserDefaults.standard.set(id, forKey: Self.mascotKey)
    }
}
