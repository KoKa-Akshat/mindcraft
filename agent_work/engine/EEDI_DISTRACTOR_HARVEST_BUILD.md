# BUILD — Eedi distractor harvest + ingredient tag emission

**Status (2026-08-16):** ⚠️ **S1/S2 are SUPERSEDED by**
[`EEDI_JOIN_UNIFY_BUILD.md`](EEDI_JOIN_UNIFY_BUILD.md). The backfill ran and
landed 2,208 tags, but **561 of them (25.4%) are scoped to the wrong concept**,
and 119 further slots were missed — two defects in the
`promote_questions.py` join that S1 mandated reusing. **Do not commit that
output.** S4 is done and correct but only takes effect through a re-ingest,
which is destructive (see the unify build §2) — its result is applied
surgically there instead. S3 is unchanged in intent; its open decisions are now
settled in the unify build §6.

**Source of findings:**
[`CLASSIFIER_INGREDIENT_AUDIT.md`](CLASSIFIER_INGREDIENT_AUDIT.md) §B4, §D11, §D12
Tier 1 items 1–2.

**This is a build spec.** Every step below is implementable as written. Where a
decision is left open it is marked **DECISION** and must come back to the
architect before that step ships.

---

## Lanes and file ownership

This build crosses the Engine→Product data seam. Read this table before touching
anything.

| Path | Lane | This build |
|---|---|---|
| `ml/scripts/backfill_distractor_misconceptions.py` | **Engine** | **new file** |
| `ml/scripts/promote_questions.py` | **Engine** | modified — extract, do not rewrite |
| `ml/scripts/ingest_eedi.py` | **Engine** | one-loop bug fix (S4) |
| `ml/data/misconception_ingredient_map.json` | **Engine** | read-only input |
| `data/eedi/train.csv` | **Engine** | read-only input |
| `app/src/data/eediQuestions.json` | **Product tree, Engine-generated** | **rewritten by script** — land as its own data commit |
| `app/src/lib/questionBank.ts` | **Product, shared seam (C5)** | type-only change in S3 — high blast radius, change deliberately |

`ml/scripts/ingest_eedi.py` already crosses this same seam, so the pattern is
established; the care is owed to the *merge*, not the mechanism.

**Fenced off — do not touch.** `make_concept_text`, `concept_embeddings.npz`
(`CLASSIFICATION_FIX_BUILD.md` §C-C), `ml/data/bank_index.npz`,
`ml/data/bank_index_meta.json`. Nothing in this build needs them; the shipped
index was verified current (1 obsolete row, 0 drift) and rebuilding it is a
*different* work item (audit §D12 item 4).

---

## Why this exists

The bank's per-distractor misconception coverage is **self-inflicted at
ingestion, not a data gap.** `ingest_eedi.py:763–772` loops over all four
`Misconception*Id` columns but `break`s on the first one it resolves, keeping a
single tag per question and discarding the rest.

Measured on the current tree (reproduce with the snippet in "Acceptance", S0):

| | source `train.csv` | live `eediQuestions.json` |
|---|---:|---:|
| wrong-answer slots | 4,524 | 4,524 |
| slots carrying a misconception | **3,563 (78.8%)** | **1,508 (33.3%)** |
| questions with all 3 distractors tagged | — | **0** |

**2,055 human-authored tags are sitting unused on disk.** 2,010 of them already
resolve to an ingredient through the existing 655-entry map — **1.87× the
ingredient evidence the bank carries today, at zero model cost and zero
annotation cost.**

