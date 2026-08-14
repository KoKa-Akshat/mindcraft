# Part CXXXI — Figure Key-Verify Loops for Generated FormatId Stems

**Chapter status:** Living evidence + bank/ops brief — Researcher tick 2026-08-12 (UTC hour 12 ≡ Red Team slot, but ch131 never written → prefer Researcher; researcher count since synthesizer v1.16 = 5)  
**Primary question:** When MindCraft generates FormatId stems (`diagram`, `coordinate_graph`, `number_line`), what **figure key-verify loop** must pass before ship, mastery writes, or hide-correctness diagnostic — without treating fluent SVG / pretty render / LLM-as-judge “looks fine” as keyed truth?  
**Owners:** Engine (generation / figure verify) · Product (Practice / Diagnostic) · GENQ + FORMTRAP · Trust · Brand · Red Team  
**Commercial job:** Ship **SAFE-FIGKEY** densifying SAFE-GENQ × SAFE-FORMTRAP × SAFE-DUAL × SAFE-COVER × SAFE-EXPLAINQA: **structural figure gates** — never fluency-pass, never item-count from unverified visuals, never Map writes from wrong figures.

**Builds on:** Parts LXXII, CXXVIII, XCVII, LXXXVII, CXXI. Seams: `ml/generation/`, `Question.figure`, `--verify`, FormatId tags, trap seals, gap-scan eligibility.

---

## CXXXI.1 Why this chapter exists

SAFE-GENQ kills fluent wrong *text* keys (~30% internal drop; do not scale). SAFE-FORMTRAP kills decorative visual distractors. Underspecified: the **figure as ground truth** — wrong slope labels, contradictory side lengths, tick marks that disagree with the key — while the PNG “looks ACT-ready.”

Bad defaults: (1) fluency SVG pass, (2) LLM-as-judge alone, (3) decoration tagged `diagram`, (4) FormatId-count before verify, (5) Figure Key Score™ vanity, (6) hide-correctness on unverified figures (Map poison Maya cannot “re-check” like arithmetic).

**FOUNDER BELIEF under audit:** FormatId is a wedge only if figures are **constraint-checked** like text keys. Deterministic / IR verify is the spine; LLM proposes, not ships.

**Claims we refuse:** fluency SVG ≡ keyed; judge-alone ship; unverified figures as diagnostic truth; Figure Key Score™ / Visual QA Minutes; FormatId-count hero; soft-pass wrong geometry; ACT/coverage guarantees from figure packs.

---

## CXXXI.2 Constructs (pretty ≠ keyed)

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Figure key** | Geometry/labels that uniquely entail the keyed option | `Question.figure` + `correctAnswer` joint check | Stem slope 2; graph shows height |
| **Structural necessity** | Pictorial element encodes the math object | FormatId-required figure | Decsheets tagged `diagram` |
| **Stem–figure correspondence** | Text matches plotted entities/labels | Contiguity + consistency gate | Split legend; contradicting lengths |
| **IR / constraint check** | Machine-checkable geometry | Rule pass on figure IR / solver | Eye-test only |
| **Fluency SVG pass** | Compiles / renders | Banned as sole gate | Wrong math, clean pixels |
| **SAFE-FIGKEY** | Figure key-verify doctrine | This chapter | Figure Key Score™ |

**Operational definition (HYPOTHESIS):** *SAFE-FIGKEY complete* when (a) figure is structurally necessary, (b) checkable representation exists (coordinates / constraints / ticks / option geometry), (c) deterministic checks pass stem–figure–key–trap seals, (d) fluency / “looks fine” / compile-success never sufficient, (e) diagnostic and mastery writes barred until (c), (f) batch figure-drop under explicit gate (GENQ \<~10% ambition; figures inherit the same hard stop).

---

## CXXXI.3 Classical AIG: figures inside the model; review the procedure

**FACT:** Gierl & Lai (2012, *International Journal of Testing, 12*(3), 273–298, doi:10.1080/15305058.2011.635830) — AIG rests on **item models** specifying variable features — not free-form fluency.

**FACT:** Gierl, Lai, & Turner (2012, *Medical Education, 46*(8), 757–765, doi:10.1111/j.1365-2923.2012.04289.x) — cognitive model → item model → assembly; **auxiliary information** (graphs, figures) belongs in the item model.

**FACT:** Gierl & Lai (2016, *Educational Measurement: Issues and Practice, 35*(4), 6–20, doi:10.1111/emip.12129) — review generated items via **content and logic in the generation procedure** (math CCSS-linked illustration); do not eyeball thousands of stems as the QA unit.

**Applied (HYPOTHESIS):** Put figure constraints *inside* the item model; verify audits outputs against constraints — not “does this SVG look like an ACT graph?”

**Kill:** Prompt → pretty figure → ship. **Survive:** Model-constrained figures + procedure-level verify.

---

## CXXXI.4 Validity is about *use*

