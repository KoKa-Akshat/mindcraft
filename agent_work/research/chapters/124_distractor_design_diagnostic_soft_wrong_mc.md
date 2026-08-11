# Part CXXIV — Distractor Design for Diagnostic Soft-Wrong MC

**Chapter status:** Living evidence + Practice/Diagnostic item-craft brief — Researcher tick 2026-08-11 (UTC hour 09; hour%6≠0; researcher count since synthesizer v1.15 = 7 → Researcher)  
**Primary question:** How should MindCraft design **MC distractors** so a wrong pick becomes typed soft-wrong signal (misconception → route) — without beauty-trap options, four-option cosplay, Distractor Score™ vanity, or treating every miss as the same red X?  
**Owners:** Product (Practice / Diagnostic / bank) · Engine (mis_ links + outcome events) · GENQ / bank ops · HITL · Brand · Parent GTM · Red Team  
**Commercial job:** Ship **SAFE-DISTRACTOR** densifying SAFE-TAXON × SAFE-MISCON × SAFE-GENQ: **each wrong option maps a plausible misconception (or slip-adjacent trap)**; soft-wrong climate wraps the typed pick; no option-count theater or beauty distractors.

**Builds on:** Parts XLIX (SAFE-MISCON), CXXII (SAFE-TAXON), LXXII (SAFE-GENQ), LXXXVII (SAFE-COVER), L (SAFE-CALIB), LXXIX (SAFE-FBTIME), CXVIII (SAFE-SOFTMSG). Product seams: Eedi `mis_` IDs, actMaster / gap-scan MC, generated MC verify loops, soft-wrong UX.

---

## CXXIV.1 Why this chapter exists

SAFE-TAXON requires mark *types*. For MC Practice and gap-scan, the cheapest type signal is **which distractor was chosen** — *if* distractors were written as diagnostic probes, not as random wrong numbers that look pretty next to the key.

Default edtech resolves this badly: (1) stem-first writing with leftover distractors, (2) four/five options as house style even when only one distractor functions, (3) “none of the above / all of the above” fillers, (4) LLM-generated options that are fluent but unmapped, (5) Distractor Diversity Score™ / option-count as quality theater, (6) marketing “AI wrote N questions” without distractor→misconception seals (SAFE-GENQ / SAFE-COVER).

**FOUNDER BELIEF under audit:** Soft-wrong MC is only diagnostic when **wrong picks encode theories**. Beauty traps and non-functioning options waste Maya’s attempt and poison Map updates. MindCraft’s bank moat is not item count — it is **keyed options with inspectable misconception families**.

**Claims we refuse as doctrine:**
1. Four/five options ≡ better assessment (option-count cosplay).  
2. Distractor Score™ / Option Minutes / “richer MC” NS.  
3. Beauty traps / absurd fillers / NOTA-AOTA as default craft.  
4. Unmapped wrong options as “diagnostic soft-wrong.”  
5. LLM distractors≡shipped bank without verify + mis_ seal (SAFE-GENQ).  
6. Selection frequency alone ≡ identity / mastery (no route).  
7. Empty “we learn from mistakes” without distractor→route.  
8. ACT / grade guarantees from distractor packaging.

---

## CXXIV.2 Constructs (functioning distractor ≠ pretty wrong answer)

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Key** | Correct / best option | Verified answer (SAFE-GENQ) | Fluency without key verify |
| **Distractor** | Plausible incorrect option | Option linked to mis_ / slip trap | Random wrong number |
| **Functioning distractor** | Selected by enough examinees; negatively discriminates | Option with choice share + ability pattern | <5% never-picked beauty trap |
| **Non-functioning distractor** | Rarely chosen or positively discriminating | Dead option; rewrite or drop | Keep for “four choices” costume |
| **Diagnostic MC** | Each wrong maps a common misconception | Soft-wrong typed by option | Binary red-X only |
| **Ordered MC (OMC)** | Options map developmental levels | Optional progression grain (not % NS) | Level Score™ theater |
| **SAFE-DISTRACTOR** | Distractor craft + QA law | This chapter | Option-count / beauty traps |

**Operational definition (HYPOTHESIS):** An MC item is *SAFE-DISTRACTOR complete* when (a) every distractor is **plausible** under Haladyna-class guidelines, (b) each distractor carries a **named diagnostic intent** (misconception family, slip-adjacent arithmetic trap, or FormatId trap — not “wrong”), (c) dead options are retired after item analysis (or never shipped), (d) soft-wrong UX surfaces type + next move from the *chosen* option, (e) generated items fail ship without distractor→mis_ (or explicit untyped-bug) seal, and (f) value is proved by type→route hit / `retry_120s` / `solo_transfer_pass` — not option count.

