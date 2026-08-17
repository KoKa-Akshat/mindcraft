# Prior art for ingredient / knowledge-component mapping

The full research deliverable has been written to:

[**Download `agent_work/engine/KC_MAPPING_RESEARCH.md`**](sandbox:/mnt/data/agent_work/engine/KC_MAPPING_RESEARCH.md)

## Bottom line

The working hypothesis is **mostly correct, with two important boundaries**.

MindCraft's **ingredient** is a close match for what educational data mining and intelligent-tutoring research calls a **knowledge component (KC)**. Carnegie Mellon's DataShop uses KC broadly for the knowledge, skill, principle, concept, schema, or similar component needed to perform a learning activity, and allows an activity to involve multiple KCs. citeturn8view1

Likewise, **“which ingredients does this question exercise?” is a Q-matrix problem**. In DataShop terminology, the corresponding object is also called a **KC model**: problem steps are associated with one or more KCs, producing essentially an item/step-by-KC incidence matrix. citeturn13view0turn13view1

But two other MindCraft relations should **not** be collapsed into the Q-matrix:

- **misconception → ingredient** is closer to *error diagnosis*, *buggy-rule diagnosis*, *misconception-to-skill attribution*, and—where distractors are involved—**option-level cognitive diagnosis**;
- **ingredient → concept** is an ontology / curriculum hierarchy / standards-alignment / learning-progression relation, rather than a Q-matrix relation.

That distinction is the main architectural conclusion of the research. The literature suggests maintaining three separate graphs:

`item or distractor → ingredient` — Q-matrix / option-level Q-matrix  
`misconception ↔ ingredient` — error or misconception attribution  
`ingredient → concept` — ontology / hierarchy / curriculum alignment

## What changes for P1

### The present mapping procedure has exactly the wrong failure mode

The strongest directly relevant prior art is unexpectedly close to MindCraft's problem: **Eedi itself ran a competition devoted to mapping incorrect answer choices to a closed bank of fine-grained misconception descriptions**. Eedi describes the task as: given a distractor and a list of misconception descriptions, predict which misconceptions match. Crucially, candidate misconceptions included ones not seen during training. citeturn25view0turn25view1

The strongest competition systems did **not** restrict the search to a tiny topic-local candidate set. The first-place system used retrieval followed by reranking; Eedi reports that its first stage retrieved candidates globally and its second stage reranked them using the question, distractor, correct answer, and generated student reasoning. The second-place system reranked a top-25 candidate set, and the third-place solution also used two-stage retrieval. citeturn25view1turn25view2

That makes the diagnosis of MindCraft's existing procedure unusually clear:

> **A candidate pool of roughly five ingredients, selected through a previously assigned concept, should be removed.**

The literature and the Eedi competition both point toward:

**global candidate generation → richer reranking → calibrated acceptance or abstention**

rather than:

**concept selection → five forced candidates → mandatory assignment**.

The first-place implementation has subsequently been published under an **MIT license**, and a generalized silver-medal implementation, `labelbank`, is also MIT licensed. `labelbank` explicitly packages closed-label-bank retrieval, model-mined hard negatives, and listwise reranking for label catalogs of the same general form as a bank of fine-grained misconception or KC descriptions. citeturn26search2turn26search4

### Do not map the misconception sentence in isolation

The 3,835 tagged distractor slots are probably more valuable than the 655 existing direct links.

The older tutoring literature has treated systematic wrong answers as evidence about underlying faulty knowledge for decades. Brown and Burton's BUGGY model, for example, represented misconceptions as modifications to correct procedures and attempted to infer the “deep structure” responsible for observed student errors; their reported application used 1,300 school students and a 20,000-item response database. citeturn24search2

More recent K–8 mathematics work by Feldman et al. similarly inferred combinations of basic procedural skills capable of generating observed incorrect answers, rather than merely classifying error text. Their approximately 300-student study reported reproducing 86% of answers containing clear systematic mistakes, with 77% at least partially reproducing a known misconception. citeturn24search3turn24search6

Multiple-choice cognitive-diagnosis research goes further by explicitly preserving information in **which wrong option was selected**. De la Torre's MC-DINA model was developed because reducing every distractor to the same incorrect score discards diagnostic information; later generalized option-scoring models make the same idea less restrictive. citeturn16search4turn16search1turn16search20

For MindCraft, the unit of evidence should therefore become something like:

