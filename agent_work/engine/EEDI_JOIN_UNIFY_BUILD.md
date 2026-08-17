# BUILD — Unify the Eedi distractor join on ingest semantics

**Status:** ready to implement. **Supersedes S1/S2 of**
[`EEDI_DISTRACTOR_HARVEST_BUILD.md`](EEDI_DISTRACTOR_HARVEST_BUILD.md), whose S2
output is **measurably wrong** and must not be committed. S3/S4 of that spec
still stand; S3's open decisions are now settled (see §6).

**Written 2026-08-16**, after the S2 backfill ran and was diffed against a
scratchpad re-ingest. Every number below is measured, not estimated. The
reproduction commands are in §5.

---

## Lanes and file ownership

| Path | Lane | This build |
|---|---|---|
| `ml/scripts/backfill_distractor_misconceptions.py` | **Engine** | modified — the join is rewritten |
| `ml/scripts/promote_questions.py` | **Engine** | modified — two defects fixed at source |
| `ml/tests/test_backfill_distractor_misconceptions.py` | **Engine** | extended + **import fixed** (S5) |
| `ml/scripts/ingest_eedi.py` | **Engine** | **read-only reference** — it is the correct implementation |
| `ml/data/eedi_misconceptions.json` | **Engine** | read-only input |
| `data/eedi/train.csv` | **Engine** | read-only input |
| `app/src/data/eediQuestions.json` | **Product tree, Engine-generated** | rewritten by script — land as its own data commit |

**Fenced off — do not touch.** `make_concept_text`, `concept_embeddings.npz`,
`ml/data/bank_index.npz`, `ml/data/bank_index_meta.json`. Nothing here needs them.

---

## 1. Why this exists

The distractor→misconception join is implemented **three times across two files**:

1. `ingest_eedi.py` — inline loop at `:760–790` (builds the bank from scratch)
2. `promote_questions.py` — `build_numeric_to_slug()` (`:156`) + `enrich_distractor_taxonomy()` (`:197`)
3. `backfill_distractor_misconceptions.py` — imports #2

The harvest spec's anti-drift rule ("reuse the helpers, do not copy-paste — a
second copy will drift") was correct in principle but **inverted in practice**:
`promote_questions.py` *was already the second copy*, and it is the drifted one.
Mandating reuse locked the backfill onto the wrong implementation.

`ingest_eedi.py` is **authoritative**. It mints against the question's own
`concept_id` and reads column *i* from the same CSV row it builds `choices` from,
so no letter round-trip exists to get wrong.

### Defect 1 — concept scope collapses, last-wins

`promote_questions.py:161`, inside `build_numeric_to_slug`:

```python
result[str(int(nid))] = slug          # ← overwrites; question concept never enters
```

Misconception slugs are concept-scoped (`mis_{concept}__{name}`), so one Eedi
numeric id exists under several slugs. **205 of 1,437 numeric ids (14.3%)
collide**, e.g.:

```
2142 -> ['mis_algebraic_manipulation__does_not_know_factorise_quadratic',
         'mis_factoring_polynomials__does_not_know_factorise_quadratic']
```

Whichever iterates last wins. **Measured impact: 561 of the 2,208 slots the S2
run filled (25.4%) carry a misconception scoped to the wrong concept.** The
misconception *name* is right; the concept prefix is not.

This is not cosmetic. `misconception_ingredient_map.json` is keyed on the **full
slug**, so the S3 ingredient join would attribute ingredient evidence to a
concept the question does not belong to — silently, and in the direction that
looks plausible.

### Defect 2 — bails whenever choices were permuted

`promote_questions.py:232–234`, inside `enrich_distractor_taxonomy`:

```python
else:
    # Mapping is ambiguous without knowing the original order
    letter = None
```

When the bank's `correctIndex` does not match the letter position of train.csv's
`CorrectAnswer`, it declines to fill rather than resolving the permutation.
**Measured impact: 119 slots that `ingest_eedi.py` resolves are left empty.**

### Net

| | Slots |
|---|---|
| `HEAD` (before any harvest) | 1,508 / 4,524 |
| S2 run as it stands | 3,716 — **561 wrongly scoped** |
| Scratchpad re-ingest | 3,563 |
| Tagged by **both** paths | 3,444 |
| **Correct union, target of this build** | **~3,835** |

---

## 2. Do NOT re-ingest to fix this

`ingest_eedi.py` has the right join but **cannot be used to land the data**.
Measured against the live bank, a `--no-llm` re-ingest:

- **wipes `storyContext` on all 1,508 questions** (live bank has authored text —
  `"London, a lamplit study, 1843. Ada taps the punch cards…"`; re-ingest emits
  `None` for every row)
- **reverts 2 manually-cleaned `choices` arrays** (`eedi_147`, `eedi_839`) from
  `['><','<<','>>','<>']` back to raw `![A blue box containing…]()` markdown
