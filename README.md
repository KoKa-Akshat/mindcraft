# MindCraft

AI-powered math tutoring platform. Students get a living knowledge graph (their "constellation") that tracks mastery across every concept they've studied. Tutors get a full workflow from Calendly booking → Fireflies transcript → Claude-generated session summary → one-click publish.

**Live app:** https://app-beta-one-59.vercel.app  
**Webhook server:** https://mindcraft-webhook.vercel.app  
**ML API:** configured via `VITE_ML_API_URL` in `app/.env.local`

---

## What's New (Apr 2026)

### Dashboard redesign
The student dashboard was restructured around what actually matters:

- **Constellation at the top** — the knowledge graph is the hero. Students see their full concept map immediately, color-coded by mastery (green = mastered, blue = in progress, red = needs work, gray = untouched). Click it to open the full interactive graph.
- **Last Session below** — quick recap of the most recent tutor session with bullets and a practice prompt.
- **Homework Help panel (right)** — vivid red-orange gradient card; drag/drop image or PDF, or type a problem; launches the multi-agent hint flow.
- **Learning GPS panel (right, below Homework Help)** — new feature, see below.
- Removed: "This Week" subject tiles, streak widget, practice session counter. These had no real data backing them.
- Removed: "Knowledge Graph" from sidebar nav — redundant since clicking the constellation opens it directly. Route still exists.

### Learning GPS
Students type any concept — "Logarithms", "Derivatives", "Conic Sections" — and the GPS maps every prerequisite they need to master it, ranked against their actual constellation mastery data.

**How it works:**
1. Fuzzy-resolves input against the 37-concept ML ontology (handles display names like "Log Properties", ML IDs like `logarithmic_functions`, partial matches)
2. BFS walks the prerequisite graph backwards from the target concept
3. Fetches the student's live constellation from the ML API
4. Ranks prerequisites by urgency: Needs Work → Not Started → In Progress → Mastered
5. Shows mastery bars and status labels per concept
6. "Focus on [X] →" drops directly into a practice session on the most urgent gap

Currently scoped to the 37 math concepts in the ML ontology. As the constellation grows, the GPS becomes more powerful automatically — just extend `PREREQUISITES` in `app/src/lib/conceptMap.ts`.

### Codebase cleanup
Deleted 9 dead component files that were never imported anywhere: `GlobalJarvis`, `Jarvis`, `HelpCards`, `ExploreClasses`, `MLInsightCard`, `Messages`, `Navbar`, `PracticeReady`, `Card.module.css`.

---

## Architecture

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
  ├─ "Generate Summary" → POST /api/generate-summary (Claude Haiku)
  └─ "Publish" → POST /api/publish-summary
       └─ Writes users/{studentId}.lastSession in Firestore

Student dashboard updates in real-time via Firestore onSnapshot
```

### ML Constellation pipeline

```
Student completes practice session
  └─ Events logged: { conceptId, outcome, mastery }

ML API (VITE_ML_API_URL)
  └─ GET /knowledge-graph/{userId}
       └─ Returns { nodes: [{ id, x, y, mastery, status }], edges: [{ from, to, weight }] }
          Positions via PCA on concept embeddings (ml/data/)

