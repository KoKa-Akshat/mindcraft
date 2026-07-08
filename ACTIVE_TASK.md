# Active Task — MindCraft
> Updated at the end of every session by every agent. The FIRST thing any agent reads.
> Keep entries short. Delete completed items after 2 sessions.

---

## In progress RIGHT NOW

| Task | Agent | Files touched | Status |
|------|-------|--------------|--------|
| Marketing nav + stats + about fix | Claude Code | `index.html` | ✅ Done |
| Jarvis on-screen journal guide | Cursor | `app/src/lib/journalGuide.ts`, `app/src/hooks/useJournalGuide.ts`, `app/src/components/JarvisGuide.tsx`, `app/src/components/JarvisGuide.module.css`, `app/src/components/HighlightedStem.tsx`, `app/src/components/HighlightedStem.module.css`, `app/src/components/ScratchTranscriptionPane.module.css`, `app/src/pages/ConceptChapterPage.tsx`, `app/src/pages/ConceptChapterPage.module.css`, `app/src/pages/GradeOnboard.tsx`, `app/src/pages/GradeOnboard.module.css` | ✅ Done |
| UX fixes (7 items) | Claude Code | see below | ✅ Done |

**UX fix summary (2026-07-08):**
- ✅ Fix 1 — Jarvis right-side only: removed `<JarvisGuide side="question">` from `ConceptChapterPage.tsx` and `GradeOnboard.tsx`; added `user-select: none; cursor: default` to `HighlightedStem.module.css`.
- ✅ Fix 2 — ScratchPad expression evaluator + mini graph: `ScratchPad.tsx` new recursive-descent `safeEval`, `parseFnLine`, `MiniGraph` SVG component; overlay positioned by workLine bbox. Parents (`ConceptChapterPage.tsx`, `GradeOnboard.tsx`) pass `evalLines` prop.
- ✅ Fix 3 — ScratchPad eraser + session logs: eraser × button with 200ms fade + confirm-before-clear; Logs dropdown (last 5) keyed by `questionId` in `localStorage`; new CSS in `ScratchPad.module.css`.
- ✅ Fix 4 — Page flip animation: `PageFlipTransition.tsx` rotateY 7° → 90° with `backfaceVisibility: hidden`, `willChange`, `transformPerspective: 1800`.
- ✅ Fix 5 — GradeOnboard grade auto-advance + voice: grade buttons immediately advance step; caption text removed; goals step replaces chips with text input + `MediaRecorder` voice button (60s, pulsing); `GradeOnboard.module.css` updated.
- ✅ Fix 6 — World fullscreen lock: `mc-world-chrome.js` adds `fullscreenchange` listener + `userExitedIntentionally` flag set only on ESC; re-requests fullscreen on unexpected exit.
- ✅ Fix 7 — Booking button: added `{ to: '/book', label: 'Book a Session' }` to `Sidebar.tsx` NAV; removed duplicate text link from `DashboardNotesPanel.tsx` empty state.
| MCQ triple-verify pipeline | ✅ Done (Fable 5) | `ml/scripts/pipeline/mcq_generator.py`, `story_wrapper.py`, `sources/openstax.py`, `ingest.py`, `PIPELINE_MCQ_SPEC.md` | Committed `43e3d62d`, pushed |
| Practice session journal paper reskin | ✅ Done (Fable 5) | `app/src/pages/Practice.module.css` | Committed `0b698e2a`, pushed |
| iPad login + world diagnostic flow | Codex | `app/src/pages/Login.tsx`, `app/src/pages/Login.module.css`, `worlds/world2/index.html`, `worlds/world2/mc-world-chrome.js`, `worlds/world2/mc-diagnostic.css` | ✅ Done |
| Google login fullscreen bug | Cursor | `app/src/pages/Login.tsx` | ✅ Done — redirect auth on iPad; no fullscreen on login; fullscreen stays on Enter World |
| OpenStax MCQ 50-item test batch | Cursor | `/tmp/openstax_mcq_test_v3.json`, `ml/data/.mcq_test_v3_log.txt` | ✅ Done — **52% yield** (26/50) after concept balance + HTML alt recovery; full batch running |
| Story Cell Studio LLM batch (3) | Cursor | `ml/data/story_cells/batch_llm_002.json`, `story_cell_studio.py` | ✅ Done — real LLM cells (Steady Drift, Waterfowl Pond, Thales shadow) |
| OpenStax MCQ full batch (5 concepts) | Cursor | `ml/data/openstaxMCQ.json`, `ml/data/.openstax_mcq_full_log.txt` | ✅ Done — **221 questions** (29.3% of 753); wire in Product lane |
| Founder section copy + photos | Codex | `index.html`, `img/akshat-koirala.jpg` | ✅ Done |
| Landing visual polish + mascot | Codex | `index.html`, `img/fibonacci-bear.svg` | ✅ Done |

