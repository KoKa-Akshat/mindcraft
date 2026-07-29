# MindCraft Agent Rulebook

> **The core law:** The deterministic engine owns WHAT to teach, WHEN, and in
> what ORDER. The agent layer owns HOW it is experienced — narrative, framing,
> tone, image, hint, environment. These domains must never overlap. An agent
> that decides which concept a student studies next is broken. An engine that
> writes story prose is wrong. The division is the architecture.

---

## 0. Glossary

| Term | Meaning |
|------|---------|
| **Deterministic engine** | `ml/serve.py` + `mindcraft_graph/` — knowledge graph, pathfinder, gap detector, question selector |
| **Agent** | Any LLM call (Groq, Claude) in `ml/serve.py` or a Cloud Run function |
| **Student graph** | Firestore `knowledge_graphs/{uid}` — per-concept mastery, bridge evidence, event count |
| **Recommendations** | Output of `/recommend` — `canonicalChain`, `gaps`, `recommendations[]`, `studentProfile` |
| **Question** | A `Question` object from `questionBank.ts` — `conceptId`, `level`, `format`, `stem`, `choices`, `key` |
| **Concept** | One of the 42 canonical slugs in Layer 1 ontology (`linear_equations`, `functions_basics`, …) |
| **Ingredient** | Atomic mental model within a concept. `ingredient_id` = `{concept}__{slug}` |
| **Bridge gap** | A failed cross-concept connection (`isBridgeGap: true` in `/knowledge-graph` response) |
| **Severity** | Float `[0, 1]` — higher = worse gap. Comparable across concept and bridge gaps |
| **Format** | Question representation type: `word_problem`, `symbolic_expression`, `diagram`, `coordinate_graph`, `number_line` |

---

## 1. Agent Touchpoint Registry

Every agent call has a canonical name, a defined input contract, a defined
output contract, and a fallback. No ad-hoc LLM calls anywhere in the codebase.

### 1.0 Marketing `/angle-write` and `/personality-judge`

**Purpose:** Marketing language only. The deterministic pipeline selects the
fact, source, pillar, audience, ordering, and slide budget before either call.

**ANGLE/WRITE input:** a harvested candidate with `pillar`, `audience`,
`evidence`, and immutable `selected` fields. **Output:** `hook`, `caption`,
`hashtags` (maximum eight), slide copy, alt text, and an `authorship` map.
The call may frame selected facts but may not alter puzzle math, answers,
citations, or testimonials. Deterministic verbatim-source verification blocks
any changed selected field. Output is structured JSON matching the marketing
post schema. Fallback is deterministic pillar copy in `marketing/src/lib.mjs`.

**PERSONALITY JUDGE input:** the completed caption and slide copy plus the five
Brand Book §7 traits and §14 examples. **Output:** pass/fail for cinematic,
electric, certain, human, and unflinching, with a cited line for every trait
and a failing line for every miss. Three of five is required. Fallback is the
explicitly labelled deterministic rubric in `marketing/src/cli.mjs`.

Neither call may publish, choose a candidate, change the mix, or write outside
`marketing/run/`.

### 1.1 `/onboard-agent`

**Purpose:** Transform a 3-field student intake (context + cluster ratings +
optional probe outcome) into a structured seed for `/seed-assessment`.

**Reads from deterministic engine:**
- `GET /exam-concepts/act` → the 29 ACT concept IDs
- Layer 1 `population_failure_prior` per concept (cold-start base rates)
- Layer 1 `learning_style_affinity` per concept

**Input contract:**
```json
{
  "student_id": "string",
  "intake": {
    "test_date_weeks": 8,
    "goal_score": 28,
    "last_score": 23,
    "cluster_ratings": {
      "numbers_operations": "kinda",
      "algebra_equations": "easy",
      "functions_graphs": "hard",
      "geometry": "kinda",
      "statistics_probability": "easy",
      "advanced_topics": "hard"
    },
    "probe_outcome": {
      "concept_id": "functions_basics",
      "correct": false,
      "time_seconds": 47
    }
  }
}
```

**Output contract:**
```json
{
  "exam": "ACT",
  "confidence": {
    "linear_equations": "easy",
    "functions_basics": "hard",
    "...": "..."
  },
  "goals": {
    "tags": ["exam_prep", "deadline_pressure"],
    "text": "ACT target 28 in 8 weeks, currently scoring 23"
  },
  "budget_hint": "aggressive",
  "agent_notes": "Student strong in algebra, critical gap in functions/advanced. 5-point gain in 8 weeks is achievable with focus on functions_basics, quadratic_functions, trigonometry_basics."
}
```

