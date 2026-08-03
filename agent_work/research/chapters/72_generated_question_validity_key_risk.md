# Part LXXII — Generated Question Validity & Key Risk

**Chapter status:** Living evidence + bank/ops brief — Researcher tick 2026-08-03  
**Primary question:** When may MindCraft *generate* practice/diagnostic items (LLM or template), and what validity / answer-key failure modes make generation a product hazard rather than a coverage moat?  
**Owners:** Engine (generation / verify) · Product (Practice / diagnostic bank) · Trust & Safety · Positioning vs “AI made infinite questions” competitors  
**Commercial job:** Ship a **SAFE-GENQ** doctrine: generation is a *coverage accelerator under a verify loop*, never a substitute for keyed truth; bad keys poison the mastery graph and identity evidence; sell *bank trust*, not item count.

---

## LXXII.1 Why this chapter exists

Parts XXXIII / LX / LXVII already kill fluent wrongness as tutoring, apology-as-repair, and chat-as-diagnosis. The remaining bank-specific hazard is quieter: **MindCraft’s own generation path can invent stems that look ACT-ready while shipping wrong keys.** Internal verify already dropped ~30% of a batch (104 kept / 45 dropped) — too high to scale into the live bank. Diagnostic hide-correctness (C4) and `/record-outcomes` make a wrong key *especially* dangerous: the product records “failure” against a false ground truth and rewrites Maya’s Map.

**FOUNDER BELIEF under audit:** Ontology-joined generation + deterministic key verify can fill uncovered concepts/formats faster than human authoring — *if and only if* shipping gates treat key validity as a hard fail, not a soft QA note.

**Claims we refuse as doctrine:**
1. LLM-generated items ≡ ready-to-ship practice without independent key verify.  
2. Item-count / coverage % as North Star or marketing hero.  
3. Unverified keys as diagnostic or mastery ground truth.  
4. “AI wrote a thousand questions” as trust or ACT readiness.  
5. Isomorphic clones / surface variants ≡ far transfer or exam readiness.  
6. Fluency of stem / explanation ≡ arithmetic or keyed correctness.  
7. Verify-off generation to “move fast” on identity or FEI claims.

---

## LXXII.2 Constructs (bank language)

| Construct | Research meaning | MindCraft analogue | Failure mode if misused |
|-----------|------------------|--------------------|-------------------------|
| **Automatic item generation (AIG)** | Model/template-driven item production with cognitive + psychometric intent | `ml/generation/` essence → LLM → format-tagged `Question` | Free-form LLM dump without item model |
| **Item model / template** | Spec of which features may vary | Layer-3 joins + essence prompts; C5 `Question` schema | Prompt-only “models” with no constrained slots |
| **Key / scoring inference** | Map observed response → scored outcome | `correctAnswer` / options; bank-key verify (AIT-6) | Wrong key → poisoned events |
| **Isomorph / clone** | Surface variants intended as psychometrically similar | Format/surface rewrites of a parent | Clone flood ≡ learning |
| **Verification / review loop** | Content+logic check before operational use | `--verify` pass; drop list; human spot-check | Soft “looks fine” gate |
| **Interpretation/use argument (IUA)** | Kane: validate *uses* of scores, not “the test” | Gap-scan / practice outcomes → Map / FEI claims | Ship items → claim identity without key evidence |
| **SAFE-GENQ** | Generation under verify doctrine | See LXXII.9 | Coverage theater |

**Operational definition (HYPOTHESIS):** A generated item is *shippable* only when (a) it matches C5 schema and ontology `conceptId`/`format`, (b) the keyed answer survives an independent check (symbolic/arithmetic and/or SME), (c) distractors are not merely fluent nonsense, (d) it is barred from hide-correctness diagnostic and mastery writes until (b) passes, and (e) batch drop rate is below an explicit gate (target \<~10% before scale; current ~30% = **do not scale**).

---

## LXXII.3 What classical AIG actually earned

**FACT (item models as AIG spine):** Gierl & Lai (2012, *International Journal of Testing*, 12(3), 273–298, doi:10.1080/15305058.2011.635830) — AIG is a two-step practice: specialists build *item models* (templates specifying manipulable features), then algorithms instantiate many items. Benefits include volume and potential parameter prediction — not “LLM fluency.”

**FACT (review process for generated items):** Gierl & Lai (2016, *Educational Measurement: Issues and Practice*, 35(4), 6–20, doi:10.1111/emip.12129) — generated items still need a structured review focused on the *content and logic in the generation procedure*, not vibes after the fact. Illustration domains include mathematics (CCSS-linked) and surgical education.

