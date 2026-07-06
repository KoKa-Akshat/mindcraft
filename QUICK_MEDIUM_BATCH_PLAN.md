# Batch: KG zoom/filter/axes, dashboard mastery %, path bug fix, wrong-answer links, topic opt-out, single-concept dashboard CTA

All app-lane (`app/**`) except #6 (opt-out), which also touches `ml/**`.
Friends list / challenge system stays parked — separate planning session.

---

## QUICK

### Q1 — Zoom/pan on the Knowledge Graph SVG

**File:** `app/src/components/ConstellationGpsExplorer.tsx`

Currently the constellation `<svg viewBox="0 0 820 480">` ([line 355](app/src/components/ConstellationGpsExplorer.tsx#L355)) has no zoom — everything is fixed-scale. Add wheel-zoom + drag-to-pan via a `<g transform>` wrapper, no new dependency needed.

```tsx
const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
const dragRef = useRef<{ x: number; y: number } | null>(null)

function onWheel(e: React.WheelEvent<SVGSVGElement>) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  setView(v => ({ ...v, scale: Math.min(4, Math.max(0.5, v.scale * delta)) }))
}
function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
  dragRef.current = { x: e.clientX - view.tx, y: e.clientY - view.ty }
}
function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
  if (!dragRef.current) return
  setView(v => ({ ...v, tx: e.clientX - dragRef.current!.x, ty: e.clientY - dragRef.current!.y }))
}
function onPointerUp() { dragRef.current = null }
function resetView() { setView({ scale: 1, tx: 0, ty: 0 }) }
```

Wrap the existing `<line>`/`<g node>` content (lines 357–438) in one `<g transform={\`translate(${view.tx},${view.ty}) scale(${view.scale})\`}>` inside the `<svg>`; attach the handlers to the `<svg>` itself (`onWheel`, `onPointerDown/Move/Up`, `style={{cursor: dragRef.current ? 'grabbing' : 'grab'}}`). Add a small "+ / − / Reset" control cluster (absolute-positioned over `.mapWrap`, similar to the existing `.legend` overlay at line 442) calling `setView(v => ({...v, scale: v.scale*1.2}))` etc. and `resetView()`.

Keep node click/hover handlers unchanged — they fire on the `<g>` elements regardless of the parent transform. Double-click on empty map area → `resetView()`.

**Test:** scroll to zoom in/out (clamped 0.5×–4×), click-drag to pan, reset button returns to default. Works in both `embedded` (dashboard) and full-lab modes.

---

### Q2 — Dashboard: aggregate mastery %, click through to per-concept breakdown

**Files:** `app/src/pages/Dashboard.tsx`, new small component (e.g. `app/src/components/MasteryBadge.tsx`)

The KG data (`fetchKnowledgeGraph`, already cached via `graphCache.ts` and prefetched on auth per `App.tsx`) has per-node `mastery` — just needs a client-side aggregate, no new endpoint.

```tsx
// Dashboard.tsx
const [kg, setKg] = useState<{ nodes: { id: string; mastery: number; level: string }[] } | null>(null)
useEffect(() => { if (uid) void fetchKnowledgeGraph(uid).then(setKg) }, [uid])

const overallPct = useMemo(() => {
  const nodes = kg?.nodes ?? []
  if (!nodes.length) return 0
  return Math.round((nodes.reduce((s, n) => s + n.mastery, 0) / nodes.length) * 100)
}, [kg])
```

Render a small badge near `HeroBar` (or inside it via a new optional prop) showing `${overallPct}% mastery`. Clicking it opens a lightweight popover/panel listing `nodes` sorted by mastery ascending (worst first), each row `{label, level, masteryPct}` — reuse `mlIdToLabel(n.id)` for labels. A simple `<details>`/popover component is enough; no need for a new route.

Scope question: should the aggregate be over all 42 concepts, or just the 29 ACT-tested? Recommend **ACT-tested only** (matches what the student is actually working toward) — filter via the same `fetchExamConceptIds('ACT')` list used elsewhere (see `recommendNextConcept.ts`'s `examConceptIds` pattern).

**Test:** badge shows a sane % for a seeded test student; clicking expands the per-concept list; collapses on second click / outside click.

---

### Q3 — Fix: practice path silently drops non-`PRACTICE_CONCEPTS` ids (bug, not a design choice)

**File:** `app/src/lib/practicePathQueue.ts`

`conceptsFromIds()` ([line 43](app/src/lib/practicePathQueue.ts#L43)) does:
```ts
function conceptsFromIds(ids: string[]): PathConcept[] {
  return ids.flatMap(id => {
    const concept = PRACTICE_CONCEPTS.find(c => c.id === id)
    return concept ? [{ id: concept.id, label: concept.label }] : []
  })
}
```
`PRACTICE_CONCEPTS` (`questionBank.ts`) is a **legacy 37-item label list** that does not include the 7 foundational ACT concepts (`algebraic_manipulation`, `basic_equations`, `fractions_decimals`, `measurement_units`, `order_of_operations`, plus `ratios_proportions` is present only as the alias `percent_ratio`) or the 2 cross-cutting ones (`act_strategy`, `representation_translation`). Any pathfinder-chain id not in that list is **silently dropped** — so the practice path never shows the full 29-concept ACT-tested chain, only a subset, even though `/recommend?mode=exam` already returns the full chain correctly (verified directly against the engine this session).

**Fix:** stop using `PRACTICE_CONCEPTS` as a filter — use `mlIdToLabel` (from `conceptMap.ts`, which has full label coverage + a title-case fallback for anything unmapped) so no canonical concept id is ever dropped for lack of a label:
```ts
import { mlIdToLabel } from './conceptMap'

function conceptsFromIds(ids: string[]): PathConcept[] {
  return ids.map(id => ({ id, label: mlIdToLabel(id) }))
}
```
The `PRACTICE_CONCEPTS` import can be dropped from this file if nothing else in it needs it (check the `EMPTY`/fallback path at the bottom, which also references `PRACTICE_CONCEPTS.slice(...)` — replace similarly or leave that one fallback-only usage, it's harmless since it's just an ungated default list shown before any real data loads).

**Test:** for a fresh gap-scanned account, the Dashboard path panel (and Practice's own "path" view, which reads the same live chain) should include all 29 act-tested concepts in `pathQueue`, not just the ~20 that happened to have `PRACTICE_CONCEPTS` entries. Add/extend `practicePathQueue.test.ts` with an id like `'basic_equations'` (foundational, absent from `PRACTICE_CONCEPTS`) to assert it survives `conceptsFromIds`.

---

## MEDIUM

### M1 — Surface mastery-vs-strength student points + PCA axis labels on the KG (data already exists, just unwired)

**Files:** `app/src/components/ConstellationGpsExplorer.tsx`, `app/src/lib/graphCache.ts` (type only)

`GET /knowledge-graph/{uid}` ([serve.py:1022-1046](ml/serve.py#L1022-L1046)) already returns, and the frontend currently **drops**:
```jsonc
"studentPoints": {
  "mastery":  { "x": ..., "y": ..., "label": "Where you've been studying" },
  "strength": { "x": ..., "y": ..., "label": "Where you perform best" }
},
"axisLabels": {
  "x": "applied/geometric ↔ algebraic/symbolic",
  "y": "probabilistic/functional ↔ trigonometric/spatial"
}
```
This is exactly the "displacement" metric CLAUDE.md calls a novel per-student signal (mastery-weighted centroid vs strength-weighted centroid; the gap between them = learning-efficiency direction) — currently computed server-side and thrown away client-side.

**Fix:**
1. Extend `KGData` interface (line 24) to include `studentPoints` and `axisLabels`, and set them from the fetch response.
2. Project both points into the same `scalePositions` screen-space as the concept nodes — reuse the existing min/max normalization in `scalePositions()` (line 57), but it's currently built only from `nodes`. Extend it (or add a sibling helper) to also accept the two student points so they scale consistently with the node cloud, e.g. pass an extra array of raw `{x,y}` points to include in the min/max bounds.
3. Render two distinct markers on the SVG (e.g. a filled diamond for "mastery centroid" and an outlined diamond for "strength centroid"), each with a small label using `studentPoints.mastery.label`/`.strength.label`, plus a thin connecting line between them (visualizes the displacement/gap directly — the core insight CLAUDE.md describes).
4. Render `axisLabels.x`/`.y` as small axis captions at the SVG edges (e.g. bottom-center for x, rotated left-center for y) so the two PCA dimensions are legible instead of implicit.

### M2 — Status/level filter parity in embedded (dashboard) mode

**File:** `app/src/components/ConstellationGpsExplorer.tsx`

The level filter chips (`levels.map(...)`, line ~325) only render in the non-embedded `<header className={s.hero}>` branch (line 280) — the embedded header (line 272, used on Dashboard) has none. Move the filter chip row into a shared block rendered in both branches (or add it just above `.mapArea` so it's always present regardless of `embedded`), so students filtering "just core" or "just Open Gap" concepts works the same on Dashboard as on the standalone lab page. Reuse the existing `levelFilter` state — no new state needed, just render location.

Consider **also** adding a status filter (Stable / Repairing / Open Gap / Unexplored) alongside the level filter, using the existing `statusKind()` classification — same chip pattern, `visibleNodes` gets a second `.filter()`.

**Test:** on Dashboard → GPS view, filter chips are visible and functional identically to the standalone `/knowledge-graph` (or wherever the non-embedded lab route lives).

---

### M3 — Hyperlink to review content when a question is answered wrong

**File:** `app/src/pages/Practice.tsx`

Wrong-answer feedback currently only shows inline `currentQ.explanation` text ([line 2003-2005](app/src/pages/Practice.tsx#L2003-L2005)), no path back to the concept's Rules/Coach/Trap/Model content (the `getConceptContent()` "explore" screen, already reachable via `setPPhase('explore')` and already used as the pre-session content view for this same `conceptMeta.id`).

Add a link/button inside the wrong-answer feedback block (only when `selected !== currentQ.correctIndex`):
```tsx
{checked && !hideCorrectness && selected !== currentQ.correctIndex && (
  <button
    type="button"
    className={s.reviewLink}
    onClick={() => setPPhase('explore')}
  >
    Review {conceptMeta?.label ?? 'this concept'} →
  </button>
)}
```
Since `pPhase === 'explore'` already has a `backLink` (line 1737-ish) that returns to `'session'`/question view via `setPPhase(...)`, verify that back-link target actually resumes the SAME question/session state rather than restarting — check what phase `backLink` restores to today and adjust if it currently only supports returning to `'path'`. If it only supports going back to `'path'`, add a small `preExploreReturnPhase` state set right before `setPPhase('explore')` here, and have the explore screen's back button return to that phase instead of hardcoding `'path'`, so "Review →" from mid-session doesn't lose the student's place.

For the ~26 concepts still missing `conceptContent.ts` entries (`getConceptContent` returns `null`), decide fallback: hide the review link entirely (simplest), or fall back to KG ingredient descriptions per the earlier-discussed `conceptContent` fallback spec (not yet built) — recommend hiding the link when content is null for now, and revisit once that fallback spec ships.

---

### M4 — Topic opt-out (4th diagnostic option, excluded from the pathfinder chain)

Cross-lane: **`ml/**`** (new request field + scope filter) and **`app/**`** (UI + persistence + wiring every exam-mode call).

#### Contract
`RecommendRequest` gets a new optional field:
```python
excluded_concepts: list[str] = []
```
`_exam_curriculum_scope()` and `_resolve_recommend_targets()` ([serve.py:156-178](ml/serve.py#L156-L178)) filter these out of the returned scope/targets **before** the pathfinder runs, so excluded concepts never appear in `canonicalChain`, `recommendations[]`, or exam-priority re-ranking — full exclusion, not just deprioritization.

#### Lane A — `ml/serve.py`
```python
class RecommendRequest(BaseModel):
    ...
    excluded_concepts: list[str] = []

def _exam_curriculum_scope(exam: str | None, excluded: set[str] | None = None) -> set[str] | None:
    ...
    scope = set(_act_tested_concept_ids())  # existing logic
    if excluded:
        scope -= excluded
    return scope or None

def _resolve_recommend_targets(req: RecommendRequest) -> list[str]:
    excluded = set(req.excluded_concepts)
    if req.target_concepts:
        return [c for c in req.target_concepts if c not in excluded]
    if req.mode == "exam":
        scope = _exam_curriculum_scope(req.exam, excluded)
        if scope:
            return sorted(scope)
        return [c for c in _act_tested_concept_ids() if c not in excluded]
    return []
```
Thread `excluded_concepts` through the one call site (`recommend_endpoint`, line ~327) so `curriculum_scope` also excludes them (currently `_exam_curriculum_scope(req.exam)` — becomes `_exam_curriculum_scope(req.exam, set(req.excluded_concepts))`).

#### Lane B — `app/**`

**Persistence:** add `excludedConcepts: string[]` to the same Firestore doc the confidence map lives on (`users/{uid}.diagnostic.excludedConcepts`, alongside `confidenceMap` — extend `markDiagnosticComplete`'s payload shape in `practiceState.ts` and `loadDiagnostic`'s return type).

**UI (both `Diagnostic.tsx` confidence step and `Practice.tsx` gap-scan confidence step, and the 3D world's `mc-diagnostic.js` if you want parity there too):** add a 4th button per concept row, e.g. "Not interested" / "Skip this", visually distinct from the 3 confidence buttons (not just a 4th `Confidence` value — keep `Confidence` as `'easy'|'kinda'|'hard'` unchanged so `seedAssessment`'s existing contract is untouched). Track it as a separate `Set<string>` (`excludedIds`) in component state; selecting "Skip" for a concept clears any existing confidence rating for it and vice versa (mutually exclusive per row).

**Wiring:** every `getRecommendations(uid, targets, mode, exam)` call needs the excluded set passed through as a 5th arg (`excludedConcepts?: string[]`) in `mlApi.ts`'s `getRecommendations()`, forwarded as `excluded_concepts` in the request body. Call sites to update: `recommendNextConcept.ts` (`fetchPracticeHubRecommendations`'s three calls), `practicePathQueue.ts`'s live exam-mode fetch (Q3 above touches this same file), `ConstellationGpsExplorer.tsx`'s `plotRoute`. Load `excludedConcepts` once per call site the same way `confidenceMap`/`exam` are already loaded (Firestore `diagnostic` doc).

**Test (ML):** a `/recommend` call with `mode=exam, excluded_concepts=["basic_probability"]` never returns `basic_probability` in `canonicalChain` or `recommendations[]`, regardless of confidence. **Test (app):** marking a concept "Skip" in the diagnostic removes it from the Dashboard path panel and from `worstWeakness()` candidates on next load.

---

### M5 — Dashboard: replace the path panel with a single next-concept practice card

**File:** `app/src/pages/Dashboard.tsx`, possibly retire `PracticeLearningPathMini` from Dashboard (not delete the component — `Practice.tsx`'s own `pPhase === 'path'` "island map" view is the **full** path and stays; CLAUDE.md already notes the full path lives there, not on the dashboard).

Rationale: the mini path panel is a second, smaller rendering of the same data Practice's own path view already shows in full. A single "practice this next" card is simpler and matches how PawHub's Practice pad already works (direct-launch to `worstWeakness()`).

Replace the `PracticeLearningPathMini` render branch (Dashboard.tsx, the final `else` in the panel-slot conditional) with a compact card:
```tsx
<NextConceptCard
  concept={path.pathConcepts[0] ?? null}   // or fetchPracticeHubRecommendations's weakness/learn directly
  onPractice={(id) => navigate('/practice', { state: { conceptId: id, missionType: 'learn' as const } })}
  onSeeFullPath={() => navigate('/practice', { state: { pPhase: 'path' } })}  // check Practice.tsx honors a pPhase-in-state entry, or just navigate('/practice') since default pPhase is 'path'
/>
```
Since `Practice.tsx`'s default `pPhase` state is `'path'` ([line 341](app/src/pages/Practice.tsx#L341)), a plain `navigate('/practice')` (no special state) already lands on the full path view — so "See full path" needs no new wiring at all.

**This is a design call, not just an implementation detail** — flagging before building: do you want to keep this as an *additional* simplification alongside Q1–M4, or hold it until after M1–M4 ship and you've seen the KG/path improvements in practice? No code dependency either way — it's a pure Dashboard-layout swap, independent of everything else in this batch.

## Suggested build order
Q1–Q3 (independent, no cross-lane coordination) → M1–M3 (app-only) → M4 (needs ML lane) → M5 (design-confirm, then trivial to build).