ConstellationCard   → mini SVG preview on dashboard
KnowledgeGraph page → full interactive version
LearningGPS         → cross-references live mastery → ranks prerequisite gaps
```

### Prerequisite graph (Learning GPS)

Defined in `app/src/lib/conceptMap.ts` → `PREREQUISITES`. Each ML concept ID maps to its direct prerequisites. BFS from target surfaces everything a student needs, ranked by current mastery.

To add new subjects: add IDs to `ML_TO_LABEL` and add prerequisite edges to `PREREQUISITES`. GPS picks them up automatically.

---

## Project Structure

```
mindcraft-site/
├── app/                          # React 18 + TypeScript + Vite
│   └── src/
│       ├── App.tsx               # Router, AuthGuard, role-based redirect
│       ├── firebase.ts
│       ├── global.css            # CSS variables + reset
│       ├── lib/
│       │   ├── conceptMap.ts     # ML ontology ↔ display names + PREREQUISITES graph
│       │   ├── mlApi.ts          # ML API client
│       │   └── logEvent.ts       # Firestore analytics logger
│       ├── hooks/
│       │   ├── useStudentData.ts # Real-time Firestore: user doc, sessions, chat
│       │   └── useToast.ts
│       ├── pages/
│       │   ├── Dashboard.tsx         # Constellation + LastSession + Homework Help + GPS
│       │   ├── KnowledgeGraph.tsx    # Full interactive constellation
│       │   ├── Practice.tsx          # Multi-agent homework hint flow
│       │   ├── StudentSessions.tsx   # All session notes, filterable
│       │   ├── StudyTimer.tsx        # Pomodoro, 52/17, Ultradian, Deep Work, Flowtime
│       │   ├── OrganizeNotes.tsx
│       │   ├── TutorDashboard.tsx    # Tutor: student list, sessions, chat
│       │   ├── SessionDetail.tsx     # Transcript + AI summary + publish
│       │   ├── Login.tsx
│       │   ├── Book.tsx              # Public tutor directory + Calendly embed
│       │   ├── Admin.tsx
│       │   └── Chat.tsx              # Real-time P2P chat
│       └── components/
│           ├── ConstellationCard.tsx # Mini constellation SVG (dashboard preview → /knowledge-graph)
│           ├── LearningGPS.tsx       # Concept input → prerequisite path ranked by mastery
│           ├── LastSession.tsx       # Last session summary card
│           ├── HeroBar.tsx           # Greeting + next session pill
│           ├── HomeworkCards.tsx     # Hint card sequence (Practice page)
│           ├── Sidebar.tsx           # Left nav
│           └── StudentIntelPanel.tsx # Student intel (tutor view)
├── webhook/                      # Vercel Serverless Functions (Node.js + TypeScript)
│   └── api/
│       ├── calendly.ts           # Booking → session creation + Fireflies invite
│       ├── fireflies.ts          # Transcript delivery → session matching
│       ├── generate-summary.ts   # Claude Haiku → structured summary
│       ├── publish-summary.ts    # Publish to student user doc
│       ├── register-calendly.ts  # Tutor Calendly PAT registration
│       ├── delete-session.ts     # Admin delete via Firebase Admin SDK
│       ├── deploy-rules.ts       # Programmatic Firestore/Storage rules deploy
│       ├── cron-fireflies.ts     # Cron: poll pending transcripts
│       ├── seed-sessions.ts      # Dev: seed dummy sessions
│       └── admin-fix.ts          # Internal data repair
├── ml/                           # Offline ML pipeline
│   └── data/
│       ├── concept_embeddings.npz  # Pre-computed concept vectors (37 concepts)
│       └── pca_axes.npz            # PCA projection for 2D layout
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
└── firebase.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | CSS Modules (zero UI libraries) |
| Routing | React Router v6 |
| Webhooks | Vercel Serverless Functions (Node.js) |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Authentication (Google + email/password) |
| File storage | Firebase Storage |
| AI | Anthropic Claude Haiku (summaries + homework hints) |
| ML graph | Python + scikit-learn (offline); served via separate REST API |
| Booking | Calendly API v2 |
| Transcription | Fireflies.ai |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project with Firestore, Auth, and Storage enabled
- Ask Akshat for `.env` files (or create from the variables below)

### Frontend

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
```

**`app/.env.local`**
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ML_API_URL=   # ML knowledge-graph API base URL
```

### Webhook server

```bash
cd webhook
npm install
vercel deploy --prod
```

**Vercel env vars for `mindcraft-webhook`:**
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}  # full JSON, one line
ANTHROPIC_API_KEY=sk-ant-...
FIREFLIES_API_KEY=...
```

### Firestore indexes

```bash
firebase deploy --only firestore:indexes
```

Required: `sessions` collection | `studentEmail ASC, scheduledAt DESC`.

---

## Firestore Data Model

**`users/{uid}`**
```
uid, email, displayName, role ('student' | 'tutor' | 'admin')
streak, practiceCount
lastSession { id, subject, date, title, bullets[], tutorName, duration, scheduledAt }
nextSession  { subject, time, tutor, meetingUrl, scheduledAt }
calendlyToken, calendlyEmail, calendlyUrl, calendlyWebhookUri  ← tutor only
```

**`sessions/{id}`**
```
studentEmail, studentId, tutorId, tutorName, studentName
subject, status ('scheduled' | 'completed' | 'cancelled')
scheduledAt (ms), endAt (ms), meetingUrl
summary { title, bullets[], date, duration, published: true }
summaryCard { title, topics[], homework[], progress, tutorNote }
tutorNotes, tutorNotesUrl
transcript { meetingId, fullText, sentences[], summary }
```

**`chats/{chatId}/messages/{messageId}`**
```
chatId = [uid1, uid2].sort().join('_')
senderId, text, fileUrl, fileName, fileType, createdAt
```

**`events/{autoId}`** — analytics
```
userId, type, data {}, page, ts
```

---

## Connecting Third-Party Services

**Calendly (per tutor):**
Tutor dashboard → Connect Calendly → paste Personal Access Token from calendly.com → Integrations → API & Webhooks.

**Fireflies:**
fireflies.ai → Settings → Integrations → Webhook:
- URL: `https://mindcraft-webhook.vercel.app/api/fireflies`
- Event: Transcription Completed

---

## Dev Utilities

```bash
# Seed test sessions (dev only)
curl -X POST https://mindcraft-webhook.vercel.app/api/seed-sessions \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","secret":"mindcraft-seed-2026"}'

# Type-check everything
cd app     && npx tsc --noEmit
cd webhook && npx tsc --noEmit

# Deploy Firestore rules
firebase deploy --only firestore:rules
```
