# Claude Handoff — MindCraft (Jul 8, 2026)

**Read `ACTIVE_TASK.md` first.** Do not restart from scratch.

---

## Lane split (avoid collisions)

| Owner | Tree | Owns |
|-------|------|------|
| **Cursor / Composer** | `ml/**`, wiring seams | Pipelines, batches, `questionBank.ts` merge, Practice weak-spot routing |
| **Claude (you)** | Architecture docs, agent-loop **design**, Prompt 1 strategy | Story Intelligence spec, data moat narrative, human-in-the-loop workflow — **not** duplicate pipeline coding |
| **Fable 5 / Product** | `app/**` UI | Journal, dashboard, chapter UX |
| **Fable 5 (Spec V2 split)** | `app/**` | Voice registry UI, `getStoryCells()` variant picker, `worstWeakness()` tier-3 display in Practice, `diagnosticSelection.ts` |
| **Codex (Spec V2 split)** | `app/**` seams + tests | `resolveChoiceEvidence()` extended with `ingredientId`, `worldSkinRegistry.json`, voice-variant JSON wiring, null-safety tests |
| **Cursor / Blake (Spec V2 split)** | `ml/**` | `story_cell_studio.py --reskin-voice`, `update_distractor_priors.py`, serve.py `/recommend` ingredient tier (`misconceptionGaps[]`) |

**Do not** rewrite `ml/scripts/pipeline/base.py` without coordinating. Extend only.

---

## What Cursor already shipped (do not redo)

### Login + fullscreen (Prompt 2) — ✅ DONE
- `app/src/pages/Login.tsx`: no fullscreen on login; iPad/touch uses `signInWithRedirect`; popup-blocked → redirect fallback; Full Screen button removed
- `worlds/world2/mc-world-chrome.js`: Enter World still calls `requestFullscreen()` — **leave this**

Verify only if user reports regression. Do not re-add login fullscreen.

### Engine pipelines — ✅ DONE / RUNNING
| Asset | Path | Count |
|-------|------|-------|
| OpenStax MCQ (5-concept batch) | `ml/data/openstaxMCQ.json` + `app/src/data/openstaxMCQ.json` | **221** wired |
| Story Cells (pilot) | `ml/data/story_cells/batch_llm_002.json` → `app/src/data/storyCells.json` | **3** wired |
| Story Cells `--concepts all` | `ml/data/story_cells/batch_all.json` | **RUNNING** (~42) |
| Full OpenStax all concepts | `ml/data/openstaxMCQ.json` | **USER must approve** ~8–10 hr run (4249 candidates → ~1250 Qs) |

Command for full OpenStax (Engine):
```bash
cd ml && PYTHONUNBUFFERED=1 python scripts/pipeline/ingest.py \
  --source openstax --convert-free-response --verify-count 3 --story-wrap \
  --out ml/data/openstaxMCQ.json
# then: cp ml/data/openstaxMCQ.json app/src/data/openstaxMCQ.json
```

### App wiring — ✅ DONE (Cursor)
- `questionBank.ts`: imports `openstaxMCQ.json` + `storyCells.json`; `isStoryCellQuestion()`; weak-spot prefers cells via `getQuestions(..., preferStoryCells)`
- `Practice.tsx`: weakness missions pass `preferStoryCells: true`
- **Choice evidence v1**: `resolveChoiceEvidence()` → `/record-outcomes` → `attempt_observations` (Practice + GradeOnboard probes)
- **Diagnostic hybrid**: up to 2 Story Cells + grade-level bank probes (`diagnosticQuestions.ts`)
- **Canonical gap doc**: `GAP_MAP_VISION.md`

After `batch_all.json` completes:
```bash
cp ml/data/story_cells/batch_all.json app/src/data/storyCells.json
```

---

## Your job — Prompt 1 (Story Intelligence **architecture**, not re-implementation)

**Read `GAP_MAP_VISION.md` first** — canonical gap/mission/evidence doc for the team (Jul 8).

MindCraft is **not** a question bank. It is a **diagnostic learning world** where choices reveal thinking.

### Already built (code, not theory)
- `ml/scripts/pipeline/story_cell_studio.py` — MisconceptionAgent, WorldPrimitiveSelector, PedagogyCritic, PersonaSimulator, StoryCellGenerator, StoryCellStudio
- `ml/scripts/pipeline/mcq_generator.py` — triple-verify OpenStax FR → MCQ + story wrap
- Ontology misconceptions in Layer 1 ingredients (`canonical_misconception_family`)
- Per-**student** graph: `/record-outcomes`, `/recommend`, Firestore — **not** per-student story text yet

### What we need from you (deliverables)
1. **Agentic loop spec** — ✅ Done — `STORY_INTELLIGENCE_SPEC_V2.md` §1: auto-ship gates A/B, Blake (math) vs Akshat (narrative/safety) routed review queues, rejection cache, `generator_version` tagging.
2. **Diagnostic selection v2** — ✅ Done — `STORY_INTELLIGENCE_SPEC_V2.md` §2: information-gain reranking, grade caps table, 5–8 question adaptive stop, seamless practice handoff, cold-start fallback.
2b. **Data moat schema** — what to log from day one: `choice_index`, `distractor_taxonomy` match, hint index, time-to-answer, transfer item outcome, confidence. (✅ specced in `STORY_INTELLIGENCE_SPEC.md` §2.)
3. **Personalization v1 plan** — student `interestTags` → world skin registry → same Story Cell spine, different narrative wrapper (consultant vs doctor). **Do not** promise live LLM reskin until Layer 1 wired.
4. **Quality rubric** — extend the 7-dimension `pedagogy_score` with thresholds for auto-reject.
5. **Evolution loop** — how aggregate wrong-answer rates update distractor priors (misconception confirmation/refutation).
6. **VC paragraph** — ✅ Done — VC defensibility = misconception graph + story response corpus, not content volume; see `STORY_INTELLIGENCE_SPEC.md` §6.
7. **Fable 5 vs Codex split** — UI/routing in Fable; schema migrations + tests in Codex; Engine in Cursor/Blake.

### Important clarifications (user confusion)
- **MCQs vs Story Cells are NOT duplicates.** MCQs = volume (OpenStax stems). Story Cells = generative diagnostic units with `distractor_taxonomy`. Same concept, different jobs.
- **Story Cell diagnoses are population priors**, not per-student labels until the kid picks an option and you record it.
- **Delivery shape is 4-choice today** because `/record-outcomes` and the mastery engine expect keyed MCQs. `format` field varies (word_problem, diagram, symbolic…). Free-response / interactive = future contract extension (C4 hide-correctness diagnostic already exists).
- **Horizon 1/2/3** = now / world-as-UI / personalized skins. User finds the label unhelpful — use plain language.

---

## Continuity protocol
1. Read `ACTIVE_TASK.md`
2. Read this file
3. State what's done vs running vs blocked
4. Never force-push `main`; main Claude session owns git

---

## Tests to keep green
```bash
cd app && npm run build   # tsc + vite
cd ml && python scripts/end2end.py   # if touching engine
app: src/lib/recommendNextConcept.test.ts, practicePathQueue.test.ts
```

Do not ship questions without `hasValidKey` (correctIndex in range, 3+ choices).
