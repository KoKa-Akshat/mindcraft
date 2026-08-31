/**
 * lib/conceptLibrary.ts
 *
 * Client access to the migrated production content library: 4118 concepts
 * across 13 subjects, 3746 written lessons, 722 concepts with a real built
 * interactive sim, 7330 prerequisite/cross-subject edges. Migrated into
 * Firestore by webhook/scripts/migrate-concept-library.ts on 2026-08-30.
 *
 * Two different transports on purpose:
 *
 *   - Semantic search and auto-simplify go to the webhook, because they need
 *     a server (a local embedding model, and a Groq key that must never reach
 *     a browser). Both carry the signed-in user's real Firebase ID token.
 *   - Concept CONTENT is read straight from Firestore by the authenticated
 *     client, gated by firestore.rules. It is read-only reference content with
 *     nothing student-specific in it, it matches how `classrooms`/`articles`
 *     are already served here, and it saves a serverless round trip per step
 *     of a guided path, which is the exact path a student is walking while
 *     they wait.
 *
 * Everything here fails honestly: no function invents a result, and each one
 * surfaces WHY it could not answer so the UI can say so instead of showing a
 * spinner forever or, worse, quietly showing something weaker as if it were
 * the real thing.
 */
import { doc, getDoc, getDocs, setDoc, collection, query as fsQuery, where } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { WEBHOOK_BASE } from './mlApi'
import { embedQuery } from './queryEmbedder'

export const CONCEPT_LIBRARY = 'conceptLibrary'
export const CONCEPT_LIBRARY_SIMS = 'conceptLibrarySims'
export const CONCEPT_STUDY_LOG = 'conceptStudyLog'

export interface ConceptMatch {
  conceptId: string
  label: string
  subject: string
  subjectTitle: string
  level: string
  hasLesson: boolean
  hasSim: boolean
  score: number
}

export interface PathStep {
  conceptId: string
  label: string
  hasLesson: boolean
  hasSim: boolean
  level?: string
  subject?: string
}

export interface ResolveResult {
  query: string
  matches: ConceptMatch[]
  path: PathStep[]
  indexedConcepts: number
  indexBuiltAt: string
  model: string
  coldStart: boolean
  timingsMs: { load: number; embed: number; score: number; total: number }
}

export interface ConceptChapter {
  title: string
  summary: string
  body: string
  source?: string
}

export interface ConceptSim {
  simId: string
  title: string
  sourceRepo?: string
  html: string
}

export interface ConceptContent {
  conceptId: string
  label: string
  subject: string
  subjectTitle: string
  level: string
  chapter: ConceptChapter | null
  sim: ConceptSim | null
  prereqs: string[]
  unlocks: string[]
  crossSubject: string[]
}

export interface SimplifyVerdict {
  verified: boolean
  reason?: string
  simplifiedBody?: string
  reductionPct?: number
  cached?: boolean
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) return null
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

/**
 * Free text -> the best-matching concepts in the whole library, plus the
 * prerequisite ramp to the top one.
 *
 * Two steps, and the split is deliberate (see lib/queryEmbedder.ts for the
 * full reasoning): the query is embedded HERE in the browser with the same
 * model the corpus was embedded with, then only the 384-float vector is
 * posted. The server holds the index and does the scoring, but hosts no
 * model, which keeps a ~400 MB ML runtime out of the shared serverless
 * function and keeps a ~9s cold start off nearly every search.
 *
 * Throws with a readable message rather than returning an empty match list on
 * failure: "nothing in the library matches this" and "search is down" are
 * completely different statements and must never look the same to a student.
 */
export async function resolveConcept(
  text: string,
  topK = 5,
  onEmbedProgress?: (pct: number) => void,
): Promise<ResolveResult> {
  const headers = await authHeaders()
  if (!headers) throw new Error('You need to be signed in to search.')

  let vector: number[]
  try {
    vector = await embedQuery(text, onEmbedProgress)
  } catch (e) {
    throw new Error(`Could not prepare the search (the on-device search model failed to load): ${String(e).slice(0, 140)}`)
  }

  const res = await fetch(`${WEBHOOK_BASE}/api/concept-resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, vector, topK }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Search failed (${res.status}).`)
  return data as ResolveResult
}

