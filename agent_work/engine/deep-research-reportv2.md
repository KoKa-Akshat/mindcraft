# Research: Using Ingredient Co-Occurrence to Map Misconceptions in MindCraft

## Executive finding

Your first idea is worth keeping, but I would change its interpretation.

**Build the ingredient co-occurrence structure. Do not treat it as a map of where mathematical ideas “really live.”** Treat it as a map of **which ingredients are jointly invoked by the item bank**. With a question-to-ingredient matrix \(Q\), the obvious ingredient graph is \(Q^\top Q\). Because a question can require three, four, or more ingredients simultaneously, the mathematically cleaner representation is actually a **hypergraph**, where each question is a hyperedge joining its ingredient set. Spectral/hypergraph methods were developed specifically because converting a multi-object relation into pairwise edges can discard information; Zhou, Huang, and Schölkopf's 2006 NeurIPS paper is the canonical reference for spectral hypergraph embedding. citeturn20view6

The more important conclusion is that **misconceptions should not be given an independent geometric position and then matched to nearby ingredients**. Your discomfort with that is justified. A misconception and an ingredient are not necessarily two objects of the same type living in one latent semantic manifold. The literature on cognitive diagnosis explicitly allows **skills and misconceptions to coexist** rather than defining a misconception as simply the absence, opposite, or corruption of one skill. Kuo, Chen, and de la Torre's model was designed precisely to identify mastered skills and misconceptions simultaneously. citeturn21search0turn21search1

Instead, I recommend a **typed heterogeneous hypergraph**:

\[
\text{Concept}
\longleftrightarrow
\text{Ingredient}
\longleftrightarrow
\text{Question}
\longleftrightarrow
\text{Distractor}
\longleftrightarrow
\text{Misconception}.
\]

The misconception does not need an intrinsic coordinate. Its location relative to ingredients is **induced by observed bridges**: which distractors express it, which questions those distractors belong to, and which ingredients those questions exercise. Concepts can remain in this graph, but only as a **soft prior / organizational layer**, not as the gate that determines which ingredients a misconception is allowed to reach.

That distinction fixes the biggest defect in the previous system. Collapsing fine-grained Eedi constructs into 26 concepts and then limiting misconception assignment to the ingredients underneath one concept throws away exactly the cross-concept information that could disambiguate the error. In the 2024 Eedi misconception dataset, Eedi itself describes each `Construct` as a skill and as the **most granular level of knowledge relevant to the question**. So calling those Eedi constructs “KC-like” is reasonable, even though Eedi's terminology is *Construct* rather than *knowledge component*. citeturn17search0

There is one major catch, however:

> **Question-level ingredient co-occurrence by itself cannot distinguish different misconceptions attached to different distractors of the same question.**

Suppose question \(q\) uses ingredients \(\{A,B,C\}\), and its three wrong answers correspond to misconceptions \(m_1,m_2,m_3\). If all you know is

\[
q \rightarrow \{A,B,C\},
\]

then all three misconceptions initially inherit the same ingredient evidence:

\[
m_1,m_2,m_3 \rightarrow \{A,B,C\}.
\]

The graph only starts separating them when the **same misconception reappears across different questions with different ingredient combinations**, or when you add **option-level information** that says what distinguishes one distractor from another. This is exactly why multiple-choice cognitive-diagnosis work models distractors explicitly rather than throwing them away. De la Torre's 2009 MC-DINA model allows skill structure to affect the choice of distractors, and DeCarlo's 2025 reparameterization describes MC-DINA as extending ordinary cognitive diagnosis by allowing skills to affect both correct-response and distractor choices. citeturn18search1turn20view1

So my overall recommendation is:

**Keep the graph idea. Make it a hypergraph. Do not use concepts as hard bridges. Use distractors as the actual bridge between misconceptions and ingredients. And represent some misconceptions as errors in relations/strategies among ingredients rather than forcing every misconception to belong to one ingredient.**

That is much closer to the established literature than either the current concept-restricted assignment pipeline or a pure text-embedding nearest-neighbor system.

## Vocabulary and the Eedi correction

There are really three different levels in what you are describing, and treating them as interchangeable is causing some of the conceptual difficulty.

