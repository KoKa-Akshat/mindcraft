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
