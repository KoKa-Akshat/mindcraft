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

### 1.2 `/story-agent`

**Purpose:** For a given concept and student profile, generate a ~200-word
narrative story that makes the concept feel urgent and personal. Also emit a
scene descriptor for background image generation (CSS gradient for now;
Flux/DALL-E/Manim later).

**Reads from deterministic engine:**
- Student's worst gap concept (from `/recommend` → first `recommendations[]` item)
- `studentProfile.topWeaknesses` from `/recommend`
- Concept name and `learning_style_affinity` from Layer 1

**Input contract:**
```json
{
  "concept_id": "functions_basics",
  "concept_name": "Functions",
  "student_name": "Priya",
  "worst_ingredient": "functions_basics__input_output_mapping",
  "mission_type": "weakness",
  "previous_story_ids": ["linear_equations", "absolute_value"]
}
```

**Output contract:**
```json
{
  "story": "Asel is a game developer... [~200 words]",
  "scene": {
    "setting": "game studio at 2am, multiple monitors",
    "mood": "urgent, electric",
    "css_gradient": "linear-gradient(135deg, #0d1117 0%, #1a0a2e 50%, #0d2137 100%)",
    "accent_color": "#7c3aed",
    "future_prompt": "A game developer's studio at night, multiple screens showing broken game physics, warm desk lamp, purple-blue color palette"
  },
  "hook_line": "Her character keeps jumping at the wrong height — and she can't figure out why."
}
```

**Rules:**
- Stories must involve a PERSON in a CRISIS that the target concept would solve
- The person should feel like someone the student could actually know
- Vary demographics, professions, and settings across concepts — no two stories
  should feature the same profession or setting
- Never mention the concept name directly in the story body ("functions" must
  not appear in the Asel story — the concept is embedded in the crisis)
- `hook_line` ≤ 20 words, present tense, stakes-first
- `css_gradient` must be valid CSS, dark background, ≥ 2 stops
- Stories with `mission_type: "weakness"` carry higher emotional stakes (the
  crisis is urgent, the world needs solving) vs. `"learn"` (the person is
  curious, exploring, discovering something new)
- `previous_story_ids` are passed to prevent setting/profession reuse

**Fallback:** Use pre-generated story from `conceptStories.json` if it exists
for the concept. If no story exists, use generic framing ("A student is
struggling with [concept]. Let's help them.") — boring but never null.

---

### 1.3 `/question-frame` (near-term)

**Purpose:** Take a question the deterministic engine has selected and wrap it
in a contextual stakes frame — one or two sentences that connect it to the
student's known gap and the active story's world.

**Reads from deterministic engine:**
- The `Question` object (stem, choices, concept, level, format)
- Student's active bridge gaps (`isBridgeGap`, `bridgeEvidence` from
  `/knowledge-graph`)
- Active session's story (passed from frontend state)

**Input contract:**
```json
{
  "question": { "conceptId": "functions_basics", "stem": "...", "level": 1 },
  "active_story_world": "game studio, Asel's broken physics engine",
  "worst_bridge": "functions_basics → quadratic_functions",
  "student_name": "Priya"
}
```

**Output contract:**
```json
{
  "frame": "Asel's character jumps based on a formula — but she wrote it wrong. This is exactly the kind of input-output mapping that's tripping you up.",
  "tone": "urgent"
}
```

**Rules:**
- Frame ≤ 40 words
- Must reference either the active story world OR the specific gap — not just
  generic motivation ("you can do this!")
- Never give away the answer or hint at which choice is correct
- `tone` ∈ `urgent | curious | reflective` — matches `mission_type`

