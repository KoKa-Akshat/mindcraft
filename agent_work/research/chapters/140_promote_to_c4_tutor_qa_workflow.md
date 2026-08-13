# Part CXL — Promote-to-C4 Tutor QA Workflow for Practice-Only FormatId

**Chapter status:** Living evidence + bank/ops QA brief — Researcher tick 2026-08-13 (UTC hour 18 ≡ Red Team slot, but ch140 never written → prefer Researcher per rotation; researcher count since synthesizer v1.17 = 6 → Researcher)  
**Primary question:** When a FormatId item is sealed for **Reveal-Practice** but not yet **C4 hide-correctness**, what **tutor/SME QA workflow** must flip `hcelig_pass` — without play-count auto-promote, thumbs-up theater, fluency soft-pass, or Promote Score™ vanity — so Map writes stay defensible while Practice stock still grows?  
**Owners:** Product (pools / admin tickets) · Engine (eligibility flags) · HITL / tutor ops · GENQ / FIGKEY / REPAIR · COVER / Brand · Red Team  
**Commercial job:** Ship **SAFE-PROMOTE** densifying SAFE-SPLITPOOL × SAFE-REPAIR × SAFE-FIGKEY × SAFE-HCELIG × SAFE-COVER × content-review science: **ticketed, checklisted, logged promotion** — never engagement flips, never silent dual-use, never “N plays clean ⇒ diagnose.”

**Builds on:** Parts CXXXVII (SAFE-SPLITPOOL — foreshadows ticketed promote), CXXXIV (SAFE-HCELIG), CXXXI (SAFE-FIGKEY), LX (SAFE-REPAIR), LXXII (SAFE-GENQ), LXVIII (SAFE-HITL), LXXXVII (SAFE-COVER), CXXXVIII (SAFE-SCANCOMP), CXXXIX (SAFE-HOLETRUST). Seams: promote ticket UI, `hcelig_pass` write with reviewer id, demote-on-repair, Practice-only vs C4 coverage tables, parent hole fill ETA honesty.

---

## CXL.1 Why this chapter exists

SAFE-SPLITPOOL ordered **split pools** and named promote-to-C4 as a workflow, not a folder rename. SAFE-HOLETRUST told parents holes fill via **company seal work**, not shame. The ops gap remains:

1. **Play-count flip** — “≥50 Practice attempts, zero tickets ⇒ `hcelig_pass`.”  
2. **Thumbs-up promote** — student/tutor “looks fine” as sole human gate.  
3. **Fluency soft-pass** — pretty SVG / LLM judge / “traps mapped” overrides wrong geometry.  
4. **Idle backlog** — Practice-only stock piles; C4 holes never shrink; honesty becomes permanent apology.  
5. **Promote Score™ / QA Minutes NS** — vanity that rewards throughput over seal fidelity.  
6. **Ticketed promote with seals + human checklist (this chapter)** — REPAIR evidence, FIGKEY/GENQ re-verify, SME congruence, logged reviewer, demote faster than promote.

Without SAFE-PROMOTE, split pools decay into either forever-Practice (coverage theater forever) or silent auto-admit (Map poison). Commercially: parents who bought labeled holes deserve a **real fill path**; tutors who flag broken figures deserve a **queue that changes eligibility**, not a Discord shrug.

**FOUNDER BELIEF under audit:** Near-peer tutors can run a **bounded promote checklist** (not PhD psychometrics theater) when the checklist is seal-first, item-model constrained, and demote-on-repair is automatic — and that workflow is the only honest answer to “when do diagram holes close?”

**Claims we refuse:**
1. Auto-promote from play counts, clean-streak, or engagement velocity.  
2. Thumbs-up / “feels ACT-ready” as sole human promote gate.  
3. Soft-pass wrong figure because distractors were trap-mapped or render looked fluent.  
4. Promote Score™ / QA Minutes / Promotion Throughput % as North Star.  
5. Silent `hcelig_pass` flip without reviewer id + checklist log.  
6. Padding C4 from Practice-only stock while tickets are open or seals stale.  
7. ACT / identity / “complete visual diagnostic” guarantees from promote packaging.

---

