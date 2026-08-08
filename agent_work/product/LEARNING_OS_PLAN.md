# MindCraft Desk OS — Student Learning OS Plan

**Status:** exploration / prototype (P0 shipped as static HTML)

> **PIVOT 2026-08-07:** The integration-hub framing (Gmail / Notion / Drive OAuth) is dead per Akshat.
> The wedge is **DROP → FILE → PLAN → LEARN**: file uploads + AI filing into binders + one calendar
> paste. The authoritative charter is now `agent_work/product/DESK_OS_AGENT_BRIEF.md`. Keep the ICS
> calendar thinking below; treat the OAuth phases (P2/P3) as shelved reference only.
**Prototype:** `agent_work/product/learning_os_prototype/index.html` (open in a browser, sample data only)
**Author:** Fable 5 session, 2026-08-06
**Lane:** Product (`app/**` when it graduates; prototype lives in `agent_work/` so nothing ships)

---

## 1. The idea in one paragraph

Students juggle Moodle, Google Calendar, Apple Calendar, teacher emails, Drive docs, and paper notes. Nothing talks to anything, so the student is the integration layer. MindCraft Desk OS is the hub in the middle (the Hivework hub-and-spoke pattern, but for a student's life): it reads due dates, events, and files from the tools a student already uses, files everything automatically into per-course binders, indexes it, and uses AI to produce summary notes, diagrams, and a ranked "tonight" queue. **ACT Dash (the existing MindCraft app) becomes one module inside the OS** rather than the whole product. Daily homework habit feeds the same per-student knowledge graph that powers ACT prep, so the moat compounds: episodic test prep becomes a daily operating system.

## 2. Why this is strategically right for MindCraft

- ACT prep is episodic (junior year, spikes before test dates). Homework is daily. A daily surface multiplies sessions and data.
- The knowledge graph gets richer signal: homework topics, due-date stress, note content — all evidence for weakness detection the engine already models.
- Tutors get context for free: the binder and planner show exactly what the student is carrying this week.
- Parents get a defensible answer to "what does MindCraft do between tests?"

## 3. Modules (student-facing names)

| Module | What it does | Analog it replaces |
|---|---|---|
| **Today** | Timeline of classes, events, dues, and one practice mission | Paper planner |
| **Planner** | Homework board (backlog / tonight / done) with source chips | Moodle to-do + sticky notes |
| **Binder** | Auto-filed archive per course and unit, sequenced on a timeline, indexed and searchable | SharePoint-style folder chaos |
| **Notes** | AI summary notes, key-term glossaries, generated diagrams from lecture notes and docs | Rewriting notes by hand |
| **Desk Agent** | Ranks tonight's queue with reasons (deadlines, effort estimates, weaknesses) | Deciding what to do first |
| **ACT Dash** | The existing MindCraft app (weakness, chapters, Weekly Review, Map) as a module tile | — |
| **Connections** | Integration hub: connect/disconnect sources, see sync status | — |

## 4. Integrations — phased and realistic

**P0 — skeleton (done, the prototype):** static HTML, sample data, all interactions mocked. Zero accounts.

**P1 — read-only feeds (fastest real value, no OAuth):**
- Google Calendar: secret ICS URL per calendar (student pastes it once).
- Apple Calendar: published/subscribed calendar ICS.
- **Moodle: exposes a calendar export ICS out of the box** (Preferences → Calendar export). Assignments with due dates arrive as VEVENTs.
- ICS fetch needs a tiny proxy for CORS: add a `webhook/` function (`/api/desk-ics-proxy`) that fetches and caches feeds server-side.
- Manual add for anything else (teacher said it in class).

**P2 — OAuth reads:**
- Google Calendar API + Drive API (list/search docs, thumbnails).
- Notion API (read databases the student marks as school).
- Gmail read-only, label-scoped (`school/`), to catch teacher emails with attachments.

**P3 — write actions:**
- Create calendar events (study blocks from Desk Agent).
- Push AI summaries back to Notion/Drive as pages/docs.
- Moodle REST (where the school enables tokens) to mark activities complete.

**P4 — AI organization layer:**
- Ingestion pipeline: new file/event → classify (course, unit, kind) → file into Binder → index (embeddings, reuse the ml sentence-transformer stack pattern).
- Summarizer + diagrammer: LLM outputs constrained Mermaid/graph specs; deterministic renderer draws SVG (same "deterministic spine, LLM language" split as the engine; register contracts in `AGENT_RULEBOOK.md`).
- Sequencer: orders unit artifacts on a timeline (lecture → reading → problem set → quiz).
- Desk Agent planner: deterministic ranking (due date, estimate, exam weight, graph weakness) with LLM only phrasing the reasons.

## 5. Architecture sketch

- **Frontend:** new route group in `app/` (e.g. `/desk`) sharing auth, Firestore, and design tokens. Prototype is standalone HTML until the design settles.
- **Backend:** `webhook/` Vercel functions for ICS proxy, OAuth token exchange, Notion/Google API calls (server-authoritative, keys never in the browser).
- **Storage:** Firestore per student: `desk/{uid}/assignments`, `desk/{uid}/docs` (index metadata, not file bodies), `desk/{uid}/notes`, `desk/{uid}/plan`. Files stay in their home systems (Drive/Notion/Moodle); we store pointers + extracted text + summaries.
- **AI calls:** follow `AGENT_RULEBOOK.md` contract style — input/output schema, fallbacks, latency budget. Summaries cached by content hash (same pattern as the Eedi explain cache).

### Data model (first cut)

```
Assignment { id, courseId, title, source: moodle|gcal|apple|gmail|manual,
             due, estMinutes, status: todo|tonight|done, links[], graphConceptIds[] }
DocRef     { id, courseId, unit, kind: slides|lab|reading|scan|essay,
             source, sourceUrl, indexedAt, tags[], summaryId?, diagramId? }
Note       { id, courseId, title, body, summaryBullets[], diagramSpec?, createdAt }
PlanSlot   { date, rank, refType: assignment|mission|review, refId, reason }
Connection { provider, status, lastSyncAt, feedUrl? }
```

## 6. Design language

Desk aesthetic from the app: cream paper, forest ink `#143a2e`, leaf `#247a4d`, lime Click `#c4f547`, gold `#d3a900`, Deep Field `#080e14` for the ACT Dash chalk tile. Georgia display + system sans UI. Hub-and-spoke Connections section styled like the Hivework reference but in our palette. **No em dashes in student-facing copy.** Fun, Maya-voiced microcopy.

## 7. Risks / honesty

- Moodle REST tokens are school-admin gated; ICS export is the reliable universal path.
- Gmail scope is sensitive; keep it P2+, label-scoped, opt-in.
- File-body storage: keep pointers + extracted text only, or storage costs and privacy scope balloon.
- This is a second product surface; do not let it cannibalize ACT Dash focus before pilot feedback. P1 should be shippable by one person in ~2 weeks.

## 8. Build sequence for a NEW session (paste prompt)

```
New session: MindCraft Desk OS (student learning OS) — product lane, not resume work.

Read first: agent_work/product/LEARNING_OS_PLAN.md (the plan), then WORLD_VISION.md, BRAND_BOOK.md, FABLE5_VISION.md. Open the P0 prototype at agent_work/product/learning_os_prototype/index.html in a browser to see the target feel.

Goal for this session: implement P1.
1. webhook/ function: ICS proxy + parser (Google Calendar secret ICS, Apple published ICS, Moodle calendar export) → normalized Assignment/Event JSON.
2. app/ route /desk behind existing auth: Today timeline + Planner board fed by the parsed feeds + manual add, stored in Firestore desk/{uid}.
3. Keep ACT Dash untouched; link it as a module tile.
Rules: no em dashes in student copy, server-authoritative keys, do not touch ml/** or Manjushree WIP, coordinate before changing shared seam files.
```

## 9. What exists right now

- P0 prototype: `agent_work/product/learning_os_prototype/index.html` — Today, Planner, Notes with AI summary/diagram flip, Binder with auto-filed sequence, Desk Agent queue, ACT Dash chalk tile, Connections halo (Moodle, Google Calendar, Apple Calendar, Notion, Google Drive, Gmail, ACT Dash).
- This plan.
- Marketing landing brief (separate work): `agent_work/product/NEW_SESSION_MARKETING_LANDING_BRIEF.md`.
