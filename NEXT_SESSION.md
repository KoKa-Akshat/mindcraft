# Next session — predictor, evidence integrity, and the annotation gap

Written 2026-08-15. **Supersedes the 2026-08-14 version** of this file (that one
described the engine bucket A/B session; its §1 was substantially wrong — see
"Retractions" below, they matter).

The through-line: **we are making the Level 3 book real by making the student
model predictive.** Everything below serves that.

---

## 0. Repo state — read before touching anything

**3 commits are local and UNPUSHED:**
```
10576984 specs: practice-loop evidence integrity + ingredient mastery rewire
6e4680e8 specs(engine): item predictor build + classifier/ingredient audit prompt
45ef0d9b docs: session-fragmentation hunt resolves to duplicate re-submission
```

**Substantial uncommitted work in the tree** (implementations of the specs, done
by agents; verify state before assuming anything is finished):
```
 M app/src/pages/Practice.tsx                      ← practice-loop A/C
 M ml/serve.py, models/events.py,
   engine/ingredient_runtime.py, config.py         ← practice-loop B + ingredient rewire
 M ml/mindcraft_graph/firestore_adapter.py         ← dedup
 M ml/validation/replay.py, run_harness.py
?? ml/validation/predictor.py, fit_predictor.py    ← the item predictor
?? ml/tests/test_item_predictor.py,
   test_attempt_observation_dedup.py
?? agent_work/engine/CLASSIFIER_INGREDIENT_AUDIT.md ← audit deliverable, done
?? ml/scripts/audit_classifier_ingredient.py
```

First moves: `git pull origin main`, run `cd ml && pytest` and
`python scripts/end2end.py` (expect 85/85), then decide what to commit. Per
CLAUDE.md never leave work uncommitted across sessions — this is already over
that line.

---

## Retractions — do NOT re-derive these

Two confident claims from this work were **wrong and are corrected in the repo**.
Both failed the same way: inferring a defect from code shape without checking
what the data meant. If you find yourself about to "fix" either, stop.

1. **The `resolveChoiceEvidence` "shadowing bug" is NOT a bug.**
   `questionBank.ts` returns early on a distractor entry whose
   `misconception_id` is null instead of falling back to the question-level flat
   id. That looks like a bug. It isn't: `ingest_eedi.py` takes the **first** wrong
   choice with a misconception and `break`s, so the flat id **belongs to one
   specific wrong choice**. Falling through would tag a student with a
   misconception belonging to a choice they didn't pick. **The current code
   correctly declines to guess. Do not "fix" it.**

2. **The "August session-fragmentation regression" was a mis-framing.** The real
   problem is duplicate re-submission across *all* months (see §2).

Also corrected: the 2026-08-14 claim that the `attempt_observations` index bug
was "fixed + verified." It was half-fixed — see §1.

---

## 1. Infrastructure fixed this session (don't redo)

