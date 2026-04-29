/**
 * api/generate-summary.ts
 *
 * Generates an AI session summary card using Claude.
 * Handles two flows:
 *
 *  1. TUTOR flow — POST { sessionId, tutorNotes?, fileText? }
 *     Fetches session from Firestore, generates summary, saves as draft.
 *
 *  2. STUDENT flow — POST { tutorNotes, subject, studentName }
 *     Generates summary card from raw notes, returns it without saving.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'

const client = new Anthropic()
const MODEL  = 'claude-sonnet-4-20250514'

const JSON_SHAPE = `{
  "title":    "Brief session title (max 8 words)",
  "topics":   ["topic 1", "topic 2", "topic 3"],
  "homework": ["next step 1", "next step 2"],
  "progress": "One sentence about progress this session",
  "tutorNote":"Warm 2-3 sentence note to the student"
}`

async function callClaude(prompt: string): Promise<string> {
  const message = await client.messages.create({
    model:       MODEL,
    max_tokens:  1024,
    temperature: 0.3,
    messages:    [{ role: 'user', content: prompt }],
  })
  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

function extractJson(raw: string): object {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in response')
  return JSON.parse(match[0])
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST')   return res.status(405).send('Method Not Allowed')

  try {
    const { sessionId, tutorNotes, fileText, subject, studentName } = req.body

    // ── STUDENT FLOW (no sessionId) ──────────────────────────────────────────
    if (!sessionId) {
      if (!tutorNotes) return res.status(400).json({ error: 'Missing notes' })

      const prompt = `You are a helpful study assistant for MindCraft, an online tutoring platform.
A student has uploaded their own notes. Generate a structured summary card to help them review.

Subject: ${subject || 'General'}
Student: ${studentName || 'Student'}

STUDENT NOTES:
${tutorNotes.slice(0, 6000)}

Return ONLY valid JSON (no markdown, no extra text) with this exact shape:
${JSON_SHAPE}`

      const raw = await callClaude(prompt)
      const summaryCard = extractJson(raw)
      return res.status(200).json({ ok: true, summaryCard })
    }

    // ── TUTOR FLOW (sessionId provided) ──────────────────────────────────────
    const sessionSnap = await db.collection('sessions').doc(sessionId).get()
    if (!sessionSnap.exists) return res.status(404).json({ error: 'Session not found' })

    const session    = sessionSnap.data()!
    const transcript = session.transcript?.fullText ?? ''
    const notes      = [tutorNotes || session.tutorNotes || '', fileText || ''].filter(Boolean).join('\n\n')

    const prompt = `You are a helpful tutor assistant for MindCraft, an online tutoring platform.
Generate a concise, encouraging session summary card for the student.

Subject: ${session.subject || 'Tutoring Session'}
Student: ${session.studentName || 'Student'}
Date: ${session.date || ''}
Duration: ${session.duration || ''}
${transcript ? `\nSESSION TRANSCRIPT:\n${transcript.slice(0, 6000)}\n` : ''}
${notes      ? `\nTUTOR NOTES & ATTACHMENTS:\n${notes.slice(0, 3000)}\n` : ''}
${!transcript && !notes ? '\n(No transcript or notes yet — write a warm placeholder based on session details above)\n' : ''}

Return ONLY valid JSON (no markdown, no extra text) with this exact shape:
${JSON_SHAPE}`

    const raw         = await callClaude(prompt)
    const summaryCard = extractJson(raw)

    await sessionSnap.ref.update({
      summaryCard,
      summaryStatus: 'draft',
      tutorNotes:    notes || null,
    })

    // Fire-and-forget: push session data to ML engine to update student mastery
    const mlBase    = process.env.ML_URL
    const studentId = session.studentId
    const { topics, homework, progress } = summaryCard as any
    if (mlBase && studentId && topics?.length) {
      const bullets = [...(homework ?? []), progress].filter(Boolean) as string[]
      fetch(`${mlBase}/process-summary`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          student_id:       studentId,
          bullets,
          topics,
          duration_minutes: parseInt(session.duration) || 45,
        }),
      }).catch(() => {})
    }

    return res.status(200).json({ ok: true, summaryCard })

  } catch (err: any) {
    console.error('generate-summary error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
