# MindCraft Complete Data Architecture & Event Flow

*Canonical reference for the engineering team and n8n agent designer.*
*Last updated: 2026-06-29. Update this file whenever a new endpoint, collection, or data flow changes.*

---

## 1. System Overview

| Component | Tech | URL | GCP Project |
|-----------|------|-----|-------------|
| **Frontend app** | React + Vite + TS | `mindcraft-93858.web.app` | `mindcraft-93858` |
| **3D World** | Three.js static | `mindcraft-world1.web.app` | `mindcraft-93858` |
| **Marketing** | Static HTML | `mindcraft-marketing-site.web.app` | `mindcraft-93858` |
| **ML engine** | FastAPI Cloud Run | `mindcraft-ml-630302850770.us-central1.run.app` | `project-e4af30ac-...` |
| **Homework LLM** | FastAPI Cloud Run | — | `mindcraft-93858` **DOWN (credits)** |
| **Webhook pipeline** | Vercel serverless | `mindcraft-webhook.vercel.app` | N/A |
| **Firestore** | Firebase | Firebase SDK | `mindcraft-93858` |

```
Browser (student)
  │ Firebase Auth (Google / email-password)
  ▼
React App (mindcraft-93858.web.app)
  │ Firebase SDK → Firestore (mindcraft-93858)
  │ REST (Bearer Firebase ID token) → ML Engine (Cloud Run)
  │ redirect → World (mindcraft-world1.web.app)

Fireflies → POST → Vercel Webhook
  │ Firebase Admin SDK → Firestore
  │ REST (X-Service-Key) → ML Engine /process-summary
  │ Anthropic SDK → claude-sonnet-4-20250514
```

---

## 2. Complete Data Flow — Step by Step

### 2.1 Login & Auth

**TRIGGER**: User hits `/login` or any protected route when unauthenticated; `AuthGuard` in `app/src/App.tsx:81-115` redirects

**INPUT**: Email+password OR Google OAuth; role `'student'|'parent'|'tutor'`; `?next=<path>`

**FUNCTION**:
- `app/src/pages/Login.tsx:handleSubmit()` → Firebase `signInWithEmailAndPassword` or `createUserWithEmailAndPassword`
- `app/src/pages/Login.tsx:handleGoogle()` → Firebase `signInWithPopup`
- `app/src/pages/Login.tsx:routeAfterLogin(uid, isNewUser)`:
  1. `auth.currentUser?.getIdToken(true)` — refresh token
  2. `getDoc(doc(db, 'users', uid))` — read stored role
  3. New users: `setDoc(doc(db, 'users', uid), { role, email, displayName, createdAt })`

**STORED**: Firestore `users/{uid}` (new users): `{ role, email, displayName, createdAt: ISO string }`

**SIDE EFFECTS**: `AuthGuard` fires `warmML()` (GET `/health`) + `fetchKnowledgeGraph(uid)` prefetch into shared cache

---

### 2.2 Post-Login: ML Warm-up & Graph Cache

**TRIGGER**: `onAuthStateChanged` resolves in `app/src/App.tsx:84-89`

**FUNCTION**:
- `warmML()` → `fetch(${ML_API_URL}/health)` fire-and-forget; module-level `mlWarmed` boolean prevents double-fire
- `app/src/lib/graphCache.ts:fetchKnowledgeGraph(userId)` → `GET /knowledge-graph/{userId}` with Bearer token; result stored as `Promise<KGResponse|null>` in `Map<string, Promise>`; concurrent callers deduplicate; failures NOT cached

**STORED**: In-memory `Map<uid, Promise<{nodes, edges, studentPoints, axisLabels, conceptCount, edgeCount}>>`

---

### 2.3 Jesse's World (3D) Entry

**TRIGGER**: New student post-login OR "3D" button on dashboard (`app/src/pages/Dashboard.tsx:goTo3DWorld()`)

**INPUT**: `?student=<uid>` URL param; `?diagDone=1` if post-diagnostic

**FUNCTION** (`worlds/world2/mc-world-chrome.js`):
- Reads `localStorage['mc-diag-done']` AND cookie `mc_diag_done=1` (set by dashboard on `.web.app` domain)
- `?diagDone=1`: sets `localStorage['mc-diag-done']='1'`, strips param via `history.replaceState`
- Arrow click → redirects to `mindcraft-93858.web.app/diagnostic`

