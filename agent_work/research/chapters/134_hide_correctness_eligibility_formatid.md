# Part CXXXIV — Hide-Correctness Eligibility Gates for FormatId Items

**Chapter status:** Living evidence + diagnostic/bank brief — Researcher tick 2026-08-13 (UTC hour 00 ≡ Red Team slot, but ch134 never written → prefer Researcher per rotation; researcher count since synthesizer v1.17 = 0)  
**Primary question:** When may a FormatId item (`diagram`, `coordinate_graph`, `number_line`, and siblings) enter **C4 hide-correctness** gap-scan / cold-start probes that write Map or FEI — and when must it stay out even if the stem “looks shippable”?  
**Owners:** Product (Diagnostic / gap-scan / Practice) · Engine (bank eligibility flags / GENQ verify) · Trust · Brand · Red Team  
**Commercial job:** Ship **SAFE-HCELIG** densifying SAFE-FIGKEY × SAFE-GENQ × SAFE-CALIB × SAFE-COLD × SAFE-FORMAT × SAFE-COVER: an explicit **eligibility gate** — never “any tagged FormatId may diagnose,” never HideCorrectness Score™, never coverage theater that fills holes with unverified visuals.

**Builds on:** Parts L (SAFE-CALIB), LXXII (SAFE-GENQ), LXXXI (SAFE-COLD), LXXXII (SAFE-FORMAT), XCVII (SAFE-DUAL), CXXVIII (SAFE-FORMTRAP), CXXXI (SAFE-FIGKEY), CXXV (SAFE-CONFMISS). Seams: C4 hide-correctness, `figkey_pass`, FormatId tags, gap-scan item pool, `/record-outcomes` / seed probes.

---

## CXXXIV.1 Why this chapter exists

SAFE-FIGKEY answers *how* to verify figures. SAFE-GENQ answers *that* keys must be sealed. SAFE-COLD and SAFE-CALIB answer *why* hide-correctness exists: observe without reveal theater so confidence and Map updates stay honest.

Underspecified: the **admission policy**. Product temptation is to widen FormatId coverage by letting every tagged diagram/graph into gap-scan as soon as it renders. That collapses three different risks into one green “eligible” bit:

1. **Key poison** — wrong figure or answer silently writes false format weakness (GENQ / FIGKEY).  
2. **Construct mix** — miss reflects graphics-decoding load, language, or decoration, not the FormatId skill the Map claims (Messick CIV; Diezmann/Lowrie graphicacy).  
3. **Use overclaim** — browsing a pretty visual bank sold as calibrated format diagnosis (Kane use ambition).

Hide-correctness makes (1) and (2) worse, not better: Maya cannot “check the answer key” and self-correct the company’s lie. The commercial cost is Map distrust, false PawHub routes, and parent “diagnosis” that is really item-bank failure.

**FOUNDER BELIEF under audit:** FormatId is a wedge only if eligibility is **stricter** for hide-correctness than for reveal Practice. Pretty + tagged ≠ diagnostic-ready.

**Claims we refuse:**
1. Any FormatId-tagged item may enter C4 hide-correctness.  
2. Fluency render / LLM “looks fine” ≡ eligibility.  
3. Coverage holes justify lowering the gate (“better a wrong graph than no graph”).  
4. HideCorrectness Score™ / Eligibility Minutes / FormatId-count-in-scan as NS.  
5. Miss on gated-out visuals ≡ topic mastery without format/graphicacy labels.  
6. ACT / identity guarantees from “visual diagnostic coverage.”

---

## CXXXIV.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Hide-correctness (C4)** | Record outcome; withhold key reveal in diagnostic | Gap-scan / cold probes | Answer-hunting; or silent Map poison |
| **Eligibility gate** | Binary (or graded) admit-to-use rule | `hcelig_pass` / pool filter | Soft “shipped ⇒ eligible” |
| **Figure key seal** | Stem∧figure∧key∧traps jointly true | SAFE-FIGKEY `figkey_pass` | Pretty wrong graph |
| **Format construct purity** | Miss mostly reflects intended FormatId skill | Format-tagged probe with sealed traps | Decoration; language/graphicacy confound unlabeled |
| **Use ambition** | What decision the score authorizes | Map format gap; FEI route; parent copy | Browsing ≡ diagnosis |
| **SAFE-HCELIG** | Eligibility doctrine for C4 FormatId | This chapter | HideCorrectness Score™ |

