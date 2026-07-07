# Modular Data Layers — Agent Contract

> **Math is the World.** Stories, questions, ingredients, and student state are separate layers joined by canonical IDs. Agents must not collapse layers or redefine IDs in place.

## Lane ownership (do not cross without coordination)

| Lane | Owner | Tree |
|------|-------|------|
| Engine | Blake | `ml/**`, `webhook/**`, `data/**`, `worlds/**` |
| Product | Akshat | `app/**`, marketing HTML, `index.html` |

Shared seams: `app/src/lib/questionBank.ts`, `app/src/lib/mlApi.ts`, `CLAUDE.md`.

## The five ontology layers (`ml/data/5_level_ontology/`)

| Layer | File pattern | Owns |
|-------|--------------|------|
| L1 | `01_*concept*.json` | 42 concepts, 179 ingredients, bridges, combinations |
| L2 | `02_*archetype*.json` | Exam question patterns (84 archetypes) |
| L3 | `03_*question*.json` | Concrete question instances (450 seed) |
| L4 | `04_*student_state*.json` | Schema for per-student evidence (not live data) |
| L5 | `05_*remediation*.json` | Diagnosis → action rules |

**Join keys:** `concept_id`, `ingredient_id`, `{exam}_{source}_q{n}`, `mis_{concept}__{slug}`, `sp_{archetype}_{method}`.

## Live question bank (frontend)

| Source | Path | Tag |
|--------|------|-----|
| Static ACT | `app/src/lib/questionBank.ts` (embedded) | ACT |
| ACT master | `app/src/data/actMasterQuestionBank.generated.json` | ACT |
| Eedi GCSE | `app/src/data/eediQuestions.json` | GCSE |
| Generated | `app/src/data/generatedQuestions.json` | varies |

**Misconceptions:** `ml/data/eedi_misconceptions.json` (1,749 ids). Enrichment pass pending.

**Stories:** `app/src/data/conceptStories.json` — one origin narrative per concept. Story-module agent (`webhook/api/story-module.ts`) reskins stems; cache in Firestore `story_module_cache`, version key `v3`.

## Pipelines (rerunnable scripts, not one-offs)

| Script | Purpose |
|--------|---------|
| `ml/scripts/ingest_eedi.py` | Eedi CSV → `eediQuestions.json` + misconceptions |
| `ml/scripts/audit_act_ontology_question_bank.py` | Coverage → `actOntologyCoverage.json` |
| `ml/generation/` | LLM question generation + verify pass |

## What agents should NOT do

- Do not edit legacy `ml/data/ontology.json` (15-concept stale file).
- Do not force-push `main` or run `firebase deploy` locally (CI owns hosting).
- Do not add Vercel functions beyond 12 (use `api/app-actions.ts` router).
- Do not show full character backstories to students — basics only; world reveals with mastery (`WORLD_VISION.md` Horizons).

## Student-facing naming (canonical)

| UI label | Not |
|----------|-----|
| Notes | Session Notes |
| Solver | Problem Solver, Homework Help |
| Map | Knowledge Map, GPS, Learning GPS |

## Active parallel workstreams

- **Stories / data pull:** Claude + Fable — Layer 2–3 annotation, Eedi enrichment.
- **Admin insights:** Chat — Health tab, coverage tables.
- **Product book UI:** Dashboard field journal, page-flip navigation, etched questions.

When adding data, label the layer in the file header and use canonical IDs only.