**Sign routes** (`worlds/world2/mc-world-nav.js` patches `window.experience`):

| 3D Sign | Route |
|---------|-------|
| articles | `/practice?learnNext=1` |
| aboutMe | `/knowledge-graph` |
| credits | `/practice?homeworkHelp=1` |
| practice | `/practice` |
| book | `/book` |

---

### 2.4 Diagnostic Flow

Two implementations: (A) React page at `/diagnostic` (Let Nox Cook flow), (B) in-world overlay (`worlds/world2/mc-diagnostic.js`). Both emit identical events.

#### Step 1 — Goals (no network)
Local state: `goalTags: string[]`, `goalText: string`

#### Step 2 — Confidence (`app/src/pages/Diagnostic.tsx:80-96 finishConfidence()`)

**TRIGGER**: User rates all concepts; clicks Next

**INPUT**: `confidence: Record<concept_id, number>` where value ∈ `{0.15, 0.45, 0.70, 0.95}`

**FUNCTION**: `app/src/lib/mlApi.ts:sendLearningEvent()` — one call per rated concept:
```
POST /learning-event
{ student_id, subject_id:"math", concept_id, event_type:"confidence_report",
  outcome:null, source:"diagnostic", metadata:{ confidence:value, step:"confidence" } }
```

**STORED**: Firestore `learning_events/{auto_id}`

**⚠️ KNOWN GAP**: `/learning-event` endpoint may be missing from `ml/serve.py` — see Critical Findings

#### Step 3 — Probe Questions (`app/src/pages/Diagnostic.tsx:99-129 answerProbe()`)

**TRIGGER**: User selects answer

**INPUT**: `probe.question_id`, `probe.concept_id`, `choiceKey`, `correct: bool`, `durationMs`

**FUNCTION**: `sendLearningEvent`:
```
POST /learning-event
{ event_type:"answer_submitted", outcome:1.0|0.0, duration_ms,
  metadata:{ question_id, selected:choiceKey, step:"probe" } }
```

**STORED**: Firestore `learning_events/{auto_id}`

#### Step 4 — Complete (`app/src/pages/Diagnostic.tsx:142-172 complete()`)

**TRIGGER**: Last probe answered/skipped

**FUNCTION**:
1. `setDoc(doc(db,'users',uid), { goals, diagnosticCompletedAt, diagnosticVersion }, { merge:true })`
2. `sendLearningEvent({ event_type:'diagnostic_complete', concept_id:'diagnostic', metadata:{...} })`

**STORED**:
- `users/{uid}` (merge): `{ goals:{tags,text}, diagnosticCompletedAt:ISO, diagnosticVersion:"2026-06-act-v1" }`
- `learning_events/{auto_id}` (diagnostic_complete event)

**SIDE EFFECTS**: Navigate to `/dashboard`

---

### 2.5 Practice Gap-Scan (the active diagnostic gate for most students)

**TRIGGER**: `isDiagnosticComplete(uid)` returns false → navigate to `/practice` with `state:{examHelp:true}`

**When gap scan completes** (`app/src/pages/Practice.tsx:714-732`):

**FUNCTION**:
1. `seedAssessment(uid, confidenceMap)` → `POST /seed-assessment`:
   - Maps: `hard→outcome=-0.4,effort=0.7`; `kinda→outcome=-0.1,effort=0.5`; `easy→outcome=0.5,effort=0.3`
   - Deletes prior `source=onboarding_assessment` records; writes new
   - Rebuilds + saves `knowledge_graphs/{uid}`
2. `invalidateKnowledgeGraph(uid)` — clears memory cache
3. `markDiagnosticComplete(uid, { exam, confidenceMap })` via `app/src/lib/practiceState.ts`:
   ```
   setDoc(users/{uid}, {
     diagnosticCompleted:true,
     diagnostic:{ exam, confidenceMap, completedAt:serverTimestamp() }
   }, { merge:true })
   ```

**STORED**:
- `interactions/{auto_id}` (one per concept, `source="onboarding_assessment"`)
- `knowledge_graphs/{uid}` (rebuilt)
- `users/{uid}`: `diagnosticCompleted:true`, `diagnostic:{...}`

**SIDE EFFECTS**: `CustomEvent('mindcraft:path-updated')` on `window`; cookie `mc_diag_done=1; domain=.web.app`

