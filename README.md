                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq# MindCraft

**Math exam coming up? No worries, we got you.**

MindCraft finds what students actually don't understand, builds a clear personalized study path, and matches them with a tutor who helps fix gaps before the exam. Built for high-schoolers prepping for ACT, SAT, IB, and AP math.

**Live app:** https://mindcraft-93858.web.app  
**Marketing site:** https://mindcraft-marketing-site.web.app  
**Webhook server:** https://mindcraft-webhook.vercel.app

---

## Problem We Solve

Students fail math exams not because they're lazy — but because they don't know what they don't know. They study randomly, miss the exact concepts that appear on test day, and walk in overwhelmed.

MindCraft runs a four-step loop:
1. **Diagnostic** — finds current level and hidden gaps
2. **Learning Map** — connects gaps to the prerequisite concepts blocking progress
3. **Tutor Session** — dedicated tutor rebuilds understanding (not just the answer)
4. **Practice Loop** — personalized questions, flashcards, and next steps between sessions

---

## What's New (May 2026)

### AI-Powered Exam Intake (Practice Page)
- Students are now greeted with: *"Math exam coming up? No worries, we got you."*
- Select exam type (ACT / SAT / IB / AP / General) + optional topic or problem description
- Gemini 1.5 Flash analyzes input and returns 3–4 highest-yield concept recommendations with a personalized message
- Falls back to exam-specific defaults if no API key is configured

### Concept Explanation Cards (Explore Phase)
Before every practice session, students see a rich ACT-prep-style concept card with:
- Key rules, pro tips, watch-out mistakes, worked examples, exam weight
- Covers 16 concepts: linear equations, inequalities, absolute value, quadratic equations, factoring, systems, functions, function transformations, exponents, polynomials, rational expressions, word problems, percents/ratios, number properties, probability, descriptive stats

### Expanded Question Bank (155 questions)
Duolingo-style leveled practice across **15 concepts**:

| Concept | L1 | L2 | L3 |
|---|---|---|---|
| Linear Equations | 4 | 4 | 3 |
| Linear Inequalities | 4 | 3 | 3 |
| Absolute Value | 4 | 4 | 3 |
| Quadratic Equations | 4 | 4 | 3 |
| Functions | 4 | 4 | 3 |
| Systems of Equations | 3 | 3 | 3 |
| Exponent Rules | 4 | 4 | 3 |
| Polynomials | 4 | 3 | 3 |
| Rational Expressions | 3 | 3 | 3 |
| Function Transformations | 3 | 3 | 3 |
| Number Properties | 3 | 3 | 3 |
| Word Problems | 4 | 4 | 4 |
| Percents & Ratios | 4 | 4 | 4 |
| Descriptive Statistics | 3 | 3 | 3 |
| Probability | 4 | 4 | 3 |

Levels: **L1 Foundation** (+10 XP) · **L2 Applied** (+20 XP) · **L3 Exam Ready** (+35 XP)

### Question Generation Agent
- `app/scripts/generateQuestions.mjs` uses Gemini 1.5 Flash to draft 5 original questions for a concept and level
- Run from `app/`: `GEMINI_API_KEY=... npm run generate:questions -- linear_equations 2`
- Prints validated JSON matching the `Question` interface, ready to review and paste into `questionBank.ts`
- Prompt enforces original questions, exactly 4 choices, one correct answer, full explanations, and progressive 3-step hints
- `.github/workflows/question-agent.yml` runs every 30 minutes in GitHub Actions when `GEMINI_API_KEY` is saved as a repo secret
- The scheduled agent stores review batches in `app/content/generatedQuestions.json` with `status: "needs_review"` so AI questions do not go live before a human checks the math

### Visual Explanation Agent
- `app/scripts/generateManimScene.mjs` uses Gemini 1.5 Flash to draft Manim Community Edition scenes
- Manim is the Python animation library created by 3Blue1Brown for math visuals
- Run from `app/`: `GEMINI_API_KEY=... npm run generate:visual -- quadratic_equations "vertex form and axis of symmetry" > visual.py`
- Render locally with Manim: `manim -pql visual.py MindCraftVisual`
- The prompt blocks external files/network calls and asks for short, student-facing visual explanations

### Safe Research Agent
- `webhook/api/research-agent.ts` runs server-side on Vercel every 30 minutes
- Uses Google Programmable Search for public source discovery, including general web, Reddit, Quora, and forum-style queries
- Uses Gemini server-side to summarize patterns into pain points, exam signals, concept signals, student language, product ideas, and safety notes
- Stores structured summaries in Firestore `researchBatches`; raw forum pages, personal data, and long copied posts are not stored
- Requires server env vars: `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID`, `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`
- Optional but recommended: set `CRON_SECRET` so scheduled/manual calls require bearer-token authorization

