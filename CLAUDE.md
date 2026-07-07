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

## Collaboration — canonical spec documents (READ BEFORE TOUCHING THESE AREAS)

These files are the authoritative design + architecture contracts. Read them
before working in their respective areas. Do not override their decisions
without a team discussion first.

| File | Owns |
|------|------|
| `WORLD_VISION.md` | **THE WHY — read first.** Math as a world: stories, proven questions, tutor support. Three-horizon roadmap. Every feature should move toward this. |
| `BRAND_BOOK.md` | Voice, copy, student archetype (Maya), emotional framing, what NOT to say |
| `AGENT_RULEBOOK.md` | Every LLM call contract: input/output schema, fallbacks, latency budgets, model selection, what agents CAN and CANNOT do |
| `DASHBOARD_NOTEBOOK_SPEC.md` | Field Journal dashboard: paper system, layout, typography, motion, PawHub replacement spec |
| `FABLE5_VISION.md` | Frontend product/design spec (Product lane): design tokens, cluster colors, area briefs |
| `CODEX_BRIEF.md` | Implementation briefs for AI coding agents (Codex/Cursor) |

### Shared product conventions (all agents)

- **Naming**: the three student sections are **Notes**, **Solver**, **Map** —
 everywhere (nav, tabs, panel titles, buttons). Not "Session Notes" / "Problem
 Solver" / "Knowledge Map" / "GPS" in student-facing copy.
- **Story-first questions**: practice/chapter questions should live INSIDE the
 concept's story world (story-module reskin, context frames), never a scene
 followed by an unrelated textbook ask. The math is frozen; the narrative wraps
 it. Characters have full backstories but students see only the basics — the
 world reveals itself as mastery grows (see `WORLD_VISION.md` Horizons).
- **Modularity**: data clearly labeled and stored in its layer (bank JSONs in
 `app/src/data/`, ontology in `ml/data/5_level_ontology/`, generated content
 caches out of git). New pipelines should be rerunnable scripts, not one-offs.

### Lane ownership — prevents AI agent collisions

Two lanes own **disjoint** trees. Coordinate before crossing a lane boundary.

| Lane | Owner | Tree |
|------|-------|------|
| **Engine** | Blake | `ml/**`, `webhook/**`, `data/**`, `worlds/**` |
| **Product** | Akshat | `app/**`, `index.html`, `blog.html`, root marketing files |

Shared seam files (coordinate before changing):
- `app/src/lib/questionBank.ts` — question shape contract (C5)
- `app/src/lib/mlApi.ts` — API client
- `CLAUDE.md` — this file

### Git rules (critical — read every session)

1. **`git pull origin main` before any session.** Pull/merge if push is rejected — never force-push.
2. **End every session with `git push origin main` or a named stash** (`git stash push -m "description"`). Do NOT leave staged work uncommitted across sessions.
3. **CI auto-deploys on push to `main`.** Never run `firebase deploy` locally.
4. **ML deploy is manual** — see `Deployment` section. Always pass BOTH env vars.
5. **Stale lock files block git.** If git hangs: `rm .git/*.lock` then retry.

### Security — pre-marketing blocker

