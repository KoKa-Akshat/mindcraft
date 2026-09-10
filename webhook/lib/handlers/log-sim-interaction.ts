/**
 * POST /api/log-sim-interaction
 *
 * Real, on-device sim engagement telemetry (2026-08-21) — dwell time +
 * touch count per sim page visit, sent by `SimInteractionClient.swift`
 * when a student closes `BookReaderView`. This is step one of the
 * ZPD/session-feedback-report design discussed the same night: before any
 * report can say something true about how a student engaged with a
 * simulation, that engagement has to actually be recorded somewhere — until
 * this endpoint, it was measured nowhere at all (confirmed by reading
 * MicroSimWebView.swift: the sim WKWebView had zero interaction hooks).
 *
 * Deliberately NOT written into the ml service's mastery graph
 * (`/record-outcomes`) yet — dwell/touch isn't a pass/fail outcome, and
 * guessing a numeric mapping into that calibrated Beta-Binomial model risks
 * quietly corrupting it (see JesseCallSession-adjacent design notes). This
 * writes its own honest, narrow record; a session-report generator reads
 * these directly. Wiring this into mastery scoring is a separate, real
 * modeling decision for later, not assumed here.
 *
 * Storage: `sim_interactions/{uid}/events/{autoId}`, one doc per batch
 * (not per record) — a single BookReaderView close is one real "here's what
 * happened in that reading session" unit, and keeping the batch together
 * lets a report generator reconstruct "which sims were viewed together"
 * without re-deriving it from timestamps.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'

const MAX_EVENTS_PER_BATCH = 50

interface RawEvent {
  subjectId?: unknown
  conceptId?: unknown
  simTitle?: unknown
  dwellMs?: unknown
  touchCount?: unknown
}

function sanitizeEvent(raw: RawEvent): Record<string, unknown> | null {
  const subjectId = typeof raw.subjectId === 'string' ? raw.subjectId.slice(0, 200) : null
  const conceptId = typeof raw.conceptId === 'string' ? raw.conceptId.slice(0, 200) : null
  if (!subjectId || !conceptId) return null
  const dwellMs = typeof raw.dwellMs === 'number' && raw.dwellMs >= 0 ? Math.min(raw.dwellMs, 3_600_000) : 0
  const touchCount = typeof raw.touchCount === 'number' && raw.touchCount >= 0 ? Math.min(Math.floor(raw.touchCount), 10_000) : 0
  if (dwellMs === 0 && touchCount === 0) return null
  return {
    subjectId,
    conceptId,
    simTitle: typeof raw.simTitle === 'string' ? raw.simTitle.slice(0, 200) : null,
    dwellMs,
    touchCount,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { events?: RawEvent[] }
  const rawEvents = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_BATCH) : []
  const events = rawEvents.map(sanitizeEvent).filter((e): e is Record<string, unknown> => e !== null)
  if (events.length === 0) return res.status(200).json({ status: 'ok', stored: 0 })

  try {
    await db.collection('sim_interactions').doc(uid).collection('events').add({
      events,
      loggedAt: new Date().toISOString(),
    })
    return res.status(200).json({ status: 'ok', stored: events.length })
  } catch (e) {
    // Telemetry must never be worth retrying/blocking the client over — log
    // server-side and return 200 anyway; the iOS client is fire-and-forget
    // and won't do anything with an error response regardless.
    console.error('log-sim-interaction: Firestore write failed', e)
    return res.status(200).json({ status: 'error', stored: 0 })
  }
}
