# Research Log

Append-only. Newest entries at top.

---

## 2026-07-26 — Red Team tick: Part XXXIII AI tutors (Bastani category error)

**Tick type:** Red Team (UTC hour 09 → hour % 3 == 0)  
**Chapter revised:** `chapters/33_ai_tutors_trust_sycophancy.md` (no new chapter; NEXT stays 34)

**Claims attacked:**
1. Bastani “GPT Tutor” ≈ MindCraft ontology / Pedagogy Wrap Contract (PWC).
2. Guardrails ⇒ learning *gain* vs no-AI control.
3. Fallibility banner (Nagashima) as generative-trust calibration evidence.
4. Li et al. detection rates as directly portable to Maya HS.

**Evidence used (verified, not invented):**
- Bastani et al. 2025 PNAS doi:10.1073/pnas.2422633122 — Tutor exam ≈ control (mitigation, not gain); Tutor prompt includes teacher solutions/mistake scripts; Base ~17% worse solo; perception ≠ actual learning.
- Nagashima et al. arXiv:2606.03822 — CTAT hard-coded fox agent; no LLM; more hints, no performance change.
- Li et al. L@S 2025 doi:10.1145/3698205.3729550 — adult STEM online; detection rare; undetected errors harm learning/self-efficacy.

**Disposition:**
- **Killed:** Bastani Tutor ≡ MindCraft PWC (category error).
- **Killed:** “Guards ⇒ learning gain” overclaim (Tutor neutralized harm only).
- **Wounded:** “Solver default = GPT Tutor” branding → **guarded Solver**; Li external validity; Nagashima→AIT-3 sufficiency.
- **Survives:** Base crutch harm; Sharma sycophancy; Lee & See calibration frame; prior kill of “AI always helps.”

**Confidence change:** Ontology-wrap superiority vs ChatGPT on identity metrics **Medium → Low–Medium** until AIT-1. Success bar explicit: beat no-AI / `solo_transfer_pass`.

**Product implication:** Never market “we’re Bastani’s GPT Tutor.” Prefer deterministic checkers over prompt-stuffed keys; ban coach thumbs-up / “AI helped me” as primary KPIs.

**Red Team status:** two kills, three wounds, core crutch/sycophancy facts survive.  
**Experiment spawned:** none new (AIT-1..5 retained; AIT-3 scope clarified).  
**PDF:** Regenerated after chapter patch.

---

## 2026-07-26 — Researcher tick: Part XXXIII AI tutors / trust / sycophancy

**Tick type:** Researcher  
**Claim examined:** Fluent generative tutors improve identity-forming math learning by default.

**Evidence added:**
- Bastani et al. (2025, *PNAS*): unguarded GPT-4 practice can raise concurrent scores then harm solo performance (~17% worse vs no-AI); guarded “GPT Tutor” mitigates.
- Sharma et al. (ICLR 2024 / arXiv:2310.13548): sycophancy general across SOTA RLHF assistants; preference data often rewards agreeableness over truth.
- Li et al. (L@S 2025): learners often fail to detect factual chatbot errors; undetected errors harm learning and self-efficacy.
- Lee & See (2004): calibrated / appropriate reliance framework.
- Fallibility-warning ITS study (arXiv:2606.03822): transparency shifts help-seeking even when system behavior unchanged.

**Contradictions:** Uncertainty UX can raise load / reduce engagement; algorithm aversion after one error; students will still use off-app ChatGPT.

**Confidence change:** “Explanations are free ⇒ AI tutor is the product” further **wounded**. Pedagogy-wrap / anti-crutch design elevated to load-bearing hypothesis (PWC).

**Product implication:** Solver default = guarded hints + ontology spine; instrument `ai_reveal_rate` / `solo_transfer_pass`; anti-sycophancy eval in CI; never optimize coach thumbs-up as learning.

**Red Team status:** Default “AI always helps learning” **killed** for unguarded chat. Ontology-wrap superiority still **hypothesis** (AIT-1..5).

**Experiment spawned:** AIT-1 (guarded vs full answers), AIT-2 (anti-sycophancy suite), AIT-3 (fallibility banner), AIT-4 (confidence chips), AIT-5 (wizard × guard).

**PDF:** Regenerate after manifest mount of `chapters/33_ai_tutors_trust_sycophancy.md`.

---

## 2026-07-25 — v1.4 flow + parent anxiety chapters

**Added:**
- Part XXXI Flow / challenge–skill (Csikszentmihalyi; perceived vs actual skill; Celeste mapping)
- Part XXXII Parent anxiety transmission (Maloney et al. 2015 — homework-help contingent pathway)

