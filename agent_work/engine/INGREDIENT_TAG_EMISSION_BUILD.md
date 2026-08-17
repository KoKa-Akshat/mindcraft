# BUILD — Emit ingredient tags onto bank questions

**Status:** ready to implement. **Unblocked** — depends on
[`EEDI_JOIN_UNIFY_BUILD.md`](EEDI_JOIN_UNIFY_BUILD.md), which landed 2026-08-16
(3,835/4,524 slots tagged, 0 cross-concept). Replaces **S3** of
[`EEDI_DISTRACTOR_HARVEST_BUILD.md`](EEDI_DISTRACTOR_HARVEST_BUILD.md).

**Written 2026-08-16.** Every number below is measured against the post-unify
bank. Reproduction commands in §6.

---

## Lanes and file ownership

| Path | Lane | This build |
|---|---|---|
| `ml/scripts/emit_ingredient_tags.py` | **Engine** | **new file** |
| `ml/data/misconception_ingredient_map.json` | **Engine** | read-only input (+ one `_meta` field, §3) |
| `app/src/data/eediQuestions.json` | **Product tree, Engine-generated** | rewritten by script — own data commit |
| `app/src/lib/questionBank.ts` | **Product, shared seam (C5)** | type change + 3 consumer sites — high blast radius |

---

## 1. Two corrections to the harvest spec — read these first

**The harvest spec said "The `Question` type currently has no ingredient field
at all (verified)." That is false.** `questionBank.ts:47` already declares a
question-level `ingredient_id?: string`, it is parsed at `:137`, and **three
live consumer sites read it**:

```
questionBank.ts:2333  matchesMisconceptionTarget       — q.ingredient_id !== target.ingredientId
questionBank.ts:2369  getQuestionsForMisconceptionWeakness — ingredientTagged tier
questionBank.ts:2375  getQuestionsForMisconceptionWeakness — ingredientOnly tier
```

**And zero questions in any bank populate it** — 0/1508 eedi, 0/205 actMaster,
0/2 generated. So `getQuestionsForMisconceptionWeakness`, the Tier-3 weakness
draw, has **two of its three priority tiers permanently dead**: it silently
falls through to the plain concept pool on every call. This build is what turns
that path on. Do not add a parallel field and leave the existing one dangling.

**Second correction:** the harvest spec said to stamp the map's `_meta.version`.
**There is no `version` key** — `_meta` carries `generated_at`, `model`,
`llm_temperature`, `margin_threshold`, `similarity_threshold`,
`proposal_deterministic`, `validation`. See §3.

---

## 2. Measured shape of the data

Joining `distractor_taxonomy[].misconception_id` (and the question-level
`misconception_id`) through the 655-entry map:

| Distinct ingredients on a question | Questions |
|---|---|
| 0 | 338 |
| 1 | 983 |
| 2 | 177 |
| 3 | 10 |

**1,170 of 1,508 questions (77.6%) resolve to ≥1 ingredient. 187 (12.4%)
resolve to more than one** — so a plural field is required, but the singular
case dominates and must stay cheap to match.

Provenance across resolvable distractor slots: **921 `human`, 952 `llm`,
91 `embedding`**. Audit §B5 measured `llm` links agreeing with independent
ontology ground truth at **0.545** versus **0.928** for `human`. Roughly half
this evidence is near coin-flip quality. **It must remain filterable end to end;
never pool the three.**

---

## 3. The emission

Write `ml/scripts/emit_ingredient_tags.py`. Same discipline as
`backfill_distractor_misconceptions.py`: mechanical join, idempotent, invariants
asserted, `--dry-run` and `--out`.

For each question, collect the union of ingredients reachable from **(a)** every
`distractor_taxonomy[].misconception_id` and **(b)** the question-level
`misconception_id`, via `misconception_ingredient_map.json`'s `map`.

**Materialize at build**, per the settled decision — the runtime stays free of a
second data file. Stamp provenance of the *generation* into the output so
staleness is detectable. Since `_meta.version` does not exist, **add one** to
`misconception_ingredient_map.json` (`_meta.version: 1`) and stamp both it and
`_meta.generated_at` into the emitted artifact's header. Bump the version
whenever the map is regenerated.

