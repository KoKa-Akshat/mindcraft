# Next session — engine + Level 3 book handoff

Written 2026-08-14. Everything below is pushed; `origin/main` and local are level.
Start with `git pull origin main`.

---

## Where things stand

**Strategic frame (new, matters for scoping):** the React web app is **legacy**.
iOS (`ios-prototype/MindCraftNotes`) is the product. Web is kept deliberately as
(1) an **ML accuracy lab** and (2) a **Level 3 book prototype** to port to Swift.
Don't propose web UX polish as product work. `ml/**` serves both surfaces.

**Shipped this session (14 commits):**
- **Engine bucket A** — edge decay priors persisted, bridge confidence seeded from
  the ontology, dead code removed, legacy ingredient alias map deleted.
- **Engine bucket B** — Beta posteriors for ingredient/bridge evidence (the
  `+0.15/−0.05` ratchet meant coin-flip performance converged to mastery 1.0),
  self-report gated so an `easy` rating can't trim a concept, difficulty derived
  from `population_failure_prior.overall`, card outcomes persisted as weighted
  events.
- **Book Level 2.9 → 3** (`BOOK_LEVEL3_BUILD.md`) — chapters now adapt level,
  format, grade, seen-questions and misconception targeting from the learner
  model; `StudyPlanList` renders the pathfinder route; fail-soft so a sleeping ML
  service still renders a complete chapter.
- **Firestore index fix** — see below, this one matters.

**Verified green:** `ml` 68/68 pytest + 85/85 end2end · `app` 219 passed/1 skipped.

---

## Read these first

| File | Why |
|---|---|
| `ml/ENGINE_MECHANISM.md` | how the engine works (8 stations) + the live issue list |
| `ml/ENGINE_FIX_A_BUILD.md`, `ml/ENGINE_FIX_B_BUILD.md` | what A/B did and why |
| `BOOK_LEVEL3_BUILD.md` | the book spec, incl. McCreary's Level 3 definition |
| `CLAUDE.md` | lanes, deploy rules, gotchas |

---

## 1. The accuracy thread (highest value, newly unblocked)

**What was wrong:** `firestore.indexes.json` declared the `attempt_observations`
composite index as `timestamp: ASCENDING`, but `load_recent_attempt_observations`
queries `DESCENDING`. Firestore rejected every read with `FailedPrecondition`, and
a bare `except Exception: return []` swallowed it. Silently. For every student.

**Consequences, both now unblocked:**
- `/recommend`'s `misconceptionGaps[]` was **always empty** — on web *and* iOS
  (`RouteClient.swift` hits the same endpoint).
- `validation/run_harness.py` reads the same observations, so the
  predictive-validity harness was running on **n=0**, not "n~1 noise" as its
  docstring assumes.

**Fixed + verified:** index recreated with DESC, stale ASC index deleted, real
student's 8 observations now load (was 0). Commit `400bbd96`.

> ⚠️ **CORRECTION (2026-08-14, see `ENGINE_BOOK_ACCURACY_REVIEW.md` §1):** that
> fix was only half a fix. Deleting the ASC index broke the *other* loader —
> `load_attempt_observations` (`firestore_adapter.py:165`) queries ASCENDING and
> feeds the entire validation harness, which then reported `observations: 0` for
> a student with 105 rows. The same `except Exception: return []` hid it a second
> time. The ASC index has since been created (`studentId ASC, timestamp ASC`) and
> **the harness now runs on all 211 observations.** Steps 1 and 3 below are
> superseded — read the review instead.

**Next steps:**
1. Run the harness now that it can see data:
   `cd ml && source mindcraft/bin/activate && FIRESTORE_PROJECT=mindcraft-93858 python -m validation.run_harness --all`
   Expect `INSUFFICIENT_DATA` — `calibration.py` needs `MIN_ATTEMPTS = 50`. That's
   correct behavior, not a failure. The point is it's no longer structurally blind.
2. **Fix the silent swallow.** `ml/mindcraft_graph/firestore_adapter.py:225` —
   `except Exception: return []` converted a one-word config bug into an invisible
   multi-feature outage. Log it at minimum. Audit the file for the same pattern
   elsewhere; this will not be the only one.
3. **0 of 8 observations carry a `misconception_id`.** So `misconceptionGaps` stays
   empty for real reasons now. Check whether the frontend/iOS actually sends
   `misconception_id` + `selected_choice_index` on wrong answers — if not, the
   whole distractor evidence stream (Stream A) never populates and W3 can't fire
   regardless.