- lands 153 fewer tags than the corrected backfill will

Everything else round-trips identically — same 1,508 ids, same `question`,
`level`, `format`, `hints`, question-level `misconception_id`.

**Correction to the harvest spec:** its S2 justified this prohibition by claiming
a re-ingest "would re-derive explanations and hints through Groq, churning text
that is already reviewed and cached." That is **false**. `data/eedi/.explain_cache.json`
does not exist, and the live explanations are template output
(`"The correct answer is X. A common mistake here: Y"`, 1,489 distinct across
1,508). There is no LLM text to protect. The real hazard is the downstream
enrichment above, which no document recorded. Fix the reasoning in the spec, not
just the conclusion — the next person will otherwise re-derive the wrong risk
model.

---

## 3. The fix

### S1R — correct the join at source (`promote_questions.py`)

**Defect 1.** Replace the numeric→slug map with a **(concept_id, numeric) → slug**
index. Build it from `eedi_misconceptions.json`, where each entry carries
`eedi_misconception_id` and `concept_ids`:

```python
def build_concept_numeric_to_slug(eedi_mis) -> dict[tuple[str, int], str]:
    out = {}
    for slug, info in eedi_mis.items():
        nid = info.get("eedi_misconception_id")
        if nid is None:
            continue
        for concept_id in info.get("concept_ids", []):
            out[(concept_id, int(nid))] = slug
    return out
```

Resolution order for a slot on a question with concept `C` and Eedi numeric `n`:

1. `(C, n)` present → use it.
2. absent → **mint** `mint_misconception_id(C, eedi_name)` exactly as
   `ingest_eedi.py:523` does, and add the new entry to `eedi_misconceptions.json`
   with its `concept_ids` including `C`. **Measured: 7 slots need this.**
3. no `eedi_name` resolvable for `n` → leave the slot empty. Never fall back to
   a slug from another concept.

Keep `build_numeric_to_slug` if other callers need it, but **no path that writes
a `misconception_id` onto a question may use it.**

**Defect 2.** Resolve the permutation instead of giving up. The bank's `choices`
were built from the same train.csv row, so the mapping is recoverable — derive
the choice index the way `ingest_eedi.py:760–790` does rather than round-tripping
through `CorrectAnswer` letters. Where a permutation genuinely cannot be
resolved, leave the slot empty and **count it in the summary** — do not guess.

### S2R — re-run the backfill

Regenerate `app/src/data/eediQuestions.json` **from `HEAD`**, not from the
current working-tree file (its 561 mis-scoped tags must not be inherited —
the corrected run must not treat them as "already tagged" and skip them).

```bash
git checkout app/src/data/eediQuestions.json     # discard the bad S2 output first
python ml/scripts/backfill_distractor_misconceptions.py --dry-run
python ml/scripts/backfill_distractor_misconceptions.py
```

Idempotency remains a hard requirement: a second run reports `0 filled`.

### S3R — fold in the S4 field derivation

The S4 fix to `ingest_eedi.py` is correct but only takes effect through a
re-ingest, which §2 rules out. Apply the same result surgically instead. For
**every** slot carrying a `misconception_id`:

- `student_thinking` ← `eedi_misconceptions.json[slug].eedi_name`
- `error_type` ← `"misconception"`

This is a pure derivation, no LLM. It closes the divergence where a slot reads
`error_type: "arithmetic"` / `"Alternative error: arithmetic"` while carrying a
precise misconception id — currently true of all 2,208 filled slots.

Apply it to the pre-existing 1,508 slots too: they carry heuristic
`error_type` values (`arithmetic` / `wrong_formula` / `sign_error` /
`unit_confusion`) and **none** currently read `misconception`.

### S4R — retire the duplicate

Once S1R lands, `promote_questions.py` and `backfill_distractor_misconceptions.py`
must share **one** join implementation. Either the backfill's corrected version
becomes the single definition both import, or `promote_questions`'s copy is
deleted where it duplicates. **Leaving two live is what caused this build.**

`ingest_eedi.py` keeps its inline loop — it is the from-scratch path and has no
bug — but add a comment at `:760` pointing at the shared implementation so the
next divergence is visible.

### S5 — fix the test import (unrelated, blocking, cheap)

`ml/tests/test_backfill_distractor_misconceptions.py:5` does
`from ml.scripts.backfill_distractor_misconceptions import …`. That resolves from
the repo root but **not** from `ml/`, and pytest aborts at *collection*, so
`cd ml && pytest` — the command CLAUDE.md documents — currently runs **zero**
tests rather than failing loudly. Match the sibling tests' import style or add a
`conftest.py` path insert. Verify **both** `cd ml && pytest` and repo-root
`pytest ml/tests` collect and pass.

