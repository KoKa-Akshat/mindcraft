# MindCraft

AI-powered tutoring platform. Pairs high school students with college tutors,
captures session data, builds a per-student knowledge graph, and drives
personalized recommendations.

This repo has several parts:
- `ml/` — Python ML engine = the `mindcraft-ml` Cloud Run service (concept +
  ingredient recommendation engine, FastAPI). Built by Blake.
- `app/` — React frontend (Vite + TS). Deploys to **Firebase Hosting**
  (`mindcraft-93858.web.app`), not Vercel anymore.
- `homework/` — a SEPARATE FastAPI service `mindcraft-homework` (LLM/Anthropic
  problem solver) deployed to Cloud Run in project `mindcraft-93858`. Powers the
  homework/practice cards. Stateless (no Firestore). Currently DOWN — Anthropic
  credits exhausted; the frontend falls back to `/recommend-ingredients`.
- `webhook/` — Vercel serverless functions (session-summary pipeline:
  Fireflies → Anthropic → ml `/process-summary`).

Two ML backends in TWO GCP projects (see Deployment). Cross-boundary bugs touch
all of this — it lives in one workspace.

---

## Architecture (two ML layers)

### Concept layer — "what to teach, in what order"
Operates on the 42-concept standardized ontology.

- **Ontology** (`ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`):
  42 concepts + nested ingredients + bridges + combinations, loaded via
  `loaders/complete_ontology_loader.py`. This is **Layer 1** of a 5-layer modular
  schema set (see "Data layers" below) and the ONLY layer the live engine loads —
  NOT the legacy `ml/data/ontology.json` (a stale 15/37-concept file). Concept ids
  are canonical slugs (`linear_equations`, `derivatives`, `functions_basics`…).
- **Mastery engine** (`ml/mindcraft_graph/engine/`): updates per-concept mastery
  from session events. Deterministic, not a learned NN.
- **Edge weights** (`engine/edges.py`): Beta-Binomial posteriors. Priors seeded
  from ontology (prerequisite=20, related=8, application=5, discovered=2
  pseudo-counts). Co-occurrence in session windows updates alpha/beta.
- **Strength scoring** (`engine/features.py`): asymmetric by outcome sign.
  Positive outcomes reward efficiency (outcome / (effort x time)). Negative
  outcomes reward conviction of weakness (outcome x effort x time) — high effort
  plus failure = confirmed weakness. Division is rejected for negatives because
  it amplifies casual low-effort failures.
- **Temporal decay** (`engine/decay.py`): evidence fades toward the prior, never
  past it. Mastery half-life 60d, edges 90d.
- **Embeddings** (`representation/embeddings.py`): 384-dim sentence-transformers
  (all-MiniLM-L6-v2), reduced to 4 PCA axes (~33% variance). Axes:
  PC1 applied/geometric <-> algebraic/symbolic, PC2 probabilistic/functional
  <-> trigonometric/spatial, PC3 calculus <-> statistical, PC4 analytic <->
  linear-algebraic.
- **Student embeddings** (`representation/student_embeddings.py`): two vectors —
  mastery-weighted centroid ("where studying") and strength-weighted signed
  centroid ("where performs well"). Displacement between them = learning
  efficiency direction (novel metric).
- **Pathfinder** (`planning/pathfinder.py`): extracts prerequisite chain from
  ontology, then trims via three-state classification — mastered (remove),
  struggling (always keep), unknown (presumed mastered only if chain successor
  is mastered; backward propagation NEVER overrides direct negative evidence).
  Exam / curriculum / explore modes.

### Ingredient layer — "how to teach a specific problem"
Operates one level below concepts. Built by Blake as a second architecture.

- Now lives INSIDE the standardized ontology file: **179 ingredients, 16
  bridges, 179 card templates, 15 combinations** across the 42 concepts. (The
  standalone `ml/data/ingredient_ontology.json` 5-concept pilot is legacy.)
