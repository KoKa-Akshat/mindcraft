# Review — the L3 book, the student model, and what accuracy actually looks like

Written 2026-08-14 (Opus session), after deploying engine buckets A/B to the HF
Space. This is a **review, not a build file**. It exists to settle what we're
integrating and why before any spec gets written.

**The one-sentence finding:**

> The book's Level 3 adaptation machinery is **fully built and rendering**.
> Every signal it adapts on is either **empty or miscalibrated**. We do not have
> a book problem. We have an evidence problem.

---

## 0. What changed during this review

Two things were fixed live, not just noted:

| | |
|---|---|
| **HF Space** | Engine buckets A/B deployed (was running pre-A/B code). `deploy_hf.sh` rewritten — the Hub now rejects plain binary pushes, so `bank_index.npz` ships via the Hub API. Commit `f351bdbc`. |
| **Firestore** | Created the missing `attempt_observations(studentId ASC, timestamp ASC)` composite index. **This unblocked the validation harness for the first time.** |

---

## 1. The index fix in `NEXT_SESSION.md` was half a fix

`NEXT_SESSION.md` §1 reports the `attempt_observations` index bug as **"Fixed +
verified"** (commit `400bbd96`). It was not.

That commit created the `timestamp DESCENDING` index and **deleted the ASCENDING
one**. There are two loaders, and they disagree:

| Loader | Order | Feeds | State after `400bbd96` |
|---|---|---|---|
| `load_recent_attempt_observations` (`firestore_adapter.py:199`) | **DESC** | `/recommend` → `misconceptionGaps` | fixed ✅ |
| `load_attempt_observations` (`firestore_adapter.py:165`) | **ASC** | `validation/run_harness.py` (the whole harness) | **newly broken** ❌ |

So the fix moved the outage rather than closing it. The harness reported
`observations: 0` for a student who has 105 rows in Firestore. Verified by
running the raw query with the `except` removed:

```
ASCENDING FAILED: FailedPrecondition
400 The query requires an index.
```

**Why nobody noticed, again:** the same `except Exception: return []` at
`firestore_adapter.py:225` (and its twin at `:195`). This is the second
multi-feature outage that pattern has hidden. `NEXT_SESSION.md` §1 step 2
already flags it — it is still unfixed, and it has now cost us twice.

> **Do this regardless of what else gets picked up:** make those handlers log.
> A config typo should not be able to present as "the student has no data."

The ASC index is now `READY`. The harness runs.

---

## 2. First real measurement of the engine — it is worse than a coin

With the harness unblocked, across **all** students (`--all`):

```
observations : 211        (not 8 — that was one student)
replay_rows  : 211
calibration  : OK          ← was INSUFFICIENT_DATA
brier_score  : 0.2964
format_separability : OK, 13 cells, 71 rows, corr −0.2516
```

`NEXT_SESSION.md` predicted `INSUFFICIENT_DATA` and told the next session to
expect it. **We are past that.** There is enough data to grade the engine, and
the grade is bad:

| Predictor | Brier (lower = better) |
|---|---|
| Engine's `concept_mastery_before` | **0.2964** |
| Always predict the base rate (0.4455) | **0.2470** |

**The mastery estimate currently predicts whether a student gets a question
right *worse than a constant* does.** n=211, 94 correct. That is the headline
number for the accuracy workstream, and it is now measurable on every change.

### Where it goes wrong is specific, not diffuse

Reliability table (predicted vs. what actually happened):

| Predicted mastery | Empirical success | n | Reading |
|---|---|---|---|
| **0.000** | **0.583** | 24 | catastrophically pessimistic |
| 0.150 | 0.400 | 15 | pessimistic |
| 0.462 | 0.360 | 25 | overconfident |
| 0.551 | 0.438 | 16 | overconfident |
| 0.668 | 0.421 | 19 | overconfident |
| 0.750 | 0.750 | 16 | calibrated |
| 0.817 | 0.667 | 9 | overconfident |

Two systematic, opposite errors:

1. **The floor is far too low.** Students the model scores at 0.0 succeed **58%**
   of the time (n=24, the largest single bin). The 0.12 cold-start floor and
   `−2.0` intercept in the mastery sigmoid are miscalibrated against reality.
   This is the single biggest contributor to the Brier score.
2. **The middle is overconfident.** Everything from 0.46–0.67 predicts ~10–25
   points higher than observed.