`misconception → all tagged (question, correct answer, distractor, question-KCs) contexts`

rather than:

`misconception text → ingredient text`.

A misconception occurring in five independently authored questions gives five opportunities to ask which ingredient or ingredients are consistently implicated.

### Abstention is not optional

Nothing in the KC literature requires every misconception to correspond one-to-one with an existing KC. A misconception can be a **positively wrong rule**, not merely the absence of mastery of one correct skill. The historical vocabulary—*bug*, *buggy rule*, *mal-rule*, *systematic error*—exists precisely because these are different objects. citeturn24search0turn16search7

Consequently, MindCraft should permit:

- one misconception → one ingredient;
- one misconception → several ingredients;
- misconception → **no current ingredient**.

The last case is valuable ontology evidence, not an annotation failure.

The existing forced-choice procedure hides missing ontology coverage. An abstaining system makes that coverage gap measurable.

### How to validate P1 without asking the same LLM again

At current data volume, the best independent validator is **human/content-based validation**, supplemented later by psychometric validation.

Q-matrix research explicitly treats expert-produced matrices as provisional and fallible rather than assuming that machine-estimated mappings are ground truth. Chiu's statistical-refinement work starts from a fallible expert Q-matrix and uses discrepancies between observed and ideal responses to locate potentially incorrect entries. citeturn17view2 De la Torre and Chiu similarly developed a general discrimination-based method for identifying and replacing misspecified Q entries. citeturn17view1

Those empirical techniques are attractive later, but not with two testers and 148 observations.

For now, the report recommends using the trusted human-provenance mappings as one held-out benchmark and commissioning a fresh **blinded, stratified double-annotation sample** that deliberately includes difficult cases: cross-concept candidates, low lexical similarity, possible multi-KC mappings, and possible abstentions.

Acceptance metrics should include **precision among accepted links and coverage at that precision**, rather than only forced-choice accuracy. That lets MindCraft explicitly choose, for example, “accept fewer automatic links but make accepted links trustworthy.”

## What changes for P2

### Learning Factors Analysis is real, but only partially solves P2

Your recollection of **Learning Factors Analysis (LFA)** is correct.

Cen, Koedinger and Junker described LFA as a semi-automated method combining a statistical learning model, human expertise, and combinatorial search to evaluate and improve cognitive models. citeturn8view0 Later work makes the search process explicit: candidate features are supplied in a **P-matrix**, alternative KC models are generated through operations including splitting, merging, or adding factors, and candidate models are compared using AFM fit measures such as AIC/BIC and, importantly, cross-validation. citeturn13view1turn13view2

This is genuine prior art for questions such as:

> Is this KC too coarse and better split?

> Are these two KCs empirically indistinguishable and better merged?

> Is this item assigned to the wrong KC?

> Does adding a candidate feature explain an anomalous group of problems?

But LFA has a critical limitation for MindCraft: **it searches within the factor space humans supply**. Stamper and Koedinger explicitly describe LFA as using a human-authored P-matrix of possible factors. It cannot discover an arbitrary semantic concept hierarchy that was never represented in that candidate space. citeturn13view3turn13view4

So:

**LFA is a future empirical refinement method for the KC/Q-matrix layer. It is not the right method for initially deciding which of 42 broad concepts should contain each of 179 ingredients.**

### The data requirement rules LFA out today

This is not a marginal sample-size concern.

A published geometry example associated with the LFA/AFM workflow used **5,104 student-step observations from 59 students for 10 KCs**. citeturn13view4

Koedinger, McLaughlin and Stamper's broader automated-model-improvement evaluation covered 11 tutoring datasets with approximately **41–318 students** per dataset and used ten-fold cross-validation to compare KC models. citeturn13view2

There is no universal theorem saying “LFA requires exactly X observations.” Requirements depend on KC coverage, number of candidate factors, overlap among item Q-vectors, learners, and opportunity counts. But **148 observations spread over 179 ingredients means there is less than one observation per ingredient on average** before even considering repeated practice or independent students.

Performance data therefore cannot presently answer P2.

The right target should eventually be expressed in **coverage**, not merely total rows: repeated observations for each KC, across many learners and several practice opportunities, plus enough comparable items to distinguish candidate KCs. With 179 KCs, even “dozens of useful observations per KC” implies at least low tens of thousands of interactions. That is an engineering inference from the model dimension and the scales in published LFA work, not a claimed universal threshold. citeturn13view2turn13view4

