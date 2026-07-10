# Fable 5 Brief — First Spark: Interest → Story → Question → Marketing Site

**Lane:** Product (`app/**`, marketing root, `webhook/api/spark-experience.ts`)
**Status:** Open — first Fable 5 commission on this project
**Companion doc:** `agent_work/product/FIRST_SPARK_ONBOARDING_SPEC.md` (existing spec — read both)

## What you're building (one sentence)

A cinematic 60–90 second pre-auth onboarding on the marketing site where ANY visitor types 2+ things they care about, solves ONE real math question wrapped in a scene that could only exist because they told us — then lands seamlessly on the full MindCraft site without feeling like a bait-and-switch.

## This is NOT

- A placement test, gamified quiz, or "math is fun!" cartoon
- The full product (Notes · Solver · Map come after)
- A generic worksheet with decorative flavor text

## This IS

- A tiny reflection of our real backend: interests → tale/concept match → story-wrapped proven question
- The emotional hook before signup — "oh, the math was already in my thing"
- Proof of WORLD_VISION Horizon 3: same math, infinite worlds at the intersection of what they love

## North star feeling

Visitor thinks: "Wait — that's MY world. And the number actually matters in it."
Not: "Cute math app guessed my hobby."

## Emotional arc (5 beats — do not reorder)

