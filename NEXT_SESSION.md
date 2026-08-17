# Next session — licence resolved, and the generation reframe

Written 2026-08-16, **updated 2026-08-17** with the licence resolution (§1) and
the structural reframe (§2). **Supersedes the 2026-08-15 version.** That one's
§2–§4 are now either shipped or superseded; the parts still live are carried
forward below.

The through-line, unchanged: **make the Level 3 book real by making the student
model predictive.** What changed: the methods turned out to be a solved field we
were re-deriving badly, the data those methods would run on is **confirmed not
commercially licensable**, and — the useful part — **both of those problems have
the same solution.** Generate the items instead of inheriting them, and the
Q-matrix becomes an authored input rather than a quantity to be inferred from
someone else's tags. See §2's reframe; it reorders everything in §7.

---

## 0. Repo state — read before touching anything

**38 dirty paths. 1 unpushed commit.** This is well past the CLAUDE.md git rule
and has been accumulating all session.

```
1 unpushed commit:  85e73a27 docs: preregister ingredient predictor experiment

Modified (27) — four separate workstreams tangled together:
  ml/mindcraft_graph/{models/ingredient,engine/ingredient_graph,
     loaders/complete_ontology_loader}.py       ← ontology Stage 1
  ml/validation/{predictor,fit_predictor,replay,run_harness}.py
                                                ← 2-param predictor experiment
  ml/scripts/{ingest_eedi,promote_questions}.py ← Eedi join unify
  app/src/data/eediQuestions.json               ← 2,327 new distractor tags (DATA)
  CLAUDE.md + 5 lane-table files + 2 STORY_CELL copies + architecture.html
                                                ← sign-off gating removal + doc fixes
  ml/tests/*.py (7 files)

Untracked (11): 9 specs in agent_work/engine/, the research report,
  ml/scripts/backfill_distractor_misconceptions.py + its test
```

**Commit these as separate commits, not one.** At minimum: (1) engine code,
(2) `eediQuestions.json` as its own reviewable data diff, (3) specs + research
report, (4) doc/lane corrections. First moves: `git pull origin main`,
`cd ml && pytest` (expect 84), `python scripts/end2end.py` (expect 85/85).

**In flight:** `MISCONCEPTION_INGREDIENT_REMAP_BUILD.md` was sent to Codex at the
end of this session. The implementation scaffold is complete, but the
evaluation protocol and actual runs are still outstanding — verify it against
its §8 acceptance criteria before anything else, especially criterion 3, the
benchmark leak.

---

## 1. Licensing — RESOLVED. Eedi is NonCommercial; two actions remain.

**Settled 2026-08-17 from the competition's own rules document**, which is
authenticated and JS-rendered — which is why the earlier attempts failed. The
Eedi "Mining Misconceptions in Mathematics" (2024 Kaggle) data is **CC BY-NC
4.0**: *"DATA ACCESS AND USE AND TRAINED MODEL WEIGHTS: CC BY-NC 4.0."*

One nuance worth recording: the detailed clause sits inside **Section A.1
"Winner License,"** which nominally governs what a *winner* grants back, while
the document's top-line label presents CC BY-NC 4.0 as the general class for the
data itself. **Both readings point the same way — neither grants commercial
rights.** Do not spend more time on the interpretation; the answer does not
change.

**Exposure (unchanged):**
```
app/src/data/eediQuestions.json    imported at questionBank.ts:4 → bundled by
                                   Vite → served from mindcraft-93858.web.app
ml/data/eedi_misconceptions.json   1,749 misconception descriptions, tracked
data/eedi/train.csv                raw competition data, committed
```
That is **1,508 of ~1,942 bank rows (78%)**, live in a commercial product. The
ingest also transforms the questions substantially — LaTeX rewriting, alt-text
substitution into `(Diagram: …)`, concept re-tagging, template explanations — so
it is **derivative work**. NC alone already blocks the commercial use; the
derivative status only matters if an ND variant turns out to cover a related
release.

