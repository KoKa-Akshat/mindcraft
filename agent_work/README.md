# agent_work/

Build-file specs written by Opus/Fable 5 (architecture) for Cursor/Codex
(implementation) to pick up. Not canonical design docs — those stay at repo
root (WORLD_VISION.md, BRAND_BOOK.md, AGENT_RULEBOOK.md, DASHBOARD_NOTEBOOK_SPEC.md,
FABLE5_VISION.md, STORY_INTELLIGENCE_SPEC*.md).

Subfolders group specs by which lane(s) they touch, per CLAUDE.md's lane
split (Engine = `ml/**`, `webhook/**`, `data/**`, `worlds/**`; Product =
`app/**` + marketing):

- **`product/`** — Product-lane only (`app/**`). Safe for a Cursor session
  to take end-to-end without touching Engine files.
- **`engine/`** — Engine-lane only (`ml/**`, `webhook/**`). Safe for Codex
  without touching Product files.
- **`cross-cutting/`** — spans both lanes in one plan (each spec's own
  header labels which task is which lane) — coordinate before splitting
  across two agent sessions, or hand the whole file to one session.
- **`infra/`** — deployment/ops runbooks, not feature specs. Topology and
  migration work (hosting, service accounts, env cutover), not product
  behavior.

## Index

| Spec | Lane(s) | Status (as of last commit) |
|------|---------|------|
| [cross-cutting/ROLE_LOCK_AND_EXAM_TARGETS_PLAN.md](cross-cutting/ROLE_LOCK_AND_EXAM_TARGETS_PLAN.md) | Engine (pathfinder) + Engine/Product/rules (role lock) | Shipped |
| [cross-cutting/ADMIN_VIEWS_TRANSCRIBE_LATEX_PLAN.md](cross-cutting/ADMIN_VIEWS_TRANSCRIBE_LATEX_PLAN.md) | Product + Engine (transcribe endpoint) | Shipped |
| [product/STUDY_SURFACE_TUTOR_PING_PLAN.md](product/STUDY_SURFACE_TUTOR_PING_PLAN.md) | Product | Shipped |
| [cross-cutting/INK_WORK_MODEL_PLAN.md](cross-cutting/INK_WORK_MODEL_PLAN.md) | Product (strokes/UI) + Engine (`/check-work`) | Phases 1-3 shipped |
| [infra/HF_SPACES_MIGRATION_PLAN.md](infra/HF_SPACES_MIGRATION_PLAN.md) | Engine/infra + 2 Product env lines | Shipped, live |
| [infra/HF_PLUGIN_RUNBOOK.md](infra/HF_PLUGIN_RUNBOOK.md) | infra (self-contained cutover prompt) | Executed |
| [cross-cutting/PERSONALIZATION_WORK_EVIDENCE_PLAN.md](cross-cutting/PERSONALIZATION_WORK_EVIDENCE_PLAN.md) | Product (Part 1) + Engine (Part 2b/2d, Part 3a) | Part 1 shipped; 2b/2d/3a in progress |
| [product/PAPER_STANDARDIZATION_PLAN.md](product/PAPER_STANDARDIZATION_PLAN.md) | Product | Open |
| [engine/EEDI_LATEX_REINGEST_PLAN.md](engine/EEDI_LATEX_REINGEST_PLAN.md) | Engine | Shipped |
| [cross-cutting/TIER3_MISCONCEPTION_GAPS_PLAN.md](cross-cutting/TIER3_MISCONCEPTION_GAPS_PLAN.md) | Engine (E1, F1) + Product (P1, P2) | Open — implements EXTENSION_RECOMMEND.md |
| [engine/DATA_ENRICHMENT_PLAN.md](engine/DATA_ENRICHMENT_PLAN.md) | Engine (`ml/scripts/`, `ml/data/`) | Open — ASSISTments calibration, STAAR/Regents/CK-12 sources, YouTube + Math SE misconception mining |
| [cross-cutting/STORY_PERSONALIZATION_PLAN.md](cross-cutting/STORY_PERSONALIZATION_PLAN.md) | Engine (story_worlds JSON) + Product (storyWorldId pref UI) | Open — 18-world taxonomy + minimal user pref hook |
| [engine/STORY_CELL_SCALE_PLAN.md](engine/STORY_CELL_SCALE_PLAN.md) | Engine (`ml/scripts/`, `ml/data/story_cells/`) | Open — bulk cell generator, priority 15 concepts, world_feedback shared module |
| [cross-cutting/ACT_DYNAMIC_DIAGNOSTIC_PLAN.md](cross-cutting/ACT_DYNAMIC_DIAGNOSTIC_PLAN.md) | Engine (`ml/scripts/build_act_diagnostic.py`, `ml/data/act/`) + Product (`diagnosticQuestions.ts`, `questionBank.ts`) | Open — revives the real-ACT-exam-data-driven diagnostic (freq-ranked concepts + curated probes), never wired to `/onboard`; converts to C5 `Question` shape |

Update the Status column as work lands — don't let this drift like a stale
changelog; if a spec is fully done and superseded, note that instead of
deleting (git history + this index are the paper trail).