This is directly actionable and it **decides open Bucket C issue #15 for us.**
`ENGINE_MECHANISM.md` #15 asks whether to use population failure rate as the
cold-start prior, calling it a "pedagogical decision." It isn't anymore — the
data says the cold-start prior is the problem. That's now an empirical question
with a regression test attached.

---

## 3. The misconception stream is ~dead, and part of it is a real bug

`misconceptionGaps` drives W3 (the ingredient-level book emphasis — the thing we
claim as proprietary). Of **211 observations, exactly 1 carries a
`misconceptionId`.**

The full backend chain is intact — I traced every hop:

`questionBank.resolveChoiceEvidence` → `mlApi.recordOutcomes` (sends
`misconception_id`) → `serve.py:851` (forwards it) → `firestore_adapter:158`
(persists it). None of these drop it.

### The bug: a null distractor entry shadows the working fallback

`questionBank.ts:54–74`:

```ts
const entry = q.distractor_taxonomy?.find(d => d.choice_index === selectedIndex)
if (entry) {
  return { selectedChoiceIndex, misconceptionId: entry.misconception_id, ... }  // ← may be null
}
if (q.misconception_id) {                       // ← the fallback that would have worked
  return { selectedChoiceIndex, misconceptionId: q.misconception_id }
}
```

In the Eedi data, each question has 3 distractor entries but **only one carries a
real `misconception_id`**; the other two are explicitly `null`:

| | count |
|---|---|
| Total distractor entries | 4,524 |
| With a `misconception_id` | 1,508 (33.3%) |
| **`null`** | **3,016 (66.7%)** |
| Questions carrying a usable flat `misconception_id` | 1,508 (**all of them**) |
| Questions where a null entry shadows that usable id | **1,508** |

Because `entry` is truthy, the function returns early with `misconceptionId:
null` and **never reaches the flat fallback that would have resolved it.**
Verified against real data (`eedi_1612`):

```
choice 0 -> misc: mis_fractions_decimals__believes_subtraction_commutative  ✅
choice 1 -> misc: None   ← flat id exists, shadowed
choice 3 -> misc: None   ← flat id exists, shadowed
```

**Impact: ~2 of every 3 wrong answers silently lose their misconception tag.**
Fix is one condition (`if (entry?.misconception_id)`). Lane: Product
(`app/src/lib/questionBank.ts` — C5 seam, behavior-only change).

### That bug alone doesn't explain 1/211

18 wrong answers with a recorded choice index sit on `eedi_*` questions. The
shadowing bug predicts ~6 should still have carried a tag. We got 1. The
remainder is best explained by deployment lag — the HF Space ran pre-`79a85424`
code (which introduced both fields) for most of that window, and **that is
exactly what today's deploy fixed.** Worth re-measuring in a week rather than
theorizing further.

---

## 4. The book: Level 3 is built. All of it.

I checked `BOOK_LEVEL3_BUILD.md`'s three work items against the tree. All three
shipped:

| | Spec'd | Reality |
|---|---|---|
| **W1** questions from the learner model | `getQuestions` fed level/seen/format/story/grade | ✅ `lib/bookPersonalization.ts` → `personalizedChapterQuestions()` + fail-soft `resolveChapterQuestions()` |
| **W2** render the pathfinder route | compose the two orphaned components | ✅ `DashboardRoutePanel` imports `StudyPlanList` via `lib/bookRoute.ts`; rendered at `Dashboard.tsx:977` (`view === 'route'`) |
| **W3** ingredient-level emphasis | lead chapter with the weak ingredient's story | ✅ `emphasizedChapterStory()`, wired at `ConceptChapterPage.tsx:384` |

The content substrate is real too: `conceptStories.json` carries 49 concepts,
each with a narrative `story`, 5 `scenes`, a `contextFrame`, and
**ingredient-keyed `ingredientStories`** (keys are canonical L1 ingredient ids —
the join to the model is already correct).

**So the honest read on "what presentation ideas would use our student
modeling":** we already built them, and they're dark. Not because the
presentation layer is missing, but because:

| Book adapts on | Signal state |
|---|---|
| `topMisconceptionGap` → which ingredient story leads | **1 of 211 observations** carries one → W3 ~never fires |
| `weakness.formatId` → which format to drill | format axis works (`separability OK`) but `corr −0.2516` needs interpretation |
| `confidence` → level selection | self-report only, deliberately gated to `exposure_weight 0.4` |
| concept mastery → trim, ordering, "learn next" | **worse than a constant baseline** (§2) |