**Do not redo these** — they cannot reach the answer:
- Kaggle `/data` and `/rules` pages are JS-rendered; WebFetch gets the shell only
- [eedi.com/research](https://www.eedi.com/research) lists NeurIPS 2020/2022 datasets, states **no licence**
- The MISTAKE paper (arXiv 2510.11502) links to Kaggle, states **no licence**

### The two human actions

1. **Email Eedi for written commercial permission.** You now have the exact
   clause to cite. They're a commercial edtech company and separate permission is
   a normal path; a written grant beats any licence interpretation. Frame it
   narrowly: dataset name, King et al. 2024 citation, that it is ingested into a
   commercial product, asking for confirmation or a separate grant.
2. **Email McCreary to paper the verbal grant.** *Second open licensing item,
   newly surfaced:* McCreary's ontology work is used under a **verbal** grant from
   him to Akshat. Legally valid — he holds copyright and non-exclusive grants
   don't require writing — but the **scope is undocumented**: which repos,
   commercial derivative rights, attribution form. He's cooperative; low friction
   to close while we're already in cleanup.

### Interim posture on the deployed bundle — decide consciously

Three options, and this should be an explicit call rather than a default:
**(a)** pull the Eedi-derived rows from the client bundle pending permission
(drop the import at `questionBank.ts:4` — data stays in the repo, work stays
intact, fully reversible); **(b)** leave them and accept the risk while the email
is outstanding; **(c)** gate them behind a non-public/beta flag. Note `train.csv`
and the misconception file are **committed to the repo**, separate from the
served bundle, and are a separate decision.

**Not at risk:** the 42-concept ontology, 179 ingredients, the engine, the mastery
model — all MindCraft's own. The *methods* (retrieve/rerank, KC modelling,
AFM/PFA) are published and free to reimplement. `labelbank` and the Eedi
1st-place solution are **MIT** — usable **as code**, borrow the architecture
(global candidate generation → reranking → calibrated abstention), not the
content. **Learning Commons is CC BY 4.0** and commercially usable, so the
ontology restructure's external scaffold is unaffected. **Treat Eedi as
research-only reference going forward.**

**Also fix the habit:** create `data/SOURCES.md` recording origin, download date,
and licence for `data/eedi/`, ASSISTments (queued in `DATA_ENRICHMENT_PLAN.md`),
McCreary's ontology, and anything ingested later. Its absence is why this took a
session to answer.

---

## 2. The research report — findings that change the plan

Full report: [`agent_work/engine/deep-research-report.md`](agent_work/engine/deep-research-report.md).

### ⭐ The reframe — the mapping problem is underdetermined, so stop inferring it

**Added 2026-08-17. This is the most important idea in the document and it
reorders §7.**

The misconception→ingredient mapping isn't *hard*, it's **underdetermined**. What
we've been attempting is inverse inference: take someone else's items with
someone else's tags and try to recover the latent structure that generated them.
The research report already establishes why that cannot work at our scale:

- **2.19 tagged distractor slots per catalog misconception** on average — one seen
  once has no localisation evidence beyond its single parent question.
- **Question-level ingredients cannot separate three misconceptions attached to
  three distractors of the same item.** All three inherit identical evidence
  `{A,B,C}`. This is a resolution limit, not a data-quality issue.
- **The co-occurrence graph is downstream of the Q-matrix**, so it cannot validate
  the Q-matrix — it faithfully embeds whatever tagging errors produced it.
- **148 observations across 179 ingredients** rules out every psychometric
  validator (AFM ≈ 360 params, PFA ≈ 537; published PFA work used 40k–101k obs).

**The move: if you *generate* the item, the mapping is specified rather than
inferred.** Start from `ingredients = {A, B, C}`, execute a faulty procedure to
produce the distractor, and the misconception tag is **true by construction**. The
Q-matrix row is an *input*, not an estimate. The ambiguity isn't solved — it stops
being created.

**And the same move dissolves §1, because generated items have no upstream
owner.** The two "impossible" problems are one problem, and it's the tractable
one. What remains is a **verification** problem — far better-posed than latent-
structure inference, and the subject of §7 items 4–6.

