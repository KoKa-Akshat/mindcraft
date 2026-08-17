# RESEARCH PROMPT — Prior art for ingredient (knowledge-component) mapping

**Written 2026-08-16.** For a research agent with web access. **Deliverable:** a
markdown report in `agent_work/engine/KC_MAPPING_RESEARCH.md`.

---

## Why you are being asked

MindCraft has a two-layer math ontology: **42 concepts** (coarse topics) and
**179 ingredients** (atomic mental models, 4–6 per concept). We are mid-way
through a restructure that makes ingredients primary and concepts a derived
view. Three concrete problems are blocking it, and we suspect **all three are
solved problems in the educational data mining / intelligent tutoring
literature** that we are re-deriving badly from scratch.

**Working hypothesis to verify or refute:** MindCraft's "ingredient" is what
that field calls a **knowledge component (KC)**, and "which ingredients does
this question exercise" is the **Q-matrix** problem. If that is right, say so
plainly and map our vocabulary onto theirs; if it is a false analogy, say that
instead and explain where it breaks.

## Our three problems, stated concretely

**P1 — Mapping misconceptions to ingredients.** We have 1,749 misconceptions
harvested from the Eedi dataset (each a human-authored description of a student
error, e.g. *"Thinks the inverse of subtraction is multiplication"*) and 179
ingredients. A 655-entry map links them. It was built by embedding similarity
plus LLM assignment, and it is **poor**: against independently authored ground
truth, `human`-provenance links agree at **0.928** but `llm`-provenance links —
which are the *majority*, 344 of 655 — agree at only **0.545**. Two structural
causes we have already diagnosed: the candidate pool was restricted to one
concept's ~5 ingredients (median 5, 86.6% of cases ≤6), and **abstention was not
permitted**, so a wrong pool guaranteed a wrong answer rather than a visible gap.

**P2 — Deciding which concepts an ingredient belongs to.** Our ontology is a
flat list with no containment relation, so `factoring_polynomials` and
`algebraic_manipulation` are siblings when one is part of the other. We are
moving ingredients to multi-concept membership and must decide, for each of 179,
which concepts it belongs to.

**P3 — Item-level prediction.** Our predictor currently uses concept mastery as
its only ability input and a per-*concept* authored difficulty constant, so every
question in a concept receives an identical prediction. A pre-registered
2-parameter run scored held-out Brier **0.2552** against a **0.2548** constant —
a tie. We have only **148 observations**, from two internal testers, so per-item
free parameters are not estimable.

## Questions to answer

1. **Vocabulary and framing.** What does this field call each of our objects —
   ingredient, concept, misconception, bridge, the misconception→ingredient map?
   Give us the search terms that make the literature findable.
2. **KC model refinement (P2).** Are there established methods for refining a KC
   model from student performance data — splitting, merging, or re-assigning
   KCs? Learning Factors Analysis is our lead; verify whether it does what we
   think and what data volume it needs. **Data volume required is a first-class
   part of the answer**, not a footnote — see the constraint below.
3. **Q-matrix construction and validation (P1).** What are the standard methods
   for building an item→skill matrix, and — more important to us — for
   *detecting that an existing one is wrong*? We need a way to tell a bad
   mapping from a good one that does not depend on the same LLM that produced it.
4. **Misconception→skill linking specifically.** P1 is narrower than generic
   Q-matrix work: we are mapping *error descriptions* to skills, not items to
   skills. Is there prior art on that specific link? Anything on using distractor
   /wrong-answer analysis to identify skills is directly relevant — we have
   3,835 tagged distractor slots across 1,508 questions.
5. **Item-level prediction with few observations (P3).** AFM and PFA are our
   leads for pooling parameters at the KC level rather than the item level.
   Verify, and report what these models need to be identifiable. If the honest
   answer is "far more data than 148 observations," say so — that is a useful
   finding, not a failure.
6. **The Eedi dataset.** It came from a NeurIPS education challenge. What has
   been published using it, particularly on the misconception annotations? Has
   anyone already mapped these misconceptions to a skill taxonomy?
7. **Reusable artifacts.** Are there public KC models, Q-matrices, or
   misconception taxonomies for secondary mathematics we could adopt or align
   to rather than authoring 179 memberships by hand? **For each, report the
   licence.** MindCraft is a commercial product; NonCommercial-licensed material
   (CC BY-NC-SA and similar) **cannot be ingested**, though reimplementing
   published *methods* is fine. Flag licence before usefulness — an unusable
   resource is worse than none because someone will try to use it.

## What a good report looks like

- **Leads with what changes for us.** For each of P1/P2/P3: is there a method we
  should adopt, and what would we do differently on Monday? A literature summary
  that does not connect to those three is not the deliverable.
- **Separates verified from plausible.** This prompt asserts several things from
  the requester's memory (LFA, AFM/PFA, DINA, the Eedi challenge). **Check them.
  If any is wrong or outdated, say so directly** — we would rather find out here
  than build on it.
- **Reports data requirements honestly.** Our binding constraint is 148
  observations from two non-representative users. A method that needs 10,000
  student-item interactions is not usable now; tell us that plainly and tell us
  what threshold it needs, so we know what to aim for.
- **Cites specifically** — authors, year, venue, and a link where one exists. We
  will follow up on the primary sources.
- **Says when the answer is "no established method."** A confident negative
  narrows our search. Do not pad with adjacent work to avoid an empty section.

## Anti-goals

- A reading list without a recommendation.
- Deep learning knowledge tracing (DKT and successors) as a *primary*
  recommendation. We deliberately keep the engine deterministic and auditable,
  and we have 148 observations. Mention it for completeness; do not lead with it.
- Anything requiring us to abandon the ontology and learn skills end-to-end from
  data. We have 179 authored ingredients with pedagogical content attached to
  them; the goal is to *validate and refine* that structure, not replace it.
- Restating our problems back to us. We wrote them down; spend the effort on the
  answer.
