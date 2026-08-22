import SwiftUI
import UIKit

/// The app's first REAL bundled custom typography (2026-08-21). Three prior
/// specs in this repo's own docs (`NATIVE_APP_BUILD_PLAN.md`'s two pivots -
/// Fredoka/Nunito Sans/DM Serif Display/IBM Plex Mono/Caveat, itself a
/// replacement for an even earlier DM Sans/Source Serif 4 pairing - plus
/// `DASHBOARD_NOTEBOOK_SPEC.md`'s independent Inter/Tiempos Text pairing)
/// each declared a typography system and never shipped it: `Info.plist`'s
/// `UIAppFonts` stayed an empty array through all of them, and
/// `design: .rounded` (SF Rounded, a system font) was the de facto chrome
/// font at ~790 call sites. This file is deliberately narrower than any of
/// those three - two roles, matching what's actually bundled in
/// `Resources/Fonts/` and wired into `Info.plist`, not a resurrection of any
/// prior five-role plan:
///
/// - `Font.mcContent` - **Newsreader** (Google Fonts, SIL OFL), a variable
///   serif purpose-built for long-form on-screen reading - real distinct
///   italic cuts, generous x-height, designed at the 14pt optical size (the
///   cut actually bundled here - Newsreader ships discrete opsz instances at
///   9/14/24/36/60pt; 14pt is the closest match to this app's real
///   15-16pt body-text sizes, not the display-weighted larger cuts). For
///   lesson/book PROSE specifically - `BookReaderView.swift`'s section
///   summary/body text and `StudySessionView.swift`'s chapter body/
///   definition text - never titles, chrome, or buttons in those same
///   files. Falls back to **Source Serif 4** (Adobe, OFL), then the system
///   serif.
/// - `Font.mcChrome` - **Instrument Sans** (Google Fonts, SIL OFL), a clean
///   high-x-height humanist UI sans, for interface chrome (nav, buttons,
///   labels) - not lesson prose. Falls back to **Inter** (Google Fonts, SIL
///   OFL, bundled at its 18pt optical-size cut), then the system rounded
///   font (this app's prior de facto chrome look, kept as the final
///   fallback so an unresolved name degrades gracefully instead of jarring).
///
/// Every PostScript name below was verified by reading each bundled `.ttf`'s
/// own `name` table directly (`read_font_names.py`, ad hoc), not guessed
/// from the filename - Google Fonts' optical-size static builds mangle the
/// name (Newsreader's 14pt cut is PostScript-named `Newsreader14pt-Regular`,
/// NOT `Newsreader-Regular` as the filename alone would suggest; same
/// pattern for Inter's `Inter18pt-*`). A wrong name here silently falls back
/// to the system font with no compile error - `mcContent`/`mcChrome` guard
/// against that themselves via a real `UIFont(name:size:)` resolution check,
/// not just an Info.plist entry.
enum MindCraftFontName {
    enum Newsreader {
        static let regular = "Newsreader14pt-Regular"
        static let medium = "Newsreader14pt-Medium"
        static let semibold = "Newsreader14pt-SemiBold"
        static let bold = "Newsreader14pt-Bold"
        static let italic = "Newsreader14pt-Italic"
        static let mediumItalic = "Newsreader14pt-MediumItalic"
        static let semiboldItalic = "Newsreader14pt-SemiBoldItalic"
        static let boldItalic = "Newsreader14pt-BoldItalic"
    }
    enum SourceSerif4 {
        static let regular = "SourceSerif4-Regular"
        static let medium = "SourceSerif4-Medium"
        static let semibold = "SourceSerif4-SemiBold"
        static let bold = "SourceSerif4-Bold"
        /// Only the roman-weight italic is bundled for the fallback family
        /// (content prose is expected to resolve to Newsreader in practice -
        /// this is a last-resort substitute, not a full italic set).
        static let italic = "SourceSerif4-Italic"
    }
    enum InstrumentSans {
        static let regular = "InstrumentSans-Regular"
        static let medium = "InstrumentSans-Medium"
        static let semibold = "InstrumentSans-SemiBold"
        static let bold = "InstrumentSans-Bold"
    }
    enum Inter {
        static let regular = "Inter18pt-Regular"
        static let medium = "Inter18pt-Medium"
        static let semibold = "Inter18pt-SemiBold"
        static let bold = "Inter18pt-Bold"
    }
}

