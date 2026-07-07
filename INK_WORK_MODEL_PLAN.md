# Build plan: structured ink work model — strokes → lines → parse → highlight → hints

## Why (product goal)
Today `scratchImage` (PNG) + `scratchTranscription` ({text, latex}) is a flat
snapshot: good enough to display, useless for the real goal — **real-time
parsing of student work, highlighting the exact error ON the ink, and
generating hints from the specific mistake**. That requires knowing WHERE each
written line lives (spatial mapping back to the canvas) and validating steps
deterministically.

Architecture follows the repo's generative/deterministic split:
- **Model reads** (VLM transcribes ink → LaTeX per line) — language bookend.
- **Deterministic spine checks** (CAS verifies each step follows from the
  previous; first broken step = the error) — no hallucinated grading.
- **Existing machinery hints** (broken step → misconception/ingredient match →
  card/hint) — we already have 1,749 Eedi misconceptions and the ingredient
  runtime; this plugs in, not reinvents.

Known defect motivating this: transcription silently fails on complex
notation (integrals). Causes: 300px canvas → low-res glyphs; Haiku is the
weakest vision model; silent Groq (llama-4-scout) fallback is worse at math
notation; failures hide the pane so degradation is invisible.

## Phase 1 — capture the substrate (build NOW; cheap, unblocks everything)

### 1a — ScratchPad exposes strokes (Lane: **Product**, `app/**`)
- `ScratchPad.tsx`: extend `onChange` to also deliver the stroke data:
  `onChange?: (canvas: HTMLCanvasElement, strokes: Point[][]) => void` where
  `Point = [x, y, pressure]` (already what `strokesRef` holds). Include the
  css-pixel canvas size so coordinates stay interpretable:
  export shape `{ strokes: Point[][], width: number, height: number }`.
- Both consumers (SessionWork, ConceptChapterPage) persist it:
  `scratchStrokes: { strokes, width, height }` alongside `scratchImage` +
  `scratchTranscription` (types/index.ts `StudentWorkEntry`). JSON of a page
  of work is tens of KB — fine for Firestore, but round coordinates to 1
  decimal to keep it lean.
- [ ] Drawing in SessionWork lands strokes JSON in the studentWork doc.

### 1b — transcription quality fixes (Lane: **Engine**, `webhook/**`)
In `transcribe-scratch.ts`:
- Add `temperature: 0` to the Anthropic call (Groq already has it).
- Accept optional `lines: [{ imageBase64 }]` (per-line crops — see Phase 2);
  when present, transcribe each crop and return per-line results.
- Add `model` escape hatch: env `TRANSCRIBE_MODEL` (default stays haiku;
  lets us A/B Sonnet on integral-heavy work without a code change).
- Response gains `perLine?: [{ text, latex }]` while keeping the flat
  `{ text, latex }` for back-compat.
- [ ] Same PNG twice → identical output (temperature 0).

### 1c — export resolution (Lane: **Product**, `app/**`)
- `ScratchTranscriptionPane` / consumers: export the canvas at 2x for the
  transcription call (`toDataURL` from an offscreen 2x redraw, or send the
  device-pixel-ratio backing store instead of css-size). Integral glyphs at
  300px are at the edge of legibility for any model. Stay under the
  endpoint's 1.5 MB cap (2x of a 300px canvas is nowhere near it).
- Replace the silent-hide on failure with a subtle state: pane shows
  “Couldn't read this yet — keep writing or fix it by hand” with the edit
  boxes open, instead of disappearing. Silent degradation is how we missed
  the integral failure.
- [ ] Draw an integral (∫ x² dx); transcription either gets it right at 2x
      or visibly says it couldn't — never silently wrong/absent.

## Phase 2 — line model + spatial mapping (the highlight substrate)

Lane: **Product** for segmentation + overlay, **Engine** for the endpoint
change (1b already covers it).

- **Deterministic line segmentation** (no ML): cluster strokes into written
  lines by vertical overlap — sort strokes by their bbox top; a stroke joins
  the current line if its y-range overlaps the line's y-range by >30% or its
  top is within ~0.6 line-heights; else new line. Pure geometry,
  unit-testable (`lib/inkLines.ts`, vitest with synthetic stroke fixtures).
- Each line → bbox + member stroke indices → crop the canvas region (with
  padding) → per-line transcription via 1b's `lines` param. Per-line crops
  are bigger and simpler than the whole page — this alone should fix most
  integral-class failures.
- Persisted shape becomes:
  `workLines: [{ bbox: [x,y,w,h], strokeIdx: number[], latex, text,
  editedByStudent }]` (keep the flat scratchTranscription as derived
  concatenation for anything that reads it today).
- **Highlight overlay**: absolutely-positioned div over the canvas that can
  tint a line's bbox (amber = suspect step). Renders from `workLines[i].bbox`
  — no canvas re-render needed. Ship it behind a prop; Phase 3 drives it.
- [ ] Multi-line work → N workLines with sane bboxes (eyeball with a debug
      outline toggle).
- [ ] Editing one line's LaTeX updates only that line.

## Phase 3 — deterministic step check + misconception hints (the payoff)

Lane: **Engine** (`ml/**`), consumed by Product.

- New ml endpoint `POST /check-work`: body
  `{ student_id, problem_text?, lines: [{ latex }] }`. For each consecutive
  pair, sympy-parse both sides and test equivalence / valid transformation.
  Response: `{ firstBrokenLine: number | null, verdictPerLine: [...],
  hypothesis?: { misconception_id, label } }`.
  - Parsing failures are verdict `unparsed`, never `wrong` — a model misread
    must not become a red highlight on correct work. Only flag a line when
    both it and its predecessor parsed cleanly AND they're inequivalent.
  - Misconception hypothesis: match the broken transformation against the
    Eedi misconception embeddings (same technique as
    `enrich_ontology_misconceptions.py`) — deterministic ranking, no LLM.
- Frontend: debounce after transcription settles → `/check-work` → amber
  highlight on `firstBrokenLine`'s bbox + hint chip sourced from the
  misconception label / ingredient card (reuse the “Common trap” pattern
  from Practice). Student-edited lines re-check.
- Hint LANGUAGE may use an LLM later (AGENT_RULEBOOK contract first); hint
  SELECTION stays deterministic.
- [ ] Seed test: 3-line derivation with a sign error on line 2 → line 2
      flagged, lines 1/3 clean, plausible misconception attached.
- [ ] Correct multi-line work → zero highlights (false-positive guard: run
      against ~20 correct worked examples before shipping the overlay on).

## Sequencing / notes
- Phase 1 is small and independent — do it immediately so every scratch
  session from now on captures strokes (data we can never recover
  retroactively).
- Phase 2 before any “real-time” framing: per-line transcription IS the
  accuracy fix and the highlight substrate.
- Phase 3 rides on existing ml infrastructure (sympy is already a transitive
  dep of the scientific stack — verify in `ml/pyproject.toml`, add if not).
- Real-time cadence: keep the 3s-after-stroke debounce; “real-time” means
  per-pause, not per-stroke — cost and UX both prefer it.
- MyScript iink (stroke-based commercial recognizer) remains the upgrade
  path if VLM per-line accuracy still disappoints — Phase 1a's stroke
  persistence is exactly the input it needs, so nothing is wasted.
