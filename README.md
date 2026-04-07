# MindCraft

An online tutoring platform connecting students with tutors. Students book sessions via Calendly, land on a personalized dashboard showing their next session, last session summary, and practice queue. Tutors get their own dashboard with upcoming sessions, a review queue for completed sessions, and an AI-powered workflow to generate and publish session summaries directly to their students.

---

## Features

- **Firebase Auth** — email/password, Google OAuth, password reset
- **Role-based routing** — students → `/dashboard`, tutors/admins → `/tutor`; role stored in Firestore
- **Student dashboard** — next session pill with live Join button, last session summary card (published by tutor), practice count, messages, class exploration
- **Tutor dashboard** — upcoming sessions list, sessions-to-review queue with status badges, per-student summary dropdown
- **Session detail page** (`/tutor/session/:id`) — transcript viewer, tutor notes + file upload, AI-generated summary card, editable fields, publish to student
- **AI summary generation** — Claude (Haiku) reads Fireflies transcript + tutor notes, returns structured summary card (title, topics, homework, progress note, personal message)
- **Fireflies integration** — bot auto-joins every Google Meet; webhook fires when transcript is ready, sets `summaryStatus: 'pending'` on session doc
- **Calendly webhook** (Vercel serverless) — org-level subscription catches all bookings; creates session in Firestore, links student by email, updates `nextSession` on user doc
- **Pre-signup session linking** — student books before creating account; session auto-links on first login by email match
- **Join Session button** — activates 15 min before `scheduledAt`, pulses green when live
- **Public /book page** — loads tutors dynamically from Firestore, opens Calendly popup
- **Admin panel** — live sessions table, stats row, manual booking form, complete/cancel actions
- **Firestore rules** — sessions readable by `studentId`, `studentEmail` token (pre-signup), `tutorId`, or admin
- **Dev seed page** (`/seed`) — populates the logged-in account with fixture data

---

## Project Structure

```
mindcraft-site/
├── app/                            # React 18 + TypeScript + Vite frontend
│   └── src/
│       ├── App.tsx                 # Router, AuthGuard, RoleRedirect
│       ├── firebase.ts             # Firebase init (Auth, Firestore, Storage)
│       ├── global.css              # CSS custom properties and base reset
│       ├── pages/
│       │   ├── Login.tsx           # Auth page with role-based redirect
│       │   ├── Dashboard.tsx       # Student dashboard shell
│       │   ├── TutorDashboard.tsx  # Tutor view: upcoming sessions, review queue, student summaries
│       │   ├── SessionDetail.tsx   # Per-session review: transcript, notes, AI summary, publish
│       │   ├── Admin.tsx           # Admin panel: live table, manual booking
│       │   ├── Book.tsx            # Public booking page with Calendly popup
│       │   └── Seed.tsx            # Dev-only: seeds Firestore with fixture data
│       ├── components/
│       │   ├── Navbar.tsx          # Top nav with logo and sign-out avatar
│       │   ├── Sidebar.tsx         # Left nav for student dashboard
│       │   ├── HeroBar.tsx         # Greeting, next session pill, Join/Book buttons
│       │   ├── LastSession.tsx     # Last session summary card with bullets and practice prompt
│       │   ├── PracticeReady.tsx   # Practice question count card
│       │   ├── ExploreClasses.tsx  # 3-up class card grid
│       │   └── Messages.tsx        # Messages preview list
│       └── hooks/
│           └── useStudentData.ts   # Fetches/creates student Firestore doc, links sessions by email
├── webhook/
│   └── api/
│       ├── calendly.ts             # Handles Calendly invitee.created / invitee.canceled
│       ├── fireflies.ts            # Stores Fireflies transcript, sets summaryStatus: pending
│       └── generate-summary.ts    # Calls Claude API to generate summary card from transcript + notes
├── firestore.rules                 # Firestore security rules
├── firebase.json                   # Firestore rules config + hosting targets
└── article.html                    # Marketing site article page
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project with Firestore, Authentication, and Storage enabled
- Vercel account (for the webhook)
- Anthropic API key (for AI summary generation)
- Fireflies.ai account with auto-record enabled

### Run the app locally

```bash
cd app
npm install
npm run dev
# → http://localhost:5173
```

### Deploy the webhook

```bash
cd webhook
npm install
vercel deploy --prod
```

Set these environment variables in Vercel:

| Variable | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON contents of your Firebase service account key |
| `FIREFLIES_API_KEY` | From fireflies.ai → Settings → Integrations → API Key |
| `ANTHROPIC_API_KEY` | From console.anthropic.com → API Keys |

### Register webhooks

**Calendly** — run once to register the org-level webhook subscription:
```bash
curl -X POST https://api.calendly.com/webhook_subscriptions \
  -H "Authorization: Bearer <YOUR_PERSONAL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mindcraft-webhook.vercel.app/api/calendly",
    "events": ["invitee.created","invitee.canceled"],
    "organization": "https://api.calendly.com/organizations/<YOUR_ORG_ID>",
    "scope": "organization"
  }'