| MindCraft object | Closest literature term | What I would call it internally |
|---|---|---|
| `concept`, e.g. Algebraic Manipulation | domain, topic, curricular concept, skill family | **concept** |
| `ingredient`, e.g. Factoring Polynomials or a more atomic mental operation | knowledge component, skill, attribute, production rule | **KC / ingredient** |
| question → ingredient set | Q-matrix row / KC attribution | **Q-matrix** |
| ingredient → concept(s) | skill hierarchy / attribute hierarchy / taxonomy membership | **ontology membership** |
| wrong option | distractor / incorrect option | **distractor** |
| misconception description | misconception, buggy rule, erroneous rule, error pattern | **misconception** |
| distractor → misconception | distractor diagnosis / misconception annotation | preserve as observed Eedi relation |
| misconception → ingredient | not one universally standardized object | **misconception–KC relation** rather than “membership” |

The important correction is that **KC does not have to mean your 26 coarse concepts**. The field's KC notion is intentionally grain-size dependent. Learning Factors Analysis, for example, treats the cognitive model as a collection of production rules or skills involved in solving problems and explicitly tries alternative decompositions of that model. citeturn20view5

For MindCraft, your 179 ingredients are therefore much closer to the useful KC grain than the 26 concepts. A concept such as “Algebraic Manipulation” is better understood as a **curricular family containing many KCs**, while something like “factor a quadratic by identifying two numbers with given sum and product” is much closer to a classical KC/production-rule description.

That makes the move you are considering—**allow an ingredient to belong to a set of concepts rather than exactly one concept**—a good one. It removes an arbitrary tree constraint from something that is naturally overlapping. It also lets an ingredient such as factoring legitimately belong to polynomial manipulation, algebraic manipulation, solving equations, and perhaps structure/expression concepts without duplicating the ingredient.

But multi-concept membership should solve **navigation and ontology structure**, not become the primary evidence for misconception mapping. Otherwise you have only changed

\[
\text{misconception}\rightarrow\text{one concept}\rightarrow5\text{ ingredients}
\]

into

\[
\text{misconception}\rightarrow\text{several concepts}\rightarrow20\text{ ingredients}.
\]

That is less brittle, but the underlying inference is still indirect.

There is also an Eedi-history distinction worth making because the datasets are easy to conflate. The **NeurIPS 2020 Education Challenge** used large-scale Eedi student response data—more than 20 million response examples—and posed tasks involving answer prediction, question quality, and personalized question sequencing. citeturn19search6turn20view7 The specific **distractor-to-textual-misconception** problem you are working from was released later as the 2024 Kaggle competition *Eedi — Mining Misconceptions in Mathematics*. Eedi describes that task as: given a distractor and a collection of misconception descriptions, identify the matching misconception. citeturn18search2turn18search18

That later dataset is especially useful for your problem because it gives you something more valuable than merely misconception text:

\[
\boxed{\text{misconception} \leftrightarrow \text{distractor} \leftrightarrow \text{question}}
\]

and the question already comes with an Eedi `Construct`, described by Eedi as its most granular skill. citeturn17search0

You should preserve that relational information rather than flattening it immediately into misconception → 26-concept labels.

## The ingredient co-occurrence idea is sound, with an important interpretation

Assume you finish the hard part and produce a multi-label question-to-ingredient matrix

\[
Q\in\{0,1\}^{N_q\times179},
\]

where

\[
Q_{ik}=1
\]

means that question \(i\) exercises ingredient \(k\).

Then the simplest ingredient co-occurrence matrix is

\[
C=Q^\top Q.
\]

Ignoring its diagonal,

\[
C_{ab}
=
\sum_i Q_{ia}Q_{ib}
\]

is the number of questions in which ingredients \(a\) and \(b\) appear together.

That is absolutely a legitimate graph.

What needs correcting is the semantics of an edge.

An edge

\[
A\longleftrightarrow B
\]

does **not** establish that A and B are psychologically similar, prerequisites of one another, parts of the same mental representation, or interchangeable. It establishes the narrower proposition:

> **The item bank frequently asks learners to use A and B together.**

That can be extremely valuable. It can reveal neighborhoods, highly central ingredients, bridge ingredients, clusters of commonly combined operations, disconnected parts of the ontology, and surprising cross-concept combinations. But it is partly a measurement of the **curriculum and item-authoring process**, not purely of cognition.

This is why I would call it a **KC co-use graph**, not a KC similarity graph.

### Why a hypergraph is better than a simple graph

Suppose one question requires

\[
\{A,B,C,D\}.
\]

Turning it into pairwise edges creates

\[
AB,AC,AD,BC,BD,CD.
\]

