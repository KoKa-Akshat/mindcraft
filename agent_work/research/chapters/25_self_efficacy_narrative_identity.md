# Part XXV — Self-Efficacy, Narrative Identity, Habit (deep dive)

**Chapter status:** Living evidence brief  
**Primary question:** What updates the self-story “I am bad at math,” and what merely increases login frequency?  
**Owners:** Learning Science · Narrative Psychology · Behavioral Econ · Red Team

---

## XXV.1 Self-efficacy is not “confidence vibes”

**FACT (theory):** Bandura’s social cognitive theory — self-efficacy is belief in capability to organize and execute actions required for specific attainments. It is **task- and domain-specific**, not a global personality glow.

**FACT (sources):** Efficacy information is processed from four sources (Bandura, 1997):

1. **Mastery experiences** (usually strongest)  
2. **Vicarious experiences** (models)  
3. **Social persuasion** (credible others)  
4. **Physiological / affective states** (how arousal is interpreted)

**FACT (measurement tradition):** Usher & Pajares (2009/2010 line) validated source scales for middle-school mathematics; sources relate to math self-efficacy, goals, optimism.

**HYPOTHESIS:** MindCraft’s FEI loop is largely a **self-efficacy engineering system**:

| FEI stage | Efficacy source |
|-----------|-----------------|
| Safety / soft-wrong | Reinterprets physiological arousal (“alert, not doomed”) |
| Earned micro-win | Mastery experience |
| Coach naming strategy | Persuasion + attribution |
| Tutor witness / peer story | Vicarious + persuasion |
| Map fill after transfer | Mastery that survives variation |

---

## XXV.2 Why mastery experiences dominate — and how products fake them

**What is happening:** A win only updates efficacy if the learner **attributes** it to their capability under meaningful difficulty.

**Fake mastery (product sins):**
- Too-easy items → “this doesn’t count”
- Heavy hinting → “the app did it”
- Identical clones after “mastery” → recognition, not competence
- Points for opening lessons → engagement theater

**Real mastery design rules (HYPOTHESIS):**
1. Difficulty just above comfort (desirable difficulty, not cruelty).  
2. Student performs the decisive step.  
3. Immediate informative feedback.  
4. Soon after: varied item (transfer_pass).  
5. Explicit attribution to strategy (“you isolated the factor”) not talent.

**Contradicting caution:** After strong efficacy exists, occasional failure hurts less (Bandura). Early failures hurt more. Protect early arc; do not permanently infantilize.

---

## XXV.3 Reciprocal loops: efficacy ↔ achievement

**FACT / EMERGING:** Longitudinal work often finds reciprocal relations — achievement raises efficacy and efficacy raises later achievement (e.g., recent high-school math reciprocity analyses in large-scale assessment literature). Causality is not one-way.

**Implication:** “Just raise confidence” without skill is unstable. “Just raise skill” while humiliating can stall practice volume for anxious students. Build both.

---

## XXV.4 Narrative identity — the story that persists

**FACT / TRADITION:** Narrative identity research (McAdams tradition) — people maintain identity through evolving life stories with themes of agency, communion, redemption, contamination.

**HYPOTHESIS (MindCraft synthesis):** Math identity change is a **redemption narrative rewrite**:

- Contamination story: “I failed → I am bad at math → I avoid → I stay bad.”  
- Redemption story: “I struggled → I used a strategy → I grew → I am becoming someone who stays.”

**Product implication:** Story worlds matter if they supply **symbols for redemption**, not only costume. The map lighting after a real win is a narrative punctuation mark.

**Red Team:** Most edtech “stories” are skin. If removing the narrative leaves identical pedagogy and identical emotions, the story was decoration. Test with story-off experiments (Experiment B).

---

## XXV.5 Habit vs identity — the Duolingo trap, precisely

**FACT / INDUSTRY:** Habit products use cues, streaks, variable rewards, loss aversion. Duolingo’s method materials emphasize motivation systems for return.

**FACT / THEORY tension:** Self-Determination Theory warns that controlling extrinsic rewards can undermine intrinsic motivation when they feel coercive (classic Deci findings; nuance exists for informational rewards).

**HYPOTHESIS — Habit/Identity Divergence Model (HID):**

```
Habit success: cue → routine → reward → return frequency ↑
Identity success: evidence → attribution → self-story → choice of harder future ↑

Overlap zone: daily practice that produces mastery evidence
Failure mode A: habit without mastery → brittle streak addiction
Failure mode B: identity talk without practice → empty affirmation
```

**Metric separation (mandatory):**
- Habit health: D1/D7 return, streak  
- Identity health: `challenge_accept`, advanced course intent, math-person item + behavior consistency  

Optimize for overlap zone. Never promote a habit metric that moves opposite identity metrics.

---

## XXV.6 Vicarious experience and “who is the model?”

**HYPOTHESIS:** Models work when perceived as **similar yet slightly ahead** (“near-peer who struggled”), not as genius tutors who never miss.

**Product:**
- Villager / character arcs that show struggle → strategy → win.  
- Tutor stories: “I used to blank on fractions.”  
- Avoid only showcasing perfect speedruns.

**Social persuasion:** Credibility matters. Random app toast < trusted tutor sentence. Parents can persuade or destroy (“we’re not math people” is efficacy poison — FOUNDER BELIEF with strong anecdotal support; needs interview confirmation).

---

## XXV.7 Universal principles from this chapter

1. Efficacy is specific; measure math efficacy, not “confidence.”  
2. Mastery experiences must be owned and non-trivial.  
3. Arousal interpretation is designable (anxiety as signal vs doom).  
4. Narrative punctuation should mark real competence events.  
5. Habits are oxygen; identity is the fire.  

---

## XXV.8 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| EFF-1 | Does requiring decisive student step (vs auto-solve) raise efficacy item? | A/B | math efficacy delta |
| EFF-2 | Strategy attribution copy vs talent copy after win | A/B | challenge_accept @ 7d |
| EFF-3 | Streak on vs identity milestone on (map fill) | A/B | retention vs challenge_accept tradeoff |
| EFF-4 | Near-peer struggle story vs expert-perfect story | A/B | persistence after first miss |

**Falsifier for identity thesis:** Habit metrics rise for 8 weeks while challenge-seeking and transfer stay flat — then MindCraft is a streak app, not an identity company.
