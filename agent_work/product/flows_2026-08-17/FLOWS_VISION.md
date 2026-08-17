# FLOWS_VISION.md — "Build a Flow": the box-canvas inside Flows

**Status: reconciled plan, gate cleared.** Originally written 2026-08-17 as a
proposal gated behind Assignment C (PR #46). **PR #46 merged 2026-08-17T22:56:55Z
(`8e7ff78e`)** — the gate is clear. §14 (added after the merge) is the concrete,
code-grounded integration plan; §1-13 are the earlier product vision and mostly
still hold, with corrections noted inline where reading the real current code
changed something.

**Scope: Product lane** (`ios-prototype/**`, `agent_work/product/desk_os/**`).
No `ml/**`/`webhook/**`/`data/**` changes required.

**Origin:** reframes a product brief Akshat wrote (originally called "Design
Studio," drafted in conversation with Fable 5) against the actual state of the
repo. Two things changed its shape:

1. **It isn't a new concept.** `agent_work/product/future_school_vision_2026-08-17/NORTH_STAR_V2.md`
   (same-day, also unmerged) already specifies the target architecture: *"Jesse
   is the only conversational agent. Specialist boxes expose typed reports
   from their tools and caches... invoke a model only for real reasoning."*
   That is the exact box model the original brief described (Ask / Remember /
   Find / Make / Use / Wait / Decide / Human / Output). This document is the
   **authoring surface** for those boxes — the "how a student builds one" —
   not a competing architecture.
2. **The name collides, and "Flows" is further along than assumed.**
   NORTH_STAR_V2.md uses **"Studios"** for hosted physical locations —
   unrelated to this feature. And `DeskGridDashboardView.swift`'s `flowsRail`
   is not an empty stub — it's a working launcher menu of 6 pre-built
   workflows (Presentation, GDoc, Resume, Archive, Book, Apply). **This
   document specs a 7th row, "Build a Flow"** — the tool for making a *new*
   flow, not a takeover of the existing menu. See §14 for the exact wiring.

---

## 1. The core idea (unchanged from the original brief)

> **Flows — describe it, see it, connect it, run it.**

A student with zero coding knowledge opens Flows, says "after every lecture,
take my notes, figure out what I don't understand, make 10 questions, and
remind me before the next class," and watches boxes assemble on a canvas.
They can then touch, rearrange, and modify what Jesse built. That's the
pedagogical bet: **manipulating a visible thing Jesse made is more powerful
than a blank prompt box**, and more powerful than a blank code editor.

Non-negotiables carried over from the brief, because they're right:
- The student sees **things** (`When I upload notes → Understand them → Make
  practice → Show me what I missed`), never a technical pipeline
  (`Trigger → LLM → Function → JSON Parser → API`) unless they deliberately
  ask to see it (§9, Look Inside).
- The AI prompt bar is the center of gravity, not a sidebar chatbot. It
  understands canvas selection — click a box and say "make this harder,"
  select two and say "combine these."
- Zero blank-canvas cold start. First open shows a single prompt plus a
  handful of named starting points, not a settings screen.

## 2. Box vocabulary — maps onto what's already spec'd, don't reinvent it

| Brief's box type | NORTH_STAR_V2.md anchor | Notes |
|---|---|---|
| Ask | "invoke a model only for real reasoning" | The only box type that costs a model call by default |
| Remember | Binder / Proof Passport data model | Should write into the *same* student-owned record the rest of the Desk uses, not a parallel store |
| Find | Binder search, Field Library | |
| Make | existing "Make" surfaces (Create Studio / `CreateCanvasView.swift`) | Reuse the presentation/doc generation this app already ships, don't rebuild it inside Flows |
| Use | `Networking/` clients (`GmailClient`, `DriveClient`, Calendar) | These integrations exist and are real (not mocked) — Use-boxes are thin wrappers over them |
| Wait | new | |
| Decide | new (branch on a condition) | |
| Human | new — "ask a friend, tutor, or the student" | Ties to the mentor/near-peer layer in NORTH_STAR_V2.md, not a new social feature |
| Output | Proof Passport page, or a plain artifact | Every completed Flow should be able to produce something that *counts* as evidence, per the platform promise ("turn what you love into proof you can use") |

**Design rule:** every box type above that has an existing real implementation
(Make, Use, Remember, Find) must be a thin authoring wrapper around that
implementation, not a reimplementation.

## 3. Where this lives — resolved in §14.1

(Originally an open question: native SwiftUI vs. WKWebView + `desk_os`. §14.1
resolves it by reading the actual current code — every existing flow already
uses the WKWebView + `desk_os` pattern, so this isn't a fresh decision.)

## 4. The AI collaborator is Jesse — not a new agent identity

NORTH_STAR_V2.md is explicit: *"Jesse is the only conversational agent."*
`JESSE_CENTRAL_AI_PLAN.md` (read in full for §14) reinforces this further:
boxes are not independent sub-agents; there is one central Jesse, and boxes
are scoped connectors/tools it uses. The prompt bar ("Ask Jesse anything…")
already matches this. Do not introduce a second AI persona for Flows.

## 5. Model routing — "Auto" — see §14.3 for the corrected, grounded version

Original framing below is superseded by §14.3, written after reading
`StudentAIKeyStore.swift` (shipped in PR #46) and `JESSE_CENTRAL_AI_PLAN.md`.
Keeping the original text for context:

The brief's idea (a box asks for a *capability* — reason / extract / write /
classify / vision / fast-answer / long-context — and MindCraft picks the
model) extends `AGENT_RULEBOOK.md`'s existing pattern: every LLM call already
requires a typed input/output contract and a fallback, and provider switching
already exists via `LLM_PROVIDER` (engine side). **§14.3 corrects the scope**:
v1 has exactly one real call path per student (their saved Groq or Anthropic
key), not a multi-model marketplace — don't build UI that oversells that.

## 6. Context as a first-class object

- Layer 4 (`student_state_schema`, `representation_profile`) already models
  per-student evidence — the "what does this workflow currently know" pill
  should surface *that* record, not a new memory system.
- The Binder is already the source of truth for a student's own material.
- **The student can remove anything** (from the brief) is consistent with the
  existing security posture — a UI over existing ownership, not a new
  permission layer.

## 7. Token efficiency, as a real feature not a hidden optimization

Real anchors already in this codebase: `questionBank.ts`'s targeted retrieval
(Context Packs), Layer 4's durable extracted facts (Memory ≠ transcript
replay), `AGENT_RULEBOOK.md`'s typed-input-contract requirement (each box
declares what it needs), and existing caches (`.story_cache.json`,
`.explain_cache.json`, `evictQuestionCache`) for reused-work caching.

Expose it in the UI as **"Efficiency: Excellent"** per the brief, with a
drill-down to token counts for advanced users.

## 8. Zoom levels

"Desk view" = `DeskGridDashboardView` (already the parent screen Flows opens
from — zooming out just closes the builder back to it). "Inside a box" =
the right-panel inspector, following the same overlay interaction pattern
the rest of Field Desk already uses.

## 9. Look Inside — Simple / Logic / Code

Matches `CLAUDE.md`'s "Generative / deterministic split" almost exactly:
*"Deterministic engine owns structural decisions... LLM owns language...
LLM is bookends, deterministic is the spine."* Look Inside makes that split
visible: Simple = plain language, Logic = the deterministic INPUT/DO/RETURN
contract, Code = the actual implementation. No new abstraction — it's a
rendering of the contract every box already needs to run correctly.

## 10. Research directive — study prior art, don't mass-copy it

Same standard `NEXT_SESSION.md` already applies to McCreary's CC BY-NC-SA
work ("reimplementing *methods* is fine," bulk ingestion is not):

| Study for | Project | License note |
|---|---|---|
| Node/box canvas UX + rendering | React Flow / xyflow | MIT — safe to actually depend on |
| Workflow-builder interaction patterns (not code) | n8n, Node-RED, Flowise, LangFlow | n8n is Sustainable Use License — study UX only |
| Model-routing / fallback design | OpenRouter, LiteLLM, Portkey | Study the interface shape; MindCraft's real router is `StudentAIKeyStore` (§14.3) |
| Context compression / durable memory | MemGPT / Letta papers, Anthropic's prompt-caching docs | Papers/docs, not code — this is Layer 4's job |

Confirm any new dependency's license is commercial-safe (MIT/Apache/BSD) before adding it.

## 11. Safety — reuse the existing consequential-action pattern

PR #46 already establishes the pattern for gating a real external action
(BYO key: Test → Save → explicit use). Extend that same gate to any Use-box
action with an external side effect (send email, publish, share) rather than
building a separate permission system.

## 12. Phased build plan

| Phase | Scope | Depends on |
|---|---|---|
| **0 — Scaffold the real entry point** | §14.2's 3 native-side changes; empty canvas renders inside the new `FlowBuilderView` | PR #47 lands (§14.5) |
| **1 — Static boxes, no AI generation yet** | Manually place/connect Make/Use/Remember/Find boxes wrapping real features; Run executes a linear chain via the real bridge (§14.4), not simulation | Phase 0 |
| **2 — Natural-language box generation** | Jesse turns a typed request into a box graph | Phase 1 proves the box contract is right |
| **3 — Auto model routing + context packs** | Wire §14.3/§6/§7 in fully as `StudentAIKeyStore.Provider` grows | Phase 1 |
| **4 — Test/Run visualization polish, Look Inside, safety shield, templates, shareable recipes** | Polish pass | Phase 2 |

## 13. Open questions for a human before Phase 0

- Should "Output" boxes write into the Proof Passport data model directly, or
  is Proof Passport itself still too undefined (part of the *also
  unreconciled* Book Mission package) to build against yet?
- Is a Human-box (ask a mentor/tutor) in scope for the first shippable slice,
  given the near-peer/mentor layer in NORTH_STAR_V2.md is itself pre-launch?

## 14. Integration — grounded in the real app, written 2026-08-17 after PR #46 merged

A working, fully-interactive prototype of the canvas (drag/pan/zoom, connect,
Run animation, inspector with Look Inside, Auto model chip, Efficiency pill,
Context pill, scripted prompt-bar assembly) was built and demoed as an
Artifact. This section is about wiring *that* into the real app, not
redesigning it.

### 14.1 Where it lives — now a non-question

§3 asked native SwiftUI vs. `desk_os` WKWebView as an open decision. It isn't
one: **every existing flow (Resume/Archive/Book/Apply) already uses the
WKWebView + `desk_os` pattern**, and `FlowBuilderView.swift` should be a new
file that is structurally almost a copy of `ResumeAgentView.swift` (its
`Views/` file, lines 72-166), not a novel decision:

```swift
struct FlowBuilderView: View {
    var onClose: () -> Void
    @EnvironmentObject private var jesseCall: JesseCallSession
    // same WKWebView-over-desk_os + "Call Jesse" button shape as ResumeAgentView
}
```

Loads `https://mindcraft-93858.web.app/desk-os/workflows/flow-builder/?v=r1`.
Source lives at `agent_work/product/desk_os/workflows/flow-builder/` (new
sibling of `workflows/resume/`, `workflows/archive/`, `workflows/book/`) —
**never** edit the synced `app/public/desk-os/` copy directly (`CLAUDE.md`).
The already-built prototype HTML is the starting point for
`workflows/flow-builder/index.html` — split it into `index.html` +
`flow-builder.js` + reuse `workflows/workflows.css` where it overlaps,
matching how the other flows are structured, rather than shipping one giant
inline file.

### 14.2 The three real wiring changes

1. **`DeskGridDashboardView.swift`**, inside `flowsRail` (~938-943): add one
   row —
   `flowRow("Build a Flow", system: "square.grid.3x3.fill") { onOpenFlow("build") }`
2. **`FieldDeskView.swift`**: add `@State private var showFlowBuilder = false`
   (next to `showResumeAgent`/`showArchiveWorkflow`, line 90-91); add
   `case "build": showFlowBuilder = true` to the `onOpenFlow` switch
   (line 678-684); add a `.fullScreenCover(isPresented: $showFlowBuilder) {
   FlowBuilderView(onClose: { showFlowBuilder = false }) }` next to the
   existing Resume/Archive covers (~1178-1191).
3. **Nothing needed in `deskOverlayChromeBlocked`.** Checked directly: Resume/
   Archive/Book are `.fullScreenCover`-presented and are *not* in that list —
   the touch-swallowing bug class it guards against is specific to the manual
   `ZStack`-layered overlays (`showCreateCanvas` etc.), not native
   `fullScreenCover` presentation. Follow the Resume/Archive shape exactly and
   this bug class doesn't apply — don't add a guard that isn't needed.

That's the entire native-side surface change. Everything else is inside the
new WKWebView page.

### 14.3 "Seamless once you add a key" — the actual mechanism

This is already 90% built. `StudentAIKeyStore.swift` (shipped in PR #46) is
exactly the primitive: Keychain-only storage, `hasKey`/`provider` published
state, and a working `solveHomework(problemText:) async -> Result<String,
SolveError>` that already does the Groq/Anthropic call with a system prompt,
error states (`.noKey`, `.rejected`, `.unavailable`), and host-pinning. **The
"Auto" chip in the prototype should not invent a new key system — it reads
`StudentAIKeyStore.shared.hasKey`/`.provider` directly.** Concretely:

- **No key saved:** Ask/Make boxes show the prototype's "Provider unavailable"
  state; the model popover's "+ Add a model" row should deep-link to the exact
  place PR #46 already built (Work → Manage → gear → Settings → Homework
  help), not a second, competing key-entry form.
- **Key saved:** every Ask/Make box in a flow the student runs calls through
  that same key automatically — no separate "enable Flows" toggle, no
  per-flow setup. This is the literal mechanism behind "once anyone powers up
  their platform with an API key this feature starts working seamlessly."
- **One small, additive extension needed, not a new system:**
  `StudentAIKeyStore.solveHomework` is hardcoded to a homework-tutor system
  prompt. Flow boxes need arbitrary per-box goals (a "Make flashcards" box
  isn't "solve this problem"). Add a second method reusing all the existing
  plumbing:
  ```swift
  func ask(systemPrompt: String, userPrompt: String) async -> Result<String, SolveError>
  ```
  and have `solveHomework` call it with the existing tutor prompt, so nothing
  about the existing homework-help call site changes.

**Correction to §5's model-routing framing, after reading
`JESSE_CENTRAL_AI_PLAN.md`:** that document is explicit that boxes are
**not** independent agents each picking their own brain — *"Not 'each box is
its own sub-agent.' One central Jesse is the only agent a student talks to
for the foreseeable future... Flows may eventually get their own specialized
sub-agent... 'flows are spaces where two agents talk.' Don't build this
yet."* So v1's "Auto" is honestly simple: there is currently exactly one
underlying call path (`StudentAIKeyStore`, whichever of Groq/Anthropic the
student saved), not a marketplace of free models to route between. The
prototype's rich "Free: Gemma 3 / Llama 4 Scout / Phi-4 Mini / Qwen 3" list
is the *target UI shape* for once `StudentAIKeyStore.Provider` grows more
cases — **don't build fake multi-model selection UI that resolves to one
provider under the hood; ship the Auto chip showing what's real today
(Auto → the saved key's provider, or "no key yet") and grow the list as
`Provider` grows.** Overselling this in the UI reads as a lie the first time
a curious student opens the chip.

### 14.4 The WKWebView ↔ native bridge — exact shape, copied from `ResumeAgentView.swift`

Every existing flow uses `WKUserContentController.add(coordinator, name:
"desk<Flow>")` for JS→native, and `webView.evaluateJavaScript("window.__desk
<Flow>FromNative && window.__desk<Flow>FromNative({...})")` for native→JS.
Flow Builder follows the same shape, handler name `deskFlowBuilder`:

- JS → native, replacing the prototype's scripted `runBox()`:
  ```js
  window.webkit.messageHandlers.deskFlowBuilder.postMessage({
    type: "runBox", boxId, boxType, goal, inputs
  });
  ```
- Native (`FlowBuilderView.swift`'s `Coord.userContentController(_:didReceive:)`),
  same switch-on-`type` shape as `ResumeAgentView.Coord`:
  ```swift
  case "runBox":
      Task { @MainActor in
          let result = await StudentAIKeyStore.shared.ask(
              systemPrompt: promptFor(boxType: type, goal: goal),
              userPrompt: inputs
          )
          let js = "window.__deskFlowBuilderFromNative && window.__deskFlowBuilderFromNative({boxId:'\(boxId)', ...})"
          self.webView?.evaluateJavaScript(js, completionHandler: nil)
      }
  ```
- This is the only functional change the prototype's JS needs: swap
  `RUN_META`'s scripted `setTimeout` results for a `postMessage` + a
  `window.__deskFlowBuilderFromNative` receiver that resolves the same
  `runBox()` promise the canvas/animation code already awaits. **The canvas,
  drag, connect, inspector, and popover code do not change at all** — they
  were never simulation-specific, only the run results were.
- **Use/Find boxes** (Gmail, Calendar, Binder) don't need `StudentAIKeyStore`
  at all — they're a second `postMessage` type (`"useConnector"`) that calls
  the already-real `GmailClient`/`DriveClient`/`BinderStore` directly, same
  as any other screen in the app. No AI call involved; keep those boxes free.

### 14.5 Sequencing note

`FieldDeskView.swift` and `DeskGridDashboardView.swift` — the two files §14.2
touches — are exactly the files the still-open PR #47 (`cursor/box-grid-
redesign-2c98`, per `CURSOR_HANDOFF.md`) is mid-flight on. Start this after
#47 lands, not concurrently, or the two will merge-conflict on the same
handful of lines for no reason.