---

## CXXIV.3 Item-writing law: plausible, misconception-based choices

**FACT (guideline taxonomy):** Haladyna, Downing, & Rodriguez (2002, *Applied Measurement in Education, 15*(3), 309–334, doi:10.1207/S15324818AME1503_5) — validated a 31-guideline MC taxonomy from textbook consensus + empirical studies; **choice-writing** is the largest cluster, including: base distractors on common student errors / misconceptions; keep options homogeneous; avoid clues (clang, grammar, absurd options, “all/none of the above” traps); place the key randomly; keep option length balanced.

**Applied (HYPOTHESIS):** MindCraft bank craft starts from **known error families** (Eedi mis_, Layer-1 `failure_mode`, tutor error logs) and *then* writes options — never stem→fill-three-wrongs. Absurd or length-cued options are craft bugs, not “engagement spice.”

**Kill:** Beauty traps and clue-laden options as house style.  
**Survive:** Homogeneous, misconception-sourced options + key-verify (SAFE-GENQ).

---

## CXXIV.4 Functioning distractors — quality over quantity

**FACT (functioning-distractor scarcity):** Tarrant, Ware, & Mohammed (2009, *BMC Medical Education, 9*, 40, doi:10.1186/1472-6920-9-40) — analyzed 514 four-option nursing MCQs (1,542 distractors); non-functioning = chosen by <5% **or** positively discriminating. Mean **1.54** functioning distractors per item; only **13.8%** of items had three functioning distractors; **47.8%** of distractors non-functioning; more functioning distractors → harder, more discriminating items. Conclusion: write as many *plausible* options as content allows — **in most cases three** (key + two distractors).

**FACT (meta-analytic efficiency):** Rodriguez (2005, *Educational Measurement: Issues and Practice, 24*(2), 3–13, doi:10.1111/j.1745-3992.2005.00006.x) — meta-analysis across decades: moving from 4/5 options to **3** has little average cost to discrimination/reliability when ineffective distractors are deleted; more 3-option items can be administered per testing time → better content coverage. Randomly deleting options (vs deleting non-functioning ones) hurts more — craft quality matters.

**Applied (HYPOTHESIS):** MindCraft should **not** brand “ACT-style four choices” as pedagogy science for Practice/diagnostic. Prefer **2–3 functioning diagnostic distractors**. Keep four only when a fourth maps a *distinct* misconception with evidence of function. Gap-scan time budget favors fewer, sharper options (SAFE-ELL load; SAFE-ATTN).

**Kill:** Four-option costume as quality signal.  
**Survive:** Functioning-count QA; retire dead options; option N as craft consequence, not brand.

**Wound:** High-stakes ACT still uses four options — Practice may *simulate* exam format on prove-rail while diagnostic/learn rails optimize for functioning diagnostic options. Label the dual-rail (SAFE-EXAM / SAFE-DDSCHED).

---

## CXXIV.5 Distractor science is its own craft — not a stem afterthought

**FACT (comprehensive review):** Gierl, Bulut, Guo, & Zhang (2017, *Review of Educational Research, 87*(6), 1082–1116, doi:10.3102/0034654317726529) — distractor *development, analysis, and use* is under-attended relative to stem writing; quality work includes CTT/IRT distractor analysis **and** cognitive-diagnostic uses; recommendations emphasize misconception-based development, analysis of choice frequencies / discrimination, and caution that automatic generation needs evaluation — distractors are instructional information, not leftover wrongs.

**Applied (FOUNDER BELIEF → testable):** Bank OKRs should track **% options with mis_ (or slip/FormatId) seal** and **% functioning on first live cohort**, not items authored. GENQ prompts must allocate tokens to distractor intent equal to stem (SAFE-EXPLAINQA spirit for options).

**Kill:** Stem-first LLM fill; item-count NS (SAFE-COVER).  
**Survive:** Distractor analysis dashboards for bank ops; rewrite loops for dead options.

---

## CXXIV.6 Diagnostic questions — wrong pick reveals the theory

**FACT (Eedi / NeurIPS diagnostic definition):** Wang et al. (2020, arXiv:2007.12061; NeurIPS 2020 Education Challenge guide) — a **diagnostic question** is a four-answer MC with exactly one correct option where **each incorrect answer is chosen to highlight a common misconception**; student choice reveals nature of the misconception for remediation; writing good diagnostic questions is hard even for experienced teachers; crowd-sourced banks show quality variation; platform data (Eedi) supports large-scale response analysis.

**FACT (product practice, secondary):** Eedi’s public materials describe tagging each distractor to a misconception and using choice data for teacher planning — aligned with the diagnostic definition above (treat as industry corroboration, not peer-reviewed causal proof).