### There is a much better immediate external scaffold

A particularly strong finding is the current **Learning Commons Knowledge Graph**.

Its Math Learning Components dataset describes granular K–12 mathematical skills or individual concepts that can operate at the level of a lesson, activity, or even a single question. It explicitly connects those fine-grained components to Common Core and numerous state standards through `LearningComponent → supports → StandardsFrameworkItem` relationships. citeturn22search0turn22search2

That architecture is strikingly similar to MindCraft's desired restructure:

**fine ingredient/KC layer → derived broader curriculum layer.**

More importantly, Learning Commons states that its Knowledge Graph and the Achievement Network Math Learning Components are provided under **CC BY 4.0**, which permits commercial use subject to attribution. citeturn19search0turn22search2

So the Monday recommendation for P2 is:

1. Make ingredient→concept explicitly **many-to-many**.
2. Represent different semantics separately—at minimum `is_part_of`, `supports`, and `prerequisite_for`.
3. Align the 179 ingredients against Learning Commons Math Learning Components and standards.
4. Human-adjudicate the candidate alignments.
5. Record provenance/confidence on every edge.
6. Derive the 42-concept view from that graph.
7. Later, when interaction data is large enough, use LFA to challenge the item→ingredient structure and propagate accepted ontology revisions upward.

That is substantially more defensible than asking 148 observations—or an LLM alone—to infer 179×42 membership decisions.

## What changes for P3

### AFM and PFA are the right literature, but they cannot be estimated now

Your leads are correct.

**AFM**, the Additive Factors Model, predicts performance using KC-level terms, learner ability, and practice opportunities. In the standard formulation used in KC-model comparison, response probability depends on a learner term, KC easiness/difficulty terms, and KC learning-rate terms accumulated through opportunity counts. citeturn13view0turn8view1

**PFA**, Performance Factors Analysis, modifies that logic by replacing a simple number-of-practice-opportunities term with separate histories of prior successes and prior failures for a KC. citeturn9view1

Both therefore implement the pooling intuition you remembered: they can learn at the **KC level rather than estimating a completely independent parameter for every item**.

There is, however, a second correction:

> **Neither AFM nor PFA automatically gives different predictions to items that have the same KC vector and the same learner history.**

Moving from concept-level to ingredient-level prediction only fixes the “all questions in a concept look identical” problem when questions genuinely have different ingredient/Q vectors—or when you introduce additional authored/content features. AFM/PFA are not secretly per-item difficulty models.

### The parameter count is fatal at 148 rows

With 179 KCs and two users, a conventional AFM parameterization requires roughly:

`2 learner terms + 179 KC intercept/easiness terms + 179 KC learning slopes ≈ 360 parameters`.

A conventional PFA with a KC baseline plus success and failure effects is roughly:

`179 × 3 ≈ 537 parameters`.

Exact counts can shift slightly according to intercept/coding conventions, but neither is remotely data-identified by **148 binary observations**.

Regularization or Bayesian priors could still return numerical estimates, but that would not mean the 148 responses identified hundreds of effects; it would mostly mean the priors or shrinkage chose among underdetermined solutions.

The scale of the original PFA experiments reinforces the point. Pavlik, Cen and Koedinger evaluated PFA variants on datasets of approximately **40,930, 44,780, 46,570, and 101,000 observations**. citeturn9view2 Those are examples rather than mandatory minima, but they put 148 observations in the correct perspective.

So the answer the prompt explicitly permitted is the honest one:

**AFM/PFA require far more data than MindCraft currently has. Do not fit them yet.**

### The small-data replacement

The near-term engine should make item predictions different through **known item structure**, not newly estimated free item effects.

Use the ingredient/Q-vector plus a deliberately small set of authored or deterministic content features—for example required-KC count, prerequisite depth, representation type, procedural complexity, and authored difficulty—and keep any learned parameter count extremely small or strongly regularized.

Most importantly, start logging data in AFM/PFA-ready form now:

`user_id`  
`item_id`  
`item Q-vector`  
`response order/timestamp`  
`correctness`  
`selected distractor`  
`misconception tag`  
`prior opportunities per KC`  
`prior successes per KC`  
`prior failures per KC`

That converts P3 from an unsolvable modeling problem today into an estimable one after sufficient usage.

The current Brier result should therefore be interpreted conservatively: the concept-level model failed to beat the constant baseline on this tiny, non-representative test—not as evidence that ingredient/KC structure has no predictive value.