**Auth gotcha:** `firebase deploy --only firestore:indexes` **403s** — the Firebase
CLI is authed as `blakeykell@gmail.com`, which lacks
`roles/serviceusage.serviceUsageConsumer` on `mindcraft-93858`. `gcloud` is authed
as `joinmindcraft@gmail.com` and works:
```
gcloud firestore indexes composite create --collection-group=X \
  --field-config=field-path=studentId,order=ascending \
  --field-config=field-path=timestamp,order=descending \
  --project=mindcraft-93858 --async
```
Use `--async` — without it gcloud blocks until the index finishes building.

---

## 2. Bucket C — six open engine issues, each needs a decision first

Full detail in `ml/ENGINE_MECHANISM.md` § *Issues to look into*. These are **not**
code-blocked; they're blocked on choices only Blake can make.

| # | Issue | The decision owed |
|---|---|---|
| **5** | Prereq chain is a *path*, not a closure — only the single strongest prereq is followed, so chains are 2–4 nodes | full closure gives 10–20 node chains. Pacing/motivation call. **Also ask: is this really a granularity problem?** McCreary targets 200–500 concepts per subject; we have 42 |
| **7** | `effort` is synthesized from the outcome's *sign*, not measured | what *is* effort? time-on-task? attempts? hints? Plumbing is trivial (`OutcomeItem` takes optional fields); the definition is the hard part |
| **1** | Zero `related`/`application` edges exist, so the entire "supplements" feature is dead code | author them by hand (42 concepts of judgment), derive from embeddings (noisy — similar text ≠ pedagogically analogous), or **cut the feature** |
| **15** | Difficulty is honest now but has **no ranking consumer** (B3a left it deliberately unwired after A3 deleted `adjusted_strength`) | restore difficulty-weighted strength, or use failure rate as the cold-start mastery prior (moves every untouched node) |
| **13** | Concept embedding text is failure-mode prose, not a description | fenced by `CLASSIFICATION_FIX_BUILD.md` §C-C. Changing it re-bakes PCA axes + their labels. Needs its own build file |
| **12** | Ontology Layers 2–5 are schema-only, unwired | architecture project |

**Also cheap and decision-free:** **#14** — `choose_roadmap_start` +
`get_mastered_chain_concepts` in `planning/pathfinder.py` are called only by each
other, and carry a *second* mastery threshold (0.45/0.0) that would silently
compete with `trim_chain` if ever wired. Delete or wire. Bundle into any build.

**Recommended order:** #5 first (users would actually feel it), then #15 and #1
together (both "is this feature real" questions).

---

## 3. Engine observability (recommended *before* bucket C)

The A/B changes were invisible — no way to see the engine's behavior shift. Two
distinct needs, and only one is blocked:

- **"Did my change alter what the engine decides?"** — not blocked, buildable now.
  `ml/mindcraft_graph/simulation/synthetic_student.py` exists but is **unseeded**
  (bare `random.*`, so non-deterministic) and **called by nothing**. Seed it, add
  scenario fixtures (fresh / mid-practice / exam-crunch), snapshot the engine's
  *decisions* (trimmed chain, worst weakness, severity ranking, pruned
  ingredients) as golden files, diff on every change.
- **"Is the engine right?"** — `ml/validation/` is well-built and now unblocked by
  the index fix, but needs attempt volume.

**The clever bit nobody has wired:** the synthetic student knows its own
`_true_mastery`. That's a **ground-truth oracle** — you can validate the mastery
estimator with zero real students. It's how you'd prove B2's Beta posterior is
better rather than merely different (simulate true mastery 0.5; the old rule
converged to 1.0).

**Also worth stealing from McCreary (ideas only — see licensing below):** DAG
validation as a standing check — cycle detection, orphan detection,
indegree/outdegree, linear-chain flagging, connectivity. **We run none of these**,
and our edges are *derived* from `comes_from`, so nobody has ever verified the
result is acyclic or connected. ~50 lines, and it de-risks #5.

---

## 4. Dan McCreary research — full detail, for the Level 3 book work

Investigated because Akshat had a real conversation with McCreary (a learning-graph
researcher) and built `dans-archive.html` — a link-out gallery to his 113 open
textbooks (`data/dansArchive.json`; top subjects: Engineering 8, Computer Science 7,
Mathematics 6, Education Technology 6, the rest long-tail across ~70 categories).
That in turn is what put "make our books Level 3" on the table. Four things were
researched: three of his GitHub repos, plus his intelligent-textbooks site/writing.

### Licensing — the constraint, and the carve-out we're using right now

**All three repos (`graph-lms`, `microsims`, `claude-skills`) are CC BY-NC-SA
4.0** — Attribution, **NonCommercial**, ShareAlike. Verified by fetching each
repo's license text directly, not inferred.

**Decision (2026-08-14, Blake):** for as long as this stays internal prototyping —
building and running the Level 3 book locally/on this machine, on the web surface,
never distributed or shipped to real users — the NonCommercial restriction isn't a
practical blocker. Treat this as **free rein to read his repos, borrow ideas, and
even directly reference his schemas/structure while prototyping.**

