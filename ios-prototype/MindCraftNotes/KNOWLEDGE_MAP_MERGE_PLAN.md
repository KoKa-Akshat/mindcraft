# Knowledge Map Merge Plan — unified "diffuse" knowledge field on the Binder landing

**Scope:** `DeskGridDashboardView.swift` only (plus one test-file follow-up). Merges the 200pt Knowledge Map preview and the ambient study garden into ONE spread-out concept-graph visualization spanning the whole left workspace column, with recommended books as the highlighted, tappable layer on top.

**Founder ask (interpreted):** the Knowledge Map stops being a cramped preview box and becomes the dominant visual occupying both the current preview area AND the garden area; the "important" dots are the same recommended-book signal the garden already uses (labeled, amber); tapping one opens that book's real content; tapping the field itself still opens the full interactive graph.

---

## 1. Current state (verified in code, line numbers as of 2026-08-23)

All in `/Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskGridDashboardView.swift` (4,143 lines):

- `binderLandingBodyContent(ink:)` (~line 2249): `GeometryReader` → `HStack` = `binderWorkspaceColumn` at `geo.size.width * 0.76` + `binderProgressGutter` + `moduleBoxColumn`. Also owns the `libraryBooks` fetch (`.task`, `BookLibraryClient.listBooks()`, guarded by `libraryBooksLoaded`).
- `binderWorkspaceColumn(ink:)` (~line 2294): inner `HStack` = [Knowledge Map preview `Button` (id `deskGridBinderGraphPreview`, fixed `.frame(width: 200)`, tap → `closeBinderContentViewer()` + `viewingKnowledgeGraphInBinder = true` + `knowledgeGraphClient.load()`)] + `binderRingSpine` + `topicTileGrid(ink:)`.
- `knowledgeGraphTileBody()` (~line 2174): loading/empty/populated states around `KnowledgeGraphCanvas`. **Shared** — also used by the separate `.moodle` tile at line 1787. Must not be broken for that caller.
- `topicTileGrid(ink:)` (~line 2490): the ambient garden. Filter `libraryBooks.filter { $0.totalConcepts > 0 && $0.coveredConcepts > 0 && $0.coveredConcepts < $0.totalConcepts }`; amber `gridHex "d9a441"`; Canvas glow layer with `.allowsHitTesting(false)`; SwiftUI `Button`s positioned at the same points (ids `deskGridTopicTile_\(subjectId)`) → `onOpenBinderChapterBook(book.subjectId, book.title)`; empty-state copy "Nothing calling for attention right now…".
- `ambientGardenPosition(for:in:)` (~line 2556): deterministic hash of `subjectId` → point in 0.14–0.86 × 0.16–0.84 of the area.
- `KnowledgeGraphCanvas` (private struct, ~line 3727): normalizes real PCA `x`/`y` (≈[-3,3], NOT [0,1]) via bounding-box remap with 0.12 padding; edges colored `5b3e8f` by weight; nodes colored by `status` (mastered `3fae5a` / in_progress `d9a441` / struggling `c1121f` / untouched `b7aed6`), radius 3.5–7 by `eventCount`, radial-gradient glow.
- `BinderKnowledgeDots` (~line 3807): faint whole-page concept-dot texture, drawn ONLY by `binderBookFrame` (line 1663), whose ONLY caller is the landing (line 1794). Directly relevant: it would double-draw concepts behind the new field.
- Data: `KnowledgeGraphNode` (`id/name/level/x/y/mastery/strengthScore/eventCount/status`) + `KnowledgeGraphEdge` in `Networking/KnowledgeGraphClient.swift`; eagerly loaded at dashboard `.task` (line 577), so nodes exist on landing. `AssembledBookSummary` (`subjectId/title/totalConcepts/coveredConcepts/updatedAt`) in `Models/AssembledBookModels.swift` — **no concept ids**; only the full `AssembledBook` (per-book `getBook` fetch) has section `conceptId`s.
- Full-graph destination: `viewingKnowledgeGraphInBinder` → `binderContentViewerSelection` → `knowledgeGraphContentViewerBody` → embedded `KnowledgeMapView` in `WorkArtboard.contentViewerBinder`. Unchanged by this work.

---

## 2. The crux: two granularities in one visualization

**Decision: concepts are the diffuse field; books are the highlighted overlay.**

