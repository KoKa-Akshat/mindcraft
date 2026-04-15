# MindCraft

An AI-powered tutoring platform connecting students and tutors. Students get a personalized learning dashboard with session notes, a knowledge graph that maps how their concepts connect, an AI study assistant (JARVIS), and research-backed study timers. Tutors get a full workflow: Calendly booking → Fireflies transcripts → AI-generated session summaries → one-click publish to students.

**Live app:** https://app-beta-one-59.vercel.app  
**Webhook server:** https://mindcraft-webhook.vercel.app

---

## Screenshots

| Student Dashboard | Knowledge Graph |
|---|---|
| ![Dashboard](img/sitting.png) | ![Graph](img/calculus.png) |

---

## Features

### Student side
- **Personalized dashboard** — next session pill with live Join button, last published summary card, explore classes carousel, practice queue
- **Session Notes** (`/sessions`) — all published session summaries, accordion cards sorted by date, filter by subject, links to knowledge graph
- **Knowledge Graph** (`/knowledge-graph/:concept`) — per-student SVG concept graph built from session keywords + math ontology; nodes show mastery level; click any node for session details
- **JARVIS AI assistant** — animated teal orb; voice in (Web Speech API) + voice out (SpeechSynthesis); wake word activation ("Hey Jarvis"); navigates to any page on voice command; persists across all pages; "study logarithms" → opens knowledge graph for that concept
- **Study Techniques** (`/study-timer`) — 5 research-backed timers: Pomodoro, 52/17, Ultradian, Deep Work, Flowtime; SVG hourglass animation; customizable intervals

### Tutor side
- **Tutor dashboard** — sidebar student list, sessions-to-review queue, upcoming sessions, chat preview, Calendly connection
- **Session detail** (`/tutor/session/:id`) — Fireflies transcript viewer, tutor notes + file upload, AI-generated summary card (Claude Haiku), inline editing, publish to student
- **Real-time chat** — P2P messaging via Firestore with file attachments

### Platform
- **Firebase Auth** — Google OAuth + email/password, role-based routing (student → `/dashboard`, tutor → `/tutor`)
- **Calendly integration** — per-tutor webhook subscription; auto-creates sessions, links students, invites Fireflies bot
- **Fireflies integration** — bot auto-joins every session; transcript delivered via webhook after session ends
- **Event logging** — every JARVIS action, graph search, node click logged to Firestore `events` collection for analytics
- **Admin panel** (`/admin`) — live sessions table, manual booking form, status controls
- **Public booking page** (`/book`) — tutor directory, Calendly popup

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | CSS Modules (no UI library) |
| Routing | React Router v6 |
| Backend (webhooks) | Vercel Serverless Functions (Node.js) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| File storage | Firebase Storage |
| AI | Anthropic Claude (Haiku for summaries + JARVIS) |
| Booking | Calendly API v2 |
| Transcription | Fireflies.ai |
| Voice | Web Speech API (SpeechRecognition + SpeechSynthesis) |

---

## Project Structure

