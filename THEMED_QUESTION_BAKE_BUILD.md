# Build File — Bake Themed Question Stems Offline (drop the live story-module dependency for the base stem)

**Status:** IMPLEMENTED (2026-07-25). Composer extracted to
`webhook/lib/storyModuleComposer.ts`; bake via
`npm run bake-themed-stems --prefix webhook`; Practice serves
`baked > framedLocalStem > plain`; live `/story-module` kept as optional
guidance overlay. Artifact key is `{conceptId}__{storyId}__{questionId}`
(bakeVersion 2) so a reskin can be checked against its story world.

**Lanes:** CROSS-SEAM — coordinate.
- **Bake pipeline** = Engine (`webhook/**`, reuses the `/story-module` composer).
  Owner: Blake.
- **Consumption wiring** = Product (`app/src/pages/Practice.tsx` + the artifact in
  `app/src/data/`). Owner: Akshat.
The **artifact** (`app/src/data/themedStems.generated.json`) is the seam — agree
its shape first, then the two lanes proceed independently.
**Architect:** Opus (this file — no code). **Implementer:** Cursor/Codex.

**Revises:** `STORY_LAYER_RECONCILE.md`. That doc ratified *art baked per-concept
offline, text via LIVE `/story-module` per session*. This build moves the **text
stem** from live→baked too (art was already baked). Live `/story-module` survives
only as an optional per-student overlay (see C-5). Update the rulebook proposal.

---

## Motivation

