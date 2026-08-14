# The Engine — what it does, and why it's swappable

**Function in one sentence:** you hand it a JSON map of a subject; it builds one
graph per student, replays everything they've ever done onto that graph, lets old
evidence fade, and answers three questions — *what do you know*, *what's your
worst hole*, *what should you practice next*.

**Nothing in the math knows it's math.** Swap the JSON, the same machine runs.

**The whole loop as one sentence (the mnemonic):**

> **Load the map → pin the nodes → copy it per student → replay their history →
> let it fade → route the path → hunt the holes → serve the question.**

Eight stations. Each one has exactly one job.

---

## The eight stations

### 1. Load the map — `loaders/complete_ontology_loader.py`
**One JSON in, two graphs out.**
- **Coarse graph** — 42 concepts, 68 edges. *Big topics, and what comes first.*
- **Fine graph** — 179 atoms, 16 bridges, 15 combos, 179 cards. *The little moves inside a topic.*

**The trick:** topic edges are **never authored** — they're *derived* from the fine
layer. An atom that says `comes_from: <atom in another concept>` becomes a
prerequisite edge between those concepts (167 of 179 atoms do this). Bridge groups
add the rest.

> Remember it as: **the small stuff tells you the shape of the big stuff.**

### 2. Pin the nodes — `representation/embeddings.py`
**Every concept gets coordinates.**
- `name + description` → sentence-transformer → 384 numbers → PCA → keep 4 axes.
- Axes are just "the 4 biggest ways these topics differ."
- Cached, and **self-invalidating**: if the concept-id set changes, it rebuilds.

> Buys you: cheap similarity, 2D map coords, and *where the student lives* in the subject.

### 3. Copy it per student — `engine/student_graph.py`
**Everyone starts as an unmodified copy of the map.**
- Each edge becomes a **loaded coin** (Beta α/β). How loaded = how much we trust the map:
  prerequisite `20` · related `8` · application `5` · student-discovered `1/1`.

> **Ontology = the prior. Student graph = the posterior.** That's the whole design.

### 4. Replay their history — `engine/update.py`, `engine/edge_weights.py`
**No score is ever stored. Only events. Every call rebuilds from the log.**

Three doors write events, all the same shape (`concept`, `outcome ∈ [−1,1]`, `effort`, `minutes`, `time`):
`/seed-assessment` (self-rating), `/record-outcomes` (real practice), `/process-summary` (tutor notes).

**Nodes** get a mastery score:
```
mastery = σ( −2.0 + 0.8·log(evidence+1) + 1.5·avg_outcome + 0.3·recency )
```
> *A little for showing up, a lot for doing well, a little for doing it lately.*
> No data → 0.12, the floor.

**Edges** learn from co-occurrence: two topics touched within 2 hours nudge that
edge's coin. No such edge in the map? Mint a `discovered` one.
> *"You keep using these together even though the map doesn't say so."*

**Same events, second read — `strength_score`, deliberately asymmetric:**
- Did well → `outcome ÷ (effort × time)` → *cheap win = talent.*
- Did badly → `outcome × (effort × time)` → *expensive loss = a confirmed hole.*

> Mastery = *how much you know*. Strength = *is this a strength or a wound*.
> The router trusts **strength**.

### 5. Let it fade — `engine/decay.py`
- Mastery half-life 60 days; drifts back to the 0.12 floor if untouched.
- Edge evidence half-life 90 days; decays **toward the prior, never past it.**

> **The graph may forget the student. It never forgets the map.**

### 6. Route the path — `planning/pathfinder.py`
1. **Chain** — walk backwards from the target through prerequisites.
2. **Trim** — label every step, then cut:
   - **Mastered** → cut · **Struggling** → *never* cut · **Unknown** → cut only if the
     step *after* it is mastered ("you clearly got past it").
   - Propagation is one-way by design: **a guess can never overwrite bad news.**
3. **Exam re-rank** — `1.0×exam_frequency + 0.6×(1−mastery)`, keep top-N by deadline
   (≤3 days→3, ≤7→6, ≤14→10), then **restore teaching order**.
   > *Cram the frequent stuff you're bad at — but still teach it in order.*
4. **Explore** — no target: `novelty × (1 + alignment/temp)`.

Feelings plug in here: `stress > 0.7` lowers the mastery bar; anything the student
*says* they're bad at is force-labeled STRUGGLING so trim can't drop it.

### 7. Hunt the holes — `api/recommend.py`
The chain only sees topics. Three failures hide *between* them — all three emit one
comparable number, **`severity ∈ [0,1]`**:

