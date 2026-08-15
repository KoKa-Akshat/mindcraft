# BUILD — Practice loop evidence integrity (idempotent finish · repeat weighting · three lives)

Three changes that **must land in this order**. Each is safe alone; shipping the
third without the second actively multiplies the bug the first one fixes.

| # | Change | Lane | Files |
|---|---|---|---|
| **A** | Idempotent session finish | **Product** | `app/src/pages/Practice.tsx` |
| **B** | Repeat-aware evidence weighting | **Engine** | `ml/serve.py`, `ml/mindcraft_graph/models/events.py` |
| **C** | Three lives + requeue to end | **Product** | `app/src/pages/Practice.tsx` |

Ordering is not a preference: **C multiplies same-question repeats by design**, so
it is only safe once B makes repeats count less. A stops the corruption that is
happening right now.

---

## The evidence this is built on

Measured on live Firestore (`ENGINE_BOOK_ACCURACY_REVIEW.md` §3.1):

| | |
|---|---|
| Redundant `attempt_observations` | **60 of 211 — 28.4%** |
| Redundant `interactions` (`source=practice`) | **53 of 115 — 46%** |
| Spread | June 46 · July 14 · August 28 — **all months** |
| Affected students | **6 of 9** (14%–55% each) — systemic, not one test account |
| Genuine re-attempts (same question, *different* outcome) | only 10 |

Mastery is `σ(−2.0 + 0.8·log(W_eff+1) + …)`. Ten duplicate folds move
`log(W_eff+1)` from 0.69 → 2.40 — roughly **+1.37 on the logit** from evidence
the student never produced.

---

## A — Idempotent session finish *(Product)*

**The mechanism, each link verified in code:**

1. `finishSession` (`Practice.tsx:~1370`) posts `resultsSnapshot.map(...)` — the
   **entire** session's results, every time it fires.
2. It sets `pPhase = 'complete'` and **never clears the draft**
   (`clearPracticeDraft` is called at ~1213 / ~1557, not from `finishSession`).
3. The persist effect (`~760`) skips only `'onboard'` and `'path'` — so a draft
   **is saved at `pPhase: 'complete'`** carrying full `results`, `questions`,
   `qIndex`, `selectedIndices`.
4. `restorePracticeDraft` (`~534`) passes `'complete'` straight through,
   restoring a finished session with all state intact.

Repeat intervals are human-scale (89 min, 41 min, 103 min) — a person returning
to the app, not a retry loop or a re-render.

**Build:** make `finishSession` idempotent — a given completed session submits
**exactly once**, no matter how many times it is re-entered.

Chosen deliberately over "clear the draft on finish": the exact interaction that
re-reaches `finishSession` from restored state was **not** identified, so guard
the submission rather than one suspected entry path.

Suggested shape (adapt, but meet the property):
- Derive a stable `sessionSubmissionId` when a session *starts* — e.g.
  `{uid}:{missionType}:{concept}:{startedAt}`. It must survive a draft
  round-trip, so persist it **in the draft**.
- Keep a submitted-ids set in `localStorage` (and in the draft). `finishSession`
  returns early if its id is present.