**One correction to carry:** the handoff framed the residual bottleneck as "the
~30% wrong-answer-key rate." **That number does not exist as a measured key-error
rate** — see the standing retraction in CLAUDE.md: all 45 of 149 drops carry the
single reason `solver_disagreed` (one LLM disagreeing with another, **zero**
`solver_failed`), and the dropped items' text was never persisted, so no failure
taxonomy can be built from the artifact. 45/149 is a **disagreement rate between
two LLMs**, not an error rate. This doesn't weaken the case for symbolic
verification — it strengthens it, because the real value of a SymPy oracle is that
it **creates the measurement we currently don't have**, and any "we cut the 30%"
claim afterwards would be measuring against a number that was never real. Retain
the drops this time.

### The central architectural conclusion

**Three relations, not one.** We had been conflating them all session:

```
item / distractor → ingredient    Q-matrix / KC model
misconception    ↔ ingredient     error attribution, option-level diagnosis
ingredient       → concept        curriculum hierarchy / standards alignment
```

Each needs its own modelling, validation, and licence story. `ingredient →
concept` should carry **semantics** (`is_part_of`, `supports`,
`prerequisite_for`), not bare membership.

**Hypothesis confirmed:** ingredients really are **knowledge components (KCs)**;
question→ingredient really is a **Q-matrix / KC model**. We did not invent an
alien scheme. The mistake was narrower: collapsing three relations into one.

### P1 — our diagnosis was right, and there's a proven architecture

The Eedi 2024 competition ran essentially this task. **No winning system used a
topic-local candidate pool** — 1st, 2nd, and 3rd all used global retrieval →
reranking. That independently confirms the concept-scoped 5-candidate pool was
the defect.

Second correction: **don't map misconception text → ingredient text.** Map
misconception → all its `(question, correct answer, distractor, question-KCs)`
contexts. The 3,835 tagged slots are worth more than the 655 links.

Third: **abstention is not optional.** A misconception may correspond to *no*
current ingredient — that's ontology-coverage evidence, not annotation failure.
Forced choice hides missing coverage.

→ Acted on: [`MISCONCEPTION_INGREDIENT_REMAP_BUILD.md`](agent_work/engine/MISCONCEPTION_INGREDIENT_REMAP_BUILD.md), in flight.

### P2 — LFA is real but wrong for now; Learning Commons is the unblock

**LFA confirmed** (Cen/Koedinger/Junker) but with two limits: it only searches
within a **human-supplied P-matrix** of candidate factors — it cannot discover a
semantic hierarchy that was never represented — and the data requirement is
fatal. Published example: **5,104 observations / 59 students for 10 KCs.** You
have 148 observations for 179 ingredients (**<1 per ingredient**).

**The find: Learning Commons Math Learning Components — CC BY 4.0, commercially
usable with attribution.** Granular K–12 math skills already mapped to Common
Core and state standards, with exactly the architecture we want: fine skill layer
→ derived broader curriculum layer.

**This replaces Stage 2's LLM pilot.** Instead of 179 from-scratch membership
judgements, *align* 179 ingredients against a standards-linked taxonomy and
adjudicate candidates. Less invented, and standards alignment comes free.

Recommended P2 order from the report: make ingredient→concept many-to-many →
represent `is_part_of` / `supports` / `prerequisite_for` separately → align
against Learning Commons → human-adjudicate → record provenance per edge →
derive the 42-concept view → later use LFA to challenge it once volume exists.

### P3 — AFM/PFA are right, and unfittable

Parameter counts: conventional AFM ≈ **360 parameters** (2 learner + 179
intercepts + 179 slopes); PFA ≈ **537**. Against **148 binary observations**.
Published PFA experiments used **40,930 – 101,000** observations.

**Correction to our own spec:** *"Neither AFM nor PFA automatically gives
different predictions to items that have the same KC vector and the same learner
history."* Ingredient-level θ only differentiates questions when their ingredient
vectors actually differ. That is now a measurable precondition in
`PREDICTOR_INGREDIENT_WIREUP_BUILD.md`, not an assumption.

