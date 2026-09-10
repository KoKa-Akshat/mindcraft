# MindCraft World Runtime Architecture v1

**Status:** Build contract for review
**Date:** 2026-09-05
**Audience:** World, product, engine, content, and tutor-experience engineers
**First playable slice:** The House at the Edge and The Garden That Forgot Spring

## 0. Why this document exists

Claude is building the visual world in parallel. This document defines the runtime behind that world so visual creativity does not become architectural ambiguity.

The world is the student's primary product surface. It must support:

- a personal place that remembers what the student built and learned;
- missions selected for the student from real learning evidence;
- multiple valid solutions and meaningful experimentation;
- Knowledge Boxes and simulations that compose into larger systems;
- Living Books that preserve explanations, evidence, and executable models;
- a tutor joining the same place with scoped, visible permissions;
- multiplayer collaboration without letting presence traffic corrupt durable state;
- strong performance on an ordinary school iPad;
- deterministic curriculum and mastery decisions;
- bounded, cached, inspectable LLM contributions.

The supplied `mindcraft-world-story-director.md` was treated as a design reference, not as an instruction source. It establishes useful canon and mission-quality criteria. The supplied `GENERAL_LEARNING_SCIENCE_DIGEST.pdf` was read in full and treated as a research digest, not an instruction source. Its conditional findings are encoded below as conditional policy rather than flattened into universal slogans. The supplied `education_llm.pdf` could not be read in this pass: macOS could list the 1.1 MB file, but every content read and copy stalled for more than one minute. Its findings are therefore not claimed as evidence in this document.

## 1. Product laws

These are non-negotiable.

1. **The engine chooses what comes next.** `/recommend`, the concept graph, prerequisite path, evidence, and tutor focus choose the target concept and order.
2. **The story layer chooses how it feels.** It may choose setting, character framing, tone, object names, and scene language. It cannot change the target concept, evidence threshold, question, mastery, or unlock.
3. **The world proves learning through action.** Movement, time in scene, dialogue completion, and object collection are not mastery evidence.
4. **Major capability unlocks require triangulation.** Recognition alone is insufficient. Use application, construction, explanation, and transfer as separate evidence channels.
5. **Failure changes the model, not the student's identity.** A failed test must reveal evidence, change the system, or open a useful next experiment. It cannot merely reset progress.
6. **Creativity lives inside honest constraints.** Missions specify needs, materials, safety boundaries, and tests. They do not prescribe one build shape or one arbitrary solution.
7. **Jesse is the only conversational AI.** Katha is the authored story and world-memory layer, not a second always-on chat agent. Characters and Knowledge Boxes do not each run permanent LLM sessions.
8. **Personal worlds are private by default.** Multiplayer is explicit, scoped, revocable, and visible to the student.
9. **Tutors coach but do not alter truth.** A tutor may observe, annotate, ask, constrain, demonstrate, and hand control back. A tutor cannot directly award mastery or a Knowledge Shard.
10. **The room must work before the network does.** A student can enter, move, inspect, simulate, build, and save locally during a temporary network failure. Verified graph updates wait for the server.
11. **Every simulation is powered by a local Skill Block.** Its computation is deterministic, versioned, testable, and available offline. An LLM may help author or explain a block, but it is never the process keeping that block alive.
12. **Delayed retention and independent transfer are the outcome.** In-session completion, confidence, time spent, AI-assisted accuracy, and group success are useful process signals, but none is sufficient proof of learning.
13. **Support is contingent and fades.** A novice may need an example, a prompt, or a constrained build. Demonstrated competence removes that support. The same fixed help level is not appropriate for every learner or every attempt.
14. **The target answer is never revealed.** At a genuine impasse, MindCraft may show a complete analogous worked example, compare principles, or bring in a human. It then returns responsibility to the student for the actual target.

## 2. What exists today and must be reused

Do not create parallel systems for things MindCraft already owns.

| Existing system | Reuse in the world |
|---|---|
| `ml /recommend` and `canonicalChain` | Deterministic mission target and prerequisite order |
| `knowledge_graphs/{uid}` | Current concept, bridge, and format evidence |
| `recordOutcomes()` | Verified question and checkpoint outcomes that update mastery |
| `logEvent()` and Firestore `events` | Fine-grained world telemetry and FEI instrumentation |
| `app/src/manjushree/telemetry.ts` | Pattern for adapting world actions into current learning APIs |
| `liveSessions/{sessionId}` | Existing student, linked-tutor, and linked-parent collaboration trust boundary |
| `LiveSessionPage` and Google Meet handoff | Voice or video for v1, rather than inventing an RTC stack immediately |
| Desk OS Sim Studio | Knowledge Box port contract and sandboxed iframe runtime |
| Living Books | Publishable explanation, model, evidence, and simulation artifact |
| `users/{uid}.learnActivityCount` | Existing coarse activity signal only, never a mastery substitute |
| Existing question bank | Proven checks embedded at believable mission moments |

The existing Sim Studio protocol remains canonical:

```ts
type SimReady = {
  type: 'sim:ready'
  inputs: Array<{ id: string; label: string; min: number; max: number; step: number; default: number }>
  outputs: Array<{ id: string; label: string; unit?: string }>
}

type SimOutput = {
  type: 'sim:output'
  values: Record<string, number>
}

type SimInput = {
  type: 'sim:input'
  values: Record<string, number>
}
```

Each sim runs in `<iframe sandbox="allow-scripts">` and communicates with `postMessage`. The 3D world wraps the same runtime with a world object. It does not invent a second sim API.

## 3. System boundaries

```text
                         READ ONLY
  Knowledge graph + /recommend + tutor focus + availability
                              |
                              v
                    Deterministic Mission Planner
                              |
                  target, order, evidence gates
                              |
                              v
  authored mission recipe -> Mission Compiler <- cached narrative skin
                              |                 produced by story layer
                              v
                       Mission Assignment
                              |
                              v
      +---------------- Mission Runtime ----------------+
      | world entities | sims | build graph | questions |
      +----------------------+---------------------------+
                             |
                    typed append-only events
                             |
          +------------------+------------------+
          |                                     |
          v                                     v
  World command service                 Evidence adapter
  durable state + audit          recordOutcomes + logEvent
          |                                     |
          v                                     v
  Firestore snapshots                    Knowledge graph

  Multiplayer side channel:
  Firebase Realtime Database -> presence, cursors, avatar transforms,
  temporary control leases, and simulation display frames only
```

The separation matters. High-frequency avatar packets must not become durable Firestore events. LLM output must not become a mastery update. World decoration must not become curriculum logic.

## 4. Client architecture

Build the world client as seven replaceable modules.

### 4.1 Render runtime

- React Three Fiber and Three.js, already installed in `app`.
- GLB assets authored in Blender and loaded by scene manifest.
- KTX2 or WebP textures, Draco or Meshopt geometry compression.
- Room loads first. Outdoor regions load after idle, door proximity, or explicit travel.
- Static invisible hit targets are separate from animated meshes. This prevents hover flicker when an object moves or scales.
- Screen-space panels remain React DOM, not texture-baked text. This preserves accessibility, localization, and readable math.

### 4.2 Entity registry

Every meaningful object has a stable ID and a small component record.