---

### 2.6 Dashboard Load

**TRIGGER**: Navigation to `/dashboard`; requires auth

**Three real-time Firestore subscriptions** (`app/src/hooks/useStudentData.ts`):

1. `onSnapshot(users/{uid})` → `{ displayName, streak, lastSession, homework, practiceCount }`; creates doc if missing; links orphaned sessions by email via `writeBatch`
2. `onSnapshot(sessions where studentEmail==user.email)` → upcoming sessions, `lastSession`, `tutorId`; auto-backfills `studentId` on sessions missing it
3. `onSnapshot(chats/{[uid,tutorId].sort().join('_')}/messages, limit 20)` → last 2 messages for preview

**Diagnostic gate** (`app/src/pages/Dashboard.tsx:47-60`):
- `isDiagnosticComplete(uid)` reads `users/{uid}` for `diagnosticCompleted` OR `diagnosticCompletedAt`
- If false: navigate to `/practice`
- If true: set `mc_diag_done=1` cookie; render full dashboard

---

### 2.7 Knowledge Graph / LearningGPS

**TRIGGER**: Navigate to `/knowledge-graph` OR prefetch from auth

**FUNCTION**: `GET /knowledge-graph/{student_id}` with Bearer token

**Server** (`ml/serve.py:870-985`):
1. `load_student_events_with_learning(student_id)` — reads `interactions` + `learning_events` (limit 500 each)
2. `create_personal_graph + update_personal_graph` — folds events through `update_student_state` + `update_edges_from_events`
3. `compute_concept_profiles(events)` — per-concept `ConceptProfile`
4. `compute_student_embedding_from_mastery(mastery, concept_embs)` — mastery-weighted centroid, normalized
5. `compute_student_embedding_from_profiles(profiles, concept_embs)` — strength-weighted signed centroid
6. `project_concept_embeddings(concept_embs, pca_components, pca_mean)` — all 42 concepts to 2D

**RESPONSE**:
```json
{
  "nodes": [{ "id","name","level","x","y","mastery","strengthScore",
              "eventCount","status":"mastered|struggling|in_progress|untouched",
              "ingredients":[{"id","name","description"}],"tags" }],
  "edges": [{"from","to","weight","relation"}],
  "studentPoints": {
    "mastery": {"x","y","label":"Where you've been studying"},
    "strength": {"x","y","label":"Where you perform best"}
  },
  "axisLabels": {"x":"applied/geometric ↔ algebraic/symbolic","y":"..."}
}
```

---

### 2.8 Practice Session Flow

#### 2.8.1 Mission Hub

**"Fix my weakness"** → `fetchNextConcept(uid)` → `POST /recommend` mode=`'curriculum'` → `studentProfile.topWeaknesses[0]`; bridge-gap override if `isBridgeGap && gapType==='concept'`

**"Learn next"** → `fetchNextNewConcept(uid)` → `POST /recommend` mode=`'exam'` → first untouched ACT concept on pathfinder chain

#### 2.8.2 Question Session (`app/src/pages/Practice.tsx:806-842 startSession()`)

**FUNCTION**:
1. `generateQuestions(conceptId, level, examType, 10, bridge?.fromId)` — Gemini (primary)
2. `getQuestions(conceptId, level, 10, [], examType)` — `app/src/lib/questionBank.ts` 495 static questions (fallback)
3. Deduplicate: dynamic priority + static fill → slice to `SESSION_LENGTH=10`

**Draft autosave** (2000ms debounce, `app/src/pages/Practice.tsx:565-631`):
- `localStorage[practiceDraftKey(uid, missionType)]` = full `PracticeDraft`
- `setDoc(users/{uid}, { practiceDrafts:{[type]:draft}, practiceDraftAt }, { merge:true })`

#### 2.8.3 Session Complete — Recording Outcomes (`app/src/pages/Practice.tsx:898-919`)

**FUNCTION**: `recordOutcomes(uid, perQuestion)` → `POST /record-outcomes`:
```json
{ "student_id": uid,
  "outcomes": [{"concept_id","score":0|1,"format_id","level","question_id"}] }
```

