# Manjushree math content spec

## Concept mapping

| Encounter | Ontology concept | Ingredient ids |
|-----------|------------------|----------------|
| roots | `quadratic_equations` | `quadratics__solutions_as_x_intercepts`, `quadratics__factoring_method` |
| axis | `quadratic_equations` | `quadratics__vertex_from_roots` |
| vertex | `quadratic_equations` | `quadratics__vertex_from_roots` |
| strike | (synthesis, no new ingredient) | — |
| discriminant (optional) | `quadratic_equations` | `quadratics__discriminant_meaning` |

All ids verified against `ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`.

## Question archetypes

1. **Root strike** — find x-intercepts of a downward opening parabola (waterline meetings)
2. **Axis of symmetry** — midpoint of roots / axis beam
3. **Vertex** — peak coordinates from roots + `a`
4. **Discriminant Sight** — predict two / one / none intersections from (a,b,c)

## Validated bank

12 core (`mjz_q01`…`mjz_q12`): 4 per level. All `a < 0`, integer roots, rational vertices, no complex roots. Level 1 factored form; L2/L3 standard form. Canonical legend quadratic: `mjz_q01` (a=-0.5, r1=1, r2=9).

3 trajectories (`mjz_t01`…`mjz_t03`) for discriminant practice.

## Misconceptions / hints

Implemented in `math/quadratics.ts` checkers (`checkRoots`, `checkAxis`, `checkVertex`, …). Tests assert distractor labels contain no em dashes / exclamation marks and misconception ids are stable.

## Visual-binding rule

`ridgeHeightWorld` and the Wisdom Sight curve both call `evaluate(q, x)` through `mapping.ts`. Terrain and overlay cannot disagree without failing shared math.

## Testing method

```bash
cd app && npx vitest run src/manjushree/math/quadratics.test.ts
```

Every authored `expected` block is recomputed from `(a, r1, r2)` in tests.

## Rules for future questions

- Keep integer roots for intro route unless marked advanced
- Open downward for ridge silhouette readability
- Add a vitest case before shipping any new `mjz_q*`
- Never invent ontology ingredient ids