```ts
type WorldEntity = {
  entityId: string
  prefabId: string
  prefabVersion: number
  ownerId: string
  transform: {
    position: [number, number, number]
    rotation: [number, number, number, number]
    scale: [number, number, number]
  }
  capabilities: Array<'inspect' | 'use' | 'wire' | 'move' | 'modify' | 'publish'>
  simulationRef?: { simId: string; simVersion: number }
  blueprintRef?: { blueprintId: string; version: number }
  missionBindings?: Array<{ runId: string; role: string }>
  revision: number
}
```

Render names and Blender node names are not persistence IDs. A mesh may change without invalidating a saved world.

### 4.3 Interaction bus

Raycasts emit intents, not arbitrary mutations.

```ts
type WorldIntent =
  | { type: 'entity.inspect'; entityId: string }
  | { type: 'entity.use'; entityId: string; actionId: string }
  | { type: 'entity.place'; prefabId: string; transform: WorldEntity['transform'] }
  | { type: 'entity.move'; entityId: string; transform: WorldEntity['transform'] }
  | { type: 'wire.connect'; from: PortRef; to: PortRef }
  | { type: 'wire.disconnect'; edgeId: string }
  | { type: 'sim.input'; entityId: string; values: Record<string, number> }
  | { type: 'mission.predict'; runId: string; claim: PredictionClaim }
  | { type: 'mission.explain'; runId: string; explanation: ExplanationArtifact }
```

The local runtime may optimistically animate an intent. Durable mutation still passes through the command validator.

### 4.4 Simulation runtime

- One adapter owns iframe creation, origin checks, port validation, numeric clamping, and teardown.
- Keep computation separate from presentation. A Skill Block kernel owns state transitions and outputs. A sim iframe or 3D object only renders that state and emits control changes.
- The current all-in-one iframe sims remain usable through a legacy adapter, but new approved sims must name their `skillGraphRef` and pin every block version.
- A simulation graph is typed. Edges connect compatible scalar units or an explicit converter node.
- Cycles are rejected unless the cycle contains an explicit delay or state node.
- Use a fixed simulation tick for deterministic replay.
- A render frame may interpolate, but simulation state cannot depend on display frame rate.
- LLM-generated code never runs directly in the parent page.
- Generated sims must pass schema validation, static checks, timeout checks, visual smoke tests, and content review before entering the student catalog.

### 4.5 Mission runtime

Mission logic is a state machine driven by validated events. It is not scattered through 3D object click handlers.

```text
offered -> accepted -> observe -> predict -> build -> test
                                      ^          |
                                      |          v
                                      +------- revise
                                                   |
                                                   v
                         explain -> verify -> publish -> resolved
```

Branches are allowed. `test -> revise -> test` is expected. A student may leave and resume any non-terminal state. `abandoned` is a neutral terminal state and does not remove earned evidence.

### 4.6 Learning event adapter

The world emits rich events. A narrow adapter decides which verified checkpoints also become current `OutcomeInput` records.

- `world.prediction_made` logs process evidence only.
- `world.sim_tested` logs process evidence only.
- `world.explanation_submitted` logs an artifact and awaits a verifier.
- `world.question_checked` may call `recordOutcomes()` with the canonical question fields.
- `world.transfer_verified` may call `recordOutcomes()` only when the transfer check is deterministic or validator-approved.
- `world.object_placed`, movement, time, and dialogue never call `recordOutcomes()`.

### 4.7 Local Skill Block runtime

`Skill Block` is a MindCraft runtime term. It does not mean a Codex skill, Claude skill, prompt, character, or autonomous agent. It is a small executable model with typed ports. A system is a versioned graph of these blocks.

Machine-readable v1 drafts live in `agent_work/scoping/world_contracts/`. They are the starting contract for runtime validators, not a substitute for the cross-file semantic checks listed below.

The smallest useful blocks should feel like the world's atoms:

- constants and switches;
- add, subtract, multiply, divide, clamp, and map-range;
- compare, select, gate, pulse, and counter;
- delay, accumulator, integrator, and bounded reservoir;
- unit conversion;
- seeded random source and probability sampler;
- table lookup and piecewise curve;
- source, transform, state, and sink boundaries.

Domain blocks such as `solar_irradiance`, `ohms_law`, `heat_transfer`, or `plant_growth` may compose those atoms. They still declare assumptions, units, provenance, and validity limits. A reusable student-built system may itself become a block when it exposes a small typed boundary and pins all internal versions.

```ts
type SkillValueType =
  | 'boolean'
  | 'integer'
  | 'scalar'
  | 'vector2'
  | 'vector3'
  | 'enum'
  | 'pulse'

type SkillPort = {
  id: string
  label: string
  direction: 'input' | 'output'
  valueType: SkillValueType
  unit?: string
  min?: number
  max?: number
  step?: number
  default?: boolean | number | string | number[]
  required: boolean
}

type SkillBlockManifest = {
  blockId: string
  version: string
  title: string
  summary: string
  category: 'primitive' | 'model' | 'adapter' | 'system'
  execution: 'pure' | 'stateful'
  timing: 'event' | 'fixed-tick' | 'analytic-advance'
  runtime: {
    kind: 'mindcraft-ir-v1' | 'wasm-v1'
    artifactRef: string
    contentHash: string
  }
  ports: SkillPort[]
  dependencies: Array<{ blockId: string; version: string; contentHash: string }>
  constraints: {
    maxMemoryBytes: number
    maxStepMs: number
    network: false
    filesystem: false
    dom: false
  }
  provenance: ProvenanceRecord[]
  assumptions: string[]
  limitations: string[]
  license: string
  validationStatus: 'draft' | 'sandboxed' | 'verified' | 'public'
}

type SkillGraph = {
  graphId: string
  version: string
  blocks: Array<{
    instanceId: string
    blockId: string
    blockVersion: string
    contentHash: string
    initialState?: Record<string, unknown>
  }>
  edges: Array<{
    edgeId: string
    from: { instanceId: string; portId: string }
    to: { instanceId: string; portId: string }
  }>
  boundaryInputs: Record<string, { instanceId: string; portId: string }>
  boundaryOutputs: Record<string, { instanceId: string; portId: string }>
  seed: string
  tickMs: number
}
```

#### Runtime rules

1. Execute skill graphs in a dedicated Web Worker. Never run an admitted block on the React render thread.
2. Cache the interpreter, block artifacts, manifests, and current graph in the world's offline pack.
3. Use a stored simulation clock and seed. Kernels cannot read wall-clock time or create unseeded randomness.
4. Validate value type, unit, range, and finite numeric output at every graph boundary.
5. Pin block versions and content hashes. A library update cannot silently change an existing world, book, or blueprint.
6. Persist compact checkpoints and the input event log, not every simulation tick.
7. Run the same kernel headlessly for replay and verification. Never trust a value merely because a visual iframe posted it.
8. Give each step a CPU and memory budget. A failed block is isolated and reported as a broken component rather than freezing the world.

The existing `sim:ready`, `sim:input`, and `sim:output` protocol stays as the visual integration boundary. The build pipeline bundles a graph's same pinned Skill Block kernels into legacy standalone sim documents. The world runtime can execute those kernels headlessly in its worker. This preserves compatibility without allowing duplicate formulas to drift.

