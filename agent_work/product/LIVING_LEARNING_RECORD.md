# Living Learning Record (product doctrine)

**Status:** Spec for later implementation. Marketing language is live on the site.  
**Updated:** 2026-07-28  
**Rule:** This is not just a digital notebook. It is the memory between the student and the tutor.

---

## Company thesis (internal)

MindCraft is the memory between the student and the tutor.

AI automates everything around tutoring, not the human relationship itself.

Horizontal infrastructure, vertical front door:
- Infrastructure: learner memory, diagnosis, living record, tutor brief, transfer checks, parent signal
- Front door now: ACT Math for students who feel lost or believe they are bad at math

Do not open a random global tutor marketplace. Prefer primary guide plus optional specialist network later.

---

## Product loop (concise)

1. Student attempts a problem  
2. MindCraft identifies concept, prerequisite, misconception, confidence  
3. Living record updates  
4. AI prepares next targeted practice  
5. Tutor gets a 60 second brief  
6. Tutor makes one precise intervention  
7. Student solves a solo transfer problem  
8. System records what worked  
9. Parent sees: clicked, stuck, next  

Then the loop repeats.

---

## Living record fields

- What the student attempted  
- What they misunderstood  
- Why the mistake occurred  
- The explanation that finally clicked  
- The tutor move that helped  
- One similar problem  
- One transfer problem  
- Confidence before and after  
- What should happen next  
- Short parent facing summary  

---

## Parent purchase reasons (homepage)

1. Clearer diagnosis  
2. Less wasted tutoring time  
3. Less fighting about homework  
4. A tutor they trust  
5. Visible score improvement  
6. Confidence their child is actually learning  

Tagline: Parents buy clarity, trust, and steady progress.

---

## ACT front door copy

ACT tutoring that never starts from zero.

MindCraft turns every practice problem and tutoring session into a living notebook, identifies the exact missing skill, and briefs a college tutor before they meet your child.

Less repetition. Shorter, targeted sessions. Progress that carries forward.

---

## Messaging bank (use in different site sections)

- MindCraft is the memory between the student and the tutor.  
- One person knows your journey. A world of people can contribute to it.  
- ACT Math for students who feel lost or believe they are bad at math.  
- Designed for independent solving: hints, human intervention, and transfer checks rather than answer dumping.  
- Every session remembers. Every tutor knows where to begin.  
- Clear support without becoming the math teacher.  

Avoid making ChatGPT the hero of the sentence. Avoid empty identity slogans on the parent buy path. Identity is the deeper result; parents buy clarity and outcomes.

---

## Guardrails (from research)

- Hints before answers; solo transfer required  
- Soft wrong, low shame diagnosis  
- Parent is witness and scheduler, not homework teacher  
- Do not claim we prevent AI dependence until measured; claim design for independence, then prove it  
- Stanza naming: treat as internal language until trademark clearance  

---

## Implementation backlog (product)

- [ ] Persist living record schema in Firestore  
- [ ] Auto tutor brief (60s) from latest record  
- [ ] Parent digest: clicked / stuck / next  
- [ ] Transfer problem generation after intervention  
- [ ] Instrument: tutor prep time saved, solo_transfer_pass, renewal after score movement  
