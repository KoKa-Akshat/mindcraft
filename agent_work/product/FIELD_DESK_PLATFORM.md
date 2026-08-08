# Field Desk — cohesive platform vision

**Status:** product architecture (local Desk OS) · 2026-08-07  
**Audience:** Desk OS agents + Akshat  
**Does not deploy.** Extends `DESK_OS_AGENT_BRIEF.md`; does not replace the brick table.

---

## One sentence

MindCraft is the field journal of a student becoming good at something: capture school life as ivory pages on a dark desk, file them into binders, plan tonight, then open the chapter that closes the gap.

## Object language (locked)

| Surface | Student sees | Underneath |
|---|---|---|
| Dark desk | Deep Field | Chrome, pan, brand |
| Ivory page | Paper + stakes-red margin | Any artifact |
| Field mark | Ivory owl cameo | Home / presence |
| ‹ › | Resize | Agency without − + × |
| One lime stroke | Primary action | Never pill soup |
| Boop | Convert this page | Deterministic spine + LLM language |

## The live loop

1. **Record** opens a dated ivory page. Speech inks live (graphite partial → settled final).
2. **Stop** keeps the page on the desk (filed, not discarded).
3. **Boop** offers three honest outputs only: summary notes · dues/homework · mission (concept_id → ACT/story chapter).
4. Every Boop claim carries a **receipt** back to a transcript line or upload.

Local STT (Web Speech + demo) now; cloud STT later behind the same `Page { lines[] }` contract.

## How ACT book + binder + plan are one OS

- **Capture** (record / upload / ICS) → ivory pages  
- **File** → Binder by course / unit / date (charter Brick 2)  
- **Plan** → Tonight sheet (dues + weakness overlap)  
- **Learn** → ACT / story chapter is the deepest spread, not a side app  
- **Remember** → Map foldout (dark sheet in the journal)  
- **Ask** → Binder Q&A with receipts  

Join key everywhere: nullable ontology `concept_id` on filed artifacts (see `DESK_OS_INBOX.md`).

## Backend ladder

| Now (local) | Next (explicit go) |
|---|---|
| IndexedDB pages + transcripts | `webhook` STT + compose contracts |
| Web Speech / demo | `/desk-transcribe`, `/desk-compose` |
| Boop stubs (rules + templates) | Groq/LLM per AGENT_RULEBOOK |
| concept_id stamp | ml `/recommend` + chapter open |
| Upload + ICS only | Still no OAuth zoo |

## Build order (demo each)

1. **R1** Live transcript ivory page  
2. **R2** Boop → summary sheet with receipts  
3. **R3** Boop → dues into calendar / tonight  
4. **B2** Binder browse  
5. **P1** Tonight sheet  
6. **L1** Mission opens ACT chapter  
7. **A1** Ask binder  

## Refuse

Brand orb entry. OAuth center. Five AI toys per page. Chat-bubble transcripts. ACT as a separate universe.

## Immediate next

Implement **R1** in `agent_work/product/desk_os/`: Record spawns a resizable ivory `paper-sheet` that streams live lines; stop leaves it filed on the desk with a Boop affordance stub.