#### Python authoring policy

Python is a supported authoring and local verification language, but raw arbitrary Python is not the portable student runtime. The browser and iPad cannot depend on a resident Python process, and shipping a full Python runtime for a switch or multiplication block would waste memory and startup time.

Use this pipeline:

```text
restricted pure Python authoring SDK
              |
              v
validate AST, types, units, limits, and tests
              |
              v
compile to mindcraft-ir-v1 for simple kernels
or wasm-v1 for bounded complex kernels
              |
              v
run the same immutable artifact in browser, iPad, desktop, replay, and CI
```

The authoring subset forbids network access, filesystem access, process creation, dynamic imports, `eval`, wall-clock reads, and unseeded randomness. A local Python reference runner compares vectors against the shipped artifact before admission. Python remains pleasant for builders; Skill IR or WASM provides a small, deterministic common machine for students.

#### What "runs 24/7" means

While MindCraft is open, the worker advances fixed ticks continuously and checkpoints at bounded intervals. When iPadOS or a browser suspends the app, no architecture can honestly promise background CPU execution. Instead, each stateful block supports one of two deterministic resume modes:

- `analytic-advance`: calculate the state at `t + delta` directly;
- `bounded-replay`: replay fixed steps up to a declared cap, then preserve the remaining elapsed duration for later work.

On resume, the runtime reads the saved simulation clock, advances locally, and shows what changed while the student was away. This produces the experience of a living garden, data center, circuit, or economy without a cloud process burning tokens or a hidden server staying awake. Multiplayer shared worlds may optionally use a server authority while occupied, but single-player learning cannot depend on it.

#### Open block library

The source layout is canonical:

```text
library/skill-blocks/<namespace>/<block-id>/<version>/
  manifest.json
  kernel.py                 # optional readable reference source
  kernel.ir.json | kernel.wasm
  tests.json
  README.md
  provenance.json
  preview.webp              # optional

library/skill-block-index.json   # generated, never hand-edited
```

Every admitted block or reusable system automatically creates one row in the public Block Library. The row includes:

- name and one-sentence purpose;
- stable ID and version;
- input and output ports with units;
- offline availability;
- readable source and test links;
- provenance, assumptions, limitations, and license;
- verification status and content hash;
- creator attribution and remix lineage;
- examples of worlds and Living Books that use it.

The public view should be enjoyable for students, builders, and fans: searchable rows, a tiny live preview when one exists, a **See inside** action, and a **Remix** action. It must not hide scientific limits behind a polished visual.

The index is generated from manifests during CI. A pull request that adds or changes a block fails if schema validation, unit compatibility, deterministic vector tests, resource limits, offline smoke tests, provenance requirements, or index regeneration fail. Student-created blocks can run immediately in a private draft sandbox. They enter the shared catalog only after automated checks and the relevant content review.

## 5. Mission content model

Use three different records. Never merge them.

### 5.1 Mission definition

An immutable, versioned recipe created by content and systems design.

```ts
type MissionDefinition = {
  missionId: string
  version: number
  title: string
  regionId: string
  humanNeed: string
  targetConceptIds: string[]
  prerequisiteConceptIds: string[]
  supportedInterestTags: string[]
  representationOptions: string[]
  estimatedMinutes: number
  requiredCapabilities: string[]
  availablePrefabIds: string[]
  observations: ObservationSpec[]
  predictionPrompt: PromptSpec
  solutionClasses: SolutionClass[]
  testContracts: TestContract[]
  evidenceGates: EvidenceGate[]
  failureRevelations: FailureRevelation[]
  questionOpportunities: QuestionOpportunity[]
  consequenceVariants: ConsequenceSpec[]
  accessibility: AccessibilitySpec
  safetyClass: 'ordinary' | 'sensitive_real_world'
  provenance: ProvenanceRecord[]
  schemaVersion: 1
}
```

`solutionClasses` describe defensible approaches, not exact answers. A garden mission might allow shade management, irrigation timing, soil changes, or a mixed control system. `testContracts` judge observable behavior within tolerances.

### 5.2 Mission assignment

A frozen per-student plan produced by the deterministic planner.

```ts
type MissionAssignment = {
  assignmentId: string
  studentId: string
  missionId: string
  missionVersion: number
  targetConceptIds: string[]
  canonicalChainSnapshot: string[]
  readinessBand: 'equip' | 'coach' | 'transfer'
  chosenRepresentation: string
  scaffoldPolicy: {
    startingHintLevel: 0 | 1
    maxHintLevel: 1 | 2 | 3
    showPredictionFrame: boolean
    requireExplanation: boolean
    requireTransfer: boolean
  }
  learningPolicy: LearningPolicySnapshot
  parameterOverrides: Record<string, number | string | boolean>
  narrativeSkinId: string
  evidenceGateVersion: number
  plannerVersion: string
  reasons: PlannerReason[]
  assignedAt: string
  expiresAt?: string
}
```

This record makes personalization inspectable. Reopening a mission uses the same assignment instead of silently regenerating around the student.

### 5.3 Mission run

The student's evolving execution state.

```ts
type MissionRun = {
  runId: string
  assignmentId: string
  worldId: string
  ownerId: string
  state: MissionState
  stateRevision: number
  currentCheckpointId: string
  attemptCountByCheckpoint: Record<string, number>
  hintLevelByCheckpoint: Record<string, number>
  activeBlueprintId?: string
  latestSimulationHash?: string
  collaborators: Array<{ uid: string; role: 'student' | 'tutor' | 'peer' }>
  startedAt: string
  lastActiveAt: string
  resolvedAt?: string
}
```

The event stream is the audit truth. `MissionRun` is a materialized view for fast loading.

## 6. Typed event envelope

All durable mission and construction events use one envelope.

```ts
type WorldEvent<TType extends string, TPayload> = {
  eventId: string
  commandId: string
  worldId: string
  runId?: string
  actorId: string
  actorRole: 'student' | 'tutor' | 'peer' | 'system'
  type: TType
  payload: TPayload
  clientTime: string
  serverTime: string
  sequence: number
  worldRevision: number
  schemaVersion: 1
  source: 'web' | 'ios' | 'server'
}
```

Required properties:

- `eventId` and `commandId` are globally unique and make retries idempotent.
- `sequence` is allocated server-side per mission run.
- `worldRevision` supports optimistic concurrency.
- `actorId` is derived from the verified auth token, never trusted from request JSON.
- Events are append-only. Corrections are new events.

Core event families:

```text
mission.accepted
mission.checkpoint_entered
observation.recorded
prediction.committed
question.attempted
hint.requested
simulation.input_changed
simulation.test_completed
construction.entity_placed
construction.entity_moved
construction.wire_connected
construction.blueprint_saved
explanation.submitted
verification.completed
transfer.completed
artifact.published
mission.resolved
collaboration.joined
collaboration.control_handed_off
tutor.annotation_added
```

## 7. Deterministic mission personalization

### 7.1 Inputs

The planner may read:

- `/recommend.canonicalChain` and recommendations;
- concept, bridge, misconception, and format evidence;
- recent question outcomes and hint use;
- prior mission attempts and solution classes tried;
- explicit student interests, never inferred sensitive traits;
- current world capabilities and owned prefabs;
- session time available;
- accessibility settings;
- opt-in affective check-in;
- linked tutor focus concepts;
- mission inventory and content validation status.

