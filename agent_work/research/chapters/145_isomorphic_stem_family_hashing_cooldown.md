# Part CXLV — Isomorphic Stem-Family Hashing for Cool-Down Without Over-Block

**Chapter status:** Living evidence + bank/selector brief — Researcher tick 2026-08-14 (UTC hour 18 ≡ Red Team slot, but ch145 never written → prefer Researcher per rotation; researcher count since synthesizer v1.18 = 2 → Researcher)  
**Primary question:** How should MindCraft **define and hash a stem family** so cool-down after Practice reveal blocks **answer-hunt clones** (same figure/key path, swapped digits) without **over-blocking** true FormatId substitutes that keep gap-scan alive under thin C4 stock?  
**Owners:** Engine (family hash / selector) · Bank / GENQ / FIGKEY · Product (Practice / C4) · COVER / SCANCOMP / COOLDOWN · Brand · Red Team  
**Commercial job:** Ship **SAFE-FAMHASH** densifying SAFE-COOLDOWN × SAFE-GENQ × SAFE-FIGKEY × SAFE-SCANCOMP × SAFE-DUALRATE: **inspectable family membership** — never item_id-only leak, never concept-wide forever ban, never Family Hash Score™.

**Builds on:** Parts CXLI (SAFE-COOLDOWN — family > item_id foreshadow; COOLDOWN-3), CXLIV (SAFE-DUALRATE — T5 first-of-cell / template trust handoff), CXXXI (SAFE-FIGKEY), LXXII (SAFE-GENQ), CXXXVIII (SAFE-SCANCOMP), CXXXVII (SAFE-SPLITPOOL), LXXXVII (SAFE-COVER). Seams: `family_id` / `template_id` / `figure_ir_hash` / `key_path_hash`, enemy/clone review queue, cool-down clocks keyed by family not lone stem.

---

## CXLV.1 Why this chapter exists

SAFE-COOLDOWN already bans immediate same-stem C4 and says **family > item_id** when clones share a figure/key path. The missing ops contract is **how family membership is decided**. Without it, three failure modes dominate:

1. **Under-hash (clone leak):** Cool-down bars only exact `item_id`. GENQ emits a near-clone (same slope figure, rescaled numbers) → student “fresh” C4 is tonight’s key in new clothes → Map poison (Appelhaus disclosed-reuse problem at clone grain).  
2. **Over-hash (starve):** Cool-down bars the entire concept×FormatId cell, or every stem sharing a topic tag → FormatId practice dies; SCANCOMP pad theater returns; parents see holes that are policy accidents, not stock honesty.  
3. **Black-box similarity theater:** “AI says they’re siblings” with no human seal → Family Hash Score™ ads, silent over/under block, no REPAIR path.

**FOUNDER BELIEF under audit:** Parents will accept a labeled hole or a *genuinely* different probe more than a green FormatId cell earned by recognizing last night’s diagram with new labels — but they will not accept a product that cools down “all graphs” after one Practice reveal.

**Claims we refuse:** item_id-only cool-down as sufficient under GENQ clones; concept-wide / FormatId-wide cool-down as default; embedding-only family without human seal; Family Hash Score™ / Clone Minutes NS; forever global family ban; pad when hash empties a cell; ACT / complete-visual guarantees from hashing packaging.

---

## CXLV.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Item model / template** | Authoring shell that generates variants | GENQ template / archetype seed | Untracked LLM remix |
| **Isomorph (intended)** | Unique instance, comparable cognitive demand | Sibling under same sealed template | Digit-swap clone sold as fresh |
| **Clone / enemy (ops)** | Pair that should not co-appear as independent evidence | Cool-down co-members; form enemies | Leak or over-block |
| **Family hash** | Stable id grouping co-compromised stems | `family_id` on cool-down clock | Opaque embedding cluster |
| **Out-of-family isomorphic substitute** | Same FormatId×concept ambition, **different** family | SCANCOMP preference under cool-down | Same-family “substitute” |
| **SAFE-FAMHASH** | Inspectable family membership doctrine | This chapter | Family Hash Score™ |