1. **Arrival** — Mind*Craft* title, quiet awe, dark field
2. **Promise** — "Be good at your craft. We'll find the math inside it."
3. **Invitation** — bubbles + "Tell us what you like" (min 2 interests)
4. **Spark** — journal-paper question card: woven intro + real stem + 4 choices (hide correctness — never reveal right/wrong)
5. **Handoff** — "Built around {interests}." → tutor/reviews bridge → fade to marketing site (#proof testimonials)

## Visual system (match live marketing site)

Source of truth: `index.html` tokens

- Cream `#fff8e9`, ink `#143a2e`, leaf `#247a4d`, gold `#f5d348`, mint `#e4f7dc`
- Title font: Fredoka (gold emphasis on "Craft")
- UI: Nunito Sans / Inter Tight
- Question card: journal paper (`--paper`), not dark glass
- Motion: slow, cinematic — `cubic-bezier(0.16, 1, 0.3, 1)` — no confetti, no bounce gamification
- Bubbles: atmosphere only; shift hue toward latest interest chip

## Current implementation (your starting point)

- Working demo: `app/public/demo/v2/index.html` + `spark-bank.json`
- Spec: `agent_work/product/FIRST_SPARK_ONBOARDING_SPEC.md`
- Backend path (not yet live): `webhook/api/spark-experience.ts` — Groq weaves ALL interests into intro+stem while freezing every number
- Live preview: local `http://127.0.0.1:8765/v2/`
- Marketing handoff target: `https://mindcraft-marketing-site.web.app#proof`

## Known gaps you must close

1. Story bank too small — 12 cells, 4 concepts; many hobbies get generic intros
2. Interest lexicon missing clusters (economics, nursing, cars, photography, coding, sports beyond basketball, etc.)
3. Multi-hobby weaving weak offline — needs rich pre-written skins OR live LLM skin
4. Some bank questions have great math but intros that ignore visitor interests entirely

## Your deliverables

### A. Content — "Spark Story Matrix" (PRIMARY)

Build a matrix, not one-off tales:

| Hobby cluster | Example interests | Math that naturally lives there | Protagonist archetype | Setting | Sample math hook |
|---------------|-------------------|-----------------------------------|----------------------|---------|------------------|
| Food & trade | cooking, baking, economics, business | fractions, ratios, unit rates, percents | vendor, chef, market keeper | kitchen, stall, harbor | portions, margins, price-per-unit |
| Rhythm & pattern | music, dance, DJ, drums | fractions, sequences, ratios | session musician, choreographer | studio, stage | tempo, measure, sync |
| Motion & competition | basketball, soccer, track, climbing | ratios, angles, linear | captain, coach, climber | court, field, wall | stats, splits, grade |
| Build & design | fashion, architecture, cars, woodworking | geometry, area, ratios | apprentice, tailor, mechanic | workshop, garage | scale, measure, fit |
| Discovery | space, science, nature, travel | coordinates, functions, probability | navigator, researcher | observatory, trail | distance, orbit, sample size |
| Digital | gaming, coding, film, photography | probability, linear, ratios | streamer, editor, dev | server room, edit bay | odds, frame rate, render queue |

For EACH cluster deliver:

1. **2–3 multi-hobby intro templates** that weave TWO interests into ONE scene (not a list — one coherent world)
   - Example pattern: "{Interest A} meets {Interest B} tonight — {protagonist} has one number to get right before {stakes}."
2. **1 flagship story cell** — full `storyIntro`, `storyStem`, `world_feedback` correct/incorrect, 4 choices
3. **Concept mapping** — which ontology concepts this cluster should pull from (ratios_proportions, fractions_decimals, linear_equations, etc.)

**Rule:** Math is frozen. Never change numbers/units/equations from the source question. Only re-skin the scene.

### B. Content — Interest Lexicon expansion

Extend to 40+ free-text aliases with:

- `themes[]` (for tale matching)
- `concepts[]` (for question pool)
- `keywords[]` (for Jaccard match)
- `scene_noun` (for weaving: cooking → "the kitchen", economics → "the ledger")

Must include: economics, finance, business, nursing, medicine, law, politics, coding, engineering, photography, anime, K-pop, cricket, volleyball, swimming, hiking, gardening, pets, family, church, volunteering — and sensible fallbacks for unknown input.

### C. Content — Multi-hobby fusion rules

When visitor enters 2–4 interests from different clusters:

1. Pick a **primary scene** from the stronger-matched cluster
2. **Thread secondary interest** as prop/stakes/motivation — not a second scene
   - cooking + economics → kitchen prep for a pop-up stall; margin on portions
   - music + basketball → halftime show; beats per minute vs court tempo
   - gaming + space → mission timer; fuel ratio before launch window
3. Never output: "You like cooking and economics." as the whole intro — show the collision.

### D. UX — Marketing site integration spec

Design how First Spark **opens from** `index.html` without breaking SEO/perf:

**Option A (preferred for demo):** Full-screen overlay loader on first visit only (`sessionStorage.mc_spark_seen`)

- Hero CTA: "See your math" → launches Spark overlay
- Skip always visible after beat 1
- Finale auto-fades to same page, scrolled to `#proof`

**Option B:** Dedicated path `/spark` on marketing host, redirect back to `/?from=spark`

Deliver:

- Wireframe: hero → spark overlay → return to hero with memory chip ("You solved something in {interests}")
- Mobile: 28 bubbles, single-column paper card, 44px touch targets
- `prefers-reduced-motion` variant (crossfade only)

### E. Copy pack (brand-safe — read BRAND_BOOK.md)

Write all strings. Tone: warm, serious, never remedial. Maya is 16 and ambitious about HER craft.

| Moment | Direction |
|--------|-----------|
| Title | Mind*Craft* |
| Promise | Be good at your craft. / We'll find the math inside it. |
| Invite | Tell us what you like. / Add at least two. |
| Loading | Finding your scene… |
| Post-answer | Built around {interests}. |
| Bridge | We have talented tutors — and families who've felt the click. |
| Skip | Skip intro |

**Never say:** "math is fun", "level up", "you're a math person now", "wrong!", "try again!"

### F. Demo acceptance matrix (must pass before ship)

Run these 12 interest pairs in the experience. Each must feel *specific*, not generic Simon-at-the-pond:

1. cooking + economics
2. music + basketball
3. fashion + math (meta — should still work)
4. gaming + space
5. nursing + science
6. soccer + travel
7. art + building
8. cars + money
9. dance + film
10. animals + nature
11. coding + gaming
12. books + politics

**Pass criteria per pair:**

- [ ] Intro mentions BOTH interests organically (or their scene nouns)
- [ ] Question math is real (not dumbed down)
- [ ] Correct/incorrect feedback stays in-world (physics, not judgment)
- [ ] Finale names their interests back
- [ ] Handoff to marketing feels continuous (same palette, no jarring white flash)

## Architecture constraints (do not fight engineering)

- Question schema = `questionBank.Question` — do not invent fields
- Story cells export to `spark-bank.json` (questions + folk tales from `storyCells.json` + `mathSkinTop.json`)
- `sessionStorage.mc_spark_v2`: `{ interests, questionId }` for post-login onboard
- Hide correctness (C4): record choice, never show ✓/✗ during spark
- LLM skin is enhancement; offline template must still pass 8/12 demo matrix

## Priority order

1. Spark Story Matrix + multi-hobby templates (unblocks all demos)
2. Lexicon expansion
3. Marketing overlay integration spec
4. Polish motion/sound (optional)

## Reference files

- `agent_work/product/FIRST_SPARK_ONBOARDING_SPEC.md`
- `WORLD_VISION.md` § Horizon 3
- `BRAND_BOOK.md`
- `app/public/demo/v2/index.html` (working prototype)
- `app/public/demo/v2/spark-bank.json` (current bank)

## How to frame it

"First Spark is our mission briefing before the map exists — prove that math was already inside whatever they typed, in under 90 seconds, then let the marketing site breathe."

Three things to emphasize:

1. **Content is the bottleneck, not UI.** The V2 shell works. Fable 5's job is the Spark Story Matrix — rich multi-hobby skins so cooking+economics isn't Simon at a duck pond.
2. **Intersection, not decoration.** Horizon 3 means two hobbies collide in one scene with one number at stake. That's the magic demo moment.
3. **Append, don't replace.** Spark is a curtain on the existing marketing site (cream/ink/gold), fading into #proof — same world, deeper room.

## What you'll have after Fable 5 delivers

| Layer | Today | After Fable 5 |
|-------|-------|---------------|
| Cinematic shell | Built | Polished + marketing-integrated |
| Hobby → math mapping | ~15 lexicon entries | 40+ clusters |
| Story skins | 12 static cells | Matrix of multi-hobby scenes |
| Demo diversity | Lucky if hobbies match bank | 12/12 acceptance pairs pass |
| Website handoff | Manual redirect | Seamless overlay → testimonials |

The vision is right. First Spark is a trailer for the engine — interests in, honest math out, full MindCraft behind the curtain. Fable 5 should make the trailer feel personal for a kid who codes, a parent who cooks, a student who cares about money, and everyone in between.
