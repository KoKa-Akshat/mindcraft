# MindCraft

A tutoring platform connecting students with tutors. Students book sessions via Calendly, land on a personalized dashboard showing their next session, last session summary, practice queue, and messages. Tutors get their own dashboard with an upcoming sessions list and per-student summaries. An admin panel allows manual session management.

---

## Features

- **Firebase Auth** — email/password sign-in, Google OAuth, password reset
- **Role-based routing** — students land on `/dashboard`, tutors/admins land on `/tutor`; role stored in Firestore `users` collection
- **Student dashboard** — real-time data from Firestore: next session pill with live Join button, last session summary with bullets, practice count, messages preview, class exploration
- **Tutor dashboard** — upcoming sessions list from Firestore, per-student summary dropdown, recent chat preview, file upload placeholder
- **Admin panel** — live sessions table via `onSnapshot`, stats row, manual session booking form, complete/cancel actions; guarded to `role == 'admin'`
- **Calendly webhook** (Vercel serverless) — org-level subscription catches all tutor bookings; creates session doc in Firestore, links student by email, updates `nextSession` on user doc
- **Pre-signup session linking** — if a student books via Calendly before creating an account, their session is auto-linked on first login by matching email
- **Join Session button** — activates 15 minutes before `scheduledAt`, pulses green when live
- **Public /book page** — dynamically loads tutors from Firestore (`role == 'tutor'`), falls back to a demo tutor; opens Calendly popup on click
- **Firestore rules** — sessions readable by `studentId`, `studentEmail` token match (pre-signup), `tutorId`, or admin role
- **Dev seed page** (`/seed`) — populates the logged-in account with fixture data for local development

---

## Project Structure

```
mindcraft-site/
├── app/                          # React 18 + TypeScript + Vite frontend
│   └── src/
│       ├── App.tsx               # Router, AuthGuard, RoleRedirect
│       ├── firebase.ts           # Firebase init (Auth, Firestore, GoogleProvider)
│       ├── global.css            # CSS custom properties and base reset
│       ├── pages/
│       │   ├── Login.tsx         # Email/password + Google auth, role-based redirect
│       │   ├── Dashboard.tsx     # Student dashboard shell — composes all widgets
│       │   ├── TutorDashboard.tsx# Tutor view: sessions list, student summary, upload
│       │   ├── Admin.tsx         # Admin panel: live sessions table, manual booking
│       │   ├── Book.tsx          # Public booking page with Calendly popup integration
│       │   └── Seed.tsx          # Dev-only: seeds Firestore with fixture data
│       ├── components/
│       │   ├── Navbar.tsx        # Top nav with logo and sign-out avatar
│       │   ├── Sidebar.tsx       # Left nav: Study/Practice items, Slack link
│       │   ├── HeroBar.tsx       # Greeting, next session pill, Join/Book buttons
│       │   ├── LastSession.tsx   # Last session summary card with bullets and practice prompt
│       │   ├── PracticeReady.tsx # Practice question count card
│       │   ├── ExploreClasses.tsx# 3-up class card grid (static, upcoming courses)
│       │   └── Messages.tsx      # Messages preview list
│       └── hooks/
│           └── useStudentData.ts # Fetches/creates student Firestore doc, links sessions by email
├── webhook/
│   └── api/
│       └── calendly.ts           # Vercel serverless handler for Calendly webhooks
├── firestore.rules               # Firestore security rules
├── firebase.json                 # Firestore rules config + hosting targets (app + marketing)
└── article.html                  # Marketing site article page
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Authentication enabled
- A Vercel account (for the webhook)

### Run the app locally

```bash
cd app
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment / Firebase config

Firebase config is hardcoded in `app/src/firebase.ts` (public client keys — safe to commit). No `.env` needed for the frontend.

### Deploy the webhook

```bash
cd webhook
vercel deploy
```

Set the `FIREBASE_SERVICE_ACCOUNT` environment variable in Vercel to the JSON contents of your Firebase service account key. Then point your Calendly org-level webhook at `https://<your-vercel-url>/api/calendly`.

### Deploy the app

```bash
cd app
npm run build
firebase deploy --only hosting:app
```

### Seed test data

1. Run the app locally and sign in at `/login`
2. Navigate to `/seed`
3. Click "Seed my account" — this writes a completed session, upcoming session, streak, practice count, and messages to your user doc

---

## Architecture: Booking Flow End-to-End

```
Student visits /book
  └─ Firestore users (role==tutor) loaded → tutor cards rendered
       └─ Student clicks "Book Free Session"
            └─ Calendly popup opens (tutor's calendlyUrl)
                 └─ Student fills in name/email, picks time, confirms

Calendly fires org-level webhook → POST /api/calendly (Vercel)
  └─ webhook/api/calendly.ts receives invitee.created
       ├─ Looks up tutor by organizer email (event_memberships[0].user_email)
       │    fallback: calendlyEmail field → fallback: first user with role==tutor
       ├─ Creates sessions/{id} doc:
       │    { studentEmail, studentName, studentId: null, tutorId, tutorName,
       │      subject, scheduledAt, endAt, duration, date, meetingUrl,
       │      calendlyEventUri, calendlyInviteeUri, status: 'scheduled' }
       └─ If student email matches an existing user doc:
            ├─ Sets sessions/{id}.studentId = user.uid
            └─ Sets users/{uid}.nextSession = { subject, time, tutor, meetingUrl, scheduledAt }

Student signs in (or was already signed in) → useStudentData hook runs
  ├─ If user doc exists:
  │    Re-queries sessions by studentEmail+status==scheduled
  │    Picks the soonest upcoming session, writes it back to users/{uid}.nextSession
  │    If session.studentId is null, sets it to user.uid (backfill)
  └─ If user doc does not exist (first login):
       Creates users/{uid} doc (role: student)
       Queries sessions where studentEmail==user.email AND studentId==null
       Batch-updates all matching sessions with studentId=user.uid
       Sets users/{uid}.nextSession from the first scheduled session

Dashboard renders
  └─ HeroBar shows next session pill
       └─ Join Session button enabled when Date.now() >= scheduledAt - 15min
            (pulses green, links to meetingUrl)

If student cancels via Calendly:
  └─ Calendly fires invitee.canceled → webhook matches by calendlyEventUri
       ├─ Sets sessions/{id}.status = 'cancelled'
       └─ Clears users/{studentId}.nextSession
```

### Data model

**`users/{uid}`**
```
uid, email, displayName, role ('student'|'tutor'|'admin'),
streak, practiceCount, messages[], lastSession{}, nextSession{},
createdAt, lastActive
```

**`sessions/{id}`**
```
studentEmail, studentName, studentId, tutorId, tutorName,
subject, status ('scheduled'|'completed'|'cancelled'),
scheduledAt (ms), endAt (ms), duration, date, meetingUrl,
calendlyEventUri, calendlyInviteeUri, createdAt
```