| Hole | ELI5 | Gradient |
|---|---|---|
| **Bridge gap** | "know A, know B, can't get A→B" | source strong, target weak |
| **Format gap** | "know it, can't read it as a graph" | **inverted** — concept strong, vessel weak |
| **Misconception gap** | "the same trap keeps catching you" | distractor hit-rate vs population |

`severity = (1 − confidence) × (1.0 if earned evidence else 0.5)`
> **A guess is always worth half of evidence.** Tier 2 hypotheses let the system be
> useful on day one, without lying about what it knows.

### 8. Serve the question — `app/src/lib/recommendNextConcept.ts`, `questionBank.ts`
- `worstWeakness()` dumps every candidate into **one pile** and takes the max.
- Hard filter: **playable** (`questionCount > 0`). A hole with no questions is invisible.
- `getQuestions()` cascades and never returns empty: `concept+level → format → exam-tag → shuffled, unseen-first`.
- Level comes from the gap scan, not a picker: `hard→L1 · kinda→L2 · easy→L3`.
- Answers → `/record-outcomes` → **back to station 4.** The loop closes.

---

## The fine layer (the ingredient sibling)

Same eight moves, one level down, for *"help me with this exact problem."*

1. **Classify** — embed the problem, k-NN against archetypes + real bank questions.
   Neighbors *vote* on the concept; the winning archetype hands over its required atoms.
2. **Backtrack** — walk `depends_on` (inside a concept) and `bridges` (across), depth 3.
3. **Combos fire** — a combo is a **hyperedge**: "these 4 atoms always appear together."
   ≥50% already active → pull in the rest, adopt its `apply_order`.
   > *Recognize the recipe from half the ingredients, then hand over the whole recipe in order.*
4. **Prune & rank** — `need = 1 − mastery`; drop atoms ≥0.8 mastered if their bridges are
   strong; **bridges get 1.5× priority** (the joins are where people fail); the problem's
   own atoms are never evicted.
5. **Render** — cards in the student's best style: `geometric | algebraic | procedural`.
6. **Roll up** — atom mastery aggregates into concept mastery, weighted by connectivity.

**Enrichment is offline, never runtime.** One pattern for every annotation layer:
> **script → `_raw.json` → human review → promote to the file `serve.py` loads at boot.**
Missing file = feature silently off. (Live example: `misconception_ingredient_map.json`,
built by exact ontology tags first, then concept-scoped embedding similarity.)

---

## Why it's modular

**Three boundaries, each crossable without touching the others.**

**A. Data vs. engine.** The engine reads *shapes*, not content. To run a new subject
you write JSON — no code.

| The JSON must supply | Feeds | Without it |
|---|---|---|
| stable slug `id` | every join | hard requirement |
| `name` + `description` | embeddings, map coords, similarity | hard requirement |
| nested atoms with `comes_from` | **generates all topic edges** | no chains; trim + exam modes die |
| `level` tier | difficulty proxy, cross-cutting rules | one flat tier |
| `bridges[]` from/to | cross-topic edges, bridge gaps | no bridge gaps |
| `{tested, frequency}` per concept | exam scoping + priority | exam mode = full chain |
| 3-style `card_templates` | the cards | no fine-layer UI |
| `combinations[]` | recipe expansion + ordering | atoms taught in DAG order only |

**B. Structure vs. tuning.** Every threshold, half-life, outcome map, and exam budget
lives in `config.py`. New subject = new JSON + retuned constants. Zero engine edits.

**C. Deterministic vs. generative.** The engine owns *decisions* (what to teach, what's
broken, what order). The LLM only owns *language* (classify a problem, write card text).
> **LLM is the bookends; deterministic is the spine.** That's what stops hallucinated pedagogy.

**Layer independence:** the coarse and fine graphs share one canonical ID space and
are loaded from one file, but each is usable alone. Format nodes ride the *identical*
update math as concepts — they're just extra keys in the mastery dict, which is why
adding the whole format axis needed no new engine code.

---

# Issues to look into

## Dead in practice — reachable code, unreachable with this ontology
1. **All 68 edges are `prerequisite`; zero `related`/`application`** (loader only emits
   prerequisites). Therefore `find_analogous_concepts` always returns `[]` → **the entire
   "supplements" feature never fires**, and the `related=8` / `application=5` priors are
   unused. Fix: author those relations in the JSON, or derive them from embedding similarity.
2. `adjusted_strength` (difficulty-normalized strength) is computed and never read.
3. Combination fields `spans_concepts` and `captured_by_dependency_or_bridge` are parsed
   and ignored **at runtime** — but `spans_concepts` is still maintained by
   `scripts/canonicalize_concept_ids.py` and `reconcile_ontology.py`, so keep the fields
   and annotate them. `captured_by_dependency_or_bridge` (marks combos redundant with
   existing edges) is a candidate combo-firing filter.