Privileged user fields are server-authoritative. Browser writes to
`users/{uid}` may create/self-heal ordinary student fields, but Firestore rules
block client changes to `role`, `childId`, `tutorId`, and `classroomId`.
Admin/tutor/parent grants must be written through Admin-SDK webhook paths
(`grant-admin`, `link-child`, `create-classroom`, `join-classroom`) or one-time
Admin SDK scripts. Keep `firebase/firestore.rules` deployed via the Rules API
helper in `webhook/scripts/deploy-rules.ts`; do not use local `firebase deploy`.

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
  ingredients (= 537 representations), 16 bridges (in 9 `from_concept`/
  `to_concept` groups), 15 combinations, plus `act_prep_overlay`,
  `population_priors` (cold-start failure rates), and `canonical_registries`.
  Per-**concept** record: `act_relevance`, `population_failure_prior`,
  `learning_style_affinity`, `cross_layer_links` (the explicit join surface —
  `common_question_archetype_ids`/`common_misconception_ids`/
  `recommended_remediation_policy_ids` + `diagnostic_axes`; mostly empty,
  populated as annotation grows), `node_type`/`status`/`aliases`. Per-**ingredient**
  record: `comes_from`, `failure_mode`, `failure_prior`, `learning_vector`
  (geometric/algebraic/procedural/conceptual), 3-style `card_templates`,
  `diagnostic_tags`, `canonical_misconception_family`, `observable_evidence`,
  `remediation_handles`. NOTE: `canonical_registries.ingredient_ids` lags at 167
  vs the 179 nested — join on the **nested** ingredient ids, not the registry.
  **Two variants**: `…_standardized.json` (no combinations) and
  `…_with_combinations.json` (adds the 15 co-occurrence hyperedges) — serve.py
  loads the **with_combinations** one.
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
  over-update from one question; recency weights). This layer defines the
  canonical **representation/format ("vessel") vocabulary** that the
  format-node work builds on: `student_state_schema.representation_profile`
  tracks per-format mastery over {`word_problem`, `diagram`, `number_line`,
  `symbolic_expression`, `coordinate_graph`, `table`}, and
  `student_event_schema.input_representation` ∈ {`word_problem`|`diagram`|
  `number_line`|`graph`|`table`|`symbolic`|`mixed`}. (L1
  `canonical_registries.representation_types` is the broader 13-type list.) The
  live `OutcomeItem`/questionBank carry NO format tag yet — that substrate is
  what the format-node feature has to add.
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
- `POST /recommend` — **one endpoint, two consumer extractions** (see below).
  Returns `canonicalChain`, `unlocks`, `recommendations[]` (trimmed path +
  supplements + bridge/format gaps), and `studentProfile` (PCA projections,
  `topStrengths` / `topWeaknesses`). Used by PawHub, Knowledge Graph path panel,
  and ReinforcePanel.
- `POST /seed-assessment` — onboarding gap-scan (per-concept confidence) → seed
  events. REPLACES the prior seed (source=`onboarding_assessment`). Each rated
  concept gets one synthetic `assessment` event (`hard`/`kinda`/`easy` → outcome
  + effort map in `serve.py`). This is **not** the pathfinder — it seeds the
  graph so `/recommend` can read weaknesses before real practice exists.
- `POST /record-outcomes` — practice/homework results → graph events (APPENDS,
  source=`practice`). The practice→mastery feedback loop.
- `POST /process-summary` — parse session summary → events, update graph.
- `POST /recommend-ingredients` — ingredient-level styled cards for a problem.
- `POST /submit-answer` — ingredient/bridge mastery → aggregate to concept.
- `GET /student-profile/{id}`, `GET /knowledge-graph/{id}` (returns ALL nodes;
  `eventCount` + `status` per node — `untouched` ⇔ `event_count === 0`),
  `GET /exam-concepts/{exam}` — concept ids for an exam track (ACT →
  `act_relevance.tested` from Layer 1; ~29 concepts),
  `GET /health`.

### `/recommend` modes (pathfinder)
- **`curriculum`** — needs `target_concepts: [conceptId]` or returns an empty
  chain. Walks ontology prereqs → `canonicalChain`, trims mastered/struggling/
  unknown → `recommendations[]`. Bridge gaps injected mid-chain; format gaps
  appended after. Optional `exam` field scopes weakness filtering to the exam
  track (`act_relevance.tested` for ACT).
- **`exam`** — empty `target_concepts` defaults to **`act_relevance.tested`**
  concepts (not `high_priority_concepts`). Same trim, then exam-priority re-rank
  via `high_priority_concepts` + optional deadline budget (`deadline_days`).
  This is the **ACT prep roadmap**.
- **`explore`** — novelty/alignment picks (no prerequisite chain).

### Student app UX (`app/`)

**Shared chrome**
- **`AppTabBar`** (`components/AppTabBar.tsx`) — pill tabs on Dashboard,
  Practice, and Knowledge Graph: Dashboard | Practice | Problem Solver |
  Knowledge Map. Problem Solver navigates to `/practice` with `homeworkHelp` state.
- **`Sidebar`** (`components/Sidebar.tsx`) — fixed top nav (logo, Session Notes,
  Practice, Organize, Community, avatar/sign-out). Same on Dashboard, Practice,
  Knowledge Graph.
- **`HomeRedirect`** (`App.tsx`) — on localhost, `/` stays in the app; in
  production, `/` redirects to the marketing site.

**Dashboard — PawHub** (`components/PawHub.tsx` + `lib/recommendNextConcept.ts`)
Replaced the old card-based hub. Paw-shaped launcher driven by `/recommend`:

