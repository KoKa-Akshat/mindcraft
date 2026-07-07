# Build plan: admin view-all-pages + ScratchPad transcription + LaTeX completeness

Three independent tasks. A and C are pure Product lane; B spans webhook
(Engine) + app (Product) — build B1 before B2. Check acceptance boxes in
this file as work lands.

Grounding done 2026-07-07 (line numbers verified against current main +
working tree — re-verify after pulling):
- MathText (`app/src/components/MathText.tsx`) handles `$...$`, `$$...$$`,
  `\(...\)`, `\[...\]`, has a currency false-positive guard (verified
  against real Eedi price questions), and falls back to raw text on
  malformed TeX. It is only wired into Practice.tsx and GradeOnboard.tsx.
- Bank LaTeX reality: Eedi + actMaster are ~98% plain text (their `$` hits
  are currency, correctly NOT rendered as math). The inline static bank in
  `questionBank.ts` has ~37 lines of real TeX (`\frac`, `\sqrt`).
  `actDiagnostic.json` has zero TeX. So the exposure is: static-bank
  questions rendered on surfaces that don't use MathText.
- ScratchPad (`components/ScratchPad.tsx`) is a perfect-freehand canvas;
  SessionWork.tsx already exports it via `toDataURL('image/png')` into
  `studentWork.scratchImage`. ConceptChapterPage.tsx also mounts it.
- `webhook/api/gemini.ts` already contains a working Anthropic vision
  pattern (base64 image → `claude-haiku-4-5`) — copy that shape.

---

## Task A — Admin can open every student-facing page (Lane: **Product**, `app/**`)

The Admin sidebar "View dashboards" section currently links `/tutor` and
`/parent`. Add the student surfaces:

- **Student Dashboard** → `/dashboard`
- **Practice** → `/practice`
- **Knowledge Map** → `/knowledge-graph`

Same `sideItem` styling block in `Admin.tsx` (below the tutor/parent
links). Dashboard already exempts tutors/admins from the forced gap-scan
gate, so no gating changes needed — the pages will show the admin's own
(mostly empty) data, which is fine for inspection.

### Acceptance
- [ ] From `/admin`, an admin can reach dashboard, practice, knowledge
      graph, tutor, and parent pages and back (each of those pages links
      to `/admin` or has nav back — add a small "Admin Panel" side link on
      any that lack one, matching TutorDashboard.tsx:555's pattern but use
      react-router `<Link>`, not `<a>`).
- [ ] No student-only redirect fires for the admin on any of them.

---

## Task B — ScratchPad live transcription pane

Student writes on the canvas; below it, a pane shows the work transcribed
to plain text / LaTeX, editable by the student, KaTeX-rendered preview.
Transcription text is what the ML layer can actually parse later — store
it alongside the existing `scratchImage`.

### B1 — `webhook/api/transcribe-scratch.ts` (Lane: **Engine**, `webhook/**`)

- POST `{ imageBase64: string }` + `Authorization: Bearer <Firebase ID token>`.
  Verify the token (same pattern as link-child/join-classroom). Cap body
  size (canvas PNGs at 320px height are small; reject > ~1.5 MB).
- Vision call: copy the image pattern from `gemini.ts` (`claude-haiku-4-5`,
  base64 image block). Prompt contract: "Transcribe the handwritten math
  work in this image. Return JSON: { text: string, latex: string }. text =
  plain-language reading; latex = the same work as LaTeX using $...$
  inline delimiters, one line per written line. If the image is blank or
  illegible return { text: '', latex: '' }." Parse defensively (model may
  wrap in fences).
- **Provider note**: CLAUDE.md says Anthropic credits were exhausted (the
  gemini.ts endpoint may 400). Check whether credits are back before
  building on it; if still dead, use Groq vision
  (`meta-llama/llama-4-scout-17b-16e-instruct`, GROQ_API_KEY already in
  Vercel for other endpoints — verify) behind the same response contract.
- Add the call contract (input/output schema, model, latency budget ~4s,
  fallback = empty strings + `unavailable: true` flag) to
  AGENT_RULEBOOK.md — it owns every LLM call contract.
- [ ] Endpoint deployed; returns sane JSON for a test PNG; 401 without
      token; graceful `{ text:'', latex:'', unavailable:true }` when the
      provider errors (the UI must never break because transcription is
      down).

### B2 — Transcription pane UI (Lane: **Product**, `app/**`)

In BOTH ScratchPad consumers (`SessionWork.tsx`, `ConceptChapterPage.tsx`):

- Below the canvas: a "What we read" pane. Debounce: call
  transcribe-scratch ~3s after the last stroke ends (ScratchPad `onChange`
  already fires with the canvas — hash/compare dataURL to skip no-change
  calls). Never more than one in-flight request; drop stale responses.
- Show `latex` rendered through MathText, with an edit toggle exposing a
  textarea of the raw transcription the student can correct. Edits win
  over later auto-transcriptions of unchanged ink (don't clobber a manual
  edit unless the drawing changed afterward).
- Persist: wherever `scratchImage` is saved (SessionWork studentWork doc),
  also save `scratchTranscription: { text, latex, editedByStudent: boolean }`.
- If the endpoint returns `unavailable`, hide the pane quietly (no error
  banner — transcription is an enhancement, not a dependency).
- Copy per BRAND_BOOK voice (e.g. pane label + "fix anything we misread").
- [ ] Draw an equation → pane fills within a few seconds, renders KaTeX.
- [ ] Manual edit sticks; further drawing re-transcribes.
- [ ] Transcription lands in Firestore next to scratchImage.

---

## Task C — LaTeX rendering completeness (Lane: **Product**, `app/**`)

MathText exists and works, but several surfaces render bank text raw.
The static bank's ~37 TeX-bearing questions (and any future generated
questions, which are TeX-tagged by contract C5) show raw `\frac{..}` on:

1. **Practice.tsx hints** (~line 2082: `{h}`) — wrap: `<MathText text={h} />`.
2. **Practice.tsx explanation** (~line 2155: `{currentQ.explanation}`) —
   wrap in MathText.
3. **ConceptChapterPage.tsx** — renders bank questions (question pages with
   choices/hints/explanations) with NO MathText import. Wire question text,
   choices, hints, explanation through MathText, same as Practice.
4. **Book components** (`components/book/StudyPlanList.tsx` etc.) — check
   whether any render question/concept text that can carry TeX; wrap where
   they do.
5. Sweep for stragglers: `grep -rn "\.question\b\|\.explanation\b\|hints\["
   app/src --include="*.tsx"` and confirm every render site of bank fields
   goes through MathText.

Verification (manual, ~10 min): pick a static-bank question containing
`\frac` (grep questionBank.ts), force it into a session (concept + level),
confirm hints + explanation + chapter page all render math properly; then
load an Eedi currency question ("theme park charges $ 8 entry fee...") and
confirm it renders as prose, not math.

- [ ] All five render-site groups wrapped.
- [ ] Manual check: TeX question renders on Practice (question, choices,
      hints, explanation) and ConceptChapterPage.
- [ ] Manual check: currency questions unaffected.