✅ Done — removed the awkward hero arrow, fixed the triangle connector, and cleaned red process arcs/labels.
✅ Done — tightened section language and replaced wordy chips with visual signal cards.
Files changed — `index.html`, `img/fibonacci-bear.svg`, `ACTIVE_TASK.md`.

✅ Done — Jarvis margin companion: pencil notes in the red margin, lime highlighter on question stems, reads scratch ink + debounced `/api/jarvis` coach nudges.
✅ Done — Wired into chapter spreads + login diagnostic probe (left=question highlights, right=work + transcription readout).
Files changed — `journalGuide.ts`, `useJournalGuide.ts`, `JarvisGuide.*`, `HighlightedStem.*`, `ConceptChapterPage.*`, `GradeOnboard.*`, `ScratchTranscriptionPane.module.css`, `ACTIVE_TASK.md`.

✅ Done — founder copy is shorter, more human, and less resume-like.
✅ Done — Akshat's real headshot is now in `img/akshat-koirala.jpg`; Blake still needs an actual `img/blake-kell.jpg` file.
Files changed — `index.html`, `img/akshat-koirala.jpg`, `ACTIVE_TASK.md`.

✅ Done — login now has responsive iPad/iPhone/MacBook sizing plus a user-triggered fullscreen option.
✅ Done — world entry removes visible `3D | Web` and `Click Projects` chrome, wakes audio on Enter, and opens diagnostics automatically.
Files changed — `app/src/pages/Login.tsx`, `app/src/pages/Login.module.css`, `worlds/world2/index.html`, `worlds/world2/mc-world-chrome.js`, `worlds/world2/mc-diagnostic.css`.

---

## Recently completed (this session)

- ✅ Concept vignettes: 40 SVGs in `ConceptVignette.tsx` (was 6)
- ✅ Scene stamp on story pages: protagonist + setting shown on first story spread
- ✅ Multi-source pipeline: `ml/scripts/pipeline/` with OpenStax/AMC/Khan adapters
- ✅ OpenStax 37 MCQs wired into `questionBank.ts`
- ✅ Khan empty slot wired (API 410, needs offline dump at `ml/data/khan/exercises.json`)
- ✅ Practice session reskin to journal paper (FABLE5 Area 1 complete)
- ✅ Pre-test audit: all items green (mc-diagnostic.js, ML endpoints, scene stamps, TS)
- ✅ WORLD_VISION.md extended: pipelines, MCP, Roblox dimension, story quality standard
- ✅ AGENTS_QUICKSTART.md + ACTIVE_TASK.md created (this file)
- ✅ ML pointed to HF Spaces in `.env.production` + webhook (not Cloud Run)

---

## Blocked / needs human input

| Item | Blocker | What's needed |
|------|---------|--------------|
| AMC questions | AoPS Cloudflare 403 | Playwright scraper OR offline JSON dump from Akshat |
| Khan Academy | API 410 Gone | Pre-downloaded dump at `ml/data/khan/exercises.json` |
| Generation scale | 30% bad key rate | Fix prompt first (see `PIPELINE_MCQ_SPEC.md` when ready) |
| Anthropic credits | Exhausted | Homework solver (`mindcraft-homework`) still down |

---

## Next up (in priority order)

1. **Wire OpenStax MCQ bank** — `ml/data/openstaxMCQ.json` ready (**221** story-wrapped MCQs, 5 concepts). Product lane: import in `questionBank.ts` like `openstaxQuestions.json`.
2. **Story Cell Studio scale** — run `--concepts all --refresh` batch to `ml/data/story_cells/batch_all.json` (3-concept LLM pilot ✅ in `batch_llm_002.json`).
2. **FABLE5 Area 2** — Dashboard personalization: mastery bars, top-6 weaknesses, skeleton shimmer (see `FABLE5_VISION.md §Area 2`)
3. **FABLE5 Area 3** — PawHub upgrades: concept labels in pads, pulse animation, SVG progress ring
4. **FABLE5 Area 4** — Tutor focus areas
5. **Jarvis dashboard margin notes** — chapter + diagnostic done; dashboard margin notes still open

---

## Shared seam files — check before touching

- `app/src/lib/questionBank.ts` — question shape contract. Last touched: wired OpenStax + Khan slots
- `app/src/lib/mlApi.ts` — ML API client. Last touched: pointed at HF Spaces
- `app/src/data/conceptStories.json` — 41 story worlds. DO NOT overwrite — append only
- `app/src/data/questionContextFrames.json` — 47 context frames. Last touched: all rewritten this session

---

## Agent token tips

- Start with this file. Then read only the deep doc for your specific task.
- If you're doing UI: read `FABLE5_VISION.md §Area N` for your area only
- If you're doing pipeline: read `PIPELINE_MCQ_SPEC.md` + `ml/scripts/pipeline/base.py`
- If you're doing stories: read `WORLD_VISION.md §9` (story quality standard) + `conceptStories.json` for the concept you're touching
- Never read `CLAUDE.md` in full — use Ctrl+F for the section you need
