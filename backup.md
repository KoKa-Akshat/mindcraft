# MindCraft — Full Session Backup
*All changes made across this working session. Pass this to any agent to restore full context.*

---

## Project Overview

- **App** (`/app`): React + TypeScript SPA, Vite, Firebase Hosting target `mindcraft-93858.web.app`
- **Webhook** (`/webhook`): Vercel serverless functions — AI proxy, Firestore ops, cron jobs
- **Marketing** (`index.html`): Static HTML on separate Firebase target
- **Stack**: React, Framer Motion, Firebase Auth + Firestore, Groq (Llama 3.3 70B) via Vercel proxy, LangChain

---

## 1. Navigation — Sidebar → Merged HeroBar

**Problem**: Left sidebar (200px fixed) wasted screen space. User wanted nav merged into the "Good morning" hero card, not as a separate top bar.

**What changed**:

- `app/src/components/Sidebar.tsx` — Completely rewritten. Now renders a `position: fixed; top: 0` horizontal top nav (54px tall) with: logo pill (left), nav links center-left (Session Notes / Practice / Organize / Community), user avatar + sign-out (right). Also renders a `<div className={s.spacer} />` (height 54px) to push page content down in normal flow.

- `app/src/components/Sidebar.module.css` — Full rewrite. Horizontal layout with `backdrop-filter: blur(18px)` dark background, active link highlighted in `#C4F547` lime.

- `app/src/components/HeroBar.tsx` — Extended to include: MindCraft logo pill, Dashboard/Session Notes/Practice/Organize/Community nav, user avatar + sign-out, greeting, date, next-session status, and Book/Join/Message actions. Imports `useLocation`, `Link`, `signOut`, `useUser`, logo/raccoon assets directly. **Dashboard does NOT use Sidebar at all — HeroBar is the entire navigation.**

- `app/src/components/HeroBar.module.css` — Full rewrite. Single unified teal command-center card containing logo, Dashboard/Session Notes/Practice/Organize/Community nav, user avatar/sign-out, greeting, date, next-session pill, Book Session/Join Session, and Message Tutor. Current state is a two-row layout: top row = brand/nav/user controls; bottom row = greeting/session/actions. This fixes the awkward empty-space toolbar feel on Dashboard.

- `app/src/pages/Dashboard.tsx` — Removed `<Sidebar />` import and usage entirely. HeroBar handles all navigation.

- `app/src/pages/Dashboard.module.css` — Removed `margin-left: 200px` from `.page`, centered Dashboard with `margin: 0 auto`, and removed the old mobile top padding that was only needed for fixed nav.

- `app/src/pages/Practice.module.css` — Removed `margin-left: 200px`, changed `.shell` from `display:flex` to block, centered `.page` with `margin: auto`, `max-width: 960px`. Removed `.backBtn` styles. Changed `.topBar` to `justify-content: flex-end` (just the mode toggle, no back button).

- `app/src/pages/Practice.tsx` — Still uses `<Sidebar />`, but Sidebar is now the slim fixed top nav. Removed the old `← Dashboard` back button from `topBar` (top nav logo serves this purpose).

- `app/src/pages/StudentSessions.module.css` — `margin-left: 0`
- `app/src/pages/KnowledgeGraph.module.css` — `margin-left: 0`

**Result**: Dashboard = one unified HeroBar/card. Practice + all other pages = slim fixed top nav from Sidebar.

---

## 2. Dashboard — Globe3D + Floating Cards Layout (CURRENT STATE)

The current dashboard layout (approved by user, do NOT revert):