**Server** (`ml/serve.py:528-632`):
1. Bucket scores by concept → `mean(scores)` → `outcome_from(mean, level)` → one `SessionEvent` per concept
2. Bucket by `format_id` → one `format_interaction` per format
3. One `attempt_observation` per question
4. Firestore writes: `interactions/{auto_id}`, `format_interactions/{auto_id}`, `attempt_observations/{auto_id}`, `knowledge_graphs/{uid}`

**SIDE EFFECTS**: `invalidateKnowledgeGraph(uid)`; if pass ≥ 0.80: `markPathMastered(concept)` → `localStorage[pathMasteredStorageKey(uid)]`; wrong answers requeue up to `MAX_SESSION=14`

---

### 2.9 Homework Help Flow

**TRIGGER**: User submits problem text in Practice Problem Solver tab (`app/src/pages/Practice.tsx:952-998`)

**Execution order**:
1. **Gemini** → `solveWithGemini(problemText, exam)` (primary, currently active)
2. **Homework service** → `POST {HOMEWORK_API}/submit-with-file` (DOWN — Anthropic credits exhausted)
3. **Fallback** → `getIngredientCards(uid, problemText, 4)` → `POST /recommend-ingredients`

**Server `/recommend-ingredients`** (`ml/serve.py:635-678`):
1. `load_ingredient_state(uid)` → `ingredient_states/{uid}`
2. `recommend_cards()` pipeline:
   - `classify_problem()` — cosine similarity vs. concept embeddings
   - `select_target_ingredients()` → target IDs
   - `backtrack_prerequisites()` → prereqs via bridge `enables` edges
   - `apply_combinations()` — hyperedge groups (min_overlap=0.5)
   - `build_minimal_dag()` → DAG with mastery + need_score
   - `prune_mastered_nodes()`
   - `detect_weak_targets(max_targets=4)`
   - `select_cards()` — by `style_scores` (geometric/algebraic/procedural)
   - `order_cards_by_dag()` — topological order
3. Save to `ingredient_recommendations/{uid}`

**Card outcome** (from HomeworkCards):
```
POST /submit-answer
{ student_id, card_template_id, target_type:"ingredient"|"bridge",
  target_id, representation_key, student_succeeded:bool }
→ update_ingredient_state() → aggregate_to_concept_mastery()
→ saves ingredient_states/{uid} + knowledge_graphs/{uid}
```

---

### 2.10 Session Summary Webhook (Fireflies → ML)

**TRIGGER**: Fireflies completes meeting → `POST /api/fireflies`

**Step 1 — Transcript Fetch** (`webhook/api/fireflies.ts`):
- GraphQL → `api.fireflies.ai/graphql` with `FIREFLIES_API_KEY`
- Session match: exact meetingId → URL → ±2hr time window → orphan in `transcripts/{meetingId}`
- Match found: `sessions/{sessionId}` update `{ transcript:{...}, status:"completed", summaryStatus:"pending" }`

**Step 2 — AI Summary** (`webhook/api/generate-summary.ts`):
- Tutor POSTs `{ sessionId, tutorNotes?, fileText? }` (verified Firebase ID token)
- `callClaude(prompt)` → `claude-sonnet-4-20250514`, `max_tokens=1024, temperature=0.3`
- Returns `{ title, topics:string[], homework:string[], progress, tutorNote }`
- `sessions/{sessionId}` update `{ summaryCard, summaryStatus:"draft", tutorNotes }`
- Fire-and-forget: `POST {ML_URL}/process-summary` with `X-Service-Key`

**Step 3 — ML Process Summary** (`ml/serve.py:758-814`):
- Embed bullets/topics → cosine similarity → `SessionEvent` list
- Writes `interactions/{auto_id}` (`source="summary_parser"`) + rebuilds graph

**Step 4 — Publish** (`webhook/api/publish-summary.ts`):
- `sessions/{sessionId}` update `{ summaryCard:card, summaryStatus:"published" }`
- `users/{studentId}` update `lastSession:{...}`
- Student sees live via `onSnapshot`

---

## 3. Firestore Schema (All Collections)