## CXL.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Practice-only sealed** | GENQ (+ FIGKEY) pass; reveal + REPAIR; no Map diagnostic write | `practice_eligible && !hcelig_pass` | Treated as C4 |
| **Promote ticket** | Named work item to upgrade use ambition | Admin/tutor queue card | Chat vibe / play-count job |
| **Seal re-verify** | Re-run GENQ/FIGKEY/FORMTRAP gates at promote time | Checklist hard fails | Stale seal from generation day |
| **SME congruence** | Human judges item↔FormatId↔concept use | Tutor/SME promote panel | Beauty / “would teach with this” only |
| **Logged admit** | `hcelig_pass` + reviewer id + timestamp + checklist hash | Audit trail | Silent bit flip |
| **Demote-on-repair** | Critical ticket removes C4 immediately | Auto yank | Leave in gap-scan while broken |
| **SAFE-PROMOTE** | Ticketed Practice→C4 QA doctrine | This chapter | Promote Score™ |

**Operational definition (HYPOTHESIS):** A Practice-only FormatId item may be **promoted to C4** iff (1) GENQ text/key seals still pass, (2) FIGKEY passes when a figure is required, (3) FORMTRAP seals exist for visual options when applicable, (4) **zero open critical REPAIR tickets**, (5) a trained reviewer completes a **fixed checklist** (stem–figure–key joint truth; FormatId structural necessity; accessibility/alt path; no beauty-trap options), (6) optional second rater or CVR-style “essential for C4 use” mark when ambition is parent-facing diagnosis, (7) `hcelig_pass` write is **logged** with reviewer id — never engagement thresholds alone — and (8) any later critical repair **demotes** before the next gap-scan draw.

---

## CXL.3 Uses scale; promotion is a validity event

**FACT:** Kane (2013, *Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000) — validate **interpretations and uses**; more ambitious claims need more backing; rejecting a use need not kill a weaker interpretation.

**FACT:** AERA, APA, & NCME (2014, *Standards for Educational and Psychological Testing*) — validity is evidence for score interpretations **for proposed uses**; each intended use needs relevant evidence.

**Applied (HYPOTHESIS):** Reveal-Practice is a **lower-ambition use** (learning + repair). C4→Map→parent “we diagnosed diagram on X” is **higher ambition**. Promotion is not “we liked the item more.” It is an explicit decision that the item now authorizes the stricter use. Auto-promote from Practice volume confuses popularity with use validity.

**Kill:** Play-count ≡ readiness for hide-correctness.  
**Survive:** Separate IUAs; promote as a logged use-upgrade.

---

## CXL.4 Content QA is expert review + procedure — not vibes

**FACT:** Downing (2006, in Downing & Haladyna, *Handbook of Test Development*, pp. 3–25) — effective test development is a systematic multi-step process; item creation and review are distinct procedures that build validity evidence for intended interpretations — not ad-hoc shipping.

**FACT:** Haladyna, Downing, & Rodriguez (2002, *Applied Measurement in Education, 15*(3), 309–333, doi:10.1207/S15324818AME1503_5) — validated taxonomy of MC item-writing guidelines (content, format, style, stem, choices); content concerns and choice quality are reviewable, not “feels fine.”

**FACT:** Sireci (1998, *Social Indicators Research, 45*(1–3), 83–117, doi:10.1023/A:1006985528729) — content representation remains fundamental; expert judgment of relevance/representation is a core content-validity practice even under unitary validity language.

**FACT:** Lawshe (1975, *Personnel Psychology, 28*(4), 563–575, doi:10.1111/j.1744-6570.1975.tb01393.x) — Content Validity Ratio aggregates SME “essential / useful / not necessary” judgments; consensus among experts is quantifiable — **transfer limit:** employment testing origin; MindCraft borrows the *panel judgment* idea for “essential for C4 diagnostic use,” not job-analysis theater or CVR-as-marketing badge.

**Applied (HYPOTHESIS):** Promote checklist = Downing-style review step + Haladyna content/choice gates + optional Lawshe-style essential-for-C4 mark. Thumbs-up without checklist is not SME review. CVR Score™ splash is banned; a logged essential bit for high-ambition admits is allowed.

**Kill:** Beauty panel / Discord emoji promote.  
**Survive:** Fixed checklist + optional essential-for-C4 consensus for parent-facing diagnostic stock.

---

## CXL.5 AIG review audits the generation procedure — and re-checks at promote

**Reuse (SAFE-FIGKEY / SAFE-GENQ):** Gierl & Lai (2012; 2016) line — item models constrain features; review content/logic in the **procedure**, not eyeball-thousands as the QA unit.

