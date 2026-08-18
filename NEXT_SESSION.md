# Next session — generation works; the blockers are licensing and data

Written 2026-08-18. **Supersedes the 2026-08-16/17 version.** Everything below
was verified this session; superseded material is dropped rather than carried.

**The through-line:** make the Level 3 book real by making the student model
predictive. Two things changed this session, and they point in opposite
directions:

- **Generation is real.** The ingredient-first pilot ships 48 oracle-verified
  items where every distractor is *computed* from an executed misconception rule.
  A classification pass says **144 of 179 ingredients can yield such a rule**,
  130 of them symbolically today. This arc is close to done.
- **The predictor is not close, and generation does not unblock it.** It is
  blocked on *student responses* (n=148, two founders), not on items. Generating
  10,000 questions produces zero additional observations. See §7 — this matters
  for sequencing and is easy to misread.

---

## 1. Licensing — the standing constraint

**Three sources verified. Two block, one is clean.** Full detail and remediation:
[`EXTERNAL_DATA_SOURCING_BUILD.md`](agent_work/engine/EXTERNAL_DATA_SOURCING_BUILD.md);
ledger at [`data/SOURCES.md`](data/SOURCES.md).

| Source | Licence | Ship? |
|---|---|---|
| **Eedi** (1,508 bank rows) | CC BY-NC 4.0 — confirmed from competition rules §A.1 | ❌ |
| **OpenStax Contemporary Maths** (209 rows) | CC BY-NC-SA | ❌ |
| OpenStax rows of unknown origin (37) | unrecoverable provenance | ❌ |
| **OpenStax 1st editions** (601 harvested) | CC BY 4.0 | ✅ |
| **Learning Commons** (4,551 components) | CC BY 4.0, documented upstream chain | ✅ |
| **Dan McCreary MicroSims** | **CC BY-NC-SA 4.0** | ❌ — but see below |

**~1,754 of ~1,979 shipped bank rows are NonCommercial**, from two independent
sources found weeks apart.

**Two findings worth carrying:**

- **OpenStax licensing is edition-based and inverted from intuition** — 1st
  editions are CC BY, `-2e` second editions were relicensed CC BY-NC-SA. Verify
  per slug: `openstax.org/apps/cms/api/v2/pages/?type=books.Book&slug=<slug>&fields=license_name`.
- **McCreary is CC BY-NC-SA, not ND** — adaptation is explicitly permitted. The
  binding terms are **NC** and, less obviously, **SA**: ShareAlike is viral, so
  MicroSims derived from his work would have to ship under CC BY-NC-SA
  themselves. **His licence page offers a standing commercial-licensing path**
  ("contact Dan McCreary on LinkedIn"), which makes this an ask he already has a
  process for, not a favour.

### Human actions (only you can do these)

1. **Email Eedi** for written commercial permission, citing the §A.1 clause.
2. **Email McCreary** via his commercial-licensing path. Scope: commercial use,
   **relief from ShareAlike on derived output**, AI-assisted generation from his
   corpus, attribution form, and which repos. This also papers the existing
   verbal grant to Akshat.
3. **Decide the interim posture** on the shipped bundle: pull, accept, or gate.
   Committed `train.csv` + misconception file are a separate decision.

**Standing rule now in force:** unknown licence blocks, does not warn. Both
incidents came from a permissive default.

---

## 2. Generation — what actually works

`INGREDIENT_FIRST_GENERATION_BUILD.md`, shipped. The inversion: start from an
authored ingredient Q-vector, solve symbolically for the key, and let each
misconception rule **execute its faulty procedure to produce its distractor** —
so the tag is true by construction rather than inferred.

Real output, `7x + 10 = −2(2x − 5)`, key `0`:

```
[0] 0      <- KEY
[1] 23     sequencing     running-total rule: combines every visible term
[2] -11    substitution   subtracts the coefficient instead of dividing
[3] 10/11  omission       changes one side without the other
```

**Verified:** 48 items, 3 templates, levels 1–3; zero untagged non-key choices;
no rule's `apply()` references the key; `key_unique` proven to fire on a
deliberate two-right-answers case; drops retain full stem/choices/seed/params;
replay byte-identical; 133 tests + 85/85 end2end.

**Two honest gaps:**

- **The prose layer is in template fallback.** Across 48 items there is exactly
  **1 distinct `storyContext`** and **1 hint set** — `skin.py` calls the LLM but
  no `GROQ_API_KEY` is set. The math is real; the writing is placeholder, and
  "A workshop display shows an equation" violates the story-first rule. Add a key
  to `ml/.env.local` and re-run; the oracle re-checks the skinned stem, so the
  LLM cannot corrupt a number.