- Mark submitted **before** the network call; on failure allow one retry of that
  same id (don't leave a real session unrecorded).
- Persist the id alongside the draft so a resumed complete draft is recognised.

**Also fix (same change, one line):** stop persisting drafts at
`pPhase === 'complete'`. A completed session is not resumable work. Add
`'complete'` to the skipped phases in the persist effect. Keep A's guard anyway —
belt and braces, since this bug has already survived one "fix."

**Acceptance**
- [ ] Completing a session, force-reloading, and re-entering the restored draft
      produces **one** `/record-outcomes` call, not two.
- [ ] A genuinely new session on the same concept still submits.
- [ ] Offline/failed submit then retry records exactly once.
- [ ] `npx vitest run` green; `git diff --stat` shows `app/**` only.

---

## B — Repeat-aware evidence weighting *(Engine)*

**The lever already exists.** `SessionEvent.exposure_weight` scales *both*
accumulators in `engine/update.py`:

```python
new_cumulative = cm.cumulative_outcome * factor + event.outcome * event.exposure_weight
new_weighted   = cm.weighted_count   * factor + event.exposure_weight
```

Precedent is established — self-report and card events already ride at `0.4`. So
"a repeat pushes less mastery" needs **no new field and no schema migration**.

**Two channels, deliberately asymmetric** (this is the design):

- **Mastery** — a repeated question is *weaker* evidence of ability. Damp it.
- **Misconception** — a repeated wrong answer on the same trap is *stronger*
  evidence of a stable misconception. Do **not** damp it; arguably strengthen it.

They already travel on separate rails: `misconception_counts` is a plain counter
on `ingredient_state`, independent of mastery. Preserve that separation.

**Build**
1. In `/record-outcomes`, count prior attempts per `(student, question_id)` — the
   `attempt_observations` log is the source of truth.
2. Derive a per-question repeat weight. Start with the existing ladder for
   consistency: **1.0 / 0.4 / 0.15**, floor `0.15`. Put it in `config.py`; do not
   scatter constants.
3. The concept event's `exposure_weight` becomes the **mean of its questions'
   repeat weights** (a session of all-fresh questions is unchanged at 1.0).
   Same for format events.
4. **Collapse duplicate entries for the same question within one call** into a
   single outcome before aggregating — one object, damped weight — rather than
   letting a requeued question contribute twice at full strength.
5. Leave `misconception_counts` incrementing per occurrence.

**Decide and write down** (`serve.py` already has this asymmetry by accident, and
it should become deliberate): the ingredient fire is deduped per
`(misconception, ingredient)` **per request** while `misconception_counts`
increments **per observation**. Keep it — but say so in a comment, because it is
currently the only repeat-weighting in the system and nobody designed it.

**Acceptance**
- [ ] Unit test: same question 3× in one call → one outcome, weight `≤ 0.4`, and
      `misconception_counts` still `3` if it carries a misconception.
- [ ] Unit test: fresh session → `exposure_weight == 1.0` (no behavior change).
- [ ] Replaying the existing corpus no longer inflates `weighted_count` on the
      known offenders (`eedi_1612`, `fn-3-6`).
- [ ] `pytest` green; `python scripts/end2end.py` still 85/85.

---

## C — Three lives + requeue to the end *(Product)*

**Half of this already exists.** `advanceQuestion` already pushes a wrong answer
to the end of the queue — but capped at **once per question**
(`!requeuedIds.includes(currentQ.id)`).

**Build**
- Raise the cap to **3 attempts per question** per session; track a per-question
  attempt count instead of a boolean set.
- Wrong answers re-enter at the **end** of the queue (existing behavior — keep it).
- After 3 failed attempts, the concept practice **restarts regardless of
  progress** — the lives are per concept-practice run, not per question.
- Respect `MAX_SESSION` so the queue cannot grow without bound.

**Why this is gated on B:** each retry adds another `resultsSnapshot` entry for
the same question, and `finishSession` posts every entry. Today that is already
the source of the 10 genuine re-attempts. At 3 lives it triples — which is
correct pedagogy and *wrong* evidence unless B has landed.

**A session event stays what it is.** One `/record-outcomes` call → one
`SessionEvent` per concept, scored `k/N`. A three-lives run is one call, so it is
one event per concept. Nothing about the event boundary changes.

**Acceptance**
- [ ] A question answered wrong 3× ends the run and restarts the concept practice.
- [ ] Wrong answers appear at the end of the queue, not immediately.
- [ ] One run = one `/record-outcomes` call regardless of retries.
- [ ] `npx vitest run` green; `git diff --stat` shows `app/**` only.

---

## Out of scope

- **Backfilling the 53 redundant `interactions` already in Firestore.** They sit
  in live mastery right now. Worth doing, but it is a data-migration decision
  (Blake's call), not part of this build.
- Changing `compute_mastery_score`, the decay half-life, or any mastery consumer.
- The ingredient → concept mastery rewire — see
  `INGREDIENT_MASTERY_REWIRE_BUILD.md`.
- An XP/experience mechanic. `Practice.tsx` has client-only `xp` state today; a
  real one is a product decision, not an evidence fix.