**Fallback (if Groq unavailable):** Heuristic map — each cluster rating
broadcasts to all concepts in that cluster: `easy` → `easy`, `kinda` → `kinda`,
`hard` → `hard`. Missing cluster → use population prior. Graceful, no crash.

**LLM prompt rules:**
- System prompt MUST include the full list of 42 concept IDs with their
  cluster membership and `population_failure_prior` values
- Probe outcome is strong signal — if the student got the probe wrong, that
  concept gets `hard` regardless of cluster rating
- Time signal: fast wrong answer (< 20s) = overconfident gap; slow wrong
  answer (> 90s) = effortful gap. Both are `hard` but different remediation
- Output MUST be valid JSON matching the output contract. Use structured outputs
  or a JSON repair pass — never let a malformed response reach `/seed-assessment`

---

### 1.2 `/story-module`

> **Supersedes the previously-spec'd `/story-agent` (§1.2) and
> `/question-frame` (§1.3).** Those two were never built as separate endpoints;
> `/story-module` unifies narrative wrap + in-question framing + guidance in
> ONE batched call. See `STORY_LAYER_RECONCILE.md` for the migration rationale.

**Purpose:** Optional **live overlay** for a practice/diagnostic session —
Socratic guidance, step plans, and misconception callouts personalized with
student goals / tutor focus. **Base themed stems are NOT served from this
endpoint anymore** — they are baked offline into
`app/src/data/themedStems.generated.json` (see `THEMED_QUESTION_BAKE_BUILD.md`)
and read synchronously in Practice. Composer core is shared:
`webhook/lib/storyModuleComposer.ts` (handler + `webhook/scripts/bake-themed-stems.ts`).

The deterministic engine has ALREADY chosen which questions to serve; this
endpoint only derives guidance (and historically reskinned stems). **The LLM
never touches the math** — choices, `correctIndex`, and every numeric value
stay byte-identical.

**Reads from deterministic engine:** Nothing directly. The caller passes the
already-selected `Question` objects plus their concept story and optional
student context. Token verification only.

**Input contract:**
```json
{
  "conceptId": "functions_basics",
  "conceptName": "Functions",
  "story": "<concept origin story, <=4000 chars>",
  "questions": [
    {
      "id": "q_123", "question": "<stem>", "choices": ["A","B"],
      "correctIndex": 0, "explanation": "<worked how-to-solve>",
      "hints": [], "level": 2, "format": "symbolic_expression",
      "misconceptionLabel": "...",
      "conceptStory": "<per-question world, multi-concept sessions>",
      "protagonist": "...", "storyContext": "...", "storyIntro": "..."
    }
  ],
  "goals": { "tags": [], "text": "" },
  "tutorFocusConcepts": [], "priorOutcomes": [], "sessionKind": "practice"
}
```
Max 12 questions per call. Requires `Authorization: Bearer <Firebase ID token>`.

**Output contract:**
```json
{
  "items": {
    "q_123": {
      "storyStem": "<the question re-set inside the story world>",
      "socratic": ["<guiding q 1>", "<guiding q 2>"],
      "steps": ["<step 1>", "<step 2>"],
      "misconceptionCallout": "<story-voiced trap warning, optional>"
    }
  },
  "cached": 8, "generated": 4
}
```

**Model:** Groq `llama-3.3-70b-versatile`, `temperature: 0.55` (fidelity over
flair — the math must survive). One batched call for all cache misses.

**Caching:** Per-`{concept, question}` docs in Firestore `story_module_cache`
(30-day TTL, key `{cacheVersion}__{conceptId}__{questionId}`). Reskins are
stable per bank question, so any student who draws the same question reuses the
same scene. Only uncached questions hit Groq.

**Rules (enforced in code — keep them):**
- NEVER change, remove, or reorder any number, variable, equation, unit, or
  relationship. Every digit-run in the original stem MUST appear verbatim in
  `storyStem`; items failing this validation are DROPPED, never served.
- NEVER mention the answer choices or leak the correct choice text/letter in
  `socratic` or `steps`. The app renders choices unchanged.
- The math must be WOVEN INTO the scene's action — a named character needs this
  exact equation/quantity for a concrete reason, never a scene followed by an
  unrelated textbook ask (see the story-first convention in `CLAUDE.md`).