| Pad / toe | `/recommend` signal | Launch |
|-----------|---------------------|--------|
| **Practice** (main pad) | `studentProfile.topWeaknesses` (+ bridge-gap override) | `/practice` → **direct question session** |
| **Learn** (violet toe) | `mode: "exam"` → first 0-exposure, playable concept on ACT path | topic label only → **direct session** (L1 if never rated) |
| Homework Help | — | Problem Solver |
| GPS | — | `/knowledge-graph` |
| Notes | — | `/sessions` |

- **Weak spot** = observed weakness (gap-scan seed + practice + sessions), scoped
  to the student's diagnostic exam track via `GET /exam-concepts/{exam}`.
- **Learn next** = first `eventCount === 0` node on the trimmed exam path with
  static questions in `questionBank` (`hasPlayableQuestions`). Gap-scan ratings
  count as exposure — rated concepts won't appear as learn next.
- PawHub calls `launchMissionDirect()` in Practice — **skips the level picker**;
  level comes from gap-scan confidence (`bridgePractice.getRecommendedLevel`), or
  L1 for a fresh learn target.
- **Full topic path** (island map) is **not** on the dashboard — Practice → path
  view (“See all topics”) or Knowledge Graph → concept → “Your Next Route”.
- `/learning-gps` redirects to `/knowledge-graph`. `LearningGPS.tsx` and
  `/constellation` still exist but are not on the dashboard.

**Gap scan** (first-time + retake)
- Dashboard gates students without `diagnosticCompleted` (or legacy
  `diagnosticCompletedAt`) into Practice `examHelp` flow. Tutors/admins exempt.
- Flow: exam pick → per-concept confidence (concepts from
  `GET /exam-concepts/{exam}`, ~29 for ACT) → `/seed-assessment` → brief
  “Scanning your gaps…” → **`/dashboard`** (no castle / gap-analysis screen).
- `resetDiagnostic()` (`lib/practiceState.ts`) clears diagnostic flags + gapscan
  drafts; Admin **Testing** tab exposes “Retake gap scan”.
- **Level gating after scan**: `easy` → L3 only, `kinda` → L2, `hard` → L1
  (`lib/bridgePractice.ts`). Manual path explore still offers the level picker.

**Practice sessions**
- `evictQuestionCache()` + Fisher–Yates `shuffle()` in `questionBank.ts` so
  each new session draws a fresh random set (not the same cached questions).
- Per-mission drafts: `users/{uid}.practiceDrafts.{weakness|learn|gapscan}` +
  local fallbacks (`lib/practiceDrafts.ts`, `lib/practiceState.ts`).
- “New Mission” after a session returns to the **path view**, not gap scan
  (`returnToPath()`).

**ML client** (`lib/mlApi.ts`) — browser calls attach `Authorization: Bearer
<Firebase ID token>` via `mlAuthHeaders()`. Required once `ML_AUTH_ENABLED` is
on in Cloud Run.

**Admin** (`pages/Admin.tsx`) — **Testing** tab: retake gap scan, ACT ontology
vs question-bank coverage table (`lib/ontologyBankCoverage.ts` +
`data/actOntologyCoverage.json`; regenerate via
`ml/scripts/audit_act_ontology_question_bank.py`).

CORS must include `mindcraft-93858.web.app` + the Vercel domain. Firestore: a
bare `firestore.Client()` targets the (empty) Cloud Run project — the client is
pinned to `mindcraft-93858` via env `FIRESTORE_PROJECT`. Firestore returns
tz-aware datetimes; `firestore_adapter._to_naive()` normalizes them (the engine
is all naive datetimes — mixing them raises).

---

## Deployment

### `mindcraft-ml` (engine) — Cloud Run, project `project-e4af30ac-bc17-4691-8b6`
- Build: `gcloud builds submit --tag us-central1-docker.pkg.dev/project-e4af30ac-bc17-4691-8b6/mindcraft-ml/mindcraft-ml`
- Deploy: `gcloud run deploy mindcraft-ml --image [same] --region us-central1 --memory 1Gi --cpu 1 --min-instances 0 --max-instances 3 --allow-unauthenticated --set-env-vars FIRESTORE_PROJECT=mindcraft-93858,ML_SERVICE_SECRET=<secret>`
- **MUST pass `--set-env-vars FIRESTORE_PROJECT=mindcraft-93858`** or it talks to
  the wrong (empty) project's Firestore. The Cloud Run SA was granted
  `roles/datastore.user` on `mindcraft-93858`. `--set-env-vars` REPLACES the
  whole set, so include BOTH vars every deploy.
