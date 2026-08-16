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

## Priority order and status

Chosen for risk — data/backend work first since it can't destabilize the
app, native/web UI redesign next, the OAuth-at-login change last since
auth-flow timing is the highest-risk item this session has touched.

1. **DONE** — Richer archive chunks.json. `build_chunks.py` (new,
   rerunnable) selects up to 24 chunks/book from the full mirror output
   (`pages.jsonl` + `sims.json` per book), filters out internal
   project-management pages the sitemap picked up (TODOs, prompts,
   learning-graph tooling), and links pages to MicroSims by slug/title
   token overlap (McCreary's sites don't expose an explicit page<->sim
   relationship - this is a heuristic, spot-checked accurate, requires
   2+ shared meaningful words to avoid false positives). Result: 216 ->
   2,612 entries (1,869 sim-linked), 2.7MB. Replaces
   `agent_work/product/desk_os/workflows/archive/chunks.json` directly -
   rerun `build_chunks.py` any time the mirror output changes. Committed,
   pushed, deployed (Firebase CI auto-deploys `agent_work/product/desk_os`
   changes on push - no iOS rebuild needed for this one, cache-bust
   query param on the chunks.json fetch was added so devices pick it up).
2. **DEPRIORITIZED, not abandoned** — Binder redesign. The user's ask
   here was brief/secondary compared to the other three items and it's
   genuinely ambiguous which surface they meant (the dashboard's Binder
   tile opens `ActInstanceShellView` - a full embedded legacy dashboard,
   a much bigger redesign than the Gmail/Calendar/Intel overlay boxes
   built earlier tonight; OR they meant the free-drag desk's own
   `binderBody` card in `FieldDeskView.swift`, which is already
   reasonably close to the other boxes' visual style). Worth a direct
   "which screen do you mean" check before spending real time here,
   rather than guessing at the more expensive interpretation.
3. **[in progress]** Book workflow (`agent_work/product/desk_os/workflows/book/`)
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
