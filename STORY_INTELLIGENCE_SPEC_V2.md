# Story Intelligence — Architecture Spec V2
> Author: Claude (architecture lane). Read by: Cursor, Fable 5, Codex, Blake.
> EXTENDS `STORY_INTELLIGENCE_SPEC.md` — that file's sections 2 (data moat schema),
> 5 (evolution loop), 6 (VC defensibility), and 7 (lane split) still stand and are
> not repeated here. This file finalizes the human-in-the-loop gates (section 1),
> upgrades diagnostic selection, adds the ingredient tier to `worstWeakness()`,
> and specs the narrative-voice personalization skin.
> Design only. Do not run batches or rewrite pipelines from this doc alone.

Canonical context: `GAP_MAP_VISION.md` (mission, three gap layers, section 9 flywheel).
Append-after-review is law: no agent auto-writes to the ontology or ships a Story
Cell that fails the gates below.

---

## 1. Agent loop — human-in-the-loop gates (final)

Extends STORY_INTELLIGENCE_SPEC.md section 1. The Generator → Critic → PersonaSimulator
chain is unchanged. What changes: the single "Akshat review queue" becomes a
routed two-reviewer system, the auto-ship gate gets exact criteria, rejections
are cached, and every cell is version-tagged.

### 1.1 Auto-ship criteria (skip human review entirely)

A cell that passes PedagogyCritic (avg >= 7.5 AND math_integrity >= 8) is
evaluated against two auto-ship gates. Passing EITHER gate ships the cell to
`storyCells.json` with no human review. Failing both routes it to review (1.2).

**Gate A — clean pass (all conditions required):**

| Condition | Threshold |
|-----------|-----------|
| math_integrity | >= 8 |
| emotional_safety | >= 8 |
| every one of the 7 dimensions | >= 7 |
| average | >= 8.5 |
| PersonaSimulator | misconception_student hits primary distractor AND fast_guesser does not land correct |
| Tone flags (1.2.3) | none |
| Concept family | NOT in ALWAYS_REVIEW (1.2.4) |

**Gate B — excellence override (tolerates ONE soft secondary dimension):**

| Condition | Threshold |
|-----------|-----------|
| math_integrity | >= 9 |
| diagnostic_power | >= 8 |
| emotional_safety | >= 8 |
| transfer | >= 7 |
| average | >= 8.0 |
| At most ONE of {agency, representation_options, cognitive_load} | in [6, 7) — the other two >= 7 |
| PersonaSimulator + tone flags + ALWAYS_REVIEW | same as Gate A |

Rationale: Gate B lets a mathematically airtight, highly diagnostic cell ship
with one slightly weak secondary dimension. math_integrity and emotional_safety
never have an override — a wrong key corrupts the mastery graph, and unsafe
tone breaks the brand promise.

### 1.2 Routed review queues — Blake (math) vs Akshat (narrative/safety)

Cells that pass the critic but fail both auto-ship gates enter
`ml/data/story_cells/review_queue.json`. Routing is by WHICH dimensions were
soft:

**1.2.1 Route to Blake (math integrity + diagnostic design):**
- math_integrity in [8, 9) when Gate B was otherwise close, or in [7, 8) any time
- diagnostic_power in [4, 8)
- transfer in [5, 7)
- Any PersonaSimulator anomaly that survived the final revise attempt
  (misconception_student missed primary distractor, or fast_guesser got it right)

**1.2.2 Route to Akshat (narrative + emotional safety):**
- emotional_safety in [6, 8)
- agency in [5, 7)
- cognitive_load in [4, 7)
- representation_options in [4, 7)
- Any tone flag (1.2.3)
- Concept in ALWAYS_REVIEW (1.2.4)

**1.2.3 Tone flags (string scan over all student-visible fields — `question`,
`choices`, `hints`, `storyContext`, `world_feedback`):** case-insensitive
substring match on: `injur`, `illness`, `sick`, `death`, `die`, `dying`,
`fail`, `stupid`, `dumb`, `behind everyone`, `wrong with you`. Flags are cheap
false-positive-tolerant — a flag only forces Akshat review, never auto-reject.

**1.2.4 ALWAYS_REVIEW concept families:** `basic_probability`,
`descriptive_statistics` (nuance in "fair"/chance language — carried over from
V1). Maintained as a constant in `story_cell_studio.py`.

