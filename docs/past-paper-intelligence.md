# Past Paper Intelligence Pipeline

MindCraft should not generate practice by vaguely asking an LLM for exam-style questions. The rigorous version is:

```text
approved exam PDFs
-> parse questions
-> tag concepts and atomic skills
-> extract recurring question patterns
-> store pattern examples and frequencies
-> generate original questions grounded in those patterns
```

## Key Rule

We should not scrape or redistribute copyrighted exam papers. The pipeline is built for PDFs the team/student/school is allowed to process. The app stores derived metadata, pattern abstractions, and original generated questions, not copied paper text for students.

## Exam-Specific Maps

Each exam has its own prerequisite map because the same concept is tested differently.

Example:

- IB Math AI SL treats functions as modelling tools connected to graph/table interpretation, statistics, probability, and growth.
- ACT treats functions as fast pattern recognition under time pressure.
- SAT treats functions as context translation and equivalent-form reasoning.
- AP treats functions as notation, rates, limits, and interval behavior.

Frontend map:

```text
app/src/lib/examCurricula.ts
```

Backend/data map:

```text
ml/data/exam_curricula.json
```

## Data Flow

### 1. Paper Source

One record per approved PDF:

```json
{
  "source_id": "ib_ai_sl_2023_may_p1_ab12",
  "exam": "IB_AI_SL",
  "year": 2023,
  "session": "May",
  "paper": "Paper 1",
  "file_path": "ml/data/past_papers/IB_AI_SL/2023-may-paper-1.pdf",
  "license_note": "student-provided for personal study"
}
```

### 2. Parsed Questions

One record per question/subquestion:

```json
{
  "question_id": "ib_ai_sl_2023_may_p1_ab12_q3b",
  "exam": "IB_AI_SL",
  "raw_text": "A population model is given by...",
  "concept_tags": ["exponential_functions", "data_interpretation"],
  "atomic_tags": ["exponential_functions__growth_factor", "data_interpretation__read_table"],
  "pattern_tags": ["growth_model_from_context"],
  "calculator_expected": true,
  "diagnostic_traps": ["uses percent as whole number", "misinterprets time unit"]
}
```

### 3. Pattern Records

Patterns are what the generator should use. They are safe because they describe structure, not copied wording.

```json
{
  "pattern_id": "ib_ai_sl_growth_model_context",
  "exam": "IB_AI_SL",
  "frequency": 0.08,
  "concept_tags": ["exponential_functions", "percent_ratio"],
  "stem_shape": "real context gives initial value and repeated percentage change",
  "data_shape": "plain text or table",
  "skills_tested": ["identify multiplier", "build model", "evaluate model", "interpret result"],
  "common_traps": ["adds percent instead of multiplying", "rounds too early"],
  "generation_template": "Create a new real-world growth/decay context with calculator-friendly numbers and ask for interpretation."
}
```

## Generation Flow

When a student needs questions:

```text
student exam = IB_AI_SL
target concept = exponential_functions
level = 2
bridgeFrom = percent_ratio
```

Generator retrieves:

```text
IB_AI_SL prerequisite map
matching paper patterns
common traps
frequency weighting
student bridge context
```

Then the LLM receives a grounded instruction:

```text
Generate original IB AI SL questions using these abstract pattern records.
Do not copy source wording.
Use calculator-friendly numbers.
Require graph/table/model interpretation.
Include distractors based on observed traps.
```

## Implementation Phases

1. Local ingestion
   - Read approved PDFs from `ml/data/past_papers/`.
   - Extract text page-by-page.
   - Split into question candidates.
   - Write `paper_sources.jsonl` and `paper_questions_raw.jsonl`.

2. Concept tagging
   - Use ontology concepts and atomic ingredients.
   - Tag each question with 1-3 concept ids and 1-5 atomic ids.
   - Store confidence scores and reasons.

3. Pattern extraction
   - Cluster similar tagged questions.
   - Produce abstract `question_patterns.jsonl`.
   - Count frequencies per exam/paper/topic.

4. Grounded generation
   - Update `/api/generate-questions` to retrieve top patterns for `exam + concept + bridge`.
   - Inject pattern summaries into the prompt.
   - Validate generated questions for originality, concept tags, and exam style.

5. Review loop
   - Save generated questions as `needs_review`.
   - Human approval promotes questions into static bank or Firestore approved collection.

## What This Gives Us

This turns MindCraft from a wrapper into a curriculum engine:

```text
exam paper reality
-> atomic concept map
-> personalized gap map
-> bridge practice
-> original generated questions
-> knowledge graph updates
```