### Field shape — **DECISION**

The settled decision was question-level `ingredient_ids?: string[]`. But §2 shows
provenance must ride along per ingredient, which a bare `string[]` cannot carry.
**Recommended instead:**

```ts
/** Ingredients this question can evidence. Union over its misconceptions. */
ingredients?: { id: string; provenance: 'human' | 'llm' | 'embedding'; confidence: number }[]
```

and **migrate** the existing `ingredient_id?: string` to it, updating the three
consumer sites from `q.ingredient_id === target.ingredientId` to
`q.ingredients?.some(i => i.id === target.ingredientId)`.

Rationale: one field, not two competing ones; provenance and confidence travel
with the id, so a consumer can require `provenance === 'human'` for a
high-stakes draw without a second lookup. Cost: a 3-site change in a C5 seam
file.

**If a bare `string[]` is preferred anyway**, then provenance needs a parallel
`ingredient_provenance?: Record<string, string>` — workable, but it lets the two
drift, which is the failure mode that produced the unify build. **Confirm the
shape with the architect before writing the type.**

### Do not

- Do not re-run `ingest_eedi.py`. It wipes `storyContext` on all 1,508 questions
  and reverts two manually-cleaned `choices` arrays. See the unify build §2.
- Do not write a per-choice `ingredient_id`. It stays derivable at runtime from
  `distractor_taxonomy[].misconception_id` + the map; storing it twice invites
  exactly the drift this repo has already paid for once.
- Do not modify `misconception_ingredient_map.json`'s `map` — only add
  `_meta.version`.

---

## 4. Acceptance criteria

1. **1,170 questions carry ≥1 ingredient** (77.6%); 187 carry >1; none carries a
   duplicate id.
2. **Every emitted ingredient id exists** in the Layer-1 ontology
   (`01_mindcraft_concept_ontology_v2_6_with_combinations.json`, joined on the
   **nested** ingredient ids — *not* `canonical_registries.ingredient_ids`,
   which lags at 167 vs 179).
3. **Every emitted ingredient carries a provenance** in
   `{human, llm, embedding}` and a confidence. Zero untagged.
4. **Untouched, byte-identical to the pre-run file:** `question`, `choices`,
   `correctIndex`, `conceptId`, `level`, `format`, `hints`, `storyContext`,
   `explanation`, `examTag`, `misconception_id`, and every
   `distractor_taxonomy` entry.
5. **Idempotent** — second run reports 0 changed.
6. **The dead tier is alive**: a test that calls
   `getQuestionsForMisconceptionWeakness` with a `target.ingredientId` known to
   exist in the bank and asserts the ingredient-matched questions are returned
   **ahead of** the plain concept pool. Without this, the build can "succeed"
   while the selection path stays dead — which is the current bug.
7. `cd ml && pytest` **and** repo-root `pytest ml/tests` pass; `end2end.py`
   85/85; `cd app && npx tsc --noEmit` clean.

---

## 5. Follow-on, explicitly not in this build

**Re-run the LLM provenance pass.** 952 of the resolvable slots are `llm`-sourced
at 0.545 agreement. That is the single highest-leverage data-quality item on the
map, and this build is what makes its impact measurable — but it is its own
build. This one only has to make provenance *visible*, not good.

---

## 6. Reproduction commands

```bash
source ml/mindcraft/bin/activate

# ingredients-per-question distribution (expect {0:338, 1:983, 2:177, 3:10})
python3 -c "
import json; from collections import Counter
qs=json.load(open('app/src/data/eediQuestions.json'))
m=json.load(open('ml/data/misconception_ingredient_map.json'))['map']
d=Counter()
for q in qs:
    ings={e['ingredient_id'] for x in [*(q.get('distractor_taxonomy') or []), {'misconception_id':q.get('misconception_id')}]
          for e in m.get(x.get('misconception_id') or '', [])}
    d[len(ings)]+=1
print(dict(sorted(d.items())))"

# consumer sites that read the field
grep -n 'ingredient_id' app/src/lib/questionBank.ts
```
