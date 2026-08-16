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
3. **DONE (first pass)** — Book + Archive's "meet Jesse" screens now wrap
   avatar/status/greeting/record-button/hint in one `.jesse-card`
   (solid cream, real shadow), matching `jesseRail`'s one-cohesive-card
   pattern instead of several loose stacked elements. NOT done: the
   `#desk`/`#call` screens (the actual in-progress writing/reading
   experience after "meet") still use the older loose layout - this
   pass only touched the landing card. Also not done: Resume's page
   (its live call UI was removed entirely earlier tonight in favor of
   the native call, so it has no "meet" card to unify).
4. **INVESTIGATED, awaiting go-ahead** — Gmail/Gcal OAuth at login.
   Confirmed `AuthService.signInWithGoogle()` currently does a bare
   identity sign-in (no Gmail/Calendar scopes at all); those scopes are
   requested separately by `GmailClient.connectGoogleMailAndCalendar()`,
   which is real and already works. Recommended approach: don't touch
   `signInWithGoogle()` itself (core auth path, don't add risk to it) -
   instead, right after a Google sign-in succeeds, trigger
   `connectGoogleMailAndCalendar()` automatically after a short deferred
   delay (same `Task.sleep` pattern already proven tonight for the
   EventKit calendar-launch crash, applied to OAuth-consent timing
   instead). Not yet implemented - waiting on explicit confirmation
   this approach is right before touching the sign-in path.
5. **DONE (redesign)** — Binder card redesigned: gradient hero for ACT
   Field Book, refined instance tiles, filed items as a real
   stacked-paper list with colored accent bars, proper empty state.
   All data already existed (`FieldDeskStore.items`) - this was a
   visual pass only.
6. **DONE (planning only, see "Level 2" section in
   `JESSE_CENTRAL_AI_PLAN.md`)** — the box-mascot architecture (central
   Jesse, not per-box sub-agents; scoped connectors; Intel/Binder are
   derived views not connectors), the fix for "Transcribe" (should be
   ambient recording via a new `JesseCallSession.beginAmbientTranscription()`
   entry point, not a two-way call), a definitive read on `storyboardsRail`
   (it's a slide picker - verified in code, not "space for people on
   call"), and how Gcal-scheduled meeting transcripts (via the existing
   Fireflies pipeline) should feed central Jesse's context without
   disturbing that pipeline's existing tutor-session role. Nothing in
   this section has been implemented - see its own "Explicit
   instructions for Cursor" list for the actual work order.
