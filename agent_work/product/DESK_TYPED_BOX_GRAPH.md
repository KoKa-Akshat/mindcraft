# The Desk typed box graph audit

**Status:** design and audit only, 2026-08-17. No runtime integration was
implemented in this pass. Assignment D remains untouched.

## Decision

Jesse is the only conversational agent and the only voice presented to the
student. Intel, Moodle, Binder, Email, and Gcal are specialist nodes in the
product architecture, but they are not five permanently active LLM chats.

Each box should own:

- its connector or local data source;
- its current connection and activity state;
- a revisioned cache and freshness policy;
- deterministic actions within its narrow scope;
- a small typed report that Jesse can request;
- an optional, bounded reasoning operation only when deterministic logic is
  insufficient.

This keeps the useful part of a multi-agent design, clear ownership and typed
handoffs, without paying for five open-ended histories or letting five voices
compete with Jesse.

## Current topology

| Node | Current source | Current representation sent toward Jesse | Main gap |
|---|---|---|---|
| Intel | Derived dashboard lines | `[String]` through `DeskBoxBus` or legacy `FieldDeskStore` | No provenance, revision, or stable fact identity |
| Moodle | `MoodleClient` assignments and grades | Free-form lines assembled on demand | No freshness or source revision |
| Binder | Firestore/Storage `BinderStore`; separate legacy `FieldDeskStore.items` | Dashboard sends titles only; Desk Ask reads legacy items | Two stores can produce different answers |
| Email | `GmailClient` plus `GmailDigestClient` and `GmailDigestStore` | Digest text or message subjects | Same inbox can be summarized and persisted repeatedly |
| Gcal | `GmailClient.week`; separate legacy calendar events | Free-form event lines | No revision/freshness and two possible sources |
| Jesse | `JesseCallSession` and Field Desk Ask UI | Full bus briefing to `/api/archive-rag`, or legacy context to `/api/desk-ask` | One product agent currently has two context pipelines |

Relevant implementation points:

- `Networking/DeskBoxBus.swift` correctly states that the bus is not a second
  LLM, but `briefing()` concatenates every nonempty report into one string.
- `Networking/JesseCallSession.swift` prepends that whole briefing to every
  non-local call to `ArchiveRagClient`.
- `Views/FieldDeskView.swift::submitDeskAsk()` instead builds a
  `DeskAskClient.DeskContext` from `FieldDeskStore` and sends it to
  `/api/desk-ask`.
- `BinderStore` is the canonical dashboard Binder, but the Desk Ask path and
  several older workflows still read `FieldDeskStore.items`.
- `GmailDigestClient` caches only the latest digest, without an input
  fingerprint. `GmailDigestStore` writes each generated digest as a new
  Firestore document.

## Audit findings

### 1. Unify context assembly before adding specialist reasoning

There is conceptually one Jesse, but the app currently has two assemblers and
two backend routes:

1. `JesseCallSession` -> `DeskBoxBus` -> `/api/archive-rag`
2. `FieldDeskView` -> `DeskAskClient.DeskContext` -> `/api/desk-ask`

The routes do different jobs and do not have to be collapsed immediately.
They should, however, consume the same typed, revisioned desk snapshot so
Jesse cannot report one Binder or calendar state in one surface and another
state elsewhere.

### 2. Stop sending every box on every remote turn

`DeskBoxBus.directAnswer(for:)` already proves that local intent routing is
useful. For anything it does not answer, the current path includes the full
free-form briefing even when the question concerns only one source. Replace
that with a deterministic router that selects zero, one, or a few reports.
The default remote context should be the student's question plus only the
relevant changed reports.

### 3. Add revisions, freshness, and provenance

Current strings cannot answer whether a fact is current, where it came from,
or whether the model has already seen it. Every box report needs a stable
source revision, generated timestamp, freshness state, and safe source
references. A connector refresh that yields identical content must preserve
the revision.

### 4. Preserve canonical Binder identity

Passing only Binder titles discards item IDs, type, source, and timestamps.
The future adapter should report compact references to canonical
`BinderStore` items. Legacy `FieldDeskStore.items` should be migrated or
adapted deliberately, not silently treated as a second canonical Binder.

### 5. Fingerprint Gmail digest inputs

Before invoking `/api/gmail-digest`, compute a stable fingerprint from the
normalized message identifiers or immutable preview fields. Reuse a cached
digest when the fingerprint matches. Persist at most one digest per student
and input revision unless the student explicitly requests a new version.

### 6. Measure calls without recording private content

The iOS paths do not currently expose a common call budget or token telemetry.
Record operation name, selected box IDs, input/output byte or token estimate,
latency, cache hit, provider/model, fallback use, and success. Never record
email text, calendar text, prompts, responses, OAuth tokens, or student AI
keys in telemetry.

### 7. Separate layout negotiation from knowledge exchange

`DeskBoxBus.requestSpace` is a useful deterministic UI coordination path.
Keep it separate from typed content reports and commands. A neighboring tile
can yield height without receiving another box's private content.

## Proposed contracts

The exact Swift names can follow local conventions, but the boundary should
look like this:

```swift
struct DeskBoxReport: Codable, Equatable {
    let box: DeskBoxID
    let sourceRevision: String
    let generatedAt: Date
    let freshness: Freshness
    let connection: ConnectionState
    let facts: [DeskFact]
    let actions: [DeskActionCapability]
    let warnings: [DeskWarning]
    let sourceRefs: [DeskSourceRef]
    let reasoningNeed: ReasoningNeed
}

struct DeskContextEnvelope: Codable {
    let schemaVersion: Int
    let snapshotRevision: String
    let reports: [DeskBoxReport]
}

struct DeskBoxCommand: Codable {
    let target: DeskBoxID
    let operation: String
    let arguments: [String: String]
    let expectedRevision: String?
}
```

