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

## 2. First real measurement — with important limits on what it measures

With the harness unblocked, across **all** students (`--all`):

```
observations : 211        (not 8 — that was one student)
replay_rows  : 211
calibration  : OK          ← was INSUFFICIENT_DATA
brier_score  : 0.2964
format_separability : OK, 13 cells, 71 rows, corr −0.2516
```

`NEXT_SESSION.md` predicted `INSUFFICIENT_DATA`. We are past that threshold.

| Predictor | Brier (lower = better) |
|---|---|
| Replayed `concept_mastery_before` | **0.2964** |
| Always predict the base rate (0.4455) | **0.2470** |
| Replay excluding cold-start rows | 0.2596 (n=187) |
| …vs. base rate on those same rows | 0.2448 |

The replayed mastery predicts correctness **worse than a constant does**, and
that holds after removing the artifact rows described below. But read §2.1
before treating this as a verdict on the production engine — it is not one yet.

### 2.1 What this test actually does — and three limits that bound it

`validation/replay.py` walks the observation log oldest-first. For each attempt
it records mastery **as reconstructed immediately before** that attempt, pairs it
with the actual outcome, then folds the attempt in via the engine's real
`apply_event_to_mastery`. `calibration.py` then bins by prediction and computes
`Brier = mean((p − a)²)`. The scorer is textbook-correct and the
before/after ordering is genuinely leak-free.

The limits are in what feeds it:

**(a) The `predicted = 0.000` bin is a harness artifact, not an engine finding.**
`replay._mastery()` returns `0.0` for a concept it hasn't seen yet — the replay
starts every node at zero. Production starts untouched nodes at the **0.12
floor**, which the replay never exercises. Measured: **all 24** of the
`predicted == 0.0` rows are first-ever `(student, concept)` sightings. So the
"predicted 0.0, 58% actually succeeded" line indicts the *replay's
initialization*, not the 0.12 cold-start prior.

> **Correction:** an earlier draft of this review used that bin to argue the
> 0.12 floor and the `−2.0` sigmoid intercept are miscalibrated, and claimed it
> settled Bucket C #15. It does not. #15 remains an open decision, and this
> harness in its current form **cannot** answer it, because it never runs the
> production cold-start path.

**(b) State is reconstructed from the observation log alone.** The replay does
not load the student's real graph — no `/seed-assessment` gap-scan seed, no
session-summary events, no temporal decay against wall-clock now. It also folds
with `effort=0.0, duration_minutes=0.0, exposure_weight=1.0`, where production
varies all three. So `concept_mastery_before` is **not** the number production
would have predicted at that moment. This measures "mastery updated only by
these 211 attempts," which is a strictly weaker predictor than the live engine.

**(c) The sample is small and concentrated.** 211 rows across 5 students, but
**105 (50%) come from a single student**. `validation/__init__.py` still labels
the whole package *"SCAFFOLDING — built to be correct and ready, NOT to produce
a verdict yet."* That label is still accurate.

### 2.2 What survives the limits

Middle-range overconfidence is not explained by (a), since those rows have real
replayed history behind them:

| Predicted mastery | Empirical success | n |
|---|---|---|
| 0.462 | 0.360 | 25 |
| 0.551 | 0.438 | 16 |
| 0.668 | 0.421 | 19 |
| 0.750 | 0.750 | 16 |
| 0.817 | 0.667 | 9 |

Everything from 0.46–0.67 predicts ~10–25 points above observed. That is a
directional signal worth chasing, on a sample too small and too
single-student-weighted to size the effect. **Treat it as a hypothesis with a
now-working test attached, not as a measured defect.**

### 2.3 What would make this a real verdict

In rough order of value:

1. **Replay from the student's actual graph state**, not from zero — load the
   seeded/decayed graph the way `/recommend` does, so the predictor is the one
   production actually uses. Until this lands, no Brier number here can indict
   or exonerate the live engine.
2. **Fold with production's parameters** (real `effort`/duration/exposure_weight
   per source) instead of the flat `0.0/0.0/1.0` stand-ins.
3. **More students.** A 50%-single-student sample can't separate "the model is
   miscalibrated" from "this student is unusual."

---

## 3. The misconception stream is ~dead, and part of it is a real bug

`misconceptionGaps` drives W3 (the ingredient-level book emphasis — the thing we
claim as proprietary). Of **211 observations, exactly 1 carries a
`misconceptionId`.**