14. **`choose_roadmap_start` + `get_mastered_chain_concepts`** (`planning/pathfinder.py`)
    are called only by each other — never by `find_path` or `serve.py`. They carry a
    second, divergent mastery threshold (0.45/0.0) that would silently compete with
    `trim_chain` if ever wired up. Delete or wire, don't leave.

## Fragile — works, but on shakier ground than it looks
*Still open. Both require a measurement or pacing decision — see bucket C below.*

5. **The "canonical chain" is a path, not a closure.** `get_prerequisite_chain` follows only
   the *single strongest* prereq, so real chains come out 2–4 nodes long and siblings are
   dropped. Exam mode hides this by passing all 29 targets at once.
7. **`effort` is synthesized from the outcome's sign** in `/record-outcomes` (0.6 if negative,
   0.4 if positive). So strength's "high effort + failure = confirmed weakness" is reading a
   constant, not evidence. Directionally right, epistemically empty.

## Resolved — Engine Bucket A + B (2026-08-14)
4. ~~`decay_edge` decays toward the wrong attractor~~ — `EdgeState.prior_mean` now persists
   the ontology strength at creation and decay reads it back. `c84f382d`.
6. ~~`estimate_difficulty` is file ordering~~ — now derived from
   `population_failure_prior.overall`, order-independent (regression-tested). `422430ad`.
   Made **honest**, not yet **consumed** — see #15.
8. ~~`/submit-answer`'s concept write is transient~~ — now emits a real
   `exposure_weight=0.4` event (`source="card"`) instead of overwriting mastery directly;
   survives a graph rebuild. `71f00bf9`.
9. ~~Bridge "weak" threshold is unreachable early~~ — unattempted bridges seed from
   `bridge_prior_confidence()` (`cd981aca`), and the additive `+0.15/−0.05` ratchet was
   replaced by a Beta posterior (`170dc310`) so evidence no longer needs 5 straight wins to
   move the needle.
10. ~~One `easy` rating erases a concept~~ — self-report events dropped to
    `exposure_weight=0.4` and `trim_chain` now requires ≥1 real practice event before either
    MASTERED branch fires. `604f61ad`.

## Structural — the code is right, the wiring is the problem
*No local edit fixes these. The change may be one line; the fix is a coordinated
re-bake or migration across every consumer.*

11. **Two independent alias maps in two languages:** `IngredientGraph.CONCEPT_ID_ALIASES`
    (17 legacy pilot mappings, now a no-op under the standardized ontology) and the
    frontend's `BANK_ALIASES` (19 entries, load-bearing). Collapse to one canonical ID space.
12. Layers 2–5 of the ontology are schema-only; the runtime student model doesn't read
    Layer 4/5 yet, so the richer per-student state is still aspirational.
13. **The embedded concept text is the failure note, not a description.**
    `_build_concept_ontology` sets `description = population_failure_prior.notes`, so
    `functions_basics` embeds as *"Functions Basics. Students treat f(x) as f times x…"*.
    **Already litigated** — `CLASSIFICATION_FIX_BUILD.md` § C-C rules `make_concept_text` /
    `concept_embeddings.npz` off-limits to incidental change, and production routes around
    it via `classifier_mode="bank"` (k-NN over tagged bank questions, 0.80 held-out), which
    never reads concept text. What still rides on the failure-note text: the 4 PCA axes and
    their labels, map coordinates, student mastery/strength embeddings + displacement,
    alignment scores, explore ranking. Any change = a deliberate re-bake + axis re-labeling.
    Needs its own build file.
15. **Bucket C — difficulty has no ranking consumer after `adjusted_strength` was removed.** Two
    policy options remain deliberately unbuilt: restore difficulty-weighted strength as
    an explicit ranking input (failure on hard concepts counts less than failure on easy
    ones), or use population failure as the cold-start mastery prior (which moves every
    untouched node and changes UNKNOWN trimming and “learn next”). Either requires a
    separate pedagogical decision and regression build.

---

**Bucket A** (`ml/ENGINE_FIX_A_BUILD.md`, #4 · #9a · #2 · #3 · #11a) — **done.**
**Bucket B** (`ml/ENGINE_FIX_B_BUILD.md`, #10 · #9b · #6 · #8) — **done.**
**Bucket C — genuinely open, needs a decision, not a menu pick:** #1, #5, #7, #12,
#13, #15. Plus dead code #14 (delete-or-wire, no decision needed, just do it).