### `users/{uid}`
```
uid, email, displayName, role: "student"|"parent"|"tutor"|"admin"
streak, practiceCount, createdAt, lastActive
lastSession: { id,subject,date,duration,title,bullets,tutorName,scheduledAt,tutorNote,progress }
homework: { prompt?,subject?,problems:[{id,text,done,subject?}],assignedAt?,tutorName? }
goals: { tags:string[], text:string }
diagnosticCompletedAt: ISO string        ← Diagnostic.tsx flow (Let Nox Cook)
diagnosticVersion: string
diagnosticCompleted: boolean             ← Practice gap-scan flow (active gate)
diagnostic: { exam, confidenceMap:Record<concept_id,"hard"|"kinda"|"easy">, completedAt }
practiceDrafts: { weakness?,learn?,gapscan?: PracticeDraft }
practiceDraftAt: Timestamp
```

### `sessions/{sessionId}`
```
studentId, studentEmail, studentName, tutorId, tutorName
subject, scheduledAt: number(ms), endAt: number(ms), duration, status, meetingUrl
transcript: { meetingId, fullText, summary, sentences, duration, processedAt }
summaryStatus: "pending"|"draft"|"published"
summaryCard: { title, topics:string[], homework:string[], progress, tutorNote }
tutorNotes: string|null
```

### `interactions/{auto_id}` — Concept Events
```
studentId, conceptId, eventType:"session"|"assessment"|"problem_set"
outcome: float[-1,1], effort: float[0,1], durationMinutes, exposureWeight
timestamp, source: "onboarding_assessment"|"practice"|"summary_parser"
```
Required index: `(studentId, timestamp DESC)`

### `format_interactions/{auto_id}` — Format/Representation Events
```
studentId, formatId:"word_problem"|"diagram"|"number_line"|"symbolic_expression"|"coordinate_graph"|"table"
outcome, level, exposureWeight, timestamp
```

### `attempt_observations/{auto_id}` — Per-Question Log (replay only)
```
studentId, conceptId, formatId, level, correct:0.0|1.0, questionId, timestamp
```

### `learning_events/{auto_id}` — Diagnostic Events
```
studentId, subjectId, conceptId, eventType:"confidence_report"|"answer_submitted"|"diagnostic_complete"
outcome:float|null, durationMs, source:"diagnostic"
metadata: { confidence?,step?,question_id?,selected?,concepts_seen?,correct? }
```

### `knowledge_graphs/{uid}`
```
studentId, updatedAt
masteryByConcept: { [concept_id]: { mastery,exposureCount,lastInteraction,cumulativeOutcome,weightedCount,attempts } }
edges: { ["from::to"]: { fromConcept,toConcept,relation,alpha,beta,weight,lastUpdated } }
ontologyEdgeCount, discoveredEdgeCount
```

### `ingredient_states/{uid}`
```
studentId, updatedAt
ingredient_mastery: { [ingredient_id]: { mastery,attempts,last_outcome,cumulative_outcome } }
bridge_confidence: { [bridge_id]: { from_ingredient,to_ingredient,confidence,attempts,successes } }
style_scores: { "geometric"|"algebraic"|"procedural": float }
```

### `ingredient_recommendations/{uid}`
```
studentId, updatedAt, problemText, problemFeatures, minimalDag, cards, compositionPrompt
```

### `recommendations/{uid}`
```
studentId, updatedAt, mode
recommendations: ConceptRecommendation[]
studentProfile: { masteryProjection,strengthProjection,displacementMagnitude,... }
```

### `students/{uid}/metrics/{auto_id}` — Displacement Time Series (subcollection)
```
magnitude:float, direction:{[axis_label]:float}, timestamp
```
Populated on every `/recommend` call. NOT yet read by any UI component.

### `chats/{chatId}/messages/{auto_id}`
```
chatId = [uid1,uid2].sort().join('_')
senderId, text, fileName?, createdAt
```

### `transcripts/{meetingId}` — Orphan Transcripts
```
meetingId, title, date, fullText, summary, sentences, linkedSession:null, createdAt
```

---

## 4. ML API Contract

**Base URL**: `https://mindcraft-ml-630302850770.us-central1.run.app`

**Auth**: `Authorization: Bearer <Firebase ID token>` (student) OR `X-Service-Key: <secret>` (webhook). `/health` is public.