**Operational definition (HYPOTHESIS):** A FormatId item is *hide-correctness eligible* iff (a) text/key/distractor seals pass SAFE-GENQ, (b) if a figure is required, SAFE-FIGKEY `figkey_pass` holds, (c) FormatId is structurally necessary (not decoration), (d) trap seals exist for visual miss types when options are visual (SAFE-FORMTRAP), (e) accessibility/alt path exists or the item is barred from ELL-blind interpretation as math-only (SAFE-ELL light), (f) the item is barred from mastery/Map writes until (a)–(d), and (g) coverage tables show honest holes rather than ineligible fillers counted as “visual diagnostic stock.”

---

## CXXXIV.3 Uses are validated — not “items in a folder”

**FACT:** Kane (2013, *Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000) — validate **interpretations and uses**; more ambitious claims need more evidence; negative consequences can kill a use even when a weaker interpretation survives.

| Use | Ambition | Eligibility bar |
|-----|----------|-----------------|
| Practice with reveal + SAFE-REPAIR | Low–medium | GENQ seal; FIGKEY if figured; repair path |
| Format-hop Practice (revealed) | Medium | + FormatId necessity; FORMTRAP if MC visual |
| **C4 hide-correctness → Map / FEI** | **High** | Full HCELIG; no “looks fine” escape |
| Parent “we diagnosed format gaps” | High | Same as C4 + COVER honesty |

**Kill:** “We have diagram items in the bank” ≡ validated hide-correctness FormatId diagnosis.  
**Survive:** Same file may be Practice-eligible and C4-ineligible until seals complete.

---

## CXXXIV.4 Construct-irrelevant variance is the FormatId tax

**FACT:** Messick (1989, in Linn, *Educational Measurement*, 3rd ed., pp. 13–103) — two primary threats are **construct underrepresentation** and **construct-irrelevant variance (CIV)**; scores can be too narrow *and* contaminated by extraneous difficulty.

**Applied (HYPOTHESIS):** Unverified or decorative FormatId stems inject CIV (reading the legend, pixel density, SVG glitches, beauty traps) into a probe marketed as “format gap.” Underrepresentation happens when gap-scan never admits honest FormatId items and the Map pretends format flexibility from symbolic-only probes.

**Kill:** Fill FormatId slots with any visual to avoid underrepresentation theater.  
**Survive:** Prefer honest holes (SAFE-COVER) over CIV-contaminated greens; admit only sealed, necessary figures.

---

## CXXXIV.5 Graphicacy is a real skill — label it or gate it

**FACT:** Diezmann & Lowrie (2009, *Assessment in Education: Principles, Policy & Practice, 16*(2), 131–147, doi:10.1080/09695940903075891) — information graphics in math assessments are not a single trivial overlay; students need measurable knowledge across graphic languages (graphs, maps, number lines, etc.); instruments exist precisely because graphics demand is often invisible in “math” scores.

**FACT:** Lowrie, Diezmann, & Kay (2011, *Evaluation and Research in Education, 24*(4), 285–296, doi:10.1080/09500790.2011.629723) — graphics-decoding proficiency can be screened as its own capacity; graphics-based tasks (number lines, column graphs, maps, pie charts) are common in large-scale assessments and are not automatically interchangeable.

**Applied (HYPOTHESIS):** Hide-correctness FormatId probes that write a *format* gap must either (i) minimize irrelevant graphicacy load relative to the intended FormatId, or (ii) label the miss type so Map/CONFMISS recovery does not route as pure topic weakness. Items that are primarily graphicacy screens belong in a different pool — not silent FormatId diagnosis.

**Kill:** “She missed the graph item ⇒ diagram FormatId gap” without seal + construct check.  
**Survive:** Eligibility includes “what miss will we claim?”

---

## CXXXIV.6 Context-dependent visuals and generation review

**FACT:** Haladyna, Downing, & Rodriguez (2002, *Applied Measurement in Education, 15*(3), 309–333, doi:10.1207/S15324818AME1503_5) — guidelines for classroom MC include treating context-dependent items (charts/graphs) as requiring intentional, legible stimulus material — not ornamental art.

**FACT:** Gierl & Lai (2016, *Educational Measurement: Issues and Practice, 35*(4), 6–20, doi:10.1111/emip.12129) — for generated items, review should target **content and logic in the generation procedure**, not eyeball-every-stem theater at scale.

