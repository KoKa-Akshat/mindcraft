/**
 * POST /api/generate-session-report
 *
 * The other half of the 2026-08-21 ZPD/session-telemetry design: sim
 * engagement is now real (log-sim-interaction.ts), the mastery engine
 * already computes a ZPD-like weak-concept band (`/recommend`'s
 * topWeaknesses), and this is the piece that reads both plus the session's
 * own transcript and writes a short, honest, parent/teacher-readable
 * report — the "feedback report at the end of every session" from that
 * conversation.
 *
 * Called from JesseCallSession's workDashboard call-end path (fire-and-
 * forget; the student doesn't need to see this immediately, a parent/
 * teacher-facing surface is future work). Gemini, not Anthropic — same
 * choice agent-check-in.ts already made for "structured synthesis from raw
 * session signal," and keeps this off the Anthropic generation budget
 * entirely (a genuinely separate concern from sim/book generation spend).
 *
 * Deliberately conservative about honesty: the prompt is told never to
 * invent detail beyond the real transcript/sim data, and to say plainly
 * when the signal is too thin for a specific claim, rather than padding a
 * report that sounds substantive but isn't grounded in anything real.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })
const DEFAULT_ML_BASE = process.env.ML_API_URL ?? process.env.ML_URL ?? 'https://joinmindcraft-mindcraft-ml.hf.space'

// A generous, imprecise window rather than an exact session boundary (the
// call and BookReaderView are separate presentation surfaces with no
// shared session id to join on today) - accepted imprecision: a student
// reading a second, unrelated book within the same 3 hours would have that
// engagement folded in too. Documented, not silently wrong.
const LOOKBACK_HOURS = 3
const MAX_TRANSCRIPT_CHARS = 6000

interface TranscriptTurn {
  speaker?: unknown
  text?: unknown
}

async function fetchRecentSimEvents(uid: string): Promise<Array<Record<string, unknown>>> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  try {
    const snap = await db
      .collection('sim_interactions')
      .doc(uid)
      .collection('events')
      .where('loggedAt', '>=', since)
      .orderBy('loggedAt', 'desc')
      .limit(20)
      .get()
    const out: Array<Record<string, unknown>> = []
    for (const doc of snap.docs) {
      const events = doc.data().events
      if (Array.isArray(events)) out.push(...events)
    }
    return out
  } catch (e) {
    console.error('generate-session-report: sim_interactions query failed', e)
    return []
  }
}

/** Best-effort — the ZPD band the mastery engine already computes. Wrapped
 * so any /recommend shape mismatch or outage degrades to "no weakness data"
 * rather than failing the whole report; this is enrichment, not the core
 * signal (transcript + sim engagement are real regardless). */
async function fetchTopWeaknesses(uid: string): Promise<string[]> {
  const key = process.env.ML_SERVICE_SECRET
  if (!key) return []
  try {
    const mlRes = await fetch(`${DEFAULT_ML_BASE}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': key },
      body: JSON.stringify({ student_id: uid, mode: 'explore' }),
    })
    if (!mlRes.ok) return []
    const data = (await mlRes.json().catch(() => ({}))) as {
      studentProfile?: { topWeaknesses?: unknown[] }
    }
    const weak = data.studentProfile?.topWeaknesses
    return Array.isArray(weak) ? weak.slice(0, 5).map((w) => String(w)) : []
  } catch {
    return []
  }
}

function buildPrompt(transcriptSummary: string, simSummary: string, weaknesses: string[]): string {
  return `You are writing a brief, warm, factual summary of a student's AI tutoring session, for their parent or teacher to read in about 20 seconds.

TRANSCRIPT (what the student and Jesse, the AI tutor, actually said):
${transcriptSummary || '(no transcript text available)'}

SIMULATION ENGAGEMENT (real, on-device signal - how long and how actively the student engaged with each interactive simulation shown during this session):
${simSummary}

KNOWN WEAK CONCEPTS (from the student's ongoing mastery tracking, independent of this specific session - may be empty):
${weaknesses.length ? weaknesses.join(', ') : 'none on record'}

Write 3-5 sentences. Cover: what topic was actually studied (from the transcript), whether the student seemed genuinely engaged (base this ONLY on the real transcript and simulation data above - number of interactions and time spent are real signal, a student who touched a sim 0 times was NOT actively engaged with it, regardless of how long the page was open), and if any weak concepts are listed AND relevant to this session's topic, one concrete, actionable suggestion. Never invent a detail that isn't supported by the data above. If the available signal is too thin to say something specific and true (e.g. an extremely short session, or one with no real interaction), say that plainly rather than padding the report with generic praise.`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { transcript?: TranscriptTurn[]; context?: unknown }
  const rawTurns = Array.isArray(body.transcript) ? body.transcript.slice(0, 200) : []
  const transcriptSummary = rawTurns
    .filter((t): t is { speaker: string; text: string } => typeof t.text === 'string' && t.text.trim().length > 0)
    .map((t) => `${t.speaker === 'student' ? 'Student' : 'Jesse'}: ${t.text.trim()}`)
    .join('\n')
    .slice(0, MAX_TRANSCRIPT_CHARS)

  if (!transcriptSummary) {
    return res.status(200).json({ status: 'skipped', reason: 'empty transcript' })
  }

  const [simEvents, weaknesses] = await Promise.all([fetchRecentSimEvents(uid), fetchTopWeaknesses(uid)])
  const simSummary = simEvents.length
    ? simEvents
        .map((e) => {
          const label = typeof e.simTitle === 'string' && e.simTitle ? e.simTitle : String(e.conceptId ?? 'a simulation')
          const seconds = Math.round((typeof e.dwellMs === 'number' ? e.dwellMs : 0) / 1000)
          const touches = typeof e.touchCount === 'number' ? e.touchCount : 0
          return `- ${label}: open ${seconds}s, ${touches} real touch interaction(s)`
        })
        .join('\n')
    : 'No simulations were opened during this window.'

  try {
    const msg = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: buildPrompt(transcriptSummary, simSummary, weaknesses) }] }],
      config: { maxOutputTokens: 400 },
    })
    const report = (msg.text ?? '').trim()
    if (!report) return res.status(200).json({ status: 'skipped', reason: 'empty model output' })

    await db
      .collection('session_reports')
      .doc(uid)
      .collection('reports')
      .add({
        report,
        context: typeof body.context === 'string' ? body.context : null,
        simEventCount: simEvents.length,
        topWeaknesses: weaknesses,
        createdAt: new Date().toISOString(),
      })

    return res.status(200).json({ status: 'ok', report })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'report generation failed' })
  }
}
