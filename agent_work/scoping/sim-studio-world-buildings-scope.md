# Sim Studio world: plant + two buildings, scoping report

**Status:** scoping only, 2026-09-04. No product code written or changed.
**The ask (founder, verbatim):** "make it a nice world with a plant and two buildings, resume help feature wired in inside the building on a screen somewhere and also another building to do research which is our learn, use fable 5 to scope this world and make sure the build is like mindcraft, modular, free and you can design and stuff"
**Relationship to `sim-studio-world-scope.md` (earlier tonight):** that report scoped a different, bigger ask (student-created sims, learning gates, a persistent living world). This one scopes a smaller, faster ask layered on top: world presence + two feature buildings. Nothing here contradicts it; where the two touch (world persistence, the "world is Sim Studio growing" rule, `world_state/{uid}`), this report defers to it and says so inline.

---

## 1. Verified ground truth (checked directly for this report)

- **The world section IS deployed.** `https://mindcraft-93858.web.app/desk-os/index.html` is byte-identical to source (SHA1 `fdaef2a3...` both sides), contains all 3 `sim-world-object` hits, the served `simStudio.js` contains `openWorldObject`, and the served `styles.css?v=workspace3` contains all 9 `sim-world` rules. The founder not seeing it is client-side: most likely a tab left open from before the deploy (an open tab never re-fetches on its own; the `no-cache` headers only help on reload). A plain reload fixes it. Not a missing deploy.
- **Both Desk OS mirrors are in sync**: `agent_work/product/desk_os/` and `app/public/desk-os/` are diff-identical for `index.html` and `js/simStudio.js` right now. Any change must keep them synced (the standing two-copy gotcha).
- **Current world visual** (`styles.css:6674-6702`): one 120px-tall gradient strip (sky into ground) holding a single bordered button labeled Plant. It reads as a toolbar row with a background, not a place. The founder's "nice world" read is fair.
- **How the plant click works today** (`simStudio.js:858-871`): `openWorldObject('plant')` finds or creates the real plant board node, then `openSolo(node)` moves that node's live iframe into the solo dialog next to the `DOCS.plant` factor panel. One real sim, two doors. This pattern is worth keeping exactly.
- **Resume Helper is real and has one true open path**: `createResumeHelper({root: #hubResume})` (app.js:2097-2100), opened by `showResumePanel()` (app.js:638-643) which calls `resumeHelper.open()` (resumeHelper.js:981, it unhides its own root). The trigger today: any element carrying `data-hub-resume-nav` inside the hub gets wired by bootHub.js:558-563 to `selectDashboardTab('resume')` + `onResumeOpen` (which is `showResumePanel`). The quick-launch tiles already prove this attribute-reuse pattern works with zero new JS (index.html:245-253 comment).
- **Learn is a React route on the SAME origin.** `firebase.json` serves Desk OS static files and the React app from one hosting target (`app/dist`); `/desk-os/**` rewrites to static files, everything else to the React `index.html`. `/learn` is `<AuthGuard><Learn /></AuthGuard>` (App.tsx:409), and `?q=` auto-runs one search on mount (Learn.tsx:581-589).
- **Cross-app navigation Desk OS -> Learn already exists twice**, both as full navigations with a written rationale: the "Dashboard" tab (`window.location.href = '/learn'`, bootHub.js:592-594, comment: "this has to be a full navigation, not a client-side route change") and hero search's "Open in Learn" (`window.location.href = '/learn?q=...'`, bootHub.js:532-535).
- **No frame-blocking headers exist**: firebase.json sets only Cache-Control; app/index.html has no CSP meta. So an iframe of `/learn` inside Desk OS is technically possible (same origin, Firebase auth in IndexedDB is shared, AuthGuard would pass). Possible is not the same as wise; see section 4.

---

## 2. The reusable world-object contract

The rule that keeps this "like MindCraft, modular": **a world object is one data entry, and its click behavior is a small discriminated union, not three bespoke handlers.** Three kinds cover the plant, both buildings, and every 4th/5th object anyone has proposed so far:

