# Part CXXXVII — Reveal-Practice vs C4 Split Pools for Sealed FormatId

**Chapter status:** Living evidence + bank/pool architecture brief — Researcher tick 2026-08-13 (UTC hour 09; hour%6≠0; researcher count since synthesizer v1.17 = 3 → Researcher)  
**Primary question:** Once a FormatId item is sealed enough for **reveal Practice + SAFE-REPAIR**, must MindCraft keep it in a **separate pool** from **C4 hide-correctness** (Map/FEI writes) — and how do we prevent silent dual-use, silent promotion, or “one bank = all uses”?  
**Owners:** Product (Practice / gap-scan pools) · Engine (eligibility flags / event sources) · Trust / REPAIR · Brand / COVER · Red Team  
**Commercial job:** Ship **SAFE-SPLITPOOL** densifying SAFE-HCELIG × SAFE-REPAIR × SAFE-GENQ × SAFE-COVER × Kane/Standards graded uses: **explicit split pools by use ambition** — never unified “in bank ⇒ diagnose,” never silent Map writes from Practice-only sealed items, never SplitPool Score™.

**Builds on:** Parts CXXXIV (SAFE-HCELIG — foreshadows Practice-eligible / C4-ineligible tier), LX (SAFE-REPAIR), LXXII (SAFE-GENQ), LXXXI (SAFE-COLD), LXXXII (SAFE-FORMAT), LXXXVII (SAFE-COVER), CXXXI (SAFE-FIGKEY). Seams: `practice_eligible`, `hcelig_pass`, pool selectors, `/record-outcomes` source tags, repair tickets → promote-to-C4 workflow.

---

## CXXXVII.1 Why this chapter exists

SAFE-HCELIG answered *whether* a FormatId item may enter hide-correctness: C4 is the strictest use; seals first; honest holes beat fake coverage. It left the **pool architecture** underspecified. Product temptation after seals:

1. **Unified pool** — one `questionBank` filter; any sealed item may land in Practice *or* gap-scan.  
2. **Silent dual-write** — Practice attempt with reveal still POSTs the same mastery/Map path as C4.  
3. **Auto-promote** — “enough Practice plays without repair tickets ⇒ flip `hcelig_pass`.”  
4. **Split pools (this chapter)** — Practice-reveal pool ⊆ sealed stock; C4 pool ⊆ HCELIG-pass stock; promotion is a *named* workflow with REPAIR evidence, not a folder rename.

Unified pools feel efficient. They collapse Kane’s point that **uses** are what get validated — not folders of items. Reveal Practice can surface “this graph looks broken” (REPAIR path). C4 cannot. Mixing them without flags teaches the Map from the wrong use ambition.

**FOUNDER BELIEF under audit:** FormatId Practice can grow *before* FormatId diagnosis is dense — but only if the company refuses to pretend Practice evidence is hide-correctness evidence.

**Claims we refuse:**
1. “In bank / sealed” ≡ eligible for both Practice reveal and C4 Map writes.  
2. Silent dual-write of Practice outcomes into diagnostic Map/FEI paths.  
3. Auto-promote to C4 from engagement counts or thumbs-up.  
4. SplitPool Score™ / Dual-Use Minutes / Pool-Separation % as North Star.  
5. Padding gap-scan with Practice-only sealed visuals to avoid holes.  
6. ACT / identity guarantees from “we practice and diagnose on the same FormatId bank.”

---

## CXXXVII.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Reveal Practice** | Attempt → outcome → key/feedback visible; REPAIR possible | Practice gym FormatId hop | Treated as C4 |
| **C4 hide-correctness** | Record outcome; withhold key; Map/FEI may update | Gap-scan / cold probes | Poison from unsealed or Practice-grade items |
| **Split pools** | Disjoint (or nested) selectors by *use* | `pool=practice_reveal` vs `pool=c4_hcelig` | One selector, two labels |
| **Promote-to-C4** | Explicit seal upgrade with evidence | Ticketed workflow: FIGKEY+HCELIG review | Auto-flip from play count |
| **Use ambition** | Kane: what decision the score authorizes | Route / parent copy / FEI | Browsing ≡ diagnosis |
| **SAFE-SPLITPOOL** | Pool doctrine for graded FormatId uses | This chapter | SplitPool Score™ |

**Operational definition (HYPOTHESIS):** A sealed FormatId item may sit in the **Reveal-Practice pool** when GENQ (+ FIGKEY if figured) pass and REPAIR telemetry is wired — *without* `hcelig_pass`. It may enter the **C4 pool** only when HCELIG passes. Practice outcomes use source tags that **do not** authorize the same Map/FEI writes as C4. Promotion Practice→C4 requires a logged seal review, not engagement thresholds alone.

---

## CXXXVII.3 Uses are validated separately — not “the bank”

**FACT:** Kane (2013, *Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000) — validate **interpretations and uses**, not the test itself; more ambitious claims need more support; rejecting a use need not kill a weaker interpretation; validating an interpretation does not automatically validate a use.

