# BUILD — Ingredient-first question generation (authored Q-matrix, symbolic oracle)

**Status:** ready to implement. **Written 2026-08-17.**
**Evidence base:** [`deep-research-report.md`](deep-research-report.md) +
`NEXT_SESSION.md` §2 (the reframe) and §7 items 6–8.
**Supersedes** the LLM-authors-the-math approach in `ml/generation/generate.py`
and the LLM-solver verify pass in `ml/generation/verify.py`.

**Lane: Engine.** Owned paths:
```
ml/generation/**                    rewrite: rules/, templates/, oracle.py, skin.py
ml/data/misconception_rules/**       NEW — the rule library (the real deliverable)
ml/data/generated/**                 NEW — items, drops, provenance sidecars
ml/tests/**                          new tests
```
**Not in this build:** `app/**`. The final sync into the client bank is the
existing `app/scripts/syncGeneratedQuestions.mjs` (B4) and is a **separate,
later, Product-lane step** — do not touch the client bank here. No API change,
no `serve.py` change.

---

## 0. Why this exists

The misconception→ingredient mapping is not hard, it is **underdetermined**. We
have been doing inverse inference: taking someone else's items with someone
else's tags and trying to recover the latent structure that generated them. At
2.19 tagged distractor slots per catalog misconception, with three misconceptions
on one item inheriting an identical ingredient vector, and 148 responses against
179 KCs, that inference has no purchase.

**If we generate the item, the mapping is specified rather than inferred.** Start
from `ingredients = {A, B, C}`, execute a faulty procedure to produce the
distractor, and the tag is **true by construction**. The Q-matrix row is an
*input*, not an estimate. The ambiguity is not solved — it stops being created.

Two things fall out for free: generated items have **no upstream licence owner**
(`NEXT_SESSION.md` §1), and items with known planted parameters are exactly the
substrate the power analysis needs (§7 item 12).

The residual risk is **circularity** — that we recover only the structure we
planted. §9 gives that two guards with teeth. Read §9 before starting; it
constrains what S1 is allowed to assume.

---

## 1. The inversion

This is the whole architectural move, and it extends the rule CLAUDE.md already
states — *"deterministic engine owns structural decisions, LLM owns language,
LLM is bookends"* — down into the arithmetic, which the current pipeline leaves
to the model.

```
NOW  (ml/generation/generate.py:114)
  concept + essence  →  LLM writes stem, 4 choices, correctIndex, explanation
                     →  LLM re-solves it blind; disagreement ⇒ drop
  the model owns the math AND the key. Nothing can check either.

NEW
  ingredients {A,B,C} + template + seed
        │
        ├─ sympy solves the problem              →  KEY        (deterministic)
        ├─ misconception rule r_i executes       →  DISTRACTOR_i (deterministic,
        │  the faulty procedure on the problem       tag true by construction)
        ├─ oracle checks 6 invariants (§5)       →  keep / drop-with-full-text
        └─ LLM writes ONLY prose skin (§7)       →  stem wording, story, hints
           then render_roundtrip re-proves no number moved
```

The LLM never sees or emits a number that matters. `correctIndex` is computed,
never predicted.

---

## 2. Pilot scope — `basic_equations` only

Do not generalise before this concept works end to end.

`basic_equations` is the right pilot on four independent counts: `level:
foundational`, `act_relevance.tested: true` (frequency 0.14), **zero bank
questions today**, and **all 5 of its ingredients are unreached** by the existing
misconception map. It is also fully symbolically tractable.

Its five ingredients, with the `failure_mode` text already in Layer 1 — note how
close these already are to executable procedures:

| ingredient_id | failure_mode (abridged) | signature |
|---|---|---|
| `basic_equations__inverse_operations` | solves `3x = 12` as `x = 12 − 3 = 9` | **substitution** |
| `basic_equations__isolate_variable` | stops at `2x = 8`, answers `8` | **omission** |
| `basic_equations__do_same_to_both_sides` | applies the operation to one side only | **omission** |
| `basic_equations__equals_sign_balance` | chains through `=`: `5+3=8+2=10` | **sequencing** |
| `basic_equations__solution_verification` | skips substitution-checking entirely | **none — see below** |

