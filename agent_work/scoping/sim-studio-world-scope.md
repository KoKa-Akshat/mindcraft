# Sim Studio World: scoping report

**Status:** scoping only, 2026-09-04 (overnight). No product code was written or changed for this report.
**Audience:** Akshat + whichever agent picks up the next Sim Studio pass.
**The ask (founder, verbatim, unpacked below):** "create sim studio as a world where they can create basic objects and customize them into the world using maths and stem ... like the sims you need to maintain for a plant and seasonal change affects it ... a house needs a switch which needs electrons and voltage to flow ... and they can learn a lesson to build this in our learn studio."

That is three distinct asks bundled together:

1. **Students create their OWN sim-objects**, not just wire the 3 pre-made seeds, grounded in real math/STEM.
2. **A persistent, evolving world** (Sims comparison): a plant that needs maintaining, seasons and time that genuinely pass, not just instant live recompute.
3. **Learning gates building**: a house needs a switch, a switch needs understood voltage. Object creation ties into the real Learn concept graph.

Ask 1 and ask 3 are a fast next phase on top of what shipped tonight. Ask 2 is a real, longer-horizon architecture. Details and a phased plan below.

---

## 1. Verified ground truth (what is actually real right now)

### 1a. Shipped and deployed tonight (confirmed directly by reading code + git)

- **Sim Studio** is live in Desk OS: commit `cfce1795` ("Desk OS: add playful hub and Sim Studio") on `origin/main`, deployed per `ACTIVE_TASK.md` (deployed HTML and simStudio.js hashes verified against `app/dist` in that session).
- `agent_work/product/desk_os/js/simStudio.js` (742 lines):
  - 3 hand-authored seed templates, `sun`/`shade`/`plant` (`TEMPLATES`, lines 169-212). Their formulas are hardcoded JS inside `simDocument()`, not AI-generated.
  - The wire protocol, both sides: iframes post `sim:ready` (line 162) with declared inputs/outputs, post `sim:output` continuously (line 119), accept `sim:input` (line 146). The host consumes all three generically in `handleMessage` (lines 622-653).
  - **The host side is already template-agnostic where it matters**: `normalizeInputs`/`normalizeOutputs` (lines 214-233) build ports purely from whatever the iframe declares in `sim:ready`. The ONLY hardcoded parts are the `TEMPLATES` map and `addNode(templateId)` (line 537) requiring a known template id, plus the iframe `srcdoc` assignment (line 588). This is the single most important reuse fact in this report.
  - Cycle protection (`hasPath`, 366-379), solo full-size view (473-494), drag (507-535), palette drag/drop (673-704).
  - **Zero persistence**: no `fetch`, no `localStorage`, no Firestore anywhere in the file. `void reset()` at init (line 727) wipes the board every mount. Confirmed by grep.
- Tests: `agent_work/product/desk_os/tests/simStudio.browser.mjs` (181 lines), a real Playwright suite covering the protocol, value propagation through the 3-sim chain, drag, wiring gestures, solo view, and 3 viewports.
- Desk OS has **real Firebase auth**: `js/fire.js` (shares the /login session, line 16 comment), and `js/resumeHelper.js:559-562` already shows the exact authed-call pattern (`fire.user.getIdToken()` then `Authorization: Bearer`) Sim Studio would use for generation calls.

### 1b. Real but in the working tree only: THE DEPLOY GAP (confirmed via `git status` in both repos)

Tonight's generation-side work is **not committed and not deployed**:

- `~/Developer/mindcraft-content-engine`: `simulation_generator.py` (+196 lines vs HEAD) and `serve.py` are modified, uncommitted. That diff contains:
  - The chainability contract in the generation prompt: every newly generated sim must append the `sim:ready` / `sim:output` / `sim:input` bridge (`_GENERATION_PROMPT_TEMPLATE`, lines 109-128).
  - `OpenAICompatGenerator` (lines 526-649) and `build_byok_generator()` (lines 652-674): BYOK across all 6 Settings providers (openai/groq/gemini/openrouter/anthropic/custom).
  - `serve.py` accepting `student_byok` on `POST /generate` (lines 901-924) and dispatching via `build_byok_generator` (line 275).
- `mindcraft` repo: `webhook/lib/handlers/generate-sim.ts` (the `studentByok` relay, lines 110-115 and 196-206) and `app/src/lib/conceptLibrary.ts` (`simByokFields()`, lines 346-350) are also modified, uncommitted.
- The deployed HF Space (`https://joinmindcraft-mindcraft-content-engine.hf.space`) runs the previously deployed code and **needs a manual deploy** even after commit (known from the BYOK architecture notes).

