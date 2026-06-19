# MindCraft

MindCraft is a math exam-prep platform built around grit and growth mindset. The thesis: learning gaps are not a sign of low ability — they are a map. MindCraft shows students exactly where their understanding broke down, bridges them to what they already know, and guides deliberate practice without shame or arbitrary timers.

Live links:

- App: https://mindcraft-93858.web.app
- Marketing site: https://mindcraft-marketing-site.web.app
- Vercel webhook API: https://mindcraft-webhook.vercel.app

---

## Architecture Overview

MindCraft is three services that talk through Firestore as the single source of truth.

```
Browser (React + Vite)
    │
    ├── Firebase Auth (Google + email)
    ├── Firestore (reads/writes directly from client)
    └── Vercel Webhook API (POST calls for AI work)
            │
            ├── Claude Haiku  — fast extraction, question gen
            ├── Claude Sonnet — session summaries, JARVIS agent
            ├── Groq Llama    — legacy typed-homework proxy (gemini.ts)
            └── Gemini Flash  — research agent only (not student-facing)

Python FastAPI (homework/)
    │
    ├── Claude Haiku — multimodal extraction, teaching cards, clues
    └── ML layer (ml/) — embeddings, PCA, ontology graph, mastery decay
```

---

## Backend: How Each Layer Works

### 1. Vercel Webhook API (`webhook/api/`)

Serverless TypeScript functions deployed on Vercel. Each file is one endpoint.

| File | Endpoint | What it does |
|------|----------|--------------|
| `generate-questions.ts` | `POST /api/generate-questions` | Generates 1–10 exam-format MCQs for a concept/level/exam-type. Uses LangChain + Groq (Llama 3.3 70B). Caches results in Firestore `question_cache` for 24 h. Includes SVG diagrams, 3-tier hints, and numeric-correctness repair. |
| `generate-summary.ts` | `POST /api/generate-summary` | Claude Sonnet 4 summarises a tutoring session from transcript or raw notes. Outputs title, topics covered, homework items, and a student progress note. |
| `jarvis.ts` | `POST /api/jarvis` | Agentic loop (max 6 turns) using Claude Sonnet 4 tool-use. Tools: explain_concept, get_student_profile, get_recommendations, get_session_history, navigate. Reads/writes conversation history from `conversations/{studentId}` (capped at 60 messages). |
| `gemini.ts` | `POST /api/gemini` | Proxy that forwards prompts to Groq (Llama 3.3 70B) — name is a legacy misnomer. CORS-locked to the Firebase app domain. |
| `fireflies.ts` | `POST /api/fireflies` | Webhook from Fireflies.ai. Matches recording to a session by meeting URL or time window; stores transcript on the session doc. |
| `cron-fireflies.ts` | `GET /api/cron-fireflies` | Fallback cron (every 15 min). Fetches the 10 most recent Fireflies transcripts and links any that weren't caught by the live webhook. |
| `calendly.ts` | `POST /api/calendly` | Webhook from Calendly. Creates session docs on booking, auto-invites Fireflies bot, marks stale sessions complete. |
| `concept-graph.ts` | `POST /api/concept-graph` | Builds a knowledge graph for a concept by analysing co-occurring topics across student sessions. Uses a math ontology as a domain prior. |
| `publish-summary.ts` | `POST /api/publish-summary` | Atomically publishes a tutor-approved summary to the student dashboard; updates `sessions` and `users/{uid}/lastSession`. |
| `research-agent.ts` | `GET /api/research-agent` | Runs a market research loop using Gemini 1.5 Flash + Google Custom Search. Not student-facing. Protected by `CRON_SECRET`. |
| `delete-session.ts` | `DELETE /api/delete-session` | Server-side session delete using Admin SDK. Only the session's tutor can delete. |
| `register-calendly.ts` | `POST /api/register-calendly` | OAuth flow for tutors to connect their Calendly account. Saves token + webhook subscription to Firestore. |

### 2. Python FastAPI Service (`homework/`)

Runs at a separate URL (typically `https://mindcraft-homework.fly.dev` or local). Handles the deep adaptive homework flow.

**Endpoints:**

- `POST /submit` — Full pipeline: load student → generate parallel solution paths via the orchestrator → run agents on each path → select the most visual path → render Manim animation → build teaching cards. Returns a `HomeworkSession` with step-by-step cards.
- `POST /submit-with-file` — Same as `/submit` but accepts an image or PDF first. Claude Haiku extracts the problem text via multimodal vision, then the pipeline runs.
- `POST /clue` — Returns a single Socratic nudge for the current step (max 2 per card). Claude Haiku generates a hint that points toward the approach without giving the answer.
- `POST /outcome` — Records `outcome` (0.0 / 0.5 / 1.0) and `clues_used` for a step, then updates the student's Bayesian mastery estimate in the knowledge graph.
- `GET /health` — Liveness check.

**How the orchestrator works:**

1. `orchestrate()` generates 3–5 parallel solution paths for the problem (e.g., algebraic, graphical, numeric).
2. `run_agents()` runs each path through a teaching agent that writes Socratic step-by-step cards in Claude Haiku.
3. `select_best_path()` picks the path with the clearest visual step.
4. `render_visual()` calls Manim to render a GIF for that step.
5. `build_cards()` assembles the final card sequence.