```

**Fireflies** — in fireflies.ai → Integrations → Webhooks → Configure:
- URL: `https://mindcraft-webhook.vercel.app/api/fireflies`
- Event: Transcription Completed

### Deploy the app

```bash
cd app
npm run build
npx gh-pages -d dist   # or: firebase deploy --only hosting:app
```

### Seed test data

1. Sign in at `/login`
2. Navigate to `/seed`
3. Click "Seed my account" — writes a completed session, upcoming session, streak, practice count, and messages to your user doc

---

## Architecture

### Booking → Session flow

```
Student visits /book
  └─ Tutor cards loaded from Firestore (role == 'tutor')
       └─ Student clicks "Book" → Calendly popup
            └─ Student picks time, confirms

Calendly fires webhook → POST /api/calendly
  ├─ Looks up tutor by organizer email (event_memberships[0].user_email)
  │    fallbacks: calendlyEmail field → first user with role == 'tutor'
  ├─ Creates sessions/{id}:
  │    { studentEmail, studentName, studentId: null, tutorId, tutorName,
  │      subject, scheduledAt, endAt, duration, date, meetingUrl,
  │      calendlyEventUri, status: 'scheduled' }
  └─ If student already exists in Firestore:
       ├─ Sets sessions/{id}.studentId = user.uid
       ├─ Auto-completes any past sessions still marked 'scheduled'
       └─ Updates users/{uid}.nextSession

Student signs in → useStudentData runs
  ├─ Re-queries sessions by studentEmail + status == 'scheduled'
  ├─ Picks soonest upcoming session, updates users/{uid}.nextSession
  └─ Backfills sessions/{id}.studentId if null (pre-signup booking)

Dashboard renders → HeroBar shows next session pill
  └─ Join button activates at scheduledAt - 15min (pulses green, links to meetingUrl)

Student cancels → Calendly fires invitee.canceled
  ├─ Sets sessions/{id}.status = 'cancelled'
  └─ Clears users/{studentId}.nextSession
```

### Transcript → Summary card flow

```
Session ends on Google Meet
  └─ Fireflies bot (auto-joined) records and processes audio

Fireflies fires webhook → POST /api/fireflies
  ├─ Fetches full transcript via Fireflies GraphQL API
  ├─ Matches to Firestore session by scheduledAt within 2hr window
  ├─ Stores transcript on sessions/{id}.transcript
  ├─ Sets sessions/{id}.status = 'completed'
  └─ Sets sessions/{id}.summaryStatus = 'pending'
       (if no session match → stored in transcripts/{meetingId} as orphan)

Tutor opens /tutor → "Sessions to Review" shows pending/draft sessions
  └─ Tutor clicks session → /tutor/session/:id

SessionDetail page
  ├─ Tutor reads transcript, adds notes in textarea
  ├─ Optional: attach file → uploaded to Firebase Storage (sessions/{id}/notes/)
  ├─ Tutor clicks "Generate Summary with AI"
  │    └─ POST /api/generate-summary
  │         ├─ Reads transcript + tutorNotes from Firestore
  │         ├─ Calls Claude Haiku with structured prompt
  │         ├─ Returns { title, topics, homework, progress, tutorNote }
  │         └─ Saves draft to sessions/{id}.summaryCard, summaryStatus = 'draft'
  ├─ Tutor edits fields in the summary card editor
  └─ Tutor clicks "Publish to Student →"
       ├─ Updates sessions/{id}.summaryStatus = 'published'
       └─ Writes users/{studentId}.lastSession with the summary card data

Student dashboard → LastSession card shows the published summary
```

### Data model

**`users/{uid}`**
```
uid, email, displayName, role ('student'|'tutor'|'admin'),
streak, practiceCount, messages[], createdAt, lastActive,
nextSession { subject, time, tutor, meetingUrl, scheduledAt },
lastSession { id, subject, date, duration, title, bullets[],
              tutorName, scheduledAt, tutorNote, progress }
```

**`sessions/{id}`**
```
studentEmail, studentName, studentId, tutorId, tutorName,
subject, status ('scheduled'|'completed'|'cancelled'),
scheduledAt (ms), endAt (ms), duration, date, meetingUrl,
calendlyEventUri, calendlyInviteeUri, createdAt,
summaryStatus ('pending'|'draft'|'published'),
summaryCard { title, topics[], homework[], progress, tutorNote },
tutorNotes (text), tutorNotesUrl (Storage URL),
transcript { meetingId, fullText, sentences[], summary, duration, processedAt }
```

**`transcripts/{meetingId}`** — orphaned Fireflies recordings with no matching session