## Eedi correction and reusable prior art

There is an important provenance correction.

The **NeurIPS 2020 Education Challenge** did use an Eedi diagnostic-question dataset. Microsoft Research describes that competition as working with educational MCQs whose distractors embody misconceptions and as posing four large-scale data-mining tasks; nearly 400 teams participated. citeturn25view3

But the dataset with the **fine-grained misconception-label mapping task** relevant to your 1,749 misconception descriptions is the later **2024 Kaggle “Eedi – Mining Misconceptions in Mathematics”** competition. Eedi's own retrospective explicitly distinguishes that competition from its NeurIPS 2020 dataset. citeturn25view0

A 2025 paper using the later dataset reports the full corpus as **1,857 K–12 questions, 7,428 answer choices, 4,338 misconception-labelled answer choices, and 2,587 unique misconceptions**. citeturn23view3 Your 1,508 questions / 3,835 distractor slots / 1,749 misconceptions should therefore be treated as a local filtered or transformed subset rather than the published full-corpus counts.

The search found several strands of work using those misconception annotations—including recent misconception inference and distractor-generation research—but **did not find a published reusable crosswalk from the Eedi misconception taxonomy to a general secondary-mathematics KC taxonomy**. Ross et al.'s 2025 MISTAKE work, for example, explicitly evaluates inferring a misconception from an incorrect answer and ranks against the Eedi misconception bank, but it remains misconception-label inference rather than misconception→external-KC alignment. citeturn23view3

That is a useful negative result: **the exact final crosswalk MindCraft needs does not appear to be a solved downloadable artifact**.

The method family is solved much better than the taxonomy alignment.

## Licensing and adoption decision

Licensing materially changes the recommendations.

**Learning Commons Math Learning Components — CC BY 4.0:** commercially usable with attribution and the strongest reusable artifact found for P2. It covers K–12 mathematics and explicitly decomposes broad standards into granular skills/concepts. citeturn22search0turn19search0

**Learning Commons progression/standards graph — CC BY 4.0:** useful for prerequisite/progression structure. Learning Commons reports that some source progression material was received under CC0 and publishes the resulting graph relations under CC BY 4.0. citeturn19search2

**Eedi Mining Misconceptions data — CC BY-NC 4.0:** **not suitable for ingestion into MindCraft's commercial product without separate permission.** Kaggle states the competition-data terms as CC BY-NC 4.0. citeturn26search0turn26search3

**Eedi first-place solution code — MIT:** commercially usable as code subject to the MIT terms, but that license does not override the NC license on the underlying competition data or automatically sanitize derivative datasets. citeturn26search2

**`labelbank` — MIT:** particularly interesting because it generalizes the Eedi retrieve/rerank solution into a closed-label-bank library instead of shipping only competition-specific logic. citeturn26search4

**Junyi Academy learning dataset — CC BY-NC-SA 4.0:** not commercially ingestible under MindCraft's stated requirement. citeturn26search1

**Illustrative Mathematics requires edition-level care:** its older first-edition materials are CC BY 4.0, while current IM v.360 curriculum materials are generally CC BY-NC 4.0. The latter should not be casually ingested into a commercial product. citeturn19search1turn19search7 Learning Commons separately publishes certain IM-related scope/sequence graph data with its own CC BY 4.0 attribution statements; those specific graph records should be treated separately from the underlying curriculum. citeturn19search8

**CMU DataShop and ASSISTments:** useful research sources, but this review did not establish a blanket commercial-content license covering their public KC/Q-matrix datasets. DataShop explicitly supports project-specific terms of use, so “public dataset” should not be treated as synonymous with “commercially reusable.” citeturn20search0turn20search1

The resulting adoption order is therefore clear:

**First choice:** Learning Commons for the external skill/hierarchy scaffold.  
**Method/code choice:** MIT-licensed Eedi retrieve/rerank implementations for P1 architecture.  
**Research-only unless separately licensed:** Eedi misconception content, Junyi, and any dataset without explicit commercial-compatible terms.

The strongest overall conclusion is that MindCraft has **not** invented an alien ontology scheme: ingredients really are KCs, and question→ingredient assignments really are Q-matrix/KC-model assignments. The mistake is narrower and fixable: **misconception diagnosis, Q-matrix assignment, and curriculum containment are three different relations and should be modeled, validated, and licensed independently.**