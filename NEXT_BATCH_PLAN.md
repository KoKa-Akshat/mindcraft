# Next batch: Google sign-in fix, ScratchPad in ConceptChapterPage, Classroom UI, MathText currency bug

Four independent fixes/features. Rules fix from the last session (`studentWork`
list-query bug) is already committed and deployed — not part of this batch.

---

## 1. Google sign-in: "Unable to process request due to missing initial state"

**Root cause:** `Login.tsx`'s `handleGoogle()` (~line 182) uses
`signInWithRedirect(auth, googleProvider)`, with the result picked up later via
`getRedirectResult(auth)` in a `useEffect` (~line 87). Redirect-based auth
requires the browser to persist pending-auth state (sessionStorage/IndexedDB)
across a full top-level navigation to `accounts.google.com` and back — this is
exactly what modern storage-partitioning (Safari ITP, Chrome experiments,
privacy-focused browsers) blocks, producing Firebase's
`auth/missing-initial-state` / "Unable to process request due to missing
initial state" error. This is a well-known class of failure with
`signInWithRedirect`, not something specific to this app's config.

**Fix:** switch to `signInWithPopup`, which doesn't depend on persisted state
surviving a navigation — the popup returns the credential directly via
`postMessage`, in the same function call.

### `app/src/pages/Login.tsx` changes

Remove the `getRedirectResult` effect (~lines 87-106) — no longer needed.

Rewrite `handleGoogle()` (~line 182):
```tsx
import { signInWithPopup } from 'firebase/auth'  // replaces signInWithRedirect, getRedirectResult

async function handleGoogle() {
  setError('')
  setLoading(true)
  try {
    const cred = await signInWithPopup(auth, googleProvider)
    const isNew = cred.user.metadata.creationTime === cred.user.metadata.lastSignInTime
    await routeAfterLogin(cred.user.uid, isNew)
  } catch (e: any) {
    const msg = friendlyError(e.code ?? e.message ?? 'unknown')
    if (msg) setError(msg)
    setLoading(false)
  }
}
```

Check `friendlyError()`'s error-code map — popup flows have their own set of
common codes worth mapping to friendly text if not already covered:
`auth/popup-closed-by-user` (user closed the popup — should be a silent no-op,
not an error message), `auth/popup-blocked` (browser blocked the popup —
tell the user to allow popups for this site), `auth/cancelled-popup-request`
(a second popup was triggered before the first resolved — silent no-op, can
happen if a user double-clicks "Continue with Google").

**Known tradeoff:** popups are blocked by some mobile browsers / in-app
webviews (this is exactly the flip side of CLAUDE.md's existing "IDE embedded
browsers often break Google OAuth" note — that note was about popups/redirects
both being flaky in embedded contexts; moving to popup fixes the redirect
failure mode but doesn't fix embedded-webview cases, which have no good
Firebase Auth answer short of a native flow). This is still the right
trade — `signInWithRedirect`'s failure mode is broader (affects normal Safari
users, not just embedded browsers).

**Test:** sign in with Google in a real Safari/Chrome browser (not an embedded
IDE browser), confirm the popup opens, completes, and routes correctly by
role. Also test canceling the popup (click the X) — should return to the
login screen with no error message, not a scary "missing initial state"
retry-of-the-bug.

---

## 2. Replace/augment ConceptChapterPage's plain-text notepad with ScratchPad

**Current state:** `ConceptChapterPage.tsx` has a "lined notepad" (~line 519,
`<div className={s.notepad}>`) — a plain `<textarea>` positioned to the right
of each question ("your work" label). Works for typed text, but can't render
handwritten math notation (integral signs, fraction bars, etc.) — exactly the
gap `ScratchPad.tsx` (built last session for `SessionWork.tsx`, Canvas +
Pointer Events + `perfect-freehand`) already solves.

**`ScratchPad.tsx` today** (`app/src/components/ScratchPad.tsx`) is a
self-contained component: `<ScratchPad onChange={(canvas) => ...} height={...} />`,
manages its own drawing state internally, calls `onChange` with the live
canvas element on every completed stroke or clear. No changes needed to the
component itself — this is purely an integration task.

### `app/src/pages/ConceptChapterPage.tsx` changes

