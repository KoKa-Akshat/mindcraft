# Build plan: Homework upload → parsed work pages → journal save

**STATUS: implemented directly in this same session, not handed off.** This
was originally written as a handoff brief for Cursor when a session-limit
interruption looked imminent. The interruption resolved and the same agent
continued and built the full feature end to end in the working tree (see the
final report for the exact file list). Kept here as the design rationale and
grounded-facts record — the "one correction from the coordinator" was routing
the new endpoint through `app-actions.ts` instead of its own Vercel function
(Hobby plan function count), which the actual implementation follows.

Repo: `/Users/akoirala/Developer/mindcraft` (canonical checkout, NOT the
iCloud-synced Desktop copy). Recon was done at commit `b6f59036`. Nothing in
this repo was committed or pushed; everything is left uncommitted for review.

Read before coding: `CLAUDE.md`, `BRAND_BOOK.md`, `AGENT_RULEBOOK.md`
(your new endpoint gets a contract there, spec below).

---

## The feature (owner's words, paraphrased)

Student uploads a PDF (or photo) of their homework → system extracts the
individual questions → each becomes an interactive page on the dashboard
where the student works the problem (math rendering, scratch pad, calculator,
graphing) → they can get guided help or reach their tutor mid-problem → on
completion the whole session auto-saves into their journal as session notes.

Ship a working V1 of the full loop (upload → parse → work pages → save).
If time runs short, cut breadth (calculator/graphing wiring) before depth
(the core loop must work end to end).

---

## Grounded facts (all verified against the current tree — trust these)

- **`webhook/api/transcribe-scratch.ts` is the template for the new
  endpoint.** It has everything: Firebase ID token verification via
  `auth.verifyIdToken` (from `../lib/firebase`), `setCors(res)` (from
  `../lib/cors`), `withTimeout()`, defensive `safeJson()` fence-stripping,
  Anthropic `claude-haiku-4-5-20251001` vision primary →
  Groq `meta-llama/llama-4-scout-17b-16e-instruct` vision fallback, 1.5MB
  per-image cap, fail-soft `{ ..., unavailable: true }` response. Copy its
  structure wholesale.
- **Anthropic credits may still be exhausted** (CLAUDE.md gotchas). The
  try-Anthropic-then-Groq cascade means the endpoint works either way.
  GROQ_API_KEY is confirmed live (owner tested it) and is already set in
  Vercel env for other endpoints. Do NOT build against Anthropic alone.
