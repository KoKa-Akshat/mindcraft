# Build plan: server-authoritative roles/childId + exam-mode target fix

Two independent tasks. Task 1 is a one-line engine fix. Task 2 closes the
pre-marketing security blocker (CLAUDE.md "Security" section) by making
`role` and `childId` server-written. Lanes are labeled per task — do not
cross them without coordination.

Status legend: each task ends with acceptance criteria. Check them off in
this file as you land work.

---

## Task 1 — Exam-mode pathfinder default targets (Lane: **Engine**, `ml/**`)

### Problem
`ml/mindcraft_graph/planning/pathfinder.py:334` — exam mode with empty
`target_concepts` falls back to `ontology.high_priority_concepts` (the
act_prep_overlay subset). But `serve.py::_resolve_recommend_targets` always
pre-fills exam-mode targets with `act_relevance.tested` (~29 concepts)
before the pathfinder is called, so this fallback is dead code via
`/recommend` AND inconsistent for any direct caller of the pathfinder
(tests, scripts, future callers get a different concept set than the API).

### Fix
In `pathfinder.py`, change the exam-mode default to match serve.py:

```python
# before
if not targets and goal.mode == "exam":
    targets = list(ontology.high_priority_concepts)

# after
if not targets and goal.mode == "exam":
    targets = list(ontology.act_tested_concept_ids() or ontology.high_priority_concepts)
```

`act_tested_concept_ids()` exists on the ontology model
(`ml/mindcraft_graph/models/concept.py:38`). Keep `high_priority_concepts`
as the empty-set fallback (non-ACT ontologies) and leave its exam-priority
**re-ranking** role untouched — this change is only about default target
selection.

### Acceptance
- [ ] `cd ml && python scripts/end2end.py` still 85/85.
- [ ] Direct pathfinder call with `mode="exam"`, empty targets → canonical
      chain built from the ~29 `act_relevance.tested` concepts (same set as
      `GET /exam-concepts/act`).
- [ ] NOTE for deploy: engine changes require manual Cloud Run
      build+deploy with BOTH env vars (see CLAUDE.md Deployment). Do not
      deploy as part of this task unless asked — just land the code.

---

## Task 2 — Lock `role` / `childId` (server-authoritative privileges)

### Why (threat model)
`firebase/firestore.rules:5-8` lets any signed-in user write their ENTIRE
own `users/{uid}` doc. Privileges attached to fields on that doc:

| Field | Grants |
|---|---|
| `role: 'admin'` | sessions/transcripts reads (rules), Admin panel, ML API exemption (`auth.py`) |
| `role: 'tutor'` | transcripts reads, ML API exemption, create-classroom |
| `childId` | read of that student's `knowledge_graphs` / `interactions` / `learning_events` (rules deployed 2026-07-06) |
| `role: 'parent'` | nothing by itself (safe) |

Today: the admin grant is a client-side sessionStorage flag
(`Login.tsx:18-26,85`) — anyone can set it in devtools and self-promote to
admin. The parent link (`ParentDashboard.tsx:150`) writes `childId` from an
unverified email lookup — anyone can link themselves to any student and
read a minor's educational records. Both must move server-side.

Legitimate client writes that must KEEP working:
- `Login.tsx:93` + `useStudentData.ts:115` — default/self-heal `role: 'student'`.
- QAToolbar "delete my own knowledge graph" (already covered by rules).
- Students writing non-privileged fields on their own doc (drafts,
  diagnostic flags, `parentEmail` — see 2b).

### Rollout order (matters — do NOT flip rules first)
1. **2b** webhook endpoints (Vercel deploys on push).
2. **2c** app migrations (CI deploys on push to main).
3. **2a** rules flip — manual, via the Firebase Rules API /
   `webhook/scripts/deploy-rules.ts` (NOT `firebase deploy`; see
   TUTOR_PARENT_CLASSROOM_PLAN.md "Deploy mechanism note"). Keep
   `firebase/firestore.rules` in git in sync with what you deploy.
4. **2d** audit existing user docs.

### 2a — Firestore rule (Lane: **Engine** deploys; file is a shared seam)

Replace the `users` match in `firebase/firestore.rules`:

```
match /users/{userId} {
  allow read: if request.auth != null;

  // Create: own doc, no privileged fields; role may only be 'student'.
  allow create: if request.auth != null && request.auth.uid == userId
    && !request.resource.data.keys().hasAny(['childId', 'tutorId', 'classroomId'])
    && (!('role' in request.resource.data) || request.resource.data.role == 'student');

  // Update: own doc, may not touch childId/tutorId/classroomId; may not
  // change role EXCEPT setting 'student' when no role exists yet
  // (Login.tsx:85 / useStudentData.ts:115 self-heal path).
  allow update: if request.auth != null && request.auth.uid == userId
    && !request.resource.data.diff(resource.data).affectedKeys()
         .hasAny(['childId', 'tutorId', 'classroomId'])
    && (
      !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])
      || (!('role' in resource.data) && request.resource.data.role == 'student')
    );
}
```

