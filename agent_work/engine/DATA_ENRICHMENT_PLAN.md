# DATA_ENRICHMENT_PLAN.md

**Lane:** Engine (`ml/**`, `data/**`)
**Author:** Fable 5 (Build window, 2026-07-08)
**Implementer:** Cursor or Codex — Engine lane only; no `app/**` changes.
**Status:** Open

This spec covers four independent enrichment workstreams: ASSISTments calibration (A), new question sources (B), YouTube misconception mining (C), and Math Stack Exchange mining (D). Each is a standalone script addition. They share no state and can be executed in any order — or in parallel in separate sessions.

Read `AGENTS_QUICKSTART.md` and `CLAUDE.md §Architecture` before starting. The key paths:
- ML venv: `ml/mindcraft/` — activate with `source ml/mindcraft/bin/activate`
- Pipeline base: `ml/scripts/pipeline/base.py` — the `SourceAdapter` ABC all new sources extend
- Ontology: `ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`
- Eedi misconceptions: `ml/data/eedi_misconceptions.json`
- LLM provider: `LLM_PROVIDER=groq` + `GROQ_API_KEY` in `ml/.env.local` (do NOT commit)

---

## A. ASSISTments Calibration

### Why this matters

`population_failure_prior` in Layer 1 drives `/recommend` severity scoring: higher prior → higher urgency for a concept. Current values were proxy-estimated. ASSISTments 2009-2010 "skill builder" is a US dataset of ~8.9 million student problem-solving events from ~15,000 middle/high school students — the best publicly available calibration signal for our ACT-relevant concepts.

A well-calibrated prior means students who are genuinely weak on `number_properties` (which has the highest real-world error rate in our Eedi data) get routed to it sooner, not after concepts that happen to have inflated synthetic priors.

### Dataset

- **Source:** Kaggle — "ASSISTments 2009–2010 Skill Builder" (`skill_builder_data_corrected.csv`, ~300MB)
- **URL:** `https://www.kaggle.com/datasets/nicolaswattiez/skillbuilder-data-mining-2009-to-2010`
- **License:** CC-BY — free for research use
- **Key columns:** `user_id`, `skill_name`, `correct` (0/1), `problem_id`
- Download manually to `data/assistments/skill_builder_data_corrected.csv` (gitignored — add to `.gitignore` if not already there)

### Output

1. Updated `ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json` — `population_failure_prior` values updated in-place for all matched concepts
2. Diff report at `ml/data/assistments/calibration_report.json` — shows old vs. new prior, sample size, mapped skill names for audit

### Script to build

**File:** `ml/scripts/calibrate_from_assistments.py`

```
Usage:
    python3 ml/scripts/calibrate_from_assistments.py \
        --csv data/assistments/skill_builder_data_corrected.csv \
        [--dry-run]   # prints diffs without writing
```

**Algorithm:**

1. Read CSV. Group rows by `skill_name`. For each skill, compute `error_rate = 1 - mean(correct)` using only rows where `correct` is 0 or 1 (drop nulls).
2. Apply the skill → concept ID mapping table below. A skill may map to multiple concept IDs (distribute the evidence evenly).
3. For each concept ID, aggregate weighted error rates: `final_prior = mean(error_rate_i * n_i) / sum(n_i)` across all contributing skills. Weight by sample size so large-skill signals dominate.
4. Clamp to `[0.15, 0.85]` — the engine interprets priors below 0.15 as "trivial" and above 0.85 as "impossible", both of which are misleading.
5. Apply only when `n >= 500` observations for the concept (flag smaller samples in the report as "insufficient — kept prior").
6. Write updated ontology JSON. Existing fields other than `population_failure_prior` must be unchanged (load → mutate single field → write).

**Skill → concept_id mapping table** (starter; add unmapped skills encountered during a `--dry-run --report-unmapped` pass):