- **Groq vision cannot accept PDFs, only images.** Therefore PDF → page
  images must happen client-side (also keeps the endpoint provider-agnostic
  and dodges Vercel's 4.5MB request body limit via chunking).
- **`pdfjs-dist` is NOT yet in `app/package.json`.** Add it:
  `cd app && npm install pdfjs-dist --legacy-peer-deps` (the
  `--legacy-peer-deps` flag is REQUIRED in this repo). Vite wiring:
  `import * as pdfjsLib from 'pdfjs-dist'` +
  `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` +
  `pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl`.
- **Vercel function count**: `webhook/api/` has 13 files but `vercel.json`
  maps only 12 (the co-founder added `spark-experience.ts` on 2026-07-10
  without a vercel.json entry). The old Hobby-plan cap was 12 functions
  (`app-actions.ts` header comment). Since a 13th shipped yesterday, adding
  `parse-homework.ts` as a 14th follows current team practice — but FLAG
  this in your report; if deploys start failing on function count, the
  fallback is to fold parse-homework into `gemini.ts` as
  `{ action: 'parse-homework' }` (it already dispatches by action,
  maxDuration 30).
- **Work surface pattern**: `app/src/pages/SessionWork.tsx` mounts
  `ScratchPad` (`onChange(_canvas, strokeData)` → `exportScratchImage(...)`)
  + `ScratchTranscriptionPane` (`imageDataUrl`, `strokeData`, `resetKey`,
  `onChange: (ScratchInkState | null) => void`, `onDebugChange`), collects
  `scratchImage`, `scratchStrokes`, `scratchInk.workLines`,
  `scratchInk.transcription`, and persists via `saveQuestionWork()` from
  `app/src/lib/studentWork.ts` into the `student_work` collection. Copy this
  mount exactly, per question page.
- **`WorkSource`** union in `app/src/types/index.ts` is
  `'practice' | 'chapter' | 'session'` — extend with `'homework'`.
  `workDocId(studentId, questionId)` = `${studentId}__${questionId}`, so give
  each homework question a stable id like `hw_{homeworkId}_q{index}` and the
  existing plumbing just works.
- **Math rendering**: `app/src/components/MathText.tsx` (default export,
  prop `text`). All question text/choices/hints must render through it. It
  handles `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, has a currency guard,
  falls back to raw text on malformed TeX.
- **Calculator**: `app/src/components/ScientificCalculator.tsx` exports
  `ScientificCalcPanel` and `ScientificCalcToggle`. See how `Practice.tsx`
  mounts them (imports at line ~11, `showCalc` state at ~368, toggle+panel
  at ~2255-2290). Reuse that pattern.
- **Graphing**: `app/src/components/InteractiveFigure.tsx` +
  `app/src/lib/figureSpec.ts` + `lib/desmosLoader.ts`. This is LOWEST
  priority — extracted homework questions won't carry a `figure` spec in V1;
  it's fine to ship without graphing (cut-breadth-first rule). If you wire
  it, only mount when a parsed question has a figure-worthy note.
- **Guided help**: `getIngredientCards(studentId, problemText, maxCards)` in
  `app/src/lib/mlApi.ts` → `POST ${ML_BASE}/recommend-ingredients`, returns
  `IngredientRecommendResult` with `cards[]` (`title`, `body`, `prompt`).
  This is the deterministic fallback the rest of the app already uses while
  `mindcraft-homework` is down (see Practice.tsx:1403 fallback). Use it as
  the hint path. Do NOT invent a third help path.
- **Tutor call**: `app/src/components/SessionCallCard.tsx` is for booked
  sessions inside a call window — NOT the right entry for self-directed
  homework. Dashboard.tsx (lines ~140-151) already shows the pattern for
  fetching a tutor's permanent room: read `users/{tutorId}` doc →
  `googleMeetUrl` field. `useStudentData` exposes `tutorId` only from an
  upcoming session doc, so ALSO try `users/{uid}.tutorId` (server-written
  field, readable). UX decision (documented tradeoff): tutors are not
  reliably online, so do not fake a live "calling…" UI. Ship a quiet
  "Ask your tutor" affordance on each work page that (a) opens the tutor's
  Meet room in a new tab when `googleMeetUrl` exists, and (b) links to the
  existing chat (`/chat` — chat id is `[uid, tutorId].sort().join('_')`,
  see useStudentData ~line 213) so the student can leave a message with the
  question number. If no tutor is linked, hide the affordance entirely.
- **Journal display**: `DashboardNotesPanel.tsx` reads `sessions` where
  `studentEmail == user.email` and `summary.published` — the `sessions`
  collection is server-authoritative (client writes will likely be rejected
  by rules). DO NOT write homework entries into `sessions`. Instead merge a
  second query over the new homework collection into the notes list
  client-side (see Data model below).
- **Firestore rules**: `firebase/firestore.rules` — CHECK IT before picking
  the collection path. Confirm a student can create/read their own docs in
  the collection you choose. `student_work` writes already work from the
  client (SessionWork.tsx does it), so mirroring its rule shape is the safe
  bet. If no existing rule covers a new top-level collection, prefer
  `users/{uid}/homeworkSessions/{id}` IF rules allow subcollection writes
  under the user's own doc; otherwise add a `homework_sessions` rule to
  `firebase/firestore.rules` in the same shape as `student_work`'s (do NOT
  deploy rules yourself — flag it; rules deploy via
  `webhook/scripts/deploy-rules.ts`, owner runs it).
- **Dashboard structure**: `Dashboard.tsx` is a two-page Field Journal book
  (`BookShell`, `BookPage`). Right-page panels switch on `?view=` param
  (`today | gps | route | notes | homework(solver) | saved`). Left page has
  `CoverNavSection`/`CoverNavItem` entries. NOTE: `view=homework` is ALREADY
  TAKEN by the Solver panel — use a different key, e.g. `view=worksheet`.
- **C4 hide-correctness does NOT apply here** — this is the student's real
  homework, not a diagnostic. Guidance may be shown. But hints must never
  reveal final answers (AGENT_RULEBOOK hint rules + "not a homework helper
  that hands out answers" anti-positioning: the hint path builds seeing,
  the ingredient cards do exactly that).

---

## Copy rules (hard requirements)

- ZERO em dashes anywhere in new copy or generated text. This was just
  purged codebase-wide (commit `b6f59036`); do not reintroduce.
- BRAND_BOOK voice: second person, present tense, declaratives, sentence
  case, no exclamation marks, no emoji in product copy. Errors take
  ownership ("It's on us."). Success is spare ("There it is.").
- Vocabulary table applies: never "wrong/incorrect", never "quiz", never
  "try again", never "user". Calibrate against the rewritten `storyContext`
  lines in `app/src/data/eediQuestions.json`.
- Suggested strings (safe to use verbatim):
  - Nav item: label "Homework", sub "Drop a worksheet, work it here"
  - Dropzone: "Drop your homework here" / "A PDF or a clear photo works"
  - Parsing: "Reading your pages…" → "Found {n} questions."
  - Ambiguous split marker: "We may have split this one oddly. Read it
    before you start."
  - Hint: "Get a hint"
  - Tutor: "Ask your tutor"
  - Save state: "Saved to your journal"
  - Completion: "That's the run. It's in your journal now."
  - Parse failure: "We could not read that upload. It's on us. Try a
    clearer photo or a different page."

---

## Build steps

### 1. `webhook/api/parse-homework.ts` (new file)

Clone the structure of `transcribe-scratch.ts`. Contract:

**Request** — `POST /api/parse-homework`,
`Authorization: Bearer <Firebase ID token>` (verify, 401 otherwise), JSON:

```json
{
  "pages": [{ "imageBase64": "data:image/jpeg;base64,..." }],
  "startPage": 0
}
```

- `pages`: 1-4 page images per call (reject >4 with 400; client chunks).
- Each image ≤ 1.5MB base64 (413 otherwise). `startPage` = zero-based index
  of `pages[0]` in the full document (for logging/labels only).

**Response**:

```json
{
  "questions": [
    {
      "number": "3",
      "text": "Solve $2x + 5 = 13$ for $x$.",
      "choices": ["A. 4", "B. 9"],
      "figureNote": "a right triangle with legs 6 and 8",
      "continuesFromPrevious": false,
      "ambiguous": false
    }
  ],
  "pageCount": 2,
  "unavailable": false
}
```

- `number`: question label as printed (`"3"`, `"4a"`), else null.
- `text`: full question text; math in `$...$` LaTeX. Sub-parts of one
  numbered question stay TOGETHER in one item (a/b/c inside `text`).
- `choices`: array when multiple choice, else null.
- `figureNote`: short description of a required diagram, else null.
- `continuesFromPrevious`: true when the FIRST question of a page continues
  the previous page's last question (client merges across chunks).
- `ambiguous`: true when the model is unsure it split correctly — the UI
  shows the gentle marker, never silently guesses.

**Behavior**: one vision call per page (system prompt = extraction contract
+ JSON schema; user message = the page image), pages within a call run via
`Promise.all`. Merge `continuesFromPrevious` items into their predecessor
within the call; leave the flag set only on the first question of the chunk.
Cap output text at 2000 chars/question. Parse defensively (strip fences,
find first `[`/`{`). Temperature 0.

**Model**: `claude-haiku-4-5-20251001` vision primary; on ANY Anthropic
error fall back to Groq `meta-llama/llama-4-scout-17b-16e-instruct` (same
schema). Per-page timeout 20s.

**Fallback**: `{ "questions": [], "pageCount": N, "unavailable": true }` —
valid shape, never a 5xx for provider failures.

**vercel.json**: add `"api/parse-homework.ts": { "maxDuration": 60 }`.

**System prompt rules** (put constraints in system, data in user message,
per AGENT_RULEBOOK §2.2): transcribe and split only; do NOT solve, answer,
or annotate; do NOT invent questions for decorative content; instructions
that apply to a block ("Use the graph below for questions 5-7") get copied
into each affected question's `text`; if a page has no questions return [].

### 2. AGENT_RULEBOOK.md — add §1.8 `/parse-homework`

Same format as §1.6 `/transcribe-scratch`: purpose, reads-from-engine
(none; token verification only), input contract, output contract, model
row, latency budget (20s/page-chunk; UI shows a reading state, this is not
an in-session call), rules, fallback. Also add a row to the §2.4 fallback
table and §2.5 model table (`Homework page parsing | claude-haiku-4-5
vision, fallback llama-4-scout (Groq) | page-image → structured JSON`).

### 3. `app/src/lib/homework.ts` (new client lib)

- `rasterizePdf(file: File): Promise<string[]>` — pdfjs-dist, render each
  page to canvas at ~1.6x scale capped 1400px wide, export
  `toDataURL('image/jpeg', 0.8)`. Cap 12 pages (tell the student politely
  above that).
- `prepareImage(file: File): Promise<string>` — downscale photos to max
  1600px, JPEG 0.82.
- `parseHomework(pages: string[]): Promise<ParsedHomeworkQuestion[]>` —
  chunk pages into groups of ≤3, POST each chunk to
  `${WEBHOOK_BASE}/api/parse-homework` (WEBHOOK_BASE from `lib/mlApi.ts`)
  with the Firebase ID token (`auth.currentUser?.getIdToken()`), merge
  cross-chunk `continuesFromPrevious`, assign ids `q0…qN`.
- Firestore CRUD for the session doc (see data model): `createHomeworkSession`,
  `loadHomeworkSession`, `updateHomeworkProgress`, `completeHomeworkSession`,
  `listHomeworkSessions(uid)`.

### 4. Data model

Extend `app/src/types/index.ts`:

```ts
export type WorkSource = 'practice' | 'chapter' | 'session' | 'homework'

export interface HomeworkQuestion {
  id: string            // "q0", "q1", …
  number: string | null
  text: string
  choices: string[] | null
  figureNote: string | null
  ambiguous: boolean
}

export interface HomeworkSessionDoc {
  id: string
  studentId: string
  title: string          // e.g. "Homework · algebra worksheet" from filename
  sourceFileName: string
  pageCount: number
  questions: HomeworkQuestion[]
  currentIndex: number
  status: 'in_progress' | 'completed'
  createdAt: number
  updatedAt: number
  completedAt?: number
}
```

Collection: `homework_sessions/{autoId}` (or `users/{uid}/homeworkSessions`
if rules force it — CHECK `firebase/firestore.rules` first, see grounded
facts). Per-question ink/work goes through the EXISTING
`saveQuestionWork(uid, { source: 'homework', questionId:
'hw_{homeworkId}_{q.id}', conceptId: 'homework_upload', prompt: q.text,
… })` path into `student_work` — do not build a parallel store for ink.

### 5. Dashboard entry point (`Dashboard.tsx`)

- New left-page `CoverNavItem` (icon: `FileUp` or `Upload` from
  lucide-react) label "Homework", sub "Drop a worksheet, work it here",
  opens `?view=worksheet`.
- New right-page fore-edge tab "Homework" + panel for `view=worksheet`:
  new component `DashboardHomeworkUploadPanel.tsx` styled like the other
  panels (`DashboardPanels.module.css` patterns / paper aesthetic):
  - Dropzone (drag + click; accept `application/pdf,image/jpeg,image/png,
    image/webp`) — reuse the file-drop mechanics from `PanicInput.tsx`.
  - Progress states: rasterizing → "Reading your pages…" → "Found n
    questions." → primary button "Start working" →
    `navigate('/homework/{id}')`.
  - Below: list of past homework sessions (`listHomeworkSessions`) with
    status + "continue" / "read it in your journal".

### 6. Work pages — `app/src/pages/HomeworkSession.tsx` (new route `/homework/:homeworkId`)

Register the route wherever `/session-work/:sessionId` (SessionWork) is
registered (check `App.tsx` / `main.tsx` routing). Page structure copies
SessionWork.tsx's shell:

- Header: back to dashboard, title, progress "Question {i+1} of {n}".
- Question card: `number` label, `<MathText text={q.text} />`, choices via
  MathText, `figureNote` as an italic aside ("The sheet shows: …"),
  ambiguous marker when flagged.
- Work surface: `ScratchPad` + `ScratchTranscriptionPane` exactly as
  SessionWork.tsx mounts them (keyed per question so the canvas resets).
- `ScientificCalcToggle` + `ScientificCalcPanel` (Practice.tsx pattern).
- "Get a hint": lazy `getIngredientCards(uid, q.text, 4)` → render returned
  cards (title/body/prompt via MathText) in a collapsible pane; if null/
  empty: "No hint path for this one yet. Your tutor can walk it with you."
- "Ask your tutor": per the tradeoff above (Meet room + chat link; hidden
  when no tutor).
- Next/previous: saving per question on advance via `saveQuestionWork` and
  `updateHomeworkProgress` (fire-and-forget, fail-soft like SessionWork).
- Last question's advance → `completeHomeworkSession` → completion card
  ("That's the run. It's in your journal now.") with links back to
  dashboard and to notes view.

### 7. Journal save + display

- Completion stamps the session doc `status: 'completed'`, `completedAt`,
  and a compact `summary` on the doc: `{ title, date, bullets }` where
  bullets are per-question one-liners ("Q3 · worked, transcription saved"
  style, derived from whether ink/transcription exists — deterministic, no
  LLM needed for V1).
- `DashboardNotesPanel.tsx`: add a second listener/query over the homework
  collection for the signed-in student, map completed homework sessions
  into the same `Session` card shape (subject: "Homework",
  tutorName: "your own work"), merge + date-sort with tutor notes. Homework
  detail leaf shows the bullets and links to `/homework/{id}` for the full
  work. Check `pages/StudentSessions.tsx` and do the same merge there if
  it's cheap; otherwise the dashboard notes panel is enough for V1.

### 8. Verification (all required before reporting done)

1. `cd app && npx tsc --noEmit` clean.
2. `cd app && npm run build` clean.
3. `cd webhook && npx tsc --noEmit` (check how the webhook package
   typechecks; match existing config) clean.
4. LIVE trace of the endpoint logic: run the parse function against a real
   or synthetic homework page image (there are sample papers under
   `ml/data/past_papers/`; or render a quick 3-question worksheet to PNG)
   using GROQ_API_KEY from `ml/.env.local` in a local script
   (`npx tsx` scratch file OUTSIDE the repo or deleted after). Confirm the
   questions array is sane: correct count, math as LaTeX, no solving. Do
   not assume it works because it compiles.
5. Manual app trace: `cd app && npm run dev`, upload a small PDF, walk a
   question, draw ink, advance, complete, confirm the Firestore docs and
   the journal entry appear.
6. Sweep your new copy: `grep -rn "—" <your new files>` must return nothing
   (em dash ban), no exclamation marks, no banned vocabulary.

### 9. Report back (owner requirement)

Files created/touched; the endpoint's exact input/output contract; which
vision provider actually answered during your live trace and why; the tutor
UX tradeoff (documented above — restate it); what the journal entry looks
like; tsc/build confirmation; anything untested or uncertain, stated
honestly. Do not commit or push.

---

## Open questions the owner should rule on (flag, don't block)

1. Vercel function count (14th function) — see grounded facts.
2. Firestore rules for the new collection — if a rules edit is needed, the
   owner deploys it via `webhook/scripts/deploy-rules.ts`.
3. `conceptId` for homework work docs is a placeholder
   (`homework_upload`) — a future pass could classify each question to a
   canonical concept via the ingredient pipeline's classifier and feed
   `/record-outcomes`. Deliberately out of V1 scope (keeps the deterministic
   engine's evidence clean).
4. Graphing (Desmos) wiring is the sanctioned breadth cut if time ran out.