**FACT:** Kane (2013, *Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000) — validate **interpretations and uses**; ambitious claims need more evidence; negative consequences can kill a use.

| Use | Ambition | Figure-key risk if wrong |
|-----|----------|-------------------------|
| Practice with reveal + repair | Low–medium | Trust ding; SAFE-REPAIR |
| Format-gap / conversion Practice | Medium | Mis-routed FormatId remediation |
| Hide-correctness → Map / FEI | High | Silent false format weakness |
| Parent diagnosis / coverage ads | High | WTP + COVER burn |

**Kill:** “We have diagram items” ≡ validated FormatId diagnosis. **Survive:** Coverage browsing ≠ evidence use until FIGKEY pass.

---

## CXXXI.5 Multimedia law as verify criteria

**FACT:** Mayer, Heiser, & Lonn (2001, *Journal of Educational Psychology, 93*(1), 187–198, doi:10.1037/0022-0663.93.1.187) — extraneous multimedia can impair understanding (coherence).

**FACT:** Moreno & Mayer (1999, *Journal of Educational Psychology, 91*(2), 358–368, doi:10.1037/0022-0663.91.2.358) — spatial contiguity; Ginns (2006, *Learning and Instruction, 16*(6), 511–525, doi:10.1016/j.learninstruc.2006.10.001) meta-analyzes contiguity support.

**FACT:** Haladyna, Downing, & Rodriguez (2002, *Applied Measurement in Education, 15*(3), 309–333, doi:10.1207/S15324818AME1503_5) — context-dependent chart/graph items assume the visual is intended and legible.

**Applied (HYPOTHESIS):** FIGKEY requires contiguous labels and stem–plot consistency. A beautiful off-by-one axis is a **failed key**.

**Kill:** Decsheets as “visual learning.” **Survive:** Coherence + contiguity as hard QA.

---

## CXXXI.6 Models do not reliably see or author math diagrams

**FACT (preprint):** Zhang et al. (2024, arXiv:2403.14624, *MathVerse*) — MLLMs often fail true diagram use; some score ~5%+ *higher without* visuals — presence ≠ comprehension.

**HYPOTHESIS:** If multimodal judges cannot be trusted to *read* diagrams, they cannot be sole ship authority for *authoring* keyed FormatId figures.

**SUPPORTING PREPRINTS (method hints):** Kumar et al. (2025, arXiv:2511.08283, *DiagramIR*) — TikZ→IR + rules beat LLM-as-judge on human agreement; Wang et al. (2025, arXiv:2502.13855, *MagicGeo*) — constraint-solved coordinates beat unconstrained TikZ fluency.

**Applied (FOUNDER BELIEF → testable):** Prefer **spec → constraints → render → deterministic re-check** (+ SME sample) over **prompt → SVG → vibes**.

**Kill:** Multimodal “looks ACT-ready.” **Survive:** IR / coordinate / tick checks. **Wound:** MathVerse is comprehension, not authoring — still refuse judge-alone; no arXiv-as-ACT ads.

---

## CXXXI.7 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| AIG models include auxiliary figures; review targets generation logic | FACT | High | Gierl & Lai line |
| Score uses need evidence by ambition; bad keys kill high-stakes uses | FACT | High | Kane 2013 |
| Extraneous / poorly integrated visuals hurt learning | FACT | High | Mayer; contiguity meta |
| Context-dependent visuals must be intentional and legible | FACT | High | Haladyna et al. 2002 |
| MLLMs often fail true diagram use | FACT | Medium–High | MathVerse preprint |
| IR/constraint checks beat fluency SVG / judge-alone for ship gates | HYPOTHESIS | Medium | DiagramIR / MagicGeo; needs FIGKEY-* |
| Unverified FormatId generation will poison Map at scale | HYPOTHESIS | Medium–High | Densifies GENQ drop lesson |
| Pretty SVG pass is enough for practice | SPECULATION | Low | Refuse |

---

## CXXXI.8 Product surface — SAFE-FIGKEY claim contract

1. Generation emits a **checkable figure spec**, not only a raster.  
2. **Deterministic verify** (and/or IR rules) before bank sync.  
3. **Joint key:** stem ∧ figure ∧ `correctAnswer` ∧ distractor seals — any break = drop.  
4. Compile success / aesthetics / multimodal “looks fine” **never** sufficient.  
5. Unverified figures never enter hide-correctness or mastery writes.  
6. Telemetry: `figkey_pass`, `figkey_drop_reason`, verified FormatId FEI — demote Figure Key Score™.  
7. Coverage tables keep FormatId holes until FIGKEY pass (SAFE-COVER).  
8. Copy: “Every graph we count is constraint-checked — pretty isn’t keyed.”

---

## CXXXI.9 Doctrine — SAFE-FIGKEY (provisional)