Themed stems are already **deterministic per `{concept, question}`** — that's how
`/story-module` caches them (Firestore, 30-day TTL). Yet they're fetched **live**
per session, which costs:
- serve-time Groq latency + the *"questions render plain until the module arrives"*
  window ([Practice.tsx:1120](app/src/pages/Practice.tsx#L1120)),
- a hard dependency on `GROQ_API_KEY` being set on Vercel (Admin probe already warns
  *"students will see plain question stems until this is fixed"*),
- a 3-tier fallback (`storyStem ?? framedLocalStem ?? plain`) that most-degrades
  exactly when Groq is down.

Since the output is deterministic per `{concept, question}`, **promote the cache to
a checked-in artifact** — the same pattern already ratified for `storyArt`
(*"generated offline, checked in"*) and `generatedQuestions.json`.

## The fix

A **rerunnable offline bake**: run the existing story-module composer over the full
merged bank once, validate, and write a checked-in artifact keyed by
`{concept, question}`. Practice reads the artifact synchronously; the live call
becomes optional.

```
merged bank (static+eedi+actMaster+generated)
   → story-module composer (SAME Groq prompt + numeric-preservation validation)
   → validate (drop math-mutating stems → plain fallback, recorded)
   → app/src/data/themedStems.generated.json   { "{conceptId}__{qId}": storyStem }
Practice serve order:  baked stem  >  framedLocalStem  >  plain
```

---

## Implementation contracts (binding)

### C-1. Key by `{concept, story, question}`; plain question stays canonical
Artifact key = `{conceptId}__{storyId}__{questionId}` (bakeVersion 2).
For concept-chapter stories, `storyId === conceptId`. Folk-tale skins use
the tale id so you can verify the reskin is in-theme for that world.
`cacheDocId` in `webhook/api/story-module.ts` stays versioned separately for
live cache. **Never mutate** `questionBank.ts` / `eediQuestions.json` / the
`Question` schema — the plain stem remains the source of truth; themed stems
are a derived overlay.

### C-2. Rerunnable pipeline, not hand-authored, reusing the live composer
Extract the `/story-module` composer core (prompt assembly + Groq call + validation)
into a function callable **both** from the Vercel handler and an offline script
(`webhook/scripts/bake-themed-stems.ts` or `app/scripts/bakeThemedStems.mjs`).
Do **not** fork the prompt — a divergent bake would drift from live behavior. Input
is the merged bank; batched like the live per-session call.

### C-3. Numeric-preservation validation is MANDATORY (a baked bad stem is permanent)
The live path drops any item whose story mutates the math and falls back to plain.
In the bake this matters **more** — a corrupted stem gets checked in and served
forever. Run the same hard numeric validation; any failure → record a plain-stem
entry (or omit the key), **never** a math-mutated stem. Report the drop count.

### C-4. Practice reads baked-first; keep the fallback for un-baked questions
`Practice.tsx` reads the artifact synchronously (no await) as tier 1. The existing
`framedLocalStem` (local concept frame) and plain stem remain tiers 2–3 for any
question NOT in the artifact (e.g. a freshly generated question not yet re-baked).
Serve order: **baked > framedLocalStem > plain**. Remove the base-stem live fetch;
see C-5 for what remains of the live call.

### C-5. Bake the STEM; keep per-student touches as an optional live overlay
The stem (concept-story reskin) is deterministic → bake it. The live call's
per-student parts — `misconceptionCallout` / past-mistake callback
(`lib/pastMistakeCallback.ts`), goal surfacing, `socratic[]` — are NOT deterministic
per `{concept, question}`. Either drop them or keep them as a **thin, optional,
non-blocking live overlay** layered on top of the baked stem. Do **not** bake them
(they'd freeze a weaker personalization than the north-star direction). Keep stem
and overlay separable.

### C-6. Provenance + rerun discipline
Artifact carries a header: `{ bakeVersion, sourceBankHash, generatedAt, model }`.
Rerun the bake whenever the bank changes (generation adds questions). Stale keys
(question no longer in bank) are pruned on rerun; new questions get baked. A CI
check (or a script flag) flags questions present in the bank but missing from the
artifact so coverage gaps are visible.

---

## Validation / measurement

1. **Coverage:** % of merged-bank questions with a baked themed stem (target: all
   questions whose concept has a story; the rest legitimately fall through to
   framedLocalStem/plain).
2. **Numeric-preservation drop rate** (C-3) reported; spot-check a sample of baked
   stems against their plain originals — the math (numbers, operators, answer) must
   be identical.
3. **Serve check:** with `GROQ_API_KEY` unset / webhook offline, a practice session
   still shows themed stems (proving the live dependency is gone).
4. Artifact size stays reasonable (stem text only — do not bloat with socratic
   payloads per C-5).

## Acceptance criteria

- Practice serves themed stems for covered questions **with no live story-module
  call** for the base stem; offline/`GROQ_API_KEY`-absent still themed.
- Zero math-mutated baked stems (C-3); drop rate reported, drops → plain.
- Artifact keyed by `{concept, question}`; plain bank untouched (C-1).
- Bake is rerunnable and re-baked after any bank change (C-6).
- Per-student personalization, if kept, is a separable live overlay (C-5), not baked.

## Files in play

- `webhook/api/story-module.ts` — extract composer core into a shared, importable
  function (used by handler + bake).
- `webhook/scripts/bake-themed-stems.ts` **or** `app/scripts/bakeThemedStems.mjs` —
  the offline bake (new).
- `app/src/data/themedStems.generated.json` — the checked-in artifact (new; the seam).
- `app/src/pages/Practice.tsx` — read artifact tier-1; reduce live fetch to the
  optional overlay ([:1516](app/src/pages/Practice.tsx#L1516), [:1120](app/src/pages/Practice.tsx#L1120)).
- `app/src/lib/storyModule.ts` — client trimmed to the optional overlay (or removed
  from the base-stem path).
- `STORY_LAYER_RECONCILE.md` / `AGENT_RULEBOOK.md` — record the live→baked revision.

## Guardrails

- Plain question stays canonical; themed stems are a derived, checked-in overlay.
  Never mutate the bank or `Question` schema (Product seam).
- One composer, two callers (C-2) — the bake must not drift from live behavior.
- Numeric-preservation validation is non-negotiable in the bake (C-3).

## Out of scope

- **Ingredient-targeted / personalized question selection** — the north star, gated
  behind `CONCEPT_PLACEMENT_BUILD.md` + `INGREDIENT_ENRICHMENT_BUILD.md`. This build
  only bakes the *theme* over the *existing random-selection* flow.
- **Per-concept art** — already baked (`storyArt`); unchanged.
- **Generating new questions** — separate; this bake re-runs to theme them once they
  exist.