**FACT (quality vs traditional items — distractor wound):** Gierl, Lai & Turner (2012, *Medical Education*, 46(8), 757–765, doi:10.1111/j.1365-2923.2012.04289.x) and follow-on quality comparisons (e.g. Gierl et al., *Medical Education*, 2013/quality indicators line) — AIG items can approach traditional quality on many indicators; **distractors** are a recurring weak spot (implausible options more often than hand-authored items). Experts cannot reliably “eyeball which is AIG.”

**FACT (feasibility / Kane framing in medical AIG):** Reviews of AIG in medical assessment (e.g. Falcão et al., 2022, *Advances in Health Sciences Education*, doi:10.1007/s10459-022-10092-z) map validity work onto Kane-style inferences (scoring → generalization → extrapolation → implication). Scoring/construction clarity and psychometric spread can support use; **implication** (high-stakes decisions) is not free.

**Commercial implication:** MindCraft may borrow *strong-theory AIG discipline* (constrained models + review of the generator, not only the stem). It may **not** borrow “we generated thousands, therefore bank is valid.”

---

## LXXII.4 Validity is about *use* — Kane binds the bank

**FACT (argument-based validity):** Kane (2013, *Journal of Educational Measurement*, 50(1), 1–73, doi:10.1111/jedm.12000) — what is validated are *interpretations and uses* of scores, not the instrument as a fetish object. More ambitious claims need more evidence. Negative consequences can kill a *use* even if a thinner interpretation survives.

**Applied to MindCraft (HYPOTHESIS):**
| Use | Ambition | Key-risk if wrong |
|-----|----------|-------------------|
| Low-stakes practice with reveal + repair | Low–medium | Trust ding; recoverable via SAFE-REPAIR |
| Hide-correctness diagnostic → `/seed-assessment` / outcomes | High | Silent Map corruption; false weakness |
| Parent “diagnosis report” / FEI evidence | High | WTP and trust burn (SAFE-WTP / SAFE-REPAIR) |
| ACT-readiness or identity claims | L3+ (banned from L1 item A/Bs) | Claim-ladder violation (XXXIV) |

**Kill:** “Items exist in the bank” ≡ validated for diagnostic or identity use.  
**Survive:** Separate *coverage use* (practice under reveal) from *evidence use* (diagnostic / mastery writes) until key gates pass.

---

## LXXII.5 LLM generation is not classical AIG (key failure rates)

Classical AIG manipulates constrained slots inside an item model. LLM generation samples fluent text that *looks* like an item. That difference matters for keys.

**FACT (ungrounded GPT math error rates):** Bastani et al. (2025, *PNAS*, doi:10.1073/pnas.2422633122) — GPT Base correct only ~**51%** when repeatedly asked for answers on practice problems; logical errors ~42%, arithmetic ~8%; problem-specific heterogeneity. Students often fail to detect or refuse to check. Unguarded use ↑ concurrent practice then ↓ solo exam.

**FACT (classroom ChatGPT wrongness):** Primary-school robot/ChatGPT study (IEEE AIRC 2024, doi:10.1109/airc61399.2024.10672220) — LLM inaccurate on ~**13/29** curriculum maths prompts (~55% accuracy); students’ ability to spot errors tracked *their own* correctness — prior knowledge gates detection.

**FACT / REVIEW (LLM math learning concerns):** Findings-EMNLP analyses (e.g. “Three Questions…” 2023, doi:10.18653/v1/2023.findings-emnlp.201) — LLMs can mis-grade human work, invent wrong intermediates, and need tool/augmentation discipline; fluent rationale ≠ valid math.

**FACT (internal engineering audit):** MindCraft generation `--verify` pass retained 104 / dropped 45 (~**30%** bad-key rate). Lab standing order already: drop rate must fall before `--tested --formats all` scale and before `syncGeneratedQuestions` into the live bank.

**Kill:** Prompt-scale generation without verify as “coverage solution.”  
**Wound:** Treating Bastani’s *tutor* wrongness as identical to *item-authoring* wrongness — related mechanism (fluent false math), different product surface (bank key vs live chat).  
**Survive:** AIT-6 bank-key verify as load-bearing; generation inherits PWC — LLM is bookend, deterministic check is spine.

---

## LXXII.6 Clones, coverage, and the fake-mastery path