- **Concept layer (fine-grained, fills the space):** all 42 `KnowledgeGraphNode`s + edges, drawn in `KnowledgeGraphCanvas`'s existing visual language but *dimmed* (edges at roughly half current opacity, node glow reduced) and spread across the full workspace column. This is the "spread out and diffuse" texture — real PCA positions, real status colors, real engagement sizing. It also **replaces** `BinderKnowledgeDots` on the landing (which otherwise double-draws the same nodes at a different scale directly behind it).
- **Book layer (coarse-grained, the "important" dots):** the exact same `recommendedBooks` filter and amber glow/label/tap treatment `topicTileGrid` has today, drawn ON TOP of the concept field — larger radius (11–25 vs 3.5–7), stronger glow, white ring, **title label** (concepts get no labels), full tap target. Size + label + glow is the hierarchy; the shared amber hue with `in_progress` concept dots is acceptable because book dots are 3–5× larger and labeled (see Risks).
- **Placement of book dots — phased, honestly:**
  - **Phase 1 (ship this):** keep `ambientGardenPosition` hash placement, now over the full column, plus a cheap repulsion pass: after computing concept positions, nudge any book dot within ~40pt of a concept node away by a fixed offset (deterministic, order-stable — iterate `recommendedBooks` sorted by `subjectId`). Honest: makes no false claim that a book "lives at" a concept's position, which we cannot currently justify (see below).
  - **Phase 2 (open question, do NOT block on it):** anchor each book at the centroid of its covered concepts' PCA positions. Requires (a) fetching full `AssembledBook`s (`BookLibraryClient.getBook` per book — N extra network calls on landing) and (b) **verifying that `AssembledBookSection.conceptId` values actually join against the ML ontology's 42 concept slugs** — books come from the mindcraft-content-engine's own taxonomy (Dan McCreary graph lineage), which is very likely a *different ID space* than the 42-concept ontology. Verify with one real book payload before designing anything on it. The codebase's own doc comments are scrupulous about not overstating data provenance (see `topicTileGrid`'s "real, honest proxy" comment) — keep that standard.

---

## 3. Layout change

Inside `binderWorkspaceColumn(ink:)` only. `binderLandingBodyContent`'s outer proportions (0.76 workspace / gutter / module column), `binderProgressGutter`, `moduleBoxColumn`, and the `jesseBoxIconRow` overlay (bottom-trailing under the module column — no collision with the field) are untouched.

```
BEFORE:  HStack [ preview(200pt) | binderRingSpine | topicTileGrid(rest) ]
AFTER:   VStack [ header row: "Knowledge Map" title · "N/M concepts mastered" · legend ]
                [ UnifiedKnowledgeField (ZStack, fills full column) ]
```

- **`binderRingSpine`:** its "open-book center seam" meaning disappears when the two halves merge. Recommendation: **remove it from the landing** (single call site, line 2330; keep the `private var` — it is cheap and may return elsewhere). Alternative if the binder identity should stay: park it at the column's far-left edge as decoration. Founder call; default to removal.
- **`binderBookFrame` (line 1794):** drop the `BinderKnowledgeDots` layer (keep its padding), or replace the call with plain padding. After that, `BinderKnowledgeDots` has zero callers — flag for deletion in the same commit rather than leaving dead code.

---

## 4. Interaction — both navigations preserved

ZStack hit-testing order inside the new field (bottom → top):

1. **Background full-area `Button`** — carries `accessibilityIdentifier("deskGridBinderGraphPreview")` (existing UI tests at test-file lines 2402/2675/2682 assert this id exists on the landing — keeping the id on the new background button keeps them green). Action: exactly today's preview action — `closeBinderContentViewer(); viewingKnowledgeGraphInBinder = true; Task { await knowledgeGraphClient.load() }`.
2. **Concept-field `Canvas`** — `.allowsHitTesting(false)` (taps fall through to the background button).
3. **Book glow `Canvas`** — `.allowsHitTesting(false)`.
4. **`ForEach(recommendedBooks)` positioned `Button`s** — ids `deskGridTopicTile_\(subjectId)`, action `onOpenBinderChapterBook(book.subjectId, book.title)` — identical to today.

Note the identifier-clobbering guardrail from CLAUDE.md: put ids on the buttons themselves, never on a wrapping `.compositingGroup()`/call-site view.

---

## 5. Exact touch list

One file: `/Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskGridDashboardView.swift`

| Item | Change |
|---|---|
| NEW `private struct UnifiedKnowledgeFieldCanvas` | Concept field + book glow drawing. A **separate private struct** (like `KnowledgeGraphCanvas`), NOT another nested `@ViewBuilder` func — this file already had a real opaque-return-type stack-overflow crash at this call depth (`binderLandingBody`'s `AnyView` fix, comment at line 2220); a struct `body` boundary caps recursion depth. |
| NEW fileprivate helper `graphNormalizedPositions(nodes:size:padding:)` | Factor the bounding-box remap currently duplicated in `KnowledgeGraphCanvas` and `BinderKnowledgeDots`; new struct uses it too. Small, mechanical, keeps three copies from drifting. |
| `binderWorkspaceColumn(ink:)` (~2294) | Replace inner HStack with header row + the new field (Section 3/4). Remove the 200pt preview button, `binderRingSpine` call, `topicTileGrid` call. |
| `topicTileGrid(ink:)` (~2490) + `ambientGardenPosition` (~2556) | Book-button/glow/empty-state logic migrates into the new field; delete `topicTileGrid` once unreferenced. Keep `ambientGardenPosition` (add the repulsion nudge, now taking concept positions as a param). |
| `binderBookFrame` (~1663) / line 1794 | Drop `BinderKnowledgeDots` behind the landing; then delete `BinderKnowledgeDots` (~3807) as dead code. |
| `knowledgeGraphTileBody()` (~2174), `KnowledgeGraphCanvas` (~3727) | **Do not touch** — still serve the `.moodle` tile (line 1787). Reuse `emptyGraphSeed` (~2817) and `knowledgeGraphLegend` (~2830) in the new header/empty states. |
| Doc comments | This file's culture is date-stamped ask-quoting doc comments on every visual decision — write one on the new struct quoting the 2026-08-23 ask, including the honest "book placement is hashed, not semantic (yet)" caveat. |

Test file: `/Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotesUITests/MindCraftNotesUITests.swift` — pre-existing breakage found while scoping: lines 2361/2391 still tap `deskGridTopicTile_openArchive`, an identifier that no longer exists anywhere in app source (archive moved to `deskGridDock_Archive` earlier today). Those tests are already broken independent of this merge; fix them in the same pass.

---

## 6. Build order

1. Extract `graphNormalizedPositions` helper; confirm `.moodle` tile renders unchanged (pure refactor commit).
2. Build `UnifiedKnowledgeFieldCanvas` (concept field only, dimmed styling) + rework `binderWorkspaceColumn` to header + field + background button. Full-graph tap-through works end to end.
3. Layer in book dots: move `recommendedBooks` filter, glow drawing, positioned buttons, labels from `topicTileGrid`; add repulsion nudge. Per-book tap-through works end to end.
4. Remove `binderRingSpine` call, `topicTileGrid`, `BinderKnowledgeDots`/`binderBookFrame` dots layer; empty states (Section 7).
5. Tests: keep `deskGridBinderGraphPreview` + `deskGridTopicTile_*` assertions green; fix the two stale `deskGridTopicTile_openArchive` taps; run the suite against a freshly-uninstalled app (known cross-test state leakage, per CLAUDE.md).
6. (Separate, optional, unblocked) Phase-2 spike: fetch one real `AssembledBook`, check `conceptId` join against graph node ids; only then design centroid anchoring.

---

## 7. Edge/empty states

- **Graph loading, no nodes yet:** `ProgressView` + "Mapping your knowledge…" (reuse `knowledgeGraphTileBody`'s copy) centered in the field; book dots still render if `libraryBooks` already loaded (hash placement needs no graph).
- **Graph loaded, zero recommended books:** just the concept field — the founder pre-approved this exact case ("if there's nothing to show, fine, just show the map"). Drop the "Nothing calling for attention…" text; the map IS the content now.
- **No nodes AND no books:** `emptyGraphSeed` pulse + "This grows as you learn…" copy, centered.
- **Graph fetch failed (HF Space cold start / offline):** books-only field; background tap still opens the viewer, whose existing loading state already explains the ~60–90s wake.

---

## 8. Risks and open questions

- **Book↔concept ID-space join (Phase 2 blocker):** `AssembledBookSection.conceptId` (content-engine taxonomy) very likely ≠ the 42 ML ontology slugs. Unverified. Phase 1 deliberately avoids depending on it.
- **Amber collision:** book dots and `in_progress` concept dots share `d9a441`. Mitigated by size (3–5×), label, white ring, and dimming the concept layer — but if it still muddles live, differentiating hues is a founder-taste call, not a code problem. Do not silently change the status palette; it is shared app-wide.
- **Accidental full-graph opens:** the whole field background is now the "open full graph" target; a missed book tap opens the viewer. Matches today's preview semantics; the viewer's close button makes it cheap. Watch live feedback.
- **Stack-depth regression:** this exact branch crashed on-device before (SIGSEGV, comment at line 2220). New struct boundary (not nested builders) is the mitigation; if the crash resurfaces, `AnyView`-erase at the field's call site like `binderLandingBody` does.
- **Performance:** trivial — 42 nodes + ~16 edges + a handful of books in two static `Canvas`es; redraws only on `@Published` changes. Not a real risk; do not add animation timers without need.
- **Named trade-off:** the dedicated `.moodle` Knowledge Graph tile (line 1787) still exists elsewhere on the board, so the small-preview rendering isn't gone from the product — the landing just stops duplicating it.

---

### Critical Files for Implementation

- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskGridDashboardView.swift — every function touched lives here (`binderWorkspaceColumn`, `topicTileGrid`, `ambientGardenPosition`, `KnowledgeGraphCanvas`, `BinderKnowledgeDots`, `binderBookFrame`, `WorkArtboard`)
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Networking/KnowledgeGraphClient.swift — `KnowledgeGraphNode`/`KnowledgeGraphEdge` shapes, eager-load behavior, mock-graph test seam
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Models/AssembledBookModels.swift — `AssembledBookSummary` (Phase 1) and `AssembledBook`/`AssembledBookSection.conceptId` (Phase 2 join question)
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotesUITests/MindCraftNotesUITests.swift — `deskGridBinderGraphPreview`/`deskGridTopicTile_*` assertions to keep green; stale `deskGridTopicTile_openArchive` taps to fix
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Networking/BookLibraryClient.swift — `listBooks()` (already wired) and `getBook(subjectId:)` (Phase 2 centroid spike)