- **All 7 drops fail on `insufficient_firing_rules`, not on an oracle invariant.**
  The six invariants have only ever fired in the deliberate unit test. Not a
  defect — the templates and rules are well-formed — but the drop breakdown is not
  yet evidence about item quality.

---

## 3. The rule worklist — 179 ingredients classified

`ml/data/misconception_rules/ingredient_rule_candidates.json`. One criterion:
*does this error produce a characteristic wrong VALUE that could go in an option?*

| class | n | meaning |
|---|---|---|
| **executable** | **144** | yields a computable wrong answer → can become a rule |
| interpretation | 22 | right value, misread or unexplained → no distractor exists |
| meta | 13 | strategy/verification → no value produced |

**130 are executable AND symbolically tractable** — the immediately actionable
worklist, against 4 rules built. Richest: `functions_basics` 6/6, then
exponent rules, logs, polynomials, radicals, transformations, conics — symbol
manipulation is near-uniformly tractable and is where authoring pays off fastest.
Leanest: `act_strategy` 0/4 (all meta, as predicted), `trigonometry_basics` 1/6
(five are genuine "knows the ratio, can't transfer it" interpretation failures).

The 14 executable-but-not-tractable need figure/chart/prose-aware problem
representations first — that is the deferred GeoGebra/Desmos work, now with a
count attached.

