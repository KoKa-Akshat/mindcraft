# Desk OS inbox — notes from other sessions

Read this when you start a session. Newest first. Reply by appending a `RE:` block under the relevant note; do not delete notes.

---

## 2026-08-07 · From the marketing session: Dan McCreary's open toolchain + the Alkemy framing

**Why you are getting this:** Akshat found Dan McCreary (Minneapolis, ex Head of AI at TigerGraph, UMN-affiliated, "democratizing education with AI and actionable knowledge representation") and his public toolchain overlaps hard with what MindCraft already has. Nothing here changes Brick 1's scope. It changes how you should TAG things in Brick 1 so later bricks get cheap.

### Who / what (all public, verified 2026-08-07)

- Personal site: https://dmccreary.github.io/dmccreary/
- Intelligent textbooks guide: https://dmccreary.github.io/intelligent-textbooks/ (100+ case studies)
- MicroSims: https://dmccreary.github.io/microsims/ (arXiv paper: McCreary, Lockhart & Peterson 2025)
- Claude Skills for textbooks: https://dmccreary.github.io/claude-skills/
- Learning graphs: https://dmccreary.github.io/learning-graphs/

The stack in one paragraph: a **learning graph** (concept dependency graph) is the ground truth; an open library of **agent skills** goes course description → book structure → learning graph → chapter content → glossary → quizzes → FAQ; **MicroSims** are small p5.js simulations generated from a text description, embeddable anywhere with a single `iframe`, each carrying JSON metadata against a published schema. His claim: a level-2 intelligent textbook that took ~4,000 hours now takes under 10, at under $1 of tokens.

### The mapping to MindCraft (this is the interesting part)

1. **His "learning graph" is our Layer-1 ontology.** 42 concepts + prerequisite edges + 179 ingredients already exist (`ml/data/5_level_ontology/`). His entire toolchain ASSUMES someone did that work. We did. Anything his skills generate can be grounded on our graph instead of a generated one.
2. **MicroSims → our format axis.** The deferred figure-generation work (diagram / coordinate_graph formats on `Question.figure`, see `FORMAT_WEAKNESS_PLAN.md`) has a live, open, CC-licensed pattern here: constrained p5.js sims in iframes with metadata. Same shape as Brick 5's rule: constrained spec rendered by code, never freehand LLM drawing.
3. **~1,500-question ACT bank + his chapter pipeline** = every ontology concept could get an "intelligent chapter" (story + sims + questions) grounded on our graph. That is the long game the marketing page now promises ("imagine each question living inside a world").
4. **xAPI/LRS wiring** in his skills = the telemetry analog of our `/record-outcomes` loop. Pattern to borrow, not a dependency.

### What Brick 1 should actually do about it (small, now)

- When the classifier files an upload, **also stamp a canonical ontology `concept_id`** (nullable, `snake_case` slug from Layer 1) next to course/date/type in the JSON index. Do not build anything on it yet. That single field is the join that later turns "filed worksheet" into "open the linear_equations story chapter / sim". Coordinate with Akshat before touching seam files; the local index is yours though.
- Keep binder metadata schema-first (JSON schema like his MicroSim registry does) so generated artifacts stay searchable.

### The Alkemy framing (positioning, for brick copy later)

Akshat loves the Alkemy site (consulting-firm OS). Their arc: *catalog everything you've ever made → AI builds a knowledge graph on top → ask anything, get answers with audit trails*, pitched as "Claude Code for consultants." The Desk OS is the same arc for a student's school life: **drop everything school ever gave you → the desk builds your graph (binder joined to the concept map) → ask your binder and get receipts.** Brick 6 ("Ask the binder") is our version of their audit-trail answer; keep the receipts language. Their "the root cause isn't the people, it's that your knowledge has no operating system" line maps to our "the only thing connecting it all is you" problem framing on the marketing mockup — stay consistent with it.

### FYI

- Marketing mockup (`agent_work/product/marketing_mockups/index.html`) now shows the REAL new dashboard (`/try/dashboard` capture) and the real story card (`/try/story/linear_equations`), and promises "your notes turn into story adventures". Brick 1 + the concept_id stamp is what makes that sentence true.
- Dan is 2nd-degree to Akshat on LinkedIn, local to Minneapolis, and explicitly open to conversations with people building AI × education. Outreach is Akshat's call, not this lane's.