Adding book features right now adds surface area on top of signals that don't
yet earn their predictions. That's the structural argument for doing accuracy
first, and it isn't a preference — it's what the measurement says.

---

## 5. On integrating Dan's Level 2 book

Two hard constraints from `NEXT_SESSION.md` §4 and `BRAND_BOOK.md` §16, both
already settled — flagging so no spec accidentally reopens them:

- **Licensing forbids ingestion.** All three McCreary repos are CC BY-NC-SA 4.0
  (NonCommercial). MindCraft is commercial. We cannot ingest or adapt his
  graphs, skills, or book content. Reading and independently reimplementing
  *methods* is fine — methods aren't copyrightable.
- **His schema doesn't solve our gap.** His edge schema is dependency-only —
  the same hole as our own issue #1 (zero `related`/`application` edges). He has
  no learner model at all; his books sit at Level 2.9 for the same structural
  reason ours did.

So "integrating the L2 book" cannot mean importing it. It can mean
reimplementing presentation primitives his Level 2 books use — the repo's own
notes point at **MicroSims** (small parameterized interactive simulations per
concept) as the interesting one. That's a genuine gap in our book: we have
narrative and questions, no manipulable model of the concept.

**This is the one place I need a decision from you**, because it's the only
part of this review where I can't derive the answer from our own code or data —
see §7.

---

## 6. Recommended sequence

Ordered by evidence, not preference. Each step makes the next measurable.

**Now — unblock honest measurement (small, no decisions owed)**
1. Log the swallowed exceptions (`firestore_adapter.py:195, :225`). *Lane:
   Engine.* Two outages hidden, both expensive.
2. Fix the distractor shadowing bug — `if (entry?.misconception_id)`. *Lane:
   Product.* Recovers ~2/3 of misconception evidence going forward.
3. Add both `attempt_observations` index shapes to `firestore.indexes.json` so
   the ASC index isn't a snowflake that exists only because I created it by
   hand today. *Lane: Engine.*

**Next — fix the calibration (this is the accuracy work)**
4. Attack the cold-start floor first (§2, largest bin, worst error). This is
   Bucket C #15, now with an empirical answer available rather than a
   pedagogical coin-flip. Gate on Brier improving against the 0.2470 baseline.
5. Re-run `validation.run_harness --all` as the regression test on every engine
   change. It works now. It should be in CI or a pre-deploy step.

**Then — ingredient enrichment / the 82 uncovered ingredients**
6. Only after the misconception stream actually flows. Enriching labels that
   nothing populates is premature — and per the existing memo, the 82 uncovered
   ingredients are advanced ACT-only concepts, i.e. *not* where a high
   schooler's foundational holes are. Low priority, unchanged.

**Deliberately not now — new book features.** W1–W3 already outrun their inputs.

---

## 7. Decisions owed (I can't derive these)

1. **MicroSims — in or out?** Do we want interactive manipulable concept models
   in the book (independently reimplemented, per §5)? This is a real scope
   question with a real cost, and it's the only "presentation idea" from the L2
   side that we don't already have some version of.
2. **What does `format_separability corr −0.2516` mean to us?** The harness
   reports it OK with 13 qualifying cells. Negative correlation between concept
   and format mastery is *plausibly* the format axis carrying independent signal
   (good — it means format gaps aren't just restating concept gaps), but I'd
   want your read before building on it.
3. **Bucket C #7 (`effort` is synthesized, not measured)** stays blocked on the
   same definitional question as before — time-on-task? attempts? hints? The
   calibration work in §6 step 4 may make this matter more, since `effort` feeds
   `strength_score`, which is what the router actually trusts.

---

## Appendix — reproducing these numbers

```bash
# harness (needs the ASC index, created 2026-08-14)
cd ml && source mindcraft/bin/activate
FIRESTORE_PROJECT=mindcraft-93858 python -m validation.run_harness --all

# note: student ids are POSITIONAL, there is no --student flag
FIRESTORE_PROJECT=mindcraft-93858 python -m validation.run_harness <uid>

# HF deploy (one command, safe to re-run; needs an HF write token)
cd ml && source mindcraft/bin/activate
export HF_TOKEN=<write token>
HF_ORG=joinmindcraft sh scripts/deploy_hf.sh
```

Distractor coverage and calibration figures were computed directly from
`app/src/data/eediQuestions.json` and the live `attempt_observations`
collection; both are reproducible from the commands above.