```
mindcraft-site/
├── app/                              # React 18 + TypeScript + Vite frontend
│   ├── src/
│   │   ├── App.tsx                   # Router, AuthGuard, RoleRedirect, GlobalJarvis
│   │   ├── firebase.ts               # Firebase SDK init (Auth, Firestore, Storage)
│   │   ├── global.css                # CSS variables + base reset
│   │   ├── lib/
│   │   │   └── logEvent.ts           # Firestore event logger (analytics)
│   │   ├── hooks/
│   │   │   ├── useStudentData.ts     # Student doc sync, session linking
│   │   │   └── useToast.ts           # Toast notifications
│   │   ├── utils/
│   │   │   └── format.ts             # Date/time helpers
│   │   ├── pages/
│   │   │   ├── Login.tsx             # Auth — email/password + Google
│   │   │   ├── Dashboard.tsx         # Student dashboard (HeroBar + JARVIS orb + grid)
│   │   │   ├── StudentSessions.tsx   # All session notes, accordion, subject filter
│   │   │   ├── KnowledgeGraph.tsx    # SVG concept graph with JARVIS search
│   │   │   ├── StudyTimer.tsx        # 5 study techniques + hourglass timer
│   │   │   ├── TutorDashboard.tsx    # Tutor view — students, sessions, chat, Calendly
│   │   │   ├── SessionDetail.tsx     # Per-session: transcript, AI summary, publish
│   │   │   ├── Admin.tsx             # Admin panel
│   │   │   ├── Book.tsx              # Public booking page
│   │   │   └── Chat.tsx              # Real-time P2P chat
│   │   └── components/
│   │       ├── Jarvis.tsx            # AI assistant orb (heroMode + fixed mode + wake word)
│   │       ├── GlobalJarvis.tsx      # Persistent bottom-right JARVIS (all non-dash pages)
│   │       ├── Navbar.tsx            # Top nav — logo → /dashboard, sign-out avatar
│   │       ├── Sidebar.tsx           # Left nav: Session Notes, Knowledge Graph, Study Timer
│   │       ├── HeroBar.tsx           # Greeting, next session pill, JARVIS hero orb
│   │       ├── LastSession.tsx       # Published summary card
│   │       ├── PracticeReady.tsx     # Practice question count
│   │       ├── ExploreClasses.tsx    # 4-card sliding carousel
│   │       └── Messages.tsx          # Chat preview
├── webhook/                          # Vercel Serverless Functions
│   ├── lib/
│   │   ├── firebase.ts               # Firebase Admin SDK init
│   │   └── cors.ts                   # CORS helper
│   └── api/
│       ├── jarvis.ts                 # JARVIS AI — Claude Haiku, 180 token replies
│       ├── concept-graph.ts          # Knowledge graph builder (ontology + session keywords)
│       ├── seed-sessions.ts          # Dev-only: seed 10 dummy sessions for testing
│       ├── calendly.ts               # invitee.created/canceled → session lifecycle
│       ├── fireflies.ts              # Transcript delivery → session matching
│       ├── generate-summary.ts       # Claude Haiku → structured summary card
│       ├── register-calendly.ts      # Tutor connects Calendly PAT → registers webhook
│       ├── publish-summary.ts        # Publish summary to student user doc
│       ├── delete-session.ts         # Admin SDK delete (bypasses Firestore rules)
│       ├── deploy-rules.ts           # Programmatic Firestore/Storage rules deploy
│       ├── cron-fireflies.ts         # Cron: fetch pending transcripts
│       └── admin-fix.ts              # Internal: data repair utilities
├── img/                              # Image assets
├── firestore.rules                   # Firestore security rules
├── firestore.indexes.json            # Composite index definitions
├── storage.rules                     # Firebase Storage security rules
└── firebase.json                     # Firebase project config
```

---

## Getting Started (for new contributors)

### 1. Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Vercel CLI** — `npm install -g vercel`
- A **Firebase project** with Firestore, Authentication, and Storage enabled (or ask Akshat for the `.env` files)

### 2. Clone the repo

```bash
git clone https://github.com/KoKa-Akshat/mindcraft.git
cd mindcraft
```

### 3. Set up the frontend (`app/`)

```bash
cd app
npm install
```

Create `app/.env.local` with the Firebase config (get these from the Firebase console → Project Settings → Your apps):

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

```bash
npm run dev
# App runs at http://localhost:5173
```

### 4. Set up the webhook server (`webhook/`)

```bash
cd webhook
npm install
```

Deploy to Vercel and set environment variables:

```bash
vercel deploy --prod
```