Replace the `<textarea className={s.notepadArea} ...>` (~line 533) with
`<ScratchPad>`, keyed per question so switching problems gets a fresh canvas
(same pattern `SessionWork.tsx` already uses: `key={`${step}-${prompt}`}`):

```tsx
import ScratchPad from '../components/ScratchPad'

// inside the notepad render, replacing the textarea:
<ScratchPad
  key={spec.qIdx}
  height={240}
  onChange={canvas => {
    // Persist per-question, same shape as the old notes state —
    // store the data URL instead of raw text.
    setNotes(n => ({ ...n, [spec.qIdx]: canvas.toDataURL('image/png') }))
  }}
/>
```

**Decide on the `notes` state shape change carefully**: `notes` is currently
`Record<number, string>` holding typed text — switching to storing a canvas
data URL changes what "notes" means (image vs text) and affects anything else
that reads `notes[qIdx]` (check `notepadClear`'s `onClick` at ~line 523, and
anywhere `notes` is used elsewhere in this file, e.g. if it's ever
submitted/saved anywhere — a quick grep for `notes` in this file before
changing the type, since this doc hasn't traced every consumer of that state).

**Design question worth resolving before building, not guessing**: should the
new ScratchPad note space REPLACE the textarea outright, or coexist alongside
it (canvas above, small text box below for anyone who prefers typing simple
notes)? Full replacement is simpler and matches the "handwriting is strictly
better for math notation" framing, but loses the ability to quickly type a
one-line note without switching to drawing. Recommend full replacement given
the explicit ask ("that is where this new writing logic should exist"), but
flag this as the one open call before implementing.

**Test:** open a concept chapter, confirm each question page shows a
`ScratchPad` instead of a textarea, draw something (including something
integral-sign-like — a tall curvy stroke), switch to the next question,
confirm the canvas resets (fresh key), switch back and confirm — per the
`SessionWork.tsx` precedent, note state does NOT currently round-trip drawn
content back onto re-mount (neither `SessionWork` nor this integration
persists/reloads a saved canvas image as pixels — only saves the flattened
PNG to Firestore/state, doesn't restore it into canvas strokes). That's
consistent with how the feature already works elsewhere; not a regression to
worry about, just don't expect "undo redraw" round-tripping.

---

## 3. Classroom UI (frontend for the already-built backend)

**Status recap:** `webhook/api/create-classroom.ts` / `join-classroom.ts` and
the `Classroom` type all exist and work (verified via code review last
session — not yet exercised via a UI since none exists). Zero frontend.

**New finding since then:** `Admin.tsx`'s new "Match" tab (from the parallel
"Platform dashboards" commit) is a DIFFERENT, admin-driven manual-assignment
stub — admin picks a tutor from a dropdown per unmatched student, writes
`assignedTutorId`/`assignedTutorName` directly onto the student's `users/{uid}`
doc. Explicitly labeled in the UI as a stopgap ("Full classroom model is
coming — this is a manual assignment stub"). **This does not conflict with
the join-code feature** — it's a parallel, simpler, admin-mediated path,
while join-code is the scalable self-service path. Both can coexist.

**Real problem to flag, not silently resolve:** there are now THREE
un-unified "who is this student's tutor" signals:
1. `sessions/{id}.tutorId` — per-session, what `TutorDashboard.tsx`'s roster
   ACTUALLY reads today (`where('tutorId','==',user.uid)` on `sessions`,
   nothing else).
2. `users/{uid}.assignedTutorId` — written by Admin's new Match stub, **read
   by nothing** anywhere in the app currently (a write with no consumer yet).
3. `users/{uid}.tutorId` + `.classroomId` — written by `join-classroom.ts`,
   also **read by nothing** yet, since there's no UI to have triggered it.

Building the classroom UI without addressing this would create a FOURTH
signal. Recommend: `TutorDashboard.tsx`'s roster becomes the union of (a)
students from `sessions.tutorId` (existing), (b) students from a
`classrooms` doc where `tutorId == user.uid` (new, via
`studentIds` array), and (c) students where `users.assignedTutorId ==
user.uid` (the Match stub's writes) — merge into one deduplicated list rather
than three separate UI sections. This is a genuine decision affecting how
much of #3 vs the Admin Match stub survives long-term; flagging for a call,
not deciding unilaterally here.

### Lane: `app/**` — new UI, no new backend (endpoints already exist)

**TutorDashboard.tsx — "My Classroom" card.** New section (near the existing
student sidebar): on mount, `GET`/create the tutor's classroom by calling the
existing `create-classroom` endpoint (idempotent — returns the existing one if
already created, per its own logic reading `where('tutorId','==',uid)` first).
Show the `code` prominently with a copy-to-clipboard button, and the resolved
`studentIds` roster (batch-fetch `users/{id}` docs for names/emails, same
pattern `TutorDashboard.tsx` already uses elsewhere for resolving student
identities from ids).

```tsx
async function ensureClassroom(): Promise<{ code: string; studentIds: string[] } | null> {
  const token = await user.getIdToken()
  const res = await fetch('https://mindcraft-webhook.vercel.app/api/create-classroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}
```

**New page/modal, student-facing — "Join your tutor's classroom".** A single
code-entry field posting to `join-classroom`. Natural home per the original
spec: either a step surfaced during onboarding (skip for tutor signups), or a
standalone route (`/join-classroom`) reachable from `Sidebar.tsx` /
`Dashboard.tsx` for students who signed up without a code.

```tsx
async function joinClassroom(code: string) {
  const token = await user.getIdToken()
  const res = await fetch('https://mindcraft-webhook.vercel.app/api/join-classroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) { /* show error from res.json().error */ return }
  const data = await res.json()
  // data: { tutorId, tutorName, classroomId, code }
}
```

**Test:** as a tutor, open "My Classroom," confirm a code appears (generated
once, stable on reload). As a student, enter that code, confirm
success and that `users/{studentUid}.tutorId`/`.classroomId` are set
(verify in Firestore directly, or once the roster-union above is built,
confirm the student shows up in the tutor's dashboard).

---

## 4. MathText currency bug — `$14 ... $16` misread as inline LaTeX

**STATUS UPDATE — first fix landed, one gap remains, validated against the
real corpus.** `looksLikeMath()` was implemented in `MathText.tsx` per the
approach below and correctly fixes the original bug. Ran a validation script
against every `$`-delimited span in `actMasterQuestionBank.generated.json` +
`eediQuestions.json` + `generatedQuestions.json` (27 real spans found): 23
correctly downgraded to plain text, but **3 of the 4 still classified as
"math" are still-broken currency cases**: `"3.25 Pasty"`, `"2.25 Soup"`,
`"1.55 Coffee"` (menu-price lines — a decimal currency amount followed by
exactly one word). Only `"72 × 36"` among the 4 is genuine math.

**Why the gap exists:** the heuristic only downgrades to plain-text when
`alphaWords.length >= 2` (2+ whitespace-separated pure-alphabetic words). A
price line with a single trailing item name (`"3.25 Pasty"`) has only ONE
alpha word (`"Pasty"` — `"3.25"` fails the pure-alpha regex), so it falls
through to the default `return true`.

**Fix — extend `looksLikeMath()`** (`app/src/components/MathText.tsx`):
```ts
function looksLikeMath(expr: string): boolean {
  if (/\\[a-zA-Z]+/.test(expr)) return true
  const words = expr.trim().split(/\s+/)
  const alphaWords = words.filter(w => /^[a-zA-Z]+$/.test(w))
  const hasOperator = /[+*/^_=]/.test(expr) || /\d\s*[-+]\s*\d/.test(expr)
  if (hasOperator) return true
  // Currency-like decimal (e.g. "3.25") plus a trailing word → price line, not math.
  if (/\d+\.\d{2}\b/.test(expr) && alphaWords.length >= 1) return false
  if (alphaWords.length >= 2) return false
  return true
}
```
Re-ran this exact logic by hand against all 4 previously-kept examples plus
the 23 already-fixed ones: `"3.25 Pasty"` / `"2.25 Soup"` / `"1.55 Coffee"`
now correctly return `false` (plain text), `"72 × 36"` still correctly
returns `true` (no regression) since it has no decimal point and fewer than 2
alpha words. Re-run the validation script below after applying, to confirm on
the actual repo state rather than trust this by-hand trace:

```js
// scratch validation — paste into a node -e or a temp script, not part of the app
const fs = require('fs')
function looksLikeMath(expr) { /* paste the function above */ }
function findDollarSpans(text) {
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
  const spans = []
  let m
  while ((m = re.exec(text)) !== null) {
    if (!m[0].startsWith('$$')) spans.push(m[0].slice(1, -1).trim())
  }
  return spans
}
const files = [
  'src/data/actMasterQuestionBank.generated.json',
  'src/data/eediQuestions.json',
  'src/data/generatedQuestions.json',
]
let total = 0, kept = 0, downgraded = 0
for (const f of files) {
  let data
  try { data = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { continue }
  const arr = Array.isArray(data) ? data : (data.questions || Object.values(data))
  for (const q of (Array.isArray(arr) ? arr : [])) {
    const text = typeof q === 'string' ? q : (q.question || '')
    if (!text.includes('$')) continue
    for (const span of findDollarSpans(text)) {
      total++
      looksLikeMath(span) ? kept++ : downgraded++
    }
  }
}
console.log({ total, kept, downgraded })
```
Expect `kept` to drop from 4 to 1 (`"72 × 36"` only) once the fix is applied.
This is the acceptance test for this item — not just "the original example
looks right now."

**Root cause, exact:** `MathText.tsx`'s parser regex (line 56):
```ts
const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
```
matches ANY same-line pair of `$`-delimited text as inline math — including
two unrelated currency amounts. "...charge of `$14` and a one-time new-member
fee of `$16`..." matches as ONE inline-math span with `expr = "14 and a
one-time new-member fee of "` (everything between the two `$`s). KaTeX then
renders this non-math prose in math mode (`throwOnError: false`, so it doesn't
error) — math mode collapses whitespace and mis-renders plain words, producing
exactly the garbled text observed: `"14andaone — timenew — memberfeeof 16"`.
**This breaks any word problem with 2+ currency amounts on one line** — a
systemic bug affecting an unknown but likely non-trivial slice of the ~1,500-
question bank, not a one-off.

### Fix approach — `app/src/components/MathText.tsx`

The regex needs a heuristic to distinguish "looks like real math" from
"looks like prose with dollar signs." Recommended guard: reject a matched
`$...$` span as math if its content contains multiple whitespace-separated
alphabetic words with no LaTeX-like tokens (no backslash commands, no bare
math operators) — real inline LaTeX in this app's question corpus is short
(`\frac{1}{2}`, `x^2`, single variables/expressions), while currency-in-prose
spans are long, multi-word, English sentences.

```ts
function looksLikeMath(expr: string): boolean {
  // Contains a LaTeX command → definitely math.
  if (/\\[a-zA-Z]+/.test(expr)) return true
  // More than 2 whitespace-separated alphabetic words with no math operators →
  // prose, not math (currency-in-a-sentence case).
  const words = expr.trim().split(/\s+/)
  const alphaWords = words.filter(w => /^[a-zA-Z]+$/.test(w))
  if (alphaWords.length >= 2 && !/[+\-*/^_=]/.test(expr)) return false
  return true
}
```
Apply in `parse()`: when a `$...$` span is matched, only emit it as an
`'inline'` segment if `looksLikeMath(expr)` — otherwise emit it as plain
`'text'` (i.e. don't treat those two `$` as delimiters at all, leave the
literal `$14 ... $16` in the text stream unmodified).

**This needs validation against the real corpus, not just this one example**
— before shipping, run the heuristic against a sample of questions that
DO contain legitimate inline LaTeX (search the question banks for `\frac`,
`\sqrt`, `^`, or existing `$...$` usage) to confirm no false negatives (real
math wrongly downgraded to plain text), and against a sample with multiple
dollar amounts (search for questions matching `/\$\d+.*\$\d+/`) to confirm no
more false positives. A quick script over `app/src/data/*.json` /
`app/src/lib/questionBank.ts`'s `Q` array checking both directions is cheap
and worth doing before merging — don't eyeball a handful and assume it
generalizes.

**Test:** the exact WebFilms/Sherwood question renders with literal `$14` and
`$16` visible and legible (not garbled), and at least one known real-LaTeX
question (if one exists in the bank) still renders as proper math via KaTeX.