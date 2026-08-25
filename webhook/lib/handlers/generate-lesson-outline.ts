/**
 * POST /api/generate-lesson-outline
 *
 * Server-side, platform-funded fallback for "Jesse, teach me about X" when
 * neither the Chapter Library nor the archive has real material for the
 * topic. Real fix, 2026-08-21, for direct live feedback: the client-side
 * fallback (StudentAIKeyStore.generateTableOfContents) required the
 * STUDENT to bring their own personal Anthropic/Groq API key just to use
 * Jesse's core "build me a lesson" feature at all - "the API key should
 * not be a problem, right? I'm sure there's one working API key. Make
 * sure Vercel knows that too." They're right: this is backwards for a
 * product where the platform already pays for generation elsewhere
 * (generate-sim.ts uses the exact same budget-capped pattern this file
 * copies). StudentAIKeyStore itself is untouched and still exists as a
 * genuine bring-your-own-key path for students who want it (homework
 * help, study plans) - this endpoint is specifically for the one flow
 * that's core enough it shouldn't depend on that at all.
 *
 * Same real cost discipline as generate-sim.ts: verified auth, platform
 * monthly budget checked before per-student daily cap, real token-usage
 * cost recorded after the call (not a flat guess).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'
import { checkAndRecordAttempt, checkPlatformBudget, recordActualSpend } from '../generationBudget'
import { studentGeminiComplete } from '../studentGemini'

const client = new Anthropic()
const MODEL = 'claude-haiku-4-5-20251001'

// Approximate published Haiku 4.5 rates (2026) - real usage-based cost, not
// a flat per-call guess, same reasoning generate-sim.ts's own cost tracking
// uses; revisit if Anthropic's posted pricing changes meaningfully.
const INPUT_USD_PER_MTOK = 1.0
const OUTPUT_USD_PER_MTOK = 5.0

const SYSTEM_PROMPT = `You are Jesse, MindCraft's study companion, building a short lesson outline for a student who asked to learn a topic. Never use em dashes. Never say you are an AI.`

interface LessonOutline {
  definition: string
  chapters: string[]
  chapterBodies: string[]
  question: string | null
  matchedConceptId: string | null
}

function buildUserPrompt(topic: string, knownConceptIds: string[], referenceMaterial?: string, grade?: number): string {
  const referenceBlock = referenceMaterial
    ? `\n\nThe student uploaded this material - base the lesson on it, not just your own general knowledge of the topic:\n${referenceMaterial}`
    : ''
  // Real fix, 2026-08-21: this endpoint previously had zero grade/age
  // signal at all - "calculus" for a grade 8 student and a grade 12
  // student produced the identical lesson. `grade` is looked up
  // server-side from the verified student's own users/{uid} doc (same
  // field + collection app/src/pages/ConceptChapterPage.tsx already reads
  // for practice-question personalization) - never client-supplied, so a
  // request can't spoof a grade to get easier/harder content than the
  // student's real profile. Genuinely optional: many students (all iOS
  // students today - no onboarding flow sets this yet) have no grade on
  // file, and the lesson is still exactly as good without one, just not
  // grade-adapted.
  const gradeBlock = typeof grade === 'number'
    ? `\n\nThe student is in grade ${grade}. Pitch the definition, vocabulary, and chapter depth at that level - the same topic name can mean a very different scope and rigor across grades (e.g. "calculus" at grade 8 is usually an enrichment preview of the core idea, at grade 12 it's the full formal treatment). Do not mention their grade explicitly in the lesson.`
    : ''
  return `Topic the student wants to learn: ${topic}${referenceBlock}${gradeBlock}

Known concept ids with a REAL, verified practice question bank today: ${knownConceptIds.join(', ')}

Respond with ONLY this JSON shape, no other text:
{"definition": "...", "chapters": ["...", "..."], "chapterBodies": ["...", "..."], "question": "..." or null, "matchedConceptId": "..." or null}

- definition: one or two plain sentences stating the core idea, no jargon.
- chapters: 4 to 6 short sub-topic titles, in the order a student should learn them.
- chapterBodies: one real paragraph PER chapter, same order and same length as chapters - this is what the student actually reads for that chapter, not a repeat of definition. Teach the sub-topic, don't just describe it.
- question: one concrete practice question testing the FIRST chapter, or null if you cannot write one honestly.
- matchedConceptId: the exact id string from the known list above ONLY if the topic is genuinely that concept - otherwise null. Never invent an id not in that list.`
}

function parseOutline(text: string): LessonOutline | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0])
    if (typeof raw.definition !== 'string' || !Array.isArray(raw.chapters) || !Array.isArray(raw.chapterBodies)) {
      return null
    }
    return {
      definition: raw.definition,
      chapters: raw.chapters.map(String),
      chapterBodies: raw.chapterBodies.map(String),
      question: typeof raw.question === 'string' ? raw.question : null,
      matchedConceptId: typeof raw.matchedConceptId === 'string' ? raw.matchedConceptId : null,
    }
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { topic?: string; knownConceptIds?: string[]; referenceMaterial?: string; grade?: number; studentGeminiKey?: string }
  const studentGeminiKey = typeof body.studentGeminiKey === 'string' ? body.studentGeminiKey.trim() : ''
  const topic = String(body.topic || '').trim().slice(0, 200)
  if (!topic) return res.status(400).json({ error: 'topic required' })
  const knownConceptIds = Array.isArray(body.knownConceptIds) ? body.knownConceptIds.map(String).slice(0, 200) : []
  const referenceMaterial = typeof body.referenceMaterial === 'string' ? body.referenceMaterial.slice(0, 8000) : undefined

  // Grade resolution, two sources with different trust models - this is a
  // personalization signal, not a permission gate, so both are safe to
  // honor: (1) a request-supplied grade (2026-08-21 addition) is what the
  // STUDENT THEMSELVES just said in this exact conversation ("I'm in
  // grade 8") - fresher and more specific than a stored profile, so it
  // takes priority when present; (2) falls back to the durable
  // users/{uid} profile field (same one ConceptChapterPage.tsx already
  // reads for practice-question personalization) for students who didn't
  // state a grade this time but have one on file. Fails open (undefined
  // grade, ungraded lesson) rather than blocking the request if the
  // profile read fails.
  let grade: number | undefined =
    typeof body.grade === 'number' && Number.isInteger(body.grade) && body.grade >= 1 && body.grade <= 12
      ? body.grade
      : undefined
  if (grade === undefined) {
    try {
      const profileSnap = await db.collection('users').doc(uid).get()
      const profileGrade = profileSnap.data()?.grade
      if (typeof profileGrade === 'number') grade = profileGrade
    } catch (e) {
      console.error('generate-lesson-outline: failed to read student profile grade', e)
    }
  }

  // BYOK (2026-08-25): a student key means this call is FREE to the
  // platform (no residual judge/gate stage the way sim/book generation
  // has - this is one plain call), so skip both budget checks AND
  // recordActualSpend entirely rather than the partial bypass those
  // handlers use. This doesn't reverse the 2026-08-21 fix in this file's
  // own header (a keyless student still gets the exact same
  // platform-funded fallback, unconditionally, below) - it's the same
  // "prefer the student's key, fall back to the platform's" pattern
  // GeneratedSimClient/BookGenerationClient already use.
  if (!studentGeminiKey) {
    const platformBudget = await checkPlatformBudget()
    if (!platformBudget.allowed) {
      return res.status(429).json({
        status: 'rate_limited',
        reason: `This closed test's monthly generation budget is used up ($${platformBudget.spentThisMonthUsd.toFixed(2)}/$${platformBudget.capUsd}). It resets next month.`,
      })
    }
    const studentBudget = await checkAndRecordAttempt(uid)
    if (!studentBudget.allowed) {
      return res.status(429).json({
        status: 'rate_limited',
        reason: `Daily generation limit reached (${studentBudget.attemptsToday}/${studentBudget.cap}).`,
      })
    }
  }

  try {
    let text: string
    if (studentGeminiKey) {
      text = await studentGeminiComplete(
        studentGeminiKey,
        `${SYSTEM_PROMPT}\n\n${buildUserPrompt(topic, knownConceptIds, referenceMaterial, grade)}`,
        1500,
      )
    } else {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(topic, knownConceptIds, referenceMaterial, grade) }],
      })

      const costUsd =
        (message.usage.input_tokens / 1_000_000) * INPUT_USD_PER_MTOK +
        (message.usage.output_tokens / 1_000_000) * OUTPUT_USD_PER_MTOK
      recordActualSpend(costUsd).catch((e) => {
        console.error('generate-lesson-outline: failed to record platform spend', e)
      })

      const textBlock = message.content.find((b) => b.type === 'text')
      text = textBlock && 'text' in textBlock ? textBlock.text : ''
    }
    const outline = parseOutline(text)
    if (!outline) {
      return res.status(502).json({ status: 'error', reason: 'Model response was not valid outline JSON' })
    }
    return res.status(200).json({ status: 'ok', outline })
  } catch (err) {
    console.error('[generate-lesson-outline] error:', err)
    return res.status(502).json({ status: 'error', reason: String(err) })
  }
}
