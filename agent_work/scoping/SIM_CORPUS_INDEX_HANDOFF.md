# Sim corpus index, and the 1,194 concepts we ask students to prove twice

Built 2026-09-05. Tool: `ml/tools/sim_corpus_index.py`. Outputs:
`agent_work/scoping/generated/sim_corpus_index.json` and
`cross_subject_bridges.json`. Every number below comes from running it.

Reads on top of `MCCREARY_SIM_CORPUS_SCOPE.md`.

---

## 1. The corpus, indexed

**4,061 simulations** with real JavaScript, across 113 mirrored repos.

| Kind | Count | What it means for us |
| --- | --- | --- |
| p5 sketch | 3,076 | the template corpus, shimmable |
| vis-network | 470 | graph diagrams, display only |
| unknown | 297 | needs a look |
| Chart.js | 159 | display only |
| Mermaid | 59 | display only |

**Shim tiers**, which is the number that decides scope:

- **display, 3,319.** Renders in a Frame, nothing can be driven from outside.
  Zero per-sim cost.
- **input, 742.** Follows the full MicroSim template *and* exposes recoverable
  sliders, so one generic shim can drive it. 1,410 sliders extracted in total.
- **dataflow, 0 automatic.** No sim in this corpus declares outputs, in any
  era. Every true Frame chain node needs a person.

So the honest headline is not "4,144 sims". It is **3,319 we can show today,
742 we can drive today, and per-sim work for anything that has to feed another
sim.**

## 2. The finding worth acting on

The tool maps each sim to concept ids across all 108 graphs. 2,120 of 4,061
sims (52.2%) map to at least one real concept.

Where a single sim maps into two different subject graphs, that sim is a
cross-subject link somebody already built in code and never wrote down. Two
kinds fall out, and they are not the same thing:

**Equivalences: 1,194 found.** The same concept, in two graphs, under the same
name, with no link between them. Real examples straight from the output:

```
calculus::average-rate-of-change        == pre-calc::average-rate-of-change
algebra-1::exponential-growth           == ai-strategy-for-education::exponential-growth
pre-calc::linear-regression             == hydroponics::linear-regression
us-geography::population-density        == ecology::population-density
beginning-electronics::motor-speed-control == learning-micropython::motor-speed-control
circuits::circuit-topology              == beginning-electronics::circuit-topology
```

These are not prerequisite edges. They are identities, and today **mastery does
not transfer across them.** A student who proves linear regression in a
hydroponics context is asked to prove it again in pre-calc, from zero. The
Beta-Binomial engine is working correctly; it has simply never been told the
two ids are the same thing.

This is the cheapest large improvement available in the entire stack. It costs
a review pass over 1,194 candidate pairs and an equivalence table the mastery
engine consults. No new content, no new sims, no license dependency.

**Associations: 1,267 subject pairs.** Different concepts one sim teaches
together. Candidate prerequisite edges, and these genuinely need a human to
decide direction, so they are proposals only.

Hotspots, by duplicated concept count: `claude-skills`/`ibook-skills` 16,
`learning-micropython`/`raspberry-pi-stem` 14, `beginning-electronics`/
`raspberry-pi-stem` 11, `biology`/`ecology` 11, `functions`/`pre-calc` 9.

## 3. Why this matters beyond deduplication

The ontology holds 45,565 dependency edges and **exactly zero cross a subject
boundary**, verified directly. It is 108 disconnected islands. No learning path
that crosses a subject can be expressed, and every question worth asking
crosses a subject.

The GPU path is the worked example. The concepts all exist: semiconductors in
`semiconductor-physics-course` (600 concepts, full BJT and MOSFET and diode
coverage), circuits in `circuits`, matrix multiplication in `linear-algebra`.
There is no edge between any of them, so the path is unrepresentable even
though every piece is present.

The bridges in `cross_subject_bridges.json` are the first evidence-backed
proposal for those edges, and the evidence is a working simulation rather than
somebody's opinion.

## 4. Design rules this tool follows, and why

- **It never writes into the graphs.** An ontology edge asserted by a script
  and never reviewed is worse than a missing one. Everything is a proposal with
  its evidence attached.
- **Matching is deliberately strict.** Requires 60% coverage of the concept's
  words, 40% of the sim's, and at least two shared tokens. A loose matcher over
  28,631 concepts produces thousands of bridges nobody reads, which is the same
  as producing none. 52.2% mapped is the honest result of that strictness, and
  the unmapped half is a real gap rather than a tuning failure.
- **Split-graph artefacts are excluded.** `learning-graphs__docs` and
  `learning-graphs__degree-chart` are one subject in two files. Linking them is
  not a cross-subject anything. That filter removed 28 spurious pairs.

## 5. Next

1. **Review the 1,194 equivalences.** Highest ratio in the stack. Emit an
   equivalence table, teach the mastery engine to consult it, and a student
   stops proving the same thing twice.
2. **Review the association proposals for the STEM spine**, which is where the
   real paths are: semiconductors into electronics into digital into circuits.
3. **Ship display-tier Frames.** 3,319 sims, no per-sim cost, no blockers.
4. **Curate the 742 input-tier sims** into the first drivable Frame set.
5. Leave dataflow Frames until a curated few hundred justify the per-sim work.
