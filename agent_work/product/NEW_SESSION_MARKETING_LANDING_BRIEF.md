# New Cursor Session Brief — MindCraft Marketing Landing Page

**Paste this as the first message in a NEW chat.**  
**Do not continue the resume / job-search session for this work.**

---

## Session purpose

Build (or rebuild) the **MindCraft public marketing landing page** using:

1. Our existing research + content (brand book, world vision, marketing sources, IG/story language).
2. A **page architecture inspired by Alkemy’s marketing site** (structure only — not their consulting voice, not their copy).
3. MindCraft’s own design language: fun, story-first, cool, student-facing alchemy energy — **not** enterprise consulting OS vibes.

This session is **Product lane marketing**. Resume / job search stays in a different chat.

---

## Before you code

1. `git pull origin main`
2. Read, in order:
   - `WORLD_VISION.md` (why)
   - `BRAND_BOOK.md` (voice — Maya, no em dashes in student-facing copy)
   - `FABLE5_VISION.md` (tokens, visual system)
   - `marketing/sources/research.json` + any testimonials sources
   - Root `index.html` / marketing hosting target (Firebase `marketing` → curated static at repo root)
3. Confirm where the live marketing site is served from (`firebase.json` marketing target) before overwriting.

---

## Alkemy → MindCraft structure map (USE THE SKELETON, NOT THE WORDS)

Alkemy pattern (consulting knowledge OS) → MindCraft remake (student learning OS before ACT):

| Alkemy section | MindCraft section (rename + rewrite) |
|---|---|
| Built for consultants… / hero OS line | Hero: MindCraft as the **learning OS before the ACT** — story worlds, map, Notes / Solver / Map |
| Problem (margin / burnout / trapped IP) | Problem: scattered practice, dead worksheets, forgetting, no story, map that doesn’t move |
| Solution / How it works (connect → graph → ask) | How it works: story chapter → real questions → map updates → weakness → next mission |
| Use cases (M&A, Expert Finder, KM) | Use cases: ACT gap scan, story concept chapters, weekly review, tutor/parent clarity |
| Vision / Mission | Vision / Mission from `WORLD_VISION.md` + brand (math as a world; inverted grind → high-value thinking) |
| Design partners / CTA | Get Started / Apply / Join waitlist / Sign in — student + parent + tutor paths |
| FAQ | Student/parent FAQ (privacy, ACT vs homework, tutors, cost, how stories work) |
| Timeline / social proof | Research citations (from sealed sources only), pilot/school signals, real metrics we can defend |
| Footer | Brand, legal, product links |

**Hard no:** Do not sound like Alkemy. No “partners,” “billable hours,” “institutional IP,” “design partner firm.”  
**Hard yes:** Story-first, fun, cool, Maya energy, chalk/Deep Field/lime Click language where it fits marketing (not app desk chrome unless intentional).

---

## Product truth to protect

MindCraft pairs high school students with college tutors, builds a per-student knowledge graph, and drives personalized practice. Student chrome naming: **Notes · Solver · Map**. Story wraps frozen math. Marketing must not invent mastery guarantees or fake testimonials.

---

## Design direction (Akshat’s ask)

- One composition in the first viewport (not a dashboard).
- Brand hero-level. Full-bleed or atmospheric background — not flat white SaaS.
- Fun + cool; alchemy / craft metaphor OK if tasteful (we are amazing alchemy — don’t be cheesy).
- Expressive type; avoid Inter/Roboto/Arial defaults if brand fonts exist.
- Motion: 2–3 intentional moments (hero, map/story reveal, CTA), not noise.
- Avoid purple-on-white AI slop, warm cream + terracotta brochure cliché, broadsheet newspaper look — unless adapting an *existing* MindCraft surface.
- Mobile + desktop.
- No em dashes in student-facing marketing copy.

---

## Suggested first deliverable in the new session

1. Wireframe / section outline agreed in 10 lines.
2. One HTML (or React, if marketing already uses it) landing that implements the mapped sections with **placeholder-safe real claims only**.
3. Pull research lines only from `marketing/sources/*` or brand docs — never invent DOIs or quotes.
4. CTAs: primary student Get Started, secondary parent/tutor path.
5. Screenshots or local preview instructions.

---

## Out of scope for that session

- Resume / LinkedIn / job tracker Excel
- MindCraft app desk UI (Weekly Review, chapter chalkboard) unless linking as product proof
- Auto-posting Instagram (separate `marketing/**` agent pipeline)

---

## Paste prompt (copy below into the NEW chat)

```
New session: MindCraft marketing landing page only (not resume/job search).

Goal: Build a fun, cool, on-brand MindCraft marketing page using our research/content, with a section template inspired by Alkemy’s site structure (Capabilities/Problem/Solution/Use Cases/Vision/Mission/FAQ/Get Started) but fully rewritten for students — “central OS for students before the ACT,” story-first, Notes/Solver/Map, knowledge graph that moves.

Read first: WORLD_VISION.md, BRAND_BOOK.md, FABLE5_VISION.md, marketing/sources/research.json, root marketing index / firebase marketing target. Pull latest main.

Rules: Product lane. No em dashes in student copy. No fake testimonials/citations. Don’t clone Alkemy consulting voice. One hero composition, atmospheric, intentional motion, mobile+desktop.

Start by proposing the section outline mapped from Alkemy→MindCraft, then implement the landing. Ask me before inventing new product claims.
```

---

## This chat (resume session) stays for

- Resume PDFs and role-specific variants  
- LinkedIn / email drafts (Alice, Ian, Grant, etc.)  
- Job Search Command Center Excel updates (`Applied?=Yes` or “tell Cursor”)  
- Interview / outreach coaching  

When you want marketing work: **new chat + paste the prompt above.**
