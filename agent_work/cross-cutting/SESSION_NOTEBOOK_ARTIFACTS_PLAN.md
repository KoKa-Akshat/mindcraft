# Build plan: NotebookLM-style session notes + interactive question figures

> **Lanes:** Product (`app/**`) + Engine (`ml/**`). Each task below is
> labelled with its lane — coordinate before splitting across two agent
> sessions. Canonical design owner for the Notes surface look/feel:
> `DASHBOARD_NOTEBOOK_SPEC.md` (paper system, typography, motion). This spec
> owns the *behavior*; keep the visual treatment inside that paper aesthetic.

## The vision (why)

Turn **Session Notes** into a NotebookLM for the student's own math work. A
student opens a **concept** (the notebook), sees the questions they've worked
and their handwritten notes grouped under it, **selects sources**, and
generates **whatever artifact they want** — flashcards, a mind map, a diagram,
slides, or an interactive figure — synthesized from *their* actual work
(deterministic steps, the questions, the concept's ingredients + description).

Separately but reusing the same renderer: **question figures are generated from
question text** and displayed as interactive Desmos/SVG figures in the practice
view.

The two meet at one primitive: **a figure spec → one renderer**. "Interactive
figure" and "diagram" artifacts render through the exact component Track A
builds for question figures.

## Decisions locked (from brainstorm — do not re-litigate)

1. **Figures are text-inferred, not authored.** The inference in
   `QuestionFigure.tsx` already extracts structured intermediates
   (`parseLinearEquation → {m,c}`, `decimalMultiply → {a,b}`, `polygonSides`).
   Route those through a thin internal `FigureSpec` so the **renderer is
   swappable** later (regex→spec today; authored/LLM `Question.figure` later)
   without touching call sites.
2. **Desmos for the graphable slice; keep today's SVG for geometry.** A regex
   can reliably produce `y = mx + c` → hand to Desmos. It cannot reliably
   produce a geometric construction → triangle/circle/polygon/angle stay SVG.
   GeoGebra is deferred (needs real construction specs).
3. **Synthesis LLM = ML service + Groq** (`LLM_PROVIDER=groq`), NOT the
   webhook's Anthropic Haiku — Anthropic credits are exhausted. The recall-tag
   summary (Track B1) is **deterministic, no LLM.**
4. **Split of truth:** client owns question content + the student's `workLines`;
   the ML endpoint owns ontology **ingredients** and enriches server-side. The
   frontend question bank is NOT shipped to the server — the client sends the
   question fields it already has.

## Architecture — the shared primitive

```
                          FigureSpec (thin JSON)
   producers  ─────────────────┬───────────────────►  <InteractiveFigure spec>
   • Track A: regex inference   │                       • engine=desmos → Desmos calls
   • Track B: /synthesize-      │                       • else → today's SVG heuristics
       artifact (figure type)   │                       • no spec / unavailable → SVG fallback
                                │
   ArtifactSpec (union) ────────┴──► artifact renderers:
   from /synthesize-artifact         flashcards | mindmap | slides | figure/diagram
```

---

## Contracts (the seams — don't diverge)

### F1 — `FigureSpec` (Product-internal; `app/src/lib/figureSpec.ts` new)
Thin, inferred, not authored. Renderer dispatches on it.
```ts
type FigureSpec =
  | { kind: 'graph'; engine: 'desmos'; expressions: string[]; // e.g. ['y=2x-1']
      points?: { x: number; y: number; label?: string }[];
      window?: { x: [number, number]; y: [number, number] } }
  | { kind: 'geometry'; engine: 'svg'; shape: 'triangle'|'circle'|'polygon'|'angle'|'area'|'numberline';
      params?: Record<string, number> }   // e.g. { sides: 6 } | { a: 0.4, b: 0.7 }
```
`inferFigureSpec(conceptId, questionText, format?)` reuses the existing
`parseLinearEquation` / `decimalMultiply` / `polygonSides` logic and returns a
`FigureSpec | null`. This replaces the direct-to-SVG branch selection in
`QuestionFigure.tsx` — same heuristics, spec-shaped output.

### F2 — `ArtifactSpec` (shared, `/synthesize-artifact` output == client renderer input)
Discriminated union by `type`:
```ts
type ArtifactSpec =
  | { type: 'flashcards'; cards: { front: string; back: string }[] }
  | { type: 'mindmap'; nodes: { id: string; label: string; kind: 'concept'|'ingredient'|'question' }[];
      edges: { from: string; to: string }[] }
  | { type: 'slides'; slides: { title: string; bullets: string[]; figure?: FigureSpec }[] }
  | { type: 'figure'; caption: string; figure: FigureSpec }
```
The server emits this JSON; client renders it. Server MUST validate its own
output against this shape and drop malformed artifacts (no half-rendered junk).

### F3 — `POST /synthesize-artifact` (Engine, `ml/serve.py`)
```jsonc
// request
{ "student_id": "...", "concept_id": "circles_geometry",
  "artifact_type": "flashcards",       // flashcards | mindmap | slides | figure
  "concept_name": "Circles",            // client-supplied (conceptStories.json)
  "sources": [
    { "question_id": "...", "stem": "...", "choices": ["..."],
      "correct_index": 0, "explanation": "...",
      "student_selected_index": 2,       // optional
      "work_lines": [ { "text": "A = πr²", "verdict": "correct", "rule": "area_formula" } ] // optional, deterministic steps
    }
  ] }
// response: { "artifact": ArtifactSpec }   // or 4xx on validation failure
```
Server enriches from **ontology Layer 1**: pulls the concept's ingredients
(names, `failure_mode`) + description and injects them into the Groq prompt.
Per-`artifact_type` system prompt + a strict JSON output schema. Auth: same
Firebase-ID-token / `X-Service-Key` gate as every other data endpoint
(`mindcraft_graph/auth.py`). Enforce `uid == student_id`.

### F4 — concept grouping (Product, `app/src/lib/workEvidence.ts`)
Add `groupWorkByConcept(entries)` layered **on top of** the existing
`groupStudentWorkLedger` (newest-per-question). Returns
`{ conceptId, conceptName, entries: StudentWorkEntry[] }[]`, concept order by
most-recent activity. Does not replace `groupStudentWorkLedger` — composes with it.

---

## TRACK A — interactive question figures (Lane: **Product**, `app/**`)

Independent of Track B. Ships alone.

### A1 — `FigureSpec` + inference (`app/src/lib/figureSpec.ts` new)
Extract the branch logic currently inside `QuestionFigure.tsx` into
`inferFigureSpec()` returning `FigureSpec | null` (F1). Pure refactor — no
behavior change yet; existing SVG output preserved for every case.

### A2 — Desmos renderer (`app/src/components/InteractiveFigure.tsx` new)
- Lazy-load the Desmos API script **once** (`https://www.desmos.com/api/v1.x/calculator.js?apiKey=...`)
  via a singleton loader (`app/src/lib/desmosLoader.ts`) — needs a Desmos API
  key (free tier; put in `.env` as `VITE_DESMOS_API_KEY`, fall back to the
  public demo key). Never block first paint on it.
- `kind:'graph'` → `Desmos.GraphingCalculator(el, { expressions:false, settingsMenu:false, ... })`,
  `calc.setExpression({ latex })` per `expressions[]`, plot `points[]`, set bounds.
- Render into a fixed-height card matching the journal paper aesthetic
  (`DASHBOARD_NOTEBOOK_SPEC.md`).
- **Fallback contract:** if the script fails to load, spec is `null`, or
  `engine !== 'desmos'` → render the existing `<QuestionFigure>` SVG. The
  interactive path is pure enhancement; nothing regresses offline.

### A3 — wire into the question/practice view
Where `<QuestionFigure>` renders today, call `inferFigureSpec` first; if it
returns a `graph` spec → `<InteractiveFigure>`, else `<QuestionFigure>` (SVG).
Verify: a linear-equation question shows a live Desmos line; a triangle question
still shows the SVG sketch; offline still works.

---

## TRACK B — session notebook + artifact generation

### B1 — concept notebook + recall tags (Lane: **Product**, `app/**`)
Restructure the **"My work"** section of `StudentSessions.tsx` (currently a flat
newest-per-question list, lines 173–214):

- **Group by concept** (F4). Each concept is a collapsible "notebook" row:
  concept name + count ("7 problems worked") + last-worked date.
- **Drill in:** expanding a concept lists its worked questions; each question row
  shows a **recall tag** + a way to open the handwritten work (existing
  `QuestionWorkView`, already rendered per-entry).
- **Recall tag = deterministic, no LLM.** A short noun-phrase describing *what
  the question is about* (e.g. "Radius from a circle's area"). v1 rule: derive
  from `conceptName` + a trimmed/templated stem; cache on the work entry
  (`recallTag?: string` on `StudentWorkEntry`) so it's computed once. (A tiny
  Groq call is a later upgrade, not v1.)