- **Auth** (`mindcraft_graph/auth.py`): every data endpoint requires either a
  Firebase ID token (browser; enforced `uid == student_id`, tutors/admins
  exempt) or `X-Service-Key == ML_SERVICE_SECRET` (the webhook, server-to-server).
  `/health` is public. `ML_SERVICE_SECRET` MUST match the value set in Vercel.
  Token verification is pinned to Firebase project `mindcraft-93858` (auth.py
  default). Local dev: `ML_AUTH_ENABLED=false`. Roll out callers (frontend push +
  Vercel env) BEFORE enabling on Cloud Run, or in-flight calls 401.
- URL `https://mindcraft-ml-630302850770.us-central1.run.app` (stable lately).
  Latest **deployed** rev `00009`. Local commits beyond `00009` (auth, displacement,
  bridge-gap detection, `exam-concepts`, `act_tested` exam-mode) have NOT been
  built/deployed — run Cloud Build + `gcloud run deploy` with both env vars.
  The Dockerfile bakes embeddings from the standardized ontology; the cache
  self-invalidates at startup if it doesn't match.

### `mindcraft-homework` (LLM solver) — Cloud Run, project `mindcraft-93858`
- Code in `homework/`. Secret `ANTHROPIC_API_KEY`. Stateless. Down on credits.

### Frontend + world + marketing — Firebase Hosting, project `mindcraft-93858`

**CI auto-deploys on every push to `main`.** Workflow: `.github/workflows/deploy.yml`.
It builds `app/` (`npm install --legacy-peer-deps && npm run build`) and deploys
Firebase Hosting targets `app`, `world1`, and `marketing` using the
`FIREBASE_SERVICE_ACCOUNT` repo secret.

**To ship frontend / world / marketing:** `git push origin main`. Live in ~2–3 min.
Confirm the Actions run is green. **Do NOT run `firebase deploy` from a laptop** —
manual deploys publish local disk and overwrite CI, clobbering other people's work.

Before work: `git pull origin main`. If push is rejected, pull/merge first — never
force-push `main`.

| Target | Source | Live URL |
|--------|--------|----------|
| `app` | `app/dist` (built in CI) | https://mindcraft-93858.web.app |
| `world1` | `worlds/world2/` (static) | https://mindcraft-world1.web.app |
| `marketing` | repo root (curated static) | https://mindcraft-marketing-site.web.app |

Key notes:
- `--legacy-peer-deps` is REQUIRED for app install ( `@react-three` peer conflict).
- Vite env: `.env.production` → Cloud Run URLs (baked at CI build). `.env.local`
  for local dev only. **Do not commit `.env.local` or secrets.**
- `firebase.json` `world1` ignores generated texture junk, `*_orig.ktx2`, `tools/`,
  and source maps — see `REPO_CLEANUP_AUDIT.md`.

### Firestore — project `mindcraft-93858`
- The real DB (users, sessions, interactions, ingredient_states,
  knowledge_graphs, recommendations). Frontend + webhook + ml all use it.
- Indexes deployed: `interactions(studentId, timestamp)` + 4 on `sessions`. New
  query shapes may need new composite indexes.
- Rules let a user write their own `users/{uid}` doc — used for the diagnostic
  flag, per-mission practice drafts (`practiceDrafts.{weakness|learn|gapscan}`),
  and gap-scan progress (`lib/practiceState.ts`, `lib/practiceDrafts.ts`).

---

## Local dev
- ML venv is named `mindcraft/` (not `.venv`), inside `ml/`. Package installed
  via `pip install -e ".[dev]"`.
- Run ML server: `cd ml && source mindcraft/bin/activate && ML_AUTH_ENABLED=false FIRESTORE_PROJECT=mindcraft-93858 uvicorn serve:app --host 0.0.0.0 --port 8080`
- `LLM_PROVIDER=groq` must be in `ml/.env.local` (alongside `GROQ_API_KEY`) — default is ollama which requires a local server on :11434.
- Run frontend: `cd app && npm run dev` → `http://localhost:5173` (`host: true`
  in `vite.config.ts` — use a normal browser tab; IDE embedded browsers often
  break Google OAuth).
- Point frontend at local ML: `app/.env.local` →
  `VITE_ML_API_URL=http://localhost:8080` (do not commit).