**This carve-out ends the moment anything ships.** Before any McCreary-derived
technique, schema shape, or content reaches a real user (web or iOS, even a soft
launch), it needs one of: (a) our own independently-built equivalent, built from
the *idea* without copying his files/text, or (b) his explicit written permission
for that specific commercial use. `BRAND_BOOK.md` §16 already codifies the
public-facing half of this — his name/work can be credited when linking out, never
used to imply partnership or endorsement without his sign-off. Don't let a
prototyping shortcut become a shipped dependency without that check happening.

### What each repo actually is

**`github.com/dmccreary/graph-lms`** — architecture writing, not a working system.
Describes a "Graph-based Integrated Learning Architecture (ILA)": Concept Graphs,
Content Graphs, Learning Trajectories, xAPI (Experience API) for activity tracking,
an LRS (Learning Record Store) for the data. Mentions JSON data models, NetworkX
for graph analysis, vis.js for visualization — but **the README does not publish
actual schemas, CSV templates, or a mastery model.** No downloadable concept graphs
in machine-readable form were found in this repo. Read it as a vision doc, not a
reference implementation.

**`github.com/dmccreary/claude-skills`** — 19 Claude Code skills automating
intelligent-textbook production. This is the one with real substance:
- `learning-graph-generator` — the core one. **13-step workflow**: (1) score a
  course description against a 100-point rubric, (2) generate 200–500 concept
  labels (Title Case, ≤32 chars, entity names not questions), (3) build a CSV —
  columns **`ConceptID, ConceptLabel, Dependencies, TaxonomyID`** — as a DAG (no
  cycles, no self-references, foundational concepts have empty `Dependencies`),
  (4) **validate**: cycle detection, orphaned-node detection, indegree/outdegree
  analysis, linear-chain flagging, connectivity check, (5–6) assign taxonomy —
  target ~12 categories, none over 30% of concepts, plus a mandatory
  `taxonomy-names.json` mapping IDs to display names, (7–9) emit metadata + a
  24-color group palette + run `csv-to-json.py` → `learning-graph.json`
  (validates against `learning-graph-schema.json`), (10–13) coverage report, index
  page, session log.
  - **The published JSON schema**: nodes carry `id, label, group, shape, title,
    level`; edges carry only `from, to, arrows, label, title, smooth`. **Directed
    edges representing dependencies — one relationship type. No `related` or
    `application` category exists in his schema.** This is the same gap as our
    open issue #1 — he hasn't solved cross-relation edges either, so there's
    nothing to import there.
- `book-chapter-generator`, `chapter-content-generator` (uses Bloom's Taxonomy
  2001 revision for learning outcomes), `glossary-generator` (ISO 11179-compliant
  terms), `quiz-generator`, `faq-generator`, `reference-generator`,
  `course-description-analyzer` — pure content generation, chained off the
  learning graph.
- `microsim-p5`, `microsim-standardization`, `bubble-chart-generator`,
  `timeline-generator`, `mermaid-generator`, `venn-diagram-generator`,
  `vis-network` — visualization generators.
- `intelligent-textbook`, `intelligent-textbook-creator`,
  `install-learning-graph-viewer`, `readme-generator` — orchestration; builds a
  full MkDocs Material site.
- **Confirmed explicitly**: *"purely content generation-focused and does not
  implement per-student mastery tracking, learner state modeling, misconception
  detection, or adaptive assessment."* Static resources, not a responsive system.

**`github.com/dmccreary/microsims`** — 100+ interactive p5.js STEM simulations
(physics, CS, math, electronics, biology). Each sim: own directory, `index.md`,
JS, preview image, Dublin Core metadata in YAML, validated against
`microsim-schema.json` via `validate-yaml-file.py`. Generated with
ChatGPT/Claude. `mk-gallery.py` builds the gallery page. Same CC BY-NC-SA license.
Relevant to us only as a possible future format for interactive card
representations (`CardTemplate` geometric/algebraic/procedural — we have no
interactive rendering yet, per `WORLD_VISION.md` "Designed, not built").

**Intelligent-textbooks site / "Five Levels of Intelligent Textbooks" (Medium)** —
the level taxonomy that framed the whole book-build decision:
- **Level 3**: *"adjust content based on analysis of user input or
  performance… simple deterministic rules like concept graph traversal
  algorithms to personalize learning pathways, and select from fixed levels of
  curated content based on simple assessment scores and delay-time-based
  rules… capturing every MicroSim interaction as an xAPI statement, storing it
  in a Learning Record Store, and using that evidence to predict which
  concepts a student has actually mastered."*