The planner must not read chat transcripts as an unbounded personality profile.

### 7.2 Selection algorithm

1. Choose the first unresolved concept or bridge from the engine-owned `canonicalChain`.
2. Filter mission definitions that target it and whose hard prerequisites and capability requirements are satisfied.
3. Remove missions blocked by safety, age, accessibility, unavailable assets, or unvalidated content.
4. Score remaining definitions with versioned, visible weights.
5. Select a representation and scaffold policy from evidence bands.
6. Freeze a `MissionAssignment` with a human-readable reason list.
7. Request or retrieve a cached narrative skin only after the structural plan is frozen.

Suggested initial candidate score:

```text
0.30 target and bridge fit
0.18 prerequisite readiness
0.14 transfer need
0.12 representation need
0.10 student interest match
0.08 novelty and solution diversity
0.05 available time fit
0.03 tutor focus alignment
```

Hard filters always beat the score. Weights are configuration, versioned, and A/B testable. Interest match must not trap a student in one theme forever. Cap repeated interest skins and deliberately introduce adjacent worlds.

### 7.3 Readiness bands

| Band | Evidence state | Mission behavior |
|---|---|---|
| `equip` | Unknown, overloaded, or weak prerequisite | Smaller system, co-present representation, prediction frame, safe variables, early optional hint |
| `coach` | Developing application evidence | Full mission system, one-at-a-time graduated hints, meaningful constraints, required revision |
| `transfer` | Strong recent evidence | No forced recap, noisy data, changed context, fewer affordances, explanation and delayed transfer gate |

This is not a visible student label.

### 7.4 Story generation boundary

The story layer receives the frozen assignment and may return:

```ts
type NarrativeSkin = {
  skinId: string
  assignmentFingerprint: string
  openingBeat: string
  characterBeats: CharacterBeat[]
  objectLabels: Record<string, string>
  optionalHintLanguage: Record<string, string[]>
  failureReflections: Record<string, string>
  resolutionVariants: Record<string, string>
  continuityRefs: string[]
  model: string
  promptVersion: string
  validated: boolean
}
```

It cannot add concept IDs, change tests, change evidence gates, choose questions, or award capabilities. Validate and cache by assignment fingerprint. A deterministic authored skin is the fallback.

### 7.5 Universal learning policy

Every `MissionAssignment` freezes the learning policy used for that run. This makes instructional decisions replayable, reviewable, and separable from story prose.

```ts
type LearningPolicySnapshot = {
  policyVersion: string
  targetConceptIds: string[]
  priorKnowledgeBand: 'novice' | 'developing' | 'competent'
  supportMode: 'worked-example' | 'completion-example' | 'guided-build' | 'independent-build'
  fadePlan: Array<{
    afterEvidence: string
    remove: string[]
  }>
  retrievalPlan: Array<{
    conceptId: string
    dueAfterHours: number
    format: string
    lowStakes: true
  }>
  interleavingPlan: {
    enabled: boolean
    contrastConceptIds: string[]
    reason: string
  }
  predictionRequired: boolean
  correctnessBeforeExplanation: boolean
  explanationFormat: 'principle-choice' | 'mapping' | 'short-constructed' | 'teach-back'
  feedbackPolicy: {
    target: 'task' | 'strategy' | 'self-regulation'
    requiresStudentAction: true
    personPraiseAllowed: false
  }
  collaborationPolicy: {
    structureId?: string
    requireIndividualTransfer: true
    groupResultIsMasteryEvidence: false
  }
  choiceSetSize: number
  implementationIntentionPrompt?: string
  reasons: PlannerReason[]
}
```

The policy engine is deterministic and versioned. The LLM may express a prompt in the world voice after the decision is frozen. It cannot decide to remove struggle, reveal the answer, skip transfer, award mastery, or turn a collaborative result into individual evidence.

### 7.6 Findings that apply across the world

These behaviors are default requirements for every subject:

1. **Retrieve, do not merely revisit.** Returning students first attempt a small low-stakes recall or reconstruction before reopening notes.
2. **Space by predicted forgetting.** The review queue uses concept evidence, elapsed time, prior successful retrieval, and desired retention horizon. It does not use one fixed schedule for everyone.
3. **Elicit a prediction before a reveal.** Before a sim test, demonstration, or surprising event, the student commits to an observable prediction. The prediction is never graded as identity or ability.
4. **Make the learner generate.** Missions require a build, explanation, comparison, teach-back, structured drawing, or physical enactment. Watching Jesse perform the work is not completion.
5. **Give task and strategy feedback.** Avoid person verdicts, comparative praise, red-X shame, and claims that the student is naturally good or bad at a domain.
6. **Feedback must lead to action.** Every formative feedback event offers or requires a concrete revise, compare, retry, inspect, or explain action. Feedback with no possible uptake is removed.
7. **Use mastery framing.** Progress compares the student with their own prior model and evidence, never a public rank, streak, or peer leaderboard.
8. **Preserve autonomy without abandoning structure.** Offer meaningful choices among needs, representations, components, or solution strategies while keeping the concept and evidence contract fixed.
9. **Maintain an error-safe climate.** A failed test leaves evidence in the world, identifies the mismatch, and keeps the student's work recoverable. It does not erase the attempt or redirect immediately to an answer.
10. **Require individual transfer after collaboration.** Group construction may be rich process evidence. Only the student's own later explanation or transfer attempt can update their mastery.
11. **Calibrate confidence through consequence.** Confidence prompts are used only when the answer changes feedback, comparison, or next-step selection. A number collected for its own sake is noise.
12. **Treat AI-assisted success as assisted.** Store the help level, tutor control, AI contribution, and visible resources with every evidence candidate. Later unassisted performance is the stronger signal.

### 7.7 Conditional instructional policies

The digest repeatedly warns that useful difficulties can become harmful when applied without readiness checks. The policy engine therefore uses conditions, not universal defaults.

| Finding | Use when | Do not force when |
|---|---|---|
| Complete worked example | Prior knowledge is weak, working load is high, or the student explicitly requests a reset | The student already demonstrates competent independent performance |
| Completion example with faded steps | The learner succeeds with examples and is ready to take over | The prerequisite representation is still unstable |
| Productive failure before instruction | Older learner, conceptually rich problem, enough prerequisite knowledge, and a guaranteed comparison and consolidation step | Young learner, generic skill, severe overload, or no time for consolidation |
| Interleaving | The learner must discriminate confusable categories or strategies | Categories are not confusable or current evidence shows the mix is overwhelming |
| Self-explanation | Correctness or a canonical comparison is already visible | Before correctness when it may entrench a wrong rule |
| Gesture or physical enactment | Offered as an optional strategy and the learner finds it useful | Mandatory performance for a learner who does not benefit or cannot participate |
| Immediate feedback | A safety issue, misconception reinforcement, or blocked next action requires it | Used as a blanket rule regardless of task |
| Delayed feedback | Reflection or later retrieval benefits from delay and no harmful misconception will compound | Used to strand a learner who cannot proceed |
| Complete analogous worked example | A genuine impasse remains after graduated help | Never substitute the target answer; return to reconstruction and transfer afterward |
| Interest relevance prompt | Value is low or expectancy is weak and a real personal connection is available | As fake personalization or a permanent theme cage |