- `socratic`: exactly 2 guiding questions, story voice, lead toward the method.
- `steps`: 2–5 imperative steps distilled from the explanation; no final
  numeric answer.
- `misconceptionCallout`: only when a misconception is tagged; one sentence, no
  shame.
- Voice: warm, direct, no cheerleading, no emojis. NEVER an em dash (—).
- Reject script/markup injection in any field. Cap `storyStem` ≤ 2200 chars.

**Fallback:** Any item that is missing or fails validation is simply omitted
from `items`; Practice serves **baked stem > framedLocalStem > plain** for the
base stem regardless. On Groq failure the endpoint returns whatever the cache
held. Never blocks the session — guidance overlay is best-effort.

**Offline bake (stem):** `npm run bake-themed-stems --prefix webhook`
writes `themedStems.generated.json` keyed `{conceptId}__{questionId}`. Same
numeric-preservation validation; drops are recorded, never checked in as
math-mutated stems. Re-run after bank changes; `--coverage-only` flags gaps.

**Note — image is a SEPARATE, offline concern.** Per-question background/scene
art is NOT generated here and NOT generated live. Concept art is produced
offline and resolved per concept — see §5.4.

---

### 1.4 `/hint-agent` (near-term)

**Purpose:** When a student answers wrong, generate a Socratic nudge that
targets the specific ingredient they likely failed at, not just "try again."

**Reads from deterministic engine:**
- The question's correct key and the student's chosen answer
- The question's `conceptId` and ingredient `diagnostic_tags` from Layer 1
- Student's ingredient mastery from `ingredient_states/{uid}` in Firestore
  (if available; otherwise infer from concept mastery)

**Input contract:**
```json
{
  "question": { "stem": "...", "choices": {}, "key": "B", "conceptId": "functions_basics" },
  "student_answer": "A",
  "attempt_number": 1,
  "time_seconds": 23,
  "ingredients_at_risk": ["functions_basics__input_output_mapping"]
}
```

**Output contract:**
```json
{
  "hint": "Think about what happens when you plug x=2 into the rule. What does the machine spit out?",
  "target_ingredient": "functions_basics__input_output_mapping",
  "hint_level": 1
}
```

**Rules:**
- Hint level 1: question-level nudge (reframe, no content)
- Hint level 2: ingredient-level nudge (name the mental model being tested)
- Hint level 3: worked example step (only after 2 wrong attempts)
- Never reveal the correct answer — not even partially
- Never say "incorrect" or "wrong" — only forward-directed language
- Hints must be ≤ 30 words
- Use the active story world if available: "Asel's formula..." instead of
  "the function..."

**Fallback:** Fixed text: "Take another look at the relationship between the
input and the output." Always valid, never exposes the answer.

---

### 1.5 `/post-session-agent` (near-term)

**Purpose:** After a practice session completes, generate a 3-sentence
personalized reflection: what the student just did, what it connects to, and
what's next in the story.

**Reads from deterministic engine:**
- Session outcome events (correct count, struggled ingredients, time)
- Updated mastery from `/record-outcomes` response
- Next recommended concept from `/recommend`

**Input contract:**
```json
{
  "session_summary": {
    "concept_id": "functions_basics",
    "total_questions": 8,
    "correct": 6,
    "struggled_ingredients": ["functions_basics__domain_range"],
    "duration_seconds": 420
  },
  "active_story": "Asel's game studio",
  "next_concept": "quadratic_functions",
  "student_name": "Priya"
}
```

**Output contract:**
```json
{
  "reflection": "Asel's character can finally jump consistently — Priya nailed the input-output connection. The domain-range gap is still there, but it's smaller. Next: quadratic functions, where Asel needs to model the jump arc itself.",
  "mastery_signal": "improving",
  "next_hook": "The jump works now, but Asel needs the arc to feel right."
}
```

**Rules:**
- Three sentences: past (what just happened), present (where the gap is now),
  future (story hook for next session)
- Use student's name and the active story world
- `mastery_signal` ∈ `strong | improving | struggling | breakthrough` —
  used to style the reflection card in the UI

---

### 1.6 `/transcribe-scratch`

**Purpose:** Transcribe a student's ScratchPad canvas image into plain text
and LaTeX so later deterministic parsing can read the student's actual work.

**Reads from deterministic engine:**
- No graph or ontology reads. The endpoint only verifies the Firebase ID token
  and reads the submitted canvas image.

**Input contract:**
```json
{
  "imageBase64": "data:image/png;base64,...",
  "lines": [
    { "imageBase64": "data:image/png;base64,..." }
  ]
}
```

