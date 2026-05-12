# MindCraft

MindCraft is a math exam-prep web app for students preparing for ACT, SAT, IB Math, AP math, and general high-school math. The product goal is simple: find the exact gaps, show the student where to start, and guide them through practice, homework help, and tutoring without making them guess what to study.

Live links:

- App: https://mindcraft-93858.web.app
- Marketing site: https://mindcraft-marketing-site.web.app
- Vercel webhook API: https://mindcraft-webhook.vercel.app

## Current Safety State

Dynamic AI-generated practice questions are **disabled by default** in the frontend.

The app currently uses the reviewed static question bank for live practice. The Vercel question generator still exists, but the frontend only calls it when:

```env
VITE_ENABLE_DYNAMIC_QGEN=true
```

Keep that flag off in production until the past-paper pattern index and stronger answer validation are ready.

## Product Flows

### Dashboard

Student dashboard entry points:

- Exam Help
- Homework Help
- Learning GPS
- Session Notes
- Practice
- Community

Exam Help and Homework Help both route through `app/src/pages/Practice.tsx`, but they use different modes.

### Exam Help

Exam Help is the practice/gap-detection flow.

```text
Dashboard
-> Practice page
-> choose exam
-> confidence scan across exam concepts
-> gap analysis
-> recommended start point
-> practice session
-> saved process state
```

Main files:

- `app/src/pages/Practice.tsx`
- `app/src/lib/questionBank.ts`
- `app/src/lib/examCurricula.ts`
- `app/src/lib/bridgePractice.ts`
- `app/src/lib/conceptMap.ts`
- `app/src/lib/questionAgent.ts`

What happens:

1. Student picks an exam: `ACT`, `SAT`, `IB`, `AP`, or `General`.
2. `examCurricula.ts` provides that exam's concept list and prerequisite map.
3. The student marks each concept as confident, shaky, or hard.
4. `bridgePractice.ts` looks for bridges from strong concepts into weak concepts.
5. The app starts a practice session using `questionBank.ts`.
6. The full process is saved locally as `Process 1` so the student can resume later.

Saved process storage:

```text
localStorage key: mindcraft:exam-help:{uid}:process-1
```

Saved fields include exam, scanned concepts, confidence answers, current phase, current question list, question index, selected answer, hints, results, XP, and bridge metadata.

### Homework Help

Homework Help is the problem-solver/card flow.

```text
Dashboard
-> Practice page Problem Solver mode
-> type problem or upload image/PDF
-> guided card session
-> clues
-> outcome logging
```

Main frontend files:

- `app/src/pages/Practice.tsx`
- `app/src/components/HomeworkCards.tsx`
- `app/src/lib/geminiHomework.ts`
- `app/src/lib/geminiProxy.ts`

There are currently two homework paths:

1. Typed problem:
   - Uses `app/src/lib/geminiHomework.ts`.
   - Calls the Vercel proxy at `webhook/api/gemini.ts`.
   - Despite the file name, this proxy currently uses Groq/Llama by default.
   - Produces a 6-card Socratic tutoring session.

2. File upload:
   - Calls the Cloud Run/FastAPI homework backend.
   - Uses Claude for file extraction, orchestration, teaching agents, clues, and Manim/SVG visuals.

## Backend Overview

MindCraft has three backend layers:

```text
Firebase
Vercel serverless webhook API
Homework FastAPI service
ML graph service
```

### Firebase

Used for:

- Auth
- Firestore
- Hosting
- Storage rules

Important files:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `app/src/firebase.ts`

Hosting targets:

- `hosting:app` serves the React app from `app/dist`.
- Marketing site is served separately from the root static files.

Deploy app:

```bash
cd app
npm run build
cd ..
npx firebase-tools@13 deploy --only hosting:app
```

### Vercel Webhook API

Folder:

```text
webhook/
```

Important endpoints:

- `api/gemini.ts`
- `api/generate-questions.ts`
- `api/calendly.ts`
- `api/fireflies.ts`
- `api/generate-summary.ts`
- `api/publish-summary.ts`
- `api/research-agent.ts`

Deploy:

```bash
cd webhook
npx vercel --prod --yes
```

Required Vercel env vars depend on which endpoints are used:

```env
FIREBASE_SERVICE_ACCOUNT=
GROQ_API_KEY=
ANTHROPIC_API_KEY=
FIREFLIES_API_KEY=
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
CRON_SECRET=
```

### Practice Question Generator

Endpoint:

```text
POST https://mindcraft-webhook.vercel.app/api/generate-questions
```

Source:

```text
webhook/api/generate-questions.ts
```

Input shape:

```json
{
  "conceptId": "linear_equations",
  "level": 2,
  "examType": "IB",
  "count": 10,
  "bridgeFrom": "functions_basics"
}
```

What it does:

1. Validates exam type and count.
2. Checks Firestore cache under `question_cache/{cacheKey}`.
3. If cache misses, calls Groq/Llama through LangChain.
4. Injects:
   - concept knowledge
   - level guidance
   - exam style
   - exam blueprint
   - exam curriculum notes
   - bridge context
   - future past-paper pattern context
5. Parses JSON output.
6. Validates shape.
7. Repairs simple numeric `correctIndex` mismatches when possible.
8. Rejects obvious bad content, such as SVG in question text or explanations saying the answer is not listed.
9. Writes successful generated questions to Firestore cache for 24 hours.

Important: this endpoint is **not production-trusted yet**. The live frontend does not use it unless `VITE_ENABLE_DYNAMIC_QGEN=true`.

### Homework FastAPI Backend

Folder:

```text
homework/
```

Main API:

```text
homework/api/main.py
```

Endpoints:

- `POST /submit`
- `POST /submit-with-file`
- `POST /clue`
- `POST /outcome`
- `GET /health`

