/**
 * api/generate-summary.ts
 *
 * Generates an AI session summary card for a given session.
 * Called by the tutor from the SessionDetail page after a session completes.
 *
 * Uses Claude Haiku to produce a structured JSON summary from:
 *   - Fireflies transcript (if available)
 *   - Tutor notes (if provided)
 *   - Session metadata (always available as fallback)
 *
 * Saves the summary as a draft to Firestore. Tutor reviews and publishes separately.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    // fileText: optional plain-text content of an attached file, read client-side
    // It is used here and then discarded — never stored in Firebase Storage
    const { sessionId, tutorNotes, fileText } = req.body
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

    const sessionSnap = await db.collection('sessions').doc(sessionId).get()
    if (!sessionSnap.exists) return res.status(404).json({ error: 'Session not found' })

    const session    = sessionSnap.data()!
    const transcript = session.transcript?.fullText ?? ''
    const notes      = [tutorNotes || session.tutorNotes || '', fileText || ''].filter(Boolean).join('\n\n')

    // Always generate — fall back to session metadata if transcript/notes aren't available yet
    const prompt = `You are a helpful tutor assistant for MindCraft, an online tutoring platform.
Generate a concise, encouraging session summary card for the student based on what is available below.

Subject: ${session.subject || 'Tutoring Session'}
Student: ${session.studentName || 'Student'}
Date: ${session.date || ''}
Duration: ${session.duration || ''}
${transcript ? `\nSESSION TRANSCRIPT:\n${transcript.slice(0, 6000)}\n` : ''}
${notes      ? `\nTUTOR NOTES & ATTACHMENTS:\n${notes.slice(0, 3000)}\n` : ''}
${!transcript && !notes ? '\n(No transcript or notes yet — write a warm placeholder based on session details above)\n' : ''}

Return ONLY valid JSON (no markdown, no extra text) with this exact shape:
{
  "title":    "Brief session title (max 8 words)",
  "topics":   ["topic 1", "topic 2", "topic 3"],
  "homework": ["item 1", "item 2"],
  "progress": "One sentence about student progress this session",
  "tutorNote":"Warm 2-3 sentence personal note from tutor to student"
}`

    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text.trim() : ''

    // Extract JSON block from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'AI did not return valid JSON', raw: raw.slice(0, 200) })
    }
    const summaryCard = JSON.parse(jsonMatch[0])

    // Save as draft — tutor publishes to student in a separate step
    await sessionSnap.ref.update({
      summaryCard,
      summaryStatus: 'draft',
      tutorNotes: notes || null,
    })

    return res.status(200).json({ ok: true, summaryCard })
  } catch (err: any) {
    console.error('generate-summary error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