That representation makes six apparently independent pairwise relationships out of one single four-way observation. It loses the fact that what you actually observed was **one question jointly invoking the set \(\{A,B,C,D\}\)**.

Hypergraphs were designed precisely for this situation: an edge can connect more than two nodes. Zhou, Huang, and Schölkopf explicitly motivate their spectral hypergraph work by arguing that squeezing higher-order relationships into pairwise graphs loses information, then develop spectral clustering and embeddings directly from the hypergraph representation. citeturn20view6

For MindCraft, your Q-matrix is already the hypergraph incidence matrix:

\[
H = Q.
\]

Each row/question defines one hyperedge over ingredients.

So your “Laplacian embedding” intuition can be implemented almost literally as a **hypergraph Laplacian embedding**. The important change is conceptual: the resulting coordinates summarize item-bank co-use structure.

For inspection, you can still compute a pairwise projection. I would not use raw \(Q^\top Q\) alone, because very common ingredients become hubs simply because they occur everywhere. At minimum inspect normalized quantities such as

\[
\operatorname{cosine}(a,b)
=
\frac{C_{ab}}
{\sqrt{C_{aa}C_{bb}}}
\]

and

\[
J(a,b)
=
\frac{C_{ab}}
{C_{aa}+C_{bb}-C_{ab}}.
\]

These answer subtly different questions from raw frequency. Raw counts tell you “how often do these coexist?” while normalized scores tell you “how disproportionately often do they coexist given their individual prevalence?”

### What the embedding can genuinely give you

A useful spectral map might end up looking conceptually like this:

```text
       fraction operations
              ● A
             / \
            /   ● B
           /
      ● C ───── ● D ───────── ● E
   equivalence       algebraic manipulation
                        \
                         ● F
                           \
                            ● G
                         polynomial structure
```

The useful discoveries are not “D has coordinate (0.31, −0.82).” Spectral coordinates themselves have no independently meaningful absolute axes. What matters is relational structure: neighborhoods, clusters, paths, bridges, connected components, and stability of those relationships as questions are resampled.

This also gives you a principled way to evaluate your planned multi-concept memberships. If an ingredient is authored as belonging to concepts \(C_1,C_2\) and the question hypergraph repeatedly puts it in both neighborhoods, that is corroborating evidence. If the authored ontology and item-bank structure disagree strongly, that gives you a review queue. It is **evidence for refinement**, not an automatic decision rule.

Learning Factors Analysis is relevant at a later stage but is not the same thing. Cen, Koedinger, and Junker introduced LFA as a semi-automated way of improving a cognitive model by combining statistical performance modeling, human-proposed factors, and combinatorial search over alternative models. It relies on student performance data to choose among cognitive decompositions. citeturn20view5 Your hypergraph, by contrast, can be constructed entirely from **content annotations** before meaningful student-response data exists.

That is an advantage given your current 148-response constraint.

## The better model is a typed misconception–distractor–item–ingredient hypergraph

I would make the primary data model explicit rather than trying to force every entity into a shared embedding.

Let the node types be:

```text
Concept
Ingredient
Question
Distractor
Misconception
```

and the observed/authored relations be:

```text
Ingredient ──member_of────────▶ Concept
Question   ──requires─────────▶ Ingredient
Question   ──has_option───────▶ Distractor
Distractor ──expresses────────▶ Misconception
```

The first relation is your new many-to-many ontology.

The second is the Q-matrix you need to build.

The third and fourth largely exist in the Eedi data. The 2024 competition was explicitly constructed around predicting the affinity between incorrect answer choices and misconception descriptions. citeturn18search2turn18search6

What you eventually want to infer is a fifth relation:

```text
Misconception ──?─────────────▶ Ingredient
```

The key is: **do not require that relation to mean only “belongs to.”**

### Deriving misconception–ingredient evidence without semantic nearest neighbor

Suppose each Eedi distractor slot \(d\) has:

- parent question \(q(d)\);
- misconception \(m(d)\);
- question ingredient vector \(Q_{q(d),:}\).

You can immediately compute a misconception-by-ingredient context matrix:

\[
B_{mk}
=
\sum_{d:m(d)=m}
Q_{q(d),k}.
\]

In matrix notation, if \(R\) is distractor-slot × misconception incidence and \(S\) is distractor-slot × question incidence,

\[
B=R^\top S Q.
\]

This matrix has a very useful interpretation:

\[
B_{mk}
=
\text{number of labeled distractor contexts for misconception }m
\text{ whose questions exercise ingredient }k.
\]

That is not an LLM saying that the sentences are semantically similar.

It is not a concept restriction.

It is **observed relational evidence** from your dataset.

For a misconception that repeatedly appears on questions involving

```text
inverse operations
solving one-step equations
preserving equality
```

but almost never appears elsewhere, those ingredients become plausible candidates even if they sit under different MindCraft concepts.

I would normalize \(B\), because frequent ingredients will otherwise dominate every misconception. A useful score is conceptually

\[
\text{association}(m,k)
\propto
\frac{P(k\mid m)}{P(k)},
\]

or its log version. That asks:

> “Does this ingredient occur unusually often in the question contexts where this misconception appears?”

rather than merely:

> “Is this a common ingredient?”

### This gives you a principled way to “place” a misconception

After computing an ingredient spectral embedding \(z_k\), a misconception can be displayed at a weighted barycenter:

\[
z_m =
\frac{\sum_k w_{mk}z_k}
{\sum_k w_{mk}}.
\]

Here \(w_{mk}\) comes from the observed misconception-context matrix \(B\), not from pretending that the misconception text itself has a true mathematical coordinate.

That resolves your philosophical objection.

The misconception's plotted location means:

> “Given the questions on which this error has been observed, this is the part of the ingredient network with which it is associated.”

It does **not** mean:

> “This misconception ontologically exists at point \(x\) in the same latent space as mathematical knowledge.”

That is a much more defensible claim.

A recent 2026 AIED paper is interesting here because it independently moves in almost exactly this architectural direction. Guo, Xue, Lu, and Lin's **MisEdu-RAG** organizes pedagogical knowledge as a **concept hypergraph** and actual student mistake cases as a separate **instance hypergraph**, then retrieves across the two structures. It is an LLM/RAG paper rather than a psychometric validation paper, so I would not take its performance results as evidence that your mapping problem is solved. But structurally, it is strong evidence that separating **knowledge structure** from **mistake-instance structure** and connecting them relationally is a sensible modern design. citeturn18search19turn18search7

### The critical limitation: repeated misconceptions are what make this work

Here is where the first idea breaks if you push it too far.

Imagine:

```text
Question Q
ingredients = {A, B, C}

Distractor 1 → misconception M1
Distractor 2 → misconception M2
Distractor 3 → misconception M3
```

At the question level,

\[
B_{M_1,:}=B_{M_2,:}=B_{M_3,:}=\{A,B,C\}.
\]

Nothing in the ingredient co-occurrence graph tells you whether:

```text
M1 is really about A
M2 is really about B
M3 is really about the B→C transition
```

because all three wrong answers came from the same item context.

Now suppose \(M_1\) reappears on ten questions:

```text
Q1: {A,B,C}
Q2: {A,D}
Q3: {A,E}
Q4: {A,B,F}
...
```

The intersection / disproportionate commonality starts pointing strongly toward \(A\).

That is where your proposal becomes powerful: **repeated errors across different contexts can triangulate the responsible ingredient.**

On your own numbers, however, there are 3,835 tagged distractor slots and a catalog of 1,749 misconceptions—only **2.19 tagged slots per catalog misconception on average**. The distribution matters far more than the mean, but this immediately tells you to inspect recurrence before designing the system around triangulation.

I would calculate, before doing any embedding:

\[
n_m=\#\{\text{distractor slots labeled with misconception }m\}.
\]

Then inspect the full histogram of \(n_m\).

A misconception observed once has **no graph-based localization evidence beyond its one parent question**. Two occurrences give a very fragile intersection. Repeated occurrences across genuinely different questions are where this approach becomes substantively informative. Any numerical minimum such as “three” or “five” would be an engineering heuristic, not an established psychometric threshold; the better criterion is stability under question resampling.

That means the system should be comfortable returning:

```text
misconception M:
  evidence: insufficient
  candidate ingredients: {A, B, C}
  confidence: low
  reason: only one observed distractor context
```

rather than fabricating a single ingredient.

That is exactly the abstention property your current pipeline lacked.

## Misconceptions are not always “the wrong ingredient”

Your last sentence is probably the most important observation in the whole proposal:

> some misconceptions may use the right ingredients but use them in the wrong order.

Yes. That is a real structural case, and a binary question×ingredient Q-matrix cannot represent it.

A Q-row such as