// ── Session-scope memo for read-only reference content ─────────────────────
// The library is reference data that only changes when the migration script
// re-runs, so within one tab session a concept read twice is the same
// answer twice. Walking a guided path back and forth re-requests the same
// chapters and neighbour labels otherwise (goToStep resets per-concept state,
// so Learn re-fetches every revisited step). Bounded FIFO so a long session
// cannot hoard sim HTML: ~40 concepts x ~20 KB worst case is well under 1 MB.
const contentCache = new Map<string, ConceptContent>()
const CONTENT_CACHE_MAX = 40
const labelCache = new Map<string, { label: string; subjectTitle: string; level: string; hasLesson: boolean; hasSim: boolean }>()
const LABEL_CACHE_MAX = 500

function cachePut<V>(cache: Map<string, V>, max: number, key: string, value: V): void {
  if (cache.size >= max) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

/**
 * One concept's real lesson and sim, read directly from Firestore.
 * The sim document is only fetched when the concept doc says one exists, so a
 * concept with no sim costs exactly one read, not two. Memoized per session
 * (see contentCache above); a missing document is deliberately NOT memoized,
 * so a mid-session migration that fills a gap is picked up on the next try.
 */
export async function fetchConceptContent(conceptId: string): Promise<ConceptContent | null> {
  const cached = contentCache.get(conceptId)
  if (cached) return cached
  const snap = await getDoc(doc(db, CONCEPT_LIBRARY, conceptId))
  if (!snap.exists()) return null
  const d = snap.data() as Record<string, unknown>
  const lesson = (d.lesson ?? null) as ConceptChapter | null

  let sim: ConceptSim | null = null
  if (d.hasSim === true) {
    const simSnap = await getDoc(doc(db, CONCEPT_LIBRARY_SIMS, conceptId))
    if (simSnap.exists()) {
      const sd = simSnap.data() as Record<string, unknown>
      if (typeof sd.html === 'string' && sd.html) {
        sim = {
          simId: String(sd.simId ?? conceptId),
          title: String(sd.title ?? 'Simulation'),
          sourceRepo: sd.sourceRepo ? String(sd.sourceRepo) : undefined,
          html: sd.html,
        }
      }
    }
  }

  const content: ConceptContent = {
    conceptId,
    label: String(d.name ?? conceptId),
    subject: String(d.subject ?? ''),
    subjectTitle: String(d.subjectTitle ?? d.subject ?? ''),
    level: String(d.level ?? 'core'),
    chapter: lesson && (lesson.body || lesson.summary) ? lesson : null,
    sim,
    prereqs: Array.isArray(d.prereqs) ? (d.prereqs as string[]) : [],
    unlocks: Array.isArray(d.unlocks) ? (d.unlocks as string[]) : [],
    crossSubject: Array.isArray(d.crossSubject) ? (d.crossSubject as string[]) : [],
  }
  cachePut(contentCache, CONTENT_CACHE_MAX, conceptId, content)
  return content
}

/** Display labels for a set of concept ids, for the related-concepts list.
 * Reads only the ids it was given, one document each; the caller is expected
 * to keep that list short. Labels already seen this session come from the
 * memo instead of another read: stepping along a guided path re-requests
 * mostly the same neighbours every step. */
export async function fetchConceptLabels(
  ids: string[],
): Promise<Map<string, { label: string; subjectTitle: string; level: string; hasLesson: boolean; hasSim: boolean }>> {
  const out = new Map<string, { label: string; subjectTitle: string; level: string; hasLesson: boolean; hasSim: boolean }>()
  const missing: string[] = []
  for (const id of ids) {
    const hit = labelCache.get(id)
    if (hit) out.set(id, hit)
    else missing.push(id)
  }
  const snaps = await Promise.all(missing.map((id) => getDoc(doc(db, CONCEPT_LIBRARY, id)).catch(() => null)))
  snaps.forEach((s, i) => {
    if (!s || !s.exists()) return
    const d = s.data() as Record<string, unknown>
    const meta = {
      label: String(d.name ?? missing[i]),
      subjectTitle: String(d.subjectTitle ?? d.subject ?? ''),
      level: String(d.level ?? 'core'),
      hasLesson: d.hasLesson === true,
      hasSim: d.hasSim === true,
    }
    cachePut(labelCache, LABEL_CACHE_MAX, missing[i], meta)
    out.set(missing[i], meta)
  })
  return out
}

/**
 * Shorter, plainer reading of a chapter, pitched at how the student asked, and
 * only returned when a second independent model confirms nothing was lost.
 * Never throws for a rejected rewrite: an unverified verdict IS the answer, and
 * the caller is expected to show the original chapter with the stated reason.
 */
export async function simplifyChapter(
  chapterBody: string,
  query: string,
  conceptId: string,
): Promise<SimplifyVerdict> {
  const headers = await authHeaders()
  if (!headers) return { verified: false, reason: 'not signed in' }
  try {
    const res = await fetch(`${WEBHOOK_BASE}/api/simplify-chapter`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chapterBody, query, conceptId }),
    })
    const data = await res.json().catch(() => ({}))
    if (typeof data?.verified === 'boolean') return data as SimplifyVerdict
    return { verified: false, reason: data?.error || `simplify failed (${res.status})` }
  } catch (e) {
    return { verified: false, reason: `simplify unreachable: ${String(e).slice(0, 120)}` }
  }
}