**`solution_verification` yields no distractor rule, and that is a finding, not a
gap.** It is a meta-skill: skipping it produces no characteristic wrong *value*,
it only fails to catch one. **The rule library is therefore not 1:1 with
ingredients** — record this explicitly in the library README, because the
temptation to invent a rule for every ingredient is exactly how fabricated
structure enters. Target 4 rule families for the pilot, not 5.

Also note two of the five already carry a `canonical_misconception_family`
pointing at `mis_linear_equations__*` ids. Those ids are **ontology-owned, not
Eedi-derived**, so authored rules can cross-walk to them without inheriting any
licence entanglement. Populate `misconception_id` from the family id where one
exists; mint `mis_rule_*` only where none does.

---

## 3. S1 — the misconception rule library

**The real deliverable of this build.** A rule is executable code, not prose.

`ml/data/misconception_rules/` for declarative metadata +
`ml/generation/rules/` for the implementations. Suggested shape:

```python
@dataclass(frozen=True)
class MisconceptionRule:
    rule_id: str                      # mis_rule_{ingredient_slug}__{short_error}
    ingredient_ids: list[str]         # KC(s) whose CORRECT procedure this corrupts
    failure_signature: Literal[
        "omission", "substitution", "sequencing", "overgeneralized_rule"
    ]
    student_thinking: str             # first-person, what the student believed
    misconception_id: str | None       # ontology family id if one exists, else minted
    apply: Callable[[Problem], sympy.Expr | None]   # executes the FAULTY procedure
```

Three non-negotiables:

1. **`apply` takes the problem, not the answer.** It re-executes a corrupted
   solution path over the problem's symbolic structure. A rule that computes
   `key + 1` is not a misconception rule, it is a decoy, and it will teach the
   diagnosis layer nothing. Reviewers should reject any `apply` whose body
   references the key.
2. **`apply` may return `None`** — meaning *this rule does not fire on this
   problem instance*. Forced firing is the same error as forced choice in the
   remap spec: it manufactures a tag where the rule has no purchase. An item with
   fewer than 3 firing rules is dropped (§6), not padded.
3. **`failure_signature` is emitted per choice.** This is the field the research
   report recommends and the thing that resolves the §2 limit — three
   misconceptions on one item are indistinguishable by ingredient vector, but
   distinguishable by signature.

---

## 4. S2 — problem templates

```python
@dataclass(frozen=True)
class ProblemTemplate:
    template_id: str
    ingredient_ids: list[str]        # THE AUTHORED Q-MATRIX ROW
    level: Literal[1, 2, 3]
    format: FormatId                  # from mindcraft_graph.config.FORMAT_IDS
    params: dict[str, ParamSpec]      # sampling domain + constraints
    build: Callable[[dict], Problem]  # params → sympy relation + solve target
```