Contract rules:

- `facts`, `warnings`, and `sourceRefs` have hard item and character caps.
- Source references expose IDs and labels safe for the student UI, not raw
  provider tokens or unrestricted file URLs.
- Reports are immutable for a source revision.
- Commands are allow-listed by the owning box. Jesse proposes; deterministic
  application code validates and executes.
- A stale `expectedRevision` rejects a write instead of applying it to newer
  data.
- Every optional model operation has a named schema, timeout, maximum calls,
  and deterministic fallback under `AGENT_RULEBOOK.md`.

## Typed graph

```text
Gmail OAuth/fetch ----> Email ----\
Google Calendar ------> Gcal ------\
Moodle API -----------> Moodle -----+--> selected DeskBoxReport(s) --> Jesse
BinderStore ----------> Binder -----/             |                    |
derived reports ------> Intel ------/              |                    v
                                                    +<-- commands -- validator
Jesse/flows ----------> BinderStore (durable student artifacts)

Desk layout request <-> neighboring tiles
  (UI geometry only; no student content)
```

The graph edges are typed data and commands, not prose conversations between
boxes. Intel may derive a report only from reports already fetched by the
other nodes. It should not acquire independent account permissions.

## Routing and token policy

For each student turn:

1. Normalize the request and run the local intent router.
2. Answer locally when a current report contains the requested fact.
3. Otherwise select only relevant reports and only revisions not already in
   the active Jesse context.
4. Invoke at most one specialist reasoning operation when a box explicitly
   reports that deterministic processing is insufficient.
5. Invoke Jesse once to synthesize the student-facing answer.
6. Validate proposed actions, update affected revisions, and cache the result.

Initial limits should be conservative and measured before tuning:

- no background LLM loop per box;
- no independent box conversation history;
- one Jesse synthesis call per student turn;
- zero specialist model calls by default, maximum one when justified;
- fixed report item/character limits and clipped source excerpts;
- revision and fingerprint caches before every model call;
- delta reports instead of repeating unchanged snapshots;
- deterministic fallback for every remote operation.

The target metrics are remote calls per student turn, estimated input/output
tokens, cache-hit rate, stale-answer rate, p50/p95 latency, fallback rate, and
answer correctness against cited source revisions. Token reduction is a
measurement goal, not an assumed percentage.

## Weft assessment

Borrow the graph concepts, not the runtime today. Weft's useful ideas are
typed edges, recursively scoped groups, explicit visibility, durable outputs,
and output-scoped subgraph execution. Those map well to connector-owned boxes
and compact reports. The project is still an early proof of concept with a
server-oriented Rust/Restate/Postgres stack and expected breaking changes;
adding it to the iOS runtime would increase operational surface before the
MindCraft contracts are stable. No official benchmark substantiating a
specific token-savings percentage was found.

Primary references:

- https://github.com/WeaveMindAI/weft
- https://github.com/WeaveMindAI/weft/blob/main/DESIGN.md
- https://github.com/WeaveMindAI/weft/blob/main/ROADMAP.md
- https://weavemind.ai/docs

Re-evaluate an integration only after the local contracts are stable and a
small replay benchmark shows that Weft provides better durability,
observability, or execution control than the app's own typed coordinator.

## Follow-up PR sequence

These are future, separately reviewed changes after Assignment C closes. They
are not authorization to start Assignment D or cross the Engine lane.

1. Add shared report/envelope types, deterministic adapters, and fixture
   tests without changing user-visible behavior.
2. Add connector revisions and freshness, plus Gmail input fingerprinting and
   digest deduplication.
3. Make both Jesse entry points consume one context assembler while preserving
   their current backend endpoints.
4. Add selective routing, delta context, call budgets, and private-safe
   telemetry behind a feature flag.
5. Add an optional specialist-reasoning registry only after replay evals show
   a deterministic gap. Start with one narrow operation, not all five boxes.
6. Consider a developer-only graph inspector after contracts settle. Do not
   expose internal agent plumbing as student-facing UI.

## Verification plan for those PRs

- Unit-test stable revisions, freshness transitions, clipping, redaction,
  delta selection, and stale-command rejection.
- Fixture-test each box adapter with empty, disconnected, loading, current,
  stale, and provider-error states.
- Replay mixed questions such as email-only, calendar-only, whole-page, and
  unrelated archive questions; assert which reports are selected.
- Assert no private content appears in telemetry or logs.
- Assert unchanged inbox inputs do not call the digest model or create another
  Firestore digest.
- Run simulator UI coverage for Settings and box states, then a physical-iPad
  OAuth and real-provider pass before release.

## Decisions Claude should make before implementation

1. Which context assembler becomes canonical while `/api/desk-ask` and
   `/api/archive-rag` remain distinct?
2. What is the migration plan from legacy `FieldDeskStore.items` to
   `BinderStore`?
3. What retention and deduplication policy applies to Firestore email digests?
4. Which single specialist operation, if any, earns the first optional model
   call based on an eval rather than product naming?
5. Should per-student Drive eventually hold durable summaries, and what can
   the student inspect and delete?

One adjacent security item deserves its own scoped review: `MoodleClient`
currently persists its site/token/user values in `UserDefaults`. This audit
does not modify that behavior, but a production hardening pass should assess
moving the Moodle credential to Keychain.