Consequence, stated plainly: **as of right now, production `/api/generate-sim` produces sims that do NOT declare the wire protocol and accepts only the older Gemini-key BYOK.** Everything in `generated_sims` today predates the bridge. Phase 0 below is closing this gap before any feature work.

### 1c. Reported by tonight's verifying session (not re-run for this report, corroborated where possible)

- The Playwright suite passes (re-run independently tonight by the coordinating session).
- The protocol was proven end to end with one real Groq call producing a working chainable Simple Harmonic Motion sim (2 inputs, 6 outputs), verified in a browser. Consistent with the uncommitted prompt block; not re-run here.
- **Open issue:** node dragging becomes unreliable while the real knowledge-graph iframe renders in the background. Corroborated: the test suite itself carries a `DESK_OS_BLOCK_GRAPH=1` escape hatch that aborts `full-graph-viewer.html` requests (`simStudio.browser.mjs:7, 25-28`). Mechanism is plausibly main-thread jank starving `pointermove` on the drag handle (`makeDraggable`, simStudio.js:507-535). This matters more, not less, in a world with many live sims; see risks.

### 1d. The Learn side this must connect to (confirmed directly)

- `app/src/lib/conceptLibrary.ts`: 4118 concepts, 13 subjects, 3746 lessons, 722 built sims, 7330 prerequisite/cross-subject edges in Firestore (`conceptLibrary`, `conceptLibrarySims`). Key functions: `resolveConcept()` (semantic search + prereq ramp, lines 123-146), `fetchConceptContent()` (175-213), `fetchCheckQuestion()` (299-321), `loadStudyLog()`/`recordStudied()` (426-476, "studied" = actually answered a check question).
- **The full graph is already client-readable without auth or an embedding model**: `app/public/full-concept-graph.json` (1.47 MB, generated 2026-08-30) carries all 4118 nodes AND all 7330 edges with `relation: "prerequisite"`. Desk OS already fetches it for hero search (`bootHub.js:467-500`). The prereq closure for gating needs zero new backend.
- Deep links exist: `/learn?q=<query>` (`Learn.tsx` reads `q` at lines 110 and 583; route at `App.tsx:409`).

### 1e. The generation pipeline this reuses (confirmed directly)

- Client: `generateSim(topic)` in `conceptLibrary.ts:352-405`. Start-then-poll, honest failure reasons, 150s client budget, BYOK forwarding.
- Webhook: `webhook/lib/handlers/generate-sim.ts`. Auth required, per-student daily cap + platform monthly cap (skipped when a student key is present, lines 153-173), reuse library `generated_sims` keyed by `topicSlug` checked BEFORE budget (79-96, 127-130), gate-passed results persisted before responding (275-289), training capture to `sim_training_events` (269-274). `MAX_TOPIC = 200` chars (line 71).
- Service: full gate (fit-check -> generate -> headless render -> structural rubric -> vision gate). Stored `html` is **self-contained** (sketch.js inlined, `serve.py:483-516`), so a library sim drops straight into an iframe `srcdoc`. `assess_fit` (simulation_generator.py:357-394) already refuses non-mechanistic topics with an honest reason, which is exactly the "grounded in real STEM, not decorative" filter ask 1 needs.

---

## 2. Duplication audit: what already exists (the founder has been burned here before)

Searched: `app/src`, `agent_work/product/desk_os`, `webhook`, `worlds/`, root landing, firestore rules, plus repo-wide greps for the protocol strings, generate-sim callers, and world/sandbox/garden/farm/pet/avatar/tycoon/habitat vocabulary.

### Things that look like "the world" and already exist