\[
\{A,B,C\}
\]

is a **set**. It cannot distinguish

\[
A\rightarrow B\rightarrow C
\]

from

\[
A\rightarrow C\rightarrow B
\]

or from choosing the wrong strategy involving all three.

This is not merely theoretical. There are several strands of prior work showing why skills and incorrect procedures need more structure than “skill present / absent.”

Tatsuoka's classic **Rule Space** work was explicitly about diagnosing misconceptions as erroneous rules or “bugs” from response patterns, rather than equating every misconception with failure to possess a correct skill. citeturn22search1 Later cognitive-diagnosis work has explicitly modeled **multiple strategies** for solving the same task; Huo and de la Torre's 2014 model is literally titled *Estimating a Cognitive Diagnostic Model for Multiple Strategies via the EM Algorithm*. citeturn22search2 And Kuo, Chen, and de la Torre's skills-and-misconceptions model was motivated by the fact that a learner may possess skills and misconceptions simultaneously. citeturn21search0turn22search6

So I would not define the final misconception map as

\[
M\rightarrow K.
\]

I would define it more generally as

\[
M\rightarrow f(K_1,K_2,\ldots,K_r).
\]

The simplest implementation is to let a misconception relate to **a set of ingredients plus an error relation**.

For example:

```text
"Thinks the inverse of subtraction is multiplication"

ingredients:
  - inverse_operations
  - subtraction
  - division_or_multiplication_relationships

mechanism:
  incorrect_relation

more specific representation:
  substitutes_inverse(subtraction, multiplication)
```

Another error might be:

```text
"Expands before resolving the exponent"

ingredients:
  - exponentiation
  - distributive_property

mechanism:
  misordered_operations

relation:
  applies_before(distribution, exponentiation)
```

And another:

```text
"Cancels terms across addition"

ingredients:
  - simplifying_fractions
  - addition
  - common_factors

mechanism:
  overgeneralized_rule
```

I do **not** find a single established educational-data-mining standard requiring exactly those relation labels. That small relation vocabulary would be a MindCraft design choice. But the literature clearly supports the broader point that incorrect responses can reflect erroneous rules, alternative strategies, and misconceptions that coexist with correct skills rather than simply missing attributes. citeturn22search1turn22search2turn21search1

This suggests a particularly useful evolution of the ingredient ontology:

**Do not require every ingredient to be a noun-like mathematical topic. Some ingredients may legitimately be relational/procedural mental models.**

For example:

```text
use inverse operation
preserve equality when transforming
apply operations in precedence order
reverse the order of inverse transformations
recognize a common factor
choose a valid factorization pair
```

Those are much closer to classical KCs/production rules than coarse labels such as “Algebra.”

Then a “wrong order” misconception may actually expose a missing or malformed **relational KC**, even though all of the object-level KCs are present.

### Distractors are the missing layer

This is also why I think your 3,835 distractor slots are much more strategically important than the old 655 direct misconception→ingredient assignments.

Multiple-choice cognitive diagnosis has a direct precedent here. De la Torre's MC-DINA was developed because dichotomizing an item to right/wrong discards diagnostic information contained in *which incorrect option was chosen*. citeturn18search1 DeCarlo's 2025 analysis restates the central idea explicitly: the model allows skills to influence the choice of distractors, not merely the probability of getting the item correct. citeturn20view1

You do **not** have enough response data to fit a serious 179-KC MC-DINA model now. But you can steal its structural insight without fitting its psychometric parameters:

\[
\boxed{\text{annotate at the option level, not just the question level}.}
\]

In other words, eventually distinguish:

```text
question.requires = {A, B, C}

correct_option.path = {A, B, C}

distractor_1.failure_signature = missing(B)
distractor_2.failure_signature = substitute(B, D)
distractor_3.failure_signature = wrong_order(B, C)
```

That is much richer than:

```text
question.ingredients = {A, B, C}
```

and explains exactly why different misconceptions can emerge from the same problem.

I would not attempt to manually author this for all 3,835 distractors immediately. First use recurrence across questions to infer the easy cases. The ambiguous within-question cases then become a targeted review set.

## Data requirements and how to validate this without fooling yourselves

There are three entirely different kinds of “data requirement” here, and they should not be mixed together.

### The ingredient graph does not need student-response data

This is the good news.

Once you have question→ingredient labels, the hypergraph

\[
Q
\]

is constructed from **questions**, not student attempts.

