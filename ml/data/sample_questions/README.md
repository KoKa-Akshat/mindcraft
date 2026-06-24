# Sample Questions for Concept Path Testing

This directory holds tagged question files used by `ml/scripts/test_concept_paths.py` to compare human-authored concept paths against engine-generated ingredient recommendations.

## File Format

Questions can be provided as **JSON** or **CSV**.

### JSON Format (`*.json`)

```json
[
  {
    "exact_question_text": "The full problem text goes here.",
    "concept_path": "Concept A -> ingredient idea -> Concept B -> solving step -> answer",
    "primary_topic": "Main topic name",
    "secondary_topics": "Optional subtopics"
  },
  { ... }
]
```

### CSV Format (`*.csv`)

Required columns:
- `exact_question_text` — the problem statement
- `concept_path` — human-authored solving path using `->` delimiters
- `primary_topic` — (optional) main topic for context
- `secondary_topics` — (optional) subtopics

Example:
```
exact_question_text,concept_path,primary_topic,secondary_topics
"Solve 2x + 3 = 11","Order of Operations -> Inverse Operations -> Isolate x","Linear Equations","Algebra"
```

## Concept Path Format

The `concept_path` field should be a `->` delimited sequence of **prose steps**, each describing a solving idea or ingredient. The harness will attempt to match each step to an ingredient in the ontology using token-overlap scoring.

**Example:**
```
Sequences & Patterns -> finite sequence -> compare successive terms -> first differences -> constant difference -> next term prediction
```

Each step is matched against ingredient names and tags. If a step cannot be matched, it will be marked as `no_ingredient_in_ontology` in the report.

## Running the Harness

```bash
cd /home/basickellogs/Projects/mindcraft

# Auto-generate sample questions and run
python3 ml/scripts/test_concept_paths.py

# Or use a custom questions file
source ml/mindcraft/bin/activate
python3 ml/scripts/test_concept_paths.py --questions ml/data/sample_questions/my_questions.json
```

## Output

The harness produces:
- **Console output:** Full report printed to stdout
- **Markdown file:** `ml/scripts/output/concept_path_report.md`

The report includes:
- Aggregate statistics (coverage, recall, order agreement)
- Per-question analysis (path steps, ingredient mapping, fire-sets, verdicts)
- Comparison of results with combinations enabled vs. disabled