/// Coarse weight bucketing shared by both roles - each bundled family only
/// carries 4 real weights (regular/medium/semibold/bold, + italics for
/// Newsreader), so every `Font.Weight` collapses onto the nearest one rather
/// than silently failing to resolve for e.g. `.heavy` or `.light`.
private func mcWeightBucket(_ weight: Font.Weight) -> Font.Weight {
    switch weight {
    case .black, .heavy, .bold:
        return .bold
    case .semibold:
        return .semibold
    case .medium:
        return .medium
    default:
        return .regular
    }
}

private func newsreaderName(for weight: Font.Weight, italic: Bool) -> String {
    let bucket = mcWeightBucket(weight)
    switch (bucket, italic) {
    case (.bold, true): return MindCraftFontName.Newsreader.boldItalic
    case (.semibold, true): return MindCraftFontName.Newsreader.semiboldItalic
    case (.medium, true): return MindCraftFontName.Newsreader.mediumItalic
    case (_, true): return MindCraftFontName.Newsreader.italic
    case (.bold, false): return MindCraftFontName.Newsreader.bold
    case (.semibold, false): return MindCraftFontName.Newsreader.semibold
    case (.medium, false): return MindCraftFontName.Newsreader.medium
    default: return MindCraftFontName.Newsreader.regular
    }
}

private func sourceSerif4Name(for weight: Font.Weight, italic: Bool) -> String {
    if italic { return MindCraftFontName.SourceSerif4.italic }
    switch mcWeightBucket(weight) {
    case .bold: return MindCraftFontName.SourceSerif4.bold
    case .semibold: return MindCraftFontName.SourceSerif4.semibold
    case .medium: return MindCraftFontName.SourceSerif4.medium
    default: return MindCraftFontName.SourceSerif4.regular
    }
}

private func instrumentSansName(for weight: Font.Weight) -> String {
    switch mcWeightBucket(weight) {
    case .bold: return MindCraftFontName.InstrumentSans.bold
    case .semibold: return MindCraftFontName.InstrumentSans.semibold
    case .medium: return MindCraftFontName.InstrumentSans.medium
    default: return MindCraftFontName.InstrumentSans.regular
    }
}

private func interName(for weight: Font.Weight) -> String {
    switch mcWeightBucket(weight) {
    case .bold: return MindCraftFontName.Inter.bold
    case .semibold: return MindCraftFontName.Inter.semibold
    case .medium: return MindCraftFontName.Inter.medium
    default: return MindCraftFontName.Inter.regular
    }
}

extension Font {
    /// Lesson/book content prose. Newsreader -> Source Serif 4 -> system
    /// serif, each step gated on a real `UIFont(name:size:)` resolution
    /// check rather than trusting the name blindly.
    static func mcContent(size: CGFloat, weight: Font.Weight = .regular, italic: Bool = false) -> Font {
        let primary = newsreaderName(for: weight, italic: italic)
        if UIFont(name: primary, size: size) != nil {
            return Font.custom(primary, size: size)
        }
        let fallback = sourceSerif4Name(for: weight, italic: italic)
        if UIFont(name: fallback, size: size) != nil {
            return Font.custom(fallback, size: size)
        }
        return Font.system(size: size, weight: weight, design: .serif)
    }

    /// Interface chrome. Instrument Sans -> Inter -> system rounded font
    /// (this app's prior de facto chrome look), same resolution-checked
    /// fallback chain as `mcContent`.
    static func mcChrome(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let primary = instrumentSansName(for: weight)
        if UIFont(name: primary, size: size) != nil {
            return Font.custom(primary, size: size)
        }
        let fallback = interName(for: weight)
        if UIFont(name: fallback, size: size) != nil {
            return Font.custom(fallback, size: size)
        }
        return Font.system(size: size, weight: weight, design: .rounded)
    }
}