The full backend chain is intact — I traced every hop:

`questionBank.resolveChoiceEvidence` → `mlApi.recordOutcomes` (sends
`misconception_id`) → `serve.py:851` (forwards it) → `firestore_adapter:158`
(persists it). None of these drop it.

### RETRACTED — this was reported as a bug and is not one

> **An earlier version of this review claimed `resolveChoiceEvidence`
> (`questionBank.ts:54–74`) had a shadowing bug, because a distractor entry with
> a `null` `misconception_id` returns early instead of falling through to the
> question-level flat id. It recommended "fix" `if (entry?.misconception_id)`.
> **That change would corrupt the mastery graph. Do not make it.** The
> retraction and the reason are below.**

The coverage numbers are real:

| | count |
|---|---|
| Total distractor entries | 4,524 |
| With a `misconception_id` | 1,508 (33.3%) |
| **`null`** | **3,016 (66.7%)** |
| Questions carrying a flat `misconception_id` | 1,508 |

But the flat id is **not** a question-level property that the null entries are
"missing." `scripts/ingest_eedi.py` walks the wrong choices in order, takes the
**first** one that has a misconception in the Eedi source, and `break`s:

```python
for i, col in enumerate(['MisconceptionAId', ..., 'MisconceptionDId']):
    if i == correct_idx: continue
    if pd.notna(mid_val):
        misc_id_minted = mint_misconception_id(concept_id, misc_name)
        break        # ← the flat id belongs to ONE specific wrong choice
```

`distractor_taxonomy` was added later (`3521f49f`), attaching that real id to its
matching `choice_index` and synthesizing filler entries — generic `error_type`,
`"Alternative error: …"` prose, `misconception_id: null` — for the other two
wrong choices.

So per question there are 3 wrong choices: **1 genuinely labeled, 2
placeholders**, and the flat field duplicates the genuine one. Falling through to
it when the student picked a *placeholder* distractor would tag them with a
misconception belonging to a choice **they did not select** — fabricated evidence
of exactly the kind C4's hide-correctness rule exists to prevent.

**The current code is correct: it declines to guess.**

What remains true is a **data coverage ceiling, not a logic defect**: ~2/3 of
wrong answers legitimately have no misconception to record, because Eedi only
ever labeled one distractor per question. Closing that means labeling the other
distractors (LLM or manual pass over `distractor_taxonomy`) — it is a data
workstream, not a frontend fix.

### Why the observed rate is 1/211 rather than ~1/3

18 wrong answers with a recorded choice index sit on `eedi_*` questions, so with
correct behavior roughly a third (~6) should carry a tag. We saw 1. Best
explanation is deployment lag — the HF Space ran pre-`79a85424` code (which
introduced both fields) for most of that window, and **that is what this
session's deploy fixed.** Re-measure in a week rather than theorizing further.

---

## 3.1 NEW — completed sessions are re-submitted, duplicating evidence

> Supersedes an earlier draft of this section, which framed this as an August
> "session fragmentation regression." That was wrong: the singleton-shaped
> August rows are a *symptom*, and the underlying problem spans every month.

Duplicate = the same `(student, question, outcome)` written more than once.

| | |
|---|---|
| Redundant observation rows | **60 of 211 — 28.4%** |
| …by month | June 46 · July 14 · August 28 (**not** an August regression) |
| Genuine re-attempts (same question, *different* outcome) | only 10 |
| Redundant `interactions` events (`source=practice`) | **53 of 115 — 46%** |
| Worst | `fn-3-6` ×11 · `eedi_1612` ×10 · `fractions_decimals outcome=0.7` folded 10× in one day |

Intervals between repeats are human-scale (89 min, 41 min, 103 min…), so this is
not a retry loop or a re-render — it is a person returning to the app.

### The mechanism (each link verified in code)

1. `finishSession` (`Practice.tsx:1370`) posts `resultsSnapshot.map(...)` — the
   **entire** session's results, every time it fires, not just new answers.
2. It sets `pPhase = 'complete'` and **never clears the draft** (`clearPracticeDraft`
   is called at 1213/1557, not from `finishSession`).
3. The persist effect (`~760`) skips only `'onboard'` and `'path'` — so a draft
   **is saved at `pPhase: 'complete'`**, carrying the full `results`,
   `questions`, `qIndex`, and `selectedIndices`.
4. `restorePracticeDraft` (`534`) passes `'complete'` straight through, restoring
   the finished session with all state intact.