### 3. ML Layer (`ml/`)

Runs as a separate Python service. Currently powers the Knowledge Graph page in the student app.

- **Embeddings** — sentence-transformers encodes concept descriptions into vectors.
- **PCA projections** — reduces embedding dimensions for 2D graph layout.
- **Ontology graph** — a hand-curated prerequisite map (e.g., `linear_equations → quadratic_equations → functions`). Mastery on one node influences confidence estimates on dependent nodes.
- **Mastery decay** — time-weighted Bayesian update: mastery fades slowly if not reinforced; a correct answer raises it back.

> The ML layer runs and stores data but is not yet surfaced in the student MVP UI beyond the Knowledge Graph page.

---

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users/{uid}` | Auth profile, role (`student`/`tutor`/`admin`), Calendly token, next session |
| `sessions/{sessionId}` | Tutoring session: transcript, summary card, status, tutor/student IDs |
| `sessions/{sessionId}/messages` | In-session chat |
| `chats/{uid1_uid2}/messages` | Persistent tutor–student chat |
| `conversations/{studentId}` | JARVIS conversation history (capped at 60 messages) |
| `question_cache/{key}` | Generated MCQ sets, 24 h TTL, keyed by `conceptId_level_examType_count` |
| `transcripts/{id}` | Orphaned Fireflies transcripts awaiting session match |
| `researchBatches/{id}` | Market research output from the research agent |
| `agentState/researchAgent` | Cursor for cycling the research agent's query list |

---

## AI Providers

| Provider | Model | Where used |
|----------|-------|-----------|
| Anthropic | `claude-haiku-4-5-20251001` | Homework extraction, teaching agents, clues, question gen (MVP path) |
| Anthropic | `claude-sonnet-4-20250514` | Session summaries, JARVIS agent |
| Groq | `llama-3.3-70b-versatile` | Legacy typed-homework proxy, question gen (via LangChain) |
| Google | `gemini-1.5-flash` | Research agent only — not student-facing |

---

## Frontend (`app/`)

React 18 + TypeScript + Vite + Tailwind. Firebase Auth (Google + email). Deployed to Firebase Hosting (`hosting:app`).

**Student routes:**

| Route | What it is |
|-------|-----------|
| `/dashboard` | Hero page — links to Exam Help, Homework Help, Learning GPS |
| `/practice` | Levelled MCQ practice with exam-type awareness (ACT/SAT/IB/AP) |
| `/knowledge-graph` | Interactive prerequisite constellation — click a node to see mastery % and session snippets |
| `/organize-notes` | File upload → Claude summary card |
| `/sessions` | Student's tutoring session history |
| `/study-timer` | Pomodoro focus timer |
| `/chat/:partnerId` | Real-time tutor–student messaging |

**Tutor routes:** `/tutor`, `/tutor/session/:id` — session list, transcript view, summary editing.

---

## Landing Pages

Two separate HTML pages (no React):

- `index.html` → deployed to `hosting:marketing`
- `app/public/landing.html` → deployed to `hosting:app` at `/landing.html`

Both open with a full-screen cinematic intro deck (4 slides, black background) inspired by Angela Duckworth's research on grit — the philosophical foundation of MindCraft. The intro auto-advances every 5 s, supports keyboard navigation (←/→/Space/Esc), and fades out smoothly on "Enter MindCraft" or "Skip." The rest of the landing page (hero, how-it-works, pricing, FAQ) loads underneath.

---

## On Grit and Confidence

MindCraft's thesis is not that students need more practice. It's that they need the *right* practice delivered in a way that doesn't reinforce the story "I'm just not a math person."

The three design principles:

1. **Specificity builds stamina.** Motivation increases when the next step is visible and achievable. Showing `"You got 2/7 right · concept: quadratic factoring · this is 15% of SAT Math · start here"` is more effective than a score.

2. **Failure is information, not identity.** Every wrong answer maps to a broken prerequisite. The student sees the gap, not a red X. "Not yet" is a direction.

3. **Progress is a constellation, not a line.** Understanding is non-linear. A student who knows derivatives but struggles with algebra underneath it doesn't need calculus practice — they need the algebra gap repaired first. The Knowledge Graph makes this visible.

---

## Dev Setup

```bash
# Frontend
cd app && npm install && npm run dev

# Webhook (local Vercel dev)
cd webhook && vercel dev

# Python homework service
cd homework && pip install -r requirements.txt && uvicorn api.main:app --reload
```

Environment variables needed:

```env
# webhook/.env
ANTHROPIC_API_KEY=
GROQ_API_KEY=
FIREBASE_SERVICE_ACCOUNT=   # JSON stringified
GOOGLE_API_KEY=              # research agent only
GOOGLE_CSE_ID=               # research agent only
STRIPE_SECRET_KEY=           # coming soon

# app/.env
VITE_ENABLE_DYNAMIC_QGEN=false
```

## Deploy

```bash
# Build app first
cd app && npm run build

# Deploy both hosting targets
npx firebase-tools@13 deploy --only hosting:app,hosting:marketing
```