- **Ingredients** = atomic mental models (4-6 per concept).
- **Bridges** = directed cross-concept enabling relations. Where students
  actually fail — they know both sides but can't connect them.
- **Combinations** = hyperedges of ingredients that fire together (`apply_order`).
  In the JSON they use the `ingredient_ids` field (the loader reads that).
- **Cards** = multi-representation scaffolds (geometric / algebraic /
  **procedural** — NOT "verbal", that was a stale style key), selected by style.
  NOTE: only the homework fallback currently renders these in the UI.
- **Runtime** (`engine/ingredient_runtime.py`): problem -> classify -> extract
  features -> select target ingredients -> backtrack prereqs via bridges ->
  build minimal DAG -> prune mastered -> detect weak bridges (1.5x priority over
  nodes) -> select styled cards -> topological order -> composition prompt.
- **Pipeline** (`engine/ingredient_pipeline.py`): `recommend_cards()` chains all
  runtime steps. One call: problem text in, ordered cards out.
- **Feedback**: ingredient mastery aggregates back to concept mastery via
  `aggregate_to_concept_mastery` (weighted by connectivity).

### Generative / deterministic split
Deterministic engine owns structural decisions (what to teach, diagnosis,
selection). LLM owns language (classify problem, extract features, render card
text). LLM is bookends, deterministic is the spine — prevents hallucinated
pedagogy.

---

## Data layers (the 5-layer modular ontology)
`ml/data/5_level_ontology/` is the target schema: five independently-versioned
JSON files, joined by a shared **canonical ID contract**, replacing the old
single-blob ontology. Each layer references the same IDs and may add context but
must NOT redefine core meanings (`meta.canonical_id_contract` in every file).

ID formats (the join keys across layers):
- `concept_id` — snake_case slug, e.g. `right_triangle_geometry`
- `ingredient_id` — `{concept_id}__{slug}`, e.g. `right_triangle__pythagorean_theorem`
- `archetype_id` — `act_{family}_{distinguishing_bridge_or_representation}`
- `question_instance_id` — `{exam}_{source_test}_{question_number}`, e.g. `act_test001_q010`
- `misconception_id` — `mis_{concept_or_archetype}_{short_error}`
- `solution_pathway_id` — `sp_{archetype_id}_{method_slug}`

The layers:
- **Layer 1 — Concept Ontology** (`01_…_v2_6_*.json`): 42 concepts (levels:
  7 foundational / 22 core / 11 advanced / 2 cross_cutting), 179 nested
  ingredients (each with `learning_vector` + 3-style `card_templates` = 537
  representations), 16 bridges (in 9 `from_concept`/`to_concept` groups), 15
  combinations, plus `act_prep_overlay`, `population_priors` (cold-start failure
  rates), and `canonical_registries`. **Two variants**: `…_standardized.json`
  (no combinations) and `…_with_combinations.json` (adds the 15 co-occurrence
  hyperedges) — serve.py loads the **with_combinations** one.
- **Layer 2 — Question Archetype Ontology** (`02_…_standardized.json`): 84
  archetypes — repeatable ACT/exam patterns that describe HOW exams hide/apply
  concepts. Each links `primary_concept_ids`, `required_ingredient_ids`,
  `bridge_concept_ids`, a `concept_path_template`, `difficulty_drivers`,
  `common_misconception_ids`, and `solution_pathway_templates`.
- **Layer 3 — Question Instance Bank** (`03_…_seed_v1_6.json`): 450 concrete
  question records (342 with full `intelligence`), each with `raw_question`,
  `source`, and `links` back to archetype/concept/ingredient/misconception IDs.
  Sourced from `MindCraft_ACT_Question_Bank.xlsm`.
- **Layer 4 — Student Learning State** (`04_…_schema_v1_6.json`): the *schema*
  (not data) for evolving per-student evidence — `student_state_schema`
  (concept/ingredient/archetype mastery, representation profile, misconception
  memory, calibration), `student_event_schema`, the learning-event graph, and
  `evidence_update_policy` (e.g. separate can-do from can-recognize; don't
  over-update from one question; recency weights).
