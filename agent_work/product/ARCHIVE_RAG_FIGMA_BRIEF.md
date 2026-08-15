# Archive RAG — Figma-style brief

**Product:** The Desk by MindCraft  
**Surface:** Open Learning Archive agent (Jesse, voice-first, exact-page fetch)  
**Try:** https://mindcraft-93858.web.app/desk-os/workflows/archive/?v=a3  
**Catalogue:** https://joinmindcraft.com/dans-archive.html  
**Canon:** `BRAND_BOOK.md` · resume glass tokens in `RESUME_AGENT_FIGMA_BRIEF.md`

Figma MCP was not signed in. Paste this file when auth exists. Do not clone Jack & Jill chrome.

---

## What this is

A **dedicated workflow**, away from the central dash. Same call language as resume: Hi → Hold → 5s “Jesse is reading” → spoken reply. The artifact is not a resume. It is an **Apple-style page box** with Dan’s exact chapter, then a link out.

Glass = chrome only (app bar, hold orb, call bar, chips). The page box is **opaque cream paper**. Do not nest glass. Covers are opaque photographs.

Dan’s books stay on `dmccreary.github.io`. We index chapter excerpts. We do not rehost.

---

## Frames (390×844, plus iPad 1180)

### A. Meet
Jesse asks **time** and **interest** first. Hold disc. `Make a study plan`. `or browse the shelf`.

### B. Shelf — textbook cards
Cream card, 1.5px ink border, sharp corners. Cover on top (3:4). Then ENGINEERING / title / description / stats in leaf green. Matches the Circuits reference card.

### C. Desk workspace
Call bar. Time chips then interest chips. Jesse emits **story-boxes** onto a board:

| Tone | Use |
|---|---|
| mustard `#F0C14B` / espresso | Your window (time) |
| teal `#49A7A7` / cream | Today’s book |
| magenta `#E11D74` / white | Touch the idea / load sim |
| olive, lavender, forest, lime | Pages in the plan |

Boxes: Fredoka title, DM Serif body, pill kicker, white pill CTA.

### D. Book spread
Opaque cream, ink hairline. DM Serif chapter title, Nunito body. Optional iframe to Dan’s live MicroSim (`{book}/sims/{sim-id}/main.html`). Link out. We do not rehost.

---

## RAG + plan

Jesse asks time (15 / 45 / 2h / week) then interest. Retrieval picks 1–4 chapter excerpts. If a chunk has a live `simUrl`, the box CTA loads the simulation.

---

## Tokens

Same as resume: ink `#143a2e`, leaf `#247a4d`, lime `#c4f547`, paper `#f4efe6`, Fredoka titles, Nunito Sans UI, Caveat on the J glyph. No Inter/SF. No emoji. No exclamation in chrome.

---

## RAG contract

`POST /api/archive-rag` `{ message }` → `{ reply, waitMs: 5000, hits: [{ bookTitle, pageTitle, pageUrl, quote }] }`

Client also loads `chunks.json` and retrieves locally if the webhook is stale.

---

## Covers (all 113)

Each book has its own cover at `img/dans-covers/{slug}.jpg` (copied to `workflows/archive/covers/`). Prefer the official `img/cover.png` from the book site. Logos and missing art get a cream/forest series plate. Refresh with `python3 scripts/fetch_dans_covers.py`.