### Marketing Site Overhaul
- Hero: *"Math exam coming up? No worries, we got you."*
- Subjects reordered to lead with exam-critical areas (Math Exam Prep, ACT/SAT, Algebra, Calculus, Homework Rescue, Vibecoding)
- How it works updated to 4-step loop: Diagnostic → Learning Map → Tutor Session → Practice Loop
- Copy throughout sharpened to address exam panic directly

### Homework Progress Card
- Shows tutor-assigned problems from Firestore `users/{uid}.homework`
- Progress bar + numbered checklist
- Click any problem → auto-submits to Practice page solver

### Dashboard Layout
- Constellation card full-width at top
- Below: Homework Help (60%) + HomeworkProgress + LearningGPS (40%) stacked

---

## Architecture

### Practice Flow

```
intake (exam selector + Gemini AI) 
  → mission (concept grid — AI picks highlighted at top)
  → explore (concept explanation card: rules, tips, examples)
  → level select (L1 / L2 / L3)
  → session (5 questions, hint ladder, XP)
  → complete (score, XP earned, next level CTA)
```

### Booking → Summary → Student

```
Student visits /book → picks tutor → Calendly popup

Calendly webhook → POST /api/calendly
  ├─ Creates sessions/{id} in Firestore
  ├─ Links studentId if account exists
  └─ Invites Fireflies bot to the meeting

Session ends → Fireflies webhook → POST /api/fireflies
  └─ Matches transcript to session, sets summaryStatus: 'pending'

Tutor opens SessionDetail
  ├─ Reviews transcript + adds notes
  ├─ "Generate Summary" → POST /api/generate-summary (Claude)
  └─ "Publish" → POST /api/publish-summary
       └─ Writes users/{studentId}.lastSession in Firestore

Student dashboard updates in real-time via Firestore onSnapshot
```

### ML Constellation Pipeline

```
Student completes practice session
  └─ Events logged: { conceptId, outcome, mastery }

ML API (VITE_ML_API_URL)
  └─ GET /knowledge-graph/{userId}
       └─ Returns { nodes: [{ id, x, y, mastery, status }], edges: [...] }

ConstellationCard   → mini SVG preview on dashboard
KnowledgeGraph page → full interactive version
LearningGPS         → cross-references live mastery → ranks prerequisite gaps
```

### Concept Ontology (conceptMap.ts)

50+ node prerequisite graph. Each concept maps to the ML IDs it directly requires. BFS from any target concept surfaces the full prerequisite chain, ranked by student mastery. Used by LearningGPS and the Gemini intake to generate personalized study paths. New ACT-critical nodes include word problems, percents/ratios, number properties, inequalities on graphs, function transformations, complex numbers, statistics graphs, and data interpretation.

---

## Project Structure

```
mindcraft-site/
├── app/                              # React 18 + TypeScript + Vite
│   └── src/
│       ├── App.tsx                   # Router, AuthGuard, role-based redirect
│       ├── firebase.ts
│       ├── global.css                # CSS variables + reset (dark teal theme)
│       ├── lib/
│       │   ├── conceptMap.ts         # 50+ node ontology + PREREQUISITES graph
│       │   ├── conceptContent.ts     # Rich concept cards (rules, tips, examples)
│       │   ├── questionBank.ts       # 155 curated MCQ questions × 15 concepts × 3 levels
│       │   ├── geminiIntake.ts       # Gemini 1.5 Flash — personalized concept recommendations
│       │   ├── mlApi.ts              # ML constellation API client
│       │   └── logEvent.ts           # Firestore analytics logger
│       ├── hooks/
│       │   ├── useStudentData.ts     # Real-time Firestore: user doc, sessions, homework
│       │   └── useToast.ts
│       ├── pages/
│       │   ├── Dashboard.tsx         # Constellation + Homework + GPS
│       │   ├── Practice.tsx          # Intake → Explore → Level → Session → Complete
│       │   ├── KnowledgeGraph.tsx    # Full interactive constellation
│       │   ├── StudentSessions.tsx   # All session notes
│       │   ├── StudyTimer.tsx        # Pomodoro / deep work modes
│       │   ├── TutorDashboard.tsx    # Tutor: students, sessions, publish
│       │   ├── SessionDetail.tsx     # Transcript + AI summary
│       │   ├── Login.tsx / Book.tsx / Admin.tsx / Chat.tsx
│       └── components/
│           ├── ConstellationCard.tsx # Mini constellation SVG
│           ├── LearningGPS.tsx       # Concept → prerequisite path ranked by mastery
│           ├── HomeworkProgress.tsx  # Tutor-assigned homework tracker
│           ├── HomeworkCards.tsx     # Hint card sequence (Problem Solver)
│           ├── Sidebar.tsx           # Left nav
│           └── HeroBar.tsx / LastSession.tsx / StudentIntelPanel.tsx
├── webhook/                          # Vercel Serverless Functions (Node + TypeScript)
│   └── api/                          # calendly, fireflies, generate-summary, publish-summary, ...
├── functions/                        # Firebase Cloud Functions
├── ml/                               # Offline: concept embeddings + PCA projection
│   └── data/
│       ├── concept_embeddings.npz
│       └── pca_axes.npz
├── index.html                        # Marketing site (Firebase Hosting target: marketing)
├── article.html / blog.html
├── firebase.json
├── firestore.rules / firestore.indexes.json / storage.rules
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | CSS Modules (zero UI libraries) |
| Routing | React Router v6 |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Authentication |
| Hosting | Firebase Hosting (multi-site) |
| AI — Intake | Google Gemini 1.5 Flash |
| AI — Summaries | Anthropic Claude (webhook server) |
| Webhooks | Vercel Serverless Functions |
| ML graph | Python + scikit-learn (offline) |
| Booking | Calendly API v2 |
| Transcription | Fireflies.ai |

---

## Getting Started

### Frontend

```bash
cd app
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → app/dist/
npm run generate:questions -- linear_equations 2
npm run generate:visual -- quadratic_equations "vertex form"
```

**`app/.env.local`**
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ML_API_URL=              # ML knowledge-graph API base URL
VITE_HOMEWORK_API_URL=        # Homework hint API (Cloud Run)
VITE_GEMINI_API_KEY=          # Gemini 1.5 Flash — powers the practice intake dialog
GEMINI_API_KEY=               # Local scripts only: question + Manim scene generation
```

