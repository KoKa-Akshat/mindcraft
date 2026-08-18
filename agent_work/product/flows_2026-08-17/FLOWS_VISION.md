# FLOWS_VISION.md — "+ Design": the box-canvas inside Flows

**Status: implemented, PR open.** `DesignStudioView.swift` — the "+ Design"
row at the bottom of Flows — is built, compiles (`xcodebuild build`
succeeded), and is open as **PR #48** on branch `flows/design-studio`
(deliberately separate from PR #47, which is mid-flight on Book/Learn Studio
in the same two wiring files tonight). This doc is now a reference for
what's there and what's next, not a pre-build proposal.

**This file has been rewritten twice tonight after being wiped by
concurrent `git clean`/branch-switch activity on a shared checkout** — if
you're reading a version that looks incomplete relative to what's actually
in `DesignStudioView.swift`, the code is the source of truth, not this doc.

---

## What actually shipped

- **Pattern: native SwiftUI, not WKWebView.** Original plan (below, §1-13)
  assumed the WKWebView + `desk_os` pattern Resume/Archive/Book historically
  used. That was wrong by the time of implementation — reading
  `LearnStudioView.swift` and `JesseRailView.swift` directly showed the
  *current* pattern (established the same night, and what Book/Assignment F
  is actively porting onto) is: a native 1440×810 artboard
  (`DeskGridDashboardView`'s own canvas system), `JesseRailView` (the one
  shared "talk to Jesse" card — avatar, call button, inline transcript) at a
  pinned position, content boxes elsewhere on the same board. `+ Design`
  follows this exactly: canvas on the left, `JesseRailView` docked right,
  same dotted-grid/dock/pin() conventions as `LearnStudioView`.
- **Boxes**: `DesignBoxType` = `find` / `ask` / `make` / `output`. Draggable
  (`DragGesture`, clamped to the canvas region), connectable (fixed demo
  edges + a `+` menu to add more), each rendered as an accent-tinted rounded
  card matching `LearnStudioView.pane()`'s exact visual language.
- **Ask boxes make a real call.** `StudentAIKeyStore.ask(systemPrompt:
  userPrompt:)` — new, but it's a one-line wrapper around the `complete()`
  primitive that already backs `solveHomework`/`generateStudyPlan`/
  `answerDeskQuestion`. Same BYO-key path as Homework Help and Learn Studio.
  **This is the literal "seamless once you add a key" mechanism**: no
  Design-Studio-specific setup, no separate credential store — a key saved
  anywhere in Settings lights up every Ask box immediately.
- **Find/Make/Output boxes are honest, not faked.** They're real, draggable,
  connectable canvas objects, but running one says plainly "not wired to a
  real backend yet" instead of simulating a result — matching this
  codebase's own explicit rule against fabricated capability (see
  `LearnStudioView.microsimPane`'s "a placeholder, not a stub pretending to
  work").

## What's honestly still open (fast-follow, not done tonight)

- Find/Make/Output boxes don't call `GmailClient`/`DriveClient`/`BinderStore`
  yet — they're placeholders on the canvas, not wired integrations.
- No pan/zoom camera (boxes drag within a fixed-size canvas region, the
  region itself doesn't scroll) — fine for a handful of boxes, will need
  revisiting if flows grow large.
- No natural-language "describe it, Jesse builds the boxes" generation yet
  (§9 of the original brief) — this ships hand-built boxes only, per-box AI
  execution, not AI-authored flow assembly.
- No persistence — a flow resets to the demo on relaunch. Firestore storage
  under the student's own doc (matching every other feature's ownership
  model) is the natural next step, not designed here.
- Inspector panel is a fairly narrow third column (204pt at 1440 scale) —
  works, but is the roughest edge of the layout; worth a pass once the
  feature has real usage to react to.

---

## Original vision (kept for context — §1-13 mostly still hold as intent)

**Origin:** reframes a product brief Akshat wrote (originally called "Design
Studio," drafted in conversation with Fable 5) against the actual state of
the repo. It isn't a new concept — `agent_work/product/future_school_vision_2026-08-17/NORTH_STAR_V2.md`
already specifies the target architecture: *"Jesse is the only conversational
agent. Specialist boxes expose typed reports from their tools and caches...
invoke a model only for real reasoning."* That's the same box model
(Ask / Remember / Find / Make / Use / Wait / Decide / Human / Output) the
brief described. This feature is the **authoring surface** for those boxes.

### The core idea

> Flows — describe it, see it, connect it, run it.

A student describes a workflow, watches boxes assemble, then touches and
modifies what Jesse built. Non-negotiables: the student sees things
("Understand my notes," not "LLM call"), the AI prompt bar is the center of
gravity, and there's no blank-canvas cold start.

### Box vocabulary → what's real underneath

| Box type | Real anchor |
|---|---|
| Ask | `StudentAIKeyStore.ask()` — **shipped** |
| Find | Binder search — not wired yet |
| Make | Create Studio / doc generation — not wired yet |
| Use | `GmailClient`/`DriveClient`/Calendar — not wired yet |
| Output | Proof Passport / a plain artifact — not designed yet (Proof Passport itself is still an unreconciled part of the Book Mission package) |
| Remember / Wait / Decide / Human | not in the v1 type set — `DesignBoxType` ships with find/ask/make/output only; add the rest when a real use case needs them, not speculatively |

### Model routing — the honest version, not the aspirational one

`JESSE_CENTRAL_AI_PLAN.md` is explicit that boxes are not independent agents
each picking their own brain — one central Jesse, boxes are scoped
tools/connectors. Consistent with that: v1 doesn't have a multi-model
"Auto" picker. There's exactly one call path per student (whichever of
Groq/Anthropic they saved). Building a rich model marketplace UI ahead of
`StudentAIKeyStore.Provider` actually having more than two cases would be
UI that lies about what's real — grow the picker as the provider list grows,
not before.

### Research directive — study prior art, don't mass-copy it

Same standard `NEXT_SESSION.md` already applies to McCreary's CC BY-NC-SA
work: reimplementing *methods* is fine, bulk-copying source is not. Any
future dependency (e.g. a real pan/zoom canvas library if boxes outgrow the
fixed-region approach) needs a commercial-safe license (MIT/Apache/BSD)
confirmed before adding it.

### Open questions before extending further

- Should Output boxes write into Proof Passport directly, or is that data
  model still too undefined?
- Is a Human box (ask a mentor/tutor) in scope before the near-peer/mentor
  layer in NORTH_STAR_V2.md itself ships?
- Persistence model for saved flows — new Firestore collection under the
  student's own doc is the obvious shape, not yet built.