| ASSISTments skill_name (substring match, case-insensitive) | mindcraft concept_id(s) |
|-------------------------------------------------------------|-------------------------|
| "fraction" | `fractions_decimals` |
| "decimal" | `fractions_decimals` |
| "percent" | `ratios_proportions` |
| "ratio" | `ratios_proportions` |
| "proportion" | `ratios_proportions` |
| "scale factor" | `ratios_proportions` |
| "order of operation" | `order_of_operations` |
| "pemdas" | `order_of_operations` |
| "solving equation" | `basic_equations`, `linear_equations` |
| "linear equation" | `linear_equations` |
| "linear function" | `linear_equations`, `functions_basics` |
| "slope" | `linear_equations` |
| "two-step" | `basic_equations` |
| "one-step" | `basic_equations` |
| "inequality" | `linear_inequalities` |
| "system" | `systems_of_linear_equations` |
| "exponent" | `exponent_rules` |
| "power" | `exponent_rules` |
| "polynomial" | `polynomials` |
| "factor" | `factoring_polynomials` |
| "quadratic" | `quadratic_equations` |
| "radical" | `radical_expressions` |
| "square root" | `radical_expressions` |
| "function" | `functions_basics` |
| "probability" | `basic_probability` |
| "statistics" | `descriptive_statistics` |
| "mean" | `descriptive_statistics` |
| "median" | `descriptive_statistics` |
| "box and whisker" | `descriptive_statistics` |
| "histogram" | `descriptive_statistics` |
| "scatter" | `descriptive_statistics` |
| "area" | `area_volume` |
| "volume" | `area_volume` |
| "surface area" | `area_volume` |
| "perimeter" | `area_volume` |
| "triangle" | `triangles_congruence`, `right_triangle_geometry` |
| "pythagorean" | `right_triangle_geometry` |
| "angle" | `lines_angles` |
| "transformation" | `geometric_transformations` |
| "translation" | `geometric_transformations` |
| "reflection" | `geometric_transformations` |
| "rotation" | `geometric_transformations` |
| "circle" | `circles_geometry` |
| "coordinate" | `lines_angles` |
| "number line" | `number_properties` |
| "integer" | `number_properties` |
| "place value" | `number_properties` |
| "rounding" | `number_properties` |
| "prime" | `number_properties` |
| "divisibility" | `number_properties` |
| "measurement" | `measurement_units` |
| "unit" | `measurement_units` |
| "conversion" | `measurement_units` |
| "sequence" | `sequences_series` |
| "pattern" | `sequences_series` |
| "algebraic expression" | `algebraic_manipulation` |
| "simplify" | `algebraic_manipulation` |

**Matching rule:** iterate skills. For each skill, check if any mapping key is a substring of the skill name (case-insensitive). Collect all matching concept IDs; if none match, log skill to unmapped list and skip. Run `--dry-run --report-unmapped` first, hand-extend the table.