- **HF Space deploys work again.** The Hub now rejects plain binary pushes, so
  `bank_index.npz` ships via the Hub API inside `ml/scripts/deploy_hf.sh`. One
  command, idempotent, verified over 3 consecutive runs:
  ```bash
  cd ml && source mindcraft/bin/activate
  export HF_TOKEN=<write token>          # or see ~/.git-credentials
  HF_ORG=joinmindcraft sh scripts/deploy_hf.sh
  ```
  Engine buckets A/B are **live** on the Space (they weren't before).

- **Firestore: the missing ASC index was created.** `400bbd96` had created the
  DESC index and *deleted* the ASC one — but `load_attempt_observations`
  (`firestore_adapter.py:165`) queries **ASCENDING** and feeds the entire
  validation harness, which was silently returning `[]` via the bare
  `except Exception: return []`. Both index shapes are now declared in
  `firestore.indexes.json` (that file is the deploy source of truth — leaving one
  undeclared means the next index deploy deletes it).

- **Still unfixed, still dangerous:** the bare `except Exception: return []` at
  `firestore_adapter.py:195` and `:225`. It has now hidden two multi-feature
  outages. Make them log.

---

## 2. The duplicate-evidence bug (highest-value open item)

**28.4% of `attempt_observations` and 46% of practice `SessionEvents` are
duplicates** — same `(student, question, outcome)` written repeatedly, across all
months (Jun 46 / Jul 14 / Aug 28), affecting **6 of 9 students** (14%–55% each).
Only 10 cases are genuine re-attempts.

Mechanism, each link verified in code:
1. `finishSession` (`Practice.tsx:~1370`) posts the **entire** results array every
   time it fires
2. it never clears the draft
3. the persist effect (`~760`) skips only `'onboard'`/`'path'`, so a draft **is
   saved at `pPhase:'complete'`**
4. `restorePracticeDraft` (`~534`) passes `'complete'` through with
   `results`/`questions`/`qIndex` intact

**Not closed:** the exact user action that re-reaches `finishSession` from
restored state. Repeat intervals are human-scale (89min, 41min, 103min) — a
person returning to the app, not a retry loop. This is why the fix guards the
*submission* (idempotency) rather than one suspected entry path.

**Why it matters twice over:**
- *Production:* ten duplicate folds move `log(W_eff+1)` from 0.69 → 2.40, ≈ **+1.37
  on the mastery logit**, from evidence the student never produced.
- *Testing:* duplicates **flatter** calibration (folding the same outcome
  repeatedly drags mastery toward it, so the next identical prediction scores
  well). Deduped, the picture is worse: Brier 0.3221 vs 0.2495 constant.

**Volume is the binding constraint on everything in §3, and this bug is the
cheapest source of it.**

---

## 3. The item predictor — built, failed, diagnosed

**The category error it fixes:** the harness used concept mastery *directly* as
P(correct), so nothing about the question entered. Mastery is a hand-tuned
pedagogical index (`σ(−2.0 + 0.8·log(W+1) + …)`), never fit to correctness.

**Design decision (hold this line):** the predictor is **decoupled** from mastery
and lives in `ml/validation/`. Mastery has many consumers — pathfinder trim, exam
ranking, learn-next, decay, displacement, UI — and they all want a stable
aggregate. **Do not "fix" prediction by changing `compute_mastery_score`.**

**Result:** in-sample 0.2387 (beats the 0.2495 constant). Held out,
observation-weighted: **0.2676 vs 0.2538 — fails.** 117 of 151 held-out rows sit
in failing folds; the only two folds with meaningful n both lose.

**Diagnosis:** parameters unidentified (`concept_weight` pinned at its 5.0 bound;
`format_weight` and `level_scale` flip sign across folds). And `format_weight` is
worse than unidentified — it is **mis-specified**: format mastery is a **global
node, not per-concept**, so it leaks cross-concept competence into concepts the
student is failing (`functions_basics` 25% accurate, format 0.80 → predicted
0.71). This independently explains the separability harness's −0.25
concept/format correlation.

**Next step is pre-registered** in
`agent_work/engine/ITEM_PREDICTOR_BUILD.md` — a 2-parameter variant (`a`, `w_c`
only) with its predictions written down *before* running, and explicit
instructions for how to read each outcome. **Read that section before running
it.** Do not tune to pass.

**Known limit, for later:** `b` is keyed **per concept**, not per item
(`replay.py:95`). Two questions in the same concept at the same level get
identical predictions; the only true per-item input is `level`. **Empirical item
difficulty** is the natural next term and needs no ingredient tagging.

**Not now: gradient boosting.** n=151 with 54% from one student, where 4
parameters are already unidentified. Also costs the interpretability that lets
the product select items near P≈0.7.

---

## 4. The audit found a free win — take it first

`agent_work/engine/CLASSIFIER_INGREDIENT_AUDIT.md` (delivered, uncommitted).
Verdict: *conditional yes, but aimed at the wrong bottleneck.*

**The headline: 2,055 per-distractor misconception tags are sitting unused in
`data/eedi/train.csv`.** `ingest_eedi.py` `break`s after the first wrong answer
with a misconception, discarding the rest. **2,010 already resolve to an
ingredient through the existing 655-entry map — 1.87× the ingredient evidence the
bank carries today, for zero model cost.** This also closes the "1 real + 2 null
distractors" problem at the source, without generation.

Two other corrections from the audit:
- The classifier's **0.80 is 0.7593** in the configuration that actually ships.
- The generation "**~30% bad key rate**" is not a key-error rate at all — all 45
  drops carry the single reason `solver_disagreed` (one LLM disagreeing with
  another), and the dropped text was never persisted, so the standing "it's
  arithmetic" hypothesis has never had evidence either way.

---

## 5. Open specs (all in `agent_work/`, indexed in its README)

| Spec | Lane | State |
|---|---|---|
| `cross-cutting/PRACTICE_LOOP_EVIDENCE_BUILD.md` | Product A/C + Engine B | implemented, uncommitted — **ordered**: idempotent finish → repeat weighting → 3 lives. C triples repeats by design, only safe after B |
| `engine/INGREDIENT_MASTERY_REWIRE_BUILD.md` | Engine | implemented, uncommitted. Key call: must emit a **low-weight `SessionEvent`**, not overwrite `mastery_by_concept`, or the next rebuild discards it |
| `engine/ITEM_PREDICTOR_BUILD.md` | Engine | Stage 1 done + failed; 2-param experiment pre-registered |
| `engine/CLASSIFIER_INGREDIENT_AUDIT_PROMPT.md` | Engine | **done** → see the audit |
| `product/APP_ROOT_NO_REDIRECT_PLAN.md` | Product | open, untouched |

---

## 6. Design decisions already made — don't relitigate

- **A session event** = one concept's aggregate score from **one
  `/record-outcomes` call**, scored `k/N`. Not login-to-tab-close. A three-lives
  run is one call, so it is one event per concept.
- **Two channels stay asymmetric:** repeats damp **mastery** (via
  `exposure_weight`, which already scales both accumulators and already has
  precedent at 0.4) but do **not** damp `misconception_counts` — a repeated wrong
  answer on the same trap is *stronger* evidence of a stable misconception.
- **Ingredient evidence is second-hand** (the map is 53% LLM-generated) → it
  enters at `exposure_weight` 0.15, as an event, never as an overwrite.
- **Licensing:** all McCreary repos are CC BY-NC-SA (NonCommercial); MindCraft is
  commercial. His graphs/skills/books **cannot** be ingested. Reimplementing
  *methods* is fine. `BRAND_BOOK.md` §16 binds public use of his name.

---

## 7. Recommended order

1. **Commit/push what's in the tree** (it's overdue) after `pytest` + `end2end`.
2. **Ship practice-loop A** (idempotent finish). It stops live mastery corruption
   and is the cheapest source of the volume everything else needs.
3. **Re-ingest Eedi without the `break`** (§4). Free 1.87× ingredient evidence.
4. **Run the pre-registered 2-param predictor experiment.** Read the
   pre-registration first; accept a null result if that's what it gives.
5. Then: empirical item difficulty, or the ingredient→mastery rewire, depending
   on what step 4 says.

---

## 8. Gotchas worth carrying forward

- `validation.run_harness` takes student ids **positionally** — there is no
  `--student` flag. `--all` discovers them.
- `evictQuestionCache` lives in `questionAgent.ts` and is for **LLM-generated**
  questions; `getQuestions` (static bank) has **no cache** — it shuffles.
- `getQuestions` accepts `seenIds`, but **`Practice.tsx` passes `[]` at both call
  sites** — repeat avoidance is effectively off.
- Firestore returns tz-aware datetimes; the engine is naive. `_to_naive()`.
- **Detail lives in `ENGINE_BOOK_ACCURACY_REVIEW.md`** (repo root) — the full
  measurements, both retractions with evidence, and the reproduction commands.