Near-term recommendation: make items differ through **known structure**
(Q-vector + a few authored features — required-KC count, prerequisite depth,
representation type), keep learned parameters tiny, and **start logging in
AFM/PFA-ready form now**: `user_id, item_id, item Q-vector, response order,
correctness, selected distractor, misconception tag, prior opportunities/
successes/failures per KC`. That converts P3 from unsolvable to merely blocked.

### Two provenance corrections

- It's the **2024 Kaggle** competition, not NeurIPS 2020. Published corpus:
  1,857 questions / 4,338 labelled choices / 2,587 misconceptions — our
  1,508 / 3,835 / 1,749 is a filtered subset, consistent with documented ingest
  rejections.
- **No published crosswalk exists** from Eedi's misconception taxonomy to a
  general secondary-maths KC taxonomy. Useful negative — stop looking for one.
  The method family is solved; the alignment is ours to build.

### Reusable, with licences

| Artefact | Licence | Verdict |
|---|---|---|
| **Learning Commons Math Learning Components** | **CC BY 4.0** | **adopt** — best P2 scaffold |
| Learning Commons progression/standards graph | CC BY 4.0 | useful for prerequisite structure |
| Eedi 1st-place solution code | MIT | usable — but does **not** sanitise NC-derived data/weights |
| **`labelbank`** (silver-medal, generalised) | MIT | retrieve/rerank over closed label banks |
| Eedi Mining Misconceptions data | **CC BY-NC** | **§1 blocker** |
| Junyi Academy | CC BY-NC-SA | not commercially ingestible |
| Illustrative Mathematics | edition-dependent (1st ed. BY 4.0, v.360 BY-NC) | care required |
| CMU DataShop / ASSISTments | project-specific | "public" ≠ "commercially reusable" |

---

## 3. Shipped and verified this session

**Eedi join unify** ([`EEDI_JOIN_UNIFY_BUILD.md`](agent_work/engine/EEDI_JOIN_UNIFY_BUILD.md)) — **all 8 acceptance criteria verified:**
```
tagged distractor slots  1,508 → 3,835 / 4,524  (33.3% → 84.8%)
cross-concept tags       561 → 0
untouched fields         all 11 byte-identical to HEAD, incl. storyContext
idempotent               0 filled / 3,835 skipped / 0 minted / 0 unresolvable
error_type               all 3,835 = "misconception"; student_thinking = eedi_name
tests                    84 pass from both roots; end2end 85/85
```
Root cause fixed: `promote_questions.build_numeric_to_slug` collapsed
concept-scoped slugs last-wins (205 of 1,437 Eedi ids map to >1 concept). Now
keyed on `(concept_id, numeric)`. **`build_numeric_to_slug` survives at
`promote_questions.py:160` as dead code — never use it on a write path.**

**Ontology restructure Stage 1** — `Ingredient.concept_id: str` →
`concept_ids: list[str]` with a legacy validator and a `concept_id` property.
Verified a true no-op: 84 tests, end2end 85/85, **all 179 ingredients still
carry exactly one concept.**

**2-parameter predictor experiment** — pre-registered, run, **null, and correctly
stopped without tuning.**
```
                    4-param    2-param
in-sample           0.2387     0.2430
held-out predictor  0.2676     0.2552
held-out constant   0.2538     0.2548
delta vs constant   +0.0138    +0.0004     ← tie
generalisation gap  0.0289     0.0162      ← halved
```
In-sample got *worse* while held-out improved — the signature of removing overfit
capacity, and evidence it wasn't tuned to pass. Confirms the Stage 1
mis-specification diagnosis: `format_weight` was actively harmful, not just noise.

**Also:** Akshat sign-off gating removed repo-wide (lanes are now path scopes, no
human owner named); `mc-diagnostic.js` confirmed **already fixed** and closed in
CLAUDE.md + `architecture.html`; CLAUDE.md Eedi gotchas rewritten.

---

## 4. Retractions — do NOT re-derive these

Five claims made *during this session* that were wrong and are corrected here.