**Applied (HYPOTHESIS):** Generation-day `figkey_pass` is necessary but not sufficient at promote time. Figures drift (asset swaps, trap edits, stem wording). Promote re-runs deterministic seals. LLM-as-judge-alone remains banned (SAFE-FIGKEY / SAFE-EXPLAINQA).

**Kill:** “Already verified once at gen” forever admit.  
**Survive:** Re-verify at promote; demote if seals fail later.

---

## CXL.6 Repair is evidence — absence of tickets is not proof at low volume

**Reuse (SAFE-REPAIR / SAFE-COVER):** Reveal Practice exists so broken figures surface. Critical open tickets **block** promote. But low Practice volume with zero tickets ≠ “proven safe” — coverage honesty still labels holes (SAFE-SCANCOMP / SAFE-HOLETRUST).

**HYPOTHESIS:** Ticket absence is a **necessary** promote gate, not a **sufficient** one. Promote still requires seal re-verify + human checklist. Parent fill copy may say “verifying more diagram items” with known-finite ETA bands when backlog is real (SAFE-KNOWNETA), never “coming soon” fog or play-count progress bars as trust theater.

**Kill:** “No complaints ⇒ C4.”  
**Survive:** No-critical-tickets ∧ seals ∧ checklist.

---

## CXL.7 HITL tutors run the queue — experts escalate hard cases

**Reuse (SAFE-HITL / SAFE-TUTORGRAIN):** Near-peer tutors own Map-brief fidelity, not PhD item-writing credentials as brand. Promote QA is a **packetized ops skill**: checklist training, sample audit, escalate geometry disputes to SME/engine.

**HYPOTHESIS:** Default promote rater = trained tutor/content ops under HITL playbook; second rater or SME required when (a) figure IR is ambiguous, (b) parent-facing diagnosis ambition, or (c) prior demote on the item. Tutor time on promote counts as bank quality work — not “hours booked” NS (SAFE-WORKFORCE / SAFE-ROI).

**Kill:** Ivy≡promote authority; Discord-peer≡item review.  
**Survive:** Trained checklist + escalate packets.

---

## CXL.8 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Uses scale; higher ambition needs more evidence | FACT | High | Kane 2013; Standards 2014 |
| Systematic item review is a test-development step | FACT | High | Downing 2006 |
| MC content/choice guidelines are reviewable criteria | FACT | High | Haladyna et al. 2002 |
| Expert judgment of content relevance/representation matters | FACT | High | Sireci 1998 |
| SME essentialness can be aggregated (CVR) | FACT | High | Lawshe 1975; transfer limits apply |
| Ticketed checklist promote beats play-count auto-admit | HYPOTHESIS | Medium–High | Densifies SPLITPOOL × REPAIR × FIGKEY |
| Zero tickets at low volume proves C4 safety | SPECULATION | Low | Refuse |
| Thumbs-up ≡ SME content review | SPECULATION | Low | Refuse |
| Parents accept slower C4 fill if promote is real and holes stay labeled | FOUNDER BELIEF | Medium | Needs PROMOTE-* × HOLETRUST |

---

## CXL.9 Product surface — SAFE-PROMOTE claim contract

1. **Promote ticket** required to set `hcelig_pass` (no silent admin bit without ticket id).  
2. Hard gates: GENQ + FIGKEY (if figured) + FORMTRAP (if visual options) **re-verify at promote**.  
3. Hard gate: **zero open critical REPAIR** on the item.  
4. Checklist required fields: stem–figure–key joint; FormatId necessity; alt/accessibility; trap sanity; “essential for C4?” (yes/no).  
5. Log: reviewer id, second-rater if required, checklist hash, seal versions, promote timestamp.  
6. **Demote-on-repair:** critical ticket clears `hcelig_pass` before next C4 draw; Practice-reveal may remain if policy allows.  
7. Coverage UI: Practice-only vs C4 stock separate; promote backlog visible to ops, not as student Promote Score™.  
8. Parent fill CTA: links to sealed Practice and/or “verifying for diagnosis” with known-finite ETA when known — never play-count progress as mastery.  
9. Telemetry: promote/demote events, post-promote repair rate, illicit Map writes — demote Promote Score™ / QA Minutes NS.  
10. Copy: “We hide the key only after a sealed review — practice can start earlier.”

---

## CXL.10 Doctrine — SAFE-PROMOTE (provisional)

