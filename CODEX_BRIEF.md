# MindCraft: Codex Design Brief

> For Codex / any AI agent working on the marketing site or frontend.
> Full brand reference: `BRAND_BOOK.md`. Agent architecture: `AGENT_RULEBOOK.md`.

---

## What is in flight right now

- **Dashboard**: Being redesigned as a notebook/journal experience (spec in `DASHBOARD_NOTEBOOK_SPEC.md` once complete). Do not touch `app/src/pages/Dashboard.tsx` or `Dashboard.module.css` until that spec lands.
- **Marketing site** (`mindcraft-marketing-site.web.app`, served from repo root): Active work. Go here.
- **Practice flow** (`app/src/pages/Practice.tsx`): Story splash just shipped. Do not rearchitect.

---

## Brand in one page (the short version for dev)

**The student:** Maya. Sixteen. Was told she is not a math person. Gave up. MindCraft is the thing that changes that verdict. Everything we build is in service of the moment she clicks.

**The click:** The specific felt experience of suddenly seeing the pattern. Not the grade. The feeling. This is the product promise and the north star for every design decision.

**Two brands, one product:**
- **MindCraft** = the engine. Geometric sans. Lime + navy. Declaratives. "The map changed."
- **Katha** = the story layer. Editorial serif. Red + chalk. Present tense, sensory, human in crisis.

---

## Visual rules (binding)

| Rule | Details |
|---|---|
| Background | Deep Field `#080e14` for app chrome. Warm ivory `#f7f3ee` for notebook page content (new). Never white. |
| Lime `#c4f547` | Exactly one use per screen. Primary CTA or mastery signal only. Never decorative. |
| Red `#c1121f` | Narrative tension, gap severity, Katha flame. Never on a wrong answer. Never on a student's input. |
| Navy `#1d3a8a` | System structure, graph edges, secondary surfaces. |
| Typography | Geometric grotesque for display + UI. Editorial serif for Katha stories. |
| Motion | Weight, not bounce. Motion = state change. Nothing animates to seem lively. |
| Imagery | No stock photos. No mascots. No chat bubbles. No floating math symbols. No rounded "friendly" fonts. |

---

## Copy rules (binding)

| Never say | Say instead |
|---|---|
| Wrong / Incorrect | Not this one / Not yet |
| Try again | Look at [specific thing], then take the next one |
| Quiz | Challenge |
| Easy | Quick / Short |
| Gamified | Story-driven |
| User | You |
| App / Platform | World / Map |
| Diagnostic test | Gap scan |
| Great job! / Awesome! | There it is. / Mastered. |
| Module / Unit | (just the concept name) |

No exclamation marks in product UI. Sentence case everywhere. No emoji in product copy.

---

## Marketing site direction

The marketing site (`mindcraft-marketing-site.web.app`) needs to feel like the brand book, not like an edtech landing page:

- **Hero headline:** "You were never bad at math." — on Deep Field, huge geometric grotesque, chalk text. No hero image. The type IS the image.
- **Anti-patterns to kill:** em dashes everywhere, chat icon graphics, generic "AI-powered" language, stock student photos, teal/purple SaaS gradients.
- **Reference aesthetic:** Buttermax, StringTune — cinematic, dark, editorial, one enormous typographic statement per section.
- **Sections to include:**
  1. Hero: the verdict line
  2. The student (Maya's story, no name used — just the recognition moment)
  3. How it works (engine + story, shown with actual UI, not mockups of fake data)
  4. The tutors (Jordan's story)
  5. The click (what mastery actually feels like)
  6. CTA: "Start the gap scan"

---

## File ownership map

| What | Files | Status |
|---|---|---|
| Marketing site | `index.html`, `style.css`, static root | Active — Codex works here |
| Dashboard UI | `app/src/pages/Dashboard.tsx`, `Dashboard.module.css` | **Shipped v1** — Field Journal live. CSS tokens in `Dashboard.module.css` drive the paper system. Extend, don't revert. |
| Practice flow | `app/src/pages/Practice.tsx`, `Practice.module.css` | Frozen — story splash just shipped |
| PawHub | `app/src/components/PawHub.tsx`, `PawHub.module.css` | Frozen — Challenge/Explore just shipped |
| Path mini | `app/src/components/PracticeLearningPathMini.tsx` | Frozen — solid dots just shipped |
| ML backend | `ml/` | Separate GCP project — do not touch deploy scripts |
| Brand documents | `BRAND_BOOK.md`, `AGENT_RULEBOOK.md`, `CODEX_BRIEF.md` | Read-only reference |

---

## Deploy rules

**Frontend deploys automatically on every push to `main`.** CI builds and deploys Firebase Hosting targets (app, world1, marketing). Never run `firebase deploy` manually — it overwrites CI and clobbers in-flight work.

ML backend (`ml/`) deploys to a separate GCP project. Do not touch it unless explicitly tasked.

---

## The one question that breaks ties

> Does this serve the click?

If a design element, copy choice, or feature does not directly lead Maya toward the moment she suddenly sees the pattern — cut it.