| What | Where | Status | Implication |
|---|---|---|---|
| **`/world-builder` spec with `world_state/{uid}`** | `AGENT_RULEBOOK.md:469-490` (§1.7, marked "future, do not build yet") | Spec only. `world_state` appears NOWHERE else in the repo | Ask 2 already has a named home and a data-model name. Extend THIS spec, do not invent a parallel one |
| **A real deployed 3D world** ("Jesse's Kitchen", Three.js ramen shop fork) | `worlds/world2/` (nav layer `mc-world-nav.js`, ~640 lines); deployed via `firebase.json:62-117` -> site `mindcraft-world1` | Live but orphaned: no route from the React app, no save state at all | A "world" SURFACE exists. It is presentation, not simulation. Do not build a second orphan |
| **"Math as a World" vision doc** | `WORLD_VISION.md` §2 (living world, fog-of-war map), §4 Horizon 2 ("knowledge graph becomes literal terrain"), **§8 co-founder building the world dimension in Roblox** | Vision only | Before phase 3, confirm lane ownership with the co-founder: a Roblox world and a web world are either one roadmap or two wasted ones |
| **Landing-page "creation studio"** (name your world, pick levers) | root `index.html:1240-1600`; 6 hand-made "worlds" (`DOMAINS`, 1470-1512) | Live, deliberately NON-generative (line 1390 says it never calls `/api/generate-sim`); keyword-matches into existing `library/sims/` files | The "describe a thing, get a sim" UX has a shipped marketing-page cousin. Reuse its lesson (honest matcher + levers), don't fork its code |
| **Desk OS "Create Space" studio** (pan/zoom build canvas, asset chest, starter packs) | `agent_work/product/desk_os/studio/index.html` (routes `/studio`, `/try/studio`) | Prototype; persists layout only, to localStorage | A second canvas-building surface already exists. A "world board" must be Sim Studio growing, not a third canvas |
| **A second, incompatible sim message protocol** | `desk_os/studio/simulation/index.html:187` posts `{action:'simulationState'}` over an iOS bridge stub | Mock | Exactly the fragmentation trap. `sim:ready/output/input` is the one protocol; anything new extends it |
| **Dead floating-island map CSS** | `app/src/pages/Practice.module.css:2496-2645, 2922-2963` (`.islandMap`, `.island*`, hard/kinda/easy variants) | Dead: referenced by no .tsx | Free visual language for a phase-3 world map, already in the design system |
| **Dead agentic "learning world" ML layer** | `docs/agentic-learning-world-architecture.md`; `ml/mindcraft_graph/models/learning_world.py` | Explicitly dead (`CLAUDE.md:812-814`: excluded from live serve.py) | Don't resurrect silently; don't duplicate its naming either |

### Things ask 1 and ask 3 must reuse rather than rebuild

| What | Where | Status |
|---|---|---|
| Wire protocol, complete consumer list | `agent_work/product/desk_os/js/simStudio.js` + its byte-identical deploy mirror `app/public/desk-os/js/simStudio.js` (lines 119/146/162/350/626/644 in both). **No other consumer in the repo** | The two-copy mirror is the same gotcha class as `full-graph-viewer.html`'s two copies. Any simStudio.js change must be synced to both |
| Generated-sims gallery endpoint | `webhook/lib/handlers/list-generated-sims.ts` (ungated read of `generated_sims`) | Live; currently **zero web callers** (iOS Archive only). This IS the phase-1 palette feed, already built |
| McCreary corpus endpoint | `webhook/lib/handlers/microsims.ts` (4013 sims, 95 repos, manifest + on-demand inlining) | Live; iOS only. These sims do NOT speak the wire protocol; they can fill a solo-play shelf later but cannot chain |
| Per-concept built sims | `conceptLibrarySims` (722 sims), read by Learn | Live. Also protocol-less today |
| Static sim corpus | `library/sims/` (722 html files, marketing hosting) | Live |
| Sim engagement telemetry | `webhook/lib/handlers/log-sim-interaction.ts` (dwell + touch, `sim_interactions/{uid}`) | Live, iOS producer only today. Reuse for world telemetry; do not build a second pipe |
| Per-student accreting artifact pattern | `app/src/lib/studentBooks.ts` (`student_books`: thin refs to shared content + inline personal overlay, 1MB-aware) | Live. This is the proven doc shape for a future `world_state/{uid}` |
| Catalog/equip economy | `app/src/lib/coverStickers.ts` + `StickersShelf.tsx` (localStorage only) | Live. Shortest path to a world "inventory" feel later |
| Study log + check questions | `conceptStudyLog`, `fetchCheckQuestion` | Live. This is the gating substrate for ask 3 |

### Explicit negatives (searched, none found)

- No sandbox/garden/farm/village/tycoon/habitat product feature anywhere (all keyword hits are incidental copy or `sandbox=` iframe attributes).
- No pet growth stages rendered anywhere (only `learnActivityCount` plumbing; nothing paints a stage).
- No persistence of any user-built board or node graph, anywhere.
- No seasons/time mechanic anywhere.
- No `world_state`, `worlds`, `pets`, `inventory`, `rooms` Firestore collections in the deployed rules.
- No multiplayer/shared-space anything.

---