**One entry was corrected before commit:** `basic_equations__equals_sign_balance`
was classified `interpretation` ("lands on the right total"), which contradicts
shipped code — `mis_rule_equals_balance__chains_running_total` already produces
**28 oracle-verified distractors** from it (on `7x = 7` it yields 14). Corrected
to executable. **The lesson generalises: where the ontology's `failure_mode`
wording disagrees with a working rule, the wording is the weak artifact.** Second
time today (the first: `inverse_operations`'s mis-assigned misconception family).

---

## 4. Kernel / skin split — designed this session

[`KERNEL_SKIN_SPLIT_BUILD.md`](agent_work/engine/KERNEL_SKIN_SPLIT_BUILD.md).
Ingredients now belong to *sets* of concepts, so an item has no single story
world. Split the frozen math (**kernel**) from the presentation (**skin**).

Both halves already exist and cannot join: `(template_id, seed, params)` is
already the kernel in `provenance.jsonl`; `batch_ingredient_fable5_reskin.json`
already has `reskin_of`/`presentation`/`storyContext`, built for 3 reskins then
stalled. The missing piece is a stable `kernel_id`.

**The modelling decision — record, don't model.** Do NOT one-hot the story world:
it adds parameters to a model that cannot fit the ones it has (AFM ≈ 360, PFA ≈
537, vs 148 observations), it estimates a global per-world offset rather than the
student×kernel interaction that actually matters, and it cannot generalise to a
new world — which taxes exactly the expansion `WORLD_VISION.md` is built on.
Store `skin_id` / `story_world` / `format` on observations and model none of them.

**Status correction:** `representation_profile` (the Layer 4 format axis) is
**schema only — not implemented**. It appears in the live engine once, in a
*comment* at `config.py:14`. So today format reskins are recorded and unmodelled
too. Do not write code assuming it exists.

**The trap:** skins do **not** create Q-vector diversity. The run has 3 distinct
Q-vectors, largest group 16; ten skins each gives 480 items and still 3 Q-vectors.
Skins multiply *evidence per kernel*; only new templates and rules multiply *item
structure*. A bigger `items.json` is not progress on the predictor.

---

## 5. Measurements — don't re-measure these

| Quantity | Value |
|---|---|
| Ingredients yielding a rule | **144 / 179**; **130** also symbolically tractable |
| Generated pilot | 48 items / 7 drops, 3 Q-vectors, largest identical group 16 |
| Shipped NC exposure | ~1,754 of ~1,979 bank rows |
| OpenStax clean harvest | 601 items (tier A); 1,093 tier B + 171 tier C pending a licence call |
| OpenStax MCQ yield | **4 usable MCQs from 607** — the direct-bank path is dead |
| Learning Commons | 4,551 math components; **zero questions** |
| Predictor baseline | held-out constant 0.2548, predictor 0.2552, n=**148** |
| Map quality (same-concept) | human 0.928, embedding 0.727, llm 0.545 |
| Classifier top-1 | **0.7593** shipped config; 0.545 on ACT items (0.80 is scope-stripped) |

---

## 6. Open specs

| Spec | State |
|---|---|
| [`INGREDIENT_FIRST_GENERATION_BUILD.md`](agent_work/engine/INGREDIENT_FIRST_GENERATION_BUILD.md) | **Pilot shipped + verified.** Scaling gated on Guard A |
| [`KERNEL_SKIN_SPLIT_BUILD.md`](agent_work/engine/KERNEL_SKIN_SPLIT_BUILD.md) | **NEW, ready to implement** |
| [`EXTERNAL_DATA_SOURCING_BUILD.md`](agent_work/engine/EXTERNAL_DATA_SOURCING_BUILD.md) | S0/S1/S3/S4/S5 done; **S2 quarantine open**, S6 NAEP deferred |
| [`ONTOLOGY_INGREDIENT_PRIMARY_BUILD.md`](agent_work/engine/ONTOLOGY_INGREDIENT_PRIMARY_BUILD.md) | Stage 1 shipped; **Stage 2 = Learning Commons alignment, data staged, work not started** |
| [`MISCONCEPTION_INGREDIENT_REMAP_BUILD.md`](agent_work/engine/MISCONCEPTION_INGREDIENT_REMAP_BUILD.md) | Scaffold shipped; evaluation runs outstanding. **Deprioritised** — it improves diagnosis on the *inherited* Eedi bank, which may not ship |
| [`PREDICTOR_INGREDIENT_WIREUP_BUILD.md`](agent_work/engine/PREDICTOR_INGREDIENT_WIREUP_BUILD.md) | Open — gated on the same-Q-vector precondition |
| [`INGREDIENT_TAG_EMISSION_BUILD.md`](agent_work/engine/INGREDIENT_TAG_EMISSION_BUILD.md) | Blocked on remap + the D1 field-shape decision |
| [`agent_work/product/APP_ROOT_NO_REDIRECT_PLAN.md`](agent_work/product/APP_ROOT_NO_REDIRECT_PLAN.md) | Open, untouched |

**Still unspecced: the power analysis.** Simulate from *published* AFM/PFA
parameter ranges at n = 148 / 500 / 2k / 10k / 50k and find where the fitter
recovers planted parameters. It answers the one question gating everything
downstream — **how much real usage before any of this is estimable** — and it is
also the honest test of the ingredient design: if it cannot find a signal you
deliberately planted, it will not find a real one.

---

## 7. Recommended order — and one expectation to reset

**Generation → predictor → Level 3 books is the right arc, but the middle arrow
does not work the way it looks.** The predictor is blocked on *student
responses*, not on items. Finishing generation produces zero observations. What
actually unblocks it is real usage (or the power analysis telling you how much
usage is enough). Worth knowing before planning around it.

What generation *does* buy: content that is legally ours, diagnostically tagged
by construction, and — via kernel/skin pooling — worth more per response once
responses exist.

1. **Send the two emails (§1).** Everything data-side is provisional until Eedi
   answers, and McCreary already has a commercial path.
2. **Add `GROQ_API_KEY` to `ml/.env.local` and re-run generation.** Turns
   placeholder prose into real story-first output; the oracle protects the math.
   Cheapest visible win available.
3. **Author rules for one more concept** off the 130-item worklist — exponent
   rules or polynomials. Proves the pilot generalises beyond `basic_equations`.
4. **Implement the kernel/skin split (§4)** before item volume grows, so the
   restructure stays cheap.
5. **Power analysis.** Converts "148 is too small" from assertion into a number.
6. **Learning Commons alignment (Stage 2)** — Guard A, which gates scaling
   generation past a pilot. Data is staged; the alignment work has not started.
7. Then the predictor wire-up, gated on the same-Q-vector precondition.

**S2 quarantine sits deliberately late** — pulling rows before a replacement
exists maximises the coverage hole. If Eedi answers no, it jumps to the top.

---

## 8. Gotchas

- **Never re-run `ingest_eedi.py` to fix bank data** — it wipes `storyContext` on
  all 1,508 rows and reverts two hand-cleaned `choices` arrays (`eedi_147`,
  `eedi_839`). Field fixes go through `backfill_distractor_misconceptions.py`.
- **`promote_questions.build_numeric_to_slug` is dead code** (`:160`) — never use
  it on a write path; it collapses concept-scoped slugs last-wins.
- **Don't use `--convert-free-response`** on the OpenStax harvest — it has an LLM
  invent distractors, the exact untagged options the reframe eliminates.
- **`ml/data/generated/` is gitignored** — regenerable byte-identically from
  `(template_id, seed)`; rules and templates in git are the source of truth.
- **`ml/data/openstax/exercises.json` now holds only CC BY books.** The adapter
  gates on licence and rejects dual-tagged items; 29 tests pin it.
- **Layers 2–5 are schema, not implementation.** Only Layer 1 is wired. Applies
  to `representation_profile` specifically (§4).
- `load_student_events` does **not** dedupe while `load_attempt_observations`
  does; production mastery still folds historical duplicates at full weight.
- `getQuestions` accepts `seenIds` but `Practice.tsx` passes `[]` at both call
  sites — repeat avoidance is effectively off.
- **148 observations are from two founders**, not students. Even at good volume
  that data cannot validate a student model.