| Method | Endpoint | Firestore Reads | Firestore Writes |
|--------|----------|-----------------|------------------|
| GET | `/health` | none | none |
| POST | `/recommend` | `interactions`, `format_interactions`, `ingredient_states/{uid}` | `knowledge_graphs/{uid}`, `recommendations/{uid}`, `students/{uid}/metrics` |
| POST | `/seed-assessment` | `interactions` (post-seed reload) | `interactions` (delete+write), `knowledge_graphs/{uid}` |
| POST | `/record-outcomes` | `interactions`, `format_interactions` | `interactions`, `format_interactions`, `attempt_observations`, `knowledge_graphs/{uid}` |
| POST | `/recommend-ingredients` | `ingredient_states/{uid}` | `ingredient_recommendations/{uid}` |
| POST | `/submit-answer` | `ingredient_states/{uid}`, `interactions` | `ingredient_states/{uid}`, `knowledge_graphs/{uid}` |
| POST | `/process-summary` | `interactions` | `interactions`, `knowledge_graphs/{uid}` |
| POST | `/prep-diagnose` | `interactions` | none |
| GET | `/student-profile/{id}` | `interactions` | none |
| GET | `/knowledge-graph/{id}` | `interactions`, `learning_events` | none |
| POST | `/learning-event` | none | `learning_events/{auto_id}` — **⚠️ may be missing from serve.py** |

---

## 5. Mathematical Models

### 5.1 Beta-Binomial Edge Weights (`ml/mindcraft_graph/engine/edge_weights.py`)

```
weight = alpha / (alpha + beta)
```

| Relation | Pseudo-total N | Prior mean | alpha_prior | beta_prior |
|----------|---------------|------------|-------------|------------|
| prerequisite | 20 | 0.9 | 18 | 2 |
| related | 8 | 0.4 | 3.2 | 4.8 |
| application | 5 | 0.5 | 2.5 | 2.5 |
| discovered | — | 0.5 | 1.0 | 1.0 |

Co-occurrence update (2-hour session window):
```
joint_outcome = (outcome1 + outcome2) / 2.0
success = (joint_outcome + 1) / 2      # [-1,1] → [0,1]
alpha += success
beta  += (1 - success)
```

### 5.2 Mastery Score (`ml/mindcraft_graph/engine/update.py`)

```
m = σ(β₀ + β₁·log(W_eff+1) + β₂·avg_outcome + β₃·recency)

β₀=-2.0  β₁=0.8  β₂=1.5  β₃=0.3

W_eff        = weighted_count × exp(-0.693 × days_idle / 60)
avg_outcome  = cumulative_outcome / weighted_count  ∈ [-1,1]
recency      = exp(-days_since_last / 30)
```

Event folding (EMA, half-life=60 days):
```
factor          = exp(-0.693 × Δdays / 60)
new_cumulative  = cumulative_outcome × factor + outcome × exposure_weight
new_weighted    = weighted_count × factor + exposure_weight
```

### 5.3 Strength Scoring (`ml/mindcraft_graph/engine/features.py`)

```python
investment = avg_effort × (avg_time / 30.0)

if avg_outcome >= 0:   # Positive → efficiency (talent signal)
    strength = avg_outcome / investment

else:                  # Negative → conviction (confirmed weakness)
    strength = avg_outcome × investment
```

Division is rejected for negatives — avoids amplifying casual low-effort failures.

### 5.4 Temporal Decay (`ml/mindcraft_graph/engine/decay.py`)

**Mastery** (half-life 60d): `W_eff` shrinkage; fades toward `σ(-2.0) ≈ 0.12`

**Edge** (half-life 90d):
```
factor         = exp(-0.693 × days / 90)
alpha_evidence = alpha - alpha_prior
new_alpha      = alpha_prior + alpha_evidence × factor   (min 0.1)
new_beta       = beta_prior  + beta_evidence  × factor   (min 0.1)
```

### 5.5 Student Embeddings (`ml/mindcraft_graph/representation/student_embeddings.py`)

```
s_mastery    = normalize(Σ mastery_i  × embedding_i)   # where studying
s_strength   = normalize(Σ strength_i × embedding_i)   # where performing well
displacement = s_strength - s_mastery                   # learning efficiency vector
```

**PCA axes** (4 components, ~33% variance):
- PC1: applied/geometric ↔ algebraic/symbolic
- PC2: probabilistic/functional ↔ trigonometric/spatial
- PC3: calculus ↔ statistical
- PC4: analytic ↔ linear-algebraic

### 5.6 Pathfinder Three-State Classification (`ml/mindcraft_graph/planning/pathfinder.py`)