1. **Promotion is a use-upgrade**, not a popularity contest (Kane).  
2. **Ticket + checklist + seals** — never play-count / thumbs-only.  
3. **Re-verify at promote** — generation-day pass can go stale.  
4. **No critical REPAIR open** — necessary, not sufficient.  
5. **Demote faster than promote** — Map integrity > hole optics.  
6. **HITL-trained raters**; escalate hard geometry — no Ivy costume, no Discord≡panel.  
7. **Honest dual coverage** — Practice stock ≠ C4 stock (COVER / SPLITPOOL).  
8. **No Promote Score™ / QA Minutes / Promotion Throughput % NS**.  
9. **No ACT / complete-visual guarantees** from promote packaging.  
10. Copy: “Practice lights on first; diagnosis after the stricter seal.”

**Confidence:** High on Kane/Standards/Downing/Haladyna/Sireci/Lawshe as method sources (with Lawshe transfer limits). Medium on exact checklist length, second-rater thresholds, and promote SLA vs hole ETA copy (needs PROMOTE-*). High that play-count auto-promote is commercially toxic (Map distrust + HOLETRUST betrayal).

---

## CXL.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| PROMOTE-1 | Ticketed checklist vs play-count auto-promote | Ops A/B | Post-promote critical repair rate; false C4 admits |
| PROMOTE-2 | Re-verify-at-promote vs trust generation-day seals only | Engine A/B | Stale-seal catch rate; promote latency |
| PROMOTE-3 | Single trained tutor vs dual-rater for figured C4 admits | Ops A/B | Disagree rate; post-promote repair; cost/min |
| PROMOTE-4 | Demote-on-repair latency SLA (immediate vs daily batch) | Engine A/B | Illicit C4 draws on broken items; Map↔tutor gold |
| PROMOTE-5 | Parent CBC: “verified for diagnosis” ETA honesty vs play-count fill bar | CBC | WTP; trust; abandon (× HOLETRUST) |
| PROMOTE-QUAL | Planted wrong-slope figure with zero tickets at low volume: does checklist catch before C4? | Qual | Promote codebook |

**Falsifiers:** Auto-promote equals ticketed on post-promote repairs *and* Map↔tutor gold → still prefer ticketed for liability/audit; do not celebrate engagement. Dual-rater never disagrees and never catches extras → drop mandatory second rater for low ambition; keep for parent-facing diagnosis. Re-verify finds ~0 stale fails for 90 days → narrow re-verify to figure-touched edits only. Pre-register PROMOTE-* before “AI grows our diagnostic bank automatically” campaigns.

---

## CXL.12 So what for MindCraft commercially

- **Copy:** “We practice on sealed figures before we hide the key.” Parent: “Diagram diagnosis opens only after a stricter review — holes stay labeled until then.”  
- **Product:** Promote ticket UI; checklist; logged `hcelig_pass`; demote-on-repair; dual coverage tables.  
- **Growth:** Sell the fill path as **ops integrity**, not coverage theater; CBC honesty vs play-count progress bars.  
- **Positioning:** Against ChatGPT one-blob “practice=diagnose” fluency *and* against edtech that flips hide-correctness from engagement metrics.  
- **Metric:** post-promote repair rate; demote latency; illicit C4 draws — demote Promote Score™.  
- **Kill list:** Play-count flip; thumbs-only; fluency soft-pass; silent bit flips; Promote Score™; ACT/complete-visual guarantees from promote packaging.  
- **Vision:** Maya’s Map only learns from probes a named reviewer would defend — while her Practice gym can still grow FormatId skill with the lights on, and her parent sees holes shrink for real reasons.

---

## References (verified)

- American Educational Research Association, American Psychological Association, & National Council on Measurement in Education. (2014). *Standards for educational and psychological testing*. AERA.  
- Downing, S. M. (2006). Twelve steps for effective test development. In S. M. Downing & T. M. Haladyna (Eds.), *Handbook of test development* (pp. 3–25). Lawrence Erlbaum Associates.  
- Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). A review of multiple-choice item-writing guidelines for classroom assessment. *Applied Measurement in Education, 15*(3), 309–333. https://doi.org/10.1207/S15324818AME1503_5  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Lawshe, C. H. (1975). A quantitative approach to content validity. *Personnel Psychology, 28*(4), 563–575. https://doi.org/10.1111/j.1744-6570.1975.tb01393.x  
- Sireci, S. G. (1998). The construct of content validity. *Social Indicators Research, 45*(1–3), 83–117. https://doi.org/10.1023/A:1006985528729  
