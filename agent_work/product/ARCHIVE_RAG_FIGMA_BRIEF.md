# Archive RAG — Figma-style brief

**Product:** The Desk by MindCraft  
**Surface:** Open Learning Archive agent (Jesse, voice-first, exact-page fetch)  
**Try:** https://mindcraft-93858.web.app/desk-os/workflows/archive/?v=a1  
**Catalogue:** https://joinmindcraft.com/dans-archive.html  
**Canon:** `BRAND_BOOK.md` · resume glass tokens in `RESUME_AGENT_FIGMA_BRIEF.md`

Figma MCP was not signed in. Paste this file when auth exists. Do not clone Jack & Jill chrome.

---

## What this is

A **dedicated workflow**, away from the central dash. Same call language as resume: Hi → Hold → 5s “Jesse is reading” → spoken reply. The artifact is not a resume. It is an **Apple-style page box** with Dan’s exact chapter, then a link out.

Glass = chrome only (app bar, hold orb, call bar, chips). The page box is **opaque cream paper**. Do not nest glass. Covers are opaque photographs.

Dan’s books stay on `dmccreary.github.io`. We index chapter excerpts. We do not rehost.

---

## Frames (390×844)

### A. Meet
Top glass capsule: **The Desk** · **Your data**  
Title: `Hi. I’m Jesse.`  
Lede: `Ask a book. I’ll fetch the exact page from Dan’s open shelf.`  
Hold disc. `Jump on a call with Jesse`. `or browse the shelf`.  
Footer: **Your data stays yours.** Questions stay on device.

### B. Shelf
16 generated covers in a 3-column grid. Tap a spine → call with that title. `Ask Jesse` ink button.

### C. Call + page box
Live call capsule. Transcript (Jesse left / student lime).  
**Page box** (cream, not glass): book kicker · page title · quote · `Open this page`.  
Suggest chips: FFT on a $5 chip · Derivatives · Blink an LED.

### D. Catalogue wall (marketing, 1280×800)
`dans-archive.html` gallery: real covers where they exist, initials swatch elsewhere. Lightbox shows the cover. CTA to the agent.

---

## Tokens

Same as resume: ink `#143a2e`, leaf `#247a4d`, lime `#c4f547`, paper `#f4efe6`, Fredoka titles, Nunito Sans UI, Caveat on the J glyph. No Inter/SF. No emoji. No exclamation in chrome.

---

## RAG contract

`POST /api/archive-rag` `{ message }` → `{ reply, waitMs: 5000, hits: [{ bookTitle, pageTitle, pageUrl, quote }] }`

Client also loads `chunks.json` and retrieves locally if the webhook is stale.

---

## Covers (first shelf)

Generated as a series: cream / forest / one lime accent, photographed as real hardcovers.

`img/dans-covers/*.jpg` — also copied into the proto at `workflows/archive/covers/`.
