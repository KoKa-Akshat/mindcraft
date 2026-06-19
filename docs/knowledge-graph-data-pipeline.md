# MindCraft — Knowledge Graph & Data Pipeline
### Engineering Onboarding Doc · June 2026

> **Purpose.** This document explains how MindCraft's learning-intelligence layer works end-to-end — from raw past-paper data through the concept graph, student-state model, pathfinder, and into question generation. It is written for a new engineer who can read Python and TypeScript. Every design decision cites the research it comes from, and every loophole is flagged explicitly.

---

## Table of Contents
1. [System map — one paragraph](#1-system-map)
2. [Layer 1 — Knowledge Ontology](#2-layer-1--knowledge-ontology)
3. [Layer 2 — Concept Embeddings](#3-layer-2--concept-embeddings)
4. [Layer 3 — Per-Student Graph (Mastery + Edge State)](#4-layer-3--per-student-graph)
5. [Layer 4 — Pathfinder](#5-layer-4--pathfinder)
6. [Layer 5 — Question Generation](#6-layer-5--question-generation)
7. [Layer 6 — Diagnosis (Prep Flow entry point)](#7-layer-6--diagnosis)
8. [Layer 7 — Past-Paper Ingestion (data pipeline)](#8-layer-7--past-paper-ingestion)
9. [How it all connects (data flow diagram)](#9-data-flow-diagram)
10. [Loopholes — what is NOT wired up yet](#10-loopholes)
11. [Improvement roadmap — new ML and AI trends](#11-improvement-roadmap)

---

## 1. System Map

A student describes their exam and their struggles. Claude Sonnet diagnoses gaps against the exam blueprint and returns a ranked gap list. For each gap, a Groq/Llama question-generator produces adaptive practice questions at three difficulty levels. In parallel, a Python FastAPI server maintains a probabilistic knowledge graph per student — tracking concept mastery, Bayesian edge weights, and semantic embeddings — to power a prerequisite-chain pathfinder that orders what the student should study next. Past exam papers are ingested locally and indexed, but **are not yet feeding into live question generation** (see §10).

---

## 2. Layer 1 — Knowledge Ontology

**File:** `ml/mindcraft_graph/loaders/complete_ontology_loader.py`, `ml/data/ontology_complete.json`

The ontology is a directed graph of **concepts** and **edges**.

### 2.1 Concepts

Each concept has:
- `id` — snake_case identifier (e.g. `quadratic_equations`)
- `level` — foundational / core / advanced
- `typical_order` — index position in the JSON (used as a difficulty proxy)
- `ingredients` — sub-skills within the concept (finer grain than concept)
- `failure_prior` — estimated probability a student fails this concept on first attempt

At the ingredient level, each ingredient has `card_templates` (three representations: algebraic, visual, contextual) and a `comes_from` field that encodes intra- and cross-concept dependencies.

### 2.2 Edges

Three explicit edge types:
| Type | Meaning | Prior pseudo-count |
|---|---|---|
| `prerequisite` | Must know A before B | 20 (very hard to override) |
| `related` | Similar skills, transfer is expected | 8 |
| `application` | B applies skill from A in a new context | 5 |

A fourth type, `discovered`, is created at runtime when a student studies two concepts within a 2-hour window — suggesting they co-occur in their learning.

**Research basis.** The concept-graph structure follows the knowledge-space framework of Doignon & Falmagne (1985) *Spaces for the assessment of knowledge*, later formalized as Knowledge Space Theory (KST). The ingredient-level decomposition mirrors Cognitive Task Analysis (Clark et al., 2008) and the CMAP tool used in ITS design (VanLehn, 2011 — *The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems*, Educational Psychologist 46(4)).

### 2.3 Subject Graphs (new — `ml/data/subject_graphs/`)

Three small JSON graphs exist for non-math subjects (accounting, piano basics, writing essays). These are proof-of-concept; the structure mirrors the math ontology but has not been loaded into the inference pipeline.

---

## 3. Layer 2 — Concept Embeddings

**File:** `ml/mindcraft_graph/representation/embeddings.py`

Each concept is converted to a 384-dimensional dense vector using **all-MiniLM-L6-v2** (Reimers & Gurevych, 2019 — *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks*, EMNLP 2019). The input text is `"{concept.name}. {concept.description}"`.

These vectors serve two purposes:
1. **Semantic similarity** — find concepts that are semantically close to ones the student is strong at (used in the pathfinder's Explore mode and supplement-finding).
2. **Student position** — a weighted sum of concept vectors, weighted by the student's mastery or strength score, places the student in the same space as the concepts.

PCA reduces the 384-dim space to 4 principal components for visualization and alignment scoring. The components are saved to `ml/data/pca_axes.npz` and loaded on server startup.

**Research basis.** Using a pretrained sentence encoder as a concept-space foundation follows work on knowledge-aware recommendation (Zhang et al., 2019 — *BERT4Rec: Sequential Recommendation with Bidirectional Encoder Representations from Transformer*, CIKM 2019) and semantic concept graphs in ITS (Piech et al., 2015 — *Deep Knowledge Tracing*, NeurIPS 2015).

---

## 4. Layer 3 — Per-Student Graph

**Files:** `ml/mindcraft_graph/engine/update.py`, `ml/mindcraft_graph/engine/edge_weights.py`, `ml/mindcraft_graph/engine/decay.py`

### 4.1 Concept Mastery Model

For each concept the student has interacted with, MindCraft maintains a `ConceptMastery` object:

```
mastery = σ(β₀ + β₁·log(exposure+1) + β₂·avg_outcome + β₃·recency)
```

where:
- `β₀ = −2.0` (low mastery by default — pessimistic prior)
- `β₁ = 0.8` (log-exposure: each session contributes, but with diminishing returns)
- `β₂ = 1.5` (outcome: strongest signal)
- `β₃ = 0.3` (recency: recent activity is a small boost)
- `σ` is the logistic function

Recency decays with a 30-day half-life. The **evidence** (cumulative_outcome) decays with a **60-day half-life** — mastery fades if not practiced.

**Research basis.** The logistic mastery model is a simplified version of Additive Factor Models (Cen et al., 2006 — *Learning Factors Analysis*, ITS 2006) and Performance Factor Analysis (Pavlik et al., 2009 — *Performance Factors Analysis*, AIED 2009). The recency/decay component is inspired by the Spacing Effect and Ebbinghaus's forgetting curve (1885/1913).

⚠️ **Loophole.** The coefficients (β₀–β₃) are hand-tuned. The comment in `update.py` says explicitly: *"These get fit from data later; for now we pick reasonable values."* There is no automated fitting pipeline yet. A proper IRT (Item Response Theory) or DKT (Deep Knowledge Tracing) fit on real student data would replace these.

### 4.2 Edge Weight Model

Each directed edge between concepts has a `Beta(α, β)` distribution representing the probability that mastering the source concept helps with the target.

On startup, the ontology's `strength` ∈ [0, 1] sets the prior:
- For a prerequisite edge with strength 0.9 and pseudo_total = 20: `α = 18, β = 2`

When two concepts co-occur within a 2-hour session, the joint success/failure outcome updates the edge Bayesian-style:
```
success = (outcome_A + outcome_B) / 2  →  mapped to [0,1]
α' = α + success
β' = β + (1 − success)
```

The posterior mean `α/(α+β)` is the edge weight used in graph algorithms. Edge evidence decays with a **90-day half-life** back toward the prior.

**Research basis.** Beta-Binomial edge estimation follows Bayesian Knowledge Tracing (Corbett & Anderson, 1994 — *Knowledge tracing: Modeling the acquisition of procedural knowledge*, User Modeling and User-Adapted Interaction 4(4)). The prior strength design mirrors the uncertainty-quantification approach in Cognitive Mastery Learning (Bloom, 1968).

---

## 5. Layer 4 — Pathfinder

**File:** `ml/mindcraft_graph/planning/pathfinder.py`

Three modes:

### 5.1 Exam / Curriculum Mode (prerequisite chain)

**Step 1 — Build canonical chain.** Walk backward from the target concept through the strongest prerequisite edges (greedy highest-strength selection). Reverse to get foundational → target order.

**Step 2 — Three-state trim.** Classify each concept:
- `mastered`: strength_score ≥ 0 AND ≥ 1 event → skip
- `struggling`: strength_score < 0 AND ≥ 1 event → ALWAYS keep (never skip a confirmed weakness)
- `unknown`: no evidence → presume mastered only if the successor is mastered (backward propagation)

**Step 3 — Supplements (curriculum mode only).** For each remaining concept, find related/application-linked concepts whose embedding aligns with the student's strength vector (cosine similarity > 0.3). These are offered as alternate entry points for students who learn better through analogies.

### 5.2 Explore Mode

Scores every unvisited concept by:
```
score = novelty × (1 + alignment / temperature)
```
where novelty = `1/(1 + event_count)` and alignment = cosine similarity to student strength vector. Temperature controls exploration-exploitation: high temperature → explore widely; low → exploit strengths.

**Research basis.** Prerequisite-chain traversal follows Curriculum Sequencing algorithms (Brusilovsky, 2003 — *Adaptive navigation support*, in *The Adaptive Web*, Springer). The three-state classifier is inspired by Zone of Proximal Development (Vygotsky, 1978) — only work on things the student isn't already past. The Thompson Sampling-style temperature in explore mode is from Bandit algorithms for recommendation (Chapelle & Li, 2011 — *An Empirical Evaluation of Thompson Sampling*, NeurIPS 2011).

---

## 6. Layer 5 — Question Generation

**File:** `webhook/api/generate-questions.ts`

Production question generation runs on **Vercel** (not the Python server). The stack:
- **LangChain** orchestrates the prompt chain
- **Groq API** serves `llama-3.3-70b-versatile` at ~0.80 temperature
- **Firestore** caches results for 24 hours (keyed by `conceptId + level + examType + count + bridgeFrom`)

### 6.1 What the model receives

Each request injects:
1. `concept_knowledge` — a hand-written blurb per concept (currently covers 16 concepts, hardcoded in the file)
2. `level_guidance` — one of 3 difficulty tiers (Foundation / Applied / Exam-ready)
3. `exam_style` + `exam_blueprint` + `exam_format_rules` + `exam_curriculum_notes` — exam-specific persona
4. `bridge_context` — if `bridgeFrom` is set, the model is asked to connect the student's strength concept into the target concept
5. `paper_pattern_context` — **currently hardcoded to "No indexed past-paper patterns are attached yet"** (see §10)

### 6.2 Output validation

A multi-step validator rejects questions with:
- Fewer than 4 choices or missing correct-answer index
- Explanation containing "none of the choices" phrasing
- SVG data > 4,500 chars or containing `<script>` / `javascript:`
- Wrong `examTag` (e.g. a General question tagged as IB)
- Mismatched `conceptId` or `level`

A numeric repair pass also checks whether the final number in the explanation matches one of the choices, and corrects `correctIndex` if the model misindexed it.

**Research basis.** Distractor-driven multiple-choice generation follows Automatic Question Generation research (Kurdi et al., 2020 — *A Systematic Review of Automatic Question Generation for Educational Purposes*, IJAIED 30). The three-level difficulty ladder maps to Bloom's Taxonomy (Bloom, 1956) and its revised form (Anderson & Krathwohl, 2001). The Micro-Lesson / Socratic recovery message is inspired by Socratic tutoring dialogue in Cognitive Tutors (Anderson et al., 1995 — *Cognitive Tutors*, CACM 38(11)).

---

## 7. Layer 6 — Diagnosis

**File:** `webhook/api/gemini.ts`

Three input paths:
| Input | What happens |
|---|---|
| `file` (image of test) | Claude Haiku extracts text from the image; Claude Sonnet diagnoses gaps from the extracted text |
| `text` (student description) | Claude Sonnet diagnoses directly |
| `confidence_scan` (per-topic self-rating: easy/kinda/hard) | Claude Sonnet maps self-ratings to gap scores |

The diagnosis prompt uses the **exam blueprint** (percentage weights per domain) and forces the model to output:
- `studentScore` ∈ [0, 1] — estimated mastery
- `examWeight` — from blueprint (e.g. algebra = 12% of ACT)
- `brokenPrerequisite` — the upstream concept causing the gap
- `bridgeConcept` — what the student DOES understand, used to anchor questions

Gaps are ranked by `examWeight × (1 − studentScore)` — highest impact deficit first.

**Mode selection.** If `timeToExam ≤ 4` days, the system switches to *triage mode*: prioritize deceptive traps and high-weight domains, not foundational repair.

**Research basis.** The gap-ranking formula is a simplified version of Expected Gain scoring from Bayesian Adaptive Testing (Wainer et al., 2000 — *Computerized Adaptive Testing*, 2nd ed., Erlbaum). The triage/foundation mode switch mirrors time-sensitive study strategy research (Kornell & Bjork, 2007 — *The promise and perils of self-regulated study*, Psychonomic Bulletin & Review).

---

## 8. Layer 7 — Past-Paper Ingestion

**File:** `ml/scripts/ingest_past_papers.py`

**What it does:**
1. Reads locally-placed PDFs from `ml/data/past_papers/<EXAM_KEY>/*.pdf`
2. Infers metadata (year, session, paper number, timezone) from the filename via regex
3. Extracts text with `pypdf`
4. Splits text into individual questions using a newline-number-period regex
5. Writes two JSONL files: `paper_sources.jsonl` and `paper_questions_raw.jsonl`

**What it does NOT do:**
- Does not download papers from any source (ACT, College Board, IB)
- Does not clean OCR artifacts (flagged as TODO)
- Does not align questions with mark schemes
- Does not feed output into question generation (see §10)

---

## 9. Data Flow Diagram

```
Student uploads test / types description / rates confidence
                        │
                        ▼
              [gemini.ts — Diagnosis]
               Claude Haiku (OCR)  ──►  Claude Sonnet (Gap Diagnosis)
                        │
                        ▼
              Gap list: [{conceptId, studentScore, examWeight,
                          brokenPrerequisite, bridgeConcept}]
                        │
              ┌─────────┴──────────┐
              │                    │
              ▼                    ▼
      [Prep.tsx — GapMap]   [Prep.tsx — PracticeCards]
       Visualize gaps         Request questions
                                    │
                                    ▼
                       [generate-questions.ts]
                        Groq / Llama-3.3-70B
                        24h Firestore cache
                                    │
                                    ▼
                        Questions → student practices
                                    │
                                    ▼
                        Results stored in Firestore
                        (prepSessions, sessions)

─ ─ ─ ─ ─ PYTHON ML SERVER (not yet connected to above) ─ ─ ─ ─ ─

Ontology JSON
      │
      ├──► Concept embeddings (all-MiniLM-L6-v2, 384-dim → PCA 4-dim)
      │
      └──► Per-student graph (mastery logistic model + Beta-Binomial edges)
                    │
                    ▼
             Pathfinder
             (prerequisite chain → trim by mastery → supplements)
                    │
                    ▼
             Recommendation API  (ml/serve.py FastAPI)
             ⚠ NOT INTEGRATED WITH FRONTEND YET

Past papers (PDFs, manual placement only)
      │
      ▼
ingest_past_papers.py → paper_questions_raw.jsonl
      │
      ▼
⚠ NOT FEEDING INTO QUESTION GENERATION YET
```

---

## 10. Loopholes

These are confirmed gaps between the described design and what is actually wired up in production as of June 2026. Each one is a real engineering task.

### 🔴 CRITICAL — Past papers not connected to question generation
`paper_pattern_context` in `generate-questions.ts` is hardcoded to `"No indexed past-paper patterns are attached yet."` The ingestion pipeline exists (`ingest_past_papers.py`) but the JSONL output is never read by the question generator. The system generates questions from hardcoded concept blurbs + LLM knowledge, not from real exam patterns.

**What's missing:** A step that (a) indexes the raw questions by concept/exam type, (b) retrieves relevant patterns at generation time (RAG-style), and (c) injects them into the prompt.

### 🔴 CRITICAL — Python ML server is not integrated with the frontend
The entire recommendation, mastery-tracking, and pathfinding system (`ml/serve.py`) is a standalone FastAPI server. There is no call from the React app or from Vercel functions to this server. Student practice results from the Prep flow are saved to Firestore but are not piped back into the Python mastery model.

**What's missing:** Either (a) expose the FastAPI server at a stable URL and call it from the frontend, or (b) rewrite the pathfinder/mastery logic in TypeScript as Vercel functions.

### 🔴 CRITICAL — Concept knowledge is hardcoded (16 concepts only)
The `CONCEPT_KNOWLEDGE` dict in `generate-questions.ts` covers only 16 math concepts. Any concept outside this list gets `"Core {label} skills and applications"` as its knowledge context — which produces generic, low-quality questions. IB, AP, and non-math subjects are not covered.

**What's missing:** Either generate knowledge blurbs from the ontology at question-generation time (ask Claude to describe the concept from the ontology data), or expand the hardcoded dict to cover all concepts.

### 🟡 SIGNIFICANT — Mastery model coefficients are not trained on data
`update.py` line 11: `"Hand-tuned coefficients for the mastery logistic regression. These get fit from data later."` There is no training pipeline. The model will mismatch real student learning curves.

**What's missing:** A training loop using real student interaction logs → fit β₀–β₃ with logistic regression. Longer-term: replace with a trained DKT (Piech et al., 2015) or DKVMN (Zhang et al., 2017 — *Dynamic Key-Value Memory Networks for Knowledge Tracing*, WWW 2017).

### 🟡 SIGNIFICANT — No feedback loop from practice results to ML graph
When a student practices questions and gets them right/wrong, the outcome is saved to Firestore. But the Python mastery model never reads this. There is no event pipeline from `PracticeCards` completions → `SessionEvent` objects → `update_student_state()`.

**What's missing:** A Firestore Cloud Function or a Vercel background job that reads practice results and writes `SessionEvent` records to the ML server.

### 🟡 SIGNIFICANT — Past-paper sourcing is entirely manual
The ingestion script explicitly says `"This script does not download papers."` There is no automated collection from official sources. PDFs must be placed manually. For ACT, SAT, and IB, obtaining official materials legally at scale is a legal/licensing problem, not just an engineering one.

**What this means for your question quality:** Questions are currently entirely LLM-generated with no ground truth from real exams. They may not match actual exam difficulty distributions or question styles, despite the detailed prompt engineering.

### 🟡 SIGNIFICANT — Co-occurrence heuristic for edge discovery is unvalidated
Edge weights update when two concepts appear within 2 hours in a session. This is a rough proxy for "these concepts are related in the student's learning". It ignores whether the student was reviewing, struggling, or just happened to study both. The heuristic needs validation against actual learning outcome data.

### 🟢 MINOR — Embedding validation not done
The PCA projection of `all-MiniLM-L6-v2` embeddings hasn't been evaluated to confirm the first 4 PCs capture meaningful math-domain structure. The current axis labels are generic ("Axis 1", "Axis 2", etc.). If the embedding space is not semantically meaningful for math concepts, the supplement-finding and explore-mode recommendations will be arbitrary.

### 🟢 MINOR — Subject graphs (piano, accounting, writing) are disconnected
The 3 JSON files in `ml/data/subject_graphs/` are loaded (`load_subject_graphs()`) but the loading function has not been traced through to a live API endpoint that the frontend can query.

---

## 11. Improvement Roadmap

### 11.1 Short-term (next 4–6 weeks)

**A. RAG over past papers into question generation**
1. After ingestion, run each raw question through Claude/Llama to extract: concept, difficulty, question pattern, common trap.
2. Store as a vector index (Pinecone or Firestore vector search).
3. At question-generation time, retrieve top-3 real past-paper patterns for the `(conceptId, examType)` pair and inject as `paper_pattern_context`.

Research basis: Retrieval-Augmented Generation (Lewis et al., 2020 — *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*, NeurIPS 2020).

**B. Wire the ML server to the frontend**
Deploy `ml/serve.py` (Railway, Fly.io, or a Cloud Run container). Add calls from `PracticeCards.tsx` on completion to POST practice outcomes → ML server. The pathfinder output can then power the post-practice "what to study next" screen.

**C. Expand concept knowledge to the full ontology**
Add a one-time batch job: for each concept in the ontology JSON, ask Claude to write a 2–3 sentence "what to watch out for when teaching this concept" blurb. Store in Firestore. Load at question-generation time instead of the hardcoded dict.

### 11.2 Medium-term (1–3 months)

**D. Deep Knowledge Tracing (DKT) as the mastery backend**
Replace the hand-tuned logistic model with a trained DKT (LSTM or Transformer-based). Requires: student interaction logs with correct/incorrect labels at the concept level. Even 500 students × 50 questions is enough to bootstrap.

Open-source starting point: `pykt-toolkit` (Liu et al., 2022 — *pyKT: A Python Library to Benchmark Deep Learning based Knowledge Tracing Models*, NeurIPS 2022).

**E. Knowledge Graph Contrastive Learning for better embeddings**
Instead of using a generic sentence encoder, fine-tune embeddings on the concept graph using KGCL (Yu et al., 2022 — *Knowledge Graph Contrastive Learning for Recommendation*, SIGIR 2022). This would produce embeddings that capture prerequisite topology, not just surface text similarity.

**F. Multi-armed bandit for question difficulty selection**
Currently, the Prep flow picks difficulty based on a simple urgency threshold. Replace with a contextual bandit: given the student's current mastery estimate, select the question difficulty that maximizes expected learning gain (estimated from past data). Start with Thompson Sampling (already referenced in pathfinder explore mode).

Research: The concept of "optimal difficulty" maps to Desirable Difficulties (Bjork, 1994 — *Memory and metamemory considerations in the training of human beings*) and the 85% rule (Wilson et al., 2019 — *The Eighty Five Percent Rule for Optimal Learning*, Nature Comm).

### 11.3 Long-term (3–12 months)

**G. Reinforcement Learning for tutoring strategy**
Model the tutor-student interaction as a Markov Decision Process. State = student mastery vector. Action = next concept/question to present. Reward = post-session score improvement. Train with offline RL on logged data before online deployment.

Research: Adaptive Curriculum Learning via RL (Narvekar et al., 2020 — *Curriculum Learning for Reinforcement Learning Domains*, JMLR 21(63)); POMDP-based tutoring (Rafferty et al., 2016 — *Fast deep reinforcement learning using online adjustments*, NeurIPS 2016).

**H. Multi-modal question generation (LaTeX + diagram)**
Current SVG generation is prompted but inconsistent. Pipeline: GPT-4o or Claude for diagram layout → tikz/manim for actual rendering → serve as image. This is especially needed for geometry and coordinate geometry questions where the diagram IS the question.

**I. Collaborative filtering over student cohorts**
Once there are ≥ 100 students, add a cohort-based component: "students who struggled with quadratics often had this specific gap in linear equations first." This is Matrix Factorization / Neural Collaborative Filtering (He et al., 2017 — *Neural Collaborative Filtering*, WWW 2017) applied to knowledge states.

---

## Quick Reference — Where does what live?

| Component | File(s) |
|---|---|
| Concept ontology model | `ml/mindcraft_graph/models/concept.py` |
| Ingredient/card model | `ml/mindcraft_graph/models/ingredient.py` |
| Ontology loader | `ml/mindcraft_graph/loaders/complete_ontology_loader.py` |
| Concept embeddings | `ml/mindcraft_graph/representation/embeddings.py` |
| Mastery update engine | `ml/mindcraft_graph/engine/update.py` |
| Temporal decay | `ml/mindcraft_graph/engine/decay.py` |
| Bayesian edge weights | `ml/mindcraft_graph/engine/edge_weights.py` |
| Pathfinder | `ml/mindcraft_graph/planning/pathfinder.py` |
| ML API server | `ml/serve.py` |
| Past-paper ingestion | `ml/scripts/ingest_past_papers.py` |
| Question generation | `webhook/api/generate-questions.ts` |
| Diagnosis (gap finder) | `webhook/api/gemini.ts` |
| Prep page state machine | `app/src/pages/Prep.tsx` |
| Exam curricula (frontend) | `app/src/lib/examCurricula.ts` |
| Concept prereq map (frontend) | `app/src/lib/conceptMap.ts` |

---

*Last updated: June 2026 · Akshat Koirala*