**Operational definition (HYPOTHESIS):** Two stems belong to the same cool-down family *F* iff **at least one** sealed membership rule fires: (R1) shared `template_id` from GENQ/AIG item model with declared radical/element slots; (R2) shared `figure_ir_hash` (structural IR, not pretty SVG) **and** shared `key_path_hash` (solution skeleton); (R3) human-tagged **enemy/clone** pair from bank QA (including NLP-flagged → SME confirm). Cool-down after reveal of any member bars **all** of *F* for that student. A **substitute** must be C4-sealed, same FormatId×concept cell ambition, and **`family_id ≠ F`**. If none exist → hole — never widen *F* retroactively to “everything diagram,” never pad. Embedding cosine may **propose** candidates for R3 review; it never silently writes `family_id` alone.

---

## CXLV.3 Item models create families — cloning is a feature with a dependence cost

**FACT:** Gierl & Lai (2012, *International Journal of Testing, 12*(3), 273–298, doi:10.1080/15305058.2011.635830) — automatic item generation rests on **item models** (templates) whose elements are manipulated to produce many new items; they discuss item-model banks and statistical procedures that estimate parameters of generated items without exhaustive separate pilot testing of every instance.

**FACT:** Sinharay, Johnson, & Williamson (2003, *Journal of Educational and Behavioral Statistics, 28*(4), 295–313, doi:10.3102/10769986028004295) — **item families** are groups of related items (e.g., AIG instances from models); calibration/scoring should account for dependence within families; they fit a Bayesian hierarchical model and introduce the **family expected response function (FERF)** to summarize P(correct) for an item randomly drawn from a family.

**FACT:** Glas & van der Linden (2003, *Applied Psychological Measurement, 27*(4), 247–261, doi:10.1177/0146621603027004001) — item cloning increases pool size but induces **parameter variability** across clones; multilevel IRT models families of clones; CAT selection can be two-stage: choose an optimal **family**, then randomly administer one clone — treating the family as the selection unit.

**Applied (HYPOTHESIS):** MindCraft already generates and promotes FormatId stems (SAFE-GENQ / SAFE-FIGKEY). That is AIG/cloning economics. Psychometrics treats the **family**, not the lone instance, as the dependence unit. Cool-down must do the same: compromise of one revealed instance compromises siblings that share the model/figure/key skeleton. Transfer limits: LSAT/CAT security ≠ teen gap-scan; borrow **family-as-unit**, not Sympson–Hetter brand theater or FERF Score™.

**Kill:** “New UUID ⇒ fresh diagnostic evidence.”  
**Survive:** Template/family id as cool-down grain; random sibling after cool-down ends is practice, not instant C4.

---

## CXLV.4 Enemy/clone detection is a review pipeline — not an unsupervised brand

**FACT:** Becker & Kao (2022, *Journal of Applied Testing Technology, 23*, 41–52) — NLP (e.g., cosine similarity on stem/key text) can flag **enemy and duplicate** pairs in large banks so SMEs review a manageable set; cosine thresholds are **starting values for human review**, not automatic ground truth; “not enemy” must distinguish unreviewed vs reviewed-clear.

**FACT:** Micir, Swygert, & D’Angelo (2022, *Journal of Applied Testing Technology, 23*, 30–40) — ML/NLP can prioritize enemy predictions in a large healthcare certification bank; editors then confirm; iterative SME feedback improves detection — **human confirmation remains in the loop**.

**Applied (HYPOTHESIS):** Family hashing for cool-down should reuse the **flag → SME seal** pattern. Cosine/embedding on stem+key (and, for figures, IR hash equality) proposes R3 enemies. Auto-writing `family_id` from cosine alone recreates clone leak (threshold too high) or over-block (too low). Ops queue: `enemy_candidate` tickets parallel PROMOTE/FIGKEY — not Discord emoji merges.

**Kill:** Embedding-only family membership as shipped law.  
**Survive:** NLP propose + human seal; machine rules R1/R2 when hashes exist.

---

## CXLV.5 Under-hash vs over-hash — both poison commercial honesty

**Reuse (SAFE-COOLDOWN / SAFE-SCANCOMP):** Disclosed reuse makes items easier (Appelhaus et al. 2023); thin C4 stock fails open to holes, not pad.

**HYPOTHESIS — under-hash cost:** Digit-swap / label-swap clones after reveal produce answer-hunt greens → parent distrust when tutor gold disagrees → WTP for “honest diagnosis” collapses (SAFE-HOLETRUST / SAFE-PROOF).

