# Fix: Dashboard "Explore" cards + chapter-page theming use non-canonical concept ids

## Root cause
`linear_equations` works correctly everywhere (route list, chapter page,
questions) because it's only ever reached via `path.pathConcepts`, which is
sourced from `/recommend` and uses real canonical ontology ids. Two other
lookup tables in the same click-through flow use a DIFFERENT, non-canonical
id vocabulary (apparently left over from before the 42-concept ontology was
standardized), so the exact same "click a concept → open its chapter" flow
silently breaks for anything routed through them.

## Fix 1 — `app/src/pages/Dashboard.tsx`'s `EXPLORE_CARDS` (~line 20)

Every "Explore more →" card is currently broken — `ConceptChapterPage.tsx`'s
`DB[conceptId]` lookup (`conceptStories.json`) returns `undefined` for all six
current ids, showing "No story found for `<id>`" instead of the chapter.

Change the `id` field only (labels/symbols/gradients unchanged) in the
`EXPLORE_CARDS` array:

| Card | Current `id` (broken) | New `id` |
|---|---|---|
| Quadratics | `quadratics` | `quadratic_equations` |
| Trig | `trigonometry` | `trigonometry_basics` |
| Statistics | `statistics` | `descriptive_statistics` |
| Coord. Plane | `coordinate_geometry` | `linear_equations` |
| Logarithms | `logarithms` | `logarithmic_functions` |
| Probability | `probability` | `basic_probability` |

Note on "Coord. Plane": `coordinate_geometry` isn't a real concept in the
42-concept ontology (folded into `linear_equations` during standardization —
same mapping the question bank's `BANK_ALIASES` already uses). Per your call,
point it at `linear_equations` directly rather than dropping the card or
picking an unrelated substitute concept — keep the "Coord. Plane" label as-is
since coordinate-plane material genuinely lives inside the `linear_equations`
story/question set.

This also fixes a secondary bug for free: `routeIds.has(c.id)` (line 231-232,
hides an Explore card if the same concept is already on the student's route)
never actually matched anything before, since it was comparing canonical
route ids against these wrong Explore-card ids. Once both sides use the same
canonical ids, the dedup will work correctly — meaning if a student's route
already includes `linear_equations`, the "Coord. Plane" card will now
correctly disappear from Explore (rather than showing a redundant entry).
Confirm this is the desired behavior (it matches the existing dedup's
evident intent) — not a new decision, just flagging the behavior change.

## Fix 2 — `app/src/pages/ConceptChapterPage.tsx`'s `CLUSTER_MAP` (~line 20)

Cosmetic only — missing ids fall back to `'algebra'` cluster (theme
color/glyph), so nothing crashes, but 22 concepts currently show the wrong
accent color/glyph on their chapter page. Add the missing canonical ids
(existing keys unchanged, these are additions):

```ts
// Foundational
algebraic_manipulation: 'algebra',
measurement_units: 'algebra',

// Core — algebra
factoring_polynomials: 'algebra',
polynomials: 'algebra',
quadratic_equations: 'algebra',

// Core — geometry
area_volume: 'geometry',
circles_geometry: 'geometry',
lines_angles: 'geometry',
triangles_congruence: 'geometry',

// Core — functions
logarithmic_functions: 'functions',

// Core — data
basic_probability: 'data',
descriptive_statistics: 'data',

// Advanced — functions (no separate "calculus" cluster exists; grouping
// calculus-adjacent concepts under 'functions' matches how the existing map
// already treats other functions-cluster concepts)
applications_of_derivatives: 'functions',
applications_of_integrals: 'functions',
derivatives: 'functions',
integrals: 'functions',
limits_continuity: 'functions',

// Advanced — geometry
conic_sections: 'geometry',
vectors: 'geometry',

// Advanced — data
inferential_statistics: 'data',
probability_distributions: 'data',

// Cross-cutting (no natural cluster — default to 'algebra', same as the
// existing fallback for any unmapped id, made explicit here for clarity)
act_strategy: 'algebra',
representation_translation: 'algebra',
```

Verify against the full canonical list (`ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`,
`concepts[].id`) if concepts get added/renamed later — this map has no
fallback-to-ontology mechanism, so any future id drift will repeat this same
class of bug. Worth a comment note in the file pointing at this doc /
the ontology file as the source of truth.

## Fix 3 — `limits_continuity` has no story (content gap, not code)

`conceptStories.json` has 41 of the 42 ontology concepts —
`limits_continuity` is the one gap (confirmed via direct diff against the
ontology's concept list). Shows a clean "No story found" fallback today, not
a crash, but incomplete relative to every other concept. This needs a story
written in the same voice/format as the other 41 (the recent "Fable 5"
rewrite commit is the reference for tone/structure) — a content task, not
something to code around. Flag for whoever owns `conceptStories.json`
authoring; not blocking Fix 1/2.

## Test plan
1. `cd app && npx tsc --noEmit` (data-only changes, should stay clean).
2. Manually click every Explore card on the Dashboard — each should open a
   real chapter page (story + questions), not "No story found."
3. Manually click a concept from the route/map list that was previously
   miscolored (e.g. `circles_geometry` or `basic_probability`) — chapter page
   should now show the correct cluster theme/glyph instead of the algebra
   default.
4. Confirm the Explore-card dedup: if `linear_equations` is on a test
   student's route, the "Coord. Plane" card should no longer appear in
   Explore.