**Reuse (SAFE-MISCON / SAFE-TAXON):** Soft-wrong springboard + typed mark; slip ≠ bug; categorical routing beats correctness-only (Arieli-Attali & Liu via CXXII).

**Applied (HYPOTHESIS):** MindCraft soft-wrong MC contract: **chosen distractor → mark type bug/misconception (or slip trap if so tagged) → coach contrast → route**. Untyped options may fire only as “untyped bug” + SE, never invent disease labels. Blank / abandon remain non-option events (SAFE-RETRIEVE).

**Kill:** Unmapped MC as “diagnostic.”  
**Survive:** Option→mis_ graph edges; tutor briefs show *which theory* Maya enacted.

---

## CXXIV.7 Ordered options — progression grain without Partial Credit Score™

**FACT (OMC):** Briggs, Alonzo, Schwab, & Wilson (2006, *Educational Assessment, 11*(1), 33–63, doi:10.1207/s15326977ea1101_2) — Ordered Multiple-Choice links each option to a **developmental level** in a learning progression; aims for diagnostic utility of open responses with MC efficiency; interpretation targets *why* the less-correct choice was selected, not only right/wrong.

**Applied (HYPOTHESIS):** For some MindCraft concepts with clear progressions (e.g., equation-solving joins), OMC-style ordered distractors can inform fade stage / scaffold grain (SAFE-FADE / SAFE-EXPTIME) **internally**. Do not surface “Level 2 of 4” as student Partial Credit / Identity Score™ (SAFE-TAXON kill).

**Kill:** Ordered options ≡ visible progress ladder NS.  
**Survive:** Private progression tags → scaffold dose; student sees destaked next move.

**Wound:** OMC validity depends on a defended learning progression — do not fake order on ACT distractors that are *nominal* misconception siblings (SAFE-TAXON categorical preference).

---

## CXXIV.8 Product surface — SAFE-DISTRACTOR claim contract

| Surface | Ship | Banned substitute |
|---------|------|-------------------|
| Authoring | Error-family → options → key verify | Stem → random wrongs |
| Option metadata | `misconception_id` / slip / FormatId trap / untyped-bug | Bare “incorrect” |
| Soft-wrong | Destake + type from *chosen* option + CTA | Red X only; Miss Streak |
| Option count | 3 default; 4 only if fourth functions | Always-four costume |
| Bank QA | Functioning analysis; dead-option rewrite | Ship-and-forget |
| GENQ | Distractor seal in verify gate | Fluency-only pass |
| Metrics | type→route hit; functioning %; `retry_120s`; `solo_transfer_pass` | Distractor Score™ / option-count |
| Parent/tutor | “Picked equal-sign join trap” grain | Live option stalk / % wrong |

**Competitive foil:** Khan/Duo = binary or XP. Exam prep = four-option costume. ChatGPT = fluent unkeyed options. Eedi-class = diagnostic distractors. MindCraft = **diagnostic distractors + soft-wrong climate + Map route + FEI prove** — not Eedi clone, not option theater.

---

## CXXIV.9 Doctrine — SAFE-DISTRACTOR (provisional)

1. **Misconception first** — write options from error families; stems serve diagnosis, not the reverse.  
2. **Every wrong option has intent** — mis_ / slip / FormatId trap / explicit untyped-bug — never naked incorrect.  
3. **Function over fashion** — retire <5% / positively discriminating dead options; prefer ~3 total options when that is the functioning set (Tarrant; Rodriguez).  
4. **Soft-wrong wraps the pick** — climate destakes; taxonomy + route carry semantics (SAFE-TAXON).  
5. **No Distractor Score™ / option-count NS** — bank health = seal rate + functioning % + route/transfer.  
6. **GENQ equals craft** — generated distractors need the same seals as human ones (SAFE-GENQ); fluency≠keyed diagnosis.  
7. **Dual-rail honesty** — prove-rail may match ACT four-option *format*; learn/diagnostic rails optimize functioning diagnostic options — label which rail.  
8. **OMC grain is private** — ordered levels may drive scaffolds; never student Partial Credit ladders.  
9. **Copy:** “Wrong answers that teach — each option is a theory we can route.” Never “more choices = smarter test.”

**Confidence:** High — Haladyna et al. guidelines; Tarrant functioning scarcity; Rodriguez 3-option meta-analysis; Gierl et al. distractor review; Wang et al. diagnostic-question definition; Briggs et al. OMC. Medium — MindCraft auto-seal accuracy and live functioning rates (needs DISTRACTOR-*). High — beauty traps / option-count theater / unmapped “diagnostic” MC as commercially toxic under FEI + Map honesty.