- **Level 4**: generative-AI-powered, chatbot interface at runtime. Explicitly
  **not** our target — `AGENT_RULEBOOK.md` keeps the deterministic spine on
  purpose (*"LLM is the bookends, deterministic is the spine"*), and Level 4's
  privacy bar is materially higher (stores conversation histories/queries).
- **Level 5**: full student profiling, not defined in detail, not relevant yet.
- His own books top out at **2.9** — static content generation plus data
  capture scaffolding (xAPI/LRS references), but no actual learner model reading
  that data back. That gap is precisely what `BOOK_LEVEL3_BUILD.md` closed on our
  side (see §"Where things stand" above).

### Bottom line

- **He builds the map; we build the student.** No mastery tracking, no
  misconception modeling, no adaptive assessment anywhere in his published work —
  our engine (bucket A/B work, the whole mastery/decay/pathfinder stack) is not
  redundant with anything he has.
- **Nothing to import as data.** His graph schema is dependency-only (42 vs our
  same problem), his catalog is subject-mismatched (~6 of 113 books are Math), and
  under the current internal-only carve-out we *could* use his structure directly
  — but there's genuinely nothing worth copying wholesale. The CSV schema shape
  (`ConceptID, ConceptLabel, Dependencies, TaxonomyID`) and the DAG validation
  checklist are the two things worth re-implementing as **our own code**, listed
  as concrete next steps below.
- **His 200–500-concept target vs our 42** is the one number worth sitting with
  independent of licensing — it's a real signal that our thin 2–4-node chains
  (issue #5) might be a granularity problem as much as a walk-algorithm problem.

### Next steps specific to McCreary-derived work

1. **Build our own DAG validator** (already flagged in §3 above, restated here
   with the source): reimplement his checklist — cycle detection, orphaned-node
   detection, indegree/outdegree analysis, linear-chain flagging, connectivity —
   against `01_mindcraft_concept_ontology_v2_6_with_combinations.json`. ~50 lines,
   own code, no licensing question at all since it's an algorithm not his content.
   Run it before touching issue #5 (chain closure) so any reshaping starts from a
   verified-sound graph.
2. **Taxonomy balance check**, same spirit as his ~12-category/≤30% rule: audit
   our 4 `level` tiers (foundational/core/advanced/cross_cutting) and the 42
   concepts across them for lopsidedness. Cheap, and maps onto known coverage
   holes (5 zero-coverage concepts per `CLAUDE.md`).
3. **When #5 (chain closure) gets built**, revisit whether 42 concepts is the
   right grain before assuming the walk algorithm is the whole problem — his
   200–500 concept norm is a data point, not a target to hit.
4. **If the book (or anything McCreary-adjacent) is ever scoped to actually
   ship**, that's the trigger to re-open the licensing conversation for real —
   either build proprietary versions of anything borrowed, or reach out to him
   for explicit written commercial permission. Don't let this slide by default
   because the prototype worked.

---

## 5. Loose ends

- **W3 (ingredient-lead prose + misconception-targeted questions) is wired but
  cannot fire** until distractor-tagged wrong answers exist. See §1 step 3.
- **Local testing without login:** `/try/dashboard` — real Dashboard, demo user,
  sessionStorage only, nothing written to Firestore. `/login` also does
  email+password and magic-link, not just Google OAuth (which breaks in the IDE's
  embedded browser).
- **Run both servers** (frontend `.env.local` points at `localhost:8080`):
  ```
  cd ml && source mindcraft/bin/activate && ML_AUTH_ENABLED=false FIRESTORE_PROJECT=mindcraft-93858 uvicorn serve:app --host 0.0.0.0 --port 8080
  cd app && npm run dev     # → localhost:5173
  ```
- **Ingredient coverage ceiling:** 97/179 ingredients have ≥1 labeled example, 82
  have none. The 82 sit in matrices / complex numbers / logarithmic functions /
  integrals — Eedi (UK GCSE) doesn't cover them. Closing that needs a separate
  ACT-only enrichment pass over L3 `subtopics`/`skill_gap_if_wrong`, **not** more
  effort on the Eedi batch. Those are advanced concepts, i.e. not where a
  high-schooler's foundational holes are — so this is a low priority.
- **The ML engine is NOT deployed** with any of this session's A/B fixes. The HF
  Space still runs the old code. Deploy is manual: `ml/scripts/deploy_hf.sh`
  (needs an HF write token). **Nothing is live to iOS until this runs.**
- **4 pre-existing stashes** (`stash@{1}`–`{4}`: tutor/parent + concept-id work,
  two wips, a pre-rebase temp) predate this session and need triage.

---

## Suggested opening move

**Deploy the engine** (`ml/scripts/deploy_hf.sh`) — buckets A and B are green and
committed but invisible to both surfaces until the HF Space is updated. Then pick
between the **observability build** (makes future changes reviewable, and would
have caught the index bug) and **bucket C #5** (users would feel it).