## 3. Ask 1: students create their own sim-objects (fast next phase)

### What reuses tonight's work as-is (no new backend)

- The **host needs no new port logic at all**: any iframe that speaks `sim:ready` gets working ports today (section 1a). A "custom node" is `addNode` accepting `{title, html}` instead of only a `TEMPLATES` id.
- The **full generation gate** (fit-check, render, rubric, vision) is the quality bar for student objects, unchanged. `assess_fit` refusing "too vague to simulate" with a reason is a feature here, not a bug: it is the honest answer to "make me a cool thing" vs "make me a switch with voltage and current".
- **Self-contained html** from the library drops straight into `iframe.srcdoc` (serve.py:483-516).
- **BYOK across all 6 providers** means per-student generation cost lands on the student's key; budget caps protect the platform path. All plumbed, uncommitted (section 1b).
- **The reuse library** (`generated_sims` keyed by topic slug) means the second student who asks for "a light switch" gets it instantly and free.

### Three ways to build "create a custom object", with real tradeoffs

**Option A: AI-generated per student via the existing `/api/generate-sim`** (description in, gated sim out).
- For: the entire pipeline exists end to end; the gate enforces "real mechanics, declared I/O"; BYOK makes cost scale; the library compounds (every student creation becomes everyone's palette item).
- Against, honestly: 15-60s+ latency per new object (up to the 150s client budget), and the gate genuinely rejects some asks, so the UX must present "generating + reviewing" and "refused because X" truthfully (the client already does, `conceptLibrary.ts:352-405`). `MAX_TOPIC = 200` chars caps the description (generate-sim.ts:71). The shared `topicSlug` cache means two students' "my switch" collide into one shared sim: fine as a feature for phase 1 (reuse-first is the platform's stated economics), wrong for truly personal variants later. And nothing in the library chains until phase 0 deploys.

**Option B: parameterized hand-authored templates** (more seeds like sun/shade/plant, with exposed knobs).
- For: instant, reliable, curated pedagogy, no spend, no gate misses.
- Against: authoring cost per object; a student "customizing a template" is not "creating their object"; it uses none of tonight's pipeline investment; and hand-scaling a template zoo across 13 subjects is precisely the fragmentation pattern this repo keeps paying for.

**Option C: hybrid.** Curated seeds stay as instant starters and as the world's guaranteed-reliable objects; AI generation is the "invent something new" lane; a later "remix" action regenerates an existing object with the student's change request (the `retry_feedback` plumbing in `_build_prompt`, simulation_generator.py:213-248, is the natural carrier).

**Recommendation: A now, C as the shape it grows into.** A is the only option that makes tonight's protocol + BYOK work pay, and it needs near-zero new backend. B alone would quietly discard the pipeline. Do not build a template-authoring system in phase 1.

### New work actually required (small, host-side)