/**
 * generate-questions.ts validates conceptId against /^[a-z0-9_-]{1,80}$/i and
 * rejects anything else, so a library id like "biology::mitosis" would be a
 * 400. Mapping it here (rather than loosening the live endpoint's input
 * validation) keeps a working production endpoint untouched. The endpoint
 * derives its display label from this slug, so "biology_mitosis" reads back as
 * "Biology Mitosis", which is honest rather than wrong.
 */
export function questionSlug(conceptId: string): string {
  return conceptId.replace(/::/g, '_').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)
}

export interface CheckQuestion {
  id: string
  conceptId: string
  level: 1 | 2 | 3
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  hints: string[]
}

/** One check question from the REAL live question generator. Budget-gated
 * server-side; a 429 comes back as a readable reason, not a crash. */
export async function fetchCheckQuestion(
  conceptId: string,
): Promise<{ question: CheckQuestion | null; reason?: string; cached?: boolean }> {
  const headers = await authHeaders()
  if (!headers) return { question: null, reason: 'not signed in' }
  try {
    const res = await fetch(`${WEBHOOK_BASE}/api/generate-questions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conceptId: questionSlug(conceptId), level: 1, count: 1, examType: 'General' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { question: null, reason: data?.error || `question generation failed (${res.status})` }
    const q = Array.isArray(data?.questions) ? data.questions[0] : null
    if (!q) return { question: null, reason: 'the generator returned no usable question' }
    return {
      question: { ...q, conceptId, hints: Array.isArray(q.hints) ? q.hints : [] } as CheckQuestion,
      cached: data?.cached === true,
    }
  } catch (e) {
    return { question: null, reason: `question service unreachable: ${String(e).slice(0, 120)}` }
  }
}

export interface GeneratedSim {
  title: string
  description?: string
  html: string
  rubricPercentage?: number | null
  qualityGateScore?: number | null
  cached: boolean
}

/**
 * A live-generated MicroSim from the REAL /api/generate-sim pipeline
 * (fit-check -> generate -> headless render -> structural rubric -> vision
 * gate). Genuinely async and genuinely expensive, so this starts a job and
 * polls it, and every non-passing terminal state comes back as an honest
 * reason string rather than being retried into a spinner that never ends.
 *
 * onStatus lets the caller narrate the wait truthfully instead of guessing.
 */
export async function generateSim(
  topic: string,
  opts: { pollMs?: number; maxWaitMs?: number; onStatus?: (s: string) => void } = {},
): Promise<{ sim: GeneratedSim | null; reason?: string }> {
  const headers = await authHeaders()
  if (!headers) return { sim: null, reason: 'not signed in' }
  const pollMs = opts.pollMs ?? 4000
  const maxWaitMs = opts.maxWaitMs ?? 150_000

  let jobId = ''
  try {
    const res = await fetch(`${WEBHOOK_BASE}/api/generate-sim`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic }),
    })
    const data = await res.json().catch(() => ({}))
    if (data?.status === 'passed' && data?.result?.html) {
      return { sim: { ...data.result, cached: data.cached === true } }
    }
    if (data?.status === 'running' && data?.jobId) {
      jobId = String(data.jobId)
    } else {
      return { sim: null, reason: data?.reason || data?.error || `generation could not start (${res.status})` }
    }
  } catch (e) {
    return { sim: null, reason: `generation service unreachable: ${String(e).slice(0, 140)}` }
  }

  const started = Date.now()
  while (Date.now() - started < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollMs))
    opts.onStatus?.(`Still generating and reviewing (${Math.round((Date.now() - started) / 1000)}s)...`)
    try {
      const res = await fetch(`${WEBHOOK_BASE}/api/generate-sim`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.status === 'running') continue
      if (data?.status === 'passed' && data?.result?.html) {
        return { sim: { ...data.result, cached: data.cached === true } }
      }
      if (data?.status === 'no_good_result') {
        return { sim: null, reason: data?.reason || 'The generated sim did not pass the quality gate, so it is not being shown.' }
      }
      return { sim: null, reason: data?.detail || data?.reason || 'Generation ended without a usable result.' }
    } catch (e) {
      return { sim: null, reason: `lost contact with the generation service: ${String(e).slice(0, 140)}` }
    }
  }
  return { sim: null, reason: 'Generation is taking longer than expected, so it was not shown. Nothing was lost, it can be retried.' }
}

// ── Per-student study log ──────────────────────────────────────────────────
// "Studied" means the student actually ANSWERED that concept's check question,
// right or wrong. Deliberately not triggered by a chapter being on screen:
// glancing at a step while walking a guided path is not studying it. Persisted
// per student in Firestore now that there is a real backend, so the history
// follows them across devices instead of dying with a browser profile.

export interface StudyRecord {
  conceptId: string
  firstCompletedAt: number
  lastCompletedAt: number
  completions: number
  lastCorrect: boolean
}

function studyDocId(uid: string, conceptId: string) {
  return `${uid}__${conceptId}`
}

export async function loadStudyLog(uid: string): Promise<Record<string, StudyRecord>> {
  const out: Record<string, StudyRecord> = {}
  if (!uid) return out
  try {
    const snap = await getDocs(fsQuery(collection(db, CONCEPT_STUDY_LOG), where('studentId', '==', uid)))
    snap.forEach((d) => {
      const v = d.data() as Record<string, unknown>
      const conceptId = String(v.conceptId ?? '')
      if (!conceptId) return
      out[conceptId] = {
        conceptId,
        firstCompletedAt: Number(v.firstCompletedAt ?? 0),
        lastCompletedAt: Number(v.lastCompletedAt ?? 0),
        completions: Number(v.completions ?? 1),
        lastCorrect: v.lastCorrect === true,
      }
    })
  } catch {
    // A study history that cannot be read must never block the lesson itself.
  }
  return out
}

export async function recordStudied(
  uid: string,
  conceptId: string,
  correct: boolean,
  existing?: StudyRecord,
): Promise<StudyRecord> {
  const now = Date.now()
  const record: StudyRecord = {
    conceptId,
    firstCompletedAt: existing?.firstCompletedAt ?? now,
    lastCompletedAt: now,
    completions: (existing?.completions ?? 0) + 1,
    lastCorrect: correct,
  }
  try {
    // set() with merge is the idempotency: re-answering the same concept
    // updates one document instead of accumulating duplicates.
    await setDoc(
      doc(db, CONCEPT_STUDY_LOG, studyDocId(uid, conceptId)),
      { studentId: uid, ...record },
      { merge: true },
    )
  } catch {
    // Storage failure leaves this session's in-memory copy driving the UI,
    // same tolerance the prototype had for a blocked localStorage.
  }
  return record
}