---

## 4. Acceptance criteria

Record the S0 baseline before touching anything:

```bash
git checkout app/src/data/eediQuestions.json
python3 -c "
import json
qs=json.load(open('app/src/data/eediQuestions.json'))
slots=sum(len(q['choices'])-1 for q in qs)
tagged=sum(1 for q in qs for e in (q.get('distractor_taxonomy') or []) if e.get('misconception_id'))
print(f'{len(qs)} questions, {slots} slots, {tagged} tagged')"
# expect: 1508 questions, 4524 slots, 1508 tagged
```

Ship only when **all** of these hold:

1. **Tagged slots ≈ 3,835** — must exceed both 3,716 (bad S2) and 3,563 (re-ingest).
   A number below 3,716 means Defect 2 is unfixed; a number at exactly 3,716
   means Defect 1 is unfixed.
2. **Zero cross-concept tags.** For every slot, the question's `conceptId` appears
   in `eedi_misconceptions.json[slug].concept_ids`. Currently 561 violate this.
   **This is the headline check** — assert it in the test suite, not just in a
   one-off script.
3. **Every emitted `misconception_id` exists** in `eedi_misconceptions.json`
   (including the ~7 newly minted).
4. **Untouched, byte-identical to `HEAD`:** `question`, `choices`, `correctIndex`,
   `conceptId`, `level`, `format`, `hints`, `storyContext`, `explanation`,
   `examTag`, and the question-level `misconception_id`.
   `storyContext` in particular — §2 exists because of it.
5. **No taxonomy entry** is written for `choice_index == correctIndex`.
6. **Idempotent:** second run reports `0 filled`.
7. **Every tagged slot** has `error_type == "misconception"` and a
   `student_thinking` equal to its misconception's `eedi_name` (S3R).
8. `cd ml && pytest` **and** repo-root `pytest ml/tests` both collect and pass;
   `python scripts/end2end.py` stays 85/85.

Report filled / skipped / unresolved / **minted** / **unresolvable-permutation**
as separate counts. Silent totals are how the first version shipped wrong.

---

## 5. Reproduction commands for the measurements above

```bash
source ml/mindcraft/bin/activate

# numeric-id collisions (expect 205 / 1437)
python3 -c "
import json; from collections import defaultdict
mis=json.load(open('ml/data/eedi_misconceptions.json'))
byn=defaultdict(list)
for s,i in mis.items():
    n=i.get('eedi_misconception_id')
    if n is not None: byn[str(int(n))].append(s)
print(sum(1 for v in byn.values() if len(v)>1), '/', len(byn))"

# cross-concept tags introduced by a backfill run (expect 561 pre-fix, 0 post-fix)
python3 -c "
import json
qs=json.load(open('app/src/data/eediQuestions.json'))
mis=json.load(open('ml/data/eedi_misconceptions.json'))
bad=[(q['id'],d['misconception_id']) for q in qs for d in (q.get('distractor_taxonomy') or [])
     if d.get('misconception_id') and q['conceptId'] not in mis.get(d['misconception_id'],{}).get('concept_ids',[])]
print(len(bad))"

# re-ingest comparison (writes only to scratch)
python ml/scripts/ingest_eedi.py --no-llm \
  --out-questions /tmp/reingest_q.json \
  --out-misconceptions /tmp/reingest_m.json \
  --report /tmp/reingest_r.json
```

---

## 6. S3 of the harvest spec — decisions now settled

Recorded here so the harvest spec's open **DECISION** block can close.

- **Ingredient tags are emitted at question level only**: `ingredient_ids?: string[]`
  on `Question`. **No per-choice `ingredient_id`.** Rationale: the question
  contains the ingredients; the choices are how a student interacts with them.
  The per-choice ingredient stays derivable at runtime from
  `distractor_taxonomy[].misconception_id` + the map, so nothing is lost — the
  same fact simply is not stored twice.
- **Materialized at build**, not resolved at runtime. Stamp the map's
  `_meta.version` into the generated file so staleness is detectable.
- **Provenance rides along and is never pooled.** Of the resolvable slots,
  921 are `human`, 952 `llm`, 91 `embedding`; audit §B5 measured `llm` links
  agreeing with independent ontology ground truth at **0.545** versus **0.928**
  for `human`. Consumers must be able to weight or filter.

**S3 is blocked on this build**, not on anything else — the ingredient join
inherits every error in the misconception join beneath it, and 25.4% of the
current tags point at the wrong concept.

---

## 7. Out of scope

- Re-running the LLM pass that generated the 344 `llm`-provenance map links.
  Acknowledged as the highest-leverage quality item on the map; it is its own
  build and does not block S3 so long as provenance is filterable.
- Any change to `compute_mastery_score` or the mastery model.
- Question generation, the classifier, and the bank index.