1. **The predictor tie is NOT evidence the concept layer is too coarse.** I said
   it was. In the 2-param model, difficulty is `difficulty_by_concept[cid]`
   (`replay.py:95`, per **concept**) and `level_scale`/`format_weight` are pinned
   to 0 — so **no per-item input remains** and every question in a concept gets an
   identical prediction. A model with no within-concept resolution tying a
   constant is the mundane expected outcome. The restructure case rests on the
   163→26 collapse, the 205 split identities, and the median-5 pool — not on this.

2. **The 22 cross-concept anchors are NOT all wrong.** I called them "the ontology
   over-reaching." Roughly half are **coarse→fine** — the ontology being *more
   specific* than Eedi's bucket (`algebraic_manipulation → factoring_polynomials`).
   The ontology has **no containment relation at all** (`node_type` is `concept`
   for all 42; `level` is a difficulty tier), which is why they look like
   conflicts.

3. **The map-free (misconception-keyed) predictor was rejected, correctly.**
   I recommended it for provenance purity. Wrong trade: 1,749 misconceptions
   memorise, 179 ingredients generalise. For an unseen question the student has
   no history on its specific traps but does on its ingredients. **Consequence:
   the predictor now depends on map quality, which promotes the remap from
   diagnosis nicety to predictor prerequisite.**

4. **"Cleaning duplicates will make the numbers worse" was wrong** — the harness
   **already dedupes**. `run_harness._load_observations` → `load_attempt_observations`
   (`firestore_adapter.py:184`), which dedupes on `(student_id, question_id, correct)`
   by default. n=148 is already post-dedup.

5. **Anchor cleaning is superseded.** I proposed hand-adjudicating 23 anchors.
   `diagnostic_tags` is a **list**, giving **232 (ingredient, misconception)
   pairs across 95 ingredients, 88 of them net-new** — a far better benchmark, and
   hand-adjudication was the wrong tool for a non-specialist operator anyway.

Carried forward from the previous handoff, still true:
- **`resolveChoiceEvidence`'s early return is NOT a bug** — the flat
  `misconception_id` belongs to one specific wrong choice; falling through would
  tag a student with a misconception for a choice they didn't pick.
- The "August session-fragmentation regression" was **duplicate re-submission**.

---

## 5. Measurements — don't re-measure these

| Quantity | Value |
|---|---|
| Bank rows | 1,942 (eedi 1,508 / questionBank.ts 227 / actMaster 205 / generated 2) |
| Tagged distractor slots | **3,835 / 4,524 (84.8%)**, 0 cross-concept |
| Questions resolving to ≥1 ingredient | **1,170 / 1,508 (77.6%)**; 187 resolve to >1 |
| `distractor_taxonomy` coverage | eedi 1,508/1,508; actMaster **0**/205; generated **0**/2 → **~60% bank ceiling** |
| Map | 655 links — **282 human / 344 llm / 29 embedding** |
| Map quality (same-concept eligible) | human **0.928**, embedding 0.727, llm **0.545**, pooled 0.824 |
| `diagnostic_tags` benchmark | **232 pairs / 95 ingredients**, 144 in map, **88 net-new** |
| Ingredients per concept | median 4, min 2, max 7 (179 across 42) |
| Old candidate pool | median **5**; 86.6% of misconceptions got ≤6 |
| Prerequisite graph | **68 derived edges**, 37/42 concepts (from bridges + ingredient `comes_from`) |
| Pool with depth-1 prereq widening | median 5 → **9** (mean 11.4, max 25) |
| Eedi ids spanning >1 concept | **205 / 1,437 (14.3%)**, max split **11** |
| `SUBJECT_MAP` | **163 SubjectNames → 26 concepts** (`number_properties` absorbs 20) |
| Eedi misconceptions with UK-curriculum markers | 92 |
| Predictor baseline | held-out constant **0.2548**, predictor **0.2552**, n=**148** (3 smoke excluded) |
| Firestore silent handlers | **7 of 8** still log nothing |

---

## 6. Open specs

