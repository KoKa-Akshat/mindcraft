# BUILD — Remap misconception → ingredient (zero-shot retrieve / rerank / abstain)

**Status:** ready to implement. **Written 2026-08-16.**
**Replaces Stage 3** of
[`ONTOLOGY_INGREDIENT_PRIMARY_BUILD.md`](ONTOLOGY_INGREDIENT_PRIMARY_BUILD.md).
**Evidence base:** [`deep-research-report.md`](deep-research-report.md).

**Lane: Engine** — `ml/scripts/`, `ml/data/`. No Product-tree file, no API
change, no C5 seam.

**No fine-tuning, no GPU, no training data required.** That is deliberate: it
sidesteps the licence entanglement in §7 and tests the architecture before
anyone spends on the optimisation.

---

## 1. What we are replacing and why

Current pipeline
([`enrich_ingredient_misconception_map.py:171`](../../ml/scripts/enrich_ingredient_misconception_map.py#L171)):

```
misconception's single concept_id
  → that concept's ingredients only        median 5 candidates; 86.6% got ≤6
  → embedding similarity, forced choice    no abstention
```

Result: 344 of 655 links are `llm`-provenance agreeing with independent ground
truth at **0.545** (vs **0.928** `human`).

The Eedi 2024 Kaggle competition ran essentially this task — distractor →
closed bank of fine-grained misconceptions. **No winning system used a
topic-local candidate pool.** First, second, and third place all used two-stage
**global retrieval → reranking**. The competition's own framing included
candidate labels unseen in training.

So the target architecture is:

```
global candidate generation over ALL 179 ingredients
  → rerank with rich context
  → calibrated acceptance OR abstention
```

**Do not restrict candidates by concept.** Concept may be used as a *feature or
tiebreak* inside the reranker; it must never gate the candidate set. That single
change is the hypothesis this build tests.

---

## 2. Evidence unit — do not embed misconception text against ingredient text

Per the research report, the highest-value correction after removing the cage:

> The unit of evidence should become
> `misconception → all tagged (question, correct answer, distractor, question-KCs) contexts`
> rather than `misconception text → ingredient text`.

You have **3,835 tagged distractor slots across 1,508 questions**. A misconception
appearing in five independently authored questions gives five chances to ask
which ingredient is consistently implicated. Use them.

**Build the query for each misconception as:**

- the misconception description (`eedi_misconceptions.json[slug].eedi_name`)
- up to **N question contexts** (recommend N=5, most frequent first), each being
  the question stem, the correct answer, and **the specific distractor** carrying
  this misconception
- the concept(s) its questions were tagged to — as context, **not** as a filter

**`--no-context` flag is REQUIRED**, running on misconception text alone. Two
reasons: it measures how much the context enrichment actually buys, and it is
the fallback if §7 resolves against us. The architecture must survive without
Eedi question text.

---

## 3. Candidate side — what to retrieve over

All **179** ingredients. Per-ingredient text for embedding, in priority order:

| field | coverage | note |
|---|---|---|
| `failure_mode` | **179/179** | the existing code already calls this "the best signal" — keep that judgement |
| `label` + `description` | 179/179 | |
| `observable_evidence.negative` | 167/179 | error patterns; directly comparable to misconception text |

**Do not** use `diagnostic_tags` or `canonical_misconception_family` as retrieval
input — they are the evaluation benchmark (§5). Leaking them into retrieval
invalidates the whole measurement.

---

## 4. Pipeline

Write `ml/scripts/remap_misconception_ingredients.py`. Rerunnable, deterministic,
`--dry-run`, `--out`, `--no-context`, `--limit`.

**S1 — Retrieve.** Embed all 179 ingredient texts and each misconception query
with `all-MiniLM-L6-v2` (already a dependency; no new model). Take **top-K
globally**.

**DECISION — K.** Recommend **25**, matching the Eedi silver-medal reranker's
candidate set. Report recall@K against the §5 benchmark; if recall@25 is already
below ~0.9 the retrieval stage is the bottleneck and reranking cannot fix it.

**S2 — Rerank.** One LLM call per misconception, listwise over the K candidates.
Provide the query from §2 and each candidate's `label` + `failure_mode`. Require
the model to return a ranked shortlist **with an explicit `none` option**, plus a
confidence per accepted link and a one-sentence justification.

Temperature 0. Cache by `sha256(query + candidate_ids)` so reruns are free and
the pass is reproducible.

**S3 — Accept or abstain.** Accept only above a confidence threshold.

**DECISION — threshold.** Must be set on a **dev split of the benchmark and
written down before scoring the test split.** Choosing it after seeing test
results is how the 0.545 map got shipped with a 0.824 pooled headline.

**S4 — Emit.** Same shape as today's `misconception_ingredient_map.json`, plus
per link: `provenance: "rerank_v2"`, `confidence`, `justification`,
`retrieval_rank`, and `contexts_used`. Bump `_meta.version` to 2 and record model
ids, K, threshold, and whether `--no-context` was set.

**Never overwrite the 282 `human` links.** They are the benchmark and the
trusted core. Emit alongside; let a consumer prefer `human`.

---

## 5. Evaluation — the part that makes this worth doing

**Benchmark: the ontology's own `diagnostic_tags`.** Measured 2026-08-16:

```
232 (ingredient, misconception) pairs across 95 ingredients
  all 232 resolve to a real Eedi misconception
  144 already appear in the current map
   88 are net-new labelled pairs                 ← never seen by the old pipeline
```

These were authored **separately from the enrichment pipeline**, which is what
makes them a valid independent yardstick. Split dev/test; tune nothing on test.

**Also report against the 282 `human`-provenance links**, held out.

**Never train on, tune to, or evaluate against the 344 `llm` links.** They are
the artefact being replaced.

### Metrics — precision-at-coverage, not accuracy

Per the report, forced-choice accuracy is the wrong metric for a system that may
abstain. Report:

1. **Precision among accepted links**, and **coverage at that precision** — as a
   curve across thresholds, not a single number.
2. **Abstention rate**, and the list of abstaining misconceptions. Abstentions are
   **ontology coverage evidence, not failures** — a misconception with no matching
   ingredient may mean the ingredient is missing. Emit that list as its own
   artefact; it is a direct input to the ontology restructure.
3. **recall@K** from retrieval alone (S1), separating retrieval failure from
   rerank failure.
4. **With vs without `--no-context`** — how much the question contexts buy.
5. **Comparison to the incumbent**: current map's precision on the same test
   split, split by provenance. The `human` 0.928 is the ceiling to aim at; the
   `llm` 0.545 is the bar to clear.

### Ship gate

Ship only if **precision among accepted links materially exceeds 0.545 at
non-trivial coverage.** A system that abstains on 95% of inputs and is perfect on
the rest has not solved the problem — report both numbers together and judge them
together.

---

## 6. Explicitly out of scope

- **Fine-tuning, hard-negative mining, LoRA, `labelbank`'s training pipeline.**
  Its own README warns hard negatives mined from a zero-shot backbone *collapsed*
  MAP to 0.430, below random negatives, without a bootstrap round. And the volume
  is not there: labelbank's worked example is ~26 labelled pairs per label; you
  have **232 pairs over 179 ingredients ≈ 1.3**. Revisit when annotation volume
  exists.
- **The other two relations.** The report's central conclusion is that
  `item→ingredient` (Q-matrix), `misconception↔ingredient` (this build), and
  `ingredient→concept` (curriculum hierarchy) are three different relations.
  This build touches only the second. Do not let it drift.
- Changing `exposure_weight` 0.15 in `serve.py`. That discount exists because the
  map is untrustworthy; **re-measure before touching it**, and only after this
  build's numbers are in.
- Anchor cleaning. Superseded — `diagnostic_tags` gives 232 pairs versus 95, and
  hand-adjudication was the wrong tool for a non-specialist operator. If the
  benchmark looks noisy in specific rows, flag them in the report rather than
  editing the ontology mid-evaluation.

---

## 7. Licence gate — read before shipping the output

The Eedi corpus underlying the misconception descriptions and question contexts
is **plausibly CC BY-NC (possibly BY-NC-ND)** and MindCraft is commercial. As of
this writing that is **unconfirmed** — Kaggle's competition terms are behind
JS-rendered authenticated pages, Eedi's research page states no licence, and
nothing in this repo recorded the terms at download time.

Consequences for this build:

- **Building and evaluating is fine** — it is dev-time analysis.
- **Shipping the derived map is gated** on that question, since the misconception
  descriptions are Eedi's.
- The `--no-context` mode exists partly so the architecture is demonstrably
  independent of Eedi question text.
- **Do not fine-tune anything on Eedi data** until resolved — an MIT code licence
  does not sanitise weights derived from NC data.

Resolution requires a human: read the Kaggle competition's Rules → "Data Access
and Use" while logged in, and/or email Eedi for written permission. Record the
answer in a new `data/SOURCES.md` alongside origin and download date — its
absence is why this is an open question at all.

---

## 8. Acceptance criteria

1. Candidate set is **all 179** ingredients; no concept filter anywhere in the
   retrieval path. Assert it in a test.
2. `none` is a reachable, reported outcome; abstention rate is non-zero.
3. `diagnostic_tags` and `canonical_misconception_family` appear nowhere in the
   retrieval or rerank input. Assert it in a test — this is the leak that would
   silently invalidate every number.
4. Threshold committed **before** the test split is scored, in its own commit.
5. All five metric families in §5 reported, both `--context` and `--no-context`.
6. Deterministic — same inputs, same output. Temperature 0, cache keyed by content.
7. The 282 `human` links are unmodified in the output.
8. `cd ml && pytest` and repo-root `pytest ml/tests` pass; `end2end.py` 85/85.
