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

  try {
    const { sessionId, tutorNotes } = req.body
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

    const sessionSnap = await db.collection('sessions').doc(sessionId).get()
    if (!sessionSnap.exists) return res.status(404).json({ error: 'Session not found' })

    const session = sessionSnap.data()!
    const transcriptText = session.transcript?.fullText ?? ''
    const notes = tutorNotes || session.tutorNotes || ''

    // Build prompt from whatever we have — never block generation
    const prompt = `You are a helpful tutor assistant for MindCraft, an online tutoring platform.
Generate a concise, encouraging session summary card for the student based on what is available below.

Subject: ${session.subject || 'Tutoring Session'}
Student: ${session.studentName || 'Student'}
Date: ${session.date || ''}
Duration: ${session.duration || ''}
${transcriptText ? `\nSESSION TRANSCRIPT:\n${transcriptText.slice(0, 6000)}\n` : ''}
${notes ? `\nTUTOR'S NOTES:\n${notes}\n` : ''}
${!transcriptText && !notes ? '\n(No transcript or notes yet — generate a general placeholder summary based on the session details above)\n' : ''}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "title": "Brief descriptive session title (max 8 words)",
  "topics": ["topic 1", "topic 2", "topic 3"],
  "homework": ["homework item 1", "homework item 2"],
  "progress": "One sentence about student progress this session",
  "tutorNote": "Warm 2-3 sentence personal note from tutor to student"
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
      return res.status(500).json({ error: 'Failed to parse AI response', raw: text.slice(0, 200) })
    }

    // Save draft to session doc
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
