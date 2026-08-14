# BUILD — The Book, Level 2.9 → Level 3

**Goal:** the book surface already renders beautifully and already *records* evidence.
It never *reads* the learner model. This build connects the two. **No new UI, no new
engine endpoints, no new data.** Every input below already exists and ships today.

**Lane: Product (`app/**` — Akshat's tree). CROSS-LANE — coordinate before starting.**
The engine side (`ml/**`) is Blake's and is **not touched by this build**. Shared seam
files `app/src/lib/questionBank.ts` and `app/src/lib/mlApi.ts` are read-only here:
call them, don't change their signatures.

---

## Why this is the target

McCreary's intelligent-textbook taxonomy puts **Level 3** at: *"adjust content based
on analysis of user input or performance… concept graph traversal algorithms to
personalize learning pathways… using that evidence to predict which concepts a
student has actually mastered."* ([Five Levels](https://dmccreary.medium.com/five-levels-of-intelligent-textbooks-b81a4c1525a0))

MindCraft's engine already *is* that (pathfinder + mastery + decay + gap detection).
The book is stuck at 2.9 for one reason: **the capture half is wired, the adaptation
half is not.** Closing that gap makes it Level 3 at *ingredient* granularity — a
grain his framework has no mechanism for, since his unit is the concept and he has
no learner model at all.

---

## Facts on the ground — read before touching anything

**Naming trap:** `app/src/pages/Book.tsx` is **tutor booking**, not the textbook.
It has `DEMO_TUTORS`/`Tutor[]`. Do not touch it. The textbook surface is
`app/src/pages/ConceptChapterPage.tsx` (route `/concept/:conceptId`) plus
`app/src/components/book/*`.

**What exists and works:**
- `ConceptChapterPage.tsx` — chapter reader: story panels, quests, scratchpad,
  journal, wrong-answer notes, past-mistake callbacks.
- `app/src/data/conceptStories.json` — **49 concepts, 172 ingredient-level stories
  across 42 concepts**, keyed by canonical L1 ingredient id
  (e.g. `fractions_decimals__part_whole_meaning`).
- `Dashboard.tsx` — the book *cover*; renders `CoverLanding` from `components/book/`
  and already calls `fetchPracticeHubRecommendations` (line ~499). Engine-connected.
- Evidence capture from chapters: `submitWorkEvidenceIfReady`, `recordWrongAnswer`,
  `getPastMistakeCallback`.

**Two orphaned components — this is the key finding:**
| Component | Has | Missing | Rendered by |
|---|---|---|---|
| `components/DashboardRoutePanel.tsx` | engine data (`getRecommendations`, builds `state:` items) | book styling | **nothing** |
| `components/book/StudyPlanList.tsx` | book styling (dotted route spine, done/active/upcoming, progress inkline) | any data source | **nothing** |

They are two halves of one feature. **Compose them. Do not build a third.**

---

## W1 — Chapter questions must come from the learner model *(highest value)*

**The gap.** `ConceptChapterPage.tsx:341–356`:
```ts
const qs = [
  ...getQuestions(conceptId, 1, CHAPTER_Q_COUNT),
  ...getQuestions(conceptId, 2, CHAPTER_Q_COUNT),
  ...getQuestions(conceptId, 3, Math.ceil(CHAPTER_Q_COUNT / 2)),
]
```
Hardcoded levels 1+2+3. **No** seen-list, **no** `examType`, **no** `format`, **no**
`preferStoryCells`, **no** `grade` — every optional argument `getQuestions` accepts is
ignored. The chapter serves the same questions to a student who has mastered the
concept and one who has never seen it. That single block is why the book is 2.9.

**The fix.** `getQuestions` already takes everything needed — the signature is
`(conceptId, level, count, seenIds, examType, format?, preferStoryCells?, grade?)`.
Feed it:

1. **Level from the gap scan, not hardcoded.** Use
   `bridgePractice.getRecommendedLevel(confidence)` (`hard→1 · kinda→2 · easy→3`) and
   `allowedLevels()` to weight the mix, instead of a flat 1/2/3 spread.
2. **`seenIds`** from the student's practice history so a re-read isn't a repeat.
3. **`format`** — when `/recommend` reports a format gap for this concept
   (`gapType === 'format'`, `bridgeFromConcept` = the `FormatId`), pass it so the
   chapter drills the vessel the student actually fails.
4. **`preferStoryCells: true`** — the book is the one surface where story-framed
   questions are unambiguously correct (`WORLD_VISION.md`: story-first questions).
5. **`grade`** from the student's `curriculumTrack`/grade if available.

**Reuse, don't reimplement:** `fetchPracticeHubRecommendations(uid, track)` already
returns `{weakness, learn, topMisconceptionGap}` with `formatId`, `misconceptionId`,
and `ingredientId` populated. Call it once, pass what it gives you.

**Degradation is mandatory.** If the engine call fails or returns nothing, fall back
to today's exact behavior. A chapter must **never** fail to render because the ML
service is asleep (the HF Space sleeps after ~48h idle, ~60s cold wake). Wrap in
try/catch, render questions from the static path, no error UI.

---

## W2 — Render the route: compose the two orphans

**Do not build new UI.** `StudyPlanList` is finished and correct:
```ts
type StudyPlanItem = { id: string; label: string; state: 'done'|'active'|'upcoming' }
// props: title, examLabel, items, progressPct, completedCount, disabled, onSelect, moreCount, onMore
```

1. **Take the data logic from `DashboardRoutePanel.tsx`** (it already calls
   `getRecommendations(uid, [targetId], 'curriculum')` and derives `state:` at ~line 94).
2. **Render it through `StudyPlanList`.** Map the trimmed chain via `chainSteps(rec)`
   (`lib/recommendNextConcept.ts`) → items; `state` from the knowledge-graph node
   status (`mastered`→`done`, current target→`active`, else `upcoming`).
3. **Place it on the book's route surface**, not as a fifth dashboard panel.
   `Dashboard.tsx` has a `'route'` view that currently collapses into `'home'`
   (~line 276) — that is the intended slot. Blake verifies the placement locally
   (`cd app && npm run dev`) before merge; no sign-off needed.
   *Collision note:* `Dashboard.tsx` is a Product-lane file, so if Akshat has
   in-flight work there, expect to merge rather than assuming a clean tree.
4. `onSelect` → `navigate('/concept/:conceptId')` so the route is how you *enter* a
   chapter. That's the pathfinder becoming the table of contents.
5. **Delete or clearly deprecate whichever of the two is left over.** Do not leave a
   third unrendered route component behind — that is how this situation arose.

---

## W3 — Ingredient-level emphasis (the "3+" part)

This is what his framework structurally cannot do. It needs **no engine change** —
`/recommend` already returns `misconceptionGaps[]` carrying `ingredientId`.

1. `fetchPracticeHubRecommendations` → `topMisconceptionGap` → `{ingredientId, misconceptionId, distractorChoiceIndex}`.
2. **Prose emphasis:** look up `conceptStories.json[concept].ingredientStories[ingredientId]`
   and lead the chapter with that section instead of the default opening panel.
   Keys already match L1 ingredient ids, so this is a direct lookup.
3. **Targeted questions:** use the existing
   `getQuestionsForMisconceptionWeakness(conceptId, level, count, seen, examType, format, {ingredientId, misconceptionId})`
   — already in `questionBank.ts`, already handles story-cell preference and falls
   back to `getQuestions` when the pool is empty.

**Coverage reality — set expectations, don't fight it.** Of 179 ingredients, **97 carry
at least one labeled example, 82 carry none** (verified in
`ml/data/misconception_ingredient_map.json`; 655/963 misconceptions labeled). The 82
are concentrated in matrices, complex numbers, logarithmic functions, and integrals —
Eedi (UK GCSE) doesn't cover them. Those are **advanced ACT-only** concepts, i.e. not
where a high-schooler's foundational holes live.

So: **W3 lights up on the ~25 foundation concepts and silently no-ops elsewhere.**
That is the correct behavior, not a bug. Never render an empty "your weak ingredient"
slot — if there's no labeled ingredient, show the normal chapter opening.

---

## Verification — fixture-based, no live engine

Everything here is a pure function of a `/recommend` response, so test it as one.

- **Fixtures**, committed under `app/src/lib/__fixtures__/`: (a) fresh student,
  no events; (b) student with a concept weakness; (c) student with a **format** gap;
  (d) student with a **misconception** gap carrying an `ingredientId`; (e) engine
  returns 500 / times out.
- **Assertions:**
  - W1: fixture (c) causes `getQuestions` to be called **with** that `format`;
    fixture (a) yields today's behavior exactly.
  - W1 degradation: fixture (e) still renders a full chapter with static questions
    and logs no user-visible error. **This test is non-negotiable.**
  - W2: `chainSteps` → `StudyPlanItem[]` mapping produces exactly one `active`, and
    `done` count matches `progressPct`.
  - W3: fixture (d) leads with the matching `ingredientStories` entry; an
    `ingredientId` from the uncovered 82 renders the default opening with no empty slot.
- Existing suite green: `cd app && npx vitest run`.
- Manual: `cd app && npm run dev` → `/concept/linear_equations` in a normal browser
  tab (not the IDE's embedded one — it breaks Google OAuth).

---

## Out of scope — do not touch

- `ml/**` — engine lane. This build adds **zero** endpoints.
- `app/src/pages/Book.tsx` — tutor booking, unrelated.
- `questionBank.ts` / `mlApi.ts` **signatures** — call them, don't change them (C5/C3 seams).
- The 82 uncovered ingredients — closing those needs a separate ACT-only enrichment
  pass over L3 `subtopics`/`skill_gap_if_wrong`, not frontend work.
- Level 4 (runtime chatbot). `AGENT_RULEBOOK.md` keeps the deterministic spine on
  purpose — *LLM is the bookends, deterministic is the spine.*

## Definition of done

- [ ] W1, W2, W3 as three separate commits.
- [ ] Degradation test passes: ML service down → chapters still render.
- [ ] No unrendered route component remains (`DashboardRoutePanel` **or**
      `StudyPlanList` is deleted/deprecated, and the survivor is on screen).
- [ ] `npx vitest run` green; `git diff --stat` shows `app/**` only.
- [ ] Route surface renders correctly in local dev — Blake's own visual check.

**Deploy:** CI auto-deploys hosting on push to `main`. Do **not** run `firebase deploy`
locally — it publishes local disk and clobbers CI.