**Sampling must be seeded.** CLAUDE.md: *"Deterministic engine: no randomness,
fully auditable. Keep it that way."* `(template_id, seed) → params → problem →
item` must be exactly reproducible, and the seed must be recorded in the
provenance sidecar (§8). A generation run that cannot be replayed cannot be
debugged.

`ingredient_ids` here is the authored Q-matrix row and is the single most
important field in the build. Author it deliberately: it is the ground truth
every downstream model will be fit against, and **§9's Guard A constrains what it
is allowed to contain.**

Templates must vary their Q-vector across the set. Per the AFM/PFA precondition
already recorded in `PREDICTOR_INGREDIENT_WIREUP_BUILD.md`: items with identical
Q-vectors and identical learner history get identical predictions, so a template
set where every item is `{A,B,C}` produces a dataset that cannot exercise the
predictor no matter how many rows it has. **Emit a Q-vector distinctness report
at the end of every run** (§11 criterion 7).

---

## 5. S3 — the SymPy oracle

Replaces `verify.py`'s LLM solver entirely. Six invariants; all must pass.

| # | invariant | catches |
|---|---|---|
| 1 | `key_satisfies` — key substituted into the relation satisfies it | bad key |
| 2 | `key_unique` — **no distractor also satisfies the relation** | two right answers |
| 3 | `distractor_matches_rule` — each distractor equals its rule's output | mis-tagged choice |
| 4 | `pairwise_distinct` — all four choices distinct **as values**, not strings | `0.5` vs `1/2` collision |
| 5 | `render_roundtrip` — rendered string parses back to the same `Expr` | rendering corruption |
| 6 | `params_nondegenerate` — no div-by-zero, no trivial `0 = 0`, domain respected | vacuous items |

Invariant 2 is the one the current pipeline structurally cannot perform, and
is the likeliest real defect in any multiple-choice bank. Invariant 5 catches the
failure mode where the math is correct and the LaTeX is not.

Deterministic checks only. No LLM anywhere in the oracle.

---

## 6. S4 — drop retention (do not skip this)

`verify.py:21`'s `VerificationDrop` records four scalars — `id`,
`expectedIndex`, `solverIndex`, `reason` — and **not the item text**. That is
precisely why the existing 45 drops yield no failure taxonomy and why the
"~30% bad key rate" is not a measured number (see the standing retraction in
CLAUDE.md; all 45 drops carry the single reason `solver_disagreed`, zero
`solver_failed`).

Every drop must persist, to `ml/data/generated/{concept_id}/drops.jsonl`:

```
template_id, seed, params, full rendered stem, all choices,
key, rule_id per choice, EVERY failing invariant (not just the first),
generator_version
```

**Record every failing invariant, not the first.** Short-circuiting on failure
destroys the co-occurrence information that tells you whether one template is
broken or one rule is.

A run must print a drop breakdown **by invariant and by rule_id**. That table is
the first honest generation-quality measurement this project will have — and note
that it is a *new* measurement, not an improvement on 30%. Do not benchmark
against that number in either direction.

---

## 7. S5 — the LLM prose skin (bookends only)

The LLM receives the **already-solved, already-verified** item and writes only:
stem wording, `storyContext` / `storyIntro` (story-first, per CLAUDE.md — the
math is frozen, the narrative wraps it), `explanation`, `hints`, and a polished
`student_thinking` per distractor.

Hard constraints:
- The LLM **never** emits a numeric choice value and never sees `correctIndex` as
  something it may alter. Choices are substituted in mechanically after skinning.
- **Re-run invariant 5 (`render_roundtrip`) on the skinned stem.** This is a
  cheap, strong guard that proves the model did not quietly change a coefficient
  while rewording. Failure ⇒ drop with full text, same as §6.
- Existing prose rules carry over from `generate.py:37`: strict JSON, warm
  direct voice, **never an em dash** in any string field.

---

## 8. S6 — emission

Two artefacts per run.

**(a) The item**, in exact C5 `questionBank.Question` shape, with
`distractor_taxonomy` fully populated for all three distractors —
`choice_index`, `error_type`, `student_thinking`, `misconception_id`. Note this
build is the first source able to populate that field outside the Eedi rows
(actMaster 205, openstaxMCQ 221, openstax 37, actQuestionsBank 9 and generated 2
all carry **zero** taxonomy coverage today).

**(b) A provenance sidecar**, not shipped to the client, in
`ml/data/generated/{concept_id}/provenance.jsonl`: `template_id`, `seed`,
`params`, `ingredient_ids` (the Q-vector), `rule_id` per choice,
`failure_signature` per choice, invariants passed, `generator_version`.

Log in **AFM/PFA-ready form from day one** (§7 item 11) — because we author the
item, the Q-vector is known exactly rather than estimated, which is the whole
point. The response-side fields (`user_id`, response order, correctness,
selected distractor, prior opportunities/successes/failures per KC) are emitted
by the practice loop, not here; this build supplies the item-side half and must
not invent the other half.

---

## 9. Anti-circularity — two guards, and one honest limit

The stated worry is right: **recovering the planted structure from generated data
proves the fitter works, it does not prove the ingredient set carves reality.**
Structure-recovery on generated items is the power analysis (§7 item 12), and it
is tautological as evidence about the ontology. Two independent guards:

**Guard A — external alignment, and it gates scaling.** The 179 ingredients must
be aligned against **Learning Commons Math Learning Components (CC BY 4.0,
commercially usable with attribution)** so the KC set is not self-defined. This
is `NEXT_SESSION.md` §7 item 9 / the Stage 2 rewrite, a separate build.

Sequencing, explicitly: the **pilot's 4 rules may be authored now** against the
5 existing `basic_equations` ingredients — that is 4 rules, cheap to redo.
**Scaling past the pilot must wait on Guard A**, because authoring a rule library
across 179 ingredients bakes in whatever the current ingredient set gets wrong,
at the point where it becomes expensive to unwind. Author the pilot, then stop
and check.

**Guard B — transfer test on items we did not generate.** A standing criterion,
not a gate on this build. The non-Eedi, human-authored rows are the transfer set:

```
openstaxMCQ.json      221     actMasterQuestionBank.generated.json  205
openstaxQuestions.json 37     actQuestionsBank.json                   9
storyCells.json        12     ────────────────────────────────────────
                              ~484 rows, human-authored, non-generated