Request must include `Authorization: Bearer <Firebase ID token>`. `imageBase64`
is the whole-page back-compat path. `lines` is optional and, when present,
contains per-line crops; the endpoint transcribes each crop and derives the
flat `text` / `latex` fields by joining the per-line results. Reject
missing/invalid tokens with 401 and reject any image payload larger than about
1.5 MB with 413.

**Output contract:**
```json
{
  "text": "line-by-line plain-language reading",
  "latex": "$x+2=5$\n$x=3$",
  "perLine": [
    { "text": "x plus 2 equals 5", "latex": "$x+2=5$" },
    { "text": "x equals 3", "latex": "$x=3$" }
  ],
  "unavailable": false
}
```

`perLine` is optional and appears only for the `lines` input path.
`unavailable` is optional and appears when the provider path fails. If the
image is blank or illegible, return `{ "text": "", "latex": "" }`.

**Model:** Primary `TRANSCRIBE_MODEL` env var, defaulting to
`claude-haiku-4-5-20251001` vision. Use `temperature: 0`. If Anthropic is
unavailable, fall back to Groq vision
`meta-llama/llama-4-scout-17b-16e-instruct` behind the same response schema
unless `TRANSCRIBE_MODEL` names a Groq Llama model.

**Latency budget:** 4000ms. The UI treats this as an enhancement and hides the
pane quietly when unavailable.

**Rules:**
- Transcribe only. Do not solve, correct, complete, or explain the work.
- Output valid JSON only: `{ "text": string, "latex": string }`.
- `text` and `latex` should preserve one written line per output line.
- `latex` uses `$...$` inline delimiters for each math line.
- Same image input should produce identical output across retries.
- Parse defensively because providers may wrap JSON in markdown fences.

**Fallback:** `{ "text": "", "latex": "", "unavailable": true }`. Silent,
never blocks ScratchPad saving or practice.

---

### 1.6a `/parse-homework`

**Purpose:** Turn 1-4 photographed/scanned homework page images into a
structured array of extracted questions, so a student's uploaded worksheet
can become interactive work pages on the dashboard. Routed through the
consolidated `app-actions.ts` router (`POST /api/parse-homework` →
`app-actions?action=parse-homework`) rather than its own Vercel function —
the Hobby plan's serverless function count is already at its cap. PDF pages
are rasterized to page images client-side before this endpoint is called;
Groq vision cannot read PDFs directly.

**Reads from deterministic engine:** Nothing. Token verification only (same
as `/transcribe-scratch`).

**Input contract:**
```json
{
  "pages": [{ "imageBase64": "data:image/jpeg;base64,..." }],
  "startPage": 0
}
```
Request must include `Authorization: Bearer <Firebase ID token>`. `pages`
holds 1-4 page images (extra pages truncated silently); each image capped
at ~1.5 MB base64 (reject larger with 413). `startPage` is optional and
purely informational (client-side chunk offset for logging).

**Output contract:**
```json
{
  "questions": [
    {
      "number": "3",
      "text": "Solve $2x + 5 = 13$ for $x$.",
      "choices": ["A. 4", "B. 9"],
      "figureNote": "a right triangle with legs 6 and 8",
      "continuesFromPrevious": false,
      "ambiguous": false
    }
  ],
  "pageCount": 2,
  "unavailable": false
}
```
`number` is the printed question label or null if unlabeled. `text` is the
full question (math as `$...$` LaTeX); sub-parts (a/b/c) under one number
stay together in one `text`, never split into separate questions.
`choices` is present only for multiple choice. `figureNote` is a short
plain-language description of a required diagram, else null.
`continuesFromPrevious` flags a question that picks up mid-sentence from
the previous page/chunk (the client merges it into the prior question).
`ambiguous` flags a split the model is not confident about, so the UI can
warn the student instead of silently guessing wrong. `unavailable` appears
only when every provider failed.

**Model:** `claude-haiku-4-5-20251001` vision primary (env override
`PARSE_HOMEWORK_MODEL`). If Anthropic is unavailable, fall back to Groq
vision `meta-llama/llama-4-scout-17b-16e-instruct` behind the same response
schema. One call per page, pages run in parallel via `Promise.all`.

**Latency budget:** 20000ms per page (parallel across pages in one
request). The UI shows a "reading your pages" state, not an in-session
blocking spinner — this is a pre-session upload step, not a timed
interaction.

**Rules:**
- Transcribe and split only. Never solve, answer, or annotate a question.
- Output valid JSON only: `{ "questions": [...] }`. Parse defensively —
  providers may wrap JSON in markdown fences.
- Shared instructions covering a block of questions ("use the graph below
  for questions 5-7") must be copied into every affected question's `text`.
- Ignore headers, footers, page numbers, decorative content — never invent
  a question for them.
- Cap `text` at 2000 chars, `figureNote`/each choice at 300 chars, `number`
  at 20 chars, choices array at 12 entries. Truncate silently.
- A blank page or a page with no questions returns `"questions": []`.
- No story, scene, or narrative wrapping of any kind — this endpoint only
  transcribes the student's own real homework. If a future pass adds a
  story frame around extracted questions, it must follow the same
  situation → task → math-as-the-action → result shape as the rest of the
  question bank (see `/story-module` and the bank's `storyContext`
  fields) — never decorative wallpaper bolted onto an unrelated problem.

**Fallback:** `{ "questions": [], "pageCount": 0, "unavailable": true }`.
Silent to the student's session state — the upload UI shows a plain-language
retry prompt, never a raw error.

---

### 1.7 `/world-builder` (future — do not build yet)

**Purpose:** Generate a persistent game environment that evolves with the
student's learning arc. Concepts are crises. Sessions are missions. Mastery
is world-state change.

**Design constraints (for when this is built):**
- World state is stored in Firestore `world_state/{uid}`
- Each concept mastered triggers a world event (city rebuilt, problem solved,
  new area unlocked)
- The deterministic engine's `canonicalChain` maps directly to the mission
  sequence — the pathfinder IS the quest line
- Agent generates environment descriptions and event text; Manim/Desmos/Three.js
  renders them
- Bridge gaps appear as literal broken bridges or blocked paths in the world
- The agent never changes the quest line — only the aesthetic world wrapping it

**Future integrations:**
- **Manim**: animated math visualizations called from `/story-module` — "show
  me what this function looks like as x changes"
- **Desmos**: interactive graph embeds generated from the question's coordinate
  data; rendered in `Question.figure` field
- **GeoGebra**: geometry diagrams for `diagram` format questions
- **Flux/DALL-E/Higgsfield**: concept art via the offline pipeline in §5.4 —
  NOT a live per-question call

---

## 2. General LLM Call Rules

These apply to EVERY agent call without exception.

### 2.1 Input validation (before calling LLM)

1. Never call an LLM with a student ID you have not verified against the
   Firebase Auth token in the request. Agent enrichment is still a data
   endpoint — it reads the student's graph.
2. Validate all input fields before constructing the prompt. A missing
   `concept_id` should return a 400, not a prompt with "undefined" in it.
3. Cap all text inputs: stems ≤ 500 chars, story context ≤ 300 chars, student
   name ≤ 50 chars. Truncate silently — never reject because of length.

### 2.2 Prompt construction rules

1. **System prompt is the authority document.** It contains the constraints.
   The user message contains the variable data. Never put constraints in the
   user message — they can be overridden by clever input.
2. **Include the output schema in the system prompt.** The model must know it
   will be parsed. Example: "You MUST respond with valid JSON matching this
   schema exactly: { ... }. No prose before or after the JSON."
3. **Include the fallback contract.** Tell the model what to output if it
   cannot satisfy the request: "If you cannot generate a story for this
   concept, output: { 'story': null, 'fallback': true }."
4. **Concept IDs are canonical.** Pass them verbatim from Layer 1. Never let
   the model invent concept IDs — it will hallucinate plausible-sounding but
   invalid slugs.
5. **Never ask the model to decide pedagogy.** Prompts like "which concept
   should the student study next?" are banned. The deterministic engine answers
   that. The model may comment on pacing or tone, never on curriculum ordering.

### 2.3 Output validation (after calling LLM)

1. Parse the response as JSON. If parsing fails: log the raw response, return
   the fallback, do not raise.
2. Validate required fields are present. If a required field is missing: use
   the fallback value for that field, log a warning.
3. Validate field types and lengths. Truncate strings that exceed limits; clamp
   floats to their expected ranges.
4. Never pass raw LLM output to the frontend without validation. The validation
   layer is the contract boundary.
5. Log `{ model, latency_ms, token_count, used_fallback }` for every call.
   This is how we know when the model is degrading and when fallbacks are
   being hit at high rates.

### 2.4 Fallback behavior

Every agent call MUST have a fallback that returns valid data in the correct
shape. Fallbacks are not errors — they are the guaranteed floor.

| Agent | Fallback |
|-------|---------|
| `/onboard-agent` | Heuristic cluster → concept broadcast |
| `/story-module` | Omit the item; client renders the plain question. On Groq failure, return cache hits only |
| `/hint-agent` | Fixed generic nudge text |
| `/post-session-agent` | Fixed "Nice work. Keep going." with mastery signal `improving` |
| `/transcribe-scratch` | Empty strings with `unavailable: true` |
| `/parse-homework` | Empty `questions: []` with `unavailable: true` |

Fallbacks must be indistinguishable from successful responses in shape. The
frontend should not need to know whether the LLM succeeded, except when an
endpoint explicitly defines an `unavailable` enhancement flag.

### 2.5 Model selection

| Use case | Model | Reason |
|----------|-------|--------|
| Onboarding agent | `llama-3.3-70b` (Groq) | JSON-heavy structured output; fast |
| Story module (stem reskin + guidance) | `llama-3.3-70b` (Groq) | Batched + cached per `{concept, question}`; math frozen, so narrative fidelity is a validation guard, not a model-tier need. Don't move to `claude-fable-5` without a demonstrated quality gap |
| Hint generation | `llama-3.3-70b` (Groq) | In-session, must be < 500ms |
| Post-session | `claude-fable-5` | Reflective quality over speed |
| Scratch transcription | `claude-haiku-4-5` vision, fallback `llama-4-scout` vision (Groq) | Small image-to-JSON task; graceful if provider credits fail |
| Homework page parsing | `claude-haiku-4-5` vision, fallback `llama-4-scout` vision (Groq) | Page-image → structured JSON, same graceful cascade as scratch transcription |
| World builder 🔮 | `claude-opus-4-8` | Complex world-state reasoning |

Switch models by setting `LLM_PROVIDER` in env. The agent layer MUST be
provider-agnostic — no Groq-specific or Anthropic-specific code outside of
`ml/mindcraft_graph/llm_client.py`.

### 2.6 Latency budgets

| Agent | Max latency | What happens if exceeded |
|-------|-------------|--------------------------|
| `/onboard-agent` | 3000ms | Show loading screen; user waited already |
| `/story-module` | 25000ms (batched, pre-session) | Serve cache hits; render plain questions for the rest. Not an in-session blocking call — skins load before the session starts |
| `/hint-agent` | 600ms | Show generic fallback hint immediately |
| `/post-session-agent` | 3000ms | Show generic reflection |
| `/transcribe-scratch` | 4000ms | Hide transcription pane quietly |
| `/parse-homework` | 20000ms per page | Return `unavailable: true`; UI shows a plain-language retry prompt |

Timeouts are enforced in `llm_client.py` via `httpx.AsyncClient(timeout=...)`.
Never let a hung LLM call block a student mid-session.

---

## 3. What the Agent Can and Cannot Do

### 3.1 The agent CAN:

- Read the student's full knowledge graph (mastery, gaps, bridge evidence)
- Read the question the deterministic engine selected
- Read the concept ontology (names, descriptions, ingredients)
- Generate prose (stories, frames, hints, reflections)
- Generate scene descriptors (CSS gradients, image prompts)
- Suggest tone adjustments ("this student has been struggling, use gentler
  framing") that the frontend applies
- Emit structured metadata (`mood`, `tone`, `mastery_signal`) used by the UI
  for styling
- Later: call Manim/Desmos APIs to generate visual assets

### 3.2 The agent CANNOT:

- Change which concept a student studies next
- Override the difficulty level set by `bridgePractice.getRecommendedLevel`
- Decide whether a student has mastered a concept
- Select or reject questions from the question bank
- Write to Firestore directly (all writes go through the deterministic engine
  endpoints: `/record-outcomes`, `/seed-assessment`, `/submit-answer`)
- Override a bridge gap's severity score
- Change the `canonicalChain` order returned by the pathfinder
- Reveal a question's correct answer, even in hints

### 3.3 The fence in code

Illustrative pseudocode of the deterministic/agent fence. **Note:** the live
agents run as Vercel webhook functions (`webhook/api/*`), not in `ml/serve.py`
— this example predates that and is kept only to show the read-only pattern.

```python
@app.post("/story-agent")  # illustrative only — real endpoint is webhook /story-module
async def story_agent_endpoint(req: StoryAgentRequest, uid: str = Depends(verify_token)):
    # 1. Read from deterministic (read-only)
    graph = await get_knowledge_graph(req.student_id)
    concept = ontology.get_concept(req.concept_id)

    # 2. Build prompt (agent sees data, not decisions)
    prompt = build_story_prompt(concept, graph, req)

    # 3. Call LLM (with timeout + fallback)
    result = await llm_client.generate(prompt, timeout_ms=4000, fallback=story_fallback(req))

    # 4. Validate output (contract boundary)
    validated = StoryAgentResponse.model_validate(result)

    # 5. Return — no writes
    return validated
```

The agent endpoint never calls `/record-outcomes` or any write endpoint. It
never modifies `graph`. It reads, generates, validates, returns.

---

## 4. Data the Agent Can Read at Each Touchpoint

| Touchpoint | Graph data | Ontology data | Session data |
|------------|-----------|---------------|--------------|
| Onboarding | Cold-start priors only (no real graph yet) | All 29 ACT concept names + priors | Intake answers |
| Story splash | Worst gap concept + severity | Concept name + ingredients | Mission type (weakness/learn) |
| Question frame | Active bridge gaps | Question's concept + ingredient tags | Active story world |
| Hint | Ingredient mastery (if exists) | Ingredient diagnostic tags | Wrong answer + attempt count |
| Post-session | Updated mastery delta | Next concept name | Session outcome events |
| World builder 🔮 | Full graph state | Full ontology | Full session history |

The frontier expands as the student accumulates history. Early sessions have
sparse graph data — prompts must be designed to work with partial information.

---

## 5. Future Integration Points

### 5.1 Manim (animated math visualization)

- Triggered by `/story-module` when `format` is
  `coordinate_graph` or when a concept has strong geometric representation
- Input: a Manim scene specification (function parameters, animation steps)
- Output: an MP4 or SVG embedded in the story card or question frame
- The agent generates the Manim scene spec; Manim renders it; frontend embeds it
- Never block session start on Manim render — stream it in after load

### 5.2 Desmos

- Triggered by questions with `format: coordinate_graph`
- `Question.figure` field carries a Desmos JSON expression list
- Agent populates `Question.figure` from the question stem's coordinate data
- Frontend renders via Desmos embed API inside the question card
- Read-only for students; interactive on instructor view

### 5.3 GeoGebra

- For `format: diagram` questions with geometric content
- Agent generates a GeoGebra construction spec (points, lines, constraints)
- Frontend renders via GeoGebra embed

### 5.4 Concept art (offline pipeline — NOT a live per-question call)

Art is keyed **per concept**, generated **offline**, and checked into the repo.
It is not an agent endpoint and never runs at serve time. This is deliberate —
see `STORY_LAYER_RECONCILE.md` for why per-concept-offline beats per-question-live.

- **Pipeline:** `app/scripts/generateConceptArt.mjs` (Higgsfield) +
  hand-authored SVGs drop plates into `assets/canvas/generated/story-{conceptId}.{jpg,svg}`.
  `app/src/lib/storyArt.ts` auto-discovers them via `import.meta.glob` — adding
  a concept needs no code edit, just a rerun of the script.
- **Precedence:** generated jpg/svg > hand-picked `ART` map > theme fallback.
  `storyArtFor()` always returns a real image — never an empty box.
- **The image sets the WORLD (a property of the concept); `/story-module` text
  sets the SCENE within it (per question).** Together that's a bespoke-feeling
  question without a per-question image. Do NOT add live per-serve image gen.
- **If a concept ever needs per-question art:** generate it offline into the
  same glob keyed `story-{conceptId}-{questionId}.{jpg,svg}` (most-specific asset
  wins) — still offline, still cached, still never a live call.
- Regenerating for more concepts is a rerunnable script, gated only by
  image-provider credits — it is not on the runtime cost/latency path.

---

## 6. Observability

Every LLM call logs to a `agent_calls` collection in Firestore:

```json
{
  "touchpoint": "/story-module",
  "student_id": "...",
  "concept_id": "functions_basics",
  "model": "llama-3.3-70b",
  "latency_ms": 2340,
  "token_count": 487,
  "used_fallback": false,
  "fallback_reason": null,
  "timestamp": "2026-07-05T..."
}
```

Alerts:
- `used_fallback` rate > 10% on any touchpoint → investigate
- `latency_ms` P95 > 1.5x budget on in-session touchpoints → degrade to
  faster model or expand fallback window
- Any touchpoint with `used_fallback: true` AND session abandoned within 30s
  → correlated UX regression signal

---

## 7. Adaptive Model — Four-Layer Framework

This is the company's core IP. Every agent call should be aware of which layer
it is serving and what data is available to it.

### 7.1 The four layers

| Layer | Question it answers | Data source | Current status |
|-------|---------------------|-------------|----------------|
| **Math** | What concept is weak? | `/recommend` gaps, `studentProfile.topWeaknesses` | ✅ Live in engine |
| **Cognitive** | What mental process is overloaded? | `time_seconds`, `attempt_count` per question | ⚠️ Partially collected; `cognitive_signal` not yet derived |
| **Affective** | What emotional state is blocking learning? | Pre-session check-in → `affective_state/{uid}/latest` | ✅ Check-in exists; `affective_modifier` live in `/recommend` |
| **Independence** | How much support can we safely remove today? | Bridge gap severity + session history + hint usage | ❌ Not yet tracked |

### 7.2 Cognitive signal derivation (deterministic)

When a student answers a question, derive `cognitive_signal` from timing and correctness. This is deterministic — no LLM needed.

| Condition | Signal | Interpretation |
|-----------|--------|----------------|
| correct + fast (< 15s) | `fluent` | Concept is solid; can increase difficulty |
| correct + slow (> 45s) | `effortful` | Understands but working memory loading; consider scaffolding |
| wrong + fast (< 15s) | `anxious` | Guessing or overconfident gap; slow down, no timer |
| wrong + slow (> 45s) | `overloaded` | Multiple processes failing; reduce load, use visuals |
| wrong + multiple attempts | `stuck` | Scaffolding needed; trigger `/hint-agent` |

Frontend: derive `cognitive_signal` in `Practice.tsx` before calling `/record-outcomes`.
Backend: include as optional field in `OutcomeItem` (non-breaking addition).

### 7.3 The adaptive agent loop

Every session, the agents collectively run:

```
Detect     → What does the student graph say is weak? (/recommend)
Diagnose   → Why is it weak? (cognitive + affective signals)
Scaffold   → Choose question level + format that reduces load (/hint-agent, format rotation)
Regulate   → Adjust tone: urgent (weakness) vs. curious (learn next) vs. reflective (review)
Retry      → Present next question at adjusted difficulty
Fade       → When fluent signal appears, remove hint affordance
Reflect    → Post-session: what changed, what's next (/post-session-agent)
```

### 7.4 Reduce extraneous load first

For every learner — especially those with attention fatigue or high math
anxiety — reduce presentation burden before increasing content difficulty.

**Remove from all question and session screens:**
- Timers (cause anxiety, consume working memory)
- Red × marks on wrong answers
- Dense multi-step instructions on one screen
- Noisy animations or transitions during active reading
- Forced gamification pressure (streaks, leaderboards)
- Exclamation marks on any feedback

**Use instead:**
- One question per screen
- Persistent scratchpad / visible previous steps
- Calm pacing (never auto-advance)
- Visual representations as default for geometry/functions concepts
- Micro-confirmations: "There it is." not "Great job!!"
- Optional hint path (always available, never forced)

### 7.5 The learner profile moat

Over time, each student builds a profile that the system reads:

```json
{
  "preferred_formats": ["visual", "word_problem"],   // from format-tagged outcomes
  "optimal_session_length": 12,                       // minutes before fluency drops
  "scaffold_need": "medium",                          // from independence model
  "anxiety_threshold": 0.6,                           // from affective modifier
  "cognitive_signals_history": ["effortful", "fluent", "anxious", "fluent"]
}
```

This profile makes MindCraft more valuable over time — not because it has
more problems, but because it knows *what kind of support this child needs today
and what support can be safely removed.*

---

## 8. Build Order

| Phase | Agent | Endpoint | Depends on |
|-------|-------|----------|------------|
| 1 | Onboarding | `/onboard-agent` | `/exam-concepts/act`, Layer 1 priors |
| 2 | Story module (stem reskin + guidance) ✅ SHIPPED | `/story-module` | concept stories, question bank |
| 3 | Hints | `/hint-agent` | `/knowledge-graph`, ingredient tags |
| 4a | Cognitive tagging | deterministic in frontend | `time_seconds` + correctness → `cognitive_signal` |
| 5 | Post-session | `/post-session-agent` | `/record-outcomes` response |
| 6 | World builder | `/world-builder` | Full graph + story history |
| 7 | Manim/Desmos | Via `/story-module` | Visual asset pipeline |