**FACT (preprint, method caution):** Zhang et al. (2024, arXiv:2403.14624, *MathVerse*) — multimodal models often fail true diagram use; presence of a figure ≠ comprehension. Treat as **wound** for judge-alone eligibility, not as ACT advertising.

**Applied (HYPOTHESIS):** HCELIG is a *procedure flag* emitted by GENQ×FIGKEY×FORMTRAP verify — not a human “looks ACT-ready” checkbox at upload time. LLM-as-judge alone never flips `hcelig_pass`.

**Kill:** Upload PNG → tag `diagram` → gap-scan.  
**Survive:** Procedure-level seals → eligibility bit → pool filter.

---

## CXXXIV.7 Why hide-correctness tightens the gate (calibration hygiene)

**FACT (calibration spine):** Fischhoff, Slovic, & Lichtenstein (1977, *Journal of Experimental Psychology: Human Perception and Performance, 3*(4), 552–564, doi:10.1037/0096-1523.3.4.552) — people are routinely wrong when feeling certain; calibration is long-run match of stated confidence to accuracy.

**Reuse (SAFE-CALIB / SAFE-COLD / SAFE-CONFMISS):** Hide-correctness exists so confidence × outcome can update without answer-hunting. That only works if the keyed outcome is true. A wrong figure under C4 produces **confident false weakness** — the worst Map poison — and then CONFMISS recovery “fixes” a ghost.

**HYPOTHESIS:** Reveal Practice can sometimes surface student “this graph looks broken” reports (REPAIR). C4 cannot. Therefore C4 FormatId eligibility ⊇ Practice eligibility, never the reverse.

**Kill:** Same eligibility bit for Practice browse and hide-correctness.  
**Survive:** Graded uses; C4 is the strictest FormatId gate.

---

## CXXXIV.8 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Score *uses* need evidence scaled to ambition; bad keys kill high-stakes uses | FACT | High | Kane 2013 |
| CIV and underrepresentation threaten construct meaning | FACT | High | Messick 1989 |
| Graphics decoding is measurable and often confounded with “math” | FACT | High | Diezmann & Lowrie 2009; Lowrie et al. 2011 |
| Context-dependent visuals must be intentional/legible | FACT | High | Haladyna et al. 2002 |
| Generated-item review should audit generation logic | FACT | High | Gierl & Lai 2016 |
| MLLMs often fail true diagram use | FACT | Medium–High | MathVerse preprint |
| C4 FormatId needs stricter eligibility than reveal Practice | HYPOTHESIS | Medium–High | Densifies GENQ/FIGKEY/CALIB |
| Coverage pressure will push teams to lower the gate | FOUNDER BELIEF | Medium | Needs COVER + HCELIG-* |
| “Any tagged FormatId may diagnose” is safe if drop rate looks low | SPECULATION | Low | Refuse |

---

## CXXXIV.9 Product surface — SAFE-HCELIG claim contract

1. Emit explicit **`hcelig_pass`** (or equivalent) distinct from “in bank” and from Practice-eligible.  
2. **Require** GENQ seal + (if figured) FIGKEY pass + FormatId necessity + FORMTRAP seals when visual options exist.  
3. **Bar** hide-correctness / Map / FEI writes for `hcelig_pass = false`.  
4. Allow reveal Practice on a *subset* of sealed-but-not-yet-C4 items only with REPAIR telemetry — never silent C4.  
5. Coverage UI: show **FormatId diagnostic holes** honestly when items fail HCELIG (SAFE-COVER).  
6. Telemetry: `hcelig_pass`, `hcelig_block_reason`, C4 format-probe counts, false-weakness repair tickets — demote HideCorrectness Score™ / Eligibility Minutes.  
7. Copy: “We only hide the key when we’re sure the figure told the truth.”  
8. Gap-scan composition: prefer sealed FormatId probes; do not pad with symbolic items and claim format diagnosis.

---

## CXXXIV.10 Doctrine — SAFE-HCELIG (provisional)

1. **Eligibility ≠ presence** — tagged FormatId in a folder is not C4 admission.  
2. **C4 is the strictest use** (Kane ambition).  
3. **Seals first** — GENQ × FIGKEY × FORMTRAP; judge-alone never admits.  
4. **Construct honesty** — graphicacy/language confound labeled or gated (Messick; Diezmann/Lowrie).  
5. **Honest holes > fake coverage** (SAFE-COVER).  
6. **No HideCorrectness Score™ / Eligibility Minutes / FormatId-count-in-scan NS**.  
7. **No ACT / identity guarantees** from visual diagnostic packaging.  
8. Copy: “Pretty isn’t eligible.”