Any interaction that re-reaches `finishSession` from that restored state
re-posts the whole set. **The one link not yet closed is the exact user action
that re-fires it** — that needs instrumenting, not more code reading.

### Why this matters more than it looks

**Production:** mastery is `σ(−2.0 + 0.8·log(evidence+1) + 1.5·avg_outcome + …)`.
Ten duplicate folds move `log(evidence+1)` from 0.69 → 2.40, roughly **+1.37 on
the logit** from evidence the student never produced. The engine believes it has
10× the evidence it has.

**Testing — and this is the counterintuitive part:** duplicates make calibration
look *better* than it is. The replay folds the same outcome repeatedly, dragging
mastery toward that outcome, so the next prediction of that same outcome scores
well. It is self-reinforcing. Removing them makes the picture worse:

| | obs | sessions | Brier | constant baseline |
|---|---|---|---|---|
| Raw | 211 | 60 | 0.2964 | 0.2470 |
| **Deduped** | **151** | **30** | **0.3221** | **0.2495** |

The gap to baseline widens from 0.049 to **0.073**. §2's overconfidence finding
is understated, not overstated.

### Direct consequence for the per-attempt → per-session move

**After dedup there are only 30 sessions — below `MIN_ATTEMPTS = 50`.** Session-
level calibration would return `INSUFFICIENT_DATA` on today's data. The
reconciliation is still the right design (it matches what production folds), but
it needs either more volume or a lower threshold, and dedup has to land first
either way — otherwise sessions are counted twice and the metric flatters itself.

**Dedup key for the ETL:** `(student_id, question_id, correct)`, keep earliest
timestamp. Genuine re-attempts survive, since those carry a different outcome
(10 cases).

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
| concept mastery → trim, ordering, "learn next" | replay says worse than a constant baseline — but see §2.1, that test doesn't yet measure the production predictor |

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
2. ~~Fix the distractor shadowing bug.~~ **Retracted — not a bug, and the
   proposed change would fabricate evidence.** See §3. The real item is a *data*
   one: label the 3,016 placeholder distractor entries so the other two wrong
   choices per question carry genuine misconceptions. *Lane: Engine (data).*
3. Add both `attempt_observations` index shapes to `firestore.indexes.json` so
   the ASC index isn't a snowflake that exists only because I created it by
   hand today. *Lane: Engine.* **Done** in this commit — `firestore.indexes.json`
   is the deploy source of truth, so leaving it undeclared meant the next index
   deploy would delete the new index and silently re-break the harness.

**Next — make the harness able to render a verdict (§2.3)**
4. Replay from the student's **real graph state** rather than from zero, and fold
   with production's `effort`/duration/`exposure_weight`. *Lane: Engine.* This is
   the prerequisite for every calibration claim — right now the harness grades a
   weaker predictor than the one we ship, so neither a good nor a bad Brier
   score can be trusted about production.
5. Re-run `validation.run_harness --all` as the regression test on every engine
   change. It works now. Once step 4 lands it belongs in CI or a pre-deploy step.
6. **Only then** revisit the calibration questions (Bucket C #15, the sigmoid
   intercept). They are still open decisions — §2.1 explains why this harness
   cannot currently answer them.

**Then — ingredient enrichment / the 82 uncovered ingredients**
7. Only after the misconception stream actually flows. Enriching labels that
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

To reproduce the §2.1 limits (that the `0.0` bin is a replay artifact, and the
Brier gap with those rows removed):

```python
# ml/, venv active, FIRESTORE_PROJECT=mindcraft-93858
from mindcraft_graph.firestore_adapter import load_attempt_observations, db
from validation.replay import build_replay_table

ids = {(d.to_dict() or {}).get("studentId")
       for d in db.collection("attempt_observations").stream()}
obs = [o for sid in ids if sid for o in load_attempt_observations(sid)]
rows = build_replay_table(obs)

zero = [r for r in rows if r.concept_mastery_before == 0.0]
# -> 24 rows; every one is a first-ever (student, concept) sighting
nz = [r for r in rows if r.concept_mastery_before > 0.0]
brier = lambda rs: sum((r.predicted - r.actual_outcome) ** 2 for r in rs) / len(rs)
base  = lambda rs: sum(r.actual_outcome for r in rs) / len(rs)
print(brier(rows), brier(nz), base(nz) * (1 - base(nz)))
# -> 0.2964   0.2596   0.2448
```