- **Layer 5 — Adaptive Remediation Policy** (`05_…_v1_6.json`): diagnosis→action
  rules (14 `diagnosis_to_action_rules`), the `practice_generation_contract`
  (inputs/outputs/difficulty-ladder/guardrails), `next_best_action_contract`,
  and simulation hooks.

**Current reality**: only Layer 1 is wired into the live engine. Layers 2-5 are
the schema/data target — the runtime mastery model (`models/student_state.py`,
`engine/`) is its own thing and does NOT yet read Layer 4/5 schemas, and the
archetype/instance layers (2/3) are not loaded by serve.py. They ground the
past-paper → generated-questions workstream (see "Next big workstream") and a
future migration of the engine onto the richer per-student state.

---

## API (`ml/serve.py` — the `mindcraft-ml` service)
- `POST /recommend` — concept recs + PCA + `canonicalChain` + `unlocks`
  (reverse-prereq concepts). Used by the KnowledgeGraph page + LearningGPS.
- `POST /seed-assessment` — onboarding gap-scan (per-concept confidence) → seed
  events. REPLACES the prior seed (source=`onboarding_assessment`).
- `POST /record-outcomes` — practice/homework results → graph events (APPENDS,
  source=`practice`). The practice→mastery feedback loop.
- `POST /process-summary` — parse session summary → events, update graph.
- `POST /recommend-ingredients` — ingredient-level styled cards for a problem.
- `POST /submit-answer` — ingredient/bridge mastery → aggregate to concept.
- `GET /student-profile/{id}`, `GET /knowledge-graph/{id}` (returns ALL nodes),
  `GET /health`.

CORS must include `mindcraft-93858.web.app` + the Vercel domain. Firestore: a
bare `firestore.Client()` targets the (empty) Cloud Run project — the client is
pinned to `mindcraft-93858` via env `FIRESTORE_PROJECT`. Firestore returns
tz-aware datetimes; `firestore_adapter._to_naive()` normalizes them (the engine
is all naive datetimes — mixing them raises).

---

## Deployment

### `mindcraft-ml` (engine) — Cloud Run, project `project-e4af30ac-bc17-4691-8b6`
- Build: `gcloud builds submit --tag us-central1-docker.pkg.dev/project-e4af30ac-bc17-4691-8b6/mindcraft-ml/mindcraft-ml`
- Deploy: `gcloud run deploy mindcraft-ml --image [same] --region us-central1 --memory 1Gi --cpu 1 --min-instances 0 --max-instances 3 --allow-unauthenticated --set-env-vars FIRESTORE_PROJECT=mindcraft-93858`
- **MUST pass `--set-env-vars FIRESTORE_PROJECT=mindcraft-93858`** or it talks to
  the wrong (empty) project's Firestore. The Cloud Run SA was granted
  `roles/datastore.user` on `mindcraft-93858`.
- URL `https://mindcraft-ml-630302850770.us-central1.run.app` (stable lately).
  Latest **deployed** rev `00009`. Local commits beyond `00009` (displacement
  persistence + bridge-gap detection) have NOT been built/deployed — run Cloud
  Build + `gcloud run deploy` with `FIRESTORE_PROJECT=mindcraft-93858` to push
  them live. The Dockerfile bakes embeddings from the standardized ontology; the
  cache self-invalidates at startup if it doesn't match.

### `mindcraft-homework` (LLM solver) — Cloud Run, project `mindcraft-93858`
- Code in `homework/`. Secret `ANTHROPIC_API_KEY`. Stateless. Down on credits.

### Frontend — Firebase Hosting, project `mindcraft-93858`
- Build: `cd app && npm install --legacy-peer-deps && npm run build`
  (`--legacy-peer-deps` is REQUIRED — a `@react-three` peer conflict otherwise).