**Confidence:** High on Kane/Messick/Haladyna/Gierl/Diezmann–Lowrie as method sources. Medium on exact graded Practice-vs-C4 tiers and ELL/alt thresholds (needs HCELIG-*). High that unsealed C4 FormatId and coverage-padding are commercially toxic.

---

## CXXXIV.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| HCELIG-1 | C4 pool: HCELIG-pass-only vs mixed tagged FormatId | Policy A/B | Map↔tutor gold agreement; false-weakness rate |
| HCELIG-2 | Practice-eligible / C4-ineligible tier vs dual-bar | Product A/B | Repair tickets; trust; format-hop solo |
| HCELIG-3 | Honest FormatId holes in scan copy vs padded symbolic “coverage” | Copy A/B | Parent/student trust; abandon |
| HCELIG-4 | Graphicacy-heavy items labeled vs silently written as FormatId gap | Engine A/B | Mis-route rate; CONFMISS recovery fit |
| HCELIG-5 | Parent CBC: “constraint-checked visual diagnosis” vs “N diagram diagnostic items” | CBC | WTP; trust |
| HCELIG-QUAL | Planted wrong graph under C4: broken product or “hard format”? | Qual | HCELIG codebook |

**Falsifiers:** HCELIG-pass-only equals mixed on false-weakness → audit seal quality before relaxing gate. Honest-holes copy raises abandon without trust gain → improve hole UX, do not pad with unsealed items. Graphicacy label confuses students → simplify miss taxonomy; keep gate. Pre-register HCELIG-* before “visual gap-scan” / FormatId-count diagnostic campaigns.

---

## CXXXIV.12 So what for MindCraft commercially

- **Copy:** “We only hide the key when we’re sure the figure told the truth.” Parent: “Format gaps we show were constraint-checked — we leave holes rather than guess.”  
- **Product:** `hcelig_pass` filter on gap-scan FormatId pool; stricter than Practice browse.  
- **Growth:** Kill “N diagram diagnostic items” hero; sell honest FormatId diagnosis.  
- **Positioning:** Against ChatGPT pretty-wrong visuals *and* against edtech that pads adaptive diagnostics with unverified art.  
- **Metric:** `hcelig_pass` / block reasons / C4 false-weakness — demote HideCorrectness Score™.  
- **Kill list:** Any-tagged-FormatId-in-C4; fluency eligibility; coverage padding; HideCorrectness Score™; ACT guarantees from visual diagnostic packs.  
- **Vision:** Maya’s first Map learns which representations she owns — only if the company refused to diagnose her with a lie.

---

## References (verified)

- Diezmann, C. M., & Lowrie, T. (2009). An instrument for assessing primary students’ knowledge of information graphics in mathematics. *Assessment in Education: Principles, Policy & Practice, 16*(2), 131–147. https://doi.org/10.1080/09695940903075891  
- Fischhoff, B., Slovic, P., & Lichtenstein, S. (1977). Knowing with certainty: The appropriateness of extreme confidence. *Journal of Experimental Psychology: Human Perception and Performance, 3*(4), 552–564. https://doi.org/10.1037/0096-1523.3.4.552  
- Gierl, M. J., & Lai, H. (2016). A process for reviewing and evaluating generated test items. *Educational Measurement: Issues and Practice, 35*(4), 6–20. https://doi.org/10.1111/emip.12129  
- Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). A review of multiple-choice item-writing guidelines for classroom assessment. *Applied Measurement in Education, 15*(3), 309–333. https://doi.org/10.1207/S15324818AME1503_5  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Lowrie, T., Diezmann, C., & Kay, R. (2011). The development of the graphics-decoding proficiency instrument. *Evaluation and Research in Education, 24*(4), 285–296. https://doi.org/10.1080/09500790.2011.629723  
- Messick, S. (1989). Validity. In R. L. Linn (Ed.), *Educational measurement* (3rd ed., pp. 13–103). Macmillan.  
- Zhang, R., Jiang, D., Zhang, Y., Lin, H., Guo, Z., Qiu, P., Zhou, A., Lu, P., Chang, K.-W., Gao, P., & Li, H. (2024). *MathVerse: Does your multi-modal LLM truly see the diagrams in visual math problems?* (arXiv:2403.14624). https://doi.org/10.48550/arXiv.2403.14624  