- Tests: `cd ml && python scripts/end2end.py` (85/85 on the standardized
  ontology). Card-path harness: `python scripts/test_concept_paths.py
  --complete-ontology ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json
  --questions ml/data/sample_questions/first_15_questions.csv`.
- ACT bank audit: `python3 ml/scripts/audit_act_ontology_question_bank.py` →
  refreshes `app/src/data/actOntologyCoverage.json`.
- Dashboard **3D** toggle opens `worldUrl()` (`mindcraft-world1.web.app` in prod;
  `localhost:3001` in dev — needs the world static server running locally).

---

## Current state

### Deployed (production `main` + Cloud Run rev `00014-xcf`, 2026-06-29)
- Standardized 42-concept ontology live. 85/85 end2end tests green.
- Firestore connected (`mindcraft-93858`). Test student WITH data:
  `gBFn9vUGIIa7tAiTTQSl8CbPSao2` = `shreeyutk@gmail.com` (events backfilled).
- **Learning loop**: gap-scan → `/seed-assessment` → graph; practice →
  `/record-outcomes` → graph; recommendations adapt.
- **Auth LIVE** (`ML_AUTH_ENABLED` defaults `true`; no override needed): every
  data endpoint requires Firebase ID token (browser) or `X-Service-Key` (webhook).
  `/health` public. Vercel webhook redeployed with `ML_SERVICE_SECRET`. Smoke
  checks passed: `/health` 200, unauthenticated data endpoints 401, correct
  service key passes auth.
- **Frontend shipped**: PawHub dashboard, AppTabBar pill nav (Dashboard | Practice
  | Problem Solver | Knowledge Map), direct-to-session from PawHub, worstWeakness
  selection (C1), format-tagged bank, hide-correctness diagnostic (C4), Admin
  Testing tab + ontology/bank coverage, ACT gap-scan fixes.
- **Diagnostic reconciled** — one diagnostic, one update mechanism:
  `Diagnostic.tsx` (kitchen-world onboarding, reached from "Click Me" in world)
  now POSTs to `/seed-assessment` (confidence) + `/record-outcomes` (probes, C4
  hide-correctness) + writes canonical `diagnosticCompleted: true`. `sendLearningEvent`
  deprecated. `actDiagnostic.json` probes carry `format` + `level` (C5).
- **Affective state check-in** (`webhook/api/agent-check-in.ts`): pre-session
  2–3 sentence → Claude Haiku → `affective_state/{student_id}/latest`. `/recommend`
  reads it: stress > 0.7 softens `target_mastery` by 0.1; `explicit_struggles`
  inject STRUGGLING profiles via `apply_affective_modifier` so trim_chain never
  silently removes self-reported weak concepts.
- **ML additions in rev 00014**: `GET /exam-concepts/{exam}` (~29 ACT concepts),
  exam mode targets `act_relevance.tested`, displacement persistence
  (`append_displacement_snapshot`), bridge-gap fields on `/knowledge-graph`
  (`isBridgeGap`, `bridgeEvidence`, `severity`), `Ontology.act_tested_concept_ids()`.
- **Homework help** falls back to `/recommend-ingredients` (Anthropic credits exhausted).
- **Warm-ping + shared graph cache**: `App.tsx` prefetches `/health` +
  `/knowledge-graph/{uid}` on auth (`lib/graphCache.ts`).

**Dead code** (safe to ignore): co-founder's agentic layer (`learning_world.py`,
`/agent/*` endpoints) — excluded from live `serve.py`.

### Question bank (updated 2026-07-04)
**Total: ~1,500 questions across 24 concepts** (was 227 static across 10 concepts).
Sources:
- Static bank embedded in `questionBank.ts`: ~227 ACT-tagged questions
- `app/src/data/actMasterQuestionBank.generated.json`: 206 human-annotated ACT questions (21 concepts)
- `app/src/data/eediQuestions.json`: **1,283 questions** from Eedi 2024 Kaggle dataset (24 concepts)
- `app/src/data/generatedQuestions.json`: 2 stub questions (generation paused)

**Eedi ingestion** (`ml/scripts/ingest_eedi.py`, rerunnable):
- Source: `data/eedi/train.csv` + `data/eedi/misconception_mapping.csv` (Kaggle)
- 1,869 raw → 1,283 kept (68.6%). Rejections: LaTeX-fail (320), excluded (91),
  ambiguous-diagram (48), no-alt-text (42), structural (17).