1. A palette card "Invent a sim": textarea -> `POST /api/generate-sim` with `fire.user.getIdToken()` (pattern: resumeHelper.js:559-562) -> poll -> on pass, add a custom node. A node-shaped "generating..." placeholder honestly narrating the wait (the endpoint's `onStatus` strings exist for this).
2. `addNode` accepting a custom definition (title + self-contained html + accent), maybe 30-50 lines in simStudio.js, synced to the `app/public/desk-os` mirror.
3. A "From the library" palette section fed by the existing `/api/list-generated-sims`, **filtered to chainable sims** (html containing `sim:ready`), because everything currently in the library predates the bridge. Non-chainable ones can appear under "play solo" or not at all; the host already shows an honest "has no outputs" state (simStudio.js:629-631).

---

## 4. Ask 3: learning gates building ("a switch needs voltage")

### The mapping problem: object -> concept

- In the web app: `resolveConcept(description)` is real semantic search over all 4118 concepts and returns the prereq ramp too (conceptLibrary.ts:123-146).
- In Desk OS (static, no embedding model): the same client-side label match Desk OS hero search already does over `full-concept-graph.json` (bootHub.js:467-500). Do not build a third resolver.
- Honest caveat: keyword mapping mismatches. Always SHOW the mapped concept on the node ("This is really about: Voltage") and let the student correct it from the top-5 matches. A silent wrong gate is worse than no gate.

### The gate itself: gate the POWER, not the creation (recommended)

Two designs, both cheap; recommend the first:

- **Soft gate (recommended): the object builds, but stays dormant.** The switch node generates and appears, its ports visible, but the host does not propagate values through wires into/out of it until its gating concept is studied. Wire label reads "locked: learn Voltage" with one button deep-linking `/learn?q=voltage` (Learn.tsx:583). Mechanically this is a guard in `pushConnectionValue` (simStudio.js:338-353) plus a badge, nothing more. This is literally the founder's sentence: the switch exists but electrons do not flow until you understand them. Creativity is never blocked, function is earned.
- **Hard gate: refuse to generate until prereqs are met.** Simpler to reason about, but it turns "I had an idea" into a wall, and it wastes the moment of maximum motivation. Keep as a per-classroom option later if teachers want it.

### "Studied" already has a real definition

`conceptStudyLog` records a concept as studied only when the student ANSWERS its check question (conceptLibrary.ts:407-476, `fetchCheckQuestion` at 299-321). Reuse exactly this: unlock = answered the gating concept's check question. Desk OS can read the study log with its existing Firebase session and can even offer the check question in place (a small dialog) so the loop closes without leaving the board. Prereq CHAINS (voltage needs current needs charge) come free from the `prerequisite` edges already in `full-concept-graph.json`; for phase 2, gate on the direct concept only, show the ramp, and let Learn's own PathRamp handle depth.

---

## 5. Ask 2: the persistent, living world (real vision, longer horizon)

This is not an evening. Stating what it actually requires so it can be planned honestly:

### State: `world_state/{uid}` in Firestore

- The name is already specced (AGENT_RULEBOOK.md §1.7). Shape should follow the proven `student_books` pattern (thin refs + personal overlay, studentBooks.ts): placed objects as `{simSlug, x, y, params}` refs into the shared library, wires, per-object persistent state (accumulated growth, health), `lastTickAt`, and a server timestamp on save.
- Phase 1's board save (below) starts in localStorage; the Firestore doc is the phase-3 promotion of the same JSON.

### Time: lazy catch-up ticks, no server simulation

- Recommended: the idle-game pattern. World time is a pure function of wall clock; on open, compute elapsed time, run N coarse ticks client-side, show an honest away-summary ("2 days passed. Your plant dried out."). Cap N so a month away is a bounded replay.
- Why not a server tick loop: the webhook is serverless (Vercel) and the HF Space has no persistent disk and holds jobs in memory; neither is a place for a heartbeat. A cron could later add slow offline consequences, but nothing in the founder's ask needs one to start.
- Anti-cheat is only "server timestamp on save"; a student winding their clock to grow a plant is not a threat model worth architecture.

### Protocol: ONE extension, and it must be designed EARLY

- Add two optional, backward-compatible messages: host -> sim `sim:tick {simTime, dtDays, season}` and sim -> host `sim:state {values}` (serializable snapshot to persist and restore). Sims that ignore them remain pure dataflow nodes; nothing existing breaks.
- **The load-bearing scheduling fact:** generated sims are immutable once in the library. If the tick/state contract is not in the generation prompt when phase 1 starts filling the library with student objects, phase 3 inherits a library of objects that cannot live in time and must all be regenerated. The contract (about 15 prompt lines, same shape as tonight's bridge) should ship with phase 0/1 even though nothing consumes it yet. This is the one place phase 3 reaches back into phase 1.

### Environment as a node, not a mechanism

- Season/sun/weather is just a host-provided source node emitting outputs on the existing wire protocol; the current sun dial is already a proto-environment node. "Seasonal change affects the plant" = environment node wired into the plant, with `sim:tick` sweeping the season input. No second dataflow system.

### Known hard problems (naming them now, not solving them)

- **Rendering load:** every sim is a live iframe. Tonight's drag-jank-with-graph-iframe report (section 1c) says 15 live sims will hurt. A world needs node sleep/wake (offscreen or unwired nodes get their srcdoc parked and their last `sim:state` shown as a static card).
- **Mechanics ownership:** decay/needs rules must live inside the sim (it owns its math); the host only delivers `dt`. Otherwise the host grows a shadow physics engine.
- **Lane ownership:** WORLD_VISION.md §8 has a co-founder building the world dimension in Roblox. Reconcile before building phase 3, or agree they are deliberately two surfaces over one `world_state`.
- Out of scope until explicitly asked: shared/multiplayer worlds, avatars, currency.

---

## 6. Phased plan

### Phase 0: pay the deploy debt (hours, do first, nothing else works without it)

1. Commit tonight's working-tree changes in BOTH repos (content-engine: simulation_generator.py + serve.py; mindcraft: generate-sim.ts + conceptLibrary.ts + byokSettings.ts et al.).
2. Add the `sim:tick`/`sim:state` contract lines to the generation prompt at the same time (section 5, the one early decision).
3. Manual HF Space deploy; Vercel deploy.
4. Verify ONE live generation in prod produces a sim whose html contains the `sim:ready` bridge.
5. **Check platform billing first:** recent sessions found both platform Anthropic and Gemini keys failing in prod (billing/quota). The vision gate spends the platform Anthropic key even on BYOK jobs, so generation can fail at the last gate through no fault of this work. Re-verify before promising phase 1.

### Phase 1: "Invent a sim" (the smallest slice that proves the direction, one focused pass like tonight's)

1. Palette card + description box in Sim Studio -> authed `generateSim()` call -> honest progress node -> custom node on pass (section 3, items 1-2).
2. "From the library" palette section via `/api/list-generated-sims`, filtered to chainable sims (section 3, item 3).
3. Concept chip on every custom node ("This is really about: X", correctable, deep-linking `/learn?q=X`). Mapping via the graph-json label match. No enforcement yet.
4. Board save/restore in localStorage: `{nodes: [{templateId | librarySlug, x, y}], wires}`. Custom sims re-fetch by slug, so the saved board is small JSON and survives the reuse library growing.
5. Extend `simStudio.browser.mjs`: mock `/api/generate-sim` via Playwright route interception with a canned chainable sim; assert it wires into the plant and the board survives reload.
6. Sync `agent_work/product/desk_os/` -> `app/public/desk-os/` (the two-copy gotcha).

Non-goals for phase 1, explicitly: no ticks, no seasons, no Firestore world doc, no gate enforcement, no sim editing, no McCreary/conceptLibrarySims chaining (they don't speak the protocol).

### Phase 2: the gate goes live + personal shelf

- Dormant-wire soft gate on the concept chip, unlock by answering the check question in place (`fetchCheckQuestion` + `recordStudied`), "locked: learn X" wire labels (section 4).
- "My objects" shelf: per-student view of their creations. Decide cache semantics here: keep the shared `generated_sims` library as the commons, add a lightweight per-student index (uid -> slugs), not a fork of the library.
- "Remix" on a custom node (regenerate with the student's change request via the retry-feedback path).

### Phase 3: the living world (weeks, its own spec, extend AGENT_RULEBOOK §1.7)

- `world_state/{uid}` doc + lazy catch-up ticks + away-summary (section 5).
- Environment node (season/sun source) sweeping `sim:tick`.
- Node sleep/wake for perf; revisit the drag-jank issue as part of it.
- A world frame (the dead island-map CSS in Practice.module.css is a free starting visual language; `worlds/world2` is the existing 3D shell if the answer is ever "enter the world in 3D").
- Precondition: the Roblox lane conversation.

### Risks, one table

| Risk | Grounding | Mitigation |
|---|---|---|
| Platform AI keys failing in prod | Prior session finding (billing/quota, breaks sims) | Phase 0 step 5; BYOK covers generate but NOT the vision gate today |
| Deploy gap silently persists | Both repos uncommitted right now | Phase 0 is its own step, verified by a live generation |
| Library sims that cannot chain | Everything in `generated_sims` predates the bridge | Filter palette on `sim:ready` presence; badge, never fake ports |
| Two-copy Desk OS mirror drift | `app/public/desk-os/js/simStudio.js` byte-identical today | Sync step in every phase-1+ checklist |
| Drag jank under load | Reported tonight; test suite's own block-graph flag | Keep phase 1 small boards; sleep/wake is phase 3 work |
| Gate mis-mapping concepts | Keyword matching is approximate | Always show + let the student correct the mapped concept |
| A third canvas / second protocol appears | Create Space + `simulationState` bridge already exist | The world is Sim Studio growing; `sim:*` is the only protocol |
| Roblox/world lane collision | WORLD_VISION.md §8 | Explicit co-founder conversation before phase 3 |

---

## 7. Open questions for Akshat

1. Soft gate (dormant until learned) vs hard gate (cannot build until learned)? This report recommends soft.
2. Shared-by-default creations (current library economics) vs private-by-default with opt-in sharing? Phase 1 inherits shared; say so in the UI either way.
3. World timescale when phase 3 comes: real days (a plant takes a real week) vs accelerated (a season per day)?
4. Is the eventual world a Sim Studio mode, a fifth Desk OS surface, or the `worlds/world2` 3D shell? (This changes phase 3 only.)
5. Who owns the world lane given WORLD_VISION §8's Roblox direction?
