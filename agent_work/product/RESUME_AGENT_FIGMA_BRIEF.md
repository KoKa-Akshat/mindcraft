# Resume Agent — Figma-style brief for the next implementation agent

**Product:** The Desk by MindCraft  
**Surface:** Resume builder workflow (Jesse, voice-first)  
**Tryable proto:** https://mindcraft-93858.web.app/desk-os/workflows/resume/?v=r3  
**Canon:** `BRAND_BOOK.md` · `docs/canon/PEDAGOGY.md` · Apple liquid-glass from [sdegenaar/liquid_glass_widgets](https://github.com/sdegenaar/liquid_glass_widgets) (`lightweight_glass.frag` PATH A)

Do **not** clone Jack & Jill chrome. Steal the *feel*: hi → recorder → guided call → LinkedIn/Drive. Speak Desk.

---

## 1. Design tokens (map onto glass)

Desk ink on Apple’s iOS 26 glass. Numbers below are the Flutter kit’s `LiquidGlassSettings` defaults, ported into the resume proto’s WebGL layer.

| Token | Value | Use |
|---|---|---|
| Ink | `#143a2e` | Type, opaque primary fill (`Jump on a call`) |
| Leaf | `#247a4d` | Status, links |
| Lime | `#c4f547` | Student bubbles, wallpaper blobs |
| Paper | `#f4efe6` → `#efe8d8` | `GlassScaffold` wallpaper only |
| Polka | `rgba(20,58,46,.18)` dots, 22px grid | Refraction source — glass must sit on this |
| `blur` | `10` | Frost (CSS fallback `blur(10px)`) |
| `thickness` | `30` platters · `40` hold orb | Rim / lens bend |
| `refractiveIndex` | `0.15` | iOS 26 edge highlight |
| `chromaticAberration` | `0.06` on proto (kit default `0` for sheets) | RGB split at rim |
| `saturation` | `1.2` | Backdrop chroma boost |
| `lightIntensity` | `0.7` | Specular |
| `lightAngle` | `2.356` rad (135°, upper-left) | Pointer nudges this |
| `ambientStrength` | `0.4` | Body darken |
| `glassColor` | `#1FFFFFFF` (12% white) | Achromatic frost lift |
| Specular | dual: n=16 key + n=16 kick × 0.4 | Anisotropic rim |
| Hairline | `0.5px` | Not a 1px grey stroke |
| Radius | `28` cards · capsule bars · `22` buttons · circle orb | |
| Type | Fredoka 700 titles · Nunito Sans UI · Caveat on avatar glyph | No Inter/SF as brand |
| Motion | `cubic-bezier(.22, 1.2, .36, 1)` · press scale `.97` | Jelly |
| Voice | System TTS, en-US, rate ~0.96, prefer Samantha / Ava | Human, not chipper robot |

**Composition (from the kit — do not violate):**

Glass is the **navigation / control layer**, not a wrapper.

| Glass (platter) | Opaque (content) |
|---|---|
| App bar, call bar, hold orb | Titles, lede, resume paper |
| Connect / Drive / Upload tiles | `Jump on a call` ink fill |
| Data-rights strip | Transcript student lime bubbles |

- One shared wallpaper + one shader pass (`AdaptiveLiquidGlassLayer`). Never 12 independent blurs.
- **Do not nest glass.** Hold orb and LinkedIn button are siblings of cards, not children. Nested refractive widgets get `avoidsRefraction` and go flat.
- Reduce Motion → fade only. Reduce Transparency → solid `#f7f4ec`, keep layout.

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

1. Open Resume builder → greeting (Samantha/Ava). Replies wait **≥5s** (`waitMs`) with “Jesse is reading”.
2. Recorder → `POST /api/resume-agent` with draft + sources. Jesse extracts; never invents employers.
3. LinkedIn: URL + pasted About/Experience and/or LinkedIn PDF. OpenID does not include Experience.
4. Drive: Google OAuth `drive.readonly`, app only reads folder **The Desk**.
5. Upload PDF → pdf.js / PDFKit text → same agent.
6. Let’s apply → suggested search directions + iOS Apply today ingest. Student submits; we do not apply for them.

**Data contract (honest):**
- Extraction runs on `mindcraft-webhook` (`/api/resume-agent`). Draft stays on device until Let’s apply.
- LinkedIn OpenID cannot supply Experience. Paste or PDF is required for roles.
- Drive OAuth is `drive.readonly`; the app only reads folder **The Desk**.
- We never submit applications. Apply today logs Applied after the student does.

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