- Keep the paper/journal styling. Don't touch the "Follow-up work from tutor" or
  "Published summaries" sections beyond what grouping requires.

### B2 — artifact generator
**Engine side** (`ml/**`):
- `POST /synthesize-artifact` (F3) in `serve.py`. Ontology enrichment via the
  existing `complete_ontology_loader` (ingredients + description for
  `concept_id`). One Groq call per request through `ml/generation/llm_client.py`
  (or the serve-side LLM path) with a per-`artifact_type` prompt. Validate output
  against the `ArtifactSpec` shape (F2) before returning; 422 on malformed.
- Prompts live in a new `ml/mindcraft_graph/artifacts/` module (system prompt +
  output schema per type). Keep the LLM to *language/structure*; the sources and
  ingredients are supplied deterministically (same generative/deterministic split
  as the rest of the engine).

**Product side** (`app/**`):
- `synthesizeArtifact(req): Promise<ArtifactSpec>` in `mlApi.ts` (attaches
  `mlAuthHeaders`, like every other client call).
- **Source-selection UI** inside a concept notebook: checkboxes on question rows
  → an artifact-type picker (flashcards / mind map / slides / figure) → Generate.
  Assemble the F3 request from selected entries (client already has stem/choices
  via `getQuestionById`, and `workLines` on the entry).