- Deploy: `firebase deploy --only hosting:app --project mindcraft-93858`.
  The firebase CLI must be logged in as an account with access to
  `mindcraft-93858` (`blakeykell@gmail.com` was granted `roles/firebase.admin`).
- Live `https://mindcraft-93858.web.app` (root redirects to /landing.html; the
  app serves via SPA rewrites). `app-beta-one-59.vercel.app` also exists but
  Firebase Hosting is the active host.
- Vite env: `.env.production` → Cloud Run URL (baked at build), `.env.local` →
  `localhost:8080` (so LearningGPS/graph need the local ML server for local dev).
  Also `VITE_HOMEWORK_API_URL` → the `mindcraft-homework` URL.

### Firestore — project `mindcraft-93858`
- The real DB (users, sessions, interactions, ingredient_states,
  knowledge_graphs, recommendations). Frontend + webhook + ml all use it.
- Indexes deployed: `interactions(studentId, timestamp)` + 4 on `sessions`. New
  query shapes may need new composite indexes.
- Rules let a user write their own `users/{uid}` doc — used for the diagnostic
  flag + practice draft (`lib/practiceState.ts`).

---

## Local dev
- ML venv is named `mindcraft/` (not `.venv`), inside `ml/`. Package installed
  via `pip install -e ".[dev]"`.
- Run ML server: `cd ml && source mindcraft/bin/activate && uvicorn serve:app --host 0.0.0.0 --port 8080`
- Run frontend: `cd app && npm run dev` (serves on 5173)
- Tests: `cd ml && python scripts/end2end.py` (63/63 on the standardized
  ontology). Card-path harness: `python scripts/test_concept_paths.py
  --complete-ontology ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json
  --questions ml/data/sample_questions/first_15_questions.csv`.

---

## Current state (deployed & working)
- Standardized 42-concept ontology live; `mindcraft-ml` rev `00009`.
- Firestore connected (`mindcraft-93858`). Test student WITH data:
  `gBFn9vUGIIa7tAiTTQSl8CbPSao2` = `shreeyutk@gmail.com` (events backfilled).
- **The learning loop is wired end-to-end**: onboarding gap-scan →
  `/seed-assessment` → graph; practice/homework completion → `/record-outcomes`
  → graph; LearningGPS + recommendations adapt.
- **Diagnostic-first**: Dashboard routes a student without `diagnosticCompleted`
  (on their `users` doc) into the gap-scan before the dashboard. Progress
  persists to Firestore via `lib/practiceState.ts`. Tutors/admins exempt.
- **LearningGPS** is fully `/recommend`-driven (path + unlocks from server; no
  frontend prereq map). Mounted at `/learning-gps`; ConstellationCard at
  `/constellation`; both have Dashboard cards.
- **Homework help** falls back to `/recommend-ingredients` (deterministic
  ingredient cards) when the LLM solver fails — which it does now (no credits).
- **Warm-ping + shared graph cache**: `App.tsx` fires `GET /health` on auth to
  wake Cloud Run before LearningGPS auto-loads (`mlWarmed` flag prevents
  double-firing). `lib/graphCache.ts` caches the in-flight
  `/knowledge-graph/{uid}` promise per user — LearningGPS and the Knowledge
  Graph page share one fetch; failures not cached; `invalidateKnowledgeGraph`
  called after any mastery-mutating operation (seed-assessment, record-outcomes).
- **main** is fully reconciled and pushed (`b8a05e14`). `feat/ontology-firestore-practice-loop`
  is identical to main and can be deleted.
- **Co-founder's agentic layer** (`ml/mindcraft_graph/models/learning_world.py`,
  `loaders/subject_graph_loader.py`, `ml/data/subject_graphs/*.json`,
  `ml/serve.py` endpoints for `/agent/*`) exists in the repo but is NOT wired
  into the live `serve.py` — all eight agentic endpoints were intentionally
  excluded when resolving the merge conflict (we took our `serve.py` entirely).
  Dead code only; safe to ignore or delete later.

