# General Learning Science, for Anyone Building a Learning App

This is not MindCraft's product strategy. It is the underlying cognitive-science
and educational-psychology research sitting inside MindCraft's internal
research corpus (agent_work/research/, 160 chapters), stripped of MindCraft's
own jargon, product names, and internal codes. Every bullet traces to a real,
citable finding from a specific chapter, marked in parentheses. Meta-analyses
and large replicated findings are prioritized over single small studies, and
single-study findings are marked as such.

---

## How memory actually works

- Spacing practice out over time beats massing it into one sitting, and the
  ideal gap between sessions gets longer the longer the material needs to be
  retained. Well established at large scale (Cepeda et al 2006, 317
  experiments; math-specific replication, Murray, Horner and Goebel 2025, 27
  studies, modest effect g=0.28). (Ch 29, 78)
- Actively recalling an answer from memory beats rereading or passively
  restudying it (the testing effect), one of the most replicated findings in
  the field (Roediger and Karpicke 2006). (Ch 29)
- Forgetting follows a decelerating, somewhat irregular curve, not a smooth
  exponential drop, a genuine replication of Ebbinghaus's original 1880s work
  (Murre and Dros 2015; Wixted 2004 review). (Ch 76)
- People believe cramming works better than spacing even when spacing
  demonstrably wins for the large majority of them, a real, replicated
  metacognitive illusion (Kornell 2009: spacing beat massing for about 90% of
  participants, yet 72% believed massing worked better). Same-session
  confidence is a poor proxy for later retention, since judgments of learning
  made right after study ignore how much the coming delay will hurt recall
  (Koriat and Bjork's foresight bias research). (Ch 78, 76)
- Personalizing which item to review, based on what a learner is actually
  closest to forgetting, beat both cramming and a generic fixed spaced
  schedule in a real semester-long classroom study (Lindsey et al 2014, about
  16.5 points better than massed practice on a month-later exam). Engagement
  or predicted-recall accuracy improving is not the same evidence as learning
  improving (a caution drawn directly from Duolingo's own published
  algorithm research). (Ch 77)
- Mixing different problem types together (interleaving) produces
  substantially better delayed-test performance than grouping same-type
  problems together (blocking), including in a preregistered, classroom-scale
  randomized trial (Rohrer et al 2020, 54 classrooms, d=0.83 on a one-month
  test). This depends on the material: it helps most when categories are
  easily confused, and can actually hurt for some material like word lists
  (Brunmair and Richter 2019 meta-analysis, 59 studies). (Ch 39, 114)

## Difficulty and struggle

- A "desirable difficulty" (spacing, interleaving, retrieval practice) only
  helps if the learner already has enough prior knowledge to respond to it
  successfully. The identical difficulty is simply harmful for someone who
  isn't ready for it yet (Bjork and Bjork's foundational framework). (Ch 41,
  114, 117)
- For genuine novices, studying complete worked examples beats unguided
  problem-solving, because unaided search consumes the working memory needed
  to actually build understanding (Sweller and Cooper 1985, foundational
  cognitive load theory). This reverses once a learner gains real competence,
  where continuing to hand-hold with examples becomes redundant and can hurt
  (the expertise reversal effect, Kalyuga et al 2001, 2003). (Ch 26, 88, 100)
- Fading support gradually, removing the final steps of a worked example
  first rather than jumping straight from a full example to an unaided
  problem, produces better transfer, and adapting the fade schedule to actual
  demonstrated performance beats a fixed fade schedule (Renkl et al 2002;
  Salden et al 2010, intelligent tutoring system study). (Ch 88, 100, 117)
- Letting students attempt a novel problem before any instruction, then
  explicitly comparing their attempts to the correct method, can beat
  teaching first, but only under real conditions: older learners, conceptually
  rich material, and a genuine consolidation step afterward. It reverses for
  young children and for generic (non-domain) skills (Sinha and Kapur 2021
  meta-analysis of 53 studies, g=0.36 overall, moderated heavily by fidelity
  and age). (Ch 94)
- Adding more explanatory content is not automatically better. Current
  cognitive load theory treats "germane load" as a redistribution of existing
  mental effort, not a third type you can just add more of, and detailed
  provided explanations add close to nothing once a learner is already
  prompted to self-explain (Wittwer and Renkl 2010 meta-analysis, 21 studies,
  small overall effect d=0.16, near zero once self-explanation is already
  present). Sometimes withholding an explanation and requiring the learner to
  generate it produces better conceptual learning than providing it (Richey
  and Nokes-Malach 2013). (Ch 92)