Your 148 responses from two testers therefore do not prevent you from building the ingredient co-use map.

With 179 ingredients there are

\[
\binom{179}{2}=15{,}931
\]

possible pairwise ingredient relationships, but you do not need to observe all of them. A useful curriculum graph will naturally be sparse. The real data questions are:

- how many independent questions exercise each ingredient;
- how many distinct ingredient combinations it appears in;
- whether the resulting hypergraph is connected or fragmented;
- whether an ingredient's nearest neighbors remain similar when questions are resampled;
- whether a handful of ubiquitous ingredients dominate the graph.

Those quantities should determine whether a node is sufficiently supported to interpret.

I would explicitly report **bootstrap neighborhood stability**. Repeatedly sample questions, rebuild the graph, and ask whether an ingredient keeps roughly the same nearest neighbors/community. An ingredient that moves dramatically between resamples should be displayed as uncertain rather than assigned a compelling-looking fixed coordinate.

### Misconception localization needs repeated distractor contexts

The limiting observation count for

\[
\text{misconception}\rightarrow\text{ingredient}
\]

is not the number of student responses either. It is initially the number of independently tagged **distractor contexts per misconception**.

This is why your 3,835 distractor slots are potentially useful today.

But the 2.19-slots-per-catalog-misconception average is a warning. A graph method cannot magically triangulate a misconception that occurs once.

I would therefore divide misconceptions into evidence tiers based on the actual recurrence distribution, but determine the cutoffs from **stability**, not from an arbitrary count. For each misconception \(m\):

1. infer its ingredient-association vector from all but one of its questions;
2. predict the held-out question's relevant ingredient neighborhood;
3. repeat over occurrences;
4. bootstrap those occurrences and measure how stable its top candidate ingredients remain.

Where there is one occurrence, there is nothing to cross-validate. Mark it as structurally underdetermined.

### Psychometric validation absolutely does need much more response data

This is where the 148 observations remain a hard stop.

The established Q-matrix validation literature operates by asking whether student-response patterns are better explained by alternative skill specifications. De la Torre's 2008 paper was explicitly developed to empirically validate a provisional Q-matrix under DINA rather than simply assuming that expert Q-matrix assignments are correct. citeturn23search0 De la Torre and Chiu later generalized empirical Q-matrix validation beyond the original procedure. citeturn23search10

Learning Factors Analysis has the same basic dependency: it statistically compares candidate cognitive models using student performance while combining those statistics with human-proposed cognitive factors and model search. citeturn20view5

Those are excellent **future** validators for MindCraft. They are not credible validators with two non-representative users and 148 total interactions.

This is not just a generic “more data is better” objection. Even work explicitly motivated by **small educational programs** starts from the observation that ordinary cognitive-diagnosis parameter estimation is normally used where hundreds or thousands of examinees are available and introduces nonparametric alternatives because classroom-level sample sizes make conventional estimation unreliable. citeturn23search2turn23search14 You have 148 *interactions*, not 148 independently sampled students, spread over 179 candidate ingredients. As an identifiability/design inference, that is nowhere close to enough to estimate student mastery, item effects, multi-KC structure, and misconception effects separately.

So I would draw a sharp line:

| Question | Can you do it now? | Data source |
|---|---:|---|
| Build ingredient co-use hypergraph | **Yes** | authored/classified questions |
| Find frequent ingredient combinations | **Yes** | question→ingredient Q-matrix |
| Project recurring misconceptions into ingredient neighborhoods | **Yes, cautiously** | Eedi distractor labels + Q |
| Distinguish several misconceptions on one item from Q alone | **No** | need recurrence or option-level evidence |
| Validate Q using student performance | **No** | need much larger, representative response set |
| Fit 179-KC DINA/MC-DINA/SISM | **No** | far more response data |
| Use LFA to choose between broad ontology alternatives | **Not credibly yet** | longitudinal performance data |
| Use concepts to restrict ingredient candidates | **You should stop doing this** | introduces avoidable structural error |

The original Eedi NeurIPS challenge illustrates the scale difference: it was built around more than 20 million student-answer examples. That does not mean you literally require millions, but it makes clear that the literature's performance-driven machinery was developed in a radically different data regime from two testers and 148 observations. citeturn19search6

### The co-occurrence graph cannot validate the Q-matrix that created it

This deserves emphasis because it is the easiest failure mode in the new idea.

Suppose an LLM mistakenly tags many questions as ingredient \(A\) when they should be \(B\).