**FACT:** AERA, APA, & NCME (2014, *Standards for Educational and Psychological Testing*) — validity is the degree to which evidence and theory support interpretations of scores **for proposed uses**; a measure may be justified for one purpose and not another; each intended use needs relevant evidence.

**Applied (HYPOTHESIS):** “Sealed FormatId stem renders correctly” can support a **low–medium ambition** use (Practice with reveal + repair) while failing a **high ambition** use (C4 → Map format gap → PawHub route → parent “we diagnosed”). Split pools are the product expression of separate IUAs.

**Kill:** One eligibility bit for all FormatId surfaces.  
**Survive:** Nested seals; C4 ⊂ Practice-eligible sealed set, never the reverse.

---

## CXXXVII.4 Formative vs “quiet high-stakes” is about use of the information

**FACT:** Black & Wiliam (1998, *Phi Delta Kappan, 80*(2), 139–148) — formative work means evidence is used to adapt teaching/learning; teachers face real tension reconciling formative and summative roles; confusion between roles impedes practice.

**FACT:** Wiliam (2000, *Critical Quarterly, 42*(1), 105–127; see also related essays on meanings/consequences of assessment) — strictly, “formative” names the **use** of information, not a mystical item type; the same instrument can serve different functions depending on what happens next.

**Applied (HYPOTHESIS):** Reveal Practice is formative *when* feedback + REPAIR + retry move learning. C4 is a **quiet high-stakes write** into the student’s Map even without showing a key — more like an interpretive/use decision than a learning conversation. Treating Practice-pool items as C4 “because we already sealed them” confuses Black/Wiliam’s roles inside one codebase.

**Kill:** “It’s the same question, so the same graph update.”  
**Survive:** Source-tagged outcomes; C4 writes only from C4 pool administrations.

---

## CXXXVII.5 Pool integrity is an ops problem, not a folder aesthetic

**FACT:** Way (1998, *Educational Measurement: Issues and Practice, 17*(4), 17–27, doi:10.1111/j.1745-3992.1998.tb00632.x) — computerized programs must actively protect item-pool integrity; exposure and pool-management strategies matter because continuous delivery changes compromise risk vs paper forms.

**Applied (HYPOTHESIS, careful transfer):** MindCraft is not selling high-stakes CAT security theater. The transferable lesson is narrower: **pools are managed objects with policies**, not a single dump of IDs. Separate Practice vs C4 pools (or hard flags with enforced selectors) reduce *use compromise* — the educational analogue of item compromise — where a Practice-seen, key-revealed stem later pretends to be a fresh hide-correctness probe, or a Practice-grade seal silently diagnoses.

**Kill:** Single unsorted FormatId list with runtime “maybe hide key.”  
**Survive:** Named pools + exposure rules (e.g., bar recently revealed stems from same-student C4 for a cool-down).

---

## CXXXVII.6 Repair is the bridge — not a silent flip

**Reuse (SAFE-REPAIR / SAFE-HCELIG):** Reveal Practice exists partly so students and tutors can flag broken figures. That signal is commercially precious: it is how Practice-grade stock earns (or fails) promotion.

**HYPOTHESIS:** Promote-to-C4 requires (a) GENQ+FIGKEY+FORMTRAP seals, (b) zero open critical repair tickets on that item, (c) optional tutor/SME checklist, (d) explicit `hcelig_pass` write with reviewer id — never “N plays without complaint ⇒ eligible.” Absence of tickets ≠ proof when volume is low (SAFE-COVER honesty).

**Kill:** Engagement-based auto-promotion.  
**Survive:** Ticketed promote workflow; demote-on-repair that *removes* from C4 immediately while leaving Practice-reveal if policy allows.

---

## CXXXVII.7 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Uses/interpretations are validated; ambition scales evidence | FACT | High | Kane 2013; Standards 2014 |
| Formative vs other roles is about use of information | FACT | High | Black & Wiliam 1998; Wiliam 2000 |
| Pool integrity requires active management policies | FACT | High | Way 1998 (transfer with caution) |
| Practice-reveal and C4 need split pools / hard use flags | HYPOTHESIS | Medium–High | Densifies HCELIG + REPAIR |
| Auto-promote from play counts is safe enough | SPECULATION | Low | Refuse |
| Unified sealed bank is fine if drop rate looks low | SPECULATION | Low | Refuse |
| Parents will accept honest FormatId holes if Practice still offers sealed visuals | FOUNDER BELIEF | Medium | Needs SPLITPOOL-* × COVER |

---

## CXXXVII.8 Product surface — SAFE-SPLITPOOL claim contract

