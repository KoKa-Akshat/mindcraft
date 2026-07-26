# Part XXX — Attribution, Helplessness, and the Language of Feedback

**Chapter status:** Living evidence brief  
**Primary question:** After a miss or a win, which causal story should MindCraft install — and which language silently teaches helplessness?  
**Owners:** Ed Psych · UX Researcher · Tutor Ops · Red Team

---

## XXX.1 Weiner’s dimensions (the grammar of cause)

**FACT / THEORY:** Weiner’s attributional theory of achievement motivation (e.g., 1979 classroom theory; 1985 *Psychological Review*) — people explain success/failure along dimensions that shape emotion and future expectancy:

| Dimension | Poles (simplified) | Linked consequence (Weiner tradition) |
|-----------|--------------------|----------------------------------------|
| **Locus** | Internal ↔ External | Pride/shame vs externalization |
| **Stability** | Stable ↔ Unstable | Expectancy of future same outcome |
| **Controllability** | Controllable ↔ Uncontrollable | Guilt/responsibility vs helplessness / pity |

**HYPOTHESIS for product copy:** The most dangerous failure attribution in math is **internal + stable + uncontrollable** (“I’m just not smart at math”).

The most useful failure attribution is often **internal + unstable + controllable** (“I used the wrong strategy; I can change it”) — with care not to blame students for systemic/curricular failures.

---

## XXX.2 Learned helplessness in learning contexts

**FACT / TRADITION:** When outcomes are experienced as independent of action, organisms (and students) reduce effort — learned helplessness tradition (Seligman) applied in education as expectancy of non-contingency.

**Product factories of helplessness:**
1. Hints that auto-solve → outcome independent of student action  
2. Random difficulty spikes → non-contingent failure  
3. Praise for “being smart” then fail → talent threat  
4. Opaque AI answers → student cannot see what *they* controlled  

**Antidote design:** Make the decisive controllable step visible. Soft-wrong should point to a **changeable move**.

---

## XXX.3 Attributional retraining (AR)

**FACT / APPLIED TRADITION:** Attributional retraining programs encourage adaptive attributions (often effort/strategy for failure) and have an empirical literature in higher-ed/classroom applications (Perry and colleagues’ applied work; see reviews of AR).

**Caveats (Red Team):**
- “Just try harder” without strategy is false growth mindset.  
- Effort attribution for impossible items is gaslighting.  
- Ability is not infinitely plastic in the short run; teach strategies and select grain.

**MindCraft AR micro-protocol (HYPOTHESIS):**
1. Name the miss specifically.  
2. Offer one controllable strategy.  
3. Invite immediate re-attempt.  
4. On success: attribute to the strategy used.  
5. On second miss: downshift grain (CLT), do not escalate shame.

---

## XXX.4 Feedback language bank (draft doctrine)

| Situation | Avoid | Prefer |
|-----------|-------|--------|
| First miss | “Wrong.” / “Easy one…” | “That trap is common — here’s the fork.” |
| Hint use | “Here’s the answer.” | “Your move: which factor is shared?” |
| Success after struggle | “You’re a genius!” | “You changed approach — that worked.” |
| Success too easy | Big celebration | Quiet confirm + raise challenge |
| Tutor note | “Good job!” | “I saw you return after the miss on axis of symmetry.” |

---

## XXX.5 Intersection with mindset and SDT

- **Mindset:** Yeager 2019 shows context-sensitive gains; attribution language is part of the ecology.  
- **SDT competence:** Controllable success feeds competence need.  
- **Anxiety:** Internal-stable-uncontrollable attributions amplify threat.

**Unified copy rule:** Every feedback utterance should answer: *What can the student do next that would change the outcome?* If it cannot answer, rewrite.

---

## XXX.6 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| ATR-1 | Strategy attribution vs talent praise after win | A/B | challenge_accept @ 7d |
| ATR-2 | Controllable miss framing vs ability framing | A/B | retry_120s |
| ATR-3 | Auto-solve hint vs decisive-step hint | A/B | transfer_pass + efficacy |

**Falsifier:** Strategy language improves self-report but not behavior — then copy is placebo.

**Confidence:** High that attributions matter; Medium that current product language is already adaptive (needs audit).
