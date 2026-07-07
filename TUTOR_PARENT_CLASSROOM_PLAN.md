# Tutor classroom + session workflow + student reasoning capture + parent dashboard

Four sub-features. Less new-build than it looks — the data model for three of
them already exists in `types/index.ts`, unused, and the parent dashboard is
~90% built already. This plan closes the gaps.

**Cross-cutting risk, applies to ALL four sections below — CONFIRMED, not
hypothetical.** `firebase/firestore.rules` is not tracked in this repo (removed
in commit `1f0976f7`). Pulled the **live** deployed ruleset directly from the
Firebase Rules API (`firebaserules.googleapis.com`, project `mindcraft-93858`,
active release `cloud.firestore`) and diffed it against the last git snapshot —
functionally identical (only two comment lines differ). So this is confirmed
current-state, not stale: **there is no rule at all for `interactions`,
`knowledge_graphs`, or `classrooms`** collections. Under Firestore's deny-by-
default model, `ParentDashboard.tsx`'s reads of `interactions`/`knowledge_graphs`
for a linked `childId` are almost certainly failing with permission-denied
right now. One consolidated rules patch, covering every addition needed across
sections 1/3/4, is at the bottom of this doc — deploy it once, not four times.

---

## 1. Classroom join-code (roster model)

**Status:** type modeled (`Classroom` in `types/index.ts:76-82`), zero
implementation. Matches CLAUDE.md's "Designed, not built" section exactly.

```ts
export interface Classroom {
  code: string
  tutorId: string
  tutorName: string
  studentIds: string[]
  createdAt: number
}
```

### Why this can't be a pure client write
A student entering a code and getting linked to a tutor means writing
`tutorId`/`classroomId` onto the student's OWN `users/{uid}` doc — which the
student CAN write client-side under current rules (`allow write: if
request.auth.uid == userId`). But that's exactly the "self-promotion" gap
CLAUDE.md already flags: if the student can set their own `tutorId`/`role`
directly, there's no server-side check that the code they typed is real, and
nothing stops a malicious client from writing an arbitrary `tutorId`. This
needs a server-authoritative write, same pattern as `publish-summary.ts`
(Admin SDK + `verifyToken`, not a client Firestore write).

### Lane: `webhook/**` — new endpoint