1. **Figures are keys** (GENQ).  
2. **Structural necessity** (DUAL / FORMTRAP).  
3. **Procedure-level verify** (Gierl & Lai 2016).  
4. **Deterministic spine** — LLM proposes, rules dispose.  
5. **No judge-alone ship**.  
6. **Use gating** — diagnostic / Map / FEI only on FIGKEY-pass (Kane).  
7. **No Figure Key Score™ / Visual QA Minutes / FormatId-count hero**.  
8. Copy: “We don’t ship a graph we can’t re-check.”

**Confidence:** High on AIG review, Kane, coherence/contiguity. Medium on exact IR schema / drop targets (needs FIGKEY-*). High that fluency-pass / judge-alone / unverified diagnostic are commercially toxic.

---

## CXXXI.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| FIGKEY-1 | IR/constraint verify vs fluency-SVG-only | Offline audit | SME gold escape rate |
| FIGKEY-2 | LLM-as-judge vs IR+rules | Agreement | κ vs SME; cost/item |
| FIGKEY-3 | FIGKEY-pass-only vs mixed unverified FormatId practice | A/B sandbox | format-hop solo; trust incidents |
| FIGKEY-4 | Bar hide-correctness for unverified figures vs allow | Policy A/B | Map corruption; repair tickets |
| FIGKEY-5 | Parent CBC: constraint-checked vs “AI visual bank / N diagrams” | CBC | WTP; trust |
| FIGKEY-QUAL | Planted wrong graph: broken product or “hard item”? | Qual | FIGKEY codebook |

**Falsifiers:** Fluency ≤ IR on SME bad keys → still prefer IR auditability; IR false-drop spike → SME appeal, keep use gating; judge-alone κ ≥ IR → keep deterministic REPAIR traces, ban judge-alone sole authority. Pre-register before diagram/graph scale or “visual ACT bank” creative.

---

## CXXXI.11 So what for MindCraft commercially

- **Copy:** “Every graph we count is constraint-checked — pretty isn’t keyed.”  
- **Product:** Figure spec + deterministic verify; `figkey_pass` diagnostic gate.  
- **Growth:** Honest FormatId holes; kill “AI drew N diagrams.”  
- **Positioning:** Against ChatGPT pretty-wrong geometry; beside classical AIG discipline.  
- **Metric:** `figkey_pass` / drop reasons / verified FormatId FEI.  
- **Kill list:** Fluency SVG; judge-alone; unverified diagnostic figures; FormatId-count hero; soft-pass wrong geometry; ACT guarantees from figure packs.  
- **Vision:** Maya’s Map learns which representations she owns — only if the testing figure told the truth.

---

## References (verified)

- Gierl, M. J., & Lai, H. (2012). The role of item models in automatic item generation. *International Journal of Testing, 12*(3), 273–298. https://doi.org/10.1080/15305058.2011.635830  
- Gierl, M. J., & Lai, H. (2016). A process for reviewing and evaluating generated test items. *Educational Measurement: Issues and Practice, 35*(4), 6–20. https://doi.org/10.1111/emip.12129  
- Gierl, M. J., Lai, H., & Turner, S. R. (2012). Using automatic item generation to create multiple-choice test items. *Medical Education, 46*(8), 757–765. https://doi.org/10.1111/j.1365-2923.2012.04289.x  
- Ginns, P. (2006). Integrating information: A meta-analysis of the spatial contiguity and temporal contiguity effects. *Learning and Instruction, 16*(6), 511–525. https://doi.org/10.1016/j.learninstruc.2006.10.001  
- Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). A review of multiple-choice item-writing guidelines for classroom assessment. *Applied Measurement in Education, 15*(3), 309–333. https://doi.org/10.1207/S15324818AME1503_5  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Kumar, V., Mishra, S., Hao, R., Malik, R., Broman, D., & Demszky, D. (2025). *DiagramIR: An automatic pipeline for educational math diagram evaluation* (arXiv:2511.08283). https://doi.org/10.48550/arXiv.2511.08283  
- Mayer, R. E., Heiser, J., & Lonn, S. (2001). Cognitive constraints on multimedia learning: When presenting more material results in less understanding. *Journal of Educational Psychology, 93*(1), 187–198. https://doi.org/10.1037/0022-0663.93.1.187  
- Moreno, R., & Mayer, R. E. (1999). Cognitive principles of multimedia learning: The role of modality and contiguity. *Journal of Educational Psychology, 91*(2), 358–368. https://doi.org/10.1037/0022-0663.91.2.358  
- Wang, J., Zhang, T., Yu, H., Wang, J., & Huang, H. (2025). *MagicGeo: Training-free text-guided geometric diagram generation* (arXiv:2502.13855). https://doi.org/10.48550/arXiv.2502.13855  
- Zhang, R., Jiang, D., Zhang, Y., Lin, H., Guo, Z., Qiu, P., Zhou, A., Lu, P., Chang, K.-W., Gao, P., & Li, H. (2024). *MathVerse: Does your multi-modal LLM truly see the diagrams in visual math problems?* (arXiv:2403.14624). https://doi.org/10.48550/arXiv.2403.14624  
