/**
 * api/generate-summary.ts
 *
 * Generates an AI session summary card using Gemini.
 * Handles two flows:
 *
 *  1. TUTOR flow — POST { sessionId, tutorNotes?, fileText? }
 *     Fetches session from Firestore, generates summary, saves as draft.
 *
 *  2. STUDENT flow — POST { tutorNotes, subject, studentName }
 *     Generates summary card from raw notes, returns it without saving.
 *     (Student saves to Firestore client-side via OrganizeNotes page.)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

const JSON_SHAPE = `{
  "title":    "Brief session title (max 8 words)",
  "topics":   ["topic 1", "topic 2", "topic 3"],
  "homework": ["next step 1", "next step 2"],
  "progress": "One sentence about progress this session",
  "tutorNote":"Warm 2-3 sentence note to the student"
}`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { sessionId, tutorNotes, fileText, subject, studentName } = req.body

    // ── STUDENT FLOW (no sessionId) ──────────────────────────────────────
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

      const result = await model.generateContent(prompt)
      const raw = result.response.text().trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON', raw: raw.slice(0, 200) })
      const summaryCard = JSON.parse(jsonMatch[0])
      return res.status(200).json({ ok: true, summaryCard })
    }

    // ── TUTOR FLOW (sessionId provided) ─────────────────────────────────
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

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON', raw: raw.slice(0, 200) })
    const summaryCard = JSON.parse(jsonMatch[0])

    await sessionSnap.ref.update({
      summaryCard,
      summaryStatus: 'draft',
      tutorNotes: notes || null,
    })

    // Fire-and-forget: push session data to ML engine to update student mastery
    const mlBase = process.env.ML_URL
    const studentId = session.studentId
    if (mlBase && studentId && summaryCard.topics?.length) {
      const bullets = [
        ...(summaryCard.homework ?? []),
        summaryCard.progress,
      ].filter(Boolean) as string[]
      const durationMinutes = parseInt(session.duration) || 45
      fetch(`${mlBase}/process-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          bullets,
          topics: summaryCard.topics,
          duration_minutes: durationMinutes,
        }),
      }).catch(() => {}) // non-blocking; ML server down shouldn't break summary flow
    }

    return res.status(200).json({ ok: true, summaryCard })
  } catch (err: any) {
    console.error('generate-summary error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