- **Alt-text recovery key technique**: Eedi embeds accessibility descriptions in
  `![alt text]()` markdown. If alt length ≥ 30 chars, replace `![...]()` with
  `(Diagram: alt)` → question becomes text-solvable. Recovered 465 extra questions
  including 293 `diagram`, 89 `coordinate_graph`, 23 `number_line` format items
  (all three format slots were empty before).
- `examTag: 'GCSE'` — does NOT pollute ACT gap-scan (getQuestions selects by
  conceptId+level, not examTag). GCSE questions surface in practice for any concept.
- Concept gains: `geometric_transformations` (47 q), `linear_inequalities` (28),
  `functions_basics` (47), `systems_of_linear_equations` (11), `circles_geometry` (7).

**Still-uncovered concepts** (not in UK KS3/4 curriculum, Eedi can't help):
  `combinatorics`, `matrices`, `complex_numbers`, `rational_expressions`,
  `logarithmic_functions`. `trigonometry_basics` (SOHCAHTOA) needs ACT/SAT sources
  or manual authoring — Eedi's trig questions are all diagram-dependent.

**Misconceptions**: 1,749 minted at `ml/data/eedi_misconceptions.json`
  (`mis_{concept}__{slug}`). Enrichment pass (embed → propose ingredient links) is
  the next Layer-1 annotation step — not yet done.

**To get Groq LLM explanations** (currently template only):
  add `GROQ_API_KEY=...` to `ml/.env.local`, rerun ingestion without `--no-llm`.
  Explain cache at `data/eedi/.explain_cache.json` (keyed by question SHA).

**`Question.examTag` union** now includes `'GCSE'` (`questionBank.ts:24`).

**`actOntologyCoverage.json` is stale** — was built against the old 227-question
  bank. Regenerate: `python3 ml/scripts/audit_act_ontology_question_bank.py`.

## Known gotchas / open items
- **Anthropic credits exhausted** → `mindcraft-homework` + dynamic question gen
  return 400. Homework uses the ingredient-pipeline fallback meanwhile.
- **Existing students lack `diagnosticCompleted`** → one forced gap scan (by design;
  backfill the flag or use Admin Testing → retake).
- **Practice questions**: `app/src/lib/questionBank.ts` merges 4 sources (static,
  actMaster, eedi, generated). Total ~1,500 questions, 24 concepts. `getQuestions`/
  `questionCount` resolve ontology→bank via `BANK_ALIASES`. `getQuestions` takes
  optional `format` arg — prefers format-matched questions, falls back to concept pool.
  The format axis now has real questions in all 5 format slots (word_problem,
  symbolic_expression, diagram, coordinate_graph, number_line). **5 concepts still
  zero-coverage**: combinatorics, matrices, complex_numbers, rational_expressions,
  logarithmic_functions — need AMC/SAT sources or manual authoring.
- **Generation paused** (`ml/generation/`): verify pass ran (104 kept / 45 dropped,
  ~30% bad key rate). Too high to scale — generation prompt needs arithmetic
  hardening before `--tested --formats all`. 104 verified items committed but NOT
  yet synced into the live bank (`syncGeneratedQuestions.mjs` → B4 step; inert
  until a cleaner batch exists). `ml/data/generated_questions.verify_report.json`
  has the drop list for diagnosis.
- **`mc-diagnostic.js` overlay** (in-world Projects sign → `MC_onProjectsOpen()`)
  still POSTs to dead `/learning-event`. The main onboarding flow ("Click Me"
  arrow → React `/diagnostic`) is fixed; this secondary overlay is a fast-follow.
  Retarget its 3 `fetch` calls to `/seed-assessment` + `/record-outcomes` (same
  mapping as Diagnostic.tsx).
- **`HomeworkProgress.tsx` / `LastSession.tsx`** are unused.
- **Role/link assignment is server-authoritative**: `Login.tsx` calls
  `grant-admin` for allowlisted admins; `ParentDashboard.tsx` calls
  `link-child`; classroom joins are Admin-SDK webhooks. Firestore rules reject
  client writes to `role`, `childId`, `tutorId`, and `classroomId`. After rule
  deployment, run `webhook/scripts/audit-user-privileges.ts` and clean any stale
  privilege/link fields via Admin SDK.
- **Bridge-gap fields not in UI** — in `/knowledge-graph` response only (`isBridgeGap`,
  `bridgeEvidence`, `severity`). `worstWeakness()` consumes severity from
  `/recommend` gaps; the knowledge-graph bridge visualisation is open.
- **Tutor view**: empty graph without a student selector (still open).
- **Concept-layer pathfinder** spot-checked SOUND on 42-concept ontology.
- **Recall headroom** (~0.19 on 15-question harness) — data/alignment work.
- **`--set-env-vars` on Cloud Run REPLACES the whole set** — always include BOTH
  `FIRESTORE_PROJECT=mindcraft-93858` and `ML_SERVICE_SECRET=<secret>` on every
  deploy or one will be dropped.

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

## Active workstream — unified weakness + format axis + generated diagnostic
GOAL (Blake): a freer question-based **diagnostic** (serve real questions across
ALL concepts/formats, **hide correctness**, record outcomes) → genuine evidence →
**ultimate weakness selection** (the single worst gap across concept-bridge AND
format gaps). Generation fills the coverage the static bank lacks so the
diagnostic isn't limited to the ~11 statically-covered concepts.

**Process: Opus = head/architect (writes build files, no coding); Cursor /
Copilot / Codex / Cursor = implementation agents.** Lanes own **disjoint** trees to avoid
collisions: `ml/**` (engine/generation) vs `app/**` (frontend/data). The plan +
shared contracts live in **`FORMAT_WEAKNESS_PLAN.md`** (root).

Shared contracts (the seams — don't diverge):
- **C1** `/recommend` gaps carry `severity ∈ [0,1]` (higher=worse), comparable
  across concept-bridge + format gaps → frontend `worstWeakness()` ranks all
  candidates (incl. plain `1−mastery`) and picks the max **playable** one.
- **C2** `FormatId` vocab shared: ml `config.FORMAT_IDS` == `questionBank.FormatId`.
- **C3** `getQuestions(conceptId, level, count, seen, examType, format?)`.
- **C4** diagnostic hide-correctness mode: serve real Qs, record outcome, never
  reveal right/wrong (a wrong key would corrupt the mastery graph).
- **C5** generated `Question` schema == `questionBank.Question` exactly (canonical
  ontology `conceptId`, `format`-tagged).

Status:
- ✅ **A1** `severity` on both gap detectors + `/recommend` JSON (`recommend.py`,
  `config.GAP_HYPOTHESIS_SCALE`). Live on rev 00014.
- ✅ **B1** `worstWeakness()` (`lib/recommendNextConcept.ts`); **B2** format-tagged
  bank + format-aware CTA; **B3** hide-correctness diagnostic (Diagnostic.tsx
  retargeted); `getQuestions` alias + `format` param. C1 fixture test 3/3.
- ✅ **A2 generation** (`ml/generation/`): essence → LLM → format-tagged items.
  Uses Layer-3 structured joins. Provider-agnostic (`LLM_PROVIDER=groq` in
  `ml/.env.local`; default was ollama). Verified via Groq llama-3.3-70b.
- ✅ **`--verify` pass DONE**: 104 kept / 45 dropped (~30% bad key rate). Keys
  committed to `ml/data/generated_questions.json` +
  `ml/data/generated_questions.verify_report.json`.
- ✅ **B4 wiring DONE** (`questionBank.ts` imports `generatedQuestions.json`; stub
  has 2 questions). Bank loads verified JSON automatically once synced.
- ❌ **NEXT (BLOCKER): fix generation prompt** — 30% bad key rate is too high for
  scale. Diagnose via `verify_report.json` drops list. Harden arithmetic in the
  generation prompt, re-run `--verify`, confirm drop rate < ~10%, then scale.
- ❌ **Scale generation** (`--tested --formats all` → ~342 Qs) → after prompt fix.
- ❌ **B4 sync** (`node app/scripts/syncGeneratedQuestions.mjs`) → after clean batch.
- ❌ **`mc-diagnostic.js` overlay retarget** — fast-follow; Lane B, see gotchas.
- Embedding-based essence (embed un-annotated past papers via
  `representation/embeddings.py`) is the heavier ALT, unused while Layer 3 covers
  seeds. Original seed data: `ml/data/sample_questions/`, `ml/data/past_papers/`.

Deferred future build file: **GeoGebra/Desmos figure generation** for the
`diagram`/`coordinate_graph` formats (renderable spec on `Question.figure`,
client-side render + render-verify). Confer with Opus → build file → divvy.

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
