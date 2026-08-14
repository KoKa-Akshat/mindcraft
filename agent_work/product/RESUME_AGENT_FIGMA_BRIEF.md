# Resume Agent — Figma-style brief for the next implementation agent

**Product:** The Desk by MindCraft  
**Surface:** Resume builder workflow (Jesse, voice-first)  
**Tryable proto:** https://mindcraft-93858.web.app/desk-os/workflows/resume/  
**Canon:** `BRAND_BOOK.md` · `docs/canon/PEDAGOGY.md` · Apple liquid-glass pattern from [sdegenaar/liquid_glass_widgets](https://github.com/sdegenaar/liquid_glass_widgets)

Do **not** clone Jack & Jill chrome. Steal the *feel*: hi → recorder → guided call → LinkedIn/Drive. Speak Desk.

---

## 1. Design tokens (map onto glass)

| Token | Value | Use |
|---|---|---|
| Ink | `#143a2e` | Type, primary buttons |
| Leaf | `#247a4d` | Status, links |
| Lime | `#c4f547` | Student bubbles, hold-to-talk, CTA fill |
| Paper | `#f4efe6` / `#f7f4ec` | Page field |
| Polka | `radial-gradient(circle, rgba(20,58,46,.18) 1.15px, transparent 1.7px)` size `22px` | Studio/dash background — always on |
| Glass fill | `linear-gradient(180deg, rgba(255,255,255,.62), rgba(255,253,247,.38))` | Cards, topbar, call bar |
| Glass blur | `backdrop-filter: blur(22px) saturate(160%)` | Required; Reduce Transparency → solid paper |
| Stroke | `1px solid rgba(255,255,255,.55)` + inset highlight | Specular rim (liquid glass) |
| Radius | `28px` cards · `999px` pills · `22px` buttons | iOS 26, not 8px material |
| Type | Fredoka 700 titles · Nunito Sans UI · Caveat only on avatar glyph | No Inter/SF as brand |
| Motion | `cubic-bezier(.22, 1.2, .36, 1)` 0.45–0.6s enter · scale `.97` press | Jelly, not bounce-confetti |
| Voice | System TTS, en-US, rate ~0.96, prefer Samantha / Ava | Human, not chipper robot |

**Liquid glass rules (from the Flutter kit, translated):**
- Glass must sit **on** a controlled background (polka paper). Never on empty white.
- Grouped glass shares one layer (topbar + cards), not 12 different blurs.
- Morph: one physics curve for sheet present / call expand.
- Accessibility: Reduce Motion → fade only. Reduce Transparency → opaque cream cards, keep layout.

**Never:** emoji in product copy, exclamation in chrome, confetti, raccoon in chrome, “MindCraftNotes”, Jack/Jill wordmarks.

---

## 2. Screens (Figma frames, 390×844)

### A. Meet — “Hi and Recorder”
- Top glass capsule: **The Desk** (left) · **Your data** pill (right)
- Title: `Hi. I’m Jesse.`
- Lede: `I’ll help you build a resume that sounds like you.`
- Glass card: avatar J · EQ bars · Hold disc (lime)
- Primary: `Jump on a call with Jesse` (ink fill)
- Text: `or continue to LinkedIn`
- Footer glass: **Your data stays yours.** Drive folder only. Nothing sold.

### B. Link
- Title: `Link the story you already wrote.`
- Lime button: `Connect LinkedIn` (prototype may mock-pull)
- Dual tiles: `The Desk Drive folder` · `Upload a file`
- Microcopy: folder-scoped, revoke in Google Account → Security

### C. Desk (working surface)
- Live call capsule (green dot)
- Identity glass (name, headline, skill chips)
- Paper resume (cream, not glass — the artifact)
- Actions: Add a skill · Upload / Drive

### D. Call
- Transcript: Jesse left glass bubbles · student lime bubbles
- Hold/Talk control
- Suggested lines (hint only): “Add Python.” “I interned at TD.” “Connect Drive.”

---

## 3. Workflow (product, not theater)

1. Open Resume builder → auto-speak greeting (once per session).
2. Recorder captures speech → intent parse (skill / role / drive / upload / linkedin).
3. LinkedIn connect → private **on-device draft** (name, school, roles). Student can delete any field.
4. Google already signed in → Drive is **The Desk folder only**, same as Field Desk connector.
5. Upload uses Files / Drive; never implies we own the PDF.
6. Call is the same agent, not a second personality.
7. Apply today stays a sibling workflow (Job OS board). Resume builder feeds it later; do not merge screens yet.

**Data contract (honest):**
- Prototype: localStorage + file name only.
- Production: no resume JSON to MindCraft servers without an explicit Save. LinkedIn tokens via existing Google/OAuth patterns. Drive stays folder-scoped read.

---

## 4. Voice (Jesse)

Friendly like Jack. Desk-certain, not peppy.

| Beat | Line |
|---|---|
| Open | Hi. I’m Jesse. I’ll help you build a resume that sounds like you. |
| After LinkedIn | Pulled. This is a private draft on your desk. Tell me what to add or cut. |
| Drive | Drive folder linked. Only the folder you chose. |
| File | Filed {name}. It stays yours. |
| Unknown | Name the skill or the role and I will place it. |

No “Awesome!”. No “Let’s crush this.” No mascot.

---

## 5. Marketing (joinmindcraft.com)

Make **data is yours** a first-class trust beat next to learns / builds / person. Same sentence on the Meet footer. Do not bury it in legal.

---

## 6. iOS wiring

- `ResumeAgentView.swift` — WKWebView → live `/desk-os/workflows/resume/`
- Workflows library: **Resume builder** opens this, **Apply today** stays Job OS
- Chrome: The Desk text only

---

## 7. Implementation order for the next agent

1. Keep this HTML proto as visual source until native glass exists.
2. Native: SwiftUI materials + same copy, then real LinkedIn/Drive.
3. Figma file (when MCP auth exists): 4 frames, auto-layout, tokens above, component set `Glass/Capsule`, `Glass/Card`, `Paper/Resume`, `Voice/Hold`.
4. Do not restyle the whole marketing site into glass — hero stays cinematic paper; only the resume OS is liquid glass on polka.