**Product implication sharpened:** Parent role = witness/scheduler + assist cards; do not force anxious parents to teach novel procedures.

**Still queued:** AI trust (33), causal DAG (34), competitive audits (35), equity (36); instrumentation + interviews.

---

## 2026-07-25 — v1.3 multi-chapter lab scale-up

**Process change:** Constitution now concatenates via `CHAPTER_MANIFEST.txt`. Deep dives live in `chapters/`. PDF generator updated.

**Chapters added:**
- XXIV Affect / anxiety / belonging (Ashcraft; Steele; Walton/Cohen)
- XXV Self-efficacy / narrative / habit≠identity (Bandura; Usher & Pajares; HID model)
- XXVI CLT / mastery / tutoring calibration (Sweller; Kulik/Slavin; VanLehn; Nickow)
- XXVII Markets / parents / competition (WTP stack; competitive teardown)
- XXVIII History/meaning under trial (seductive details risk; HIST experiments)
- XXIX Spacing & retrieval (Cepeda 2006/2008; Roediger & Karpicke)
- XXX Attribution & helplessness (Weiner; AR tradition; feedback doctrine)

**New original frameworks named:**
- SAFE-CRAFT (prior)
- Attempt Grain Principle (CLT × struggle)
- Habit/Identity Divergence Model (HID)
- Memory of Competence (MoC) system
- Affective Load Manager

**Red Team standing orders reinforced:** no 2-sigma marketing; no empty social relatedness; stories must encode structure or die in HIST-2.

**Queue:** `NEXT_LAB.md` (instrumentation + interviews + chapters 31–36).

---

## 2026-07-25 — v1.1 mechanism expansion + scarcity trial

**Agents present:** CRO, Ed Psych, Learning Science, Cognitive (anxiety/WM), Behavioral Econ, Game Designer, AI Researcher, Product Strategist, Devil’s Advocate, Red Team.

**Claims examined:**
1. Founder tutoring sequence as universal path to identity change.
2. “Tutoring is free” slogan.
3. Bloom 2-sigma as product north star.
4. Deliberate practice as sufficient explanation of expertise.

**Evidence added:**
- Ashcraft & Kirk (2001); math anxiety reviews; WM mediation meta (~r = −0.17 MA–MP).
- Yeager et al. (2019) advanced math enrollment (+~3pp in subsample).
- Wang et al. (2024) SDT education interventions: autonomy/competence effects; relatedness ns overall.
- VanLehn (2011): human tutoring ~0.79; step ITS ~0.76 — not 2.0.
- Hambrick/Macnamara line: deliberate practice important, not sufficient.

**Contradictions retained:**
- Slavin vs Kulik on mastery.
- Mindset heterogeneity / peer-norm dependence.
- Not all low performers are anxious.

**Confidence changes:**
- Scarcity thesis: slogan form **killed**; Layer 2–6 doctrine **survives**.
- Founder sequence: **wounded** → replaced by SAFE-CRAFT hypothesis.
- Identity North Star via challenge-seeking: **survives** as hypothesis.

**Product implications:**
- Instrument `retry_120s`, `challenge_accept`, `transfer_pass`.
- Ban empty mindset copy; treat soft-wrong/coach as load-bearing.
- Do not market Bloom 2-sigma.

**Experiments spawned:** A (wizard coach), B (story frame), D (explanation timing × anxiety).

**PDF:** Regenerated `MINDCRAFT_RESEARCH_CONSTITUTION_v1.pdf`.

---

## 2026-07-25 — Constitution v1 inaugurated

**Agents present:** CRO, Learning Science, Ed Psych, Behavioral Econ (habit), Devil’s Advocate, Red Team, Product Strategist, Founder Philosopher.

**Decisions:**
- Identity transformation is the research question; math delivery is subordinate.
- Scarcity thesis retained only in refined form (Layers 2–6).
- North Star candidate: challenge-seeking under safety (hypothesis).
- Ban empty growth-mindset copy in product.

**Red Team kills logged:** See Constitution Part XIV.

**Next lab session:** Instrument FEI events; sketch Experiment A pre-registration; schedule 10 Maya interviews.

---

## Template for future entries

```
## YYYY-MM-DD — Title
**Claim examined:**
**Evidence added:**
**Contradictions:**
**Confidence change:**
**Product implication:**
**Red Team status:** survives / wounded / killed
**Experiment spawned:**
```
