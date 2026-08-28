# Content quality (sim-first books) + cross-domain bridging — findings & build plan

**Date:** 2026-08-27. **Status:** research + plan only — no code changed.
**Scope:** two founder complaints: (1) generated chapters are text walls, should be
sim-first with images; (2) the knowledge graph's "right side" is scattered dots and
needs cross-domain bridges *without corrupting Dan's algorithm*.
Style follows `FORMAT_WEAKNESS_PLAN.md`: findings first, then contracts a coding
agent can implement directly.

Repos involved (both local):
- `/Users/akoirala/Developer/mindcraft` (this repo — webhook, ml engine, iOS)
- `/Users/akoirala/Developer/mindcraft-content-engine` (the generation service —
  the HF Space `joinmindcraft-mindcraft-content-engine.hf.space` that
  `webhook/lib/handlers/generate-book.ts` calls)

---

## Problem 1 — why chapters are text-heavy (findings)

### 1.1 Where book generation actually lives

The webhook handler `webhook/lib/handlers/generate-book.ts` is a thin proxy. The
real pipeline is in **mindcraft-content-engine**:

| Stage | File (content-engine repo) |
|---|---|
| Topic → 4-6 concept mini-graph | `src/mindcraft_content_engine/serve.py` `_decompose_topic` (`_DECOMPOSE_PROMPT`, line ~349) |
| Per-concept prose + gate | `scripts/generate_concept_prose.py` (`GENERATION_PROMPT` line ~346, `PROSE_RUBRIC` line ~493) |
| Per-concept sim attempt | `serve.py` `_maybe_generate_sim` → `src/.../simulation_generator.py` (fit_check → generate → render → structural rubric → vision_gate) |
| Discussion fallback (sim-unfit concepts only) | `serve.py` `_maybe_generate_discussion` |
| Stitch | `src/.../book_assembler.py` `assemble_book()` — orders/joins already-gated units, generates nothing |
| iOS render | `ios-prototype/MindCraftNotes/MindCraftNotes/Views/BookReaderView.swift` |

### 1.2 Root cause: the prompt *requires* a text wall

`GENERATION_PROMPT` in `generate_concept_prose.py` hard-requires, per concept:

> "300-600 words of prose, 3-6 paragraphs, written TO the student … no
> bullet-point information dumps — this is a book section, not a slide."

So a 5-concept book = 1,500–3,000 words by construction — exactly "five pages,
too many words." The gate reinforces it: `PROSE_RUBRIC` scores
`explanatory_quality` (20 pts, penalizes "an encyclopedia stub"),
`clarity_flow` (paragraph sequencing), `concreteness` (worked example in prose).
A short, caption-style section would *fail* the current 85% gate. Prompt and
rubric must change together or yield collapses.

### 1.3 The client already fought this battle — and reverted

`BookReaderView.swift` history (doc comments in the file):
- 2026-08-21 rebuild: summary-only + sim as "the teaching surface," full `body`
  deliberately never shown ("too many words, no structure").
- 2026-08-23 explicit reversal: body always shows again, because sim-pages had
  "a bare interactive widget with zero explanation."

Lesson: **hiding the text client-side is a dead end already tried twice.** The
content itself has to be generated short. The right target shape is what the
2026-08-23 ask implies: short prose that *explains the sim*, not prose that
teaches the whole concept with a sim bolted on.

### 1.4 Sims are attempted but under-armed in the live path

`serve.py:_maybe_generate_sim` (line ~474) runs the full gated sim pipeline per
concept, but two quality levers that already exist are **unwired on the live
on-demand path**:

1. **No prose companion brief.** `generator.generate(concept,
   pick_few_shot(concept, [], n=2))` (serve.py line ~519) passes `prose_brief=None`
   even though the gate-passed prose exists at that point.
   `simulation_generator.py`'s `_PROSE_COMPANION_BLOCK` (sim uses the section's
   own terminology and worked-example numbers as defaults) was built for exactly
   this (`PROSE_AND_BOOK_ASSEMBLY_SPEC.md` §8, "prose-first, sim-briefed-by-prose")
   and is only used by the cron's `scripts/generate_companion_units.py`.
2. **Empty few-shot corpus.** That same call passes `[]` as the corpus, so the
   generator gets zero real McCreary examples, though the extracted corpus
   (100+ validated sims) is in the repo.