## Known gotchas / open items
- **Anthropic credits exhausted** → `mindcraft-homework` + dynamic question gen
  return 400. Homework uses the ingredient-pipeline fallback meanwhile.
- Existing students lack the `diagnosticCompleted` flag → get sent through the
  diagnostic once (by design; backfill the flag if undesired).
- Practice questions come from `app/src/lib/questionBank.ts` (495 static) +
  dynamic gen via the Vercel webhook
  `mindcraft-webhook.vercel.app/api/generate-questions` (gated by
  `VITE_ENABLE_DYNAMIC_QGEN`).
- `HomeworkProgress.tsx` / `LastSession.tsx` are unused (possibly intended).
- **mindcraft-ml undeployed changes**: displacement persistence
  (`append_displacement_snapshot`) and bridge-gap detection (`isBridgeGap`,
  `bridgeEvidence` fields on knowledge-graph nodes) are committed locally but
  NOT yet live (still rev `00009`). Needs a Cloud Build + deploy.
- **Bridge-gap API fields not consumed by UI**: `isBridgeGap` / `bridgeEvidence`
  are in the `/knowledge-graph` response and persisted to Firestore, but no
  frontend component renders them. Natural next pieces: tutor "blockers" view
  (list weak bridges per student) and a displacement-over-time chart.
- **Audit `/student-profile` consumers**: the endpoint was silently returning
  `masteryProjection == strengthProjection` (bug — both returned the same
  vector) before a recent fix. Grep the frontend for callers to check whether
  any UI logic accidentally compensated for the identical values.
- **Tutor view**: tutors have no student events, so the graph is empty for them.
  Needs a student-selector in the tutor view (still open).
- **Concept-layer pathfinder** on the 42-concept ontology was spot-checked and is
  SOUND — prereq chains are semantic (derived from bridges + ingredient
  `comes_from`), NOT array-position artifacts (the old worry). Minor: edge
  `typical_order` = concept array index (affects only the difficulty estimate),
  and a few concepts are prereq-roots (e.g. `right_triangle_geometry` has no
  prereqs). A broader eyeball across all 42 is still worthwhile, not urgent.
- **Recall headroom** (~0.19 on the 15-question harness) is ingredient-tag /
  path-step alignment — data work, not a mechanism bug.

### ML-quality backlog (concept/ingredient engine, not blocking the product)
- Scale the card-path harness from 15 → ~50 tagged questions (keep ≤50 so each
  result stays eyeball-readable) to test whether gains generalize.
- Multi-concept classification: human paths span multiple concepts; let
  `secondary_concepts` contribute target ingredients GATED by a confidence
  threshold, and report precision AND recall AND order (widening the active set
  inflates recall while tanking precision — watch both).
- Classify against richer fields (`question_patterns`) rather than the concept
  description — ties into the past-paper embedding work.
- Possible refactor: split the standardized file into `concepts.json` +
  `ingredients.json` sharing ONE canonical ID space (removes any alias-map need).

## Next big workstream — past-paper → generated questions
GOAL (Blake): embed past papers → extract the "essence" → generate questions
from that + a template → condense a group of concepts into fewer questions. This
replaces/grounds the `generate-questions` webhook. Data lives in
`ml/data/sample_questions/` (ACT bank CSV, `TEMPLATE.json`) and
`ml/data/past_papers/`. Needs Anthropic credits. **Start this in a NEW chat.**

## Designed, not built
- Problem decomposition (invariant skeletons) — feeds ingredient runtime.
- Confidence-gated card routing (4 tiers).
- Interactive cards (Desmos/GeoGebra) in the geometric card representation.

---

## Style / conventions
- Pydantic models with `Field(default_factory=...)` for mutable defaults.
- Deterministic engine: no randomness, fully auditable. Keep it that way.
- When adding an ontology concept, also add its prerequisite edges so concept-
  level propagation works from `/submit-answer`.
