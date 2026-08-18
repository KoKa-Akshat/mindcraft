# Onboarding + Permissions Flow — Spec

Written from three real Wispr Flow onboarding screenshots (permissions priming,
language set-up, language picker modal) the user captured during their own
Wispr signup. This is a spec for review — not wired into `LoginView.swift` or
any live navigation. Loop Blake in before implementing (Product lane,
`ios-prototype/**`).

## What Wispr actually does (source material)

Five-step top stepper: `SIGN UP > PERMISSIONS > SET UP > LEARN > PERSONALIZE`,
plain caps text + chevrons, current step underlined by a thin gradient
progress sliver. Two patterns worth stealing:

1. **Priming screens before system prompts.** Each OS permission gets its own
   full screen first: one-line benefit copy in plain language ("This lets Flow
   put your spoken words in the right textbox"), a single `Allow` button, an
   info icon for more detail. The system dialog only fires after the user taps
   `Allow` on the primer — never cold.
2. **Illustrated preview.** Wispr's desktop version shows a mock of the actual
   macOS permission dialog next to the ask, so the user knows what's coming.
   iOS has no equivalent trick (you can't render a preview of `UIAlertController`
   convincingly, and Apple's HIG discourages trying) — skip this part, keep the
   priming-screen part.

Later steps (`SET UP`) shift to a centered card on a soft decorative
background — warmer, less utilitarian than the permissions step.

## Translating to MindCraft — real tokens, not invented ones

Pulled from `BRAND_BOOK.md` (§ Color system) — these are the live brand
tokens, not new picks:

| Token | Hex | Use here |
|---|---|---|
| Desk paper cream | `#f7f5f0` / `#f8faf7` | Screen background — this is "the white background" the user means |
| Desk ink (green) | `#143a2e` | Primary text, filled buttons, wordmark — this is "our dark green" |
| Chalk | `#f5f5f5` | Text on filled-ink surfaces (buttons) |
| Lime | `#c4f547` | Progress stepper fill, single primary-CTA accent — "the click," don't overuse |
| Red | `#c1121f` | Error states only |

This is literally The Desk OS palette (`BRAND_BOOK.md` line 257: "cream paper
workspace, soft ink, lime accents... a real desk a student owns, not a dark
theater") — onboarding should read as Desk OS, not Deep Field (the near-black
`#080e14` marketing/story surface). Don't reach for Deep Field here even
though it's more visually dramatic; it's reserved for a different job.

Typography: no mandated typeface, but BRAND_BOOK is explicit about what to
avoid — no rounded "friendly" fonts, no handwriting fonts, nothing that reads
children's-education, no chalkboard texture. Whatever the app currently uses
for Desk OS chrome, keep using it.

## The five steps

### 1. Sign Up

Centered card ("the box") on cream, ink-green wordmark, matches the existing
`LoginView.swift` almost exactly already — **don't redesign the auth
mechanism, just wrap it in the stepper.** Real, current state of that file:

- Google Sign-In is the primary action (outlined paper button) — real, live.
- **Apple Sign-In is implemented but disabled** (`appleSignInEnabled = false`,
  `LoginView.swift:22`) — the free personal-team signing certificate can't get
  the `applesignin` entitlement. Design the screen to still show the Apple
  button (ink-filled, per the existing `DeskPressStyle` outlined/filled
  relationship) since re-enabling it is just a flag flip once paid Developer
  Program enrollment lands — but don't build new UI assuming it's clickable
  today.
- Email/password exists as a fallback behind "Use a password instead" — keep
  it a secondary disclosure, not a third equal button.

Copy: per `BRAND_BOOK.md`'s positioning-architecture table, onboarding copy
should open at **Entry point** ("Office hours from your room"), not skip
ahead to **Long-term vision** ("operating system for student work"). First
screen headline should read like the entry point line, not the platform
pitch.

### 2. Permissions

MindCraft's iOS app currently declares exactly three system permissions
(`Info.plist`, verified) — build primers for these three, in this order
(dependency order: speech recognition needs audio capture already granted):

1. **Microphone** — `NSMicrophoneUsageDescription`. Real, current copy:
   "Jesse listens only while you hold the recorder..." — reuse this line (or a
   trimmed version) as the primer's benefit copy so the primer and the system
   prompt agree instead of saying two different things back to back.
2. **Speech Recognition** — `NSSpeechRecognitionUsageDescription`. Current
   copy: "Speech stays on device to turn what you say into resume lines." Same
   reuse-the-real-copy rule.
3. **Calendar** — `NSCalendarsUsageDescription`/`NSCalendarsFullAccessUsageDescription`.
   Current copy: "The Desk reads your Calendar to show this week's events on
   the Calendar card."

Each primer: SF Symbol icon (mic, waveform, calendar), one-line benefit copy
(the real strings above), single `Allow` button in ink-filled `DeskPressStyle`,
a small "Skip for now" text link below it — Apple rejects apps that make a
permission feel mandatory when it isn't, and none of these three actually
gate the app from being usable.

**Open question, not decided here:** should Notifications be added as a
fourth permission (study-reminder/streak use case)? Nothing in the current
codebase requests it — don't add it to this flow without that being a real
product decision first.

**Note on today's actual behavior:** right now the app requests these
permissions cold, inline, wherever `JesseCallSession`/`SpeechCaptureController`
first need them — there is no existing priming flow. This spec is filling a
real, confirmed gap, not duplicating one.

### 3. Set Up

Wispr uses this step for language selection. MindCraft already has a direct
analog, already built and live: the **diagnostic gap-scan** (`CLAUDE.md`,
"Gap scan" section) — exam pick → per-concept confidence via
`GET /exam-concepts/{exam}` → `/seed-assessment`. Point this stepper step at
that existing flow rather than inventing a new one. Concretely: card-on-cream
layout (Wispr's warmer style, matching the "Set all the languages you speak"
screenshot's centered-card-on-textured-background composition), heading
something like "What are you working toward?", exam-track chips, `Continue`.

### 4. Learn

A short explainer, 2–3 cards, one per real student-facing section using the
canonical names from `CLAUDE.md` (**Notes**, **Solver**, **Map** — never
"Session Notes"/"Problem Solver"/"Knowledge Map" in UI copy). This is new
copy, not pointing at existing code — keep it to three cards, skippable.

### 5. Personalize

Wispr ends with a settings-completion step. For MindCraft, this is the
natural spot for name confirmation / avatar, then hand off.

**Landmine:** `CLAUDE.md`'s Navigation shape section documents an explicit,
recent (2026-08-15) product decision — the app boots **directly** into
`DeskGridDashboardView` with **no intermediate loading screen**
("Your workspace is starting up" was deliberately removed). This onboarding
stepper must end by handing off straight into that same dashboard, not adding
a new boot/loading screen back in — that would undo a decision that was made
on purpose.

## Implementation notes (for whoever builds this — Blake or an agent, after review)

- Build this as a plain `NavigationStack`/`TabView`-paged flow, not as another
  full-screen overlay bolted onto `FieldDeskView`. That file already carries
  ~15 conditional overlays and a documented, repeatedly-hit touch-blocking bug
  class (`deskOverlayChromeBlocked`) — this onboarding flow is pre-auth and
  logically separate, so it doesn't need to enter that system at all. Keep it
  that way; don't let it become overlay #16.
- If any step reuses a self-identifying subview (matching the existing
  `DeskWhiteboardCard`-style pattern), don't re-apply
  `.accessibilityIdentifier()` at the parent call site — `CLAUDE.md` documents
  two confirmed cases where that clobbers the child's own identifier.
- Reuse `DeskPressStyle` and the existing outlined/filled button relationship
  from `LoginView.swift` rather than introducing a new button style for just
  this flow.

---

# Nepal launch — web app question

Recommendation: build the web app, not native-first, and specifically as a
PWA — iOS has very low real market share in Nepal (Android dominates the
student device base there), so an iOS-only flow reaches a small slice of the
actual audience; a browser-based app run install-free sidesteps that and
avoids App Store friction entirely for a first launch. Real tradeoff: this
isn't "point a browser at the existing SwiftUI app" — SwiftUI doesn't run in a
browser, so it's genuinely separate frontend work, and it needs real
low-bandwidth/offline handling (service worker caching, tight asset budgets)
since connectivity outside Kathmandu is inconsistent, plus local payment rails
(eSewa/Khalti) instead of Apple/Google IAP if there's ever a paywall. Worth a
short scoping pass before committing — say if you want that as its own doc.