**HYPOTHESIS — over-hash cost:** Barring all `coordinate_graph` after one reveal empties FormatId cells → hole rate spikes → FILLETA pressure → soft-pass promote temptation (SAFE-FILLETA / SAFE-PROMOTE bans). Over-block is pad’s cousin: both prioritize *appearing* complete over measuring.

**Doctrine split:** Cool-down family = **compromise set** (same model/IR+key path/enemy seal). Substitute set = **ambition set** (FormatId×concept) **minus** compromise set. Never equate the two.

**Kill:** Concept×FormatId cool-down as default family.  
**Survive:** Narrow sealed *F*; substitutes outside *F*; holes when substitutes absent.

---

## CXLV.6 Template trust after dual admit — clones inherit membership, not C4 free passes

**Reuse (SAFE-DUALRATE T5):** First sealed admit for a concept×FormatId cell may require dual; later isomorphic clones may single-rater promote **if** they inherit a trusted template.

**HYPOTHESIS:** `template_id` minted at first-of-cell dual becomes R1 family membership for cool-down **and** promote inheritance — but inheritance never skips FIGKEY/GENQ seals, never auto-promotes to C4 from play counts, and never lets a just-revealed clone enter C4 during cool-down. Template trust ≠ “fresh forever.”

**Kill:** “Dual once ⇒ all clones are diagnostic-fresh anytime.”  
**Survive:** Shared `template_id` ⇒ shared cool-down *F*; promote still ticketed; cool-down still clocks.

---

## CXLV.7 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| AIG uses item models; instances form related sets | FACT | High | Gierl & Lai 2012 |
| Item families need dependence-aware calibration; FERF summarizes family | FACT | High | Sinharay et al. 2003 |
| Cloning ⇒ family-level selection unit in CAT designs | FACT | High | Glas & van der Linden 2003 |
| NLP can flag enemy/duplicate pairs for SME review | FACT | High | Becker & Kao 2022; Micir et al. 2022 |
| Embedding cosine alone is sufficient family law | SPECULATION | Low | Refuse |
| R1∨R2∨R3 sealed membership beats item_id-only and concept-wide ban | HYPOTHESIS | Medium–High | Needs FAMHASH-* |
| Exact cosine threshold is universal science | SPECULATION | Low | Experiment-owned |
| Parents prefer sealed-family honesty over clone greens or all-graph bans | FOUNDER BELIEF | Medium | × HOLETRUST / COOLDOWN-5 |

---

## CXLV.8 Product surface — SAFE-FAMHASH claim contract

1. Every C4/Practice stem carries `family_id` (nullable only for legacy until backfill); cool-down keys `(student_id, family_id)`.  
2. Membership rules **R1∨R2∨R3** are written, versioned, and logged; no silent embedding write.  
3. R1: GENQ/`template_id` when present. R2: `figure_ir_hash` ∧ `key_path_hash` when figured. R3: SME-confirmed enemy/clone (NLP may propose).  
4. Reveal of any member sets `cooldown_until(S,F)` for **all** members of *F*.  
5. Substitutes: sealed C4, same FormatId×concept ambition, **`family_id ≠ F`**.  
6. Empty substitute set ⇒ `format_not_probed` / hole — never pad, never expand *F* to whole FormatId.  
7. Enemy candidate queue with human clear/confirm; distinguish unreviewed vs cleared.  
8. Telemetry: `family_block_count`, `clone_leak_suspect`, `overblock_hole_rate`, `enemy_sme_confirm_rate` — demote Family Hash Score™ / Clone Minutes.  
9. Copy: “We don’t re-diagnose the same problem family right after we show the key — a different family or an honest hole.” Ban “AI clone detector protects your ACT.”  
10. Dual/template trust (DUALRATE T5) writes R1 ids; cool-down still applies to the family.

---

## CXLV.9 Doctrine — SAFE-FAMHASH (provisional)

1. **Family is the cool-down unit** — not lone `item_id`, not whole concept×FormatId.  
2. **Membership is sealed** — R1 template / R2 IR+key path / R3 SME enemy — embeddings propose only.  
3. **Under-hash and over-hash are both kills** — clone leak and all-graph bans both fail honesty.  
4. **Substitutes live outside F** — ambition ≠ compromise.  
5. **Holes beat pad** when substitutes missing (densifies SCANCOMP / COOLDOWN).  
6. **Template trust ≠ cool-down waiver** — dual-minted templates still clock.  
7. **Inspectable hashes** — versioned rules; REPAIR when leak/overblock found.  
8. **No Family Hash Score™ / Clone Minutes / Similarity % NS**.  
9. **No ACT / complete-visual / identity guarantees** from hashing packaging.  
10. Copy: "Fresh family or honest hole — never a digit-swap dressed as diagnosis."