If BOTH routing rule sets fire, the item is routed to both reviewers and BOTH
must verdict "ship".

**Queue item format** (`ml/data/story_cells/review_queue.json`):

```jsonc
{
  "items": [
    {
      "queue_id": "rq_20260708_cell_fractions_decimals_a3f9c1",
      "cell_id": "cell_fractions_decimals_a3f9c1",
      "batch_file": "ml/data/story_cells/batch_all.json",
      "concept_id": "fractions_decimals",
      "misconception_id": "mis_fractions_decimals__denominator_as_value",
      "world": "creature_sanctuary",
      "primitive": "fill_spill_overflow",
      "generator_version": "scs-v1.1",
      "scores": { "math_integrity": 8.5, "diagnostic_power": 7.0,
                  "cognitive_load": 6.5, "agency": 7.5, "emotional_safety": 8.0,
                  "representation_options": 7.0, "transfer": 7.5, "avg": 7.9 },
      "persona_sim": { "misconception_student_hit_primary": true,
                       "fast_guesser_correct": false },
      "routed_to": ["blake"],
      "trigger": ["diagnostic_power=7.0", "cognitive_load=6.5"],
      "status": "pending",              // pending | shipped | fix | rejected
      "blake_verdict": null,            // "ship" | "fix: <note>" | "reject: <note>"
      "akshat_verdict": null,           // only present when routed_to includes akshat
      "created_at": "2026-07-08T18:00:00Z"
    }
  ]
}
```

**Sign-off mechanics (JSON verdicts, no dashboard yet):**
- Reviewer opens the file, sets their verdict field to one line:
  `"ship"`, `"fix: <one-line note>"`, or `"reject: <one-line note>"`.
- `merge_story_cells_for_app.py` (extend, do not rewrite) ships a queued cell
  only when every reviewer in `routed_to` has verdict `"ship"`; it then sets
  `status: "shipped"`.
- `"fix: ..."` → Cursor re-runs the studio for that cell with the note appended
  to the generation prompt. Counts as ONE revise attempt against the max of 3
  total. The regenerated cell re-enters the full gate sequence from the critic.
- `"reject: ..."` → cell goes to the rejection cache (1.3), `status: "rejected"`.
- Queue items with `status != "pending"` older than 14 days may be pruned by
  the merge script.

### 1.3 Rejection cache — `ml/data/story_cells/rejected.json`

Purpose: a future batch run must not burn LLM calls regenerating a
(concept, misconception, world, primitive) combination that already failed
under the same prompt.

```jsonc
{
  "entries": {
    "<rejection_key>": {
      // rejection_key = sha1("{concept_id}|{misconception_id}|{world}|{primitive}|{generator_version}")
      "concept_id": "fractions_decimals",
      "misconception_id": "mis_fractions_decimals__denominator_as_value",
      "world": "creature_sanctuary",
      "primitive": "fill_spill_overflow",
      "generator_version": "scs-v1.1",
      "reason": "auto_reject",           // auto_reject | revise_exhausted | human_reject
      "final_scores": { "math_integrity": 4.0, "avg": 5.8 },
      "critic_notes": "distractor 2 is not a plausible student error",
      "human_note": null,                // the "reject: <note>" text when human_reject
      "attempts": 3,
      "rejected_at": "2026-07-08T18:00:00Z"
    }
  }
}
```

**Pre-generation check** in `StoryCellStudio`: before generating, compute the
rejection_key for the planned combo with the CURRENT `generator_version`; if
present in the cache, skip and log. Because `generator_version` is part of the
key, bumping the version after a prompt fix automatically re-enables every
previously rejected combo — no manual cache clearing.

### 1.4 Version tagging — `generator_version`

- Constant at the top of `story_cell_studio.py`:
  `GENERATOR_VERSION = "scs-v1.1"` (format `scs-v{MAJOR}.{MINOR}`).
- Bump MINOR for any prompt, threshold, or persona change. Bump MAJOR only when
  the cell schema changes shape.
- EVERY generated cell carries `"generator_version": "<value>"` in its JSON
  record — batch files, `storyCells.json`, voice overlays (section 4), review
  queue items, and rejection cache entries.