| Spec | State |
|---|---|
| [`INGREDIENT_FIRST_GENERATION_BUILD.md`](agent_work/engine/INGREDIENT_FIRST_GENERATION_BUILD.md) | **NEW 2026-08-17, ready to implement — the chosen branch.** Pilot `basic_equations`; scaling gated on Learning Commons alignment (Guard A) |
| [`FIRESTORE_SILENT_FAILURE_BUILD.md`](agent_work/engine/FIRESTORE_SILENT_FAILURE_BUILD.md) | Implemented, awaiting commit; health exposure optional follow-up |
| [`ONTOLOGY_INGREDIENT_PRIMARY_BUILD.md`](agent_work/engine/ONTOLOGY_INGREDIENT_PRIMARY_BUILD.md) | Stage 1 implemented but not accepted/committed; Stage 2 rewrite required; Stage 3 superseded; Stage 4 blocked |
| [`MISCONCEPTION_INGREDIENT_REMAP_BUILD.md`](agent_work/engine/MISCONCEPTION_INGREDIENT_REMAP_BUILD.md) | Implementation scaffold complete; evaluation protocol and actual runs outstanding |
| [`PREDICTOR_INGREDIENT_WIREUP_BUILD.md`](agent_work/engine/PREDICTOR_INGREDIENT_WIREUP_BUILD.md) | Implementation in flight; blocked on same-Q-vector gate and remap provenance |
| [`INGREDIENT_TAG_EMISSION_BUILD.md`](agent_work/engine/INGREDIENT_TAG_EMISSION_BUILD.md) | Blocked on remap plus field-shape decision; spec needs rerank_v2 rewrite |
| [`EEDI_DISTRACTOR_HARVEST_BUILD.md`](agent_work/engine/EEDI_DISTRACTOR_HARVEST_BUILD.md) | Archive/superseded; corrected join and S4 implemented |
| [`agent_work/product/APP_ROOT_NO_REDIRECT_PLAN.md`](agent_work/product/APP_ROOT_NO_REDIRECT_PLAN.md) | Open, untouched |

**Also not yet specced:** power analysis (simulate from *published AFM/PFA parameter
ranges* — not from anyone's observations — at n = 148 / 500 / 2k / 10k / 50k, and
find where the fitter recovers planted parameters). This answers the one question
that gates everything: **how much real usage before any of this is estimable.**
It's also the honest test of the ingredient design — if it can't find a signal
you deliberately planted, it won't find a real one.

---

## 7. Recommended order

**Sequencing logic:** symbolic verification unblocks generation → generation makes
the Q-matrix *authored* rather than inferred → Learning Commons anchors it
externally → response data validates it later. Eedi becomes a reference we learned
from rather than a dependency we ship.

### Immediate — this week

1. **Email Eedi** for written commercial permission, citing the §1 clause.
2. **Decide the interim posture** on the deployed bundle (§1: pull / accept /
   gate) — and separately on the committed `train.csv` + misconception file.
3. **Email McCreary** to paper the verbal ontology grant (scope: repos,
   commercial derivative rights, attribution).
4. **Commit the tree** as separate commits (§0). Overdue, and blocks nothing else
   cleanly until done.
5. **Land the silent Firestore handlers** — already implemented (part of the
   uncommitted tree in §0), just needs its own commit. Health exposure is an
   optional follow-up, not a blocker.

### Core engineering — the actual unblock

6. **Ship [`INGREDIENT_FIRST_GENERATION_BUILD.md`](agent_work/engine/INGREDIENT_FIRST_GENERATION_BUILD.md)** —
   written 2026-08-17, ready to implement, Engine lane. Covers items 6–8 of the
   original plan as one build: the SymPy oracle (6 invariants, including the
   **`key_unique`** check the LLM pipeline structurally cannot do), inverted
   distractor generation so the misconception rule *produces* the option,
   `failure_signature` per choice, seeded replay, and **full drop retention** so a
   real failure taxonomy exists this time. **Pilot is `basic_equations` only** —
   foundational, ACT-tested, zero bank questions, all 5 ingredients unreached, and
   4 of its 5 `failure_mode` fields are already executable-shaped.