You calculate

\[
Q^\top Q
\]

from those labels.

The graph will faithfully embed the **mistake**.

It may even reinforce it, because the erroneously tagged questions make \(A\) look connected to all of \(B\)'s natural neighbors.

Therefore:

\[
\boxed{\text{the graph is not an independent validator of the Q-matrix}.}
\]

It is downstream of the Q-matrix.

Your independent validation must come from somewhere else. Right now, the strongest feasible source is a **small human-labeled test set**, plus held-out Eedi distractor relations. Later, student performance can supply empirical Q-matrix validation of the kind developed by de la Torre and colleagues. citeturn23search0turn23search10

For the question→ingredient classifier, I would preserve the lessons from your failed misconception mapper:

**classify globally, multi-label, and permit abstention.**

Concepts may increase the prior probability of some ingredients, but never make the probability of ingredients outside the concept exactly zero.

## Recommended MindCraft design

I would implement the restructure in this order.

### Make ingredients primary and concepts many-to-many metadata

Your proposed change is correct:

```text
ingredient
    ↕
{concept_1, concept_2, ...}
```

rather than

```text
concept
    └── ingredient
```

The concepts remain useful for navigation, curriculum organization, explaining the system to users, retrieval, and priors. They cease to be a partition of the mathematical knowledge space.

Do not ask “which single concept owns this ingredient?” Ask:

\[
P(C\mid K)
\]

or simply maintain a reviewed set of concept memberships.

This by itself removes the catastrophic failure mode where a wrong concept choice eliminates the correct ingredient before classification starts.

### Build one global item-to-ingredient Q-matrix

For every question, determine a multi-label ingredient set over the full 179:

\[
q_i\subseteq K.
\]

The classifier should be able to return:

```text
strong:
  - ingredient_A
  - ingredient_B

possible:
  - ingredient_C

abstain:
  false
```

or:

```text
strong: []
possible:
  - ingredient_X
  - ingredient_Y
abstain: true
reason: ontology appears to lack required mental model
```

A missing ingredient should become an ontology-development signal, not an instruction to choose the least-wrong existing ingredient.

This global Q-matrix is the foundation. Your instinct is right that **good question→ingredient classification remains the central dependency**. The graph does not eliminate that dependency. What it does is make the downstream misconception mapper less brittle and create additional consistency signals for reviewing the Q-matrix.

### Build the ingredient hypergraph from the Q-matrix

Use

\[
H=Q
\]

as the canonical representation.

Generate \(Q^\top Q\), cosine/Jaccard projections, and a spectral/hypergraph embedding as derived views.

Do not persist the 2-D coordinates as ontology truth. Persist the incidence data and recompute embeddings.

The Zhou-Huang-Schölkopf hypergraph framework is the closest formal precedent for exactly this “sets of entities repeatedly co-occur in observations” situation. citeturn20view6

### Derive misconception evidence through distractor contexts

Preserve:

```text
misconception → distractor → question → ingredients
```

and compute the misconception×ingredient context matrix \(B\).

Concepts can contribute an additional prior:

\[
P(K\mid M)
\propto
P(\text{observed distractor contexts}\mid K)
\times
P(K\mid\text{concept information}),
\]

but the concept term should be soft.

That gives you exactly what your earlier pipeline lacked: a misconception can escape the original 26-concept collapse when its actual distractor evidence points elsewhere.

### Add option-level structure where the graph is ambiguous

When several misconceptions originate from the same item, question-level ingredients cannot separate them.

Those cases should become a targeted queue for an extended representation inspired by multiple-choice cognitive diagnosis:

```text
item:
  ingredients: [A, B, C]

options:
  correct:
    successful_path: [A, B, C]

  distractor_1:
    misconception: M1
    error_relation:
      type: omission
      ingredient: B

  distractor_2:
    misconception: M2
    error_relation:
      type: substitution
      expected: B
      used: D

  distractor_3:
    misconception: M3
    error_relation:
      type: sequencing
      before: C
      after: B
```

De la Torre's MC-DINA and subsequent work provide strong prior art for treating distractors as cognitively informative response categories rather than undifferentiated wrong answers. citeturn18search1turn20view1

I would **borrow the representation before borrowing the estimator**. The estimator needs more student data than you have; the representational insight is useful immediately.

### Let misconception mappings be distributions, not mandatory one-to-one links

The output should not necessarily be

