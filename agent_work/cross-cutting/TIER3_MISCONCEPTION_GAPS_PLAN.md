# Build plan: tier-3 misconception gaps on /recommend + fusion unblock

Implements `EXTENSION_RECOMMEND.md` (the brief) against current reality.
Read that doc + `INGREDIENT_EVIDENCE_CONTRACT.md` first — this file adds
the decisions the brief left open, corrects stale status, and splits lanes.

## Status corrections vs the source docs (verified 2026-07-08)

The contract doc's §10/§11 marked these ❌ — they are ✅ **built AND live
on the HF Space** (verified against production yesterday):
- `step_rules.py` — rule classification per verified line, with the exact
  rule→ingredient map the contract describes (`subtracted_from_both_sides`
  → `basic_equations__do_same_to_both_sides`, `distributed` →
  `polynomials__distributive_property`, …). `/check-work` already returns
  `verdictPerLine[].rule {id, label, ingredientIds}`.
- `POST /record-work-evidence` — with the per-problem correlated-step
  weight cap (PERSONALIZATION_WORK_EVIDENCE_PLAN §2d).
- `append_attempt_observations` — live in serve.py (`/record-outcomes`).

**Consequence:** the contract's §11 co-founder work order items 1–2 are
done; item 3 (**attempt_fusions**) is UNBLOCKED and is Task F1 below.
Engine deploys go to the HF Space via `ml/scripts/deploy_hf.sh` — Cloud
Run is dormant (CLAUDE.md Deployment).

---

## Task E1 — `misconceptionGaps[]` on `/recommend` (Lane: **Engine**, `ml/**`)

Per EXTENSION_RECOMMEND §5.1. Payload, emit conditions, and severity
formula are contractual — do not deviate:

```jsonc
{ "conceptId": "...", "ingredientId": "...", "misconceptionId": "mis_...",
  "distractorChoiceIndex": 1, "personalHitRate": 0.67,
  "populationHitRate": 0.44, "nObservations": 112, "severity": 0.58 }
```
- Emit only when (priors `n_observations >= 30`) OR (student `>= 2`
  tagged attempts on that concept), AND `severity >= 0.25`.
- `severity = clamp01(0.6*personal + 0.4*population)`.

Decisions this plan adds (the brief left them open):

1. **Missing population prior** (`ml/data/distractor_priors/` doesn't
   exist yet): `severity = 0.6 * personalHitRate` — do NOT renormalize.
   Conservative by design: with no population data, a student needs
   personal hit rate ≥ ~0.42 (e.g. 1-of-2, 2-of-3) to cross the 0.25
   floor. When priors ship later the formula picks them up unchanged.
2. **Recency window**: personal hit rate uses only observations from the
   **last 60 days** (matches the mastery half-life philosophy —
   engine/decay.py). Hard-cap the Firestore read at the most recent ~200
   observations per student per request; this endpoint must not get
   slower as history grows.
3. **`ingredientId` join — server-side reverse map, no client change.**
   `attempt_observations` rows don't carry `ingredient_id` today. Build
   the map at startup from Layer 1: for every ingredient, index its
   `canonical_misconception_family` and each `diagnostic_tags` entry →
   `ingredient_id`. Lookup: observation `misconceptionId` → ingredient.
   Unmapped misconceptions emit the gap with `ingredientId: null` (the
   client type is optional). Do NOT add a client-side write of
   ingredient_id in this task — that's a separate additive change if the
   reverse map proves too lossy.
4. Group observations by `misconceptionId` within concept; one gap entry
   per (conceptId, misconceptionId); `distractorChoiceIndex` = the
   modal choice index among that student's hits.

Tests (`ml/tests/test_misconception_gaps.py`):
- [x] 2 hits / 3 attempts on one misconception, no priors → severity 0.4,
      emitted.
- [x] 1 hit / 1 attempt, no priors → NOT emitted (below 2-attempt floor).
- [x] Observation older than 60d ignored.
- [x] Known Eedi misconception maps to its ingredient via the reverse map;
      unknown slug emits with null ingredientId.
- [ ] end2end still green; deploy via `deploy_hf.sh`; live `/recommend`
      for the test student returns the field (empty array is fine).

## Task P1 — `worstWeakness()` tier 3 (Lane: **Product**, `app/**`)

`app/src/lib/recommendNextConcept.ts` — the brief's §5.2 code is the
implementation; current `source` union is `'profile'|'concept_gap'|
'format_gap'` at line ~41, extend additively. Tiers 1–2 byte-identical;
`misconceptionGaps` undefined/[] ⇒ output identical to today (this is the
back-compat contract — add a fixture test asserting it, alongside the
existing C1 fixture tests).
- [ ] Fixture: response WITH a 0.9-severity misconception gap → tier-3
      candidate wins; same response minus the field → today's winner.

## Task P2 — Practice routing + PawHub copy (Lane: **Product**, `app/**`)

Per brief §5.3: when the winning weakness has `source ===
'misconception_gap'`, question priority = Story Cell matching
(conceptId + ingredient_id) → bank questions with matching
`ingredient_id`/`distractor_taxonomy` → concept pool fallback.
PawHub label shows ingredient label + trap phrasing (BRAND_BOOK voice —
"places on the map, not failures"; e.g. "Unit rate in tables — the
difference trap keeps catching you").
- [ ] Tier-3 win launches a session whose first questions carry the
      target ingredient_id when any exist; falls back silently otherwise.

## Task F1 — `attempt_fusions` + alignment (Lane: **Engine**; UNBLOCKED)

Contract §7's fusion — both inputs now exist in production (choice
evidence + step verdicts). On Practice/GradeOnboard submit where ink was
parsed: join outcome + `verdictPerLine[].rule` → compute `alignment`
(`confirmed|partial|divergent|ambiguous|outcome_only`) with the
contract's deterministic table (no LLM), store per contract §9
`attempt_fusions` schema. Server-side in `/record-work-evidence` (it
already receives the steps; extend its payload with the outcome fields
rather than adding a new endpoint).
- [x] Unit tests: one fixture per alignment value.
- [x] `confirmed` fusion boosts the same ingredient's negative evidence
      weight vs outcome-only (respect Layer-4 ambiguous policy: `ambiguous`
      gets minimal weight).

## Sequencing
E1 ∥ P1 (contract is fixed, so they can build in parallel) → P2 → F1.
E1+F1 can be one Codex session; P1+P2 one Cursor session.
Priors (`update_distractor_priors.py`) and combination enrichment stay
future work — E1's formula already tolerates their absence.