**Gitignore addition** (add to `.gitignore` or check it's already there):
```
data/assistments/
```

---

## B. New Question Sources

Three new `SourceAdapter` subclasses for the unified pipeline (`ml/scripts/pipeline/ingest.py`). Each follows the exact pattern of `ml/scripts/pipeline/sources/openstax.py`: a single Python file in `ml/scripts/pipeline/sources/`, implementing the `SourceAdapter` ABC defined in `ml/scripts/pipeline/base.py`.

The ABC interface (from `base.py`):
```python
class SourceAdapter(ABC):
    ALLOWED_CHOICE_COUNTS: set[int] = {4}
    def name(self) -> str: ...          # slug used in question IDs
    def fetch(self, **kwargs) -> list[dict]: ...  # raw items
    def parse_item(self, raw: dict) -> dict | None: ...  # raw → partial Question
    def concept_map(self) -> dict[str, tuple[str, int]]: ...  # source tag → (concept_id, level)
```

`parse_item` must return a dict with at minimum: `question`, `choices`, `correctIndex`, `level`, `conceptId` (may be `None` to trigger LLM mapping). The pipeline adds `id`, `explanation`, `hints` automatically.

Add each new source to the `SOURCES` tuple at the top of `ingest.py` and add its `--source <name>` case to the argparse dispatch.

---

### B1. Texas STAAR Algebra I

**File:** `ml/scripts/pipeline/sources/staar.py`

**Source:** Texas Education Agency released STAAR tests (Algebra I, 2015–2024).
- Base URL: `https://tea.texas.gov/student-assessment/testing/staar/released-test-forms/`
- Format: PDF per year. Each PDF contains ~40 MCQ items with answer keys in a separate scoring guide.
- License: Public domain (Texas state government work product).

**Fetch strategy:**
- `fetch()` does NOT auto-download PDFs — too fragile. Instead, it reads a local manifest at `ml/data/staar/items.json` (built by a one-time extraction step).
- Provide `ml/scripts/pipeline/sources/staar_extract.py` — a one-time helper that:
  1. Accepts a list of PDF paths (Algebra I test booklets, not scoring guides).
  2. Uses `pdfplumber` (pip install) to extract text per page.
  3. Locates MCQ items by the regex `r'^\d+\s'` (item number at line start) and answer choices by `r'^[A-D]\s'`.
  4. Matches items to answer keys from a separate CSV that the user provides (`ml/data/staar/answer_keys.csv` — columns: `year, item_num, correct_letter`).
  5. Outputs `ml/data/staar/items.json` — list of `{year, item_num, text, choices: [A,B,C,D], correctIndex, raw_page}`.
- After extraction, `python ml/scripts/pipeline/ingest.py --source staar` reads `items.json` and runs the standard pipeline.

**Concept mapping strategy:**
- STAAR Algebra I maps cleanly to our ACT-tested algebra concepts. Provide a static `STAAR_CONCEPT_MAP` in `staar.py`:

| STAAR reporting category | concept_id(s) | default level |
|--------------------------|---------------|---------------|
| Linear Functions, Equations, and Inequalities | `linear_equations`, `linear_inequalities` | 2 |
| Systems of Linear Equations | `systems_of_linear_equations` | 2 |
| Quadratic Functions and Equations | `quadratic_equations` | 2 |
| Exponential Functions and Equations | `exponential_functions` | 2 |
| Number and Algebraic Methods | `algebraic_manipulation`, `number_properties` | 1 |
| Data Analysis and Statistical Inference | `descriptive_statistics` | 2 |

Assign reporting category per item by matching keywords in the item text (slope/linear → `linear_equations`, system/intersection → `systems_of_linear_equations`, quadratic/parabola/discriminant → `quadratic_equations`, exponential/growth/decay → `exponential_functions`). Fall back to LLM mapping (`_source_concept = item_text[:80]`) for ambiguous items.

**examTag:** `STAAR`

**CLI flag:** `--source staar --items-path ml/data/staar/items.json`

---

### B2. NY Regents Algebra I

**File:** `ml/scripts/pipeline/sources/regents.py`

**Source:** New York State Education Department Regents Algebra I (Common Core), 2015–2024.
- URL pattern: `https://www.nysedregents.org/algebraj/` (index page with year links)
- Format: HTML exam pages. Multiple-choice items are Part I (~24 items), each with 4 choices. Answers published in a separate scoring key PDF.
- License: Public domain (New York state government).

**Fetch strategy:**
- `fetch()` scrapes the index page with `requests.get()`. Follows links to individual exam pages. Parses HTML with `BeautifulSoup4` (add to `requirements.txt` if not present — it's already used indirectly by pipeline).
- MCQ items appear in `<div class="examQuestion">` blocks or equivalent (verify against actual HTML during implementation — inspect `https://www.nysedregents.org/algebraj/`). Extract item text and choices.
- Cache raw HTML to `ml/data/regents/raw_html/` (gitignored) so reruns are free.
- Answer key: Scrape the scoring key PDFs using `pdfplumber` or, if fragile, accept a manually provided CSV `ml/data/regents/answer_keys.csv` (columns: `year, part, item_num, correct_letter`) as fallback.

**Concept mapping:** Same keyword-based logic as STAAR. Regents Algebra I topics map identically to our concepts; reuse STAAR's `STAAR_CONCEPT_MAP` but import it or duplicate the table. The `concept_map()` method can return the same dict.

**examTag:** `REGENTS`

**CLI flag:** `--source regents [--years 2015-2024]`

**Implementation note:** Regents HTML structure has changed over the years. Implement a fallback: if the primary CSS selector fails for a year, log a warning and skip that year rather than crashing. A partial harvest (say 6/10 years) is better than no harvest.

---

### B3. CK-12 Exercises

**File:** `ml/scripts/pipeline/sources/ck12.py`

**Source:** CK-12 Foundation practice exercises API.
- Base URL: `https://api.ck12.org/api/assessment/3/get/minimal/practices/?pageSize=50&gradeList=9,10,11&subjectList=MAT`
- Pagination: `&offset=N` (increment by 50). Continue until `results` array is empty or `count` matches.
- License: CC-BY-SA (attribution required in `examTag` or `explanation`).

**Why CK-12 matters:** Covers five zero-coverage concepts in our bank:
`rational_expressions`, `logarithmic_functions`, `matrices`, `complex_numbers`, `combinatorics`. Eedi's UK/GCSE focus doesn't reach these; they're US high school algebra 2/precalc topics.

**Fetch strategy:**
- `fetch()` paginates the API and caches responses to `ml/data/ck12/raw/` (gitignored). A `refresh=True` kwarg forces re-fetch.
- Each response item: `{id, title, subject, grade, problemHTML, answerChoices: [{text, isCorrect}], ...]}`
- Parse `problemHTML` with `BeautifulSoup4`: strip tags, preserve LaTeX (`<span data-math>` → `\(...\)`), extract text.

**Concept mapping strategy:**
- CK-12 practice titles and subjects carry concept keywords. Build a static map in `ck12.py`:

| CK-12 subject/title keywords | concept_id | level |
|-------------------------------|-----------|-------|
| "rational expression" / "rational function" | `rational_expressions` | 2 |
| "logarithm" / "log" | `logarithmic_functions` | 2 |
| "matrix" / "matrices" | `matrices` | 2 |
| "complex number" / "imaginary" | `complex_numbers` | 2 |
| "combination" / "permutation" / "counting" / "factorial" | `combinatorics` | 2 |
| "exponential" | `exponential_functions` | 2 |
| "quadratic" | `quadratic_equations` | 2 |
| "polynomial" | `polynomials` | 2 |
| "linear equation" | `linear_equations` | 2 |
| "inequality" | `linear_inequalities` | 1 |
| "system" | `systems_of_linear_equations` | 2 |
| "probability" | `basic_probability` | 1 |
| "statistics" | `descriptive_statistics` | 1 |
| "geometry" / "area" / "volume" | `area_volume` | 1 |

Fall back to LLM mapping (`_source_concept = title + " " + subject`) for unmatched items.

**examTag:** `CK12`

**Filter:** Keep only items with exactly 4 choices where exactly 1 is marked `isCorrect`. Drop free-response or true/false.

**CLI flag:** `--source ck12 [--grade-list 9,10,11] [--no-cache]`

---

## C. YouTube Transcript Misconception Mining

### Why this matters

YouTube math tutors (particularly GCSE-focused channels like Corbettmaths) explicitly narrate the mistakes students make: "students often..." / "the common error here is..." These segments are the most direct natural-language expression of student misconceptions — more authentic than textbook descriptions, because they come from teachers who have seen the same errors thousands of times. Mined segments become `world_feedback` candidates in `ml/data/promotion_queue.json` and eventually feed the story cell pipeline.

### Script

**File:** `ml/scripts/mine_youtube_misconceptions.py`

**Dependencies:** `yt-dlp` (auto-transcripts) — add to `ml/requirements.txt`. Already `pip`-installable: `pip install yt-dlp`.

**Usage:**
```
python3 ml/scripts/mine_youtube_misconceptions.py \
    --channel "https://www.youtube.com/@Corbettmaths" \
    [--channel "https://www.youtube.com/@GCSEMathsTutor"] \
    [--channel "https://www.youtube.com/@TheOrganicChemistryTutor"] \
    [--output ml/data/youtube_misconception_candidates.json] \
    [--no-llm]   # skip Groq classification, emit raw segments only
    [--limit 50]  # max videos per channel
```

**Seed channel URLs:**
1. `https://www.youtube.com/@Corbettmaths` — GCSE-centric, "common mistake" segments, ~700 videos
2. `https://www.youtube.com/@GCSEMathsTutor` — similar GCSE focus
3. `https://www.youtube.com/@TheOrganicChemistryTutor` — US-focused, algebra through calculus, ~2,500 videos — relevant for ACT concepts

**Algorithm:**

1. **Download transcripts.** For each channel, use `yt-dlp` to list video IDs (`--flat-playlist --print id`). For each video, download the English auto-generated transcript:
   ```
   yt-dlp --write-subs --sub-lang en --skip-download --output "%(id)s" <url>
   ```
   Transcripts land as `.en.vtt` files. Parse VTT with a simple regex to strip timestamps; concatenate into plain text.

2. **Keyword detection.** Scan each transcript for trigger patterns (case-insensitive):
   ```python
   TRIGGER_PATTERNS = [
       r'common mistake',
       r'students (?:often|usually|always|tend to)',
       r'wrong because',
       r'the error here',
       r'many students',
       r'a lot of (?:students|people)',
       r'don\'t (?:forget|confuse)',
       r'easy to (?:mix up|confuse|forget)',
       r'typical (?:error|mistake)',
       r'misconception',
   ]
   ```
   For each match, extract a ±3-sentence window (5 sentences total) around the hit.

3. **LLM classification (Groq, `LLM_PROVIDER=groq`).** Batch the extracted windows through the LLM with this prompt:

   ```
   You are reviewing a math tutor's transcript segment for misconceptions.
   
   Segment: "{segment}"
   
   If this segment describes a student error or misconception, output JSON:
   {
     "is_misconception": true,
     "concept_id": "<one of the 42 MindCraft concept IDs or null>",
     "error_type": "<brief label>",
     "student_thinking": "<what the student incorrectly believes, ≤60 chars>",
     "world_feedback_candidate": "<correction framed for world_feedback, ≤200 chars, no 'wrong/incorrect'>",
     "confidence": 0.0-1.0
   }
   
   If not a misconception segment, output: {"is_misconception": false}
   
   Valid concept IDs: fractions_decimals, ratios_proportions, order_of_operations,
   basic_equations, linear_equations, functions_basics, right_triangle_geometry,
   trigonometry_basics, linear_inequalities, systems_of_linear_equations,
   exponent_rules, polynomials, factoring_polynomials, radical_expressions,
   quadratic_equations, descriptive_statistics, basic_probability,
   exponential_functions, sequences_series, lines_angles, triangles_congruence,
   circles_geometry, area_volume, geometric_transformations, number_properties,
   measurement_units, algebraic_manipulation, representation_translation
   ```

4. **Output** (`ml/data/youtube_misconception_candidates.json`):
   ```json
   [
     {
       "video_id": "abc123",
       "channel": "Corbettmaths",
       "video_title": "...",
       "segment_text": "...",
       "concept_id": "linear_equations",
       "error_type": "sign flip on rearrangement",
       "student_thinking": "moves term without flipping sign",
       "world_feedback_candidate": "The term changes sign when it crosses the equals — it's not moving, it's undoing.",
       "confidence": 0.87
     }
   ]
   ```
   Only emit items where `is_misconception: true` AND `confidence >= 0.7`.

5. **Cache.** Cache raw VTT files to `ml/data/youtube/transcripts/<video_id>.vtt` (gitignored). LLM results are cached to `ml/data/youtube/.classify_cache.json` keyed by `sha1(segment_text)`. Reruns are cheap.

**Downstream use:** Fable 5 reviews `youtube_misconception_candidates.json`, selects `world_feedback_candidate` entries to promote, manually adds them to `ml/data/promotion_queue.json` distractor entries as `world_feedback` strings.

---

## D. Math Stack Exchange Mining

### Why this matters

High-voted Stack Exchange questions where a student posts working with errors are the highest-quality evidence of real mathematical misconceptions: hundreds of mathematicians upvoted the question as representative, and the top answer usually names the cognitive error precisely. The error descriptions are in plain English and map directly to our `student_thinking` field.

### Script

**File:** `ml/scripts/mine_mathse_misconceptions.py`

**Data source:** CC-licensed Archive.org data dump of Math Stack Exchange.
- URL: `https://archive.org/download/stackexchange/math.stackexchange.com.7z`
- Size: ~2GB compressed. Contains `Posts.xml`.
- License: CC-BY-SA 4.0 — free for this use.
- Download manually to `data/mathse/Posts.xml` (gitignored — add `data/mathse/` to `.gitignore`).

**Usage:**
```
python3 ml/scripts/mine_mathse_misconceptions.py \
    --posts data/mathse/Posts.xml \
    [--output ml/data/mathse_misconception_candidates.json] \
    [--min-votes 5] \
    [--no-llm]
```

**Algorithm:**

1. **Parse XML.** Use `xml.etree.ElementTree` (stdlib — no extra dependency). Iterate `<row>` elements where `PostTypeId="1"` (questions). Extract: `Id`, `Tags`, `Body`, `Score`, `Title`.

2. **Filter by concept relevance.** Match tags against this concept → SE-tag mapping:
   ```python
   CONCEPT_TO_TAGS = {
       "linear_equations": {"algebra", "linear-algebra", "equations"},
       "quadratic_equations": {"quadratic-equations", "polynomials"},
       "fractions_decimals": {"fractions", "decimals", "arithmetic"},
       "ratios_proportions": {"ratio", "proportion"},
       "order_of_operations": {"order-of-operations", "arithmetic"},
       "exponent_rules": {"exponents", "logarithms"},
       "factoring_polynomials": {"factoring", "polynomials", "roots"},
       "functions_basics": {"functions"},
       "sequences_series": {"sequences", "series"},
       "basic_probability": {"probability"},
       "descriptive_statistics": {"statistics"},
       "triangles_congruence": {"geometry", "triangles"},
       "area_volume": {"geometry", "area"},
       "right_triangle_geometry": {"trigonometry", "geometry", "pythagoras"},
       "number_properties": {"number-theory", "integers", "prime-numbers"},
       "algebraic_manipulation": {"algebra", "simplification"},
   }
   ```
   Retain a question if any of its tags match the mapped set for any of our concepts. Assign the matching concept_id (pick the first match; the LLM refines later).

3. **Student-error signal.** Further filter to posts that look like "student showing work": require body to contain any of `[" I tried", " I thought", " I assumed", " my work", "here is my attempt", "I got", "where did I go wrong", "is this right"]` (case-insensitive).

4. **Score sort.** Sort by `Score` descending. Process top N (default 500). High votes = common confusion = high priority.

5. **Strip HTML.** Use `html.unescape` + a simple tag-stripping regex (from `base.strip_html()`). Preserve LaTeX between `$...$` and `$$...$$`.

6. **LLM classification** (Groq, optional `--no-llm` for dry run):
   ```
   A student posted this math question showing their error in reasoning:
   
   Title: "{title}"
   Body: "{body[:600]}"
   
   Identify the cognitive error (not the arithmetic error). Output JSON:
   {
     "has_error": true,
     "concept_id": "<most specific matching concept_id>",
     "misconception_type": "<brief label ≤60 chars>",
     "student_thinking": "<what the student incorrectly believes ≤80 chars>",
     "corrected_insight": "<the correct understanding ≤100 chars>",
     "confidence": 0.0-1.0
   }
   If no clear student error, output {"has_error": false}.
   ```

7. **Output** (`ml/data/mathse_misconception_candidates.json`):
   ```json
   [
     {
       "post_id": 12345,
       "votes": 47,
       "concept_id": "fractions_decimals",
       "title": "Why does 1/2 + 1/3 ≠ 2/5?",
       "body_excerpt": "...",
       "misconception_type": "adds numerators and denominators independently",
       "student_thinking": "fractions add like integers do",
       "corrected_insight": "denominator sets the unit; you must equalize units before adding",
       "confidence": 0.95,
       "se_url": "https://math.stackexchange.com/q/12345"
     }
   ]
   ```
   Only emit where `has_error: true` AND `confidence >= 0.65`.

8. **Cache.** LLM responses cached to `ml/data/mathse/.classify_cache.json` keyed by `sha1(post_id + body[:200])`.

**Downstream use:** Same as YouTube — Fable 5 reviews the output and promotes selected entries into `ml/data/promotion_queue.json` as `world_feedback` candidates or new misconception entries in `ml/data/eedi_misconceptions.json`.

---

## Implementation order

1. **C (YouTube)** — fastest to ship; `yt-dlp` is simple, no large download needed, ~200 lines. Good for checking the LLM classification prompt before the larger workstreams.
2. **D (Math SE)** — large XML parse but no LLM complexity beyond what C establishes. Reuses the same prompt pattern.
3. **B1/B2/B3 (New sources)** — standard SourceAdapter pattern. B3 (CK-12, JSON API) first; B1/B2 require PDF parsing infrastructure. Any order is fine after C+D.
4. **A (ASSISTments)** — last, because it modifies the ontology. Run `--dry-run` first, hand-verify the mapping table against actual skill names in the CSV before writing.

---

## Files changed / created

```
ml/scripts/calibrate_from_assistments.py          (new)
ml/scripts/mine_youtube_misconceptions.py          (new)
ml/scripts/mine_mathse_misconceptions.py           (new)
ml/scripts/pipeline/sources/staar.py              (new)
ml/scripts/pipeline/sources/staar_extract.py      (new, one-time helper)
ml/scripts/pipeline/sources/regents.py            (new)
ml/scripts/pipeline/sources/ck12.py               (new)
ml/scripts/pipeline/ingest.py                     (edit: add staar/regents/ck12 to SOURCES)
.gitignore                                         (edit: add data/assistments/, data/mathse/, ml/data/staar/, ml/data/regents/, ml/data/ck12/, ml/data/youtube/)
```

Output data files (gitignored, locally generated):
```
ml/data/youtube_misconception_candidates.json
ml/data/mathse_misconception_candidates.json
ml/data/assistments/calibration_report.json
```
