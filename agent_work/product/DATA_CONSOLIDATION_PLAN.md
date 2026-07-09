# Data Consolidation Plan — conceptStories + questionContextFrames

**Lane:** Product (`app/**`)
**Status:** ASSESS ONLY — not implemented. Written during the 2026-07 code-quality
audit; needs a scoped follow-up session before anyone acts on it.

---

## Finding

`app/src/data/conceptStories.json` and `app/src/data/questionContextFrames.json`
both carry per-concept narrative data, keyed by the same canonical `conceptId`:

| File | Keys | Fields per entry |
|------|------|-------------------|
| `conceptStories.json` | 41 concepts | `conceptId`, `conceptName`, `story` (long-form origin narrative) |
| `questionContextFrames.json` | 47 concepts | `protagonist`, `settingLine`, `questionBridge`, `diceFrame`, `spinnerFrame` |

- **40 of 41** `conceptStories.json` keys also exist in `questionContextFrames.json`.
- Only `derivatives` is story-only; `polynomial_operations`, `absolute_value`,
  `coordinate_geometry`, `combinatorics`, `data_interpretation`,
  `integer_operations`, `percent_ratio` are frame-only (no story yet).
- Both are loaded as flat `Record<string, T>` JSON casts with no shared loader
  or validation — every consumer does its own `as Record<string, Shape>` cast.

This is the same shape of duplication as the `storyDisplay.ts`/`storySelection.ts`
`ContextFrame` type that this audit already deduped (see commit `49f2bfdc`) — but
that fix only unified the *type*, not the *data files* themselves. The two JSONs
are functionally one table (per-concept narrative spine) split across two files
for no structural reason found in the data itself.

`mathSkinTop.json` (32+ folk tales) is a **different shape** — an array of tale
records, not keyed by `conceptId` — and is not a merge candidate here; it already
has its own well-structured consumer (`storyMatch.ts`) and should stay separate.

---

## Current consumers (import sites as of this audit)

`conceptStories.json` — 5 direct imports:
- `app/src/lib/storySelection.ts` (`conceptStoriesRaw`)
- `app/src/pages/Dashboard.tsx` (`conceptStoriesData`)
- `app/src/pages/Practice.tsx` (`conceptStoriesData`)
- `app/src/pages/GradeOnboard.tsx` (`conceptStoriesRaw`)
- `app/src/pages/ConceptChapterPage.tsx` (`conceptStoriesRaw`)

`questionContextFrames.json` — 3 direct imports:
- `app/src/lib/storyDisplay.ts` (`conceptFrames`)
- `app/src/lib/storySelection.ts` (`framesRaw`)
- `app/src/pages/ConceptChapterPage.tsx` (`contextFramesRaw`)

Total: **6 distinct files** touch one or both of these JSONs, each with its own
local variable name and its own `as Record<string, Shape>` cast. No barrel
export or shared loader exists today.

---

## Proposed target shape

```jsonc
// app/src/data/conceptNarratives.json
{
  "fractions_decimals": {
    "conceptId": "fractions_decimals",
    "conceptName": "Fractions and Decimals",
    "story": "In 1585, in the war-torn Low Countries, ...",
    "protagonist": "Simon Stevin",
    "settingLine": "Antwerp, the Low Countries, 1585",
    "questionBridge": "Simon slides the ledger toward you. ...",
    "diceFrame": null,
    "spinnerFrame": null
  },
  ...
}
```

Plus a single shared loader/type in `lib/` (candidate home: fold into
`storySelection.ts`, which already owns `ContextFrame` and concept-story
resolution) so consumers import a function, not a raw JSON cast:

```ts
export interface ConceptNarrative { conceptId, conceptName, story, protagonist, settingLine, questionBridge, diceFrame, spinnerFrame }
export function narrativeForConcept(conceptId: string): ConceptNarrative | undefined
```

## Why NOT implement this now

1. **Six call sites, six different local names and cast shapes** — every one
   needs a coordinated edit in the same PR or the app breaks mid-migration
   (TS won't catch a stale JSON import path at runtime the way it catches a
   renamed function).
2. **Key mismatch is real, not cosmetic** — 7 concepts exist only in frames,
   1 only in stories. Merging means deciding what an entry with a missing
   `story` or missing `protagonist` renders as; that's a product decision
   (fallback copy), not a mechanical refactor.
3. **`storyDisplay.ts`'s frame lookup does NOT alias-resolve** (`frameFor`
   looks up `conceptId` directly), while `storySelection.ts`'s story lookup
   DOES fall back through `toOntologyId` aliasing (`resolveConceptId`). A
   naive merge that shares one lookup function would silently change which
   entries resolve for aliased concept IDs — a real behavior change, which
   this audit's constraints explicitly forbid.
4. **Practice.tsx and Dashboard.tsx are both under heavy concurrent edit**
   (same-day commits from other lane work during this audit) — touching
   their import lines now raises merge-conflict risk for no runtime benefit.

## Suggested follow-up scope (separate session)

1. Decide the fallback policy for the 8 mismatched concepts (ship blank vs.
   reuse a generic frame vs. author the missing 7 protagonist/setting entries
   and the missing 1 story).
2. Write a one-time build script (`ml/scripts/` is Engine lane — this would
   need a small Node/tsx script under `app/scripts/`, mirroring
   `syncGeneratedQuestions.mjs`) that merges the two JSONs into
   `conceptNarratives.json`, preserving every existing field.
3. Add `narrativeForConcept()` to `storySelection.ts`, update all 6 call
   sites in one PR, delete the two source JSONs, run `tsc --noEmit` +
   manual smoke test of Dashboard / Practice / ConceptChapterPage / GradeOnboard
   (all 4 render narrative copy from these files).
4. Grep for `conceptStories.json` / `questionContextFrames.json` one more
   time before merging the PR to catch any import this plan missed.