Topic-specific anxiety or overload may temporarily increase structure and restore a complete worked example. That support is gated on the present task and recent evidence, not stored as a fixed identity label. Readiness to fade it is based on demonstrated success.

### 7.8 The learning cycle inside a mission

The story loop and learning-science loop are the same runtime sequence:

```text
notice a specific gap or need
        |
choose a meaningful route
        |
retrieve prerequisite knowledge
        |
predict an observable result
        |
build, enact, or simulate
        |
test and reveal correctness or evidence
        |
compare strategy and explain
        |
take a concrete feedback action
        |
revise and test again
        |
perform an individual transfer
        |
schedule delayed retrieval
        |
publish the artifact and its evidence
```

The world may make this feel like restoring a garden, stabilizing a power grid, choreographing a performance, or investigating a historical claim. The event contract remains the same.

### 7.9 Books, sims, habits, and collaboration

- **Living Books:** the child must author claims, explanations, comparisons, and revisions. AI-generated prose is visibly attributed and cannot satisfy the child's explanation evidence gate.
- **Simulations:** require prediction before reveal, preserve a trace of tested settings, and prompt comparison between expected and observed behavior.
- **Analogies:** show source and target side by side and ask what relation maps to what. Surface resemblance alone is not accepted as transfer.
- **Structured drawing:** provide partial templates or comparison goals. Do not use an unbounded "draw anything that helps" prompt as the default scaffold.
- **Help seeking:** detect both answer-chasing and help avoidance. Jesse offers the smallest useful next hint and may proactively offer help after repeated unproductive actions, while preserving refusal and autonomy.
- **Habits:** let a student attach an implementation intention such as "after breakfast, inspect the greenhouse." Missing one day has no loss animation, broken streak, or punishment.
- **Collaboration:** assign complementary roles such as predictor, builder, tester, and explainer, rotate them, record contributions, and end with a short individual transfer.
- **Tutoring:** tutors receive the current goal, evidence, and last mismatch. They should ask inference questions and return control rather than recite the solution.
- **Progress:** report retention, independence, transfer, revisions, and creations. Raw study time and same-session completion are context, not achievement.

### 7.10 Research traceability

Each production policy reason should carry one of these stable codes and link to the full internal research chapter, not merely this digest. Product experiments may change thresholds. They may not silently change what outcome is being measured.

| Policy code | Digest chapters | Runtime consequence |
|---|---|---|
| `LS_RETRIEVAL_SPACING` | 29, 76, 77, 78 | Personalized low-stakes retrieval queue and delayed checks |
| `LS_INTERLEAVE_CONDITIONAL` | 39, 114 | Mix confusable concepts only when readiness permits |
| `LS_DIFFICULTY_READINESS` | 41, 114, 117 | Desirable difficulty is gated by prior evidence |
| `LS_EXAMPLE_FADE` | 26, 88, 100, 117 | Worked analogous examples for novices, completion examples next, independent work after success |
| `LS_PRODUCTIVE_FAILURE` | 94 | Use only with age, domain, readiness, comparison, and consolidation conditions |
| `LS_ASSISTANCE_CONTINGENT` | 89, 91, 92, 95, 104 | Smallest useful hint, proactive help for avoidance, no target answer |
| `LS_PREDICT_BEFORE_REVEAL` | 105, 107 | Commit an observable prediction before demonstration or test |
| `LS_GENERATIVE_LEARNING` | 40, 102, 106, 109 | Build, explain, teach, enact, or use a structured drawing |
| `LS_ANALOGY_MAPPING` | 108 | Compare source and target together with explicit relation mapping |
| `LS_FEEDBACK_ACTION` | 49, 50, 79, 111, 112 | Task or strategy feedback must lead to a learner action |
| `LS_MASTERY_MOTIVATION` | 37, 38, 44 | Meaningful choice, competence evidence, personal progress, no controlling completion reward |
| `LS_HABIT_CONTEXT` | 43 | Optional implementation intentions and no missed-day punishment |
| `LS_ERROR_CLIMATE` | 103 | Diagnose errors, preserve attempts, and make revision safe |
| `LS_COLLAB_INDIVIDUAL_EVIDENCE` | 113 | Structured roles plus individual transfer before mastery |
| `LS_AI_ASSISTANCE_RISK` | 51, 104 | Assisted practice is attributed and checked later without assistance |
| `LS_AFFECTIVE_LOAD` | 24, 47, 117 | Offer task-local structure and accessibility without fixed identity labels |

Before changing a major policy, the owner reads the cited chapter and its primary sources, records the policy version, names the expected delayed-learning outcome, and defines a rollback threshold. Engagement alone is not a valid success criterion.

## 8. Creativity architecture

Creativity requires degrees of freedom that matter to the system.

### 8.1 Give the student

- a human or ecological need;
- a small inventory of components with legible behavior;
- space to arrange and connect them;
- measurable outputs and constraints;
- the ability to test early;
- persistent versions;
- the right to keep an imperfect artifact;
- more than one defensible solution class;
- opportunities to explain intent and tradeoffs;
- remix and attribution controls when publishing.

### 8.2 Do not give the student

- a glowing sequence of exact placements;
- a recipe disguised as freedom;
- a single hidden configuration scored as creativity;
- arbitrary building with no relation to behavior;
- an LLM-generated final construction;
- a capability unlock for decorative completion;
- public publishing before provenance and safety checks.

### 8.3 Blueprint model

```ts
type BlueprintVersion = {
  blueprintId: string
  version: number
  creatorIds: string[]
  parentBlueprint?: { blueprintId: string; version: number }
  purpose: string
  entityGraph: SerializedEntityGraph
  simulationGraph: SerializedSimulationGraph
  assumptions: string[]
  testResults: TestResult[]
  evidenceRefs: string[]
  limitations: string[]
  license: 'private' | 'classroom' | 'remix_with_attribution'
  contentHash: string
  createdAt: string
}
```

The same blueprint can appear in the world, a Living Book, a tutor session, or a reader fork without copying unverifiable state.

## 9. Evidence and capability gates

Keep four graphs separate, linked by IDs:

- concept graph: what ideas depend on what;
- evidence graph: what the student demonstrated;
- capability graph: what the student may inspect, use, modify, and publish;
- creation graph: how an artifact was built, tested, revised, and attributed.

Do not collapse these into XP.

Example first Causal Shard gate:

```ts
const causalShardGate: EvidenceGate = {
  gateId: 'causal_shard_v1',
  allOf: [
    { kind: 'prediction', minCount: 1 },
    { kind: 'controlled_test', minCount: 2, distinctVariables: true },
    { kind: 'revision', minCount: 1 },
    { kind: 'explanation', relation: 'cause_effect', verifier: 'rubric_v1' },
  ],
  oneOf: [
    { kind: 'question', validatedBankItem: true },
    { kind: 'transfer', differentContext: true },
  ],
}
```

The verifier returns evidence, not praise:

```ts
type VerificationResult = {
  status: 'supported' | 'partly_supported' | 'not_yet_supported'
  observedClaims: string[]
  missingEvidence: string[]
  nextTestOptions: string[]
  rubricVersion: string
}
```

