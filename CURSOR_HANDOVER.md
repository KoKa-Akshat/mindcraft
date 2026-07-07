# Cursor Handover — MindCraft Pipeline & Question Bank

**Date:** 2026-07-07  
**Branch:** `main` (auto-deploys to Firebase Hosting on push)  
**Context:** Pick up question bank expansion and pipeline work exactly where the last session ended.

---

## Current Question Bank Status

| Source | File | Questions | Notes |
|--------|------|-----------|-------|
| Static (embedded) | `app/src/lib/questionBank.ts` | ~227 | ACT-tagged |
| ACT Master | `app/src/data/actMasterQuestionBank.generated.json` | 206 | Human-annotated |
| Eedi | `app/src/data/eediQuestions.json` | 1,508 | GCSE, 24 concepts |
| OpenStax | `app/src/data/openstaxQuestions.json` | 37 | Wired in — 37 is the hard ceiling (OpenStax is 94% free-response, MCQ supply exhausted) |
| Generated | `app/src/data/generatedQuestions.json` | 2 stubs | Generation paused (30% bad key rate) |
| **Total** | | **~1,790** | 24 concepts |

**All 5 sources are wired into `app/src/lib/questionBank.ts`** — `OPENSTAX_QUESTIONS` was added in the last commit.

---

## Pipeline Architecture

Location: `ml/scripts/pipeline/`

```
base.py              — shared: DiagramFilter, LaTeXNormalizer, LLMAnnotator,
                       ConceptMapper, QuestionValidator, run_pipeline()
ingest.py            — unified CLI
story_generator.py   — regenerates conceptStories.json + contextFrames.json,
                       sampling 3 real questions first so world ≠ era mismatch
sources/
  openstax.py        — done; 37 MCQs (cache-first, math-book-gated, 8 bugs fixed)
  amc.py             — coded but BLOCKED: AoPS cloudflare 403 blocks API
  khan.py            — coded but NOT YET RUN
```

**Output schema** (must match `questionBank.ts` exactly):
```typescript
{ id, conceptId, level: 1|2|3, question, choices: string[],
  correctIndex, explanation, hints: string[3], examTag?, format? }
```

Output files use `{"_meta": {...}, "questions": [...]}` envelope.

**Cache locations** (in `.gitignore` — large, re-fetchable):
- `ml/data/openstax/exercises.json` — 84,923 exercises (542MB, already fetched)
- `ml/data/amc/` — not yet fetched (blocked by Cloudflare)
- `ml/data/khan/` — not yet fetched

---

## What Needs Doing Next (in priority order)

### 1. Khan Academy ingestion (run first — no auth wall)
```bash
cd /Users/akoirala/Desktop/Business\ Ideas/mindcraft-site
source ml/mindcraft/bin/activate  # or use anaconda: /Users/akoirala/anaconda3/envs/apollo/bin/python3
python ml/scripts/pipeline/ingest.py --source khan --out app/src/data/khanQuestions.json --no-llm
```
Khan uses the Perseus format. Check `sources/khan.py` for the adapter. The Khan API may require a subject slug — look at the `--topic` arg in `ingest.py`. Try `--topic algebra` first.

Wire into `questionBank.ts` like OpenStax was wired:
```typescript
import khanQuestionsData from '../data/khanQuestions.json'
// add KHAN_QUESTIONS merge at line ~1975
```

### 2. AMC ingestion — needs a proxy or offline source
AoPS blocks direct API access (Cloudflare 403). Options:
- **Option A:** Use Art of Problem Solving offline JSON exports if Akshat has them
- **Option B:** Scrape from `artofproblemsolving.com/wiki/index.php/AMC_8_Problems` via a browser-based tool (Cursor can use Playwright)
- **Option C:** Use the AOPS API with a residential proxy / slower retry with real browser headers (might need `--headless chromium` fetch)

If unblocked, run:
```bash
python ml/scripts/pipeline/ingest.py --source amc --years 2018-2023 --out app/src/data/amcQuestions.json --no-llm
```

### 3. Fix the generation prompt (30% bad key rate)
Location: `ml/generation/`  
Report: `ml/data/generated_questions.verify_report.json`  

The bad-key pattern: arithmetic errors in correct answers. Harden the generation prompt with a verification step — after generating, ask the LLM to re-derive the answer and check it matches `correctIndex`. Only keep if they agree.

### 4. Scale generation after prompt fix
```bash
python ml/generation/generate.py --concepts all --formats all --tested --verify
node app/scripts/syncGeneratedQuestions.mjs
```

---

## Vision Context (READ — shapes every decision)

Read `WORLD_VISION.md` and `FABLE5_VISION.md` before touching UI or story content.

**The north star:** Math as a World. Students are in Jesse's boat. The story stamp on every question chapter page shows who they're following (`WILLIAM HARRISON · At sea, bound for Jamaica, 1761`). The knowledge graph is their map. Every question is a puzzle that advances the story.

**Story quality rule:** Show the story to someone who has never seen MindCraft. Within 10 seconds they should understand: *person → place → problem.* If not, it's not ready.

**Concept vignettes:** `app/src/components/book/ConceptVignette.tsx` now has 40 animated SVG illustrations (grew from 6 this session). If you add a new concept, add a vignette.

---

## Git Rules (non-negotiable)

- `git pull origin main` before every session (Cursor, Claude, and Blake all push to main)
- Never force-push main
- CI auto-deploys on push — never run `firebase deploy` manually
- ML deploy is manual — separate GCP project, needs BOTH env vars every time

---

## Key Files Changed This Session

```
app/src/components/book/ConceptVignette.tsx  — 40 concept SVGs (was 6)
app/src/pages/ConceptChapterPage.tsx         — scene stamp on story pages
app/src/pages/ConceptChapterPage.module.css  — sceneStamp CSS
app/src/data/openstaxQuestions.json          — NEW: 37 OpenStax MCQs
app/src/lib/questionBank.ts                  — wires in openstaxQuestions.json
ml/scripts/pipeline/                         — NEW: full multi-source pipeline
ml/scripts/pipeline/sources/openstax.py      — 8 bugs fixed
WORLD_VISION.md                              — extended with pipeline/MCP/Roblox/story quality
FABLE5_VISION.md                             — Cursor spec: question cards, dashboard, PawHub
```

---

## Environment Notes

- Python venv: `ml/mindcraft/` (per CLAUDE.md) OR `/Users/akoirala/anaconda3/envs/apollo/bin/python3` (both work for pipeline — only needs stdlib + requests)
- Frontend: `cd app && npm run dev` → localhost:5173
- ML is on HF Spaces: `https://joinmindcraft-mindcraft-ml.hf.space` (not Cloud Run anymore)
- `LLM_PROVIDER=groq` + `GROQ_API_KEY` needed for LLM annotation in pipeline