| State | Condition | Action |
|-------|-----------|--------|
| MASTERED | `strength_score >= 0` with evidence, OR `mastery > 0.4` | Remove from path |
| STRUGGLING | `strength_score < 0` with evidence | ALWAYS keep — never overridable |
| UNKNOWN | No evidence | Presume mastered only if chain successor is mastered |

Exam mode re-rank: `priority = W_freq × exam_frequency + W_struggle × (1 - mastery)`

---

## 6. Error Paths & Fallbacks

| Failure | Fallback |
|---------|----------|
| ML Cloud Run cold/down | Health ping on auth mitigates; null returns; UI degrades gracefully |
| `homework` service DOWN (current) | Gemini solver → ingredient pipeline |
| Anthropic credits exhausted (current) | `generate-summary.ts` throws 500; tutor sees error; no ML update |
| Fireflies session no-match | Orphan in `transcripts/{meetingId}` |
| `isDiagnosticComplete` Firestore error | Returns false → student routed to diagnostic (safe) |
| Dynamic question gen fails | Static 495-question `app/src/lib/questionBank.ts` |
| Cross-device draft sync fails | Local `localStorage` copy used |

---

## 7. Agent Layer Hook Points (n8n)

| # | Where | Trigger | Data Available | Suggested Action |
|---|-------|---------|----------------|-----------------|
| 1 | Post-Login | `users/{uid}` `onCreate` | uid, role, email | Welcome email; tutor matching |
| 2 | Post-Confidence | `learning_events` `onCreate` where `eventType=="confidence_report"` | conceptId, confidence 0.15–0.95 | Pre-generate practice queue |
| 3 | Gap Scan Done | `users/{uid}` `onUpdate` where `diagnosticCompleted` → true | Full confidenceMap, exam, uid | "Path ready" email; warm `/recommend` cache; analytics |
| 4 | Practice Session | `knowledge_graphs/{uid}` `onWrite` | Updated mastery per concept | Milestone alerts; update tutor session agenda |
| 5 | Ingredient Answer | `ingredient_states/{uid}` `onWrite` | target, succeeded, styleScores | Style-adaptive follow-up; bridge weakness detection |
| 6 | Summary Published | `sessions/{id}` `onUpdate` → `summaryStatus=="published"` | Full summaryCard, studentId | Email/SMS recap; CRM update |
| 7 | Displacement Alert | `students/{uid}/metrics` `onCreate` | magnitude, direction, timestamp | Alert tutor when magnitude increases 3+ sessions (studying without improving) |
| 8 | Bridge Gap | `recommendations/{uid}` `onWrite` where `isBridgeGap:true` | bridgeId, from/toConcept | Flag to tutor; suggest bridge drill |
| 9 | Question Gen | Before/after `generateQuestions()` in Practice.tsx | conceptId, level, examType | Replace with past-paper embedding pipeline |
| 10 | Orphan Transcript | `transcripts` `onCreate` | meetingId, date, fullText | Alert team; retry matching by attendee email |

---

## 8. Critical Findings (Fix Before Agent Work)

### 1. `/learning-event` endpoint probably missing
`app/src/lib/mlApi.ts:sendLearningEvent()` POSTs to `/learning-event` but no `@app.post("/learning-event")` is visible in `ml/serve.py`. Diagnostic confidence + probe events from `Diagnostic.tsx` may be silently failing with 404s. Audit `ml/serve.py` and add the endpoint if missing.

### 2. Two diagnostic flows write different Firestore fields
`Diagnostic.tsx` writes `diagnosticCompletedAt` (ISO string). Practice gap-scan writes `diagnosticCompleted` (boolean). `isDiagnosticComplete()` in `app/src/lib/practiceState.ts` correctly accepts either. But any n8n trigger watching only one field will miss half the population — watch for EITHER field changing.

### 3. `students/{uid}/metrics` is populated but never read by UI
Displacement time series accumulates on every `/recommend` call but nothing in the frontend renders it. Hook #7 above is the natural first consumer.

### 4. Undeployed ML commits
Displacement persistence, bridge-gap detection, and full auth layer are in code but rev `00009` is live. Any agent relying on `isBridgeGap`, `bridgeEvidence`, or the metrics subcollection needs a Cloud Build + deploy first.
See `CLAUDE.md` → Deployment for the exact build command.

---

*To update this document after a codebase change, tell Claude: "Update ARCHITECTURE.md to reflect [what changed]."*