- More assistance is not automatically safer. Over-assisting can undercut the
  very constructive effort that produces learning, a genuine, still-debated
  design tension in the tutoring-systems literature, not a settled formula
  (Koedinger and Aleven 2007's "assistance dilemma"). (Ch 92)
- For learners showing real anxiety on a topic specifically, providing a full
  worked example at that moment measurably blunts anxiety's damage to
  learning and reduces mind-wandering, a legitimate support, not coddling
  (Mesghina et al 2023, one study, 280 fifth graders). Readiness to remove
  that support is better gated on demonstrated success than on a fixed
  anxiety score. (Ch 117)

## Motivation and identity

- Whether someone keeps engaging with a subject is driven by three
  independent, separately measurable things: expectancy (do I believe I can
  succeed), value (is this interesting or important to me), and cost (effort,
  emotional cost, what else I'm giving up), not one general "motivation"
  level (Eccles-Parsons's expectancy-value model, decades of supporting
  research). A short prompt asking someone to connect material to their own
  life raises interest and performance the most for people who don't expect
  to do well (Hulleman and Harackiewicz 2009, a real randomized field
  experiment). (Ch 37)
- Framing progress around improvement against your own past performance
  (mastery goals) produces better strategies and more resilience to failure
  than framing it around outperforming others or proving you're smart
  (performance goals), a large, well-established body of evidence (Ames and
  Archer 1988; Dweck and Leggett 1988; Hulleman et al 2010 meta-analysis of
  243 studies, about 91,000 people). Goals framed around avoiding looking
  incompetent are broadly harmful; the actual reward and evaluation structure
  of an environment shapes this more reliably than messaging alone (Ames
  1992; a real longitudinal classroom study, Lueftenegger et al 2014, 1,680
  students). (Ch 38)
- Autonomy, competence, and relatedness are the three psychological needs
  that sustain real intrinsic motivation (Self-Determination Theory, Ryan and
  Deci 2000, one of the most cited frameworks in psychology). Rewarding mere
  completion of a task (not real performance) reduces later interest in that
  task once the reward is gone, an effect not seen for unexpected rewards or
  informational, non-controlling praise (Deci, Koestner and Ryan 1999
  meta-analysis, 128 studies). Choice increases motivation and effort, but
  attaching an immediate reward right after the choice cancels much of that
  benefit (Patall, Cooper and Robinson 2008 meta-analysis, 41 studies). (Ch
  44)
- Habits are triggered by a stable context cue, not by ongoing willpower or
  motivation, so changing the cue or environment is the real lever, not
  "trying harder" (Wood and Runger 2016 review). Specific "when X happens, I
  will do Y" plans reliably increase follow-through, one of the more robust
  findings in behavior change (Gollwitzer and Sheeran 2006 meta-analysis, 94
  tests, d is about 0.65). Missing a single day does not meaningfully derail
  habit formation, and full automaticity takes far longer than the popular
  "21 days" claim, a median of about 66 days with huge individual variation
  (Lally et al 2010, real-world diary study). (Ch 43)
- Resilience under real adversity typically comes from ordinary protective
  systems staying intact (attachment, self-regulation, social support), not
  from a rare personality trait (Masten 2001's widely cited "ordinary magic"
  framing). "Grit" specifically has weak evidence as a distinct, trainable
  trait: it overlaps heavily with the existing trait of conscientiousness,
  predicts achievement only modestly, and grit-building interventions show
  weak effects (Crede, Tynan and Harms 2017 meta-analysis, 584 effects across
  about 66,800 people). (Ch 45)
- Curiosity is triggered by a perceived, specific information gap and is
  intense but short-lived, a matter of situational design more than a
  personality trait (Loewenstein 1994's foundational framing). Committing to
  an explicit guess before seeing an answer increases curiosity and improves
  memory for the answer, especially when it's surprising, and asking "were
  you surprised" after the fact does not reproduce this effect (Brod and
  Breitwieser 2019). (Ch 107)

## Feedback and metacognition

- Feedback has a real positive effect on performance on average, but it is
  inconsistent: more than a third of feedback interventions studied actually
  made performance worse, especially feedback that draws attention to the
  person or their ego rather than the task itself (Kluger and DeNisi 1996,
  one of the most cited meta-analyses in the feedback literature, 607 effect
  sizes). There is no universal rule that immediate or delayed feedback is
  always better, it is genuinely context-dependent, and a recent meta-analysis
  found the average difference between the two statistically indistinguishable
  from zero (Kulik and Kulik 1988; a 2024 meta-analysis of 116 interventions).
  Feedback aimed at the task or strategy ("try this differently") is more
  useful than feedback aimed at the person ("great job," comparative praise)
  (Hattie and Timperley 2007). (Ch 79, 112)
- People are frequently overconfident, especially when their actual accuracy
  is near chance, a foundational and widely replicated pattern that also
  shows up in school-age math learners specifically (Lichtenstein and
  Fischhoff 1977; Garcia et al 2016). Confidently held wrong answers are
  corrected more durably by feedback than uncertain wrong guesses, the
  hypercorrection effect, now replicated in real, large-scale online math
  data (Butterfield and Metcalfe 2001; Foster et al 2022). Just asking
  someone to rate their confidence does not, by itself, improve performance,
  a real null result from a study across four schools, it only helps when
  paired with feedback or a decision that changes what happens next (Foster
  2021/2022). Prompting someone to generate reasons their answer might be
  wrong, not just reasons it's right, meaningfully improves the accuracy of
  their confidence (Koriat, Lichtenstein and Fischhoff 1980). (Ch 49, 50)
- Formative assessment's real, validated definition is a process, evidence
  gathered, interpreted, and used to change the next step, not any specific
  artifact like a quiz (Black and Wiliam 1998, a landmark review of about 250
  sources). The widely quoted "0.4 to 0.7 effect size" for formative
  assessment is not well supported by rigorous reanalysis; the real number is
  closer to 0.20 to 0.25 and still contested (Kingston and Nash 2011). Feedback
  only functions as formative if the learner understands the target standard,
  compares their own work to it, and takes an actual action to close the gap;
  feedback that leads to no action is close to worthless (Sadler 1989's
  foundational framing). (Ch 111)
- Students often say feedback would be useful but admit they would not
  actually use it. The real barriers run through noticing it, understanding
  it, feeling able to act on it, and being willing to put in the effort, which
  means low uptake is usually a design failure, not a character flaw in the
  student (Winstone et al 2017, a systematic review of 195 outputs, plus a
  matching focus-group study). (Ch 112)
- Self-regulated learning runs as a repeating cycle: planning and goal-setting
  before a task, monitoring and control during it, and reflection afterward,
  where that reflection feeds the next attempt's plan (Zimmerman's
  foundational model). Attributing a failure to a fixable cause, like the
  wrong strategy, sustains motivation and produces better adaptive change than
  attributing it to fixed ability (Zimmerman 2002; Cleary, Zimmerman and
  Keating 2006). (Ch 101)

## Social and affective context

- Math anxiety correlates with worse performance, and one credible mechanism
  is that anxiety-related worry competes for the same working memory the task
  itself needs, not simply that anxious people have lower ability (a
  meta-analytic correlation around r=-0.17; Ashcraft and Kirk 2001 found
  reduced working-memory span specifically under anxiety). Sleep deprivation
  independently and measurably harms both new learning and retention of
  recent learning, especially in teenagers: five nights at five hours of
  sleep caused 26 to 65% more forgetting than well-rested peers depending on
  the delay tested (Cousins, Wong and Chee 2019). (Ch 24, 47)
- Stereotype threat and belonging interventions are real, well-studied
  effects, but they are genuinely heterogeneous and often shrink once scaled
  beyond the original controlled study, not a guaranteed, portable fix (Steele
  and Aronson's tradition; Walton and Cohen's belonging trials). (Ch 24)
- A learning environment's "error climate," whether mistakes are consistently
  treated as safe and useful, is a real, measurable construct that predicts
  how adaptively people respond to their own errors, beyond general
  motivation, and it decays over time unless someone actively maintains it (a
  validated scale across 1,116 students and 56 classrooms; a 2-year
  longitudinal follow-up of 1,641 students). How an instructor specifically
  responds to one person's error, staying to diagnose it versus redirecting
  away or giving a bare "incorrect", is itself a causal lever on how safe
  errors feel, demonstrated in a controlled experiment, not just observed
  correlation. (Ch 103)
- Structured collaborative learning shows real, moderate average benefits for
  STEM and math specifically, but unstructured "work together" time does not
  reliably produce this, structure is the active ingredient (multiple
  meta-analyses converging around 0.4 to 0.6 effect sizes; a math-specific
  meta-analysis at d=0.59). A group's shared performance score is never valid
  evidence of what any individual actually learned, since students who solved
  it, students who learned through the process, and students who were simply
  told the answer can all produce the same group score (Webb 1993). (Ch 113)
- Low-stakes retrieval practice tends, on average, to reduce test anxiety
  rather than increase it, the opposite of the intuitive fear that testing
  makes people more nervous (a meta-analysis of 24 studies, g is about
  -0.52). High-stakes framing of a practice session, however, can cancel out
  the normal memory benefit of retrieval practice even when in-the-moment
  performance looks unaffected (Hinze and Rapp 2014). (Ch 41, 114)

## Practical instructional design

- Prompting learners to explain the reasoning behind a step, not just showing
  them the worked solution, improves understanding and transfer, and
  structured formats (choose the right principle from options) have more
  reliable supporting evidence than open-ended "explain your answer" boxes
  (Chi et al's classic studies; a ZDM meta-analysis by Rittle-Johnson, Loehr
  and Durkin 2017). Asking someone to justify an answer before they know if
  it's correct can backfire by entrenching wrong reasoning, it works better to
  reveal correctness first, then ask for the explanation. (Ch 40)
- There is a real, well-studied difference between instrumental help-seeking
  (getting just enough to proceed) and executive help-seeking (getting the
  task done for you), and racing straight to hint-level answers correlates
  with worse learning across multiple tutoring-system studies. Help avoidance
  is just as real a failure mode, and is more common precisely among the
  lower-prior-knowledge students who need help most, so a system should not
  assume people will ask when they need it. (Ch 89, 104)
- Real scaffolding is contingent (support increases when someone struggles and
  decreases when they succeed), fades over time, and transfers responsibility
  to the learner. A fixed level of help that never changes is not really
  scaffolding in the technical sense (Wood, Bruner and Ross's foundational
  1976 paper). Revealing a full answer is not inherently harmful, the harm
  comes from receiving it with no engagement, pairing a full reveal with a
  required self-explanation step can preserve most of its instructional
  value. (Ch 91, 95)
- Generative activities, summarizing in your own words, self-testing,
  self-explaining, teaching someone else, physically enacting an idea,
  reliably outperform passive study across a wide research synthesis, with
  moderate to large effect sizes depending on the strategy (Fiorella and
  Mayer's synthesis of eight strategies). Merely expecting to teach later
  does not produce this benefit, actually producing the explanation is what
  matters, and peer tutors themselves default to reciting rather than
  building understanding unless specifically prompted with inference-requiring
  questions. Free-form "draw whatever helps" underperforms a well-made
  provided illustration unless the drawing task is genuinely structured
  (partial templates, guided comparison). (Ch 102, 106, 109)
- Analogy works through matching the relational structure between two cases,
  not surface similarity, and putting both cases side by side with an
  explicit "what maps to what" prompt produces better transfer than studying
  them separately (Gentner's foundational theory). Having a structurally
  similar example available does not guarantee someone will spontaneously
  notice and use it, an explicit cue is usually needed, a classic and
  frequently replicated finding (Gick and Holyoak 1980). (Ch 108)
- Predicting an outcome before watching a demonstration produces
  substantially better understanding than passively watching it play out
  (Crouch, Fagen, Callan and Mazur, a well-replicated classroom physics
  finding). A correct, strategy-specific hand gesture during instruction can
  improve learning beyond speech alone, and abstract or representational
  gesture supports transfer to new problems better than literal
  hands-on object manipulation, though forcing gesture on someone who
  doesn't spontaneously gesture can actually hurt them relative to an
  alternative scaffold, so it should not be mandatory for everyone. (Ch 107,
  105)
- Unrestricted generative-AI assistance during practice raised in-session
  scores but measurably harmed later unassisted exam performance; adding
  pedagogical guardrails prevented that harm but still failed to beat a
  no-AI control on actual learning, a real, well-powered randomized study with
  about 1,000 high school students (Bastani et al 2025, published in PNAS).
  Practice accuracy is only meaningful evidence of learning if genuine
  cognitive effort is actually happening: when correct answers become
  trivially available to copy, homework scores can fully decouple from exam
  performance in the same course. (Ch 104)
- Human and AI tutoring's real average benefit is far smaller than the
  popularized "two sigma" claim; modern meta-analyses converge on roughly
  0.37 to 0.79 standard deviations depending on method, and feedback at the
  step level beats feedback only on the final answer. Similarly, "deliberate
  practice" (coach-designed, just past current ability, with real feedback)
  explains far less of expert performance than popularly believed, about 4%
  of variance in one large educational meta-analysis, and raw time spent
  studying does not predict achievement once focus and goal-directedness are
  accounted for. (Ch 26, 51)

---

*Source: 34 chapters read directly from agent_work/research/chapters/ across
five parallel extraction passes. Every finding above traces to a real citation
in a specific chapter; go to that chapter file directly for the full
citation, effect size, and any caveats the original researcher noted.*