```

The criterion: **a model fit on generated items must beat the constant baseline
on the transfer set, not merely on held-out generated items.** An in-distribution
win alone means the structure is an artifact of the generator.

**The honest limit:** Guard B cannot run yet. There are 148 responses total, from
two founders, on items that mostly are not these. So Guard B is specced as a
logging requirement and a standing gate on *any* future claim that the
ingredient layer is validated — not as something this build can satisfy. Do not
let it be quietly marked done.

**Side finding worth acting on separately:** OpenStax content is normally CC BY
4.0 — i.e. commercially usable — and there are 258 OpenStax-derived rows in the
bank, but **nothing in this repo records their licence**, same habit gap that
made the Eedi question cost a session. Add OpenStax, Khan (`khanQuestions.json`,
currently 0 rows), and storyCells provenance to `data/SOURCES.md` when it is
created. Not part of this build; do not let it block.

---

## 10. DECISIONS required before implementing

**D1 — multi-ingredient field shape on `Question`.** `Question.ingredient_id` is
a single optional string (`questionBank.ts:47`) with three live consumers
(`:2333`, `:2369`, `:2375`) and **zero populated rows**. Our items carry a
multi-ingredient Q-vector.
*Recommendation:* populate `ingredient_id` with the primary target ingredient
(making those three dead consumers live for the first time) **and** add
`ingredient_ids: string[]` for the full vector. **This is the same decision
`INGREDIENT_TAG_EMISSION_BUILD.md` owns — the two specs must not diverge.**
Settle it once, in that spec, and have this one consume it.

**D2 — `error_type` vs `failure_signature`.** `error_type` is consumed by
substring matching, not an enum switch (`questionBank.ts:2316`,
`lookupMisconceptionTrap`), so new values break nothing but also will not fire
the existing trap-nickname heuristics. Eedi rows all use the flat literal
`"misconception"`.
*Recommendation:* keep `error_type` as the human-readable label and add
`failure_signature` as its own field on the taxonomy entry. Overloading one
string with two meanings is what makes the Eedi rows uninformative at the option
level.

---

## 11. Acceptance criteria

1. **≥ 40 verified items** on `basic_equations` across ≥ 3 templates and levels
   1–3, every one passing all six invariants.
2. **Every non-key choice carries a `rule_id`** and a `failure_signature`. Zero
   untagged distractors. Zero decoys.
3. **No rule's `apply` references the key** — reviewable by reading the four
   implementations.
4. **`key_unique` (invariant 2) demonstrably fires** — construct at least one
   deliberate two-right-answers case in tests and prove it is caught.
5. **Drops retain full text and all failing invariants**; the run prints a
   breakdown by invariant and by `rule_id`.
6. **Replay determinism**: re-running `(template_id, seed)` reproduces the item
   byte-identically.
7. **Q-vector distinctness report**: how many distinct ingredient vectors across
   the generated set, and the size of the largest identical-vector group. This is
   the AFM/PFA precondition, measured rather than assumed.
8. **`ml/data/misconception_rules/README.md` states that the library is not 1:1
   with ingredients**, and names `solution_verification` as the worked example of
   an ingredient that yields no rule.
9. Existing suites stay green: `cd ml && pytest` (expect 84 + new) and
   `python scripts/end2end.py` (expect 85/85).
10. **Nothing under `app/**` is modified.**

---

## 12. Non-goals

- **No client sync.** `syncGeneratedQuestions.mjs` (B4) is a later Product-lane
  step. Generated items land in `ml/data/generated/` and stop there.
- **No scaling past `basic_equations`.** Gated on Guard A (§9).
- **No word problems or geometry** in the pilot — the symbolic oracle cannot
  verify them. Those are the human-review residual (§7 item 8), specced later
  once the pilot's drop taxonomy shows what actually needs review.
- **No fitting anything.** No AFM, no PFA, no predictor changes. This build
  produces the substrate; fitting is `PREDICTOR_INGREDIENT_WIREUP_BUILD.md` and
  the unspecced power analysis.
- **No re-benchmarking against "30%".** That number was never a key-error rate.
  §6's breakdown is a new measurement, not a comparison.