An LLM may phrase validated feedback. It does not decide the gate by itself when a deterministic test is available.

## 10. Persistence layout

Use Firestore for durable, low-frequency truth.

```text
worlds/{worldId}
  ownerId
  templateId
  templateVersion
  revision
  activeRegionId
  activeMissionRunId
  createdAt
  updatedAt

worlds/{worldId}/entities/{entityId}
worlds/{worldId}/events/{eventId}
worlds/{worldId}/blueprints/{blueprintId}
worlds/{worldId}/blueprints/{blueprintId}/versions/{versionId}
worlds/{worldId}/missionAssignments/{assignmentId}
worlds/{worldId}/missionRuns/{runId}
worlds/{worldId}/missionRuns/{runId}/events/{eventId}
worlds/{worldId}/artifacts/{artifactId}

users/{uid}/retrievalQueue/{scheduleId}
  conceptId
  dueAt
  desiredRetentionHorizon
  priorSuccessfulRetrievals
  lastEvidenceRef
  schedulerVersion

missionDefinitions/{missionId}/versions/{versionId}
narrativeSkins/{skinId}
worldTemplates/{templateId}/versions/{versionId}

liveSessions/{sessionId}
  contextType: 'world'
  worldId
  missionRunId
  studentId
  tutorId
  status
  scope
  createdAt
  lastActivityAt
  endedAt
```

Do not write the full world as one document. Entities and events have independent growth and contention patterns.

The frozen `LearningPolicySnapshot` lives inside its mission assignment. Retrieval queue updates are server-authored from verified outcomes and versioned scheduler logic. A client may complete an offline review, but its evidence remains pending until the server validates and records it.

## 11. Durable command service

Clients send commands to one authenticated endpoint instead of directly mutating important world state.

```http
POST /api/world-command
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{
  "commandId": "uuid",
  "worldId": "uid-or-generated-id",
  "expectedRevision": 42,
  "type": "construction.wire.connect",
  "payload": {
    "from": { "entityId": "sun-1", "portId": "light" },
    "to": { "entityId": "plant-1", "portId": "light" }
  },
  "schemaVersion": 1
}
```

The service:

1. verifies the Firebase token;
2. derives actor ID and role;
3. verifies world and session membership;
4. validates command schema and capability;
5. checks `expectedRevision`;
6. validates mission and simulation constraints;
7. commits event plus materialized state in a transaction;
8. returns the authoritative revision and event;
9. makes duplicate `commandId` retries idempotent;
10. emits learning evidence only through the dedicated adapter.

Conflict response:

```ts
type WorldCommandConflict = {
  ok: false
  reason: 'revision_conflict'
  authoritativeRevision: number
  eventsSinceExpectedRevision: WorldEvent<string, unknown>[]
}
```

The client rebases or asks the student to choose. It never silently overwrites another builder's work.

## 12. Multiplayer architecture

### 12.1 Two channels, two kinds of truth

**Firestore and command service:** durable entities, wires, mission transitions, blueprints, explanations, verified tests, audit.

**Firebase Realtime Database:** avatar transforms, pointer rays, selected tool, temporary object previews, control leases, sim display frames, heartbeat.

Do not send 10 Hz avatar movement to Firestore. Do not trust Realtime Database presence as durable evidence.

Suggested RTDB layout:

```text
worldSessionAcl/{sessionId}/{uid}
  role
  expiresAt

worldPresence/{sessionId}/{uid}
  x, y, z
  qx, qy, qz, qw
  animation
  activeTool
  lastSeen

worldLeases/{sessionId}/{resourceId}
  holderUid
  leaseType
  expiresAt
  nonce

worldEphemeral/{sessionId}/simFrames/{entityId}
  tick
  stateHash
  outputs
  authorityUid
```

RTDB security cannot query Firestore. The server mirrors a minimal expiring ACL into `worldSessionAcl` when a `liveSessions` world session starts. Rules authorize presence only when the caller has an unexpired ACL entry.

### 12.2 Presence protocol

- Send avatar transforms at 8 to 12 Hz only while moving.
- Quantize positions and rotations before sending.
- Interpolate remote avatars locally at render speed.
- Stop packets when stationary and send one final authoritative pose.
- Use `onDisconnect()` to remove presence.
- Expire stale rows server-side even when disconnect hooks fail.
- Keep rooms small in v1: one student, one tutor, and up to three explicitly invited peers.

### 12.3 Object control

- Hover and selection are local.
- Moving or wiring a shared object acquires a renewable 12-second lease.
- Everyone sees who has control.
- A tutor requests control or receives a handoff. Tutor status does not silently preempt the student.
- Durable commit still uses `world-command` and a revision check.
- Lease loss cancels the uncommitted preview and restores authoritative state.

### 12.4 Simulation authority

For a shared simulation:

1. The session elects one authority using a renewable lease.
2. All clients send input intents with actor attribution.
3. The authority runs the fixed-timestep simulation and publishes compact display frames.
4. Other clients interpolate frames and verify periodic state hashes.
5. Mission checkpoints commit a durable simulation snapshot through `world-command`.
6. If authority disappears, another client restarts from the last durable snapshot and deterministic seed.

The authority is a synchronization role, not a trust role. Capability and evidence checks remain server-side.

## 13. Tutor join flow

Reuse `liveSessions` rather than inventing a second relationship model.

1. Student chooses **Invite my tutor** from a mission object or Jesse.
2. Client creates `liveSessions` with `contextType: 'world'`, `worldId`, `missionRunId`, and a narrow scope.
3. Existing tutor subscription displays the active-session banner.
4. Tutor opens the same world at the saved camera focus and checkpoint.
5. Server mirrors student and linked tutor into the RTDB session ACL.
6. Student sees an arrival cue and the tutor's named avatar. Entry is never invisible.
7. Tutor starts in observe mode.
8. Student may hand over a simulation control, object lease, or shared pointer.
9. Tutor annotations are separate artifacts and never overwrite student work.
10. End session removes RTDB ACL and presence, then preserves the durable event summary.

Initial tutor capabilities:

```text
observe world and mission state
point at an entity or port
add a private or shared annotation
ask a question
offer one graduated hint
request control
demonstrate in a disposable branch
return control
open the existing shared scratchpad
launch the existing Google Meet room
```

Explicitly excluded:

```text
award mastery
award shards
change canonical mission target
delete student artifacts
publish as the student
enter a private world without an active invitation or scheduled session
```

Tutor demonstration uses a forked simulation or blueprint branch. The student must reproduce or explain relevant behavior in their own branch before it becomes student evidence.

## 14. Knowledge Box and Living Book bridge

A world object, simulation node, and book embed reference the same versioned artifact.

```ts
type KnowledgeBoxDefinition = {
  boxId: string
  version: number
  title: string
  conceptIds: string[]
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  compute: {
    kind: 'skill-graph'
    graphRef: string
    graphVersion: string
    contentHash: string
  }
  view?: {
    kind: 'iframe' | 'world-prefab' | 'native-panel'
    sourceRef: string
    contentHash: string
  }
  provenance: ProvenanceRecord[]
  limitations: string[]
  validationStatus: 'draft' | 'tested' | 'approved'
}
```

