import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import Anthropic from '@anthropic-ai/sdk'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}
const db = getFirestore()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function setCORS(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { sessionId, tutorNotes } = req.body
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

  const sessionSnap = await db.collection('sessions').doc(sessionId).get()
  if (!sessionSnap.exists) return res.status(404).json({ error: 'Session not found' })

  const session = sessionSnap.data()!
  const transcriptText = session.transcript?.fullText ?? ''

  if (!transcriptText && !tutorNotes) {
    return res.status(400).json({ error: 'No transcript or notes to generate from' })
  }

  const prompt = `You are a helpful tutor assistant for MindCraft, an online tutoring platform.
Based on the tutoring session details below, generate a concise, encouraging session summary card for the student.

Subject: ${session.subject || 'General'}
Student: ${session.studentName || 'Student'}
Date: ${session.date || ''}
Duration: ${session.duration || ''}

${transcriptText ? `SESSION TRANSCRIPT:\n${transcriptText.slice(0, 6000)}\n` : ''}
${tutorNotes ? `TUTOR'S NOTES:\n${tutorNotes}\n` : ''}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "title": "Brief descriptive session title (max 8 words)",
  "topics": ["topic covered 1", "topic covered 2", "topic covered 3"],
  "homework": ["homework item 1", "homework item 2"],
  "progress": "One clear sentence about how the student progressed in this session",
  "tutorNote": "A warm 2-3 sentence personal note from tutor to student, encouraging and specific to what was covered"
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  let summaryCard
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found')
    summaryCard = JSON.parse(match[0])
  } catch {
    return res.status(500).json({ error: 'Failed to parse AI response', raw: text })
  }

  // Save draft to session doc
  await sessionSnap.ref.update({
    summaryCard,
    summaryStatus: 'draft',
    tutorNotes: tutorNotes || session.tutorNotes || null,
  })

  return res.status(200).json({ ok: true, summaryCard })
}
