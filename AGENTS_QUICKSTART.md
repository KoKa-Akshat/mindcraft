# MindCraft — Agent Quickstart
> **Read this instead of CLAUDE.md.** Under 150 lines. Gives you 90% of what you need to work. Link to deep docs only when you're about to touch that specific area.

---

## What this is
AI tutoring platform. Students enter a story world, solve math problems as the protagonist's problems, build a knowledge graph, get personalized routes. Live at `mindcraft-93858.web.app`.

**Stack:** React/Vite/TS frontend (`app/`) · Python FastAPI ML engine on HF Spaces · Vercel webhook functions · Firebase Hosting CI · Firestore DB.

---

## Lane ownership — stay in your lane, save everyone tokens

| Lane | Who | Tree | Deep doc |
|------|-----|------|----------|
| **Product** | Akshat / Claude / Cursor / Codex | `app/**`, root marketing files | `FABLE5_VISION.md` |
| **Engine** | Blake | `ml/**`, `webhook/**`, `data/**`, `worlds/**` | `CLAUDE.md §Architecture` |
| **Shared seams** | Coordinate before changing | `app/src/lib/questionBank.ts`, `app/src/lib/mlApi.ts`, `CLAUDE.md` | — |

**Before touching a shared seam file, check `ACTIVE_TASK.md` to see if another agent is already on it.**

---

## Current deployed state (update this block each session)

- **ML:** HF Spaces `https://joinmindcraft-mindcraft-ml.hf.space` (NOT Cloud Run anymore)
- **Frontend:** Firebase Hosting, CI auto-deploys on push to `main`
- **Question bank:** ~1,790 questions (Eedi 1508 + ACT Master 206 + Static 227 + OpenStax 37 + Khan empty stub)
- **Active pipelines:** `ml/scripts/pipeline/` — MCQ generator building (see `ACTIVE_TASK.md`)
- **Stories:** 41 concept stories in `app/src/data/conceptStories.json`, 47 context frames in `questionContextFrames.json`
- **ConceptVignette:** 40 animated SVGs in `app/src/components/book/ConceptVignette.tsx`

---

## Git rules — 5 bullets, memorize them

1. `GIT_OPTIONAL_LOCKS=0 git pull origin main --no-edit` before every session (Claude + Cursor + Codex all push to `main`)
2. Never force-push `main`
3. CI auto-deploys on push — **never run `firebase deploy`** locally
4. ML deploy is manual — separate GCP project, always pass BOTH env vars
5. If push hangs/times out, it probably succeeded — check `git log origin/main` before retrying

---

## Key files — only read what you need

| File | Read when... |
|------|-------------|
| `ACTIVE_TASK.md` | Start of EVERY session — what's in flight right now |
| `FABLE5_VISION.md` | Touching Practice.tsx, Dashboard, PawHub, question cards |
| `WORLD_VISION.md` | Touching stories, concept chapters, the Jarvis vision |
| `CLAUDE.md` | Need ML architecture, Firestore rules, deployment details |
| `CURSOR_HANDOVER.md` | Pipeline/question bank work |
| `PIPELINE_MCQ_SPEC.md` | MCQ generation + triple-verify + story wrapper |
| `DASHBOARD_NOTEBOOK_SPEC.md` | Field Journal / book system |

**Do not read all of these at session start. Read `ACTIVE_TASK.md` first, then only the ones relevant to your task.**

---

## The vision in 3 sentences

Math as a World. Students solve real exam problems as the protagonist's problems inside a story (`WILLIAM HARRISON · At sea, Jamaica, 1761`). The scratchpad becomes a live Jarvis that says "Harrison nods — that bearing was exactly right" or "The compass drifts — here's where the sign slipped."

**10-second story test:** Show a story page to someone new. In 10 seconds they must see: *person → place → problem.* If not, the story isn't ready.

---

## Don't do these (saves tokens AND prevents bugs)

- ❌ Read CLAUDE.md, WORLD_VISION.md, FABLE5_VISION.md cold at session start — read `ACTIVE_TASK.md` first
- ❌ Run `firebase deploy` locally — CI handles it
- ❌ Touch `ml/**` if you're in Product lane (coordinate with Blake)
- ❌ Amend published commits — make a new one
- ❌ Commit large ML caches (`ml/data/openstax/`, `ml/data/khan/`, `ml/data/.story_cache.json`) — they're in `.gitignore`
- ❌ Re-derive what another agent already established — check `ACTIVE_TASK.md`

---

## How agents should hand off to each other

At the END of every session, update `ACTIVE_TASK.md` with:
- What you completed (1 line each)
- What's still in progress + which files are mid-edit
- What's blocked and why
- What the next agent should do first

This single update saves ~500 tokens of re-derivation per session across all agents.
