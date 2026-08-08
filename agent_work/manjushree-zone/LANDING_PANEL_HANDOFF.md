# Landing panel handoff — the new Manjushree

Paste-ready brief for Claude / Cursor: add **one landing-page panel** that launches this sequence. Do **not** rebuild the mission.

This is the **new Manjushree** experience (2D Sword of Wisdom + post-cut story slideshow). The old 3D archive is gone.

---

## What this is

A complete **story → die → math mission → auto story slideshow** built for MindCraft. It should become **one panel / CTA on the landing page** that launches this whole sequence (or deep-links into the right step). Wire it into a relevant landing surface; do not redesign the math mission.

---

## Full student sequence (canonical)

1. **Jesse’s Kitchen (3D world)** — `worlds/world2/`
   - Enter World → **Click Projects**
   - Die appears → student **taps die to roll** → always lands on **5**
   - Short Nepal / Manjushree / quadratic recap
   - MindCraft cover-style loading card → handoff to app
2. **Sword of Wisdom / Manjushree zone** — `app/src/manjushree/`
   - Intro → Talk to villager → dialogue → **Head to the ridge** (no travel loader)
   - **Reveal the shape** (Wisdom Sight / parabola outline)
   - Roots MCQ (asks the live equation) → wrong = flood; right = continue
   - Axis + vertex height MCQs
   - Hold-to-strike → **cinematic cut (~3s)**
3. **Auto jump (no summary gate)** into Fractions & Decimals slideshow
   - Route: `/story-loop/fractions_decimals?auto=1` (prod/auth) or `/story-loop-dev/fractions_decimals?auto=1` (dev)
   - Story cards auto-advance in sequence; question slides pause until correct answer, then continue
   - Loops / “again →”

---

## Local URLs (dev)

| Entry | URL |
|--------|-----|
| Kitchen (full sequence) | `http://127.0.0.1:3001/?v=sq-lock-2` |
| Manjushree only | `http://127.0.0.1:5173/manjushree-dev` |
| Slideshow only | `http://127.0.0.1:5173/story-loop-dev/fractions_decimals?auto=1` |
| Prod Manjushree (auth) | `/manjushree` |
| Prod slideshow (auth) | `/story-loop/fractions_decimals?auto=1` |

Kitchen serves on `:3001`; Vite app on `:5173`. Cache bust for kitchen assets: `sq-lock-2`.

---

## Key files

| Piece | Path |
|--------|------|
| Kitchen die / handoff | `worlds/world2/sq-standalone.js`, `sq-standalone.css`, `index.html` (`sq-lock-2`) |
| Math zone UI | `app/src/manjushree/ManjushreeZone.tsx` + `ManjushreeZone.module.css` |
| Parabola overlay | `app/src/manjushree/ParabolaOverlay.tsx` + `.module.css` |
| Math / copy / state | `app/src/manjushree/math/*`, `state.ts`, `telemetry.ts` |
| Assets | `app/src/manjushree/assets2d/` (`valley_blocks.jpg`, `villager.png`, `sword.png`) |
| Post-cut slideshow | `app/src/pages/StorySlideshow.tsx` (reuses `ConceptChapterPage.module.css`) |
| Routes | `app/src/App.tsx` — `/manjushree`, `/manjushree-dev`, `/story-loop/:conceptId`, `/story-loop-dev/:conceptId` |
| Related design notes | `agent_work/manjushree-zone/LESSONS.md`, `MANJUSHREE_ZONE_DESIGN.md`, `MANJUSHREE_MATH_CONTENT_SPEC.md`, `ORIGINAL_SPEC.md` |

---

## Product constraints (respect these)

- Product lane owns `app/**`; don’t rewrite the ML engine.
- Student sections naming elsewhere: **Notes / Solver / Map**.
- Story-first: math frozen, narrative wraps it.
- Brand: calm, no em dashes, no emoji spam; chapter slides use paper / Fable-adjacent UI.
- CI deploys Firebase Hosting from `main` — do **not** run local `firebase deploy`.
- Landing/marketing may live at repo root / marketing host; app is `mindcraft-93858.web.app`.

---

## What Claude should do

1. Find the **landing page** surface where “panels” / feature modules live (marketing site and/or app cover / dashboard entry).
2. Add **one panel** that presents this experience (title vibe: Sword of Wisdom / cut the ridge / fractions follow-up — match brand voice).
3. CTA should start the sequence at the right entry:
   - Prefer kitchen → full quest if world hosting is available
   - Or `/manjushree` (signed-in) / slideshow-only if landing can’t host the 3D world
4. Keep the panel **one job**: invite into this sequence; don’t dump the whole quest UI into the landing hero.
5. After wiring, smoke-test: panel CTA → sequence starts; after cut → auto slideshow with `?auto=1`.

---

## Suggested panel copy (editable)

- **Title:** Sword of Wisdom
- **Line:** See the curve in the mountain. Cut with precision. Then keep learning with fractions.
- **CTA:** Enter the ridge →

---

## Do not

- Rebuild the 3D kitchen or Manjushree math from scratch
- Put Booking / diagnostic chrome back on the kitchen side-quest path
- Gate the post-cut handoff behind a summary screen again (cut → slideshow is intentional)
- Restore the archived 3D Manjushree build (removed; this 2D + slideshow path is the new Manjushree)