```text
misconception M → ingredient A
```

but something like

```text
misconception M

associated ingredients:
  A: 0.63
  B: 0.51
  C: 0.14

relation hypothesis:
  A ↔ B: incorrect inverse relationship

evidence:
  distractor_occurrences: 7
  distinct_questions: 6
  distinct_concept_contexts: 3

stability:
  high

human_review:
  not_required
```

Another may correctly remain:

```text
misconception M

associated ingredients:
  A: 0.42
  B: 0.39
  C: 0.36

relation hypothesis:
  unknown

evidence:
  distractor_occurrences: 1

stability:
  indeterminate

human_review:
  required
```

That second result is not a failure. It is the truthful answer that the old forced-choice system could not express.

### Validate by withholding relations, not by asking the same LLM twice

A particularly clean experiment is available once you have the Q-matrix.

Take misconceptions with several distractor occurrences. For each misconception:

1. remove every distractor from one held-out **question**;
2. infer its ingredient distribution from its remaining questions;
3. ask whether that distribution assigns high probability to the ingredients tagged on the held-out question;
4. repeat across questions.

Split by question, not distractor slot. Otherwise two distractors from one item leak the identical question-level ingredient annotation into train and test.

Then compare at least these models:

```text
A. concept-only baseline
B. text-embedding misconception→ingredient
C. current LLM mapping
D. distractor-context hypergraph
E. text + distractor-context + soft concept prior
```

Your hypothesis is not established until D or E beats the concept-only and text-only baselines on **independent human mappings** or other held-out relations.

Also bootstrap questions. An impressive two-dimensional cluster that disappears when 10% of questions are removed is not a meaningful ontology discovery.

### Keep future student-response evidence as a separate layer

Once you have enough real learners, add another source of evidence:

```text
content structure:
question ↔ ingredient

error structure:
distractor ↔ misconception

performance structure:
student responses over questions/options
```

At that point, Learning Factors Analysis becomes useful for testing proposed split/merge/context factors, while empirical Q-matrix validation can test whether particular ingredient assignments improve response-model fit. LFA's original contribution was specifically to combine human-proposed cognitive factors, statistical modeling, and combinatorial search rather than attempting to invent a cognitive model wholesale. citeturn20view5 Empirical Q-matrix validation was likewise developed because simply assuming the expert Q-matrix to be correct can leave model misfit attributable to incorrect attribute assignments undetected. citeturn23search0

That later phase should be treated as **validation of the authored structure**, not a replacement for the ontology, which matches MindCraft's requirements.

The architecture I would ultimately aim for is therefore:

```text
                         ┌──────────────┐
                         │   Concept    │
                         └──────┬───────┘
                                │ many-to-many
                                │ soft ontology
                         ┌──────▼───────┐
                         │  Ingredient  │
                         │     KCs      │
                         └──────┬───────┘
                                │ Q-matrix
                     ┌──────────┴──────────┐
                     │                     │
              ┌──────▼──────┐       co-use hypergraph
              │  Question   │       / spectral view
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ Distractor  │
              └──────┬──────┘
                     │ observed Eedi label
              ┌──────▼──────────┐
              │ Misconception   │
              └──────┬──────────┘
                     │
                     │ inferred, typed,
                     │ probabilistic relation
                     ▼
          ┌──────────────────────────┐
          │ ingredient(s)/relations │
          │ omission                │
          │ substitution            │
          │ wrong relation          │
          │ wrong ordering          │
          │ overgeneralized rule    │
          └──────────────────────────┘
```

The resulting verdict on your original idea is therefore quite specific:

**The Laplacian/co-occurrence idea is good, but the ingredient embedding should be a derived view of a question–ingredient hypergraph. Do not independently embed misconception text and use spatial proximity as truth. Project misconceptions into that structure through their observed distractor/question contexts. Do not use the 26 concepts as a hard bridge; use multi-concept membership as a soft prior. Most importantly, introduce an option-level or relation-level representation because some misconceptions are not “the wrong KC”—they are the right KCs combined by the wrong rule, strategy, or order.**

That design preserves the appealing part of the first idea while avoiding the hidden assumption that ingredients and misconceptions must be points of the same ontological kind. It also converts a weakness of the Eedi data—the fact that misconceptions are attached to wrong options rather than directly to skills—into the central bridge of the model, which is much closer to how the cognitive-diagnosis literature has historically treated informative distractors. citeturn18search1turn21search1turn22search1