**Fallback:** No frame. Question renders without contextual wrapper. Silent,
never an error.

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
  "imageBase64": "data:image/png;base64,..."
}
```

Request must include `Authorization: Bearer <Firebase ID token>`. Reject
missing/invalid tokens with 401 and reject canvas payloads larger than about
1.5 MB with 413.

**Output contract:**
```json
{
  "text": "line-by-line plain-language reading",
  "latex": "$x+2=5$\n$x=3$",
  "unavailable": false
}
```

`unavailable` is optional and appears only when the provider path fails. If
the image is blank or illegible, return `{ "text": "", "latex": "" }`.

**Model:** Primary `claude-haiku-4-5-20251001` vision call. If Anthropic is
unavailable, fall back to Groq vision
`meta-llama/llama-4-scout-17b-16e-instruct` behind the same response schema.

**Latency budget:** 4000ms. The UI treats this as an enhancement and hides the
pane quietly when unavailable.

**Rules:**
- Transcribe only. Do not solve, correct, complete, or explain the work.
- Output valid JSON only: `{ "text": string, "latex": string }`.
- `text` and `latex` should preserve one written line per output line.
- `latex` uses `$...$` inline delimiters for each math line.
- Parse defensively because providers may wrap JSON in markdown fences.

**Fallback:** `{ "text": "", "latex": "", "unavailable": true }`. Silent,
never blocks ScratchPad saving or practice.

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
- **Manim**: animated math visualizations called from `/story-agent` or
  `/question-frame` — "show me what this function looks like as x changes"
- **Desmos**: interactive graph embeds generated from the question's coordinate
  data; rendered in `Question.figure` field
- **GeoGebra**: geometry diagrams for `diagram` format questions
- **Flux/DALL-E**: background image from `scene.future_prompt` in story agent
  response — replaces CSS gradient once image gen is stable

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
| `/story-agent` | Pre-generated story from `conceptStories.json` |
| `/question-frame` | Empty frame (question renders without wrapper) |
| `/hint-agent` | Fixed generic nudge text |
| `/post-session-agent` | Fixed "Nice work. Keep going." with mastery signal `improving` |
| `/transcribe-scratch` | Empty strings with `unavailable: true` |

Fallbacks must be indistinguishable from successful responses in shape. The
frontend should not need to know whether the LLM succeeded, except when an
endpoint explicitly defines an `unavailable` enhancement flag.

### 2.5 Model selection

| Use case | Model | Reason |
|----------|-------|--------|
| Onboarding agent | `llama-3.3-70b` (Groq) | JSON-heavy structured output; fast |
| Story generation | `claude-fable-5` | Narrative quality matters most here |
| Question framing | `llama-3.3-70b` (Groq) | Short output, latency-sensitive (in session) |
| Hint generation | `llama-3.3-70b` (Groq) | In-session, must be < 500ms |
| Post-session | `claude-fable-5` | Reflective quality over speed |
| Scratch transcription | `claude-haiku-4-5` vision, fallback `llama-4-scout` vision (Groq) | Small image-to-JSON task; graceful if provider credits fail |
| World builder 🔮 | `claude-opus-4-8` | Complex world-state reasoning |

Switch models by setting `LLM_PROVIDER` in env. The agent layer MUST be
provider-agnostic — no Groq-specific or Anthropic-specific code outside of
`ml/mindcraft_graph/llm_client.py`.

### 2.6 Latency budgets

| Agent | Max latency | What happens if exceeded |
|-------|-------------|--------------------------|
| `/onboard-agent` | 3000ms | Show loading screen; user waited already |
| `/story-agent` | 4000ms | Use fallback story; log timeout |
| `/question-frame` | 800ms | Skip frame silently; show raw question |
| `/hint-agent` | 600ms | Show generic fallback hint immediately |
| `/post-session-agent` | 3000ms | Show generic reflection |
| `/transcribe-scratch` | 4000ms | Hide transcription pane quietly |

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

Every agent endpoint in `ml/serve.py` follows this pattern:

```python
@app.post("/story-agent")
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

- Triggered by `/story-agent` or `/question-frame` when `format` is
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

### 5.4 Image generation (Flux / DALL-E)

- `scene.future_prompt` from `/story-agent` is the generation prompt
- Currently: CSS gradient from `scene.css_gradient` renders instead
- Migration path: when image gen is stable, store generated images in Firebase
  Storage keyed by `{concept_id}_{hash(student_profile)}`, cache aggressively
- The CSS gradient is the graceful fallback forever — never remove it

---

## 6. Observability

Every LLM call logs to a `agent_calls` collection in Firestore:

```json
{
  "touchpoint": "/story-agent",
  "student_id": "...",
  "concept_id": "functions_basics",
  "model": "claude-fable-5",
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
| 2 | Story enrichment | `/story-agent` | `conceptStories.json`, `/recommend` |
| 3 | Hints | `/hint-agent` | `/knowledge-graph`, ingredient tags |
| 4 | Question framing | `/question-frame` | Bridge gaps, active story state |
| 4a | Cognitive tagging | deterministic in frontend | `time_seconds` + correctness → `cognitive_signal` |
| 5 | Post-session | `/post-session-agent` | `/record-outcomes` response |
| 6 | World builder | `/world-builder` | Full graph + story history |
| 7 | Manim/Desmos | Via story + question agents | Visual asset pipeline |