```js
// worldScene.js (new small module, imported by simStudio.js) or a const at
// the top of simStudio.js. Data, not code.
const WORLD_OBJECTS = [
  {
    id: 'plant',
    label: 'Plant',
    visual: 'plant',              // picks a CSS-drawn body class, see 3
    icon: 'plant',                // existing svg glyph id
    position: { x: 18, y: 0 },    // % across the scene, % up from the ground line
    action: { kind: 'sim', templateId: 'plant' },   // -> openWorldObject(), unchanged
  },
  {
    id: 'careers',
    label: 'Careers office',
    visual: 'building-screen',    // a building body with a lit screen in the window
    icon: 'resume',
    position: { x: 55, y: 0 },
    action: { kind: 'panel', nav: 'resume' },       // -> stamps data-hub-resume-nav
  },
  {
    id: 'library',
    label: 'Research library',
    visual: 'building',
    icon: 'book',
    position: { x: 82, y: 0 },
    action: { kind: 'link', href: '/learn', newTab: true },  // -> real Learn
  },
];
```

- **`action.kind` is the whole dispatch.** One `switch` in the renderer, roughly 3 lines per case:
  - `sim`: call the existing `openWorldObject(templateId)`. Solo dialog + `DOCS` panel come free, exactly as the plant works tonight. A sim object gets its docs by adding a `DOCS[templateId]` entry, no new mechanism.
  - `panel`: the renderer stamps the matching nav attribute (`data-hub-resume-nav`, `data-hub-jesse-nav`, `data-hub-sim-nav`) on the button and does nothing else. bootHub.js's existing `querySelectorAll` wiring picks it up: correct tab bookkeeping, correct panel open, zero new JS. **Load-bearing ordering fact, verified:** `ensureBootHub()` (app.js:660-702) creates `simStudio` BEFORE `createBootHub`, so buttons the scene renderer creates synchronously exist when bootHub queries. If that order ever changes, the fallback is a one-line addition exporting `selectDashboardTab` from bootHub's return object and an `onOpenPanel` callback into `createSimStudio`; not needed today.
  - `link`: `window.open(href)` or `window.location.href = href` (see section 4 for which). Covers Learn and any future cross-app door (e.g. `/desk-os/workflows`).
- **Adding a 4th or 5th object is one array entry** if it is any of these kinds (a Shade lab hut: `{kind:'sim', templateId:'shade'}`; a Tutors building: `{kind:'panel', nav:'tutors'}` reusing `data-hub-jesse-nav`). A genuinely new behavior is one new case in one switch. That is the honest definition of "no new architecture for the next object."
- **What this contract deliberately does NOT include yet:** persistence, student placement, size/rotation, z-index fights. Positions are hand-authored percentages in phase 1. The array itself is the thing a phase-3 authoring mode would read and write (and its persisted home is the already-specced `world_state/{uid}`, per the earlier report's section 5; do not invent a second store).

### How the scene renders from the list

- index.html's hardcoded plant button is replaced by an empty `<div class="sim-world-scene" data-sim-world-scene></div>`. `renderWorldScene(sceneEl, WORLD_OBJECTS)` builds one `<button class="sim-world-object is-{visual}">` per entry, positioned `left: {x}%; bottom: {y}%` (absolute, bottom-anchored so everything sits on the ground line), later-in-list renders on top for cheap depth.
- **Visuals are CSS classes per `visual` type, not per object.** The codebase's flat chunky style (2px ink borders, hard offset shadows, the same language the sims draw themselves with: `.shade-roof`, `.plant-pot` in simStudio.js:38-51) extends naturally to a building: a wall block, a roof polygon, a door, a window; `building-screen` adds a small lit rectangle in the window (the founder's "on a screen somewhere", visible from outside). No image assets, no canvas, no library. Scene gets taller (about 240-280px), keeps the existing sky/ground gradient, adds a sun disc and one or two cloud shapes as pure CSS. That is the entire "nice world" budget for phase 1, and it is enough to read as a place instead of a toolbar.
- Rendering happens synchronously inside `createSimStudio` (before bootHub exists, per the ordering fact above).

---

## 3. The Resume building: wiring the REAL feature