Also: one sim attempt per concept, no retry. A failure at any of the 4 gate
stages silently degrades the section to prose-only (or discussion if
`fit_check` declined) — which is precisely the page the founder experiences as
a text wall. Flagship run evidence: 3 gate-passed chapters, **2** embedded sims.

### 1.5 Cost reality (matters: sim-first is affordable)

Verified numbers from code/doc comments:
- Full on-demand book: **~4 min, $3.60** (Anthropic path), 3 gate-passed
  chapters + 2 sims (`generate-book.ts` header; verified live 2026-08-21).
- Stated per-concept estimates in `serve.py`: prose+gate **$0.50** ($0.10 BYOK —
  judges stay on MindCraft's Anthropic account), sim attempt **$0.20** ($0.05
  BYOK — vision_gate not ported to Gemini), discussion **$0.30** ($0.27 BYOK).
- Platform guardrails: `webhook/lib/generationBudget.ts` —
  `PLATFORM_MONTHLY_BUDGET_USD = 25`, 3 attempts/student/day (bypassed on BYOK
  start; terminal-poll spend still recorded).
- BYOK (2026-08-25) makes generation marginal-cost ≈ judge-only: a sim-first
  book on a student key costs the platform roughly **$0.45–0.90** (judges +
  vision gate) instead of $3.60.

Implication: adding 1 retry per failed sim and an image per sim-less section
raises per-book platform cost by well under $1 on the Anthropic path and by
cents on BYOK. Sim-first *is* economically viable at closed-test scale; the $25
monthly cap, not unit cost, is the binding constraint for scaling beyond it.

### 1.6 Image generation: exists offline, absent from the serving pipeline

- **No live image-gen anywhere** in webhook/, ml/, or content-engine
  (searched DALL-E/Imagen/Flux/image-gen — zero integrations in serving code).
  `CURSOR_HANDOFF.md:571` says it plainly: "No image generation integration."
- **An offline pipeline already exists**: `app/scripts/generateConceptArt.mjs` —
  Higgsfield CLI, one 800×800 JPEG per concept from its locked story identity,
  cost-audited in `app/scripts/conceptArtManifest.json`, checked into
  `app/src/assets/canvas/generated/`, auto-discovered by `storyArt.ts`. Plus
  `generateConceptArtSvg.mjs` (hand-composed SVG path).
- The ratified design decision (`STORY_LAYER_RECONCILE.md` §5.4): art is
  **per-concept, offline, checked in — never per-question live**. ~42 images
  once vs ~1,500 live: 35× cost + latency for marginal gain.
- Schema gap: `book_assembler.AssembledSection` has `sim_*` and
  `discussion_title` fields but **no image/figure field at all** — nowhere for
  an image to live even if generated.

### 1.7 Question generation (`ml/generation/`) — adjacent, not the same fix

Separate pipeline (essence → Groq → format-tagged MCQs; `ml/generation/generate.py`).
Status per CLAUDE.md "Generation paused": verify pass kept 104 / dropped 45, all
45 tagged `solver_disagreed` (one LLM disagreeing with another). **That is not a
measured bad-key rate** — dropped item text was never persisted, so no failure
taxonomy exists; the earlier "~30% bad key rate" framing is retracted in
CLAUDE.md and must not drive decisions. Rebuild the verifier with a
deterministic backstop (SymPy) and retain drops before trusting any yield
number. This pipeline is *not* what the founder's chapter complaint is about;
listed here only so nobody "fixes" the wrong generator.

### 1.8 McCreary's actual quality bar (verified, not folklore)