In the [Vercel dashboard](https://vercel.com) → `mindcraft-webhook` project → Settings → Environment Variables, add:

| Variable | Where to get it |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase console → Project Settings → Service accounts → Generate new private key → paste entire JSON as one line |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `FIREFLIES_API_KEY` | fireflies.ai → Settings → API → API Key |

### 5. Set up Firestore indexes

Run from the project root (requires Firebase CLI logged in):

```bash
firebase deploy --only firestore:indexes
```

Or create manually in Firebase console → Firestore → Indexes:
- Collection: `sessions` | Fields: `studentEmail ASC`, `scheduledAt DESC` | Query scope: Collection

---

## Common Commands

```bash
# Frontend dev server
cd app && npm run dev

# Frontend production build
cd app && npm run build

# Deploy frontend to Vercel
cd app && vercel --prod

# Deploy webhook to Vercel
cd webhook && vercel --prod

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Type-check everything
cd app && npx tsc --noEmit
cd webhook && npx tsc --noEmit

# Seed test sessions (dev only — run once per student account)
curl -X POST https://mindcraft-webhook.vercel.app/api/seed-sessions \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","secret":"mindcraft-seed-2026"}'
```

---

## Environment Variables Reference

### `app/.env.local`

All prefixed with `VITE_` so Vite exposes them to the browser bundle.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### `webhook/` (Vercel environment variables)

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
ANTHROPIC_API_KEY=sk-ant-...
FIREFLIES_API_KEY=...
```

---

## Architecture

### Booking → Session → Summary flow

```
Student visits /book
  └─ Tutor cards loaded from Firestore (role == 'tutor')
  └─ Student clicks "Book" → Calendly popup

Calendly fires webhook → POST /api/calendly
  ├─ Creates sessions/{id} in Firestore
  ├─ Links studentId if account exists
  └─ Invites Fireflies bot to meeting

Session ends → Fireflies webhook → POST /api/fireflies
  ├─ Matches transcript to session by meetingUrl / time window
  └─ Sets summaryStatus: 'pending'

Tutor clicks session → SessionDetail page
  ├─ Reads transcript, adds notes
  ├─ "Generate Summary" → POST /api/generate-summary
  │    └─ Claude Haiku → { title, topics, homework, progress, tutorNote }
  └─ "Publish to Student" → POST /api/publish-summary
       └─ Writes users/{studentId}.lastSession + sessions/{id}.summary.published = true

Student dashboard shows published summary card
Student /sessions page shows all published summaries
```

### JARVIS Knowledge Graph flow

```
Student says "study logarithms" (or types it)
  └─ JARVIS detects concept intent → navigates to /knowledge-graph/Logarithms

KnowledgeGraph page → POST /api/concept-graph { concept, studentEmail }
  ├─ Fetches all student sessions from Firestore
  ├─ Runs keyword detection (17 regex patterns) against session titles + bullets
  ├─ Builds adjacency from MATH_ONTOLOGY (20+ concept graph)
  ├─ Computes edge weights: session co-occurrence(0.75) | ontology(0.35) | both(1.0)
  ├─ Computes mastery: min(sessionCount / 3, 1.0) per concept
  └─ Returns { nodes, edges } for SVG radial layout

SVG graph renders:
  ├─ Center node = searched concept (radius 0)
  ├─ Ring 1 (165px) = direct connections (session + ontology neighbors)
  ├─ Ring 2 (308px) = second-degree connections (ontology only)
  └─ Click any node → session detail panel slides in from right
```

### JARVIS wake word flow

```
GlobalJarvis mounts on every authenticated page (except /dashboard)
  └─ Starts SpeechRecognition loop (continuous: false, restarts on end)
  └─ Listens for: "jarvis" | "hey jarvis" | "hi jarvis" | "okay jarvis"

Wake word detected:
  ├─ Opens JARVIS panel
  ├─ Immediately starts command listening
  └─ Logs jarvis_wake event to Firestore events collection

Command heard:
  ├─ "study [concept]" → navigates to /knowledge-graph/[concept]
  ├─ "dashboard" / "home" → navigates to /dashboard
  ├─ "book" / "schedule" → navigates to /book
  ├─ "timer" / "pomodoro" → navigates to /study-timer
  ├─ "knowledge graph" → navigates to /knowledge-graph
  └─ anything else → POST /api/jarvis (Claude Haiku, 180 tokens max)
```

---

## Firestore Data Model

**`users/{uid}`**
```
uid, email, displayName, role ('student'|'tutor'|'admin')
streak, practiceCount
nextSession { subject, time, tutor, meetingUrl, scheduledAt }
lastSession  { id, subject, date, title, bullets[], tutorName, duration }
calendlyToken, calendlyEmail, calendlyUrl, calendlyWebhookUri  (tutor only)
```

**`sessions/{id}`**
```
studentEmail, studentName, studentId, tutorId, tutorName
subject, status ('scheduled'|'completed'|'cancelled')
scheduledAt (ms), endAt (ms), duration, date, meetingUrl
summary { title, bullets[], date, duration, published: true }
summaryCard { title, topics[], homework[], progress, tutorNote }  (tutor draft)
tutorNotes, tutorNotesUrl
transcript { meetingId, fullText, sentences[], summary, processedAt }
```

**`chats/{chatId}/messages/{messageId}`**
```
chatId = [uid1, uid2].sort().join('_')
senderId, text, fileUrl, fileName, fileType, createdAt
```

**`events/{autoId}`** — analytics log
```
userId, type, data {}, page, ts
```
Types: `jarvis_wake`, `jarvis_navigate`, `graph_search`, `graph_node_click`

**`transcripts/{meetingId}`** — orphaned Fireflies recordings (no matching session)

---

## Firestore Security Rules

- `users/{uid}` — any authenticated user can read; only owner can write
- `sessions/{id}` — read/write scoped to `studentId`, `studentEmail`, `tutorId`, or admin role
- `chats/{chatId}` — read/write scoped to chat participants (UID in chatId)
- `events/` — write-only from client (no read rule — analytics backend only)

Full rules in [`firestore.rules`](./firestore.rules).

---

## Connecting Calendly (per tutor)

1. Tutor signs in → goes to `/tutor`
2. Find the **Calendly** card → click **Connect Calendly**
3. Generate a Personal Access Token at calendly.com → Integrations → API & Webhooks
4. Paste the token and click **Connect**

This registers a webhook so all future bookings auto-create sessions in Firestore.

---

## Connecting Fireflies

In fireflies.ai → Settings → Integrations → Webhook:
- **URL:** `https://mindcraft-webhook.vercel.app/api/fireflies`
- **Event:** Transcription Completed

Fireflies will auto-join all sessions where the Calendly invite includes a Google Meet link.