- **Recommendation: the building click IS the existing resume nav.** `action: {kind:'panel', nav:'resume'}` -> `data-hub-resume-nav` -> bootHub wiring -> `selectDashboardTab('resume')` + `showResumePanel()` -> `resumeHelper.open()`. The student lands in the real three-pane Resume Helper (rail/chat/right panel, real `/api/resume-agent`, real `users/{uid}/jobOS` docs). No parallel resume UI, no iframe copy, no second entry path to maintain.
- **"On a screen somewhere": two honest options.**
  - **(a) Screen as exterior visual, click goes straight in (recommended for phase 1).** The building's window contains a lit CSS screen showing a tiny resume glyph; clicking the building opens the real feature in one click. The metaphor is on the building; the feature is the feature.
  - **(b) Interior dialog first.** Reuse the solo-dialog pattern: click opens a "you stepped inside" dialog drawn as a desk + monitor, the monitor is a button that fires the resume nav. Prettier story, but it inserts a click between the student and a real tool, and the interior is pure theater with nothing live in it (mounting the real resume panel inside a dialog-sized monitor frame would mean fighting `#hubResume`'s full-panel layout for a cramped fake). If the founder wants the interior beat, do it in phase 2 and keep it to one extra click.
- Not possible without real cost, stated plainly: literally rendering the live Resume Helper "on a screen" inside the world scene (a miniature working app in the building window) would require either mounting `#hubResume` at thumbnail scale (unusable, and it can only be mounted in one place) or a second copy of the UI (exactly the parallel-surface trap this codebase keeps paying for). Recommend against; the lit-screen visual carries the idea.

---

## 4. The Research building: opening Learn from Desk OS, the real answer

Learn is a full React app surface; Desk OS is a static vanilla-JS page. Same origin, different worlds. Three real options, with the actual tradeoffs:

| Option | What happens | For | Against |
|---|---|---|---|
| **Full navigation** (`window.location.href='/learn'`) | Desk OS page is torn down, Learn boots | The established pattern, twice, with a written rationale (bootHub.js:592, 534). Simplest. Back button usually restores Desk OS from bfcache | The Sim Studio board is NOT persisted (confirmed: `reset()` wipes on every mount), so anything the student wired is gone when they return via a fresh load. Bfcache restore is common but not guaranteed |
| **New tab** (`window.open('/learn','_blank')`) | Desk OS keeps running, Learn opens beside it | Board survives; a research side-trip returns to an intact world; popup blockers allow it inside a direct click handler | Tab clutter; slightly off-pattern vs the two same-tab precedents; two live app tabs on a school Chromebook is real memory |
| **Iframe** (`<iframe src="/learn">` in a dialog) | The whole React app boots inside Desk OS | Technically possible, verified: same origin, no X-Frame-Options/CSP anywhere, Firebase auth shared via IndexedDB so AuthGuard passes. Feels most like "inside the building" | Loads the entire React bundle + Learn's on-device embedding model inside a page that already documents drag jank from ONE background iframe (the graph viewer; the Playwright suite ships a `DESK_OS_BLOCK_GRAPH=1` escape hatch because of it). Learn's own nav links would route the iframe deeper into the React app, trapping a full product in a porthole. Never tested framed. This is the hand-wave answer that looks slick in a demo and bleeds in real use |

- **Recommendation: new tab now, same tab later.** Phase 1 ships `window.open('/learn', '_blank')` because board loss is the worse UX today. When board save/restore lands (already scoped as phase 1 item 4 of the earlier report, localStorage), switch to same-tab `window.location.href` and match the two existing precedents. The `link` action kind carries a `newTab` flag so this is a data flip, not a rewrite.
- Recommend against the iframe unless the founder explicitly wants "Learn inside the world" enough to fund the perf work (node sleep/wake etc., which the earlier report placed in its phase 3).
- Plain `/learn` (no `?q=`) is right for a building click: there is no query context, and Learn's EntryStage is built for blank-slate arrival. A later polish: if a sim node's concept chip exists (earlier report, its phase 1 item 3), the building could open `/learn?q={concept}` when a node is selected.

---

## 5. Phased plan

### Phase 1: three objects, one pattern (the smallest real shippable slice, one focused pass)

1. `WORLD_OBJECTS` array + `renderWorldScene()` + the three-case action switch (section 2). Replace the hardcoded plant button; the plant entry reproduces tonight's behavior exactly via the same `openWorldObject`.
2. Scene CSS pass: taller scene, CSS buildings (`building`, `building-screen` visuals), sun/cloud, ground line. All in the existing flat-ink style, no assets.
3. Careers office: `{kind:'panel', nav:'resume'}` (section 3, option a).
4. Research library: `{kind:'link', href:'/learn', newTab:true}` (section 4).
5. Tests: extend `tests/simStudio.browser.mjs` (currently zero world coverage, verified): plant object still opens the solo dialog + docs; careers click unhides `#hubResume` and hides Sim Studio; library click calls `window.open` with `/learn` (stub it).
6. Sync `agent_work/product/desk_os/` -> `app/public/desk-os/` (index.html, styles.css, js/simStudio.js, new js/worldScene.js), deploy, curl-verify.

Deliberate non-goals for phase 1: no interior dialogs, no world persistence, no student placement, no live world-state visuals, no iframe of anything new.

### Phase 2: presence polish (only after the founder reacts to phase 1)

- Interior "screen" dialog beat for buildings, if wanted (section 3, option b).
- The world plant reflects the real board plant's live growth output (a CSS var set from `propagate()`; the world stops being static decoration). Same idea later for a lit/dim careers screen based on whether the student has a board.
- 4th/5th objects to prove the slot-in claim (Shade hut `{kind:'sim'}`, Tutors building `{kind:'panel', nav:'tutors'}`), each one array entry.
- Flip Learn to same-tab once board save/restore (earlier report's plan) ships.

### Phase 3: "you can design and stuff", with the ambiguity stated plainly

Two readings of the founder's phrase, and they are genuinely different products:

- **Reading A: the codebase is modular and students are creatively free.** Already largely true after phase 1: objects are data, and "Invent a sim" is real student creation. If this is the meaning, phase 3 is nothing.
- **Reading B: an end-user placement/build mode**, students drag objects INTO the world, arrange their own scene, Minecraft-for-real. This is a real feature: placement UI (drag from the parts bin into the scene), the `WORLD_OBJECTS` array becoming per-student state, persistence (localStorage first, then the already-specced `world_state/{uid}`, per the earlier report's section 5, same doc, not a new one), and collision/layout rules.

**My read: the founder means at least A now and probably wants B eventually.** The sentence structure ("make sure the build is... modular... and you can design") reads as an architecture instruction plus an aspiration, in that order. Phase 1's data contract is deliberately the exact shape reading B would persist, so nothing is thrown away either way. **Do not start B without asking**; it is also where this ask merges with the earlier report's living-world phase 3 and the Roblox lane question, which remains open.

---

## 6. Risks and open questions

| Risk | Grounding | Mitigation |
|---|---|---|
| Founder still "doesn't see it" after phase 1 | Deploy verified live tonight; stale tab is the likely cause | Reload before judging; bump `styles.css?v=` and `app.js?v=` on deploy so even soft-stale tabs break loose |
| bootHub wiring order breaks the `panel` kind | Verified today (simStudio created first, app.js:660-667) but implicit | One-line comment at both sites; fallback callback documented in section 2 |
| Two-copy mirror drift | Identical today, verified | Sync step is an explicit phase 1 item |
| Board lost on Learn navigation | No board persistence exists | New tab now; same-tab only after board save ships |
| A second world surface appears | Create Space canvas + worlds/world2 already exist (earlier report, section 2) | This world stays inside `.sim-world` in Sim Studio; buildings are doors to EXISTING surfaces, never new ones |

Open questions for Akshat:
1. One click into the real Resume studio (recommended), or the interior-dialog beat first?
2. Learn in a new tab (recommended for now) or same tab and accept losing the board until board save ships?
3. Does "you can design and stuff" mean reading B (students place their own objects)? If yes, it goes after the earlier report's phase 2, not before.