7. **Stop after the pilot and check.** Scaling the rule library past one concept
   is gated on Guard A (item 9) — authoring 179 ingredients' worth of rules bakes
   in whatever the current ingredient set gets wrong, exactly when it becomes
   expensive to unwind. 4 rules are cheap to redo; 179 are not.
8. **Route the unverifiable residual to human review** — word problems, geometry,
   anything not symbolically expressible. Spec it *after* the pilot's drop
   breakdown shows what actually needs review, rather than guessing the shape now.

### Structural — parallel, lower urgency

9. **Align the 179 ingredients to Learning Commons Math Learning Components**
   (CC BY 4.0). The one genuinely clean external artefact in the licensing survey.
   It gives external grounding so the ontology isn't purely self-referential —
   **the main risk of going all-in on generation.** Human-adjudicate candidates;
   record provenance and confidence on every edge. This is the Stage 2 rewrite.
10. **Make ingredient→concept many-to-many with typed relations** (`is_part_of`,
    `supports`, `prerequisite_for`) and *derive* the 42-concept view from that
    graph rather than treating it as a partition. Removes the failure mode where a
    wrong concept choice eliminates the correct ingredient before classification
    starts.
11. **Start logging in AFM/PFA-ready form now**: `user_id`, `item_id`, item
    Q-vector, response order/timestamp, correctness, selected distractor,
    misconception tag, prior opportunities/successes/failures per KC. Near-zero
    cost today; converts P3 from unsolvable to estimable once usage arrives.
    Empirical Q-matrix validation is the real validator and needs response data.
12. **Power analysis** (still unspecced, §6). Converts "148 is too small" from
    assertion into a target.
13. **Predictor wire-up**, gated on the same-Q-vector precondition.

**Deprioritised by the reframe:** the misconception→ingredient remap (§6) was
promoted to "predictor prerequisite" by retraction 3. The reframe doesn't retract
that, but it changes what the remap is *for* — it now buys diagnosis quality on
the **inherited** Eedi bank, which §1 says we may not ship. Verify what Codex
returned, then hold it behind items 6–8 rather than treating it as the critical
path.

**One thing worth holding onto:** we already *have* our own structure — 42
concepts, 179 ingredients, the combinations layer, 85/85 e2e. That was never the
missing piece. What's missing is **items honestly tagged against it**, and
generation is how we get those.

---

## 8. Gotchas

- **Never re-run `ingest_eedi.py` to fix bank data.** It has the correct join but
  regenerating **wipes `storyContext` on all 1,508 questions** and reverts two
  manually-cleaned `choices` arrays (`eedi_147`, `eedi_839`). Field fixes go
  through `backfill_distractor_misconceptions.py`. There is **no Groq explain
  cache** — the explanations are template output, so that is *not* the reason.
- `validation.run_harness` takes student ids **positionally**; `--all` discovers them.
- `evictQuestionCache` is in `questionAgent.ts` and is for LLM-generated questions;
  `getQuestions` (static bank) has no cache — it shuffles.
- `getQuestions` accepts `seenIds` but **`Practice.tsx` passes `[]` at both call
  sites** — repeat avoidance is effectively off.
- Firestore returns tz-aware datetimes; the engine is naive. `_to_naive()`.
- **`load_student_events` (`firestore_adapter.py:66`) does NOT dedupe** while
  `load_attempt_observations` does. Production mastery still folds historical
  duplicates at full weight; the harness doesn't. Low stakes today (only the two
  founders have data) but it will not stay that way.
- `Question` already has a question-level `ingredient_id?: string`
  (`questionBank.ts:47`) with **three live consumers** (`:2333`, `:2369`, `:2375`)
  and **zero populated rows** — so `getQuestionsForMisconceptionWeakness` has two
  of its three priority tiers permanently dead.
- **148 observations are from two founders**, not students. Even at good volume
  that data cannot validate a student model.
- Detail on the earlier measurements lives in `ENGINE_BOOK_ACCURACY_REVIEW.md`
  and `agent_work/engine/CLASSIFIER_INGREDIENT_AUDIT.md`.
