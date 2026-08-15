# AUDIT — classifier, ingredient enrichment, and the road to fully-annotated generation

**Lane: Engine.** Audit only. No production behavior changed. One new file:
`ml/scripts/audit_classifier_ingredient.py` (read-only audit tooling — writes
nothing into `ml/data/`, never touches `bank_index.npz` / `bank_index_meta.json`).
Ad-hoc probes that cost LLM calls live in the session scratchpad and are listed
in §5.

Every number below was produced during this audit unless explicitly marked
`[inferred]` or `[prior doc]`. Reproduction commands are inline.

---

## 1. Verdict

**Conditional yes — but the hypothesis is aimed at the wrong bottleneck first.**
Generation *can* emit items born with `required_ingredient_ids` and a
per-distractor misconception, because both annotations can be chosen
deterministically from Layer 1 *before* the LLM writes the item, which makes
annotation an input rather than an inference — and the one thing that would have
killed it (that a misconception-first item biases the evidence) is survivable if
the target ingredient is drawn from the student's actual gap rather than from
what is convenient to write.

**But three of the four gaps in the prompt's table do not need generation at all,
and one of them is already paid for.** 2,055 per-distractor misconception tags
are sitting unused in `data/eedi/train.csv` — the ingest loop `break`s after the
first wrong answer — and 2,010 of them already resolve to an ingredient through
the existing 655-entry map, which is 1.87x the ingredient evidence the bank
carries today, for zero model cost.

**The condition on the "yes" is the verifier, not the generator.** The "~30% bad
key rate" is not a measured key-error rate at all: all 45 drops carry the single
reason `solver_disagreed` — one LLM disagreeing with another — and the dropped
items' text was never persisted, so no failure taxonomy can be built from the
artifact and the standing "it's arithmetic" hypothesis has never had evidence
either way.

---

## 2. Findings

### A. Classifier — is 0.80 real, and is it enough?

Reproduce all of §A with:

```bash
cd ml && source mindcraft/bin/activate
python scripts/audit_classifier_ingredient.py --section A
```

#### A1. The held-out number, and whether it leaks

**0.80 is real only under the exact configuration it was claimed on, and that is
not the configuration that ships.**

| configuration | held-out top-1 |
|---|---:|
| **shipped** — k=10, unweighted majority, raw concept ids, all bank concepts | **0.7593** |
| shipped + alias canonicalization | 0.7672 |
| k=5, cosine-weighted, canonicalized, all bank concepts | 0.7831 |
| k=5, cosine-weighted, canonicalized, **20 concepts with ≥20 bank rows** | **0.7978** |