**Confidence:** High on Gierl–Lai / Sinharay / Glas–van der Linden / Becker–Kao / Micir as method sources (with CAT/certification transfer limits). Medium on exact R2 hash algorithms and cosine propose thresholds (FAMHASH-*). High that item_id-only cool-down under GENQ is commercially toxic.

---

## CXLV.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| FAMHASH-1 | item_id-only cool-down vs R1∨R2∨R3 family cool-down | Engine A/B | Clone-leak false mastery; Map↔tutor gold |
| FAMHASH-2 | Narrow family vs concept×FormatId cool-down | Engine A/B | Overblock hole rate; Format-route quality |
| FAMHASH-3 | Embedding-auto family vs NLP-propose+SME seal | Ops A/B | False merges; missed clones; review minutes |
| FAMHASH-4 | R2 (IR∧key) on vs off for figured stems | Engine A/B | Digit-swap leak; figure-variant overblock |
| FAMHASH-5 | Parent CBC: “same problem family” honesty vs “new question id = fresh” | CBC | Trust; WTP; backlash |
| FAMHASH-QUAL | Planted digit-swap after reveal: does family bar catch it? | Qual | Codebook / tutor review |

**Falsifiers:** Family hash equals item_id-only on planted clone leaks → strengthen R2/R3 before shipping “family cool-down” ads. Narrow family equals concept-wide ban on hole rate *and* gold → widen substitute bank, not the ban. SME seal never disagrees with embedding for 90 days → keep seal for liability; thin review sample, do not delete humans. Pre-register FAMHASH-* before “AI prevents answer recycling” campaigns.

---

## CXLV.11 So what for MindCraft commercially

- **Copy:** “After we show a key, we won’t quiz the same problem family with the lights off.” Parent: “A lookalike with new numbers isn’t a fresh diagnosis.”  
- **Product:** `family_id` + R1/R2/R3; cool-down on family; substitutes outside *F*; enemy review queue.  
- **Growth:** Sell **anti-clone measurement honesty** vs apps that regenerate near-copies and call it adaptive diagnosis.  
- **Positioning:** Against ChatGPT one-blob fluency *and* against banks that treat UUID≠ as independence.  
- **Metric:** clone_leak_suspect; overblock_hole_rate; SME confirm precision — demote Family Hash Score™.  
- **Kill list:** item_id-only under GENQ; concept-wide cool-down default; embedding-only family; Family Hash Score™; pad when blocked; ACT guarantees from hashing.  
- **Vision:** Maya’s Map records competence on a **new family** — or an honest hole — never a memory of tonight’s diagram in a thin disguise.

---

## References (verified)

- Becker, K. A., & Kao, S.-c. (2022). Identifying enemy item pairs using natural language processing. *Journal of Applied Testing Technology, 23*, 41–52. https://www.jattjournal.net/index.php/atp/article/view/172634  
- Gierl, M. J., & Lai, H. (2012). The role of item models in automatic item generation. *International Journal of Testing, 12*(3), 273–298. https://doi.org/10.1080/15305058.2011.635830  
- Glas, C. A. W., & van der Linden, W. J. (2003). Computerized adaptive testing with item cloning. *Applied Psychological Measurement, 27*(4), 247–261. https://doi.org/10.1177/0146621603027004001  
- Micir, I., Swygert, K., & D’Angelo, J. (2022). Leveraging machine learning technology to improve accuracy and efficiency of identification of enemy item pairs. *Journal of Applied Testing Technology, 23*, 30–40. https://jattjournal.net/index.php/atp/article/view/167170  
- Sinharay, S., Johnson, M. S., & Williamson, D. M. (2003). Calibrating item families and summarizing the results using family expected response functions. *Journal of Educational and Behavioral Statistics, 28*(4), 295–313. https://doi.org/10.3102/10769986028004295  

**Also relied on (already in Constitution spine; not re-litigated here):** Appelhaus et al. (2023) disclosed reuse; Kane (2013) use ambition; SAFE-COOLDOWN / SAFE-SCANCOMP / SAFE-GENQ / SAFE-FIGKEY / SAFE-DUALRATE product contracts.
