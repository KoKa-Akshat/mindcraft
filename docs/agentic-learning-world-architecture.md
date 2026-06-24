# MindCraft Agentic Learning World Architecture

MindCraft should borrow the strongest idea from Minecraft agent research without becoming a Minecraft product: do not ask an LLM to improvise every action from scratch. Give it a structured world, reusable skills, an execution harness, memory, and a reflexion loop.

## Research Ideas To Adopt

Voyager's core lesson is the Skill Library. When an agent succeeds at a useful task, the system saves the policy as reusable code or a reusable prompt/program. In MindCraft, a skill is not `mineWood()`. It is more like `diagnoseQuadraticGap()`, `generateSocraticHint()`, `buildManimScenePrompt()`, or `repairEssayThesis()`.

GITM's lesson is recursive task decomposition. A large goal like "be ready for SAT Math in 5 days" should become a dependency tree: exam goal, weighted gaps, broken prerequisites, repair ingredients, practice cards, review checkpoints, and readiness reflection.

Generative Agents gives us the Memory Stream. MindCraft should record student observations, failures, preferences, and teaching constraints as durable memories. Example: "This student recovers well after visual hints but abandons long symbolic explanations."

MineDojo points toward grounded domain schemas. Each subject needs structured recipes, rules, examples, common misconceptions, and tool affordances. For us, that means subject graphs, exam blueprints, misconception libraries, card templates, visual metaphors, and eventually whitepaper/Manim generation specs.

Reflexion is the key to making failures useful. When a generated lesson, hint, or practice sequence fails, the platform should save a verbal constraint that changes future behavior. Example: "Next time, do not introduce factoring and completing the square in the same repair step."

Agent harness work says reliability comes from infrastructure. The product needs clean execution traces, inputs, outputs, errors, metrics, and rollback boundaries around every generated artifact.

## MindCraft Translation

The MindCraft cognitive loop should look like this:

1. Environment Input
   Student profile, current subject graph, recent answers, clue usage, idle time, retries, confidence, exam deadline, and active gap.

2. Planning Brain
   Claude receives the goal, retrieves relevant skills and memories, then creates a small plan. The plan should be inspectable before execution.

3. Skill Library
   Reusable policies for diagnosis, hinting, practice generation, lesson generation, reflection, and visual generation. These are stored as versioned `agent_skills`.

4. Memory Stream
   Durable records in `agent_memory`: observations, constraints, schema updates, teaching preferences, and failure patterns.

5. Execution Hook
   Every generated lesson, question set, hint policy, Manim prompt, or readiness copy should produce an `agent_execution_trace` with inputs, outputs, success state, and metrics.

6. Reflexion Loop
   Failed traces become `agent_reflexions`, and the most important lesson becomes a `constraint` memory that future plans retrieve.

## Current Backend Scaffolding

The ML API now has the first version of these primitives:

- `POST /agent-skills`
- `GET /agent-skills/{subject_id}?concept_id=...`
- `POST /agent-memory`
- `GET /agent-memory/{subject_id}?student_id=...&concept_id=...`
- `POST /agent-execution-traces`
- `POST /agent-reflexions`

These sit beside:

- `GET /subjects`
- `GET /learning-world/{subject_id}/{student_id}`
- `POST /learning-event`
- `POST /recommend-next-learning-action`

## Data Contracts

`AgentSkill` is code-as-policy:

```json
{
  "id": "sat_math_quadratic_hint_v1",
  "subject_id": "math",
  "concept_id": "quadratic_equations",
  "name": "Quadratic Socratic Hint",
  "goal": "Help a student notice the structure of a quadratic without giving away the answer.",
  "policy_type": "hinting",
  "language": "prompt",
  "code": "Ask which form the quadratic resembles. If stuck, point to the coefficient pattern.",
  "success_criteria": ["student retries", "student explains the next move"],
  "failure_modes": ["gives answer directly", "introduces too many methods"]
}
```

`MemoryRecord` is the memory stream:

```json
{
  "student_id": "student_123",
  "subject_id": "math",
  "concept_id": "quadratic_equations",
  "memory_type": "teaching_preference",
  "text": "Student responds better to graph-shape metaphors than symbolic manipulation first.",
  "importance": 0.82
}
```

`ExecutionTrace` is the harness log:

```json
{
  "student_id": "student_123",
  "subject_id": "math",
  "concept_id": "quadratic_equations",
  "skill_id": "sat_math_quadratic_hint_v1",
  "goal": "Generate question 4 hint",
  "plan": ["retrieve gap", "choose hint skill", "generate clue", "observe retry"],
  "success": false,
  "error": "Student abandoned after hint",
  "metrics": { "idleSeconds": 64, "retryCount": 0 }
}
```

`ReflexionRecord` turns failure into a future constraint:

```json
{
  "subject_id": "math",
  "concept_id": "quadratic_equations",
  "failure_summary": "Student abandoned after a symbolic hint.",
  "cause": "Hint assumed comfort with factoring vocabulary.",
  "next_constraint": "For this student, use a visual parabola or area model before factoring language.",
  "confidence": 0.76
}
```

## Product Direction

The immediate product win is not fully autonomous agents. It is harnessed autonomy:

- Let Claude generate practice and lesson policies.
- Save the policies only after they work.
- Record every failure as structured trace data.
- Convert failures into durable teaching constraints.
- Retrieve skills and memories before the next generation.
- Show the student the result as a humane Learning World, not as raw agent logs.

This is how MindCraft becomes infrastructure for personalized learning rather than another wrapper around chat.