`CONCEPT_PLACEMENT_BUILD.md:42` reports `0.802` for "weighted k-NN, k=5" on
"1,714 questions, 23 concepts" and states the scope caveat explicitly. That
number reproduces (0.798 on today's 1,942-row bank, 20 dense concepts). What has
happened since is that the claim got repeated without its scope, while the
shipped classifier (`ProblemClassifier.classify`, k=10, `_axis_vote` unweighted
majority) was never the thing that scored 0.80. `ml/data/problem_classifier_eval.json`
— the committed artifact — already says **0.7672**, not 0.80.

Full k sweep (top-1, held-out, seed 7, same stratified 20% split the shipped eval
uses):

| k | unweighted | weighted |
|---:|---:|---:|
| 3 | 0.775 | 0.775 |
| 5 | 0.778 | 0.775 |
| 7 | 0.772 | 0.772 |
| **10 (shipped)** | **0.759** | 0.757 |
| 15 | 0.759 | 0.759 |

k=10 is the worst setting swept. Dropping to k=5 is worth ~2 points and costs
nothing.

**Leakage: the eval is clean.** This matters because the shipped
`scripts/eval_problem_classifier.py` does *not* read `bank_index.npz` — it
re-embeds `load_bank_rows()` and splits it itself, so index drift cannot leak
into it by construction. The leak that *could* exist is duplicate text inside the
bank. Measured:

- 17 exact-normalized duplicate text groups, covering 37 of 1,942 rows.
- **6 of 378** held-out items have an exact-normalized twin in train.
- Excluding those 6: 0.7593 → **0.7554**.
- Excluding every held-out item whose nearest train neighbor has cosine ≥ 0.90
  (n=302): **0.7252**.

So the honest shipped number is ~0.755–0.76, and it degrades gracefully rather
than collapsing — this is not the `::seed` situation that invalidated the
archetype numbers.

**The shipped index is not stale.** `ml/data/bank_index_meta.json` (1,943 rows,
built Jul 8) vs today's `load_bank_rows()` (1,942 rows): 1 row present in the
index and gone from the bank (`act_math_t02_q07`), 0 rows missing from the index,
**0 conceptId drift on the 1,942 shared ids**. The HF-shipped artifact is
current; nothing here argues for rebuilding it.

#### A2. Where it fails

**Failure is not concentrated in the low-coverage concepts. It is concentrated in
ACT items and at level 3 — i.e. exactly the target distribution.**

| slice | top-1 | n |
|---|---:|---:|
| Eedi / GCSE | **0.789** | 304 |
| `questionBank.ts` (static ACT bank) | 0.667 | 42 |
| `actMasterQuestionBank.generated.json` | 0.613 | 31 |
| **`examTag == 'ACT'`** | **0.545** | 44 |
| `examTag == 'ACT'`, alias-canonicalized | 0.614 | 44 |

| level | top-1 | n | | format | top-1 | n |
|---:|---:|---:|---|---|---:|---:|
| 1 | 0.796 | 191 | | symbolic_expression | 0.782 | 248 |
| 2 | 0.794 | 136 | | number_line | 0.800 | 10 |
| **3** | **0.529** | 51 | | diagram | 0.747 | 75 |
| | | | | coordinate_graph | 0.684 | 19 |
| | | | | word_problem | 0.615 | 26 |

The headline 0.76 is carried by Eedi, which is 78% of the held-out set. On the
44 ACT-tagged held-out items the classifier is at 0.545 — barely better than a
coin flip over a 34-way vocabulary, but far from usable. This is the
within-distribution caveat `CONCEPT_PLACEMENT_BUILD.md:50` flagged, now measured.

Top confusions are all **dense-neighbor** confusions, not sparse-concept ones:
`ratios_proportions → fractions_decimals` (4), `fractions_decimals →
number_properties` (4), `number_properties → fractions_decimals` (3),
`algebraic_manipulation → linear_equations` (3). The 5 concepts the prompt names
as zero-coverage contribute 3 held-out items between them.

**A concept-ID hygiene bug found in passing.** Five concept ids in the live bank
are L1 **aliases**, not canonical ids — `word_problems` (12 questions),
`percent_ratio` (12), `absolute_value` (11), `function_transformations` (9),
`coordinate_geometry` (2) — and `build_bank_index.py` stores them raw, so
`ProblemClassifier` can emit a concept id the runtime ontology does not contain.
Canonicalizing at index-build time is worth +0.8pp overall and **+6.8pp on the
ACT slice**, and removes a class of silent unresolved-id failures. This is the
same fail-fast discipline `CLASSIFICATION_FIX_BUILD.md` §C-F already mandates for
Layer 2, not yet applied to the bank index.

**Confidence gating works and is unused.** The vote fraction already separates
right from wrong (mean 0.706 correct vs 0.479 wrong):

| gate | kept | precision |
|---|---:|---:|
| conf ≥ 0.5 | 78.6% | 0.838 |
| conf ≥ 0.6 | 63.5% | 0.879 |
| **conf ≥ 0.7** | **47.6%** | **0.933** |
| conf ≥ 0.8 | 37.3% | 0.943 |

This is the lever that makes classifier-assisted bulk tagging viable at all
(§D11): at conf ≥ 0.7 you get half the corpus at 93% precision.

#### A3. Does embedding cosine separate ingredients?

**Half the standing claim confirmed, half refuted.**

Ground truth: the 1,077 Eedi bank questions whose key misconception is in the
655-entry map, giving each a concept and an ingredient label. Task: given the
concept as an oracle, pick the right ingredient among that concept's 4–7.

| measurement | value |
|---|---:|
| within-concept ingredient top-1 (oracle concept), n=1,077 | **0.440** |
| random baseline (1/\|ingredients in concept\|) | 0.215 |
| lift over chance | **2.05x** |
| ingredient top1-vs-top2 cosine margin | mean 0.058, **median 0.046** |
| **concept** top-1 in the *same* embedding space | 0.569 |
| **concept** top1-vs-top2 margin | mean 0.071, **median 0.059** |
| ingredient-text pairwise cosine, within-concept | 0.524 (n=313 pairs) |
| ingredient-text pairwise cosine, across-concept | 0.255 (n=15,618 pairs) |
| misconception-text → mapped ingredient, top-1 agreement | 0.600 (n=655) |

**Confirmed:** the ~0.05–0.07 within-concept margin. Median 0.046 here, and
`INGREDIENT_ENRICHMENT_BUILD.md:83` reports median 0.07 same-genre / 0.05
cross-genre. Embedding cannot auto-assign ingredients. That conclusion stands and
should not be re-litigated.

**Refuted:** "embedding cosine separates concepts (~0.80, margins ~0.5)." In the
same space, on the same items, the concept margin is median **0.059** — 0.013
above the ingredient margin, not an order of magnitude. The 0.80 comes from
*k-NN over thousands of same-genre question stems*, which is a different
mechanism from cosine-to-a-prototype; when you actually run concept
prototype-matching it scores 0.569, not 0.80. The prompt's framing ("big concept
margin, tiny ingredient margin") is not what the geometry says. What the geometry
says is: **prototype cosine is weak at both levels; k-NN over dense same-genre
exemplars is what works, and there are no ingredient-level exemplars to do k-NN
over.** The blocker is exemplars, not geometry.

**Also refuted, more usefully: "no embedding-only method will ever tag
ingredients" is too strong.** 0.440 at 2.05x chance is real signal — not enough
for mastery evidence, but enough to rank a 4-way candidate list for an LLM or
human to confirm, which is exactly what the existing pipeline does. And the lift
is not circular: split by label provenance, where `human` labels are independent
of any embedding method —

| label provenance | top-1 | random | lift |
|---|---:|---:|---:|
| human (n=483) | 0.433 | 0.231 | 1.88x |
| llm (n=544) | 0.441 | 0.201 | 2.19x |
| embedding (n=50) | 0.500 | 0.211 | 2.37x |

The human-only slice holds at 1.88x, so the signal is not an artifact of scoring
embedding-assigned labels with embeddings.

---

### B. Enrichment — what did we actually buy?

```bash
cd ml && source mindcraft/bin/activate
python scripts/audit_classifier_ingredient.py --section B
```

The prompt's inventory of the map is **exactly right**: 655 entries, one entry
each, provenance **344 llm / 282 human / 29 embedding**, reaching **97 distinct
ingredients**. Ontology priors are also confirmed complete: `population_failure_prior.overall`
on 42/42 concepts, `failure_prior` on 179/179 ingredients, 179 nested ingredients
(registry still lags at 167, as CLAUDE.md warns).

#### B4. Reachability — the map is not inert; the *inverse* is the problem

| measurement | value |
|---|---:|
| mapped misconceptions also reachable from a live bank question | **655 / 655 = 100%** |
| inert map entries (mapped, no question can trigger them) | **0** |
| distinct misconceptions reachable from the live bank | 963 |
| **bank misconceptions with no ingredient mapping** | **308** |
| bank questions gaining an ingredient tag by pure join | **1,077 / 1,942 = 55.5%** |
| — of which human-labelled / llm / embedding | 483 / 544 / 50 |
| ingredients with ≥1 labeled example | 97 |
| ingredients with ≥5 / ≥10 / ≥20 labeled examples | 57 / 42 / 18 |

Nothing was wasted — every mapped misconception is live. The gap runs the other
way: 308 misconceptions students can actually hit have no ingredient, and only 18
ingredients have ≥20 examples, which is the density any per-ingredient parameter
estimate needs.

**The 1,077 join is free and unclaimed.** It requires no model and no new data:
`eediQuestions.json` already carries `misconception_id` on every question, and
`misconception_ingredient_map.json` already resolves 655 of them. The
"0 of 1,713 questions carry ingredient tags" gap is a gap in what has been
*written down*, not in what is *known*.

#### B5. Quality by provenance — the LLM half is the weak half

Independent structural check: does the map's assignment agree with the *ontology's
own* `diagnostic_tags` / `canonical_misconception_family`? That ground truth was
authored separately from the enrichment pipeline. "Same-concept" restricts to
misconceptions whose tag owner is inside the concept C-1 confines the pipeline to
(the map's own `_meta` makes the same distinction).

| provenance | strict | same-concept eligible |
|---|---:|---:|
| **human** (282 entries) | 64/77 = 0.831 | **64/69 = 0.928** |
| **llm** (344 entries) | 12/29 = 0.414 | **12/22 = 0.545** |
| **embedding** (29 entries) | 8/12 = 0.667 | 8/11 = 0.727 |
| pooled | 84/118 = 0.712 | 84/102 = 0.824 |

**The pooled 0.824 hides exactly what the prompt suspected.** The provenance that
produced the *majority* of the map (llm, 344/655) agrees with independent ground
truth at 0.545 — roughly half the human rate. Caveat stated plainly: only 22 llm
entries are eligible for this check, so this is a strong signal on a small
sample, not a precise rate.

My own reading of 12 randomly sampled entries per provenance (seed 11; sample
frame at `scratchpad/b5_sample.json`), judging each assignment against the
ingredient's `failure_mode` and its concept siblings:

| provenance | precise | defensible | wrong |
|---|---:|---:|---:|
| human | 6 | 4 | 2 |
| llm | 4 | 3 | **5** |
| embedding | 2 | 4 | **6** |

Representative llm failures: *"Assumes they add all values in a worded problem"*
→ `number_properties__factor_definition`; *"Adds or subtracts from numerator first
when solving an equation with a fraction"* → `linear_equations__slope_intercept_form`;
*"When multiplying just writes the numbers next to each other"* →
`number_properties__factor_definition`. Three of twelve landed on the same
dumping-ground ingredient.

Two structural pathologies visible in the samples:

1. **C-1 forces a wrong answer instead of "none."** Several embedding assignments
   are fraction-arithmetic misconceptions scoped by Eedi to `algebraic_manipulation`,
   a concept whose ingredient set contains no fraction-arithmetic ingredient — so
   the never-cross-concepts rule guarantees a wrong assignment rather than an
   abstention. The map's own `_meta` already measures this: 15 of 61 eligible
   anchor families (25%) are "structurally unreachable" for the same reason.
2. **Embedding provenance is degenerate.** Its 29 entries land on only **13
   distinct ingredients**, with the top 5 absorbing 62% — versus 65 ingredients
   for llm's 344 and 80 for human's 282.

Overall assignment concentration: the top 10 ingredients absorb 230/655 = 35%,
median 4 assignments per reached ingredient.

#### B6. The 82 unreached ingredients — the standing claim is **refuted**

The claim is that they cluster in matrices / complex numbers / logarithmic
functions / integrals, i.e. advanced ACT-only material, not foundational holes.
Measured breakdown by L1 concept level:

| level | unreached ingredients |
|---|---:|
| advanced | **38** |
| core | **30** |
| cross_cutting | 9 |
| **foundational** | **5** |

Only 38 of 82 are advanced. The single most-unreached concept is **`basic_equations`
— 5 of 5 ingredients unreached, `level: foundational`, 0 bank questions.** That
is the foundation of the ontology and it is entirely invisible to ingredient
mastery. `representation_translation` (cross-cutting, 5/5, 12 bank questions) and
`act_strategy` (cross-cutting, 4/4, 0 questions) are likewise not advanced
material.

And 38 of 82 sit in concepts that *do* have bank questions — `functions_basics`
(109 questions, 1 ingredient unreached), `sequences_series` (74, 2),
`descriptive_statistics` (52, 1), `systems_of_linear_equations` (28, 1),
`circles_geometry` (17, 2), `trigonometry_basics` (15, 3),
`representation_translation` (12, 5), `polynomials` (12, 5),
`rational_expressions` (9, 3), `right_triangle_geometry` (7, 3),
`radical_expressions` (7, 1). Those are reachable today; they are unreached
because the *misconception* half of the join is missing, not the question half.

**Argument on whether to close them.** Split the 82:

- **44 sit in concepts with zero bank questions** (all six calculus concepts,
  `vectors`, `matrices`, `conic_sections`, `probability_distributions`,
  `inferential_statistics`, `basic_equations`, `act_strategy`). For the calculus
  block — not on the ACT, not high-school-general — **do not close them.** Mark
  them `status: deferred` in L1 so the 179 denominator stops implying a gap the
  product does not have. `basic_equations` and `act_strategy` are the exception:
  foundational and ACT-central respectively, and both are genuine holes.
- **38 sit in concepts that already have questions.** These are cheap and worth
  closing, and §D11 shows the mechanism.

The ceiling is measurable. Mapping *all* 882 currently-unmapped Eedi
misconceptions could reach at most **17** more ingredients (same-concept ceiling)
→ **114/179**. The other **65 are permanently out of Eedi's reach** and need new
items — which is the strongest argument in this audit *for* generation.

#### B7. The `misconception_counts` asymmetry — not intentional, and the comment is wrong

`serve.py:911` increments `misconception_counts[mis_id]` per observation; the
ingredient fire is deduped per `(misconception_id, ingredient_id)` per request via
the `fired` set (`serve.py:905`). Three findings:

1. **The dedupe is exactly a per-misconception dedupe.** Measured: all 655 map
   keys have exactly one entry (`Counter({1: 655})`). So the `(mis, ing)` tuple
   never distinguishes anything the `mis_id` alone would not. N repeats of the
   same misconception in one request produce **one** negative ingredient update.
2. **Repeat weighting is therefore a function of HTTP batching, not pedagogy.**
   `fired` is request-scoped, so the same three wrong answers submitted as one
   `/record-outcomes` call yield 1 ingredient update, and submitted as three calls
   yield 3. `[inferred from code — I read the handler but did not execute the
   endpoint against Firestore. Confirming it needs a live call: POST the same
   three misconception-tagged observations once as a batch and once as three
   requests, and diff `ingredient_states/{uid}`.]`
3. **The inline comment is stale.** It says the counter is "for B3 severity
   ranking in `/recommend`". It is not. `grep -rn misconception_counts ml/ --include=*.py`
   returns exactly five sites: the write in `serve.py`, two in
   `firestore_adapter.py` (persistence), the field declaration in
   `models/ingredient.py`, and reads in **`ml/scripts/promote_questions.py`** — an
   offline script. `_recommend_misconception_gaps` (`serve.py:438`) computes
   severity from `load_recent_attempt_observations`, never touching the counter.

So: the asymmetry was not designed, one half of it feeds only an offline script,
and the other half makes evidence magnitude depend on client batching. Both
should be made explicit rather than left implicit — see §D.

---

### C. Generation — why 30%, and is the annotation dream real?

#### C8. Diagnosing the 45 drops

**First finding: they are not diagnosable from the artifact, and that is itself
the bug.** `ml/data/generated_questions.verify_report.json` stores only
`{id, expectedIndex, solverIndex, reason}`. The dropped items' question text,
choices, and explanation were never persisted, and none of the 45 ids appear in
`generated_questions.json`. There is no failure taxonomy to build from what was
kept.

**Second finding: there is only one reason.** `Counter({'solver_disagreed': 45})`
— 45 of 45, and zero `solver_failed`. `verify.py` emits exactly two reasons and
neither distinguishes an arithmetic error from a prompt error from a solver
error. "solver_disagreed" is a *disagreement between two calls to the same model
family*, not evidence about the key.

**Third finding: the pass rate falls monotonically with the answer's position —
suggestive of a judge artefact, but NOT statistically established.** Over all 149
generated items (104 kept + 45 dropped):

| key index | generated | kept | pass rate |
|---:|---:|---:|---:|
| 0 | 59 | 46 | 0.780 |
| 1 | 48 | 33 | 0.688 |
| 2 | 35 | 21 | 0.600 |
| 3 | 7 | 4 | 0.571 |

Collapsed to indices 0–1 vs 2–3: **0.738 (n=107) vs 0.595 (n=42), Fisher exact
two-sided p = 0.11**. **I am not claiming a position bias — n is too small.** I
am claiming that a genuine arithmetic-error rate has no reason to trend this way
at all, that the trend is in the direction a positional judge artefact would
produce, and that nobody has ever checked. (The generator is separately and
unambiguously position-biased in what it *writes*: 40% of keys at index 0, 4.7%
at index 3.)

**The confirmatory probe did not complete.** I re-solved the 104 kept items under
permuted choice order against the same provider (Groq
`llama-3.3-70b-versatile`, temperature 0) to test whether order-flipping changes
the verdict. Groq's free tier throttled it below the point of producing a usable
sample and it was abandoned; the script is
`scratchpad/c8b_position.py` and it takes ~210 calls on an unthrottled key. See
§3.

**Verdict on Q8: not answerable as asked, and that is the finding.** The question
"is 30% arithmetic, prompt, model, or verifier?" presumes the 30% measures key
correctness. It does not — it measures inter-call agreement between two
invocations of one model family, on items that no longer exist. The one thing
that *is* measured here (§C10, n=48) shows this class of judge over-rejects:
it rejects 96% of genuinely wrong annotations but also rejects 50% of genuinely
right ones. Hardening the generation prompt before rebuilding the verifier would
be optimizing against a signal of unknown sign.

#### C9. Can generation emit `required_ingredient_ids` and per-distractor misconceptions?

**Where the generator is today.** Emitted schema is exactly
`{id, conceptId, level, question, choices, correctIndex, explanation, hints, examTag, format}`
(`generation/generate.py:generate_for`). No ingredient, no misconception, no
per-distractor anything.

**What is already half-built.** `generation/generate.py:_essence_block` *already*
injects "Common student misconceptions to target as distractors" — up to three
free-text strings pulled from Layer 3 `intelligence.student_misconception_risks`.
So the generator is already told what to target. Two things are missing: those
strings are not canonical `mis_*` ids, and the **output schema has no slot** to
say which distractor embodies which. The information is thrown away at the
prompt boundary.

**Is annotation-as-input sound?** Yes, and the reason is that both annotations can
be chosen *deterministically from Layer 1 before the LLM is called*, which keeps
the generative/deterministic split CLAUDE.md mandates:

- `required_ingredient_ids` — pick the target ingredient from the concept's nested
  ingredients in L1. Deterministic selection, LLM writes prose. This is the same
  shape as the ingredient runtime's card selection.
- per-distractor misconceptions — the candidate set is the target ingredient's
  `diagnostic_tags` plus its `canonical_misconception_family`, all canonical
  `mis_*` ids that already exist. Assign one per distractor slot as an input.
  Ingredients carry a median of 3 diagnostic tags, which is exactly the number of
  distractor slots. `[inferred — I read the L1 records and confirmed the fields
  exist and are populated on 179/179 ingredients, but I did not run a generation
  batch under this contract.]`

**Does it bias the evidence?** Two distinct risks, one real and one not:

- *Not a real risk:* an item written around a known misconception is exactly what
  a diagnostic item is. Eedi's entire 1,508-question corpus is constructed this
  way and it is the most useful data in the repo.
- *A real risk:* if target ingredients are chosen by what is convenient to write,
  the corpus over-represents easy-to-instantiate ingredients and the resulting
  ingredient mastery estimates are biased by item supply rather than student
  ability. The existing map already shows this failure mode — the top 10
  ingredients absorb 35% of 655 assignments. **Mitigation is a coverage
  constraint, not a modeling fix:** drive the generation target list from the 38
  reachable unreached ingredients and the 82-ingredient census, and cap items per
  ingredient. `generation/coverage.py` already exists as the place for it.

**The hard constraint on the dream.** Generation is *least* grounded exactly where
coverage is worst. `build_essence()` produces essence for **30 of 42** L1
concepts (mean 4.43 examples each). **12 concepts have no essence at all**:
`rational_expressions`, `radical_expressions`, `factoring_polynomials`,
`geometric_transformations`, `vectors`, `inferential_statistics`,
`probability_distributions`, and all five calculus concepts. Two of those
(`rational_expressions`, `radical_expressions`) are on the unreached-ingredient
list *and* have bank questions. For them, "generate fully-annotated items" means
generating from a concept name and an ontology description with no real exemplars
— which is precisely the ungrounded free-invention the essence layer was built to
prevent.

Also confirmed while here: **C2 holds.** `mindcraft_graph.config.FORMAT_IDS` and
`app/src/lib/questionBank.ts:FormatId` are the same six ids (`word_problem`,
`diagram`, `number_line`, `symbolic_expression`, `coordinate_graph`, `table`).
CLAUDE.md's "5 format slots" is off by one; `table` is the sixth.

#### C10. What a verifier for a fully-annotated item would need

Four independent checks, in increasing difficulty:

1. **Schema/vocabulary validity** — every `ingredient_id` and `misconception_id`
   exists in L1, the misconceptions belong to the target ingredient's
   `diagnostic_tags`, exactly one correct choice. **Fully automatable, zero model
   calls, and this check does not exist today.**
2. **Key correctness** — currently one blind LLM solve. §C8 shows that is not a
   sound measurement. Needs: choice-order permutation (already shows an effect),
   self-consistency across ≥3 samples, and abstention when the samples disagree —
   an item the judges cannot agree on should be *quarantined*, not silently
   dropped, with its text retained.
3. **Distractor reachability** — does each distractor correspond to a
   *mechanically derivable* wrong answer (apply the misconception's failure_mode
   to the given numbers)? For arithmetic-shaped misconceptions this is checkable
   in code without a model, and is a stronger guarantee than any LLM judgement.
   `[inferred — no such checker exists; I did not prototype one.]`
4. **Does the distractor embody the claimed misconception** — the question the
   prompt asks. This one I measured.

Ground truth: Eedi's own per-distractor `MisconceptionId` from `train.csv`
(1,345 distinct names) — real human annotation, independent of anything in this
repo. Protocol: "here is a question, the correct answer, the answer a student
chose, and a claimed misconception — does the chosen answer embody it?"
Half the trials present the true human-authored misconception, half present a
different misconception drawn from the same concept. Groq
`llama-3.3-70b-versatile`, temperature 0, seed 23, **n = 48** (cut down from a
planned 120 by Groq's 30 RPM free-tier ceiling — see §3).

| measurement | value | chance |
|---|---:|---:|
| accuracy | **0.729** | 0.500 |
| recall on **true** claims (accepts a correct annotation) | **12/24 = 0.500** | 0.500 |
| specificity on **false** claims (rejects a wrong annotation) | **23/24 = 0.958** | 0.500 |
| precision of an `embodies=true` verdict | **12/13 = 0.923** | — |

**This is automatable as a filter, not as an acceptance test — and it fails the
same way the key verifier does.** When it says "yes, this distractor embodies
that misconception," it is right 92% of the time, so it is a genuinely useful
*high-precision* signal. But it accepts only **half** of the human-authored true
annotations — at chance. Used as a gate it would discard ~50% of correctly
annotated items, which is exactly the §C8 over-rejection pathology in a second
place. Same lesson: route disagreement to **quarantine + human review**, never to
silent deletion.

Caveat stated plainly: n=48 puts the ±1σ band on each of those rates at roughly
±10 points, so treat 0.500 vs 0.958 as a real and large asymmetry, not as precise
values.

**Answer to Q10:** checks 1 and 3 are fully automatable and neither exists; check
2 needs rebuilding, not tuning; check 4 is automatable only as a
high-precision reject filter with human review on the accept side. A fully
annotated corpus therefore cannot be verified end-to-end by machine today — but
the human cost is bounded to adjudicating disagreements, not reviewing every item.

---

### D. The road forward

#### D11. Cheapest path to ingredient tags on existing bank questions

Ranked by cost per tag. The answer is **none of the four options as posed** — the
cheapest path is a join and a bug fix, both already paid for.

| # | move | yield | cost |
|---|---|---:|---|
| 0 | **Emit the join that already resolves.** `eediQuestions.json` has `misconception_id` on 1,508/1,508; the map resolves 655 of them. | **1,077 questions tagged (55.5% of the bank), 97 ingredients with ≥1 example** | zero — one script |
| 1 | **Fix the `break` in `ingest_eedi.py`.** The loop at line ~763 stops at the first wrong answer with a misconception and discards the rest. | **+2,055 distractor tags** (33.3% → 78.8% of the 4,524 wrong-answer slots); **2,010 of them already resolve to an ingredient**, 1.87x today's evidence; 769 questions get all 3 distractors tagged, 1,286 get ≥2 | zero — data is on disk at `data/eedi/train.csv` |
| 2 | **Map the remaining 882 Eedi misconceptions**, human-first per §B5. | 308 currently-unmappable bank misconceptions closed; **+17 ingredients at most → 114/179 hard ceiling** | ~882 human/LLM decisions; llm-only would land near 0.545 |
| 3 | **Classifier-assisted tagging at conf ≥ 0.7** for untagged non-Eedi questions. | ~48% of remaining items at 0.933 concept precision — but this yields *concepts*, and §A3 shows the ingredient step still needs confirm | cheap, bounded value |
| 4 | **Generate new annotated items** for the 65 ingredients Eedi can never reach. | the only path to those 65 | full §C stack |

**Direct answer to Q11: don't infer, and don't (only) tag new items — harvest.**
Classifier inference is the wrong tool: it resolves concepts (§A2), the bank
questions already *have* correct concepts, and no embedding method tags
ingredients (§A3). LLM tagging is the wrong tool for the 2,055 slots because the
human answer is literally in the CSV. Generation is the right tool only for the
65 ingredients with no possible Eedi source.

**One important note on move #1:** `ml/scripts/promote_questions.py` *already
implements this backfill* ("Fills in missing `misconception_id` entries in
`distractor_taxonomy` using per-choice data from `train.csv`"). It is not shipped
because it is gated behind (a) a Firestore engagement ranking that requires
student traffic that does not exist yet, and (b) a `--top-n 30` cap, and (c) a
human `world_feedback` authoring step before `--merge` will write anything —
`ml/data/promotion_queue.json` currently holds 46 questions. **The mechanical
misconception-id backfill must be decoupled from the human `world_feedback`
step.** They are in the same script and only one of them is blocked.

#### D12. Sequence

Lane tags per CLAUDE.md. Everything below is Engine except where noted; the
`app/src/data/*.json` writes are Engine-generated data landing in a
Product-owned tree and need coordination (the same seam
`ml/scripts/ingest_eedi.py` already crosses).

**Tier 1 — unbuilt, no blockers, highest yield per hour**

| # | item | state | lane |
|---|---|---|---|
| 1 | Decouple the distractor `misconception_id` backfill in `promote_questions.py` from engagement ranking and `world_feedback`; run it over all 1,508 | **unbuilt** (code exists, gated) | Engine → Product data |
| 2 | Emit `ingredient_ids` on bank questions from the existing map (1,077 questions, 2,010 distractor slots after #1) | **unbuilt** | Engine → Product data |
| 3 | Persist dropped item text + a real reason taxonomy in `verify_report.json`; quarantine instead of discard | **unbuilt** | Engine |
| 4 | Canonicalize concept ids in `build_bank_index.py` (fail-fast on unresolved, per §C-F) and drop k from 10 → 5 | **unbuilt** | Engine |

Item 4 requires rebuilding `bank_index.npz`/`bank_index_meta.json`, which cannot
be done inside the HF Space — rebuild locally and ship via `ml/scripts/deploy_hf.sh`.
It does **not** touch `make_concept_text` or `concept_embeddings.npz`, so the
`CLASSIFICATION_FIX_BUILD.md` §C-C fence is not crossed and no PCA re-bake is
implied.

**Tier 2 — algorithm-blocked (the verifier)**

| # | item | state | lane |
|---|---|---|---|
| 5 | Rebuild the verifier: permutation + self-consistency + abstention; re-measure the true key-error rate on a *retained* corpus | **algorithm-blocked** — until this exists, "30%" means nothing | Engine |
| 6 | Add deterministic pre-model checks: id validity, misconception ∈ ingredient's `diagnostic_tags`, one correct choice | **unbuilt** | Engine |
| 7 | Only then revisit the generation prompt | blocked on 5 | Engine |

**Tier 3 — data-blocked**

| # | item | state | lane |
|---|---|---|---|
| 8 | Map the 882 unmapped Eedi misconceptions, **human-first** (llm agrees with independent ground truth at 0.545) | **data-blocked** on human review capacity | Engine |
| 9 | Essence for the 12 concepts with none — needs real exemplars (ACT official guide, past papers), not more prompting | **data-blocked** | Engine |
| 10 | Mark the calculus/advanced ingredients `status: deferred` in L1 so 179 stops being the denominator | **unbuilt**, 1 hour | Engine |

**Tier 4 — the actual hypothesis**

| # | item | state | lane |
|---|---|---|---|
| 11 | Annotated-generation contract: ingredient + per-distractor misconception as deterministic **inputs**, coverage-driven target list from the 82-ingredient census, capped items per ingredient | **unbuilt**, blocked on 5+6+9 | Engine |
| 12 | Make `/record-outcomes` repeat-weighting explicit (batch-independent), and fix the stale `misconception_counts` comment | **unbuilt** | Engine |

**The sequencing argument in one line:** items 1–2 produce more ingredient
evidence this week than the entire generation stack has produced to date, and
item 5 must land before any number about generation quality is worth acting on.

---

## 3. What I could not determine

1. **The true key-error rate of the generator.** The dropped items' text was
   discarded, so the only diagnosable population is the *kept* items — a set
   selected by the very verifier under suspicion. **To fix:** re-run
   `ml/generation/run.py` with drop-retention, then adjudicate a random 40 by
   hand or by symbolic evaluation.
2. **Whether the verifier is position-biased.** The pass-rate trend across key
   index (0.738 vs 0.595, p = 0.11) is suggestive and no more. The direct probe —
   re-solve all 104 kept items with the choice list reversed and compare —
   was written (`scratchpad/c8b_position.py`) and abandoned: Groq's free tier
   caps at 30 RPM with a TPM ceiling that throttled the run below a usable rate
   after ~200 successful calls were already spent on the §C10 probe and an
   earlier three-condition attempt. **To fix:** ~210 calls on an unthrottled key,
   or run it overnight against the free tier. An order-flip that changes the
   verdict on >10% of items settles it.
3. **Whether the `misconception_counts` batching asymmetry actually changes
   mastery in production.** I read the handler; I did not execute it. **To fix:**
   POST the same three misconception-tagged observations to `/record-outcomes`
   once as one batch and once as three requests against a scratch student id, and
   diff `ingredient_states/{uid}`.
4. **The archetype `0.42` and concept-baseline `0.64` numbers.** I did not
   reproduce them — they need the archetype eval harness with
   `--exclude-evaluation-seeds` and a `classification_index.npz` rebuild, and
   nothing in my recommendation depends on them. `CONCEPT_PLACEMENT_BUILD.md:22`
   is the source; I neither confirm nor dispute it. Note the leakage diagnosis
   there (100% of the eval corpus had byte-identical `::seed` copies) is a
   *different* leak from the one I checked in §A1, and my clean result does not
   speak to it.
5. **Whether per-distractor misconception verification generalizes beyond Eedi.**
   My §C10 measurement uses GCSE-style items with human-authored misconception
   labels. ACT-style items and generated items may behave differently, and I have
   no ACT-side ground truth to test on. **To fix:** hand-annotate ~50 ACT items
   with per-distractor misconceptions and re-run the same probe.
6. **Whether ingredient-level mastery would actually improve any downstream
   metric.** This audit measures the *availability* of ingredient tags, never
   their *value*. Even at 2,010 tagged distractor slots, no measurement here shows
   ingredient-level evidence predicts anything better than concept-level. **To
   fix:** extend the `ml/validation/` harness with an ingredient-aware predictor
   and compare Brier against the concept-mastery and constant baselines already
   reported in `ITEM_PREDICTOR_BUILD.md` (0.3221 / 0.2495).

---

## 4. Corrections to "What exists"

| # | claim in the prompt | measured | severity |
|---|---|---|---|
| 1 | "**0 of 1,713** live bank questions carry ingredient tags" | The bank is **1,942** rows, not 1,713 (eedi 1,508 / questionBank.ts 227 / actMaster 205 / generated 2). "0 carry ingredient tags" is **true as written** but misleading: **1,077 (55.5%) can be tagged today by a join with no new work**. | material |
| 2 | "**5 concepts** have zero questions (combinatorics, matrices, complex_numbers, rational_expressions, logarithmic_functions)" | **Wrong on 4 of 5.** `combinatorics` is not an L1 concept id at all — it is an **alias of `basic_probability`**, which has 46 questions. `complex_numbers` has **4**, `rational_expressions` **9**, `logarithmic_functions` **2**. Only `matrices` is genuinely zero. The real count is **13 L1 concepts with zero bank questions**: `basic_equations`, `limits_continuity`, `derivatives`, `vectors`, `matrices`, `conic_sections`, `probability_distributions`, `applications_of_derivatives`, `integrals`, `applications_of_integrals`, `inferential_statistics`, `representation_translation`, `act_strategy`. | **material** — this list is repeated verbatim in CLAUDE.md and is wrong there too |
| 3 | "bank k-NN, **0.80** held-out top-1 concept" | The **shipped** configuration scores **0.7593**. 0.80 reproduces only at k=5 + cosine weighting + alias canonicalization + restriction to the 20 concepts with ≥20 bank rows (**0.7978**). The committed `problem_classifier_eval.json` already says 0.7672. On **ACT-tagged items specifically: 0.545**. | **material** |
| 4 | "embedding cosine separates concepts (~0.80, **margins ~0.5**) but not ingredients (margins 0.05–0.07)" | Ingredient margin **confirmed** (median 0.046). Concept "margin ~0.5" is **not reproducible** — in the same space the concept margin is median **0.059**, and prototype-cosine concept accuracy is 0.569, not 0.80. The 0.80 comes from k-NN over dense same-genre stems, a different mechanism. | **material** — it changes the diagnosis from "geometry can't see ingredients" to "there are no ingredient exemplars to k-NN over" |
| 5 | "no embedding-only method will ever tag ingredients" | Too strong. Within-concept ingredient top-1 is **0.440 vs 0.215 chance (2.05x)**, and **1.88x on human-only labels**, so it is not circular. Not usable alone; usable as a ranker. | moderate |
| 6 | "82 of 179 ingredients have no labeled example… they cluster in matrices / complex numbers / logarithmic functions / integrals — advanced ACT-only material, not foundational holes" | **82/179 confirmed. The clustering claim is refuted.** 38 advanced, **30 core, 9 cross-cutting, 5 foundational**. The most-unreached concept is `basic_equations` (5/5, `level: foundational`). 38 of 82 are in concepts that already have bank questions. | **material** |
| 7 | "generation… **~30% bad key rate**" | Not a measured key-error rate. All 45 drops are the single reason `solver_disagreed` (0 `solver_failed`), the dropped item text was never persisted, and the drop rate is monotone in key position (0.780 at index 0 → 0.571 at index 3). See §C8. | **material** |
| 8 | "`serve.py` … dedupes the ingredient fire per `(misconception, ingredient)` per request" | Accurate, but the tuple is redundant: **all 655 map keys have exactly one ingredient**, so it is a per-misconception dedupe. The inline comment claiming the counter feeds "B3 severity ranking in `/recommend`" is **false** — the only reader is the offline `promote_questions.py`. | moderate |
| 9 | "`ml/data/bank_index.npz` + `bank_index_meta.json` … do not break that" | Respected — nothing was rebuilt. Also checked for staleness: **1 obsolete row, 0 missing rows, 0 conceptId drift**. The shipped artifact is current. | informational |
| 10 | map: "655 entries, 344 llm / 282 human / 29 embedding, 97 ingredients"; "ontology priors complete: 42/42 concepts, 179/179 ingredients" | **All confirmed exactly.** | — |
| — | (not in the prompt) | **`ingest_eedi.py` discards 2,055 per-distractor misconception ids that are present in `data/eedi/train.csv`.** The "2 of 3 distractors carry no misconception" gap is self-inflicted at ingestion, not a data gap: the source has 3,563/4,524 wrong-answer slots tagged (78.8%); the bank carries 1,508 (33.3%). | **new, material** |
| — | (not in the prompt) | **5 bank concept ids are L1 aliases stored raw in the index** (`word_problems`, `percent_ratio`, `absolute_value`, `function_transformations`, `coordinate_geometry`; 46 questions), so the classifier can emit ids the runtime ontology does not contain. Canonicalizing is worth +6.8pp on the ACT slice. | new, moderate |

---

## 5. Scripts and files

**Committed (new, audit tooling only):**

- `ml/scripts/audit_classifier_ingredient.py` — rerunnable, read-only. Reproduces
  §A (leak check, k/weighting sweep, error breakdowns, confidence gating,
  ingredient separability) and §B (live-bank join, provenance split, unreached
  census, Eedi distractor-recovery headroom). Writes nothing into `ml/data/`;
  never opens `bank_index.npz` for writing.
  `python scripts/audit_classifier_ingredient.py [--section A|B|all] [--out report.json]`

**Session scratchpad (not committed — they spend Groq calls and are not
deterministic):**
`/tmp/claude-1000/-home-basickellogs-Projects-mindcraft/6ba5d7c6-9fa6-48cb-b120-e68286f11d39/scratchpad/`

- **`c10_small.py`** — **the §C10 probe that produced the n=48 result.** Binary
  distractor↔misconception verification against Eedi `train.csv` ground truth,
  checkpointing every trial. Run:
  `LLM_RETRIES=3 python c10_small.py 48`. Raise the argument for a bigger sample.
- `c8b_position.py` — the §C8 order-permutation probe. **Written, launched,
  abandoned unfinished** (Groq free tier: 30 RPM plus a TPM ceiling). Needs ~210
  calls; produces no result until it completes. Listed here so it can be re-run
  rather than rewritten.
- `c8_verifier.py`, `c10_distractor_verify.py` — the original larger
  three-condition and 120-trial versions; both were rate-limited out and
  superseded by the two above. Kept for the prompt wording only.
- `a_classifier.py`, `a1_sweep.py`, `a3_ingredient_sep.py`, `b_enrichment.py`,
  `b5_provenance.py` — earlier one-shot versions of §A and §B, now folded into
  the committed script
- `b5_sample.json` — the 36-entry provenance sample frame read by hand in §B5

**Modified:** nothing. **Deleted:** nothing. `ml/data/` is untouched, and neither
`bank_index.npz` nor `bank_index_meta.json` was rebuilt or rewritten at any point.

> Note for whoever picks this up: the working tree also carried unrelated
> in-progress changes from a concurrent Engine task (`ml/validation/predictor.py`,
> `ml/validation/fit_predictor.py`, `ml/tests/test_item_predictor.py`,
> `ml/tests/test_attempt_observation_dedup.py`, and edits to
> `ml/ENGINE_MECHANISM.md`, `ml/mindcraft_graph/firestore_adapter.py`,
> `ml/validation/replay.py`, `ml/validation/run_harness.py`). **None of those are
> mine.** This audit added exactly two files: this document and
> `ml/scripts/audit_classifier_ingredient.py`.