---

## CXXIV.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| DISTRACTOR-1 | Misconception-mapped 3-option vs unmapped 4-option | A/B within concept | type→route hit; `retry_120s`; `solo_transfer_pass` |
| DISTRACTOR-2 | Retire dead options vs keep four-option costume | Offline item analysis + A/B | Functioning %; discrimination; abandon |
| DISTRACTOR-3 | GENQ with distractor-seal gate vs fluency-only | Bank ops | Seal rate; false mis_ rate; drop rate |
| DISTRACTOR-4 | Soft-wrong copy naming chosen theory vs generic “not quite” | A/B | `retry_120s`; uptake (SAFE-FBLIT) |
| DISTRACTOR-5 | Parent/tutor CBC: grain-from-option vs % wrong / option stalk | CBC | WTP; trust; shame (SAFE-WTP/SOFTMSG) |
| DISTRACTOR-QUAL | 10 students + 5 tutors: which wrong options felt “tricky fair” vs “gotcha”? | Qual | DISTRACTOR codebook |

**Falsifier:** Unmapped 4-option matches mapped 3-option on route + transfer → keep private seals; still ban beauty traps and Distractor Score™.  
**Falsifier:** Always-four raises exam comfort without hurting transfer → segregate prove-rail format; do not redefine learn-rail craft.  
**Falsifier:** Fluency-only GENQ equals sealed on false-mis rate → still require key+seal (SAFE-GENQ / LABMETA).  
**Pre-register:** DISTRACTOR-* before “diagnostic MC / AI distractors” ads.  
**Family note:** DISTRACTOR-* densifies TAXON/MISCON/GENQ; do not collapse into Option Count OKRs or Soft-Wrong Score™.

---

## CXXIV.11 So what for MindCraft commercially

- **Copy:** “Wrong answers that teach — each option is a theory we can route.” Lead with diagnostic distractors + soft-wrong, not “thousands of MCQs” or four-choice costume.  
- **Product:** Require option→mis_ (or typed trap) metadata; default to functioning 3-option diagnostic items; dual-rail ACT format only where labeled; wire chosen option into SAFE-TAXON mark + Map route.  
- **Positioning:** Against binary apps, option-count theater, and ChatGPT unkeyed fluency; beside Eedi-class diagnosis, ahead on identity climate + FEI prove + ontology route.  
- **Metric:** distractor seal %, functioning %, type→route hit, `retry_120s`, `solo_transfer_pass` — demote Distractor Score™ / item-count.  
- **Kill list:** Beauty traps; always-four cosplay; unmapped “diagnostic”; Distractor Score™; GENQ without seals; ACT guarantees from distractor UI.  
- **Growth:** Trust packets show distractor→misconception map + verify loop — procurement asset vs black-box banks.  
- **Vision:** Thirty-year identity company treats every wrong pick as **structured evidence of a theory in use** — so Maya learns to revise theories, not to fear multiple choice.

---

## References (verified)

- Briggs, D. C., Alonzo, A. C., Schwab, C., & Wilson, M. (2006). Diagnostic assessment with ordered multiple-choice items. *Educational Assessment, 11*(1), 33–63. https://doi.org/10.1207/s15326977ea1101_2  
- Gierl, M. J., Bulut, O., Guo, Q., & Zhang, X. (2017). Developing, analyzing, and using distractors for multiple-choice tests in education: A comprehensive review. *Review of Educational Research, 87*(6), 1082–1116. https://doi.org/10.3102/0034654317726529  
- Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). A review of multiple-choice item-writing guidelines for classroom assessment. *Applied Measurement in Education, 15*(3), 309–334. https://doi.org/10.1207/S15324818AME1503_5  
- Rodriguez, M. C. (2005). Three options are optimal for multiple-choice items: A meta-analysis of 80 years of research. *Educational Measurement: Issues and Practice, 24*(2), 3–13. https://doi.org/10.1111/j.1745-3992.2005.00006.x  
- Tarrant, M., Ware, J., & Mohammed, A. M. (2009). An assessment of functioning and non-functioning distractors in multiple-choice questions: A descriptive analysis. *BMC Medical Education, 9*, 40. https://doi.org/10.1186/1472-6920-9-40  
- Wang, Z., Lamb, A., Saveliev, E., Cameron, P., Zaykov, Y., Hernández-Lobato, J. M., Turner, R. E., Baraniuk, R. G., Barton, C., Peyton Jones, S., Woodhead, S., & Zhang, C. (2020). Instructions and guide for diagnostic questions: The NeurIPS 2020 Education Challenge. *arXiv:2007.12061*. https://arxiv.org/abs/2007.12061  
