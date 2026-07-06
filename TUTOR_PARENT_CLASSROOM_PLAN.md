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
  scratchImage?: string        // canvas.toDataURL(), same pattern as Practice.tsx's scratch pane
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

New page, e.g. `app/src/pages/SessionWork.tsx`, reached from the student's
Dashboard "last session" card ("Work through what we covered →"): one screen
per prompt, using the new `ScratchPad` component. On submit, write to
`sessions/{id}/studentWork/{autoId}` with `scratchImage:
canvas.toDataURL('image/png')` — this is genuinely the first time this app
persists any hand-drawn canvas data anywhere, since the old scratch pane never
saved its contents even before it was removed.

**Tutor side, reviewing**: on `SessionDetail.tsx`, render each
`studentWork` entry — the scratch image, the reasoning text, and the
`wasStuck` flag prominently (this is the "identify where the student messed
up" signal — surfacing entries where `wasStuck === true` first is probably
right, sorted before the ones where the student said they were confident).

### Firestore rule needed
```
match /sessions/{sessionId}/studentWork/{entryId} {
  allow create: if request.auth != null
    && request.resource.data.studentId == request.auth.uid
    && get(/databases/$(database)/documents/sessions/$(sessionId)).data.studentId == request.auth.uid;
  allow read: if request.auth != null && (
    resource.data.studentId == request.auth.uid ||
    get(/databases/$(database)/documents/sessions/$(sessionId)).data.tutorId == request.auth.uid
  );
  allow update, delete: if false;  // append-only from the student side
}
```

---

## 4. Parent dashboard — finish wiring (mostly already built)

**Status:** shipped in app lane (pending Firestore rules deploy for child data reads).
`ParentDashboard.tsx` + `ParentDashboard.module.css` wired; link-child-by-email,
weekly avg-outcome performance chart, active curriculum from KG nodes, top
strengths/gaps.

### Gaps to close

1. ~~**Not routed.**~~ **DONE** — `/parent` route in `App.tsx`.

2. ~~**Role redirect doesn't know about parents.**~~ **DONE** — `RoleRedirect()`
   in `App.tsx` and `Login.tsx` `navigateAfterRole` / `routeAfterLogin` send
   `role === 'parent'` to `/parent`.

3. **Firestore rules — file ready, not yet deployed.** `firebase/firestore.rules`
   covers parent reads of linked child's `interactions` and `knowledge_graphs`
   (see bottom of this doc). `ParentDashboard.tsx` reads Firestore directly —
   **decision: keep Firestore path** (not ML endpoints). Data loads once rules
   are deployed; frontend push alone is not enough for the performance chart /
   curriculum panels.

4. **Signup flow check**: parent signup only writes `role`/`email`/`displayName`
   and routes straight to `/parent` — no exam track or gap-scan gating. Looks
   clean from code review; worth a quick manual click-through post-deploy.

5. ~~**Pre-existing type error** (`weekPoints.at(-1)`).~~ **DONE** — uses
   `weekPoints[weekPoints.length - 1]`.

**Remaining to ship #4:** review + deploy `firebase/firestore.rules`, then test
parent account with linked `childId`.

### Suggested sequencing
Ship #4 (parent) first — least new code, mostly connecting existing pieces,
immediately shippable once the rules question is resolved. Then #2 (tutor
plan/observation) — pure app-lane, no server/rules complexity. Then #1
(classroom codes) and #3 (reasoning capture) — both need new webhook
endpoints and/or rules, naturally paired as the "needs a deploy beyond just
the frontend" batch.

---

## Firestore rules — DONE, file recreated, not yet deployed

**Update:** the file is written. `firebase/firestore.rules` (matching
`firebase.json`'s `"firestore": {"rules": "firebase/firestore.rules"}`
reference) has been recreated in the repo — it was previously deleted from
git in commit `1f0976f7` ("drop redundant firebase/ config") with no
replacement ever committed. It now contains the full live ruleset (pulled
fresh via the Rules API, not the stale git snapshot) plus the four additions
below. **Still untracked/uncommitted and not deployed** — someone needs to
review, `git add` it, and run `firebase deploy --only firestore:rules`.

Additions beyond the earlier draft in this doc (refined while writing the
actual file):
- `interactions` and `learning_events` (both, not just `interactions` —
  missed `learning_events` in the earlier draft; same shape, same gap).
- `knowledge_graphs`: split `allow delete` (own account only) from `create`/
  `update` (`false`, server-only) — **not** a blanket `allow write: if
  false`, because `QAToolbar.tsx`'s "Restart Fresh" flow does
  `deleteDoc(doc(db,'knowledge_graphs', user.uid))` for the *current* user.
  A blanket deny would have silently broken that existing feature the moment
  rules were deployed.
- `classrooms` and `sessions/{id}/studentWork/{entryId}` as originally
  drafted (§1 and §3 above).

Confirmed via direct grep of the client codebase that `interactions`/
`knowledge_graphs` writes only ever happen server-side (`ml/serve.py` via
`firestore_adapter.py`'s Admin SDK client, which bypasses rules entirely
regardless of what's written here) — the only client-side touch is
`QAToolbar.tsx`'s own-account read + delete, both accounted for above.

**Before deploying:**
1. Read `firebase/firestore.rules` in full — it's the complete ruleset, not a
   diff, since Firestore rules deploys replace the whole file.
2. Confirm brace/paren balance and syntax look right (did a basic count
   check — 27/27 braces, 67/67 parens — but that's not the same as the
   Firebase CLI's actual rules compiler; consider `firebase deploy --only
   firestore:rules` against a staging project first if one exists, or at
   least review closely since there's no staging Firestore here).
3. Deploy: `firebase deploy --only firestore:rules` (uses whichever Firebase
   project the local `firebase use` / `.firebaserc` points at — confirm it's
   `mindcraft-93858` before running).
4. Test after deploy: sign in as a parent with a linked `childId`, confirm
   `ParentDashboard.tsx` actually renders performance data (currently unknown
   whether it silently fails or the UI's `.finally(() => setLoading(false))`
   masks a permission-denied error as just "no data yet"). Also re-test
   QAToolbar's "Restart Fresh" still deletes the knowledge graph successfully
   post-deploy.