1. Emit **`practice_eligible`** and **`hcelig_pass`** as distinct bits (HCELIG already requires the second).  
2. Gap-scan FormatId selector: **`hcelig_pass` only**.  
3. Practice FormatId hop: may use `practice_eligible && !hcelig_pass` stock **with reveal + REPAIR**.  
4. **Bar** silent Map/FEI diagnostic writes from Practice-pool administrations (source tag enforcement).  
5. Cool-down: stems revealed to a student barred from that student’s C4 for a policy window (anti-answer-hunt / exposure).  
6. Promote-to-C4: ticketed review; demote-on-repair removes C4 immediately.  
7. Coverage UI: show **Practice FormatId stock** vs **C4 FormatId stock** separately (SAFE-COVER).  
8. Telemetry: pool id, use flag, promote/demote events — demote SplitPool Score™ / Dual-Use Minutes.  
9. Copy: “We practice on sealed figures before we hide the key.” / Parent: “Diagnosis uses a stricter pool than practice.”

---

## CXXXVII.9 Doctrine — SAFE-SPLITPOOL (provisional)

1. **Use ≠ file** — sealed presence is not dual admission.  
2. **C4 pool ⊆ HCELIG**; Practice-reveal pool may be wider within GENQ/FIGKEY seals.  
3. **No silent dual-write** — outcome source tags enforce ambition.  
4. **Promote is a workflow** — not play-count theater (REPAIR × HCELIG).  
5. **Demote is faster than promote** — repair tickets yank C4 first.  
6. **Honest dual coverage tables** — Practice stock ≠ diagnostic stock (COVER).  
7. **No SplitPool Score™ / Dual-Use Minutes / Pool-Separation % NS**.  
8. **No ACT / identity guarantees** from unified-bank packaging.  
9. Copy: “Same stem, different job — until the stricter seal says otherwise.”

**Confidence:** High on Kane/Standards/Black–Wiliam/Wiliam as method sources; High on Way as pool-ops analogy with explicit transfer limits. Medium on cool-down lengths and exact promote checklists (needs SPLITPOOL-*). High that unified dual-use without flags is commercially toxic (Map distrust + coverage theater).

---

## CXXXVII.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| SPLITPOOL-1 | Split selectors vs unified sealed FormatId pool for C4 | Policy A/B | False-weakness rate; Map↔tutor gold |
| SPLITPOOL-2 | Practice-only sealed tier with REPAIR vs dual-bar (no Practice until HCELIG) | Product A/B | Format-hop volume; repair tickets; trust |
| SPLITPOOL-3 | Source-tag enforcement vs silent dual-write | Engine A/B | Illicit Map write rate; audit catch |
| SPLITPOOL-4 | Ticketed promote vs auto-promote after N clean plays | Ops A/B | Post-promote repair rate; false C4 admits |
| SPLITPOOL-5 | Parent CBC: separate Practice vs diagnostic FormatId counts vs single “N diagram items” | CBC | WTP; trust; abandon |
| SPLITPOOL-QUAL | Planted broken figure in Practice-only tier: does REPAIR catch before any C4 path? | Qual | Promote codebook |

**Falsifiers:** Split pools equal unified on false-weakness → audit selector bugs before collapsing pools. Dual-bar (no Practice until HCELIG) kills FormatId practice without trust gain → keep Practice-only tier. Auto-promote matches ticketed on post-promote repairs → still prefer ticketed for liability; do not celebrate engagement. Pre-register SPLITPOOL-* before “one FormatId bank for practice and diagnosis” campaigns.

---

## CXXXVII.11 So what for MindCraft commercially

- **Copy:** “We practice on sealed figures before we hide the key.” Parent: “Your child’s format diagnosis uses a stricter pool than everyday practice — we leave holes rather than guess.”  
- **Product:** Distinct pool selectors + source tags; promote/demote workflow; cool-down after reveal.  
- **Growth:** Sell honesty of dual coverage tables; kill “N diagram items” undifferentiated hero.  
- **Positioning:** Against ChatGPT one-blob “practice/diagnose” fluency *and* against edtech that hides keys on unverified or Practice-grade art.  
- **Metric:** `pool_id` / illicit Map-write rate / promote–demote events — demote SplitPool Score™.  
- **Kill list:** Unified dual-use; silent Map writes; auto-promote; coverage padding; SplitPool Score™; ACT guarantees from one-bank packaging.  
- **Vision:** Maya’s Map only learns from probes the company would defend in a parent review — while her Practice gym can still grow sealed FormatId skill with the lights on.

---

## References (verified)

- American Educational Research Association, American Psychological Association, & National Council on Measurement in Education. (2014). *Standards for educational and psychological testing*. AERA.  
- Black, P., & Wiliam, D. (1998). Inside the black box: Raising standards through classroom assessment. *Phi Delta Kappan, 80*(2), 139–148.  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Way, W. D. (1998). Protecting the integrity of computerized testing item pools. *Educational Measurement: Issues and Practice, 17*(4), 17–27. https://doi.org/10.1111/j.1745-3992.1998.tb00632.x  
- Wiliam, D. (2000). The meanings and consequences of educational assessments. *Critical Quarterly, 42*(1), 105–127. https://doi.org/10.1111/1467-8705.00280  