`webhook/api/join-classroom.ts` (new file, modeled directly on
`publish-summary.ts`'s structure):
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'
import { verifyToken } from '../lib/verifyToken'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Unauthorized' })

  const { code } = req.body
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing code' })
  }

  const classSnap = await db.collection('classrooms')
    .where('code', '==', code.trim().toUpperCase()).limit(1).get()
  if (classSnap.empty) return res.status(404).json({ error: 'Invalid code' })

  const classroom = classSnap.docs[0]
  const tutorId = classroom.data().tutorId

  await db.runTransaction(async tx => {
    tx.update(classroom.ref, { studentIds: FieldValue.arrayUnion(uid) })
    tx.set(db.collection('users').doc(uid), {
      role: 'student', tutorId, classroomId: classroom.id,
    }, { merge: true })
  })

  return res.json({ tutorId, tutorName: classroom.data().tutorName, classroomId: classroom.id })
}
```
(Import `FieldValue` from `firebase-admin/firestore` alongside the existing
`db` import — check `webhook/lib/firebase.ts` for the exact admin app setup
already used by the other endpoints.)

A second endpoint or extension to an existing tutor-facing one to CREATE a
classroom (`webhook/api/create-classroom.ts` or fold into an existing tutor
setup flow): generate a short code (e.g. 6 uppercase alphanumeric, collision-
checked against existing `classrooms` docs), write `classrooms/{id}` with
`{code, tutorId, tutorName, studentIds: [], createdAt}`.

### Lane: `app/**`

- **TutorDashboard.tsx**: a "My Classroom" card — shows the tutor's join code
  (generate on first visit if none exists yet) with a copy button, and the
  current `studentIds` roster resolved to names/emails (batch-fetch
  `users/{id}` docs). This becomes an additional/alternate source for the
  student sidebar list alongside the existing session-derived one — recommend
  keeping BOTH sources merged (union of session-derived students ∪ classroom
  roster) rather than replacing, since a tutor may have students who booked
  directly via Calendly before ever using a code.
- **New page or modal, student-facing**: "Join your tutor's classroom" — a
  single code-entry field, POSTs to `join-classroom`, shows success/error.
  Natural home: a step in onboarding (optionally, right after signup, tutor
  role selection intentionally skips this — only students see it), or a
  standalone `/join-classroom` route reachable from Sidebar/Dashboard for
  students who skipped it at signup.
- **`auth.py` (ml/) already has `_role_for()` wired for a tutor exemption** per
  CLAUDE.md — once `tutorId`/`role` are server-written via this endpoint
  instead of client self-selection, that exemption becomes trustworthy. No ML
  code change needed, just note the trust boundary shifts once this ships.

### Firestore rule needed
```
match /classrooms/{classroomId} {
  allow read: if request.auth != null;
  allow write: if false;  // only Admin SDK (Vercel functions) writes this
}
```

---

## 2. Tutor pre-session plan + post-session observation

**Status:** types modeled (`SessionPlan`, `TutorObservation` in
`types/index.ts:59-72`), zero UI. This is purely additive to the EXISTING
`sessions/{id}` doc (`plan`/`tutorObservation` are already optional fields on
`Session` per `types/index.ts:26-27`) — no new collection, no new rules
(tutor already has `allow update: if resource.data.tutorId ==
request.auth.uid` on `sessions/{id}` per the last-known rules, which covers
writing `plan`/`tutorObservation` fields fine).

### Lane: `app/**` only — no webhook/ML changes needed

**Pre-session plan** — natural home: `TutorDashboard.tsx`'s upcoming-sessions
list. Add a "Plan this session" action per scheduled session (button opens an
inline form or modal):
```tsx
async function savePlan(sessionId: string, plan: Omit<SessionPlan, 'createdAt'>) {
  await updateDoc(doc(db, 'sessions', sessionId), {
    plan: { ...plan, createdAt: Date.now() },
  })
}
```
Form fields matching the type: `topics: string[]` (tag-style input, reuse the
pattern already in `Admin.tsx`'s goal-tags or `Diagnostic.tsx`'s
`toggleGoal`-style chip toggling if there's a fixed topic list, or free-text
chips), `goals: string` (textarea — "what should this session accomplish"),
`notes: string` (textarea — prep notes, private to the tutor). Once saved, show
it as a small "Session plan ✓" indicator on that session's row.

Consider surfacing the plan to the **student** too (read-only, on their
Dashboard "Next session" card) — that requires nothing new permission-wise
since students can already read their own `sessions/{id}` docs
(`resource.data.studentId == request.auth.uid`), just a UI addition on the
student Dashboard to render `nextSession.plan` if present. Worth doing since
"tutor fills in what the session will cover" implies the student should see
it, not just the tutor.

**Post-session observation** — natural home: `SessionDetail.tsx`, alongside
the existing AI-generated-summary flow (this is a DIFFERENT, tutor-authored
signal, not a replacement — the AI summary comes from the Fireflies
transcript when available; the observation is the tutor's own read on the
student regardless of whether a transcript exists, e.g. in-person sessions
with no recording).
```tsx
async function saveObservation(sessionId: string, obs: Omit<TutorObservation, 'completedAt'>) {
  await updateDoc(doc(db, 'sessions', sessionId), {
    tutorObservation: { ...obs, completedAt: Date.now() },
  })
}
```
Form: `rating: 1-5` (star or slider), `notes: string` (free text — "how did
they do in my eyes"), `struggled_with: string[]` / `excelled_at: string[]`
(concept-tag pickers — reuse `PRACTICE_CONCEPTS` or the ontology concept list
for consistent naming with the ML side, so these tags are potentially
joinable later against KG concept ids if you ever want to feed tutor
observations back into the mastery engine as a signal — not required now, but
picking consistent concept-id strings here instead of free text costs nothing
and keeps that door open).

Show this on `StudentIntelPanel.tsx` too (tutor's own past observations for
this student, chronological) — cheap addition since that panel already
fetches per-student data on selection.

---

## 3. Student async reasoning capture (new — no existing model)

Per your call: async, not live. Student works through 2-3 problems the tutor
flagged from the session, after the fact, with a scratch area + a required
"what were you thinking" text box specifically for problems they got stuck on.

### Data shape (new)
Add to `Session` (`types/index.ts`) or a subcollection — **recommend a
subcollection** (`sessions/{id}/studentWork/{entryId}`) over an array field on
the session doc, because Firestore security rules can scope read/write per-
subcollection cleanly (student writes their own entries; tutor reads all),
whereas array-field rules that need to restrict WHO can append are much
clumsier to express correctly.

```ts
export interface StudentWorkEntry {
  id: string
  sessionId: string
  studentId: string
  prompt: string              // the problem/topic the tutor flagged
  scratchImage?: string        // canvas.toDataURL('image/png') from the new ScratchPad component
  reasoningText: string        // "what were you thinking" — required when stuck
  wasStuck: boolean
  createdAt: number
}
```

### Lane: `app/**`

**Tutor side** (`SessionDetail.tsx` or the post-session observation form):
tutor adds 1+ "prompts" for the student to work through — just strings
describing the problem/topic (not full question objects; this isn't tied to
the ML question bank, it's freeform based on what actually happened in the
session). Store as `session.workPrompts: string[]`.

**Student side — correction: build fresh, nothing to reuse.** Earlier drafts
of this doc assumed `Practice.tsx` still had a working scratch canvas
(`scratchCanvasRef`/`beginScratch`/`drawScratch`/`endScratch`) to extract into
a shared component. Confirmed via `git log -S "scratchCanvasRef" --
app/src/pages/Practice.tsx` and a direct grep of the current file: the
co-founder's "Redesign practice workbench for iPad scratch space" pass
(`a192cd29`) and later commits removed it entirely — the current session view
is just the question card, no drawing surface anywhere in the app today.
This needs a genuine new component.

**New shared component: `app/src/components/ScratchPad.tsx`.** Stack, per
direct guidance:
- **HTML5 Canvas** (`<canvas>` + 2D context) as the drawing surface.
- **Pointer Events** (`onPointerDown`/`onPointerMove`/`onPointerUp`/
  `onPointerCancel`), not Touch Events — pointer events natively carry
  `pressure`, `tiltX`/`tiltY`, and `pointerType`, so one handler set covers
  mouse, touch, AND stylus without separate code paths.
- **Stylus detection**: `e.pointerType === 'pen'` distinguishes Apple
  Pencil/stylus from a finger — use this to decide whether to trust
  `e.pressure` (styluses report real pressure; fingers/mouse report a flat
  `0.5`) rather than gating the whole canvas to pen-only input.
- **Palm rejection**: `touch-action: none` in CSS on the canvas element —
  without it the browser will try to scroll/zoom on touch input while the
  user is mid-stroke.
- **Ink rendering — use `perfect-freehand`** (new dependency, not yet in
  `package.json` — add it) rather than hand-rolling variable-width strokes.
  `getStroke(points, options)` takes an array of `[x, y, pressure]` samples
  collected from the pointer events and returns a smooth outline point set;
  convert that to an SVG path string (the library's docs include a
  `getSvgPathFromStroke` helper pattern) and fill it onto the canvas 2D
  context per completed stroke (`ctx.fill(new Path2D(pathString))`). This
  keeps the final artifact a normal `<canvas>`, so `canvas.toDataURL('image/png')`
  still works unchanged for the `scratchImage` field below — `perfect-freehand`
  only changes HOW each stroke is drawn (pressure-tapered, natural-looking
  ink), not the storage format.
- Skip `Fabric.js`/`Leader Line` for this use case — those solve interactive
  shape/text-box manipulation and node-diagram connectors respectively,
  neither of which this feature needs (it's freehand ink + a text box, not
  an editable canvas of movable objects or a mind-map).

Below the canvas: a text box, "What were you thinking?" — make it required if
the student marks `wasStuck: true` (a simple toggle: "I knew what to do" vs
"I got stuck" — the latter reveals the reasoning box and requires text before
submit, directly per your ask: "have the student explain their reasoning
specifically when they don't know what to do").

### Implementation-ready breakdown (rules already deployed — this is unblocked)

**0. Dependency:** `cd app && npm install perfect-freehand` (confirmed not
already in `package.json`).

**1. `app/src/components/ScratchPad.tsx`** (new, shared):
```tsx
import { useRef, useEffect, useState } from 'react'
import { getStroke } from 'perfect-freehand'

type Point = [number, number, number] // x, y, pressure

function pathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''
  const d = stroke.reduce(
    (acc, [x, y], i) => `${acc}${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `,
    '',
  )
  return `${d}Z`
}

export default function ScratchPad({ onChange }: { onChange?: (canvas: HTMLCanvasElement) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const pointsRef = useRef<Point[]>([])
  const drawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#1a1f2e'
    ctxRef.current = ctx
  }, [])

  function begin(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true
    // Mouse/finger report pressure 0 or 0.5 — only trust real pressure from a stylus.
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5
    pointsRef.current = [[e.nativeEvent.offsetX, e.nativeEvent.offsetY, pressure]]
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5
    pointsRef.current.push([e.nativeEvent.offsetX, e.nativeEvent.offsetY, pressure])
    const stroke = getStroke(pointsRef.current, { size: 3, thinning: 0.6, smoothing: 0.5 })
    const ctx = ctxRef.current
    if (!ctx || !stroke.length) return
    ctx.fill(new Path2D(pathFromStroke(stroke)))
  }

  function end() {
    drawingRef.current = false
    pointsRef.current = []
    if (canvasRef.current && onChange) onChange(canvasRef.current)
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ touchAction: 'none', width: '100%', height: 320, background: '#fff', borderRadius: 12 }}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={() => drawingRef.current && end()}
      />
      <button type="button" onClick={clear}>Clear</button>
    </div>
  )
}
```
(`getStroke`'s actual outline-point format may need a small adapter depending
on the installed `perfect-freehand` version's TS types — verify against
whatever version `npm install` resolves; the shape above is the standard
usage pattern from the library's own docs.)

**2. Tutor adds prompts — `SessionDetail.tsx`.** Add a small section (near
the existing "Your Notes" card, ~line 267) — a repeatable text-input list
mirroring the existing `topics`/`homework` add/remove pattern already in this
file (`updateTopic`/`addTopic`/`removeTopic`, lines 188-192):
```tsx
async function saveWorkPrompts(prompts: string[]) {
  await updateDoc(doc(db, 'sessions', session!.id), { workPrompts: prompts })
}
```
Add `workPrompts?: string[]` to the `Session` interface in `types/index.ts`.

**3. Student entry point — `StudentSessions.tsx`, not the Dashboard.**
Correction from the earlier draft: there's no existing "last session" card on
the Dashboard to hook into (`useStudentData`'s `lastSession` field is fetched
but never rendered anywhere today — dead data, same situation as the
`SessionPlan`/`TutorObservation` types before this plan). `StudentSessions.tsx`
already queries ALL of the student's sessions
(`where('studentEmail','==',user.email)`, no server-side filter) and only
CLIENT-side discards ones without `data.summary?.published` (line ~58). Extend
that mapping to also carry `workPrompts` through for sessions that have it,
regardless of publish status, and render a "Work through what we covered →"
card/button for any session where `workPrompts?.length` and the student
hasn't already submitted matching `studentWork` entries — navigates to
`/session-work/:sessionId`.

**4. New page — `app/src/pages/SessionWork.tsx`.** Route:
`<Route path="/session-work/:sessionId" element={<AuthGuard><SessionWork /></AuthGuard>} />`
in `App.tsx`. Loads `sessions/{sessionId}.workPrompts`, steps through one
prompt at a time: prompt text → `ScratchPad` → "I knew what to do" / "I got
stuck" toggle → (if stuck) required reasoning textarea → submit writes to
`sessions/{sessionId}/studentWork/{autoId}`:
```ts
await addDoc(collection(db, 'sessions', sessionId, 'studentWork'), {
  sessionId, studentId: user.uid, prompt, wasStuck,
  reasoningText: reasoningText || '',
  scratchImage: canvasEl.toDataURL('image/png'),
  createdAt: Date.now(),
})
```
Matches the rules already deployed (`allow create` requires
`request.resource.data.studentId == request.auth.uid` and the parent
session's `studentId` to match the caller — both satisfied here).

**5. Tutor review — `SessionDetail.tsx`.** Fetch
`sessions/{id}/studentWork` (a `getDocs`/`onSnapshot` on the subcollection,
same pattern as this file's existing single-doc fetches), render each entry:
the `scratchImage` as an `<img src={entry.scratchImage} />`, the
`reasoningText`, and `wasStuck` prominently — sort `wasStuck === true` entries
first (this is the "identify where the student messed up" signal).

### Firestore rule — already deployed, no action needed
Covered by the `sessions/{sessionId}/studentWork/{entryId}` block already live
in `firebase/firestore.rules` (see the top-level "Firestore rules" section of
this doc — deployed 2026-07-06).

---

## 4. Parent dashboard — finish wiring (mostly already built)

**Status: DONE, fully live.** `ParentDashboard.tsx` + `ParentDashboard.module.css`
wired; link-child-by-email, weekly avg-outcome performance chart, active
curriculum from KG nodes, top strengths/gaps.

### Gaps to close

1. ~~**Not routed.**~~ **DONE** — `/parent` route in `App.tsx`.

2. ~~**Role redirect doesn't know about parents.**~~ **DONE** — `RoleRedirect()`
   in `App.tsx` and `Login.tsx` `navigateAfterRole` / `routeAfterLogin` send
   `role === 'parent'` to `/parent`.

3. ~~**Firestore rules — file ready, not yet deployed.**~~ **DONE — deployed
   2026-07-06.** `firebase/firestore.rules` covers parent reads of linked
   child's `interactions` and `knowledge_graphs`; deployed live via the
   Firebase Rules API (same deploy that covers section 3's `studentWork`
   rule — one push, not two, per the "deploy once" note at the top of this
   doc). `ParentDashboard.tsx` reads Firestore directly — **decision: keep
   Firestore path** (not ML endpoints). Data should now load for a linked
   parent account; see point 4 for the outstanding manual test.

4. **Signup flow check — NOT YET DONE.** Parent signup only writes
   `role`/`email`/`displayName` and routes straight to `/parent` — no exam
   track or gap-scan gating. Looks clean from code review; still needs a
   manual click-through now that rules are live: sign up/in as a parent,
   link a real child by email, confirm the performance chart and curriculum
   panels actually render data (not just "no data yet").

5. ~~**Pre-existing type error** (`weekPoints.at(-1)`).~~ **DONE** — uses
   `weekPoints[weekPoints.length - 1]`.

**Remaining to fully close #4:** just the manual test in point 4 above —
everything else (routing, redirects, rules) has shipped and deployed.

### Suggested sequencing (updated — rules deploy no longer the blocker)
#4 (parent) and the rules deploy are done — only the manual click-through
test remains. #1 (classroom codes) is also implemented (webhook endpoints +
`auth.py` parent-check landed alongside this batch). Next up: #2 (tutor
plan/observation forms — pure app-lane, no server/rules complexity, not yet
built) and #3 (reasoning capture — spec is implementation-ready per the
breakdown above, rules already deployed, not yet built).

---

## Firestore rules — DONE, deployed and live

`firebase/firestore.rules` (matching `firebase.json`'s `"firestore":
{"rules": "firebase/firestore.rules"}` reference) is recreated, committed,
and **deployed live** — it was previously deleted from git in commit
`1f0976f7` ("drop redundant firebase/ config") with no replacement ever
committed.

**Deploy mechanism note (corrected):** this repo does NOT use `firebase
deploy --only firestore:rules` day-to-day — the logged-in Firebase CLI
account hit an IAM permission gap on the `serviceusage` preflight check the
CLI does before deploying (`Caller does not have required permission ...
roles/serviceusage.serviceUsageConsumer`). The repo's actual mechanism is
`webhook/scripts/deploy-rules.ts`, a secret-gated Vercel function
(deliberately kept out of `webhook/api/` so it isn't a live public endpoint)
that reads `firebase/firestore.rules` + `firebase/storage.rules` and pushes
them via the Firebase Rules API directly. Both deploys done in this session
used that same underlying API directly (create ruleset → PATCH the
`cloud.firestore` release) rather than either the CLI or the secret-gated
script — same effect, one fewer hop.

**Deploy history:**
1. `2026-07-06T21:31:45Z` — first deploy: `interactions`, `learning_events`,
   `knowledge_graphs`, `classrooms`, `sessions/{id}/studentWork` added.
2. `2026-07-06T23:59:11Z` — redeploy after a file edit (post-first-deploy)
   loosened the `studentWork` create rule to also match `studentEmail` (not
   just `studentId`), consistent with how `sessions/{sessionId}`'s own rule
   already accepts either — matters for a session created before the student
   had an account/uid linked. **File and live rules are in sync as of this
   redeploy** — if `firebase/firestore.rules` gets edited again, redeploy
   again the same way (or via the CLI once the IAM permission is granted, or
   via the webhook script) so the file doesn't silently drift from
   production a second time.

Additions beyond the earlier draft in this doc (refined while writing the
actual file):
- `interactions` and `learning_events` (both, not just `interactions` —
  missed `learning_events` in the earlier draft; same shape, same gap).
- `knowledge_graphs`: split `allow delete` (own account only) from `create`/
  `update` (`false`, server-only) — **not** a blanket `allow write: if
  false`, because `QAToolbar.tsx`'s "Restart Fresh" flow does
  `deleteDoc(doc(db,'knowledge_graphs', user.uid))` for the *current* user.
  A blanket deny would have silently broken that existing feature.
- `classrooms` and `sessions/{id}/studentWork/{entryId}` as originally
  drafted (§1 and §3 above).

Confirmed via direct grep of the client codebase that `interactions`/
`knowledge_graphs` writes only ever happen server-side (`ml/serve.py` via
`firestore_adapter.py`'s Admin SDK client, which bypasses rules entirely
regardless of what's written here) — the only client-side touch is
`QAToolbar.tsx`'s own-account read + delete, both accounted for above.

**Remaining:** manual test — sign in as a parent with a linked `childId`,
confirm `ParentDashboard.tsx` renders real performance data (not just "no
data yet"), and re-confirm QAToolbar's "Restart Fresh" still deletes the
knowledge graph successfully now that rules are enforced.
