# Part XXIX — Spacing, Retrieval, and the Memory of Competence

**Chapter status:** Living evidence brief  
**Primary question:** How should MindCraft schedule practice so competence evidence *persists* — the raw material of identity?  
**Owners:** Cognitive Science · Data Scientist · Product Strategist · Red Team

---

## XXIX.1 Why memory science belongs in an identity Constitution

Identity (“I am someone who can do math”) requires **autobiographical evidence**. If skills evaporate between sessions, the self-story collapses into “I used to be able to when the app held my hand.”

Retention is not a separate KPI from identity. It is the substrate.

---

## XXIX.2 Spacing / distributed practice

**FACT:** Cepeda, Pashler, Vul, Wixted & Rohrer (2006) — quantitative synthesis of distributed practice (317 experiments / 184 articles; 839 assessments). Spacing and lag effects are robust; the inter-study interval that maximizes retention **increases as the desired retention interval increases**.

**FACT:** Cepeda et al. (2008, *Psychological Science*) — “temporal ridgeline” of optimal retention: gap between study episodes should scale with how long you need the knowledge to last.

**Product implication:** “Do 40 problems tonight” (massing) can produce local mastery marks that fail a week later. Mastery graph must schedule **returns**, not only first clears.

**HYPOTHESIS — Identity Spacing Rule:** After `transfer_pass`, schedule a retrieval at a lag matched to the student’s likely next exam/use horizon (days for homework, weeks for ACT track).

---

## XXIX.3 Retrieval practice / testing effect

**FACT / TRADITION:** Roediger & Karpicke (2006) — retrieval practice (testing) often beats restudy for long-term retention (“power of testing memory”).

**FACT / nuance:** Expanding vs equal spacing of retrieval — expanding can help short-term; equal spacing often competitive or better for long-term (Karpicke & Roediger, 2007 line).

**MindCraft translation:**
- Soft-wrong + retry is already a retrieval event if the student reconstructs, not merely rereads a hint.
- “Review mode” that only re-shows worked examples without retrieval is weaker than asking for the decisive step again.
- Gap scan / practice should prefer **generation** over passive video when the goal is durable competence.

---

## XXIX.4 Desirable difficulties (Bjork)

**FACT / TRADITION:** Conditions that slow acquisition can improve retention/transfer (spacing, interleaving, generation) — “desirable difficulties.”

**Red Team / affect conflict:** Desirable difficulties raise short-term failure rates → can spike threat for anxious learners.

**Resolution (HYPOTHESIS — Sequenced Difficulty):**
1. Early FEI: protect safety; use micro-grain success.  
2. Then introduce spacing/interleaving once `retry_120s` is healthy.  
3. Never introduce desirable difficulty as shame (“you got this wrong because you’re weak”). Frame as training physics.

---

## XXIX.5 Interleaving (brief)

**FACT / TRADITION:** Mixed practice of related problem types often improves discrimination/transfer vs blocked practice (Rohrer/Taylor line in math practice research — effects depend on similarity structure).

**HYPOTHESIS:** Interleave *after* initial schema formation (CLT), not before. Block → fade → interleave → spaced retrieval.

---

## XXIX.6 System: Memory of Competence (MoC)

```
learn → transfer_pass → schedule spaced retrieval
   ↑                           |
   +---- fail retrieval -------+--> diagnose: forgot vs never had
```

**Forgot vs never-had** is a product-critical distinction:
- Forgot → lighter reactivation + shorter lag next time  
- Never-had → return to worked examples / ingredient teaching (not more shameful quizzes)

---

## XXIX.7 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| SPC-1 | Spaced return vs massed cram after mastery mark | A/B | retention @ 7d / 28d |
| RET-1 | Retrieval prompt vs restudy after soft-wrong | A/B | retention + retry quality |
| INT-1 | Interleave after fade vs blocked-only | Within concept | far transfer |

**Falsifier for “identity without memory”:** Challenge-seeking rises while 28-day retention collapses — then celebration is theater.

**Confidence:** High that spacing/retrieval are real; Medium that MindCraft currently schedules them well; product audit needed.
