# Navigation / orphaned-UI audit (2026-08-07)

Triggered by: Admin "Testing" tab silently became "Settings" (found while looking
for the diagnostic-reset button), plus the Login.tsx admin-passcode trigger
being unreachable (found earlier this session). Both are the same failure
shape — a redesign changed one side of an interface, the other side wasn't
updated to match. This audit went looking for more instances of that shape.

**Scope of what was checked**: frontend↔backend API contracts (ML + webhook
endpoints) and the shared-chrome navigation layer (`Sidebar`, `AppTabBar`)
across every page that imports them. Did **not** do a full page-by-page visual/
content audit (copy, story-first framing, stale screenshots) — that's a
bigger, separate pass if wanted.

## Clean: API contracts

Cross-checked every `ML_BASE`/`WEBHOOK_BASE` fetch target in `app/src` against
`ml/serve.py`'s registered routes and `webhook/api/**` + `webhook/lib/handlers/**`.
All 12 ML endpoints called from the frontend exist in `serve.py`. All 9 webhook
endpoints called from the frontend have a matching handler file. No orphaned
calls like the old `/learning-event` remain — that one was already fixed this
session, and nothing else in this class turned up.

## Not clean: the shared-chrome layer fragmented during the Dashboard redesign

**Finding 1 — `Dashboard.tsx` no longer uses the shared nav at all.**
Per `CLAUDE.md`: *"Sidebar — fixed top nav... Same on Dashboard, Practice,
Knowledge Graph."* That's no longer true. `Dashboard.tsx` imports neither
`Sidebar` nor `AppTabBar` — it has its own bespoke header (`s.heroBar`,
`Dashboard.tsx:733`) built during the redesign. Meanwhile `Sidebar` is still
used, unchanged, by `Practice.tsx`, `KnowledgeGraph.tsx`, `StudyTimer.tsx`,
`OrganizeNotes.tsx`, `StudentSessions.tsx`, `ConstellationGpsLab.tsx`, and
`JoinClassroom.tsx`. A student going Dashboard → Practice sees a completely
different top-nav treatment mid-flow. **This is almost certainly what "the
practice page is the old one" is describing** — it's not that Practice looks
outdated in isolation, it's that Dashboard changed and Practice didn't move
with it.

**Finding 2 — `AppTabBar` quietly collapsed from 4 tabs to 2, and `Practice.tsx`
still references the old 4-tab model.**
`AppTabBar.tsx`'s `AppTabId` type is `'dashboard' | 'practice' | 'solver' |
'map' | 'admin'` — matching `CLAUDE.md`'s documented "Dashboard | Practice |
Problem Solver | Knowledge Map." But `BASE_TABS` (the array actually rendered)
only contains `dashboard` and `solver`:
```ts
const BASE_TABS = [{ id: 'dashboard', ... }, { id: 'solver', ... }]
```
`'practice'` and `'map'` are typed, valid `AppTabId` values with **no
corresponding tab, and no case in `go()`'s switch** — they're structurally
dead. `Practice.tsx:1720` still passes `active={mode === 'solver' ? 'solver' :
'practice'}` — so on every ordinary (non-homework-help) practice session, the
tab bar is told the active tab is `'practice'`, which matches nothing in
`tabs`. Net effect: no tab highlights during normal practice, and there's no
tab that jumps directly to Knowledge Graph anymore (the `'map'` tab doesn't
exist to click). Not a crash, just a quietly half-finished nav.

**Finding 3 — Admin "Testing" tab renamed to "Settings" (previously found).**
`AdminTab` type dropped `'testing'`, `retakeGapScan()`'s UI moved under
`tab === 'settings'` → "Gap scan testing" card. Functionally intact, just
undocumented — `CLAUDE.md` still says "Admin Testing tab" in two places.

**Finding 4 — Login.tsx admin-passcode entry point is unreachable (previously
found, restated here for completeness).** `verifyAdminPasscode()` /
`armAdminGrant()` / the whole `adminFlow === 'passcode'` render branch exist
and work, but nothing in `Login.tsx` or anywhere else in `app/src` ever calls
`setAdminFlow('passcode')`. No button, no link, no query param reaches it. The
only way in right now is the `sessionStorage.setItem('mc_admin_grant_pending',
'1')` console workaround used earlier this session.

## Pattern, stated once

All four findings are the same shape: a redesign (Dashboard cover/chapter/
sticker rework, Admin tab rename, or whatever removed the passcode button)
changed one side of a UI contract — a shared component, a tab set, a button —
and the other side (a sibling page, a type, a doc) kept assuming the old
shape. None of these are hard failures (nothing throws, no 404s — confirmed
API layer is clean); they're all "quietly half-updated," which is exactly why
they don't get caught by tests or a build passing.

## Not yet done, worth flagging as a next pass if wanted

- Full page-by-page content/copy audit (does every page still say "Notes /
  Solver / Map", not older terms; does story-first framing from
  `WORLD_VISION.md` still hold everywhere; are there other bespoke-vs-shared
  chrome splits beyond nav, e.g. sign-out, theming).
- A repo-wide unused-export sweep (this audit checked API calls and two
  specific components by hand; there may be other orphaned functions/flows
  shaped like the admin-passcode one that a targeted search wouldn't surface
  without knowing what to look for).

## Recommended fix order

1. **Finding 2** (AppTabBar) — cheapest, most confusing to a user actively
   using Practice today: either restore the `practice`/`map` tabs to
   `BASE_TABS` + their `go()` cases, or have `Practice.tsx` stop passing an
   `active` value that doesn't exist.
2. **Finding 1** (Dashboard chrome divergence) — bigger call: either bring
   Practice/KnowledgeGraph/etc. onto Dashboard's new header, or accept the
   split and have `CLAUDE.md` stop claiming they're shared. Product-lane
   design decision, not just a bug fix.
3. **Finding 4** (admin passcode) — low-traffic path, but a five-minute fix:
   put a real link back wherever it used to live.
4. **Finding 3** (Testing → Settings) — no code fix needed, just update
   `CLAUDE.md`'s two references.