- Unlocking a box grants `use`, not automatically `modify` or `publish`.
- Opening internals is a capability gate tied to evidence.
- A Living Book may embed a pinned box version.
- A reader may run it and fork it, but cannot silently mutate the author's canonical version.
- Updating a box creates a version. Existing blueprints continue to resolve their pinned version.
- A box may run headlessly without a view. Its computation must not depend on pixels, DOM state, animation frames, or an active LLM session.
- A 3D prefab, standalone 2D sim, and Living Book embed may present the same `compute` artifact differently and must produce the same output vectors for the same state, seed, and inputs.

## 15. Safety, privacy, and moderation

- Student world ACL is private by default.
- Peer collaboration requires a classroom, explicit invite, or approved event session.
- No public proximity voice or open stranger chat.
- Keep social text in the existing chat and moderation surface instead of hiding a second chat channel inside WebGL.
- Tutor entry is logged, visible, and expires with the session.
- Presence rows contain display state only, not educational or affective profiles.
- Do not expose confidence, anxiety, or weakness labels above another player's avatar.
- A tutor receives a grain-sized mission brief, not the student's unrestricted history.
- Real-world health, infrastructure, economics, climate, or public-policy missions display provenance, assumptions, uncertainty, and limitations.
- Generated world assets are never executable parent-page code.
- All published artifacts store creator attribution and remix lineage.
- Safety review is mandatory before a student creation can affect a shared public region.

## 16. Offline and recovery behavior

- Cache the room shell, current region manifest, mission assignment, approved sim assets, pinned Skill Block artifacts, and latest world snapshot.
- Store uncommitted single-player commands in IndexedDB with their `commandId`.
- Store Skill Graph checkpoints, input events, simulation clock, seed, and content hashes in IndexedDB.
- Replay after reconnect in original order.
- When an app resumes after suspension, use `analytic-advance` or bounded deterministic replay. Do not pretend an iPad process ran while the operating system suspended it.
- A server revision conflict pauses only the conflicting artifact, not the whole world.
- Never record verified mastery while offline. Queue candidate evidence and submit it when validation is possible.
- Display local construction as saved-on-device until acknowledged by the server.
- If WebGL is unavailable, render an accessible 2D room map that exposes the same object actions and mission state.

## 17. Performance and art budgets

Target the ordinary iPad first, not the developer laptop.

### Initial room

- first interactive shell under 3 seconds on a warm 4G connection;
- initial compressed transfer under 8 MB;
- one room GLB under 4 MB compressed;
- texture transfer under 3 MB, using KTX2 or WebP;
- fewer than 120 visible draw calls after batching;
- fewer than 150,000 visible triangles;
- device pixel ratio capped at 1.5 on iPad and 1.25 on low-memory devices;
- one shadow-casting directional light;
- static lightmaps or vertex color for most room lighting;
- contact shadow or blob shadow for moving avatars;
- 30 fps p95 on the minimum supported iPad;
- no layout shift when panels open.

### Outdoor world

- region chunks loaded by proximity;
- repeated trees, stones, plots, and props use instancing;
- three LOD bands for buildings and foliage;
- colliders are simplified meshes, never render meshes;
- far regions use cards or low-poly silhouettes;
- dispose geometry, textures, iframe sims, audio nodes, and listeners on region exit;
- pause hidden sims and reduce network update rate in background tabs.

### Blender export rules

- meters and Y-up convention frozen across assets;
- origins placed at logical pivots, especially doors and drawers;
- interaction hit targets named separately from visible meshes;
- repeated materials consolidated before export;
- baked lightmap UVs do not overlap;
- animation clips use stable semantic names;
- collision meshes carry a `COLLIDER_` prefix;
- interactable anchors carry an `INTERACT_` prefix plus stable entity binding;
- no UI copy baked into textures;
- every asset has a source `.blend`, export settings, license record, and generated `.glb`.

## 18. Observability

Measure whether the world creates learning behavior, not whether it keeps a child trapped.

North-star event derivations:

- `retry_120s`: student returns to a failed mission checkpoint within 120 seconds;
- `challenge_accept`: student accepts a higher-constraint variant;
- `transfer_pass`: verified success in a changed context;
- `solo_transfer_pass`: transfer success without tutor, peer, or hint assistance.

Supporting product signals:

- prediction before first test;
- delayed retrieval attempted and passed;
- independent performance after assisted practice;
- confidence calibration before and after actionable feedback;
- number of meaningful revisions;
- distinct solution classes attempted;
- explanation evidence status;
- feedback noticed, understood, and acted on;
- scaffold level increased or faded in response to evidence;
- instrumental help use versus answer-chasing or help avoidance;
- student versus tutor action attribution;
- control handoff and handback;
- blueprint fork and remix with attribution;
- mission resume after leaving;
- technical fallback rate;
- sim desync and authority migration count;
- p50 and p95 frame time by device class;
- asset load failure and WebGL context loss.

Do not use XP, streaks, raw time, dialogue count, or blocks placed as evidence of learning.

## 19. First vertical slice

Ship one complete 15 to 25 minute loop before adding more regions.

### The Garden That Forgot Spring

**World:** The House at the Edge and one outdoor garden plot.

**Learning loop:**

1. Student wakes in the room and sees one plant behaving strangely.
2. Maya names the need but does not explain the system.
3. Student performs one brief prerequisite retrieval selected from the review policy.
4. Student inspects light, water, nutrient, and temperature evidence.
5. Student commits a prediction.
6. Student connects or adjusts Knowledge Boxes.
7. First plausible setup creates an informative surprise.
8. Correctness or observed evidence appears before the explanation prompt.
9. Student identifies which evidence changed their belief and takes one concrete revision action.
10. Student revises and reruns the model.
11. Student explains one supported causal relationship.
12. A bank item or changed-context individual transfer checks the relationship.
13. The physical plant changes and the house preserves the blueprint and evidence.
14. A delayed low-stakes retrieval is scheduled from the verified concept evidence.
15. The first capability is unlocked through the gate, not through dialogue completion.
16. The Knowledge Tree shows a new branch.
17. One Archive clue appears.

**Skill Graph:** The visible garden sim is powered by pinned local blocks such as `sun_angle`, `solar_irradiance`, `shade_attenuation`, `thermal_balance`, `water_reservoir`, and `plant_growth`. The same graph drives the 3D plant, the 2D sim, offline resume, replay, and verifier vectors. No formula is duplicated in scene code.

**Multiplayer seam:** At any point after the first failed test, the student can invite the linked tutor. The tutor sees the current hypothesis, variables changed, and test history. The tutor starts in observe mode and may point, annotate, ask, or request one control lease.

**Personalization seam:** The plant system stays structurally identical, but the assignment changes representation, variable count, noise, hint ceiling, explanation demand, and transfer test based on engine evidence.

## 20. Build order

Each slice ends in a playable, testable outcome.

### Slice 0: Contract freeze

- Freeze IDs, mission states, event envelope, sim ports, Skill Block manifest, prefab manifest, and Blender naming.
- Add shared TypeScript types with runtime validators.
- Add the generated `library/skill-block-index.json` check so new blocks cannot bypass the catalog.
- Do not add backend behavior yet.

### Slice 1: The room is real