His published repos (`github.com/dmccreary/claude-skills`, `.../microsims`) do
NOT publish one canonical rubric document — the top-level READMEs reference
standards (Bloom's 2001, ISO 11179 glossaries, concept-DAG structure) and keep
criteria in per-skill reference files. The concrete criteria this codebase uses
were extracted from those files during Phase 1 and are already implemented:

- **MicroSim standardization, 100 pts / ≥85 proceed** — direct port in
  content-engine `src/.../microsim_rubric.py` (source cited in its docstring:
  `skills/microsim-utils/references/standardization.md` +
  `calculate-quality-score.py`). Items: main.html present, iframe embed,
  fullscreen link, copy-paste example, screenshot, description/lesson-plan/
  references sections, Dublin Core `metadata.json` (9 fields, lenient ≤2
  missing = his own rule), type-specific p5.js check.
- **Learning-graph validation** — `analyze-graph.py`-style checks ported to
  `src/.../graph_validator.py`: zero cycles + zero orphans = healthy;
  connectivity/indegree-outdegree/taxonomy balance advisory.
- **≥85 "proceed" pattern** — recurs across his skills; MindCraft independently
  landed on the same bar (`GATE_A_MIN_AVG = 8.5`), now used by the prose,
  discussion, and sim gates alike.
- What his tooling does NOT have (MindCraft's edge, don't import): per-student
  mastery state, misconception detection, adaptive assessment.

Key McCreary structural point for THIS plan: in his MicroSim corpus the *sim is
the unit of content* — `index.md` is a thin wrapper (iframe + objectives +
lesson plan) around the interactive artifact. That is the shape "sim-facing
first, very few texts" asks for, and the current prose prompt inverts it.

---

## Problem 1 — plan (sim-first, low-text, image-backed chapters)

Ordered contracts. P1-C1/C2 are the core; a coding agent can ship them without
the others. All generation-prompt changes live in **mindcraft-content-engine**
(deployed via its own HF Space push), the schema change touches both repos, the
client change is Product lane.

### P1-C1 — invert the prose prompt (content-engine)

File: `scripts/generate_concept_prose.py`.

Replace the length requirement in `GENERATION_PROMPT` ("300-600 words of prose,
3-6 paragraphs … not a slide") with a sim-first contract, e.g.:

> - 80–180 words of prose, 2–3 short paragraphs, written TO the student.
>   The prose's job is to set up the ONE mechanism the section teaches and
>   hand the student into the interactive piece — not to be the lesson by
>   itself. State the mechanism, give the single worked example (with real,
>   correct numbers — the sim will use these as its starting state), stop.
> - Then add a `===VISUAL===` section: 2-4 sentences specifying the ideal
>   visual for this concept — what an interactive sim should let the student
>   manipulate, or (if the concept is not simulatable) what a single static
>   diagram/illustration must show. Concrete: axes, quantities, what changes
>   when the student acts.

Mechanics:
- Add `VISUAL` to `MARKERS`, parse it in `parse_prose`, carry it on the record
  as `visual_spec`. It becomes the input to P1-C2 (sim brief) and P1-C4
  (image prompt) — one authored intent, two renderers.
- Keep every factual-discipline rule and the claim audit unchanged: fewer words
  = fewer claims = the audit gets *stronger*, not weaker.
- Update `PROSE_RUBRIC` in the same commit (gate and prompt must move together):
  - `explanatory_quality` 20: reword bands so "teaches the mechanism concisely
    and hands off to the visual" is the 20-band; drop the anti-stub framing.
  - `clarity_flow` 10: bands reference the setup → mechanism → example →
    handoff arc at 2-3 paragraphs.
  - Add `brevity_discipline` 10 (take 5 from `concreteness`, 5 from
    `clarity_flow` or rebalance to keep 100): 10 = every sentence earns its
    place, ≤180 words; 0 = re-grown text wall.
- Version bump `PROMPT_TEMPLATE_VERSION` (serve.py) — training capture already
  records it per job.
- **Calibration run before deploy** (this pipeline's own established habit):
  regenerate the 7 `CONCEPT_SPECS` + `--with-controls`; both controls must
  still fail; require yield within ~10 pts of the current run. The blatant
  control's prose is 5 paragraphs — expect its non-accuracy scores to drop
  under the new rubric; that's fine, only accuracy machinery must be what
  kills it (re-check the run log states that).

### P1-C2 — arm the live sim path with what already exists (content-engine)

File: `serve.py`, function `_process` inside `_run_book_job` +
`_maybe_generate_sim` signature.

1. Pass the gated prose as the companion brief:
   `_maybe_generate_sim(..., prose_brief={"title": prose["title"], "body": prose["body"] (+ visual_spec)})`
   → forward to `generator.generate(concept, few_shot, prose_brief=...)`.
   Zero new machinery — `_PROSE_COMPANION_BLOCK` and the `prose_brief` plumbing
   already exist and are already used by the cron companion path.
2. Load the real few-shot corpus instead of `[]`: reuse
   `dataset_assembler`/`schema.SimulationExample` load of the extracted
   McCreary sims (respect `licensing.training_safe()` — serving generated-from
   content counts; Dan's advisor authorization covers his corpus). Cache the
   loaded list at module import so it's free per job.
3. One retry on gate failure: if `fail_stage ∈ {render, rubric, vision_gate}`,
   regenerate once with the fail reason appended to the prompt ("previous
   attempt failed the visual gate because: …"). Cap: 1 retry, add the same
   $0.20/$0.05 estimate per attempt. Expected effect: sims-per-book from ~2/4
   toward ~3-4/5 for low single-digit cents (BYOK) or ~$0.40/book (Anthropic).
4. Keep `fit_check` as-is — its no-verdict is real signal ("Introduction to
   Information Systems" rendered blank at 95/100 structural). Sim-unfit
   concepts are the image path's job (P1-C4), not a forced bad sim.

### P1-C3 — schema: give images a place to live (both repos)

- `book_assembler.AssembledSection` + `to_dict()`: add
  `image_url: str | None`, `image_caption: str | None`, `visual_spec: str | None`
  (spec kept for provenance/regeneration). Assembly stays a non-generation
  stitcher — the image is produced upstream and passed in like sims are.
- `webhook` (`generate-book.ts`): nothing — it persists `raw.result` book
  as-is; new keys ride along. Confirm the PR1 strip-list doesn't eat them
  (it strips only the five named top-level capture keys — it won't).
- iOS `AssembledBookModels.swift` + `BookReaderView.swift`: decode + render.
  Page order per the 2026-08-23 direction: title → summary → short body →
  sim bridge → sim (centerpiece) → OR image+caption when no sim. AsyncImage or
  base64-inline; sizing follows the existing width-derived-aspect pattern the
  sim WebView already uses.

### P1-C4 — image generation, cheapest-first ladder

For each gate-passed section with **no** passing sim (and optionally as a
header visual for sim sections later):

1. **Tier 0 — deterministic SVG where the concept is chart-shaped.** Many math
   visuals (number lines, coordinate graphs, area models) don't need a
   diffusion model; a small server-side SVG composer from `visual_spec`
   keywords is free, instant, and never hallucinates labels. Precedent:
   `generateConceptArtSvg.mjs` + the deferred "GeoGebra/Desmos figure
   generation" build note in CLAUDE.md. Don't over-build: start with 3-4
   templates (number line, xy-plot, labeled shape, bar/table).
2. **Tier 1 — Gemini image model on the student's BYOK key** (fits the existing
   BYOK architecture exactly: student key generates, MindCraft judges).
   `gemini-2.5-flash-image`-class REST call mirroring `GeminiApiGenerator._complete`;
   ~ $0.04/image on paid tier, $0 platform on student quota. Prompt = fixed
   style formula (borrow the byte-identical-style-suffix trick from
   `generateConceptArt.mjs`) + `visual_spec` + "label only these terms: …"
   (labels drawn from the section's own terminology to limit gibberish text).
3. **Gate it like everything else**: run the existing `VisualQualityGate`
   (it already sends a PNG to Claude vision with visual + pedagogy questions)
   on the generated image with the section label + `visual_spec`. Fail → the
   section ships text-only, exactly today's behavior. No ungated pixels reach
   a student — same both-or-nothing stance as sims.
4. Storage: inline base64 in the book doc is simplest and matches the
   self-contained `sim_html` precedent; Firestore's 1 MiB doc limit means
   compress to ~100-200 KB JPEG/WebP per image and cap images/book, or move to
   Cloud Storage + URL if books grow. Decide at implementation; start inline.

Explicitly rejected: per-question live image gen (re-litigates the ratified
§5.4 decision), and platform-billed Higgsfield in the serving path (CLI-shaped,
manual-auth, wrong for a server; keep it for the offline concept-art library).

### P1-C5 — knock-on updates (same commit family, don't forget)

- `_DECOMPOSE_PROMPT`: unchanged 4-6 concepts (pagination is fine; the wall
  was per-page word count, not page count).
- Discussion fallback: unchanged.
- Cost estimates in `_process`: add image-attempt estimate (~$0.05 platform /
  ~$0.01 BYOK-judge-only) so `recordActualSpend` stays honest.
- The cron/batch prose path (`generate_subject_prose.py`, book packs) shares
  `GENERATION_PROMPT` — the McCreary-graph nightly books get the new shape
  automatically. Existing cached `assembled_books` docs are NOT regenerated;
  they refresh only on regeneration (fine — library reuse beats retroactive
  consistency; note it so nobody files "old books still wordy" as a bug).

---

## Problem 2 — the "scattered right side" (findings)

### 2.1 What a bridge actually is

`ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`,
top-level `bridges[]`: **9 groups** keyed `from_concept`/`to_concept`, each
holding 1-3 ingredient-level records — 16 total:

```json
{ "from_concept": "fractions_decimals", "to_concept": "ratios_proportions",
  "bridges": [ { "from_ingredient_id": "fractions_decimals__part_whole_meaning",
                 "to_ingredient_id": "ratios_proportions__ratio_as_comparison",
                 "bridge_description": "...", "card_hint": "...", "difficulty": 0.45 } ] }
```

Mechanically, a bridge is load-bearing in four places:
1. **It IS the concept graph.** `loaders/complete_ontology_loader.py`
   `_derive_concept_edges`: prerequisite edges are *derived* from (a) bridge
   groups (strength = mean bridge `difficulty`) and (b) cross-concept
   ingredient `comes_from` refs (strength 0.7). No authored bridge + no
   cross-ref = no edge = a literal dot.
2. **Priors.** Each derived edge seeds a Beta-Binomial prior
   (`engine/edge_weights.py`, prerequisite = 20 pseudo-counts) in every
   student's graph.
3. **Runtime diagnosis.** `engine/ingredient_runtime.py` backtracks prereqs via
   bridges and flags weak bridges at 1.5× node priority;
   `api/recommend.py:_detect_bridge_gaps` emits C1 `severity` gaps that
   `worstWeakness()` can pick. **No bridge record → that student failure mode
   is invisible** — the engine can never say "you know both sides but can't
   connect them" for an unbridged pair.
4. **Pathfinder.** `/recommend` curriculum chains walk derived edges; unbridged
   regions produce short/empty chains.

### 2.2 Empirical diagnosis — the founder is (mostly) right, and it's a data gap

The Map (`KnowledgeMapView.swift`, ported from the web explorer) is **not** a
force-directed layout: x/y are the real PCA projections served by
`GET /knowledge-graph/{id}` (`ml/serve.py:knowledge_graph_endpoint`). PC1 =
algebraic/symbolic (left, negative) ↔ applied/geometric (right, positive). So
"left vs right" is semantics, not chance.

Measured against the live cache (`ml/data/concept_embeddings.npz` +
`pca_axes.npz`) and the loader's 68 derived edges:

- **Left of median PC1: mean degree 4.05. Right: 2.43.**
- Every concept with degree ≤1 except `logarithmic_functions` sits at PC1 > 0:
  `number_properties` (0 — the known true orphan), `matrices`,
  `complex_numbers`, `inferential_statistics`, `conic_sections`, `vectors`,
  `right_triangle_geometry` (1).
- All **9** bridge groups lie on one algebra→trig→calculus spine. **26 of 42
  concepts appear in no bridge group at all** — including the entire
  statistics/probability branch, all of geometry beyond right triangles
  (`lines_angles`, `triangles_congruence`, `circles_geometry`, `area_volume`,
  `geometric_transformations`), `measurement_units`, and both cross_cutting
  concepts (`representation_translation`, `act_strategy`).

Two real amplifiers on top of the data gap (secondary, not the cause):
- **Personal-graph sparsity**: `/knowledge-graph` returns the *student's* graph —
  ontology-prior edges plus per-student `discovered` co-occurrence edges
  (α=β=1). Students study the ACT algebra spine, so discovered edges also
  accumulate on the left. An untouched right side has only its thin priors.
- **`isMajorEdge` filter** (iOS + web): hides prerequisite edges ≤0.25 weight
  and any other relation ≤0.45. Bridge-derived edges (weight ≈ difficulty,
  0.4-0.55) and comes_from edges (0.7) survive; fresh `discovered` edges (0.5)
  sit right at the second threshold and can flicker out.

**Verdict:** a real bridge/edge authoring gap in the ontology, rendered
faithfully — not a layout bug, and only mildly worsened by personal-graph
sparsity. Fixing rendering would repaint the symptom; the data is the disease.

### 2.3 Candidate signal check — the tools for finding gaps already exist

Ran the obvious detector as a feasibility probe (no writes):

- **S1 — embedding proximity** (384-dim cosine on the cached vectors, not the
  4-axis PCA): the 9 existing hand-authored bridge pairs score 0.40-0.64.
  Top no-edge pairs land in the same band and cluster exactly in the sparse
  region: `linear_equations↔measurement_units` .68,
  `fractions_decimals↔measurement_units` .65,
  `right_triangle_geometry↔triangles_congruence` .65,
  `triangles_congruence↔circles_geometry` .62,
  `circles_geometry↔geometric_transformations` .61,
  `trigonometry_basics↔circles_geometry` .61, `lines_angles↔vectors` .57,
  `geometric_transformations↔vectors` .56 …
- **S2 — Layer 2 archetype evidence** (real exam co-requirements, not vibes):
  51/84 archetypes carry `bridge_concept_ids`. Top co-required pairs with no
  Layer-1 bridge: `linear_equations↔representation_translation` (7 archetypes),
  `area_volume↔representation_translation` (6),
  `fractions_decimals↔measurement_units` (3), `area_volume↔measurement_units`
  (3), `basic_equations↔order_of_operations` (3).
- The two signals **cross-validate** (e.g. `fractions_decimals↔measurement_units`
  is high on both) — a ranked intersection is defensible, not hand-wavy.
- **S3 (later, live evidence)**: aggregate per-student `discovered` edges whose
  posterior moved above the 0.5 prior across students = pairs real students
  already co-fail/co-study. Requires reading student graphs (Firestore),
  strictly read-only, and n is small today — design it in, don't block on it.

### 2.4 Why auto-writing bridges would corrupt the algorithm (be precise)

- A merged bridge instantly mints a **prerequisite edge with a 20-pseudo-count
  prior** in every student graph at next rebuild — wrong direction or wrong
  pairing takes a mountain of contrary evidence to unlearn (that asymmetry is
  by design: "prerequisite edges are domain facts").
- Pathfinder chains re-route through it: `trim_chain` can start demanding
  remedial detours through a concept that isn't actually enabling.
- `_detect_bridge_gaps` starts emitting severities for it → `worstWeakness()`
  can redirect a student's practice on a hallucinated connection.
- Bridges are *directed enabling relations at the ingredient level* — embedding
  similarity is symmetric and concept-level; it can nominate, it cannot author.
  Direction, ingredient pair, description, card_hint, difficulty are judgment
  calls. This is Blake's lane (`ml/**`), flagged as such in CLAUDE.md.

---

## Problem 2 — plan (propose, never auto-commit)

### P2-C1 — `propose_bridge_candidates.py` (new, read-only, propose-only)

Location: `ml/scripts/propose_bridge_candidates.py` (Engine lane — ship as its
own clearly-labelled commit per lane rules; it never touches serving code).
Rerunnable script per repo convention, stdlib + numpy + existing loaders only.

**Inputs (all read-only):** Layer-1 ontology JSON, `concept_embeddings.npz`,
Layer-2 archetypes JSON.

**Pipeline:**
1. Build the existing-edge set exactly as the loader does (import
   `_derive_concept_edges` — no re-implementation drift).
2. S1: cosine on 384-dim embeddings for all no-edge pairs; keep pairs ≥ the
   min similarity of existing bridge pairs (empirically 0.40).
3. S2: archetype co-requirement counts per pair (primary×bridge +
   primary×primary), joined on canonical ids.
4. Rank: `score = z(sim) + 2·z(archetype_count)` — exam evidence weighs double;
   flag the cross-validated subset. Tag each pair `same_cluster` /
   `cross_cluster` from PC1/PC2 sign so genuinely cross-domain candidates
   ("intersections") are visible, not drowned by near-neighbor pairs.
5. **LLM drafting pass (draft ≠ decide):** for the top ~20, one Claude call per
   pair proposing a full bridge record in the exact ontology shape —
   `direction + from_ingredient_id + to_ingredient_id + bridge_description +
   card_hint + difficulty` — with ingredient ids validated against the *nested*
   ingredient list (not `canonical_registries`, which lags at 167/179), plus an
   honest `NOT_A_BRIDGE` option ("similar but not enabling") with reason.
   Anchored-judge style prompt; reuse content-engine's band pattern.
6. **Dry-run safety check per candidate:** simulate adding the derived edge and
   run cycle detection over the 68+1 edge set (port the trivial Kahn check —
   or content-engine's `graph_validator.py`, zero-dep by design). A candidate
   that creates a cycle or duplicates an existing group is dropped with reason.

**Output (the ONLY writes):**
- `agent_work/engine/BRIDGE_CANDIDATES_REVIEW.md` — ranked table for Blake:
  pair, both signal values, cluster tag, drafted record, dry-run result, and a
  yes/no/edit checkbox per row.
- `agent_work/engine/bridge_candidates.json` — the drafted records, mergeable
  by hand after review.

**Hard guardrails (assert in code, state in the file header):**
- Never opens `01_*.json` for writing; asserts output paths are under
  `agent_work/`.
- Never calls any serving endpoint; no Firestore writes.
- The review file's header states: merging any record is a human edit to the
  ontology by Blake, followed by the standard checks
  (`ml/scripts/end2end.py` 85/85, `audit_act_ontology_question_bank.py`) and a
  normal deploy — the same discipline as any Layer-1 edit.

### P2-C2 — merge protocol (Blake-owned, document only)

Written into the review file, not automated: accept/edit/reject per row; on
accept, hand-paste into the ontology's `bridges[]` (or a new group), bump
`meta` version, rerun end2end + the loader edge count check
(68 → 68+n, no cycles, orphan count monotonically non-increasing —
`number_properties` should be the first orphan a new bridge rescues).
Suggested first batch: **≤5 bridges, geometry cluster first** (highest
cross-validated scores, most visible on the Map's right side).

### P2-C3 — the two cheap amplifier fixes (safe, non-algorithmic, parallel)

- **Map**: surface the already-shipped `/knowledge-graph` bridge-gap fields
  (`isBridgeGap`, `bridgeEvidence`, `severity` — in the payload since rev
  00014, consumed nowhere per CLAUDE.md "Bridge-gap fields not in UI"): render
  detected gaps as dashed "weak link" edges. Product lane, no engine change,
  makes real bridge weaknesses *visible* instead of scattered-dot ambiguity.
- **Layout honesty**: leave `isMajorEdge` thresholds alone (the hairball trim
  is deliberate), but exempt `relation == "discovered"` from the 0.45 bar at
  low zoom OR badge sparse regions with "not yet mapped" copy so sparseness
  reads as roadmap, not breakage. Small, reversible, Product lane.

### Explicitly out of scope (don't let an agent talk itself into it)

- Auto-inserting edges/bridges into the ontology or any student graph.
- Changing `PRIOR_PSEUDO_COUNTS`, decay, strength scoring, or pathfinder trim.
- Ontology-wide re-derivation of edges from embeddings ("let the model draw the
  graph") — that replaces Dan's authored-fact model with similarity soup, the
  exact corruption the founder vetoed.

---

## What I'd build first (leverage ÷ risk)

1. **P1-C1 + P1-C2 together** (content-engine: prompt+rubric inversion, wire
   `prose_brief` + real few-shot + 1 sim retry). Directly answers the voice
   complaint; the companion machinery already exists; calibration harness
   already exists; cost delta ≈ cents/book on BYOK. Risk: gate-yield drift —
   bounded by the mandatory control-run before deploy.
2. **P2-C1** (`propose_bridge_candidates.py` + review file for Blake). Zero
   algorithm risk by construction, ~a day of work, and it converts the
   "scattered right side" from a complaint into a reviewable, ranked worklist.
   Send Blake the 3-line ask with the geometry-cluster top-5.
3. **P1-C3 + P1-C4 Tier 0→1** (image slot in schema + SVG composer, then BYOK
   Gemini images behind the existing vision gate). Ship after 1 so images fill
   only the genuinely sim-unfit sections; Tier 0 alone already de-walls most
   math pages.
4. **P2-C3** (render bridge-gap fields on the Map). Small Product-lane win;
   pairs well with announcing the first merged bridges.
5. **iOS BookReaderView image rendering** (the P1-C3 client half) — trivial
   once the schema lands; keep the 2026-08-23 "explain the sim" ordering.

Dependencies: 3 needs 1's `visual_spec`; 5 needs 3; 2 and 4 are independent of
everything else. Nothing here blocks on Anthropic credits for the *homework*
service (separate outage) — the content-engine runs on its own key/Bedrock/BYOK
paths.