Full upload flow:

```text
image/PDF upload
-> Claude extracts problem text
-> orchestrator creates 2-4 solution paths
-> Claude agents generate teaching narratives for each path
-> path scorer selects the best student-aware path
-> Manim visual generated if useful
-> card sequence returned to frontend
-> outcomes update student knowledge graph
```

Important files:

- `homework/api/main.py`
- `homework/orchestrator/orchestrator.py`
- `homework/agents/agent_runner.py`
- `homework/agents/knowledge_checker.py`
- `homework/cards/card_builder.py`
- `homework/students/student_loader.py`
- `homework/visuals/manim_runner.py`
- `homework/visuals/manim_generator.py`
- `homework/utils/claude_client.py`

Model:

```text
Claude Haiku 4.5 via ANTHROPIC_API_KEY
```

Student knowledge graph storage:

```text
Firestore collection: homework_profiles
```

The homework service also bootstraps from:

```text
Firestore collection: knowledge_graphs
```

### ML Knowledge Graph Service

Folder:

```text
ml/
```

Main API:

```text
ml/serve.py
```

Used for:

- concept ontology
- ingredient ontology
- per-student mastery graph
- prerequisite paths
- recommendations
- concept embeddings/PCA

Important files:

- `ml/data/ontology_complete.json`
- `ml/data/ontology.json`
- `ml/data/ingredient_ontology.json`
- `ml/mindcraft_graph/engine/student_graph.py`
- `ml/mindcraft_graph/engine/edge_weights.py`
- `ml/mindcraft_graph/planning/pathfinder.py`
- `ml/mindcraft_graph/firestore_adapter.py`

The richer atomic ontology lives in:

```text
ml/data/ontology_complete.json
```

The frontend currently uses the lighter browser-side map in:

```text
app/src/lib/conceptMap.ts
```

## Exam Curricula and Concept Maps

Each exam now has its own frontend prerequisite map:

```text
app/src/lib/examCurricula.ts
```

This avoids treating ACT, SAT, IB AI SL, AP, and General math as the same concept graph.

Current live maps are intentionally limited to concepts with reviewed static fallback questions. The broader future curriculum map lives in:

```text
ml/data/exam_curricula.json
```

For the current IB student, the frontend IB map is tuned toward IB Math AI SL and excludes calculus.

## Past-Paper Intelligence Plan

The long-term generation pipeline should be:

```text
approved exam PDFs
-> parse questions
-> tag every question by concept
-> tag atomic skills
-> extract recurring patterns
-> store abstract pattern records
-> generate original questions grounded in those patterns
```

Docs and schema:

- `docs/past-paper-intelligence.md`
- `ml/data/past_paper_schema.json`
- `ml/data/exam_curricula.json`

Starter ingestion script:

```text
ml/scripts/ingest_past_papers.py
```

Run:

```bash
python3 ml/scripts/ingest_past_papers.py --exam IB_AI_SL
```

Input folder:

```text
ml/data/past_papers/
```

Output folder:

```text
ml/data/past_paper_index/
```

Important legal/product note: do not commit copyrighted exam PDFs. The pipeline is designed for PDFs the team/student/school is allowed to process. Store derived metadata and abstract patterns, not copied papers.

## Project Structure

```text
mindcraft-site/
├── app/                         React + TypeScript + Vite app
│   ├── src/
│   │   ├── components/          reusable UI components
│   │   ├── lib/                 question bank, maps, API clients
│   │   └── pages/               Dashboard, Practice, Book, etc.
│   ├── scripts/                 local generation/audit scripts
│   └── dist/                    built app for Firebase Hosting
├── webhook/                     Vercel serverless API
│   └── api/
├── homework/                    FastAPI homework-help backend
│   ├── api/
│   ├── agents/
│   ├── cards/
│   ├── orchestrator/
│   ├── students/
│   └── visuals/
├── ml/                          ontology, graph engine, recommendations
│   ├── data/
│   ├── mindcraft_graph/
│   └── scripts/
├── docs/                        architecture docs
├── functions/                   Firebase Functions
├── index.html                   marketing/static page
├── firebase.json
└── README.md
```

## Frontend Setup

```bash
cd app
npm install
npm run dev
npm run build
```

Local env:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ML_API_URL=
VITE_HOMEWORK_API_URL=
VITE_ENABLE_DYNAMIC_QGEN=false
```

## Useful Commands

```bash
# Frontend build
cd app && npm run build

# Practice audit
cd app && npm run audit:practice

# Webhook type check
cd webhook && npx tsc --noEmit --target ES2022 --lib ES2022 --skipLibCheck --moduleResolution node --module commonjs api/generate-questions.ts

# Past-paper ingestion help
python3 ml/scripts/ingest_past_papers.py --help

# Deploy app
npx firebase-tools@13 deploy --only hosting:app

# Deploy webhook
cd webhook && npx vercel --prod --yes
```

## Known Gaps

- Dynamic generated questions are not production-safe yet.
- The past-paper parser currently creates raw records only; concept tagging and pattern extraction are next.
- The static bank covers the live maps, but many future `PRACTICE_CONCEPTS` still need reviewed questions.
- Typed Homework Help currently uses the simpler Vercel/Groq card path, while file upload uses the richer FastAPI/Claude/Manim pipeline.
- Exam process saving is browser-local, not Firestore-synced across devices.

## Contributor Notes

Before turning generated questions back on:

1. Build the past-paper pattern index.
2. Add concept/atomic tag validation.
3. Add answer-key verification beyond numeric repair.
4. Add a human review/promotion queue.
5. Run remote smoke tests against `generate-questions`.

Keep production boring and correct. Students should never see unverified answer keys.