- `app/src/pages/Dashboard.tsx` — Uses `Globe3D` component (CSS sphere). Layout: dark glass-morphism hero card (58% width, left) containing "Tell us what feels messy." headline + Exam Help CTA button + Globe3D. Right side has two floating 3D-perspective cards: FloatA (coral gradient, Homework Help) and FloatB (blue-purple gradient, This Week's Problems). 20 animated particles behind the scene.

- `app/src/pages/Dashboard.module.css` — Dark theme with `var(--bg)`. `.scene` is flex row. `.hero` has `backdrop-filter: blur(28px)`. Float cards use CSS `@keyframes floatUp` for Y-axis animation. Float card 3D transforms in CSS class only (not Framer Motion) to avoid transform conflict.

- `app/src/components/Globe3D.tsx` — Pure CSS + Framer Motion globe. **NOT React Three Fiber** (R3F was abandoned after a blank page crash: R3F runtime errors are not caught by Suspense). Uses `conic-gradient` spinning sphere + animated SVG orbital rings.

- `app/src/components/Globe3D.module.css` — `.sphere` uses `conic-gradient(from 10deg, #FF6B6B, #C4F547, #4A7BD9, #9B45C8)`. Two orbital rings with 3D `rotateX` perspective.

**Key lesson**: R3F/Three.js throws runtime errors that Suspense cannot catch, causing blank page. Use CSS + Framer Motion for decorative 3D.

---

## 3. Login Page — Full Redesign

- `app/src/pages/Login.tsx` — Two-column layout: left branding (centered `MindCraft` wordmark where C is `#C4F547` lime) + right white card. All auth logic preserved (email/password sign in + sign up, Google OAuth, forgot password, role-mismatch guard, `routeAfterLogin`). Role selector: Student / Parent / Tutor segmented control.

- `app/src/pages/Login.module.css` — `.page` background: `linear-gradient(135deg, #0a0e14, #0d2b2e, #1a4d52)` dark teal. `.card` is white (`#ffffff`). Submit button: `#a4d65e` lime. Input focus: `#a4d65e` border + glow. SVG fractal noise overlay at opacity 0.025 for grain texture.

---

## 4. Practice Page — Exam Help Flow

- `app/src/pages/Practice.tsx` — When navigated with `location.state.examHelp = true`, skips onboard phase and jumps directly to `exam-pick`. This is triggered from the Dashboard's Exam Help button: `navigate('/practice', { state: { examHelp: true } })`.
- `app/src/pages/Practice.tsx` — Exam pick screen now uses a repo-native `PixelCraft` CSS mascot instead of the old raccoon photo asset. This keeps Craft crisp/pixel-cute at small and large sizes and is reused across onboarding, confidence, building, gap analysis, path header, and solver loading.
- `app/src/pages/Practice.tsx` — Exam card metadata added via `EXAM_CARD_META` for consistent card icon labels, accent colors, and microcopy.
- `app/src/pages/Practice.tsx` — Confidence step redesigned into a wider two-column diagnostic surface: left side shows exam context, current concept, and PixelCraft badge; right side has three large level choices. Exam-specific helper copy comes from `CONFIDENCE_COPY`.
- `app/src/pages/Practice.tsx` — `EXAM_CONCEPT_IDS` expanded to use more of the available concept surface per exam. ACT/SAT now include data/probability/percent/word-problem concepts; IB/AP include transformations/rational/polynomial/stat concepts where available.
- `app/src/pages/Practice.tsx` — `startSession()` now requests `SESSION_LENGTH` dynamic questions for the selected exam instead of 8, so ACT/SAT/IB/AP sessions are primarily generated in selected-exam style. Static questions only fill shortfalls/outages.
- `app/src/pages/Practice.module.css` — Practice page widened to `max-width: 1180px`. Exam pick uses a simple open "exam router": left copy and same-size boxy subject tiles. Cards use full MindCraft subject palette colors (`--c-algebra`, `--c-geometry`, `--c-trig`, `--c-stats`, lime brand), clean icon badges, hover arrows, short descriptors, and responsive wrapping. Avoid over-organic/asymmetric card shapes here. The floating PixelCraft badge was removed from exam-pick at user request.
- `app/src/pages/Practice.module.css` — Confidence screen now uses a two-column card layout with exam-color accenting, stronger progress dots, and larger level cards.

---

## 5. Dynamic Question Generation Agent

**Problem**: Static hardcoded question bank (200 questions, 15 algebra concepts, all pre-written). Not diagnostic, not dynamic, IB/AP poorly covered.

### Backend — `webhook/api/generate-questions.ts` (NEW FILE)

LangChain chain: `ChatPromptTemplate → ChatGroq (Llama 3.3 70B) → JsonOutputParser`

- **Input**: `POST { conceptId, level, examType?, count? }`
- **Output**: `{ questions: Question[], cached: boolean }`
- **Caching**: Firestore collection `question_cache`, doc key = `{conceptId}_L{level}_{examType}_N{count}`, TTL = 24 hours. On cache hit returns instantly without hitting Groq only if the cache has at least the requested number of valid questions.
- **Concept knowledge**: Per-concept domain knowledge string injected into prompt (common traps, sub-skills, exam patterns) for each of the 15 concepts.
- **Level guidance**: Foundation (1–2 steps, clean numbers) / Applied (word problems, multi-step) / Exam Ready (non-routine, exam difficulty).
- **Exam style**: Per-exam prompt instructions — ACT speed/phrasing, SAT context-heavy, IB exact values/"hence find", AP function notation/intervals, General friendly.
- **Question schema**: Same `Question` interface as static bank — id, conceptId, level, question, choices[4], correctIndex, explanation, hints[3], examTag.
- Uses `../lib/firebase` for Firestore (shared init already in place).
- **Guardrails added after audit**: normalizes exam type, caps count to 1–10, slices cached results to requested count, rejects malformed question objects, rejects duplicate generated IDs, and only writes normalized questions back to Firestore.
- **Exam-specific generation strengthened**: prompt now injects an `EXAM_BLUEPRINT` for ACT/SAT/IB/AP/General. Non-General exam generations require every returned question to have a matching `examTag`, preventing ACT sessions from accepting SAT/General-style generated questions.

Added to `webhook/vercel.json`: `"api/generate-questions.ts": { "maxDuration": 30 }`

**Packages installed** in `/webhook`: `@langchain/groq`, `@langchain/core`

### Frontend — `app/src/lib/questionAgent.ts` (NEW FILE)

- `generateQuestions(conceptId, level, examType, count)` — Two-layer cache:
  1. **sessionStorage** (tab lifetime) — checked first, instant
  2. **Fetch endpoint** (hits Firestore cache or generates) — result written back to sessionStorage
  Returns `Question[]`, returns `[]` on any error (safe fallback).
- Session cache keys include requested count: `{conceptId}_L{level}_{examType}_N{count}`. This prevents a short cached generation from poisoning a full 10-question session.

- `evictQuestionCache(conceptId, level, examType)` — Removes sessionStorage entry. Called after mastery so next session gets fresh questions.

### Practice.tsx changes

- `startSession()` is now **async**.
- Races `generateQuestions()` + `getQuestions()` in parallel via `Promise.all`.
- Merges: dynamic questions first, then static questions not already in dynamic set (deduped by id).
- Falls back to static-only if agent returns empty.
- Shows existing `building` screen during the ~2s generation window.
- After mastery (≥80% first-attempt accuracy), calls `evictQuestionCache()` so next session regenerates.

### Agent Status Check — 2026-05-08

Verified locally:

- `app` production build passes: `cd app && npm run build`
- `webhook` TypeScript check passes: `cd webhook && npx tsc --noEmit`
- Production route exists: invalid POST to `https://mindcraft-webhook.vercel.app/api/generate-questions` returned the expected `400` (`conceptId and level are required`), proving Vercel route + CORS are live.
- Production generation path works: POST `{ conceptId:"linear_equations", level:1, examType:"General", count:1 }` returned generated questions from Firestore cache.

Important finding:

- The live cached response included one bad generated question where the displayed correct answer was not aligned with `correctIndex`. The new backend guardrails catch shape/count/id issues, but they **do not prove mathematical correctness**. For real MVP trust, add a verification layer before caching or showing AI-generated questions.

Recommended next backend step:

- Add a `verify-question` pass before cache write: either a second LLM call with strict JSON `{isValid, correctedQuestion, reason}` or a deterministic checker for algebra-only concepts. Do not cache questions unless the answer index, explanation, and choices are verified.

---

## 6. Backend Architecture Summary

```
Browser
  │
  ├─ Auth/Profile ─────→ Firebase Auth + Firestore
  │
  ├─ Homework Solver ──→ app/src/lib/geminiHomework.ts
  │                          └─ POST /api/gemini (Vercel)
  │                              └─ Groq API (Llama 3.3 70B)
  │                                  Returns 6-card Socratic session JSON
  │
  ├─ Practice Questions
  │      ├─ Static fallback: app/src/lib/questionBank.ts
  │      └─ Dynamic agent: app/src/lib/questionAgent.ts
  │             └─ sessionStorage cache
  │             └─ POST /api/generate-questions (Vercel)
  │                    ├─ Firestore cache check (question_cache/{concept}_L{level}_{exam}_N{count})
  │                    └─ LangChain: ChatGroq → JsonOutputParser
  │                        Returns Question[] matching static bank schema
  │
  └─ Constellation ────→ GET {ML_API_URL}/knowledge-graph/{userId} (Cloud Run)
                             Returns nodes + edges from actual session history
                             Tracks mastery, event counts, status per concept
```

**LLM**: Llama 3.3 70B via Groq (NOT Gemini — legacy naming in codebase)
**Proxy**: `mindcraft-webhook.vercel.app/api/gemini`
**Firestore**: Used for user profiles, session notes, constellation data, question cache

---

## 7. Key Files Reference

| File | Purpose |
|------|---------|
| `app/src/pages/Dashboard.tsx` | Main dashboard — Globe3D hero + floating cards |
| `app/src/pages/Dashboard.module.css` | Dashboard styles |
| `app/src/pages/Practice.tsx` | Full practice flow (onboard → exam pick → confidence → gap analysis → path → session → complete) + solver |
| `app/src/pages/Login.tsx` | Auth page — email/password + Google OAuth |
| `app/src/components/Sidebar.tsx` | Now a horizontal top nav (fixed top) for all pages except Dashboard |
| `app/src/components/HeroBar.tsx` | Dashboard-only unified nav + greeting card |
| `app/src/components/Globe3D.tsx` | CSS conic-gradient spinning globe with SVG orbital rings |
| `app/src/components/ConstellationCard.tsx` | Real knowledge graph from ML API — requires prior sessions |
| `app/src/lib/questionBank.ts` | Static question pool — 200 questions, 15 concepts, 3 levels |
| `app/src/lib/questionAgent.ts` | Dynamic question fetcher with sessionStorage cache |
| `app/scripts/auditPracticeSystem.mjs` | Practice-system audit: static bank integrity, exam map validity, coverage warnings, optional live qgen smoke test |
| `app/src/lib/geminiHomework.ts` | Groq-based homework solver (6-card Socratic) + clue generator |
| `app/src/lib/geminiProxy.ts` | Thin fetch wrapper for Vercel AI proxy |
| `webhook/api/generate-questions.ts` | LangChain question generation agent + Firestore cache |
| `webhook/api/gemini.ts` | Groq proxy (Llama 3.3 70B) |
| `webhook/lib/firebase.ts` | Shared Firebase Admin init |

---

## 8. Known Issues / Next Steps

- **IB/AP concept coverage**: Question bank only has algebra + basic stats. IB (vectors, complex numbers, integration) and AP (calculus) concepts are missing. The dynamic agent will generate questions for these if asked but there's no `PRACTICE_CONCEPTS` entry for them yet.
- **Generated question correctness**: Live agent route works, but a cached generated question had an incorrect `correctIndex`. Add a verifier before cache write and consider purging existing `question_cache` docs after deploy.
- **Static bank duplicate IDs fixed**: `basic_probability` IDs were renamed from `pr-*` to `bp-*`, so they no longer collide with `percent_ratio`.
- **Initial diagnostic is self-reported**: The confidence survey (easy/kinda/hard) is not a real test. Replace with one actual L1 question per concept for real gap detection.
- **Constellation empty on first visit**: No data until the student completes at least one session. Consider a placeholder onboarding path.
- **Deploy**: `cd webhook && vercel --prod` to push new `generate-questions` endpoint live.

---

## 9. Environment Variables Required

| Var | Where | Purpose |
|-----|-------|---------|
| `GROQ_API_KEY` | Vercel env | Groq API access for Llama 3.3 70B |
| `FIREBASE_SERVICE_ACCOUNT` | Vercel env | Firebase Admin SDK (JSON stringified) |
| `VITE_ML_API_URL` | Firebase Hosting / local `.env` | Cloud Run ML service for constellation |
| `VITE_HOMEWORK_API_URL` | Firebase Hosting / local `.env` | Homework solver backend (optional, falls back to Groq direct) |

---

## 10. Question Bank Coverage Audit — 2026-05-08

Actual static bank count from `app/src/lib/questionBank.ts`: **227 questions across 15 concepts**.

Automated audit added:

- Run local integrity check: `cd app && npm run audit:practice`
- Optional live generation smoke test: `cd app && RUN_REMOTE_QGEN=1 npm run audit:practice`
- Current local result: **passes with warnings allowed**.
- The audit blocks on duplicate question IDs, malformed concept references, missing static fallback by level, or invalid exam concept maps.
- It warns when a selected exam/concept/level has fewer than `SESSION_LENGTH` static fallback questions or no static exam-tagged fallback.

| Concept | Total | L1 | L2 | L3 |
|---|---:|---:|---:|---:|
| linear_equations | 29 | 10 | 10 | 9 |
| quadratic_equations | 29 | 10 | 10 | 9 |
| functions_basics | 29 | 10 | 10 | 9 |
| exponent_rules | 29 | 10 | 10 | 9 |
| word_problems | 12 | 4 | 4 | 4 |
| percent_ratio | 12 | 4 | 4 | 4 |
| basic_probability | 11 | 4 | 4 | 3 |
| absolute_value | 11 | 4 | 4 | 3 |
| linear_inequalities | 10 | 4 | 3 | 3 |
| polynomials | 10 | 4 | 3 | 3 |
| systems_of_linear_equations | 9 | 3 | 3 | 3 |
| rational_expressions | 9 | 3 | 3 | 3 |
| number_properties | 9 | 3 | 3 | 3 |
| descriptive_statistics | 9 | 3 | 3 | 3 |
| function_transformations | 9 | 3 | 3 | 3 |

Exam coverage reality:

- **ACT**: MVP acceptable for early algebra-heavy practice, but missing geometry, trigonometry, coordinate geometry depth, advanced counting/probability, matrices, and timed mixed sets.
- **SAT**: MVP acceptable for Heart of Algebra + some Passport to Advanced Math. Weak on data analysis, nonlinear functions, geometry/trig, and official-style grid-in/open-response behavior.
- **IB**: Not enough. Current concepts are mostly pre-IB algebra. Missing functions depth, sequences/series, trigonometry, vectors, complex numbers, calculus, probability distributions, statistics, proof/explanation style, HL/SL split.
- **AP**: Not enough. Current concepts support precalculus foundations only. Missing limits, derivatives, integrals, applications, differential equations, series, FRQ-style reasoning, graph/table interpretation.
- **General**: Reasonable starter set for high-school algebra remediation.

MVP conclusion: static bank is enough as a fallback, not as the core product promise. The dynamic agent is necessary, but it needs verification before students rely on it.

---

## 11. Business/Product Ideas To Revisit After MVP

- **Specialized exam-course agents**: ACT Coach, SAT Coach, IB AA/AI SL/HL Coach, AP Calc AB/BC Coach. Each owns a syllabus map, question style guide, diagnostic rubric, and study plan.
- **Question factory pipeline**: generate → verify → tag concepts/traps → calibrate difficulty → store approved questions. Humans review only low-confidence items.
- **Real diagnostic instead of self-report**: one adaptive question per concept, then branch difficulty based on correctness, time, hints, and explanation quality.
- **Mastery graph as the moat**: every answer updates concept mastery, misconception tags, and next-best lesson. The graph should drive practice, homework help, parent reports, and tutor prep.
- **Tutor/parent monetization loop**: auto weekly reports, exact weak concepts, suggested sessions, and receipts of improvement. This sells the business better than “AI tutor” alone.
- **Class generators**: agents can generate a 4-week ACT Algebra Sprint, IB Functions Bootcamp, AP Limits Rescue, etc. Each class has diagnostics, daily practice, homework review, and measurable outcomes.
- **Trust layer**: verified question bank + transparent explanations + tutor escalation for uncertain AI output. This matters more than flashy generation for education.
