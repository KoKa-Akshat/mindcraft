# Misconception rule library

This directory records the declarative identity of executable misconception
rules. Implementations live in `ml/generation/rules/`; the metadata here makes
the rule set inspectable without importing Python.

The library is deliberately **not one-to-one with ingredients**. A rule exists
only when a faulty procedure produces a characteristic value from the problem's
symbolic structure. `basic_equations__solution_verification` is the worked
example of an ingredient with no rule: skipping a substitution check does not
itself produce a particular wrong value. Inventing a decoy to fill that gap
would fabricate diagnostic structure.

The pilot stops at four rule families for `basic_equations`. Scaling beyond the
pilot is gated on external Learning Commons alignment (Guard A in the build
specification).

## Ingredient rule candidates (2026-08-18)

`ingredient_rule_candidates.json` classifies all 179 Layer-1 ingredient
`failure_mode` texts by a single criterion: does a student committing this error
produce a characteristic wrong **value** that could be computed and placed in an
answer option?

| Class | Count | Meaning |
|---|---|---|
| `executable` | 143 | The faulty procedure yields a specific computable wrong answer |
| `interpretation` | 23 | The value computed is correct; it is misread, mislabelled, or unexplainable |
| `meta` | 13 | A strategy, verification, or self-monitoring skill — no value at all |

Of the 143 executable, **129 are also `symbolically_tractable`** — a SymPy-style
engine could derive the wrong value from an algebraic problem statement. The
remaining 14 need a diagram, chart, graph, or natural-language read. Those 129
are the immediately actionable authoring worklist for new `MisconceptionRule`s;
the other 14 are executable but need a figure-aware problem representation first.

Classification was done by reading, not by an LLM call, and deliberately
under-claims: four genuinely torn entries are recorded as non-executable with
`confidence: "low"` and the tension written into their `note`. `class` is not the
same as "a rule exists" — it says only that a rule *could* exist. The 36
non-executable ingredients are the documented answer to "why isn't this
one-to-one with ingredients", generalising the `solution_verification` example
above.