**FACT (isomorph intent vs clone pejorative):** AIG literature distinguishes isomorphs (psychometrically similar variants) from free variants (Gierl & Lai ITEMS module / Gierl & Haladyna AIG line; Bejar item-modeling tradition). Specialists often disparage shallow 1-layer “clones” as detectable and pedagogically thin.

**HYPOTHESIS (MindCraft):** Format-tagged generation that only swaps surface nouns while freezing the same arithmetic skeleton inflates `questionCount` without buying SAFE-TRANSFER / interleaving discrimination. Clone floods can also teach answer patterns rather than strategy selection.

**Ties:** SAFE-TRANSFER (story≠hop; blocked≠ready), SAFE-MISCON (distractors must be diagnostic), SAFE-ONTOLOGY (coverage fills holes; coverage ≠ product), SAFE-CALIB (hide-correctness only on keyed truth).

**Kill:** “1,500 questions” / “AI-generated bank” as the marketing hero metric.  
**Survive:** Publish *verify rate*, *key-fail taxonomy*, and *concepts still unverified* more loudly than raw count when talking to serious buyers.

---

## LXXII.7 Failure taxonomy (ops)

| Failure class | Example | Student harm | Graph harm | Gate |
|---------------|---------|--------------|------------|------|
| **Arithmetic key fail** | Stem OK; keyed option wrong | Learns false fact; trust burn | False miss/hit events | Hard fail |
| **Logical key fail** | Wrong method encoded as correct | Misconception installed | Bridge/concept mis-update | Hard fail |
| **Ambiguous stem** | Multiple defensibly correct | Frustration / “gotcha” affect | Noisy outcomes | Soft fail / rewrite |
| **Implausible distractors** | Options no Maya would choose | Easy gaming; shallow practice | Overconfident mastery | Soft fail |
| **Format lie** | Tagged `diagram` but text-only / unreadable | Format-axis diagnosis false | Format-gap severity wrong | Hard fail for format claims |
| **Ontology misjoin** | Wrong `conceptId` / ingredient | Wrong path / cards | Poisoned recommendations | Hard fail |
| **Clone-only batch** | N surface twins | Illusion of variety | Inflated exposure counts | Soft fail / cap |

**FOUNDER BELIEF:** Arithmetic/logical key fails are *product-stopping* for diagnostic and mastery writes; ambiguous/implausible are *batch-quality* issues that still block “science-backed bank” copy.

---

## LXXII.8 Positioning

| Competitor pattern | What they optimize | MindCraft GENQ counter |
|--------------------|--------------------|------------------------|
| “Infinite AI questions” | Volume / novelty | Verify gate; publish drop reasons |
| Unguarded ChatGPT homework | Fluency / speed | Bank keys + Map; no live key from chat |
| Static textbook banks | Stability | Generate only into holes; human/ACT seeds remain gold |
| Clone drill apps | Throughput | Cap isomorphs; measure delayed mix not count |

**Marketing that survives:** “Every practice key is checked before it can rewrite your Map.” / “We generate to fill holes — we ship only what survives verify.” / “Coverage without corrupted diagnosis.”

**Marketing that dies:** “AI-generated question bank” as hero; “unlimited unique ACT questions”; “our AI never gets the answer wrong”; using generation volume to imply exam readiness or identity change.

---

## LXXII.9 SAFE-GENQ stack (surviving doctrine)

1. **Verify-before-ship** — no live-bank sync without independent key check.  
2. **Key fails are hard fails** — arithmetic/logical wrongness blocks diagnostic + `/record-outcomes` paths.  
3. **IUA honesty (Kane)** — bank existence ≠ validated diagnostic/identity *use*.  
4. **LLM ≠ classical AIG** — constrain with essence/ontology joins; never prompt-and-pray.  
5. **Drop-rate gate** — do not scale while verify drop ≫ ~10%; current ~30% = pause scale.  
6. **Coverage ≠ North Star** — fill ontology holes; measure transfer / FEI, not `questionCount`.  
7. **Clone discipline** — isomorph caps; format tags must be true.  
8. **Repair continuity** — if a shipped key is later found wrong: SAFE-REPAIR + event quarantine playbook.  
9. **Ties:** SAFE-REPAIR, SAFE-ONTOLOGY, SAFE-CALIB (C4), SAFE-TRANSFER, SAFE-MISCON, PWC/AIT-6, SAFE-LABMETA (no cite-wash of “AI bank”).

---

## LXXII.10 Experiments (GENQ family)

