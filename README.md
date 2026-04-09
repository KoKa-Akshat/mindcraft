# MindCraft

An online tutoring platform connecting students with tutors. Students book sessions via Calendly and land on a personalized dashboard showing their next session, last session summary, and upcoming schedule. Tutors get a sidebar-driven dashboard with per-student session history, real-time chat, Calendly integration, and an AI-powered workflow to generate and publish session summaries directly to their students.

Live app: **app-beta-one-59.vercel.app**

---

## Features

- **Firebase Auth** — Google OAuth + email/password, role-based routing on sign-in
- **Role-based routing** — students → `/dashboard`, tutors/admins → `/tutor`; role stored in Firestore
- **Student dashboard** — next session pill with live Join button, published session summary card, upcoming schedule
- **Tutor dashboard** — sidebar student navigation (auto-populated from bookings), sessions-to-review queue, upcoming sessions list, per-student session summary + live chat preview
- **Session detail page** (`/tutor/session/:id`) — Fireflies transcript viewer, tutor notes + file upload, AI-generated summary card with inline editing, publish to student
- **Real-time chat** — tutor/student P2P messaging via Firestore with file attachments (PDF, images, docs)
- **AI summary generation** — Claude Haiku reads Fireflies transcript + tutor notes, returns structured card (title, topics, homework, progress note, personal message)
- **Fireflies integration** — bot auto-joins every meeting via `addToLiveMeeting`; webhook delivers transcript to MindCraft after session ends
- **Calendly integration** — per-tutor webhook subscription registered via dashboard; creates session in Firestore, links student by email, invites Fireflies bot, auto-completes stale sessions
- **Join Session button** — activates 15 min before `scheduledAt`, pulses green when live
- **Public `/book` page** — tutor directory loaded from Firestore, opens Calendly booking popup
- **Admin panel** (`/admin`) — live sessions table with stats, manual booking form, status controls
- **Firestore + Storage rules** — session access scoped to `studentId`, `studentEmail`, `tutorId`, or admin; chat files scoped to chat participants

---

## Project Structure

```
mindcraft-site/
├── app/                              # React 18 + TypeScript + Vite frontend
│   └── src/
│       ├── App.tsx                   # Router, AuthGuard, RoleRedirect
│       ├── firebase.ts               # Firebase SDK init (Auth, Firestore, Storage)
│       ├── global.css                # CSS custom properties and base reset
│       ├── types/
│       │   └── index.ts              # Shared Firestore document types (Session, TutorStudent, ChatMessage)
│       ├── utils/
│       │   └── format.ts             # Date/time formatting helpers (fmtDateTime, timeUntil)
│       ├── hooks/
│       │   ├── useToast.ts           # Lightweight toast notification hook
│       │   └── useStudentData.ts     # Student doc sync, session linking by email
│       ├── pages/
│       │   ├── Login.tsx             # Auth page — email/password + Google, role enforcement
│       │   ├── Dashboard.tsx         # Student dashboard shell
│       │   ├── TutorDashboard.tsx    # Tutor view — sidebar students, sessions, chat, Calendly
│       │   ├── SessionDetail.tsx     # Per-session review — transcript, notes, AI summary, publish
│       │   ├── Admin.tsx             # Admin panel — live table, manual booking
│       │   ├── Book.tsx              # Public booking page with Calendly popup
│       │   └── Chat.tsx              # Real-time P2P chat with file upload
│       └── components/
│           ├── Navbar.tsx            # Top nav with logo and sign-out avatar
│           ├── Sidebar.tsx           # Left nav for student dashboard
│           ├── HeroBar.tsx           # Greeting, next session pill, Join/Book buttons
│           ├── LastSession.tsx       # Published session summary card
│           ├── PracticeReady.tsx     # Practice question count card
│           ├── ExploreClasses.tsx    # Class card grid
│           └── Messages.tsx          # Messages preview list
├── webhook/
│   ├── lib/
│   │   ├── firebase.ts               # Shared Firebase Admin SDK init (used by all handlers)
│   │   └── cors.ts                   # CORS header helper for browser-facing endpoints
│   └── api/
│       ├── calendly.ts               # invitee.created / invitee.canceled → session lifecycle
│       ├── fireflies.ts              # Transcript delivery → session matching → summaryStatus: pending
│       ├── generate-summary.ts       # Claude Haiku → structured summary card
│       ├── register-calendly.ts      # Tutor connects Calendly PAT → registers webhook subscription
│       ├── delete-session.ts         # Admin SDK delete (bypasses Firestore client rules)
│       ├── deploy-rules.ts           # Programmatic Firestore rules deployment via REST API
│       ├── debug-sessions.ts         # Internal: inspect sessions/users by ID or email
│       └── admin-fix.ts              # Internal: Calendly verification, tutor doc repair actions
├── firestore.rules                   # Firestore security rules
├── storage.rules                     # Firebase Storage security rules
└── firebase.json                     # Firebase project config
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project with Firestore, Authentication, and Storage enabled
- Vercel account (for the webhook server)
- Anthropic API key (Claude Haiku for summary generation)
- Fireflies.ai account with auto-record enabled

### Run the app locally

```bash
cd app
npm install
npm run dev
# → http://localhost:5173
```

### Deploy the webhook server

```bash
cd webhook
npm install
vercel deploy --prod
```

Set these environment variables in the Vercel webhook project:

| Variable | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON contents of your Firebase service account key |
| `FIREFLIES_API_KEY` | fireflies.ai → Settings → API → API Key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

### Connect Calendly (per tutor)

1. Tutor signs in at `/login`
2. On the tutor dashboard, find the **Calendly** card
3. Generate a Personal Access Token at calendly.com → Integrations → API & Webhooks
4. Paste the token → click **Connect Calendly**

This registers a webhook subscription for that tutor. All future bookings flow automatically.

### Configure Fireflies webhook

In fireflies.ai → Settings → Integrations → Webhook:
- URL: `https://mindcraft-webhook.vercel.app/api/fireflies`
- Event: Transcription Completed