Do not commit `.env.local` or API keys. If a key appears in a screenshot, chat, commit, or issue, rotate it in Google AI Studio before using it again.

### Deploy

```bash
# Build the app first
cd app && npm run build && cd ..

# Deploy both hosting targets
npx firebase-tools@13 deploy --only hosting
```

### Webhook server

```bash
cd webhook
npm install
vercel deploy --prod
```

**Vercel env vars:**
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
ANTHROPIC_API_KEY=sk-ant-...
FIREFLIES_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_ENGINE_ID=...
CRON_SECRET=...
```

---

## Firestore Data Model

**`users/{uid}`**
```
uid, email, displayName, role ('student' | 'tutor' | 'admin')
lastSession { id, subject, date, title, bullets[], tutorName, duration }
nextSession  { subject, time, tutor, meetingUrl }
homework     { assignments: [{ id, title, problems: [{ id, text, done }] }] }
calendlyToken, calendlyEmail, calendlyUrl   ← tutor only
```

**`researchBatches/{batchId}`**
```
id, createdAt, query, sourceKinds[], sourceCount
sources[] { title, url, host, kind, snippetPreview }
insights {
  painPoints[], examSignals[], conceptSignals[],
  studentLanguage[], productIdeas[], safetyNotes[]
}
```

**`sessions/{id}`**
```
studentEmail, studentId, tutorId, tutorName
subject, status, scheduledAt, endAt, meetingUrl
summary { title, bullets[], date, duration, published }
transcript { meetingId, fullText, sentences[], summary }
```

---

## Background Agent Prompt (for Codex / offline generation)

Paste this to any AI agent to keep expanding the system:

> You are working on MindCraft — an ACT/SAT/IB math exam prep platform. Stack: React 18 + TypeScript + Vite + Firebase + Gemini API. Mission: students panic before exams because they don't know what they're missing. MindCraft finds the gaps, builds a personalized learning path, and runs a practice loop. Current question bank: 102 questions across 10 concepts × 3 levels. Your job is to expand: (1) Add new concept nodes to conceptMap.ts with prerequisite edges. (2) Add 9–12 questions per new concept to questionBank.ts (4 L1, 4 L2, 3 L3) — real ACT/SAT/IB difficulty, original, with full explanation and 3-step hint ladder. (3) Add ConceptContent entries to conceptContent.ts (keyRules, tips, watchOut, examples). (4) Priority concepts to add: word_problems, percent_ratio, number_properties, function_transformations, statistics_graphs, data_interpretation, complex_numbers. Run `npm run build` from app/ to verify no TypeScript errors.

---

## Dev Utilities

```bash
# Type-check frontend
cd app && npx tsc --noEmit

# Type-check webhooks
cd webhook && npx tsc --noEmit

# Deploy Firestore rules only
npx firebase-tools@13 deploy --only firestore:rules

# Deploy everything
npx firebase-tools@13 deploy --only hosting
```