| ID | Contrast | Primary endpoints | Kill / survive rule |
|----|----------|-------------------|---------------------|
| GENQ-1 | Verify-on vs verify-off generated items in *revealed* practice | Key-error rate spotted by students; `retry_120s`; trust items | Verify-off ≈ verify-on on trust → verify theater |
| GENQ-2 | Verified generated vs human/ACT-seed items (same concept/format) | Delayed mix / `solo_transfer_pass` | Generated ≪ seed → generation only for holes, not replacement |
| GENQ-3 | Diagnostic eligibility: verified-only vs mixed bank under C4 hide-correctness | Post-scan Map agreement with tutor gold; false-weakness rate | Mixed bank ↑ false weakness → keep diagnostic sealed |
| GENQ-4 | Prompt-hardened arithmetic vs baseline generator | Verify drop rate; residual fail taxonomy | Drop still ≥20% after harden → architecture change (tool-calc / template-first) |
| GENQ-5 | Parent CBC: “verified bank” attribute vs “AI-generated unlimited Qs” | Choice share; WTP | Unlimited-AI attribute wins → message work, not ship unverified |
| GENQ-QUAL | 10 tutor reviews of dropped vs kept items | Codebook: fail classes; SME disagreement rate | Feeds GENQ-4 prompt/tool design |

**Ties:** AIT-6, REPAIR-*, ONTO-*, CAL-*, TR-*, WTP-*, LABMETA-*.

---

## LXXII.11 Commercial implications

**Copy:** Lead with *checked keys* and *honest coverage*. Never lead with generation volume. Never imply generated ≡ ACT-official. Never claim diagnostic science on unverified items.

**Product:** Keep generated JSON inert until drop rate clears gate; seal C4 diagnostic + mastery writes to verified keys only; instrument key-fail reports from tutors; quarantine path when a live key is revoked.

**Growth:** District/parent trust packet (ties id 73) should show verify rates and refusal to ship bad keys — same posture as SAFE-PRIVACY honesty. Competitors selling infinite AI drills are the foil: *we refuse to poison the graph*.

**Vision:** Thirty-year identity product needs a bank Maya can *believe*. A single wrong key in a hide-correctness diagnostic teaches the company the wrong student. Generation remains a tool for holes under ontology joins — never the adjudicator of truth.

---

## LXXII.12 Confidence table

| Claim | Label | Confidence |
|-------|-------|------------|
| AIG rests on item models + algorithmic instantiation (Gierl & Lai 2012) | FACT | High |
| Generated items require procedure-focused review (Gierl & Lai 2016 EMIP) | FACT | High |
| AIG distractors often weaker than traditional (Gierl/Lai/Turner medical AIG line) | FACT | Medium–High |
| Validity concerns interpretations/uses; ambitious uses need more evidence (Kane 2013) | FACT | High |
| Unguarded GPT Base ~51% correct on Bastani practice answer queries; harms solo exam | FACT | High |
| ChatGPT/robot maths answers ~55% accurate in cited primary classroom study | FACT | Medium (single study) |
| MindCraft verify drop ~30% on audited batch | FACT (internal audit) | High for that batch; medium as ongoing rate |
| Prompt hardening + tool-calc can push drop \<10% without abandoning LLM stems | HYPOTHESIS | Medium |
| SAFE-GENQ is the right commercial mapping | FOUNDER BELIEF | Medium–High |

---

## LXXII.13 What this chapter kills

1. **Kill:** LLM-generated items ≡ ready-to-ship bank without independent key verify.  
2. **Kill:** Item-count / “AI wrote N questions” as hero metric or ACT/identity proof.  
3. **Kill:** Unverified keys as diagnostic (C4) or `/record-outcomes` ground truth.  
4. **Kill:** Fluency of stem/explanation ≡ keyed correctness.  
5. **Kill:** Clone/isomorph floods ≡ transfer or exam readiness.  
6. **Kill:** Scaling generation while verify drop remains ~30%.  
7. **Wound:** Equating classical constrained AIG validity evidence with unconstrained LLM item dumps.  
8. **Wound:** Using Bastani chat-tutor error rates as a precise forecast of *authoring* error without batch audits.  
9. **Survive:** Gierl/Lai item-model discipline; Kane IUA for bank *uses*; Bastani + classroom LLM wrongness as hazard priors; internal verify audit; GENQ-1…5; verify-before-ship + diagnostic seal.

**Doctrine until data:** MindCraft generates to **fill ontology holes**, ships only **verified keys**, and treats key failure as a **graph integrity** incident — not a content backlog inconvenience.