Admin SDK (webhook endpoints, ML backend) bypasses rules — server writes
of role/childId/tutorId/classroomId are unaffected.

- [ ] Rule landed in `firebase/firestore.rules` and deployed via Rules API.
- [ ] Verified: client `updateDoc(users/self, {role:'admin'})` → permission-denied.
- [ ] Verified: client `updateDoc(users/self, {childId:'x'})` → permission-denied.
- [ ] Verified: new-user signup (student default) still works.
- [ ] Verified: practice drafts / diagnostic flag writes still work.

### 2b — Webhook endpoints (Lane: **Engine**, `webhook/**`)

Follow the existing patterns in `join-classroom.ts` / `create-classroom.ts`
(verify Firebase ID token via Admin SDK, write via Admin SDK, `setCors`).

**`webhook/api/grant-admin.ts`** — replaces the client-side admin grant.
- Input: POST, `Authorization: Bearer <Firebase ID token>`.
- Verify token; require `token.email_verified` and
  `token.email ∈ ADMIN_EMAILS` (new Vercel env var, comma-separated,
  case-insensitive). 403 otherwise.
- On success: Admin SDK `set(users/{uid}, {role:'admin', email, displayName}, merge)`.
- [ ] `ADMIN_EMAILS` set in Vercel (Blake + Akshat emails).

**`webhook/api/link-child.ts`** — replaces the client-side parent link.
- Input: POST `{ childEmail }` + Firebase ID token.
- Verify token → caller uid + verified email.
- Look up user doc by `email == childEmail`. 404 → "No account found".
- **Verification gate**: the child's doc must have
  `parentEmail == token.email` (case-insensitive). Mismatch/absent → 403
  with message: "Ask your child to add your email as their parent email
  in MindCraft, then try again."
- **Admin override**: if the CALLER's user doc has `role:'admin'`
  (trustworthy once 2a is live), accept `{ childEmail, parentUid }` and
  link on behalf of that parent — powers the Admin "Match" flow.
- On success: Admin SDK write on the parent's doc:
  `{ childId: <child uid>, role: 'parent' }` (role set here — parents never
  self-select).
- [ ] Both endpoints deployed; smoke-tested with a real token.

### 2c — App migrations (Lane: **Product**, `app/**`)

1. **`Login.tsx:85`** — replace the direct `setDoc(role:'admin')` with a
   call to `grant-admin` (existing webhook base URL pattern; send the ID
   token). Keep the sessionStorage arming UX; on 403 show a plain
   "not authorized" error and route to `/dashboard`.
2. **`ParentDashboard.tsx:140-155`** — replace lookup+`updateDoc(childId)`
   with a call to `link-child`. Surface the endpoint's error messages
   as `linkError` (they're written to be user-facing).
3. **Student-side `parentEmail` capture** — small input where a student can
   set/change `parentEmail` on their own doc (plain client write, allowed
   under 2a). Suggested placement: the profile/settings surface the student
   already has; if none exists, a small card on Dashboard settings area —
   implementer's choice, keep it minimal. Copy per BRAND_BOOK voice.
4. **Admin panel Match** — wire the existing parent-linking stub in
   `Admin.tsx` to `link-child`'s admin override (admin picks parent +
   enters child email).
- [ ] Admin grant flow works end-to-end for an allowlisted email; devtools
      sessionStorage trick now yields 403.
- [ ] Parent link succeeds when child set `parentEmail`, fails otherwise.

### 2d — Audit + docs (Lane: **Engine** for the audit, both for docs)

- [ ] One-time audit: list all `users` docs with `role ∈ {tutor, admin}` or
      non-null `childId`; confirm each is legitimate; fix via Admin SDK.
      (Small script under `webhook/scripts/` or a gcloud/firestore query —
      do NOT commit any user PII into the repo.)
- [ ] Update CLAUDE.md: rewrite the "Security — pre-marketing blocker"
      section (rules now enforce server-authoritative roles; ML API
      tutor/admin exemption in `auth.py` is now trustworthy), and move
      classroom/join-code out of "Designed, not built".

### Explicitly out of scope
- Migrating tutor onboarding UX (tutors are already only created via
  create-classroom/admin paths).
- ML-side changes — `auth.py` already reads roles from Firestore and needs
  no change; it simply becomes trustworthy.