- **A/B testing without invalidating the bank:** the bank may hold cells from
  multiple generator versions simultaneously. `attempt_observations` already
  log `story_cell_id`; joining observation → cell record → `generator_version`
  gives per-version hit rates. `update_distractor_priors.py`
  (STORY_INTELLIGENCE_SPEC.md section 5) MUST group `observed_hit_rate` by
  `generator_version` in its output so a prompt experiment never pollutes the
  priors of the incumbent prompt. Cells from an older version are never purged
  just because the version bumped — they are retired only through the normal
  rejection/review path.

---

## 2. Diagnostic selection v2 — information-gain item selection

Current v1: `pickDiagnosticQuestions(grade, goalTags, target, storyCellSlots)`
in `app/src/lib/diagnosticQuestions.ts` — breadth-first, one probe per concept,
levels capped by `levelsForGrade`. v1 remains the cold-start engine; v2 wraps
it with in-session adaptive reranking. New module:
`app/src/lib/diagnosticSelection.ts` (Product lane / Fable 5 or Codex).

### 2.1 Information-gain scoring

For each remaining candidate question q, given the answers so far in the
current session:

```
IG(q) = H(p_q) * (1 - S(q))
```

**Term 1 — `H(p_q)`: binary entropy of the concept's failure probability.**

`p_q` is the session-local posterior failure probability for `q.conceptId`:

- **Initialization** (before any answers): from `gradeConfidence(grade, goalTags)`
  (`diagnosticQuestions.ts`) — `'hard'` → p = 0.65, `'kinda'` → p = 0.45; a
  concept absent from the map → p = 0.50. If a population-prior file
  `app/src/data/populationPriors.json` exists (export of Layer 1
  `population_failure_prior`, optional Engine deliverable), blend:
  `p = 0.7 * confidence_prior + 0.3 * population_prior`. If the file does not
  exist, use the confidence prior alone — do NOT block on Engine.
- **Update rule** (after each in-session answer on concept c):
  wrong → `p_c = min(0.90, p_c + 0.20)`; correct → `p_c = max(0.10, p_c - 0.25)`.
  Correct answers move p more because a right answer at grade level is stronger
  evidence than one wrong answer (guessing floor on 4-choice is 25%).
- **Entropy**: `H(p) = -(p * log2(p) + (1-p) * log2(1-p))`, with `H(0)=H(1)=0`.
  Range [0, 1], maximal at p = 0.5 — the engine asks where it is most uncertain.

**Term 2 — `S(q)`: similarity to already-asked questions.**

`S(q) = max over asked questions a of sim(q, a)`, where:

| Condition (checked in order, take the max) | sim(q, a) |
|--------------------------------------------|-----------|
| `q.conceptId === a.conceptId` | 0.90 |
| Same grade-delta group (both conceptIds appear in the same set among: G7, G8 minus G7, G9 minus G8, G10 minus G9, G11 minus G10 — computed from `GRADE_CONCEPTS`) | 0.40 |
| Same format (`questionFormat(q) ?? inferQuestionFormat(q)` equal for both) | 0.25 |
| None of the above | 0.00 |

Fields read: `q.conceptId`, `q.format` (via existing `questionFormat` /
`inferQuestionFormat` helpers in `questionBank.ts`), and the static
`GRADE_CONCEPTS` table. Nothing else — no server round-trip, no embeddings.

**Reranking:** after each answer, recompute IG for every remaining candidate in
the session pool and serve the argmax. Ties broken by preferring a Story Cell
(richer misconception signal), then by lower level.

### 2.2 Grade caps (level accessibility lookup table)

Session-local, evaluated per candidate concept:

| Grade band | Base levels | Stretch level — unlocked on that concept's grade-delta group after 2 consecutive correct answers in-session | Floor after 2 consecutive wrong | Never served |
|------------|-------------|-----------------------------------------------------------------------------------|--------------------------------|--------------|
| G6–G8 | L1 | L2 | L1 only | L3 |
| G9–G10 | L1–L2 | L3 | L1 only | — |
| G11+ | L2 | L3 | L1 | — |

"Consecutive" counts across the whole session, resets on any wrong answer.
This preserves v1's "never punishing on a welcome diagnostic" rule (no L3 for
middle school ever) while letting a streaking G11 student see a real challenge.

### 2.3 Jesse's kitchen constraint — adaptive session length

Hard bounds: **minimum 5 questions, maximum 8.** No progress bar, no question
counter shown mid-session (the existing `progressSteps` UI in `GradeOnboard.tsx`
tracks steps, not probe counts — keep it that way).

