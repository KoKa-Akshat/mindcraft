# Session log — 2026-08-16, native iOS app marathon

Appended to live, as work happens, so a Cursor agent picking this up mid-
stream (or after this session ends) has full context without re-deriving
it from git log alone. Newest entries at the bottom. See
`ios-prototype/JESSE_CENTRAL_AI_PLAN.md` for the architecture plan this
session is executing against.

## Instructions for the Cursor agent taking over

1. **Read `CLAUDE.md` first**, then this file, then `JESSE_CENTRAL_AI_PLAN.md`.
   `CLAUDE.md`'s Navigation-shape / Field-Desk sections are stale relative
   to tonight's volume of changes (chrome redesign, hub redesign, Jesse
   call unification) — trust this log and the actual code over that
   section specifically until someone does a proper pass to update it.
2. **Build+install+launch+verify pattern this whole session used**: after
   any `FieldDeskView.swift`/`DeskShellView.swift`/`DeskGridDashboardView.swift`
   change, build for a real device, install as an *update* (not a fresh
   uninstall — preserves the ad-hoc signing trust, see CLAUDE.md's "manual
   re-trust after every reinstall" section), launch with
   `xcrun devicectl device process launch --console ...`, and watch for
   25+ seconds of `Waiting for the application to terminate…` with no
   `App terminated due to signal N` line before calling it stable. This
   caught a real, otherwise-invisible SIGSEGV class tonight (stale
   UserDefaults desk-layout state) — don't skip it for "small" changes to
   these three files specifically, they're the highest-risk files in the
   app.
3. **Commit after each verified-stable change, don't batch unrelated
   changes into one commit** — this session did ~25 commits, each one a
   single coherent change, specifically so a bad one is easy to `git
   revert` without losing unrelated work.
4. **Lane check**: `ml/**`, `webhook/**`, `data/**`, `worlds/**` are
   Blake's lane per `CLAUDE.md`. Nothing tonight touched those except
   reading (no writes). If a task below needs a webhook endpoint,
   coordinate before building it.
5. Items marked **NOT STARTED** below are real, described asks from
   tonight that ran out of session time — they're not forgotten, just
   sequenced after what's in progress.

---

## In progress as of this entry

Working through, in this order (chosen for risk — data/backend work
first since it can't destabilize the app, native UI redesign next, the
OAuth-at-login change last since auth-flow timing is the highest-risk
item):

1. **[in progress]** Richer archive chunks.json — cross-reference
   tonight's `agent_work/product/archive_mirror/out/*/pages.jsonl` +
   `sims.json` per book into a consolidated, reasonably-sized replacement
   for the current 216-entry `agent_work/product/desk_os/workflows/archive/chunks.json`,
   matching pages to their actual sims (not currently linked) and picking
   a sane bundle size for a client-side fetch (the raw mirror output is
   262MB across 113 books — needs real trimming, not a wholesale copy).
2. **NOT STARTED** — Binder redesign (the Intel/Binder overlay boxes
   should match the visual polish of Calendar/Presentation's boxes -
   currently plainer).
3. **NOT STARTED** — Book workflow (`agent_work/product/desk_os/workflows/book/`)
   and Archive's own "meet"/voice-call screen redesigned to match the
   native app's "cute box" language (avatar + waveform + greeting bubble
   + pinned action button, cream/lime/ink palette) instead of their
   current plainer web styling. Presentation's `jesseRail` in
   `CreateCanvasView.swift` is the reference design to match.
4. **NOT STARTED, highest risk, needs care not a rush** — Gmail/Gcal
   OAuth consent prompted at login instead of deferred to a "Connect"
   tap inside a box, so the dashboard is already populated on first
   view after login. This touches the actual sign-in flow (`AuthGate`/
   wherever Google Sign-In is currently triggered) — auth-flow timing
   bugs are a real, different risk class from the UI overlay bugs this
   session has mostly been fixing (see CLAUDE.md's own note about launch-
   watchdog kills from synchronous permission prompts at launch — the
   same category of risk applies to an OAuth consent screen fired at the
   wrong moment in the login sequence). Investigate the current login
   flow's exact structure before changing it; don't guess at timing.