### Deploy the frontend

```bash
cd app
npm run build
npx vercel --prod
```

---

## Architecture

### Booking → Session flow

```
Student visits /book
  └─ Tutor cards loaded from Firestore (role == 'tutor')
       └─ Student clicks "Book Free Session" → Calendly popup opens

Student picks time and confirms booking
  └─ Calendly fires webhook → POST /api/calendly

/api/calendly handler:
  ├─ Looks up tutor by organizer email (event_memberships[0].user_email)
  ├─ Deduplicates by calendlyEventUri (webhook can fire twice)
  ├─ Creates sessions/{id}:
  │    { studentEmail, studentName, studentId: null, tutorId, tutorName,
  │      subject, scheduledAt, endAt, duration, date, meetingUrl,
  │      calendlyEventUri, status: 'scheduled' }
  ├─ If student has an account: links studentId, updates nextSession on user doc
  ├─ Auto-completes any stale past sessions for the student and tutor
  └─ Invites Fireflies bot via addToLiveMeeting(meetingUrl)

Student signs in → useStudentData hook runs
  ├─ Finds upcoming session by studentEmail
  ├─ Backfills sessions/{id}.studentId if null (pre-signup booking)
  └─ Updates users/{uid}.nextSession

Student dashboard → HeroBar shows next session pill
  └─ Join button activates at scheduledAt − 15min, links to meetingUrl
```

### Transcript → Summary card flow

```
Session ends on Google Meet
  └─ Fireflies bot records and processes audio (~5–15 min after session)

Fireflies fires webhook → POST /api/fireflies
  ├─ Fetches full transcript via Fireflies GraphQL API
  ├─ Matches session by: firefliesMeetingId → meetingUrl → ±2hr time window
  ├─ Stores transcript on sessions/{id}.transcript
  ├─ Sets sessions/{id}.status = 'completed'
  └─ Sets sessions/{id}.summaryStatus = 'pending'
       (no match → stored in transcripts/{meetingId} as orphan for manual review)

Tutor dashboard → "Sessions to Review" shows sessions with status badges:
  - "Has transcript" (summaryStatus: pending)
  - "Draft" (summaryStatus: draft)
  - "Needs review" (no transcript yet)

Tutor clicks session → /tutor/session/:id

SessionDetail page:
  ├─ Tutor reads transcript, adds notes
  ├─ Optional: attach file → Firebase Storage (sessions/{id}/notes/)
  ├─ Tutor clicks "Generate Summary with AI"
  │    └─ POST /api/generate-summary
  │         ├─ Reads transcript + tutorNotes from Firestore
  │         ├─ Calls Claude Haiku with structured prompt
  │         ├─ Returns { title, topics, homework, progress, tutorNote }
  │         └─ Saves draft: sessions/{id}.summaryCard, summaryStatus = 'draft'
  ├─ Tutor edits summary card fields inline
  └─ Tutor clicks "Publish to Student"
       ├─ Sets sessions/{id}.summaryStatus = 'published'
       └─ Writes users/{studentId}.lastSession with summary card data

Student dashboard → LastSession card shows the published summary
```

### Data model

**`users/{uid}`**
```
uid, email, displayName, role ('student'|'tutor'|'admin'),
nextSession { subject, time, tutor, meetingUrl, scheduledAt },
lastSession  { id, subject, date, title, bullets[], tutorNote, progress },
calendlyToken, calendlyEmail, calendlyUrl, calendlyWebhookUri  (tutor only)
```

**`sessions/{id}`**
```
studentEmail, studentName, studentId, tutorId, tutorName,
subject, status ('scheduled'|'completed'|'cancelled'),
scheduledAt (ms), endAt (ms), duration, date, meetingUrl,
calendlyEventUri, createdAt,
summaryStatus ('pending'|'draft'|'published'),
summaryCard { title, topics[], homework[], progress, tutorNote },
tutorNotes, tutorNotesUrl,
transcript { meetingId, fullText, sentences[], summary, duration, processedAt },
firefliesMeetingUrl
```

**`chats/{chatId}/messages/{messageId}`**
```
chatId = [uid1, uid2].sort().join('_')
senderId, text, fileUrl, fileName, fileType, createdAt
```

**`transcripts/{meetingId}`** — orphaned Fireflies recordings with no matching session