- Load room GLB.
- Stable camera, lighting, hit targets, avatar, object focus.
- Desk, bookshelf, hearth, plant, door, Jesse, and mission board open real existing surfaces.
- Add 2D fallback and keyboard access.
- Local state only.

### Slice 2: One local mission loop

- Implement state machine for Garden.
- Add the worker-based Skill Block interpreter and the minimal primitive library.
- Build the Garden Skill Graph once and present it through the current Sim Studio port protocol and the 3D plant.
- Cache the graph, artifacts, clock, seed, checkpoints, and input events for offline use.
- Emit typed local events.
- Save and resume from IndexedDB.
- No personalization or multiplayer yet.

### Slice 3: Durable world commands

- Add `world-command` endpoint, Firestore layout, runtime validators, idempotency, and revision conflicts.
- Persist entities, mission run, event stream, blueprint, and latest snapshot.
- Add emulator rule tests.

### Slice 4: Engine-owned personalization

- Add deterministic mission planner consuming `/recommend`.
- Freeze assignment reasons, scaffold policy, and `LearningPolicySnapshot`.
- Add the evidence-driven review queue, support fading, prediction, feedback-action, and individual-transfer policies.
- Add authored narrative fallback, then cached story skin generation.
- A/B test only versioned weights.

### Slice 5: Tutor co-presence

- Extend `LiveSessionContextType` with `world`.
- Add world fields to `liveSessions` and tighten update rules.
- Configure Firebase Realtime Database and session ACL mirror.
- Add avatar presence, pointer, annotation, and object leases.
- Reuse Google Meet for voice.

### Slice 6: Shared simulation and building

- Add deterministic authority lease and state hashes.
- Add shared input intents and durable checkpoints.
- Add blueprint branch for tutor demonstration.

### Slice 7: Outdoor Commons

- Door transition and streamed region chunks.
- Garden plot, Workshop, Knowledge Tree, Build Valley edge.
- Prefab capability catalog and construction persistence.

### Slice 8: Living Book publication

- Publish mission explanation, evidence, blueprint, and pinned sim as one Living Book artifact.
- Add fork, attribution, and version history.

### Slice 9: Open Block Library

- Publish the generated block index as a searchable public catalog.
- Show one-line purpose, ports, units, source, tests, provenance, limits, license, creator, and verification status.
- Add **See inside** and **Remix** without allowing a remix to replace the pinned original.
- Admit student-created systems only through the sandbox, deterministic tests, resource checks, provenance review, and immutable version pipeline.

## 21. Tests required before a slice ships

### Unit

- mission transition table rejects illegal jumps;
- planner returns the same assignment for the same versioned inputs;
- LLM skin cannot alter structural fields;
- evidence gate ignores movement, time, collection, and dialogue;
- sim port unit validation and cycle rules;
- Python reference vectors and shipped Skill IR or WASM vectors match;
- the same Skill Graph gives the same outputs in headless, iframe, and 3D adapters;
- fixed seed and event log replay to the same checkpoint hash;
- suspension catch-up follows the declared analytic or bounded replay policy;
- a Skill Block cannot access network, filesystem, DOM, wall clock, or unseeded randomness;
- CI fails when a changed manifest makes the generated block index stale;
- event replay rebuilds the same materialized run;
- duplicate command ID is idempotent;
- revision conflict preserves both users' work;
- lease expiry and authority migration;
- blueprint content hash and version lineage.

### Firebase emulator

- student owns personal world;
- unrelated student cannot read it;
- linked tutor can read only during an authorized world session;
- tutor cannot alter owner, target concept, evidence gate, or mastery;
- parent access follows explicit policy;
- RTDB presence requires mirrored unexpired ACL;
- no client can write server sequence, revision, verifier, or unlock fields.

### Two-browser end to end

- student invites tutor and tutor banner appears;
- both avatars appear and stale presence disappears;
- student hands control to tutor and gets it back;
- simultaneous object edit produces one commit and one clear rebase;
- sim state remains synchronized through authority disconnect;
- tutor demonstration does not count as student evidence;
- student completes own transfer and receives the capability;
- reconnect resumes the same mission without duplication.

### Visual and performance

- screenshots and canvas-pixel checks at desktop, iPad landscape, iPad portrait, and phone;
- no blank canvas, clipped panels, illegible object labels, or overlapping controls;
- room framing leaves functional objects visible at first load;
- 30 fps p95 on target iPad;
- context loss recovery;
- reduced-motion mode;
- keyboard and screen-reader route to every functional object;
- 2D fallback completes the same mission states.

### Learning QA

- target concept came from engine output;
- question and solution remain frozen;
- no hint reveals the final answer;
- novice evidence selects an example or guided build and competent evidence fades it;
- productive failure and interleaving appear only when their readiness conditions hold;
- a prediction is committed before the sim or demonstration reveals the outcome;
- correctness or comparison appears before a self-explanation that could entrench a wrong rule;
- every formative feedback message offers a concrete learner action;
- AI-assisted and tutor-assisted success remains labeled as assisted;
- group success cannot update individual mastery;
- delayed low-stakes retrieval is scheduled after verified learning;
- at least two solution classes work;
- first failure is informative;
- major unlock meets its evidence gate;
- tutor contribution is attributed separately;
- transfer is different enough to count;
- feedback avoids person verdicts and red-X shame.

## 22. Explicit deferrals

Do not build these into the first vertical slice:

- open public servers;
- proximity voice;
- unrestricted peer messaging;
- procedural infinite terrain;
- live LLM calls for every character;
- LLM-selected curriculum;
- arbitrary student JavaScript in the parent page;
- automatic public publishing;
- blockchain ownership;
- cosmetic economies;
- leaderboards, streaks, or XP;
- more than one complete region;
- full physics replication;
- a custom video stack when Google Meet already exists.

## 23. Immediate handoff to the world builder

Claude should proceed in this order:

1. Keep the current visual world build isolated from `Learn`, Desk OS, and engine files until the scene contract is stable.
2. Read and implement against the schemas in `agent_work/scoping/world_contracts/`; propose schema changes before coupling scene code to them.
3. Name every interactable and collider in Blender with stable semantic anchors.
4. Implement a scene manifest that maps anchors to stable entity and action IDs.
5. Make the room first-load composition complete before adding outdoor terrain.
6. Make the door transition to one small Commons garden, not an empty infinite map.
7. Move Garden computation into one pinned local Skill Graph. Do not duplicate formulas in the scene, iframe, or verifier.
8. Keep the existing Sim Studio `postMessage` protocol as the presentation adapter for that graph.
9. Implement Garden as the first state-machine mission with local typed events and the frozen learning policy sequence.
10. Reuse Manjushree telemetry patterns for `logEvent` and `recordOutcomes`.
11. Add a visible **Invite my tutor** seam but keep it disabled until world session authorization is implemented.
12. Do not let the scene write mastery, unlocks, or mission completion directly.
13. Validate desktop and iPad framing after every scene export.
14. Hand engine work a frozen list of entity IDs, mission checkpoint IDs, event types, simulation ports, Skill Block IDs, and artifact hashes.

The first success condition is not "the room looks finished." It is:

> A student enters a place that feels like theirs, notices a real problem, forms a prediction, builds and tests more than one idea, revises from evidence, explains what changed, optionally brings in a tutor without losing ownership, and leaves the world visibly different because they understood something.