- **Artifact renderers** (`app/src/components/artifacts/`):
  - `FlashcardDeck` — flip cards from `cards[]`. Pure JSON, easiest.
  - `FigureArtifact` — renders `figure` via Track A's `<InteractiveFigure>` (reuse).
  - `MindMap` — nodes/edges; **reuse the knowledge-graph viz** if cheap, else a
    simple radial/tree SVG. (v2 candidate.)
  - `SlideViewer` — ordered slides, prev/next, optional embedded figure. (v2 candidate.)
- Persist generated artifacts on the concept (Firestore under the student doc or
  a `student_artifacts` collection) so they're not regenerated every open —
  optional for v1, but cache in-memory at minimum.

---

## v1 cut + sequencing

Ship the **whole loop thin** before widening artifact types.

1. **A1 + A2 + A3** — Desmos for graphable questions, SVG everywhere else.
   (Self-contained; delivers the "interactive question figures" ask alone.)
2. **B1** — concept notebook + deterministic recall tags + source selection UI
   (Generate button can be stubbed until B2 lands).
3. **B2 with two artifact types only: `flashcards` + `figure`.**
   - `flashcards` = easiest possible renderer (pure JSON), proves the Groq
     synthesis + ontology-enrichment pipeline end-to-end.
   - `figure` = reuses Track A's renderer, proves the shared-primitive thesis.
4. **v2:** `mindmap` + `slides` renderers; recall-tag Groq upgrade; artifact
   persistence; GeoGebra for geometry figures.

**Recommended v1 artifact cut: flashcards + figure.** (Decision point — if you'd
rather prove mind-map/slides first, say so; the endpoint is type-agnostic, only
the renderers differ.)

---

## Lane ownership (file paths)

| Task | Lane | Files |
|------|------|-------|
| A1 FigureSpec + inference | Product | `app/src/lib/figureSpec.ts` (new), `app/src/components/QuestionFigure.tsx` (extract) |
| A2 Desmos renderer | Product | `app/src/components/InteractiveFigure.tsx` (new), `app/src/lib/desmosLoader.ts` (new), `.env`/`.env.production` (`VITE_DESMOS_API_KEY`) |
| A3 wire figures | Product | the practice/question view rendering `<QuestionFigure>` |
| B1 concept notebook | Product | `app/src/pages/StudentSessions.tsx`, `app/src/lib/workEvidence.ts`, `app/src/types/index.ts` (`recallTag?`) |
| B2 endpoint | Engine | `ml/serve.py`, `ml/mindcraft_graph/artifacts/` (new), `ml/generation/llm_client.py` (reuse) |
| B2 client + UI + renderers | Product | `app/src/lib/mlApi.ts`, `app/src/components/artifacts/**` (new), `StudentSessions.tsx` |

**Seam files (coordinate before changing):** `app/src/lib/mlApi.ts` (add one
client fn), `app/src/lib/questionBank.ts` (only if `FigureSpec`/`figure` type is
exported from here — prefer the new `figureSpec.ts` to avoid touching the seam),
`ml/serve.py` (add one endpoint).

## Constraints / non-goals

- **Anthropic is down** → all synthesis via Groq (ML). Recall tags need no LLM.
- **No GeoGebra in v1** — geometry figures stay SVG; revisit when authored
  construction specs exist.
- **Not full NotebookLM** — no grounded chat, no audio overview, no citations in
  v1. Just: select sources → generate one of a fixed set of artifacts.
- Deterministic engine discipline holds: the LLM renders language/structure; the
  ontology + student work supply the substance.

## Open questions (resolve before B2 Engine work)

1. **Groq output reliability for structured JSON.** The generation pipeline
   already saw ~30% bad-key rate (CLAUDE.md). Artifact JSON is simpler than
   question generation, but still validate hard + retry once. Watch the drop rate.
2. **Artifact persistence location** — `student_artifacts` collection vs. nested
   on the student doc. Firestore rules must allow the student to read/write only
   their own (mirror the `student_work` rules).
3. **Desmos API key** — confirm a real key vs. the public demo key (rate limits).