**Saturation stop rule:** after answer k is recorded, if `k >= 5`, compute
`maxIG = max over remaining candidates of IG(q)`. If `maxIG < IG_STOP_THRESHOLD`
(constant, **0.35**), stop the diagnostic. Also stop when the candidate pool is
exhausted. Always stop at k = 8.

Intuition for 0.35: entropy 0.35 corresponds to p roughly below 0.07 or above
0.93 for a dissimilar question, or moderate uncertainty on a concept nearly
identical to one already probed — either way, one more question buys little.

### 2.4 Transition rule — seamless handoff to live practice

No "you're done" screen, no score, no summary. On the stop condition:

1. Fire `POST /seed-assessment` (updated confidence map: posterior p >= 0.55 →
   `hard`, 0.35–0.55 → `kinda`, < 0.35 → `easy`) and `POST /record-outcomes`
   (probe evidence with choice detail via `resolveChoiceEvidence`) **in the
   background** — exactly the calls GradeOnboard makes today, not awaited by the UI.
2. The slot where the next question card would appear renders a single Jesse
   dialogue line instead (copy owned by `BRAND_BOOK.md`; placeholder: "I think
   I know which shelf we start with. Come on.") — same card chrome, so it reads
   as the story continuing, not a results page.
3. On tap, route to `/practice` with `launchMissionDirect` state (existing
   PawHub mechanism), target = the concept with the highest session posterior
   `p_c` that `hasPlayableQuestions`, level from the 2.2 table's base band for
   the student's grade. Do NOT wait for `/recommend` — the session posterior is
   fresher than the not-yet-seeded graph; `/recommend` takes over from the next
   dashboard visit onward.

### 2.5 Cold-start fallback (exact trigger)

- **Within every session:** questions 1–3 are ALWAYS served in v1 breadth-first
  order (`pickDiagnosticQuestions` ordering, including the up-to-2 Story Cell
  slots). IG reranking activates from question 4 onward
  (`answeredCount >= 3`). Three answers is the minimum for the posterior to
  diverge meaningfully from the prior.
- **Whole-session fallback to pure v1** when ANY of: (a) the renderable
  candidate pool for the grade scope is smaller than 8; (b) the IG module
  throws (wrap in try/catch — a diagnostic must never crash on a scoring bug);
  (c) the student is retaking via Admin Testing with `resetDiagnostic()` AND
  the graph was wiped (no priors beyond gradeConfidence — v1 is already optimal
  breadth-first there for the first pass, but IG may still activate at q4 as
  session evidence accrues; only (a) and (b) force full v1).

Signature: `pickDiagnosticQuestions` keeps its exact current signature and
behavior (it produces the ordered v1 pool). New function in
`diagnosticSelection.ts`:

```ts
rerankByInformationGain(
  remaining: Question[],
  asked: { question: Question; correct: boolean }[],
  posterior: Record<string, number>,   // conceptId -> p, mutated by caller per 2.1
): Question[]                          // sorted by IG desc
```

GradeOnboard consumes the v1 list as the pool and calls the reranker between
questions. Tests: extend `recommendNextConcept.test.ts` patterns — fixture
session with 3 scripted answers must produce a deterministic 4th pick.

---

## 3. `worstWeakness()` upgrade — ingredient/misconception tier

File: `app/src/lib/recommendNextConcept.ts`. Today's candidate sources:
`'profile'`, `'concept_gap'`, `'format_gap'`. This section adds tier 3 without
touching tiers 1–2.

### 3.1 Tier model

| Tier | source | Severity | Fires when |
|------|--------|----------|------------|
| 1 — concept gap | `'profile'` / `'concept_gap'` | `1 - conceptMastery` / `gapSeverity()` (existing, unchanged) | Always (today's behavior) |
| 2 — format gap | `'format_gap'` | `gapSeverity()` (existing, unchanged) | `/recommend` emits a format gap (today's behavior) |
| 3 — misconception gap | `'misconception_gap'` (new) | Server-computed, see below | `/recommend` response contains a non-empty `misconceptionGaps[]` — which the server only emits when `observed_hit_rate` exists for >= 1 distractor on that concept |

**Severity computation (server side — Blake, `serve.py` `/recommend`):**

`/recommend` gains an optional top-level array `misconceptionGaps`. For each
concept in the student's scope, the server joins the student's
`attempt_observations` with `ml/data/distractor_priors/{concept_id}.json`
(written by `update_distractor_priors.py`, STORY_INTELLIGENCE_SPEC.md section 5):

```
personalHitRate   = (# of this student's attempts where misconceptionId matched)
                    / (# of this student's attempts on questions carrying that distractor)
populationHitRate = distractor.observed_hit_rate   // from the priors file

emit only when ALL hold:
  - populationHitRate exists AND its n_observations >= 30
  - student attempts on tagged questions for this concept >= 2
severity = clamp01(0.6 * personalHitRate + 0.4 * populationHitRate)
emit only when severity >= 0.25
```

Personal evidence dominates (0.6) because the gap must be THIS student's;
population evidence (0.4) keeps one unlucky click from outranking a genuine
concept gap. The [0,1] range is directly comparable with tier 1/2 severities
(C1 contract).

Payload per entry:

```jsonc
{ "conceptId": "fractions_decimals",
  "ingredientId": "fractions_decimals__place_value_ladder",   // from Layer 1 join; null if unmapped
  "misconceptionId": "mis_fractions_decimals__denominator_as_value",
  "distractorChoiceIndex": 1,
  "personalHitRate": 0.67, "populationHitRate": 0.44,
  "nObservations": 112, "severity": 0.58 }
```

### 3.2 Backwards compatibility guarantee (pseudo-code)

```ts
export function worstWeakness(profileRec, pathRec, nodeMap, excludedConcepts) {
  const candidates: WeaknessCandidate[] = []

  // ... tiers 1 and 2: EXACTLY today's two loops, byte-for-byte unchanged ...

  // Tier 3 — NEW. When misconceptionGaps is undefined or [] (every student at
  // launch), this loop body never executes and the function's output is
  // identical to today's.
  for (const g of profileRec?.misconceptionGaps ?? []) {
    if (!hasPlayableQuestions(g.conceptId)) continue
    if (excludedConcepts.has(g.conceptId)) continue
    candidates.push({
      conceptId: g.conceptId,
      severity: g.severity,
      source: 'misconception_gap',
      misconceptionId: g.misconceptionId,
      ingredientId: g.ingredientId ?? undefined,
      distractorChoiceIndex: g.distractorChoiceIndex,
    })
  }

  if (!candidates.length) return null
  return candidates.reduce((best, c) => (c.severity > best.severity ? c : best))
}
```

Guarantee: no `observed_hit_rate` in the priors files → server emits no
`misconceptionGaps` → tier 3 contributes zero candidates → same winner as
today. No client-side flag needed.

### 3.3 Output shape change (optional, null-safe)

```ts
export type WeaknessCandidate = {
  conceptId: string
  formatId?: FormatId
  severity: number
  source: 'profile' | 'concept_gap' | 'format_gap' | 'misconception_gap'
  // NEW — present only when source === 'misconception_gap'
  misconceptionId?: string
  ingredientId?: string
  distractorChoiceIndex?: number
}
```

`NextConcept` gains the same three optional fields, passed through by
`toNextConcept`. All downstream consumers (PawHub, Practice launch state) MUST
treat them as possibly undefined — no consumer may branch on
`source === 'misconception_gap'` without a fallback path.

### 3.4 Practice routing when tier 3 fires

`Practice.tsx` (weakness missions) resolves the question source in this exact
priority order:

1. **Story Cell with matching misconception** — a cell in `storyCells.json`
   for `w.conceptId` whose `distractor_taxonomy` contains an entry with
   `misconception_id === w.misconceptionId`.
2. **Any Story Cell for the concept** — `getStoryCells(w.conceptId, voice)`
   non-empty (see section 4 for the voice argument).
3. **MCQ for the concept** — existing
   `getQuestions(conceptId, level, count, seen, exam, w.formatId, /* preferStoryCells */ true)`.

Pseudo-code (new helper in `questionBank.ts` or `Practice.tsx`):

```ts
function pickForWeakness(w: WeaknessCandidate, voice: VoiceId, level: 1|2|3): Question {
  if (w.misconceptionId) {
    const cells = getStoryCells(w.conceptId, voice)
    const exact = cells.filter(c =>
      c.distractor_taxonomy?.some(d => d.misconception_id === w.misconceptionId))
    if (exact.length) return shuffle(exact)[0]
    if (cells.length) return shuffle(cells)[0]
  }
  return getQuestions(w.conceptId, level, 1, seenIds, examType, w.formatId, true)[0]
}
```

The rest of the session (after the opening cell) draws from the normal mixed
pool — one targeted diagnostic moment, then practice volume.

---

## 4. Personalization skin v1 — grade + goals → narrative voice

Voices change TONE, not the world. World skins (interestTags → world registry)
remain STORY_INTELLIGENCE_SPEC.md section 3 and are orthogonal: a cell has one
world and one voice; the two systems never conflict because they rewrite
different things (world = setting/props, voice = register/framing of the same 2
text fields).

Inputs — Firestore `users/{uid}` fields that ALREADY exist (written by
`GradeOnboard.tsx`): `grade: number`, `goals: { tags: string[], text: string }`,
`curriculumTrack`.

### 4.1 Voice registry

New static file `app/src/data/voiceRegistry.json`:

```jsonc
{
  "voices": {
    "explorer": {
      "tone": "curious, wondering, asks questions alongside the student",
      "keywords": ["why", "understand", "curious", "confus", "makes sense",
                   "lost", "hate math", "scared", "never got"]
    },
    "builder": {
      "tone": "practical, step-by-step, concrete materials and checkpoints",
      "keywords": ["step", "how to", "basics", "practice", "homework",
                   "catch up", "behind", "slow", "foundation", "start over"]
    },
    "scholar": {
      "tone": "precise, systematic, names patterns and structures",
      "keywords": ["test", "exam", "act", "sat", "score", "grade up",
                   "precise", "ahead", "top", "college"]
    },
    "challenger": {
      "tone": "competitive, puzzle-framing, stakes and speed",
      "keywords": ["challenge", "compete", "puzzle", "bored", "too easy",
                   "hard mode", "fast", "game", "beat"]
    }
  },
  "gradeDefaults": {
    "6": "explorer", "7": "explorer",
    "8": "builder", "9": "builder",
    "10": "scholar", "11": "scholar", "12": "scholar"
  }
}
```

**Derivation** — `deriveVoice(userDoc)` in new `app/src/lib/narrativeVoice.ts`:

1. Lowercase `goals.text`; count case-insensitive substring matches per voice
   (keyword lists above; `confus` deliberately matches confused/confusing).
2. Highest count wins. **Tie-break:** if the grade default is among the tied
   voices, pick it; otherwise pick the first tied voice in registry order
   (explorer, builder, scholar, challenger). Challenger therefore never wins a
   tie by accident — it requires a clear signal.
3. **Zero matches** (empty or unmatchable `goals.text`): use
   `gradeDefaults[grade]`, except when `curriculumTrack === 'act_prep'` → `scholar`.
   Missing/out-of-range grade → `builder`.

### 4.2 Reskin pipeline (batch, not live)

Command (Cursor/Blake lane, extends `story_cell_studio.py`):

```bash
python ml/scripts/pipeline/story_cell_studio.py --reskin-voice all --concepts all
# --reskin-voice also accepts a single voice: --reskin-voice explorer
```

- Reads the shipped base batch. For each (cell, voice) pair: ONE LLM call that
  receives the base `storyContext` + `world_feedback` + the voice's `tone`
  string, and returns ONLY those two fields rewritten. The spine (`question`,
  `choices`, `correctIndex`, `hints`, `distractor_taxonomy`,
  `correct_reasoning`) is never sent as editable content and the writer asserts
  the output contains only the two allowed keys.
- Uses the same `.story_cell_cache.json` keying discipline (cache key includes
  cell id + voice + `generator_version`) so reruns are incremental.
- **Output is an OVERLAY, not a full copy** — this is how the size budget
  ("same as base, not 4x") is met. Files:
  `ml/data/story_cells/voice_{voice}.json`, copied by the merge script to
  `app/src/data/storyCells_{voice}.json` (4 files: `storyCells_explorer.json`,
  `storyCells_builder.json`, `storyCells_scholar.json`,
  `storyCells_challenger.json`):

```jsonc
{
  "voice": "explorer",
  "generator_version": "scs-v1.1",
  "cells": {
    "cell_fractions_decimals_a3f9c1": {
      "storyContext": "…voice-rewritten…",
      "world_feedback": "…voice-rewritten…"
    }
  }
}
```

  Budget: each overlay file <= the size of the base `storyCells.json` (in
  practice far smaller — 2 fields per cell). Hard cap 300 KB per variant file;
  the merge script fails the copy if exceeded.
- Voice-rewritten text passes a reduced gate: tone-flag scan (1.2.3) +
  emotional_safety re-score only. Failures fall back to base text for that cell
  (recorded in the batch log, not the rejection cache — the spine is fine).

### 4.3 Selection logic (serve time, zero LLM)

- `getStoryCells(conceptId, voice?)` in `questionBank.ts`: loads base cells for
  the concept, then if `voice` is provided and `storyCells_{voice}.json` is
  bundled, replaces `storyContext` and `world_feedback` per cell id from the
  overlay's `cells` map. Overlays are statically imported like the other bank
  JSONs (4 small files; no dynamic fetch needed).
- Voice is derived ONCE at session start: `App.tsx` (or the Practice/Chapter
  mount) reads the already-fetched user doc, calls `deriveVoice`, and stores
  the result in React state/context for the session (mirror to
  `sessionStorage` so a reload mid-session keeps the voice). No re-derivation
  mid-session, no live LLM call anywhere in this path.

### 4.4 Fallback (never an error)

Missing overlay file, cell id absent from the overlay's `cells` map, unknown
voice string, or malformed overlay entry → serve the base cell fields silently.
The base `storyCells.json` is always the source of truth for the spine and the
default text. There is no user-visible failure mode for voices.

### 4.5 v2 preview (not the current plan)

Once Anthropic credits are restored, v2 replaces the batch overlays with a
serve-time rewrite: at question render, a single Haiku-class call receives the
base `storyContext` + the student's voice + recent session color (streak, last
world visited) and returns a one-off rewrite, cached per (cell, student) in
Firestore. The deterministic spine contract is identical — the LLM still only
ever touches the two narrative fields — so v1 overlays remain the fallback when
the call budget or latency (>1.5s) is exceeded. Do not build toward this now.

---

## 5. Lane assignments for this spec

| Work item | Owner | Files |
|-----------|-------|-------|
| Auto-ship gates A/B, routed queue writer, rejection cache, `GENERATOR_VERSION` | Cursor / Blake | `ml/scripts/pipeline/story_cell_studio.py`, `ml/data/story_cells/review_queue.json`, `ml/data/story_cells/rejected.json` |
| Queue-aware ship path | Cursor / Blake | `ml/scripts/merge_story_cells_for_app.py` |
| `--reskin-voice`, voice overlay batch | Cursor / Blake | `story_cell_studio.py`, `ml/data/story_cells/voice_*.json` |
| `update_distractor_priors.py` grouped by `generator_version` | Cursor / Blake | `ml/scripts/update_distractor_priors.py` |
| `/recommend` `misconceptionGaps[]` (tier-3 severity) | Blake | `ml/serve.py`, `mindcraft_graph/planning/recommend.py` |
| `diagnosticSelection.ts` (IG rerank, grade caps, stop rule) + GradeOnboard adaptive loop + handoff | Fable 5 | `app/src/lib/diagnosticSelection.ts`, `app/src/pages/GradeOnboard.tsx` |
| `worstWeakness()` tier 3 + `WeaknessCandidate`/`NextConcept` fields + Practice tier-3 display | Fable 5 | `app/src/lib/recommendNextConcept.ts`, `app/src/pages/Practice.tsx` |
| Voice registry UI surface + `getStoryCells(conceptId, voice)` variant picker | Fable 5 | `app/src/data/voiceRegistry.json`, `app/src/lib/narrativeVoice.ts`, `app/src/lib/questionBank.ts` |
| `resolveChoiceEvidence()` extended to surface `ingredientId`; overlay JSON wiring; `worldSkinRegistry.json` (V1 section 3) | Codex | `app/src/lib/questionBank.ts`, `app/src/data/storyCells_*.json`, `app/src/data/worldSkinRegistry.json` |
| Tests: IG determinism fixture, tier-3 null-safety, voice fallback | Codex | `app/src/lib/recommendNextConcept.test.ts`, new `diagnosticSelection.test.ts` |

Shared seams (coordinate before touching): `questionBank.ts` (C5 shape),
`mlApi.ts` (`RecommendResult` gains `misconceptionGaps?`), `serve.py`
`/recommend` response.

Keep green: `cd app && npm run build`; `recommendNextConcept.test.ts`;
`cd ml && python scripts/end2end.py` when touching the engine.

---

*Last updated: 2026-07-08. This file supersedes STORY_INTELLIGENCE_SPEC.md
section 1's draft gates; all other V1 sections remain canonical.*