The consumer path already exists and is waiting: `Question.distractor_taxonomy[]`
carries an optional per-choice `misconception_id`
([`questionBank.ts:41-45`](../../app/src/lib/questionBank.ts#L41-L45)), and
`resolveMisconception()` ([`questionBank.ts:57-71`](../../app/src/lib/questionBank.ts#L57-L71))
already reads the taxonomy first and falls back to the question-level tag. **No
consumer code changes are required for S1–S2.** This is a data fill into a live,
already-wired field.

---

## S1 — Extract the mechanical backfill (Engine)

`promote_questions.py` **already implements this**. `enrich_distractor_taxonomy()`
(line 197) does exactly the required join, with `build_train_index()` (115),
`build_numeric_to_slug()` (156), and `letter_to_index()` (192) as its helpers.
It has never shipped because it is gated behind three unrelated things:

1. a Firestore **engagement ranking** (`aggregate_firestore_counts`) that needs
   student traffic that does not exist yet,
2. a **`--top-n 30`** cap, and
3. a human **`world_feedback`** authoring step that `--merge` blocks on.

Only the third is genuinely blocked. **Decouple the mechanical join from the
human step.**

Create `ml/scripts/backfill_distractor_misconceptions.py`:

- **Import and reuse** the four helpers above from `promote_questions` — do not
  copy-paste them, and do not reimplement the letter↔index mapping. That mapping
  is the subtle part (`train.csv` `CorrectAnswer` is `A/B/C/D`, `correctIndex` is
  0-based) and it is already correct; a second copy will drift.
- Operate on **all 1,508** questions. No ranking, no cap, no Firestore.
- **Write no `world_feedback` key at all.** Leave that field's authoring entirely
  to `promote_questions.py`, which keeps its current behavior unchanged.
- Flags: `--dry-run` (report counts, write nothing) and `--out PATH` (default:
  in-place on `app/src/data/eediQuestions.json`).

**Idempotency is a hard requirement.** Re-running must be a no-op. Never
overwrite an existing non-null `misconception_id` on a taxonomy entry; fill only
empty slots, and count filled-vs-skipped separately in the summary.

**Invariants — assert, don't assume.** The script must fail loudly rather than
write if any of these break for a question:

- `choices` array and `correctIndex` are **byte-identical** before and after
- no taxonomy entry is written for `choice_index == correctIndex`
- every emitted `misconception_id` exists in `ml/data/eedi_misconceptions.json`
- `question`, `explanation`, `hints`, `format`, `storyContext` are untouched

## S2 — Run it, land the data (Engine → Product tree)

Run over all 1,508 and write `app/src/data/eediQuestions.json`.

**Do not re-run `ingest_eedi.py` to achieve this** — but note the reason given
here was **wrong**, and the corrected reason matters. There is no Groq cache
(`data/eedi/.explain_cache.json` does not exist) and the live explanations are
template output, so there is no LLM text to protect. The real hazard, measured:
a re-ingest **wipes `storyContext` on all 1,508 questions** and reverts two
manually-cleaned `choices` arrays. See
[`EEDI_JOIN_UNIFY_BUILD.md`](EEDI_JOIN_UNIFY_BUILD.md) §2. This is a surgical
field fill on the existing artifact.

Commit the regenerated JSON as its **own commit**, separate from the script, so
the diff is reviewable as data. It lands in the Product tree — keep it a pure
data diff so a later `git show` reads as one mechanical fill.

## S3 — Emit ingredient tags (Engine → Product seam) — **decide the shape first**

The join `misconception_id → ingredient_id` via
`ml/data/misconception_ingredient_map.json` resolves **1,077 questions (55.5%)**
today, and **2,010 distractor slots** after S2. The map is not inert — audit §B4
measured **655/655 mapped misconceptions reachable from a live bank question**.

The `Question` type currently has **no ingredient field at all** (verified). Adding
one touches `questionBank.ts`, a **C5 shared seam**. Proposed shape:

```ts
// Question (question-level: union of all ingredients this item can evidence)
ingredient_ids?: string[]
// distractor_taxonomy[] entry (per-choice: the ingredient this specific error evidences)
ingredient_id?: string
```

**DECISION — SETTLED 2026-08-16, see [`EEDI_JOIN_UNIFY_BUILD.md`](EEDI_JOIN_UNIFY_BUILD.md) §6.**
Question-level `ingredient_ids?: string[]` only — **no per-choice
`ingredient_id`**, since it stays derivable at runtime from
`distractor_taxonomy[].misconception_id` + the map. **Materialized at build**,
with the map's `_meta.version` stamped in. The trade-off as originally
framed: materializing keeps the
runtime free of a second data file; resolving at runtime keeps the bank JSON
smaller and lets a map correction take effect without regenerating the bank.
Recommend **materialized**, with the map's `_meta.version` stamped into the
generated file so staleness is detectable.

Whichever is chosen: carry **provenance** through. Per audit §B5, `llm`-provenance
map entries agree with independent ontology ground truth at **0.545** versus
**0.928** for `human`. Downstream consumers must be able to weight or filter by
it, so emit the source entry's provenance alongside the id. Do not pool them.

## S4 — Fix the source bug (Engine)

Fix the `break` at `ml/scripts/ingest_eedi.py:763–772` so a future re-ingest
collects **all** wrong-answer misconceptions rather than the first, populating
`distractor_taxonomy` directly.

This is a correctness fix so the bug does not silently return. It does **not**
regenerate the bank on its own — S2 is what lands the data now. Keep the
question-level `misconception_id` field populated as it is today (first resolved
tag) for backward compatibility.

---

## Acceptance criteria

**S0 — record the baseline first**, so the delta is provable:

```bash
python3 -c "
import json
qs=json.load(open('app/src/data/eediQuestions.json'))
slots=sum(len(q['choices'])-1 for q in qs)
tagged=sum(1 for q in qs for e in (q.get('distractor_taxonomy') or []) if e.get('misconception_id'))
full=sum(1 for q in qs if sum(1 for e in (q.get('distractor_taxonomy') or []) if e.get('misconception_id'))>=3)
print(f'{len(qs)} questions, {slots} slots, {tagged} tagged, {full} fully-tagged')"
```

Baseline as of 2026-08-15: `1508 questions, 4524 slots, 1508 tagged, 0 fully-tagged`.

After S2, the same command must report:

| metric | before | after (target) |
|---|---:|---:|
| tagged distractor slots | 1,508 (33.3%) | **~3,563 (78.8%)** |
| questions with all 3 tagged | 0 | **~769** |
| questions with ≥2 tagged | — | **~1,286** |
| slots resolving to an ingredient | ~1,508 | **~2,010** |

Treat the targets as ±2%. **A materially lower number means the letter↔index
mapping is wrong — stop and diff against `train.csv` by hand rather than
adjusting the target.** A materially *higher* number means correct-answer slots
are being tagged; also stop.

Plus:

- Re-running the script a second time changes **zero** bytes.
- `cd ml && python scripts/audit_classifier_ingredient.py --section B` still runs
  and reports the improved join counts.
- `cd app && npm run build` succeeds (S3 only).
- No change to `ml/data/bank_index.npz` or `bank_index_meta.json` — verify with
  `git status` before committing.

---

## Out of scope

- Mapping the 882 unmapped Eedi misconceptions (audit §D12 item 8) — **data-blocked**
  on human review capacity, and llm-only would land near 0.545.
- Rebuilding `bank_index.npz`, canonicalizing concept aliases, or the k=10→5
  change (§D12 item 4) — separate build, separate HF ship.
- Anything in the generation stack. Audit §D12 is explicit that the verifier
  (item 5) must land before any generation-quality number is worth acting on.
- The `misconception_counts` batching asymmetry (§B7, §D12 item 12).

---

## Expected outcome

Closes the "2 of 3 distractors carry no misconception" gap outright, and takes
"0 of 1,713 questions carry ingredient tags" to ~55% — **without a single model
call, annotation hour, or generated item.** Per audit §D12: *"items 1–2 produce
more ingredient evidence this week than the entire generation stack has produced
to date."*

One caveat to carry forward, stated in audit §3 item 6: this build measures the
*availability* of ingredient evidence, never its *value*. Nothing yet shows
ingredient-level evidence predicts better than concept-level. The test for that
is the `ml/validation/` harness against the `ITEM_PREDICTOR_BUILD.md` baselines
(Brier 0.3221 / 0.2495) — **that is the follow-on that decides whether any of
this mattered**, and it should be scheduled as soon as S2 lands.
