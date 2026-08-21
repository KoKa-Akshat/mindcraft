/**
 * lib/firefliesMatch.ts
 *
 * Shared Fireflies transcript <-> session matching logic and GraphQL query
 * builders, used by both the live webhook receiver (api/fireflies.ts) and
 * the cron polling fallback (api/cron-fireflies.ts).
 *
 * Session matching strategy (in order):
 *   1. firefliesMeetingId field on session doc (set when bot was invited)
 *   2. video_url from transcript matches session.meetingUrl
 *   3. Time window — session scheduled within ±2 hrs of transcript date
 *
 * If no session is found, callers store the transcript as an orphan in
 * /transcripts for manual review rather than silently dropping it.
 */

import { db } from './firebase'

export const FIREFLIES_API = 'https://api.fireflies.ai/graphql'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

export interface FirefliesTranscript {
  id: string
  title?: string
  date?: string | number
  duration?: number
  video_url?: string
  summary?: { overview?: string; action_items?: string; keywords?: string } | null
  sentences?: Array<{ index: number; speaker_name: string; text: string; start_time: number; end_time: number }>
}

/**
 * Query for a single transcript by id — the live webhook receives one
 * meetingId per event and also wants meeting_attendees (not needed by the
 * cron poll's list query, so kept out of that one).
 */
export function buildTranscriptByIdQuery(): string {
  return `
    query Transcript($id: String!) {
      transcript(id: $id) {
        id title date duration video_url
        meeting_attendees { displayName email }
        summary { overview action_items keywords }
        sentences { index speaker_name text start_time end_time }
      }
    }
  `
}

/**
 * Query for the N most recent transcripts — used by the cron fallback,
 * which polls rather than reacting to a single webhook event.
 */
export function buildRecentTranscriptsQuery(limit: number): string {
  return `
    query {
      transcripts(limit: ${limit}) {
        id title date duration video_url
        summary { overview action_items keywords }
        sentences { index speaker_name text start_time end_time }
      }
    }
  `
}

/** POSTs a query (and optional variables) to the Fireflies GraphQL API and returns the parsed JSON body. */
export async function fetchFirefliesGraphQL(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<any> {
  const res = await fetch(FIREFLIES_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  })
  return res.json()
}

/**
 * Plain, readable transcript text for the AI summary step — falls back to
 * the Fireflies-generated overview if there are no per-sentence records.
 */
export function transcriptFullText(transcript: FirefliesTranscript): string {
  return transcript.sentences?.length
    ? transcript.sentences.map((s) => `[${s.speaker_name}]: ${s.text}`).join('\n')
    : transcript.summary?.overview ?? ''
}

/**
 * 3-strategy session match: firefliesMeetingId -> video_url -> ±2hr time
 * window (closest scheduledAt wins).
 *
 * `meetingDate` controls the third strategy and is left to the caller to
 * compute, since the two callers genuinely differ here: pass null to skip
 * the time-window check entirely (cron-fireflies.ts's behavior when a
 * transcript has no date), or a resolved timestamp to run it
 * (fireflies.ts falls back to Date.now() rather than skipping).
 */
export async function matchSession(
  meetingId: string,
  videoUrl: string | undefined,
  meetingDate: number | null,
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  // 1. Exact match by meeting ID stored when bot was invited
  const byId = await db.collection('sessions').where('firefliesMeetingId', '==', meetingId).limit(1).get()
  if (!byId.empty) return byId.docs[0]

  // 2. Match by the meeting URL Fireflies recorded
  if (videoUrl) {
    const byUrl = await db.collection('sessions').where('meetingUrl', '==', videoUrl).limit(1).get()
    if (!byUrl.empty) return byUrl.docs[0]
  }

  // 3. Match by time window (closest session within ±2 hours of transcript date)
  if (meetingDate != null) {
    const nearby = await db.collection('sessions')
      .where('scheduledAt', '>=', meetingDate - TWO_HOURS_MS)
      .where('scheduledAt', '<=', meetingDate + TWO_HOURS_MS)
      .limit(5).get()

    if (!nearby.empty) {
      return nearby.docs.sort(
        (a, b) => Math.abs(a.data().scheduledAt - meetingDate) - Math.abs(b.data().scheduledAt - meetingDate),
      )[0]
    }
  }

  return null
}

export interface OrphanTranscriptRecord {
  meetingId: string
  title?: string
  date?: string | number
  fullText: string
  summary?: unknown
  sentences?: unknown[]
}

/**
 * Stores an unmatched transcript in /transcripts for manual review rather
 * than dropping it. `merge` lets the cron poll re-run this idempotently
 * across polling cycles without clobbering fields the live webhook (which
 * always does a plain overwrite) may have already written.
 */
export async function storeOrphanTranscript(record: OrphanTranscriptRecord, options?: { merge?: boolean }): Promise<void> {
  const data = {
    meetingId: record.meetingId,
    title: record.title,
    date: record.date,
    fullText: record.fullText,
    summary: record.summary ?? null,
    sentences: record.sentences ?? [],
    linkedSession: null,
    createdAt: new Date().toISOString(),
  }
  if (options?.merge) {
    await db.collection('transcripts').doc(record.meetingId).set(data, { merge: true })
  } else {
    await db.collection('transcripts').doc(record.meetingId).set(data)
  }
}

export interface SessionTranscriptAttachment {
  meetingId: string
  fullText: string
  summary?: unknown
  sentences?: unknown[]
  duration?: number
}

/** Attaches a matched transcript to its session and marks it ready for review. */
export async function attachTranscriptToSession(
  sessionDoc: FirebaseFirestore.DocumentSnapshot,
  attachment: SessionTranscriptAttachment,
): Promise<void> {
  await sessionDoc.ref.update({
    transcript: {
      meetingId: attachment.meetingId,
      fullText: attachment.fullText,
      summary: attachment.summary ?? null,
      sentences: attachment.sentences ?? [],
      duration: attachment.duration,
      processedAt: new Date().toISOString(),
    },
    status: 'completed',
    summaryStatus: 'pending',
  })
}
