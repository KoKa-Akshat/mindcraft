/**
 * wrongAnswerNotes.ts
 *
 * Per-question "gap" notes: the first wrong pick a student makes on a
 * question, plus a diagnosis of why that pick reflects a specific
 * misconception. Backs the "Open gaps" section on the Notes page
 * (StudentSessions.tsx) and the chapter title / "Go to Notes" affordance on
 * ConceptChapterPage.tsx.
 *
 * Design:
 * - One doc per (student, question), doc id `${studentId}__${questionId}` —
 *   same deterministic-id shape as studentWork.ts's `student_work` collection.
 * - The FIRST wrong pick wins. A second or third wrong attempt at the same
 *   still-open question never overwrites the saved pick or its diagnosis
 *   (recordWrongAnswer no-ops if an unresolved note already exists) — the
 *   founder's ask is "picked this because, then identified this type," not a
 *   rolling log of every attempt.
 * - Reuses questionBank.ts's resolveChoiceEvidence (distractor_taxonomy ->
 *   misconception_id fallback) for the misconception resolution — no new
 *   misconception detection here.
 * - Resolved the next time that exact questionId is answered correctly by
 *   that student, wherever that happens (chapter retry loop or a later
 *   practice session) — resolveWrongAnswerNote is keyed on questionId alone.
 * - Resolved notes are kept (history has value) but carry `resolved: true` so
 *   the default "open gaps" read filters them out client-side.
 */
import {
  doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import { resolveChoiceEvidence, type Question, type FormatId } from './questionBank'

const COLLECTION = 'wrong_answer_notes'

export function wrongNoteDocId(studentId: string, questionId: string): string {
  return `${studentId}__${questionId}`
}

export type WrongAnswerNoteSource = 'chapter' | 'practice'

export interface WrongAnswerNoteDoc {
  studentId: string
  questionId: string
  conceptId: string
  conceptName?: string
  questionStem: string
  choices: string[]
  selectedIndex: number
  correctIndex: number
  misconceptionId?: string
  misconceptionLabel?: string
  errorType?: string
  diagnosis: string
  source: WrongAnswerNoteSource
  level?: 1 | 2 | 3
  formatId?: FormatId
  resolved: boolean
  createdAt: number
  updatedAt: number
  resolvedAt?: number
}

export interface WrongAnswerNoteEntry extends WrongAnswerNoteDoc {
  id: string
  /** Injected by groupWorkByConcept's enrichment step when grouping for the
   * Notes page — not stored in Firestore. */
  recallTag?: string
}

function pickedLine(picked?: string): string {
  return picked ? `You picked "${picked}."` : 'You picked another option.'
}

/**
 * Build the diagnostic explanation string. Prefers per-choice
 * distractor_taxonomy student_thinking, then the question's own
 * misconception_label, and only falls back to a plain reframe of the
 * question's explanation when no misconception data exists at all — never a
 * fabricated-sounding diagnosis.
 */
export function buildWrongAnswerDiagnosis(
  q: Question,
  selectedIndex: number,
): { diagnosis: string; misconceptionId?: string; misconceptionLabel?: string; errorType?: string } {
  const evidence = resolveChoiceEvidence(q, selectedIndex)
  const picked = q.choices?.[selectedIndex]
  const thinking = q.distractor_taxonomy?.find(d => d.choice_index === selectedIndex)?.student_thinking
  const explanation = (q.explanation ?? '').trim()

  let reason = ''
  if (thinking) {
    reason = `That fits a specific pattern: ${thinking}.`
  } else if (q.misconception_label) {
    reason = `That fits a known pattern: ${q.misconception_label}.`
  }

  const rule = explanation ? `Here is the rule that actually holds: ${explanation}` : ''
  const diagnosis = [pickedLine(picked), reason, rule].filter(Boolean).join(' ').trim()

  return {
    diagnosis: diagnosis || explanation || 'Take a closer look at this one before the next pass.',
    misconceptionId: evidence.misconceptionId,
    misconceptionLabel: q.misconception_label,
    errorType: evidence.errorType,
  }
}

export interface RecordWrongAnswerInput {
  question: Question
  conceptId: string
  conceptName?: string
  selectedIndex: number
  source: WrongAnswerNoteSource
}

/** Save the first wrong pick on a question. No-op on a correct pick, and
 * no-op if this question already has an OPEN (unresolved) note — the saved
 * pick + diagnosis stay put until the gap closes. If a previously resolved
 * note comes back open (a later miss after it was once fixed), this reopens
 * it fresh with the new pick's evidence. */
export async function recordWrongAnswer(studentId: string, input: RecordWrongAnswerInput): Promise<void> {
  const { question: q, selectedIndex } = input
  if (!studentId || !q?.id || selectedIndex === q.correctIndex) return
  const docId = wrongNoteDocId(studentId, q.id)
  try {
    const existing = await getDoc(doc(db, COLLECTION, docId))
    if (existing.exists() && !(existing.data() as WrongAnswerNoteDoc).resolved) return

    const { diagnosis, misconceptionId, misconceptionLabel, errorType } = buildWrongAnswerDiagnosis(q, selectedIndex)
    const now = Date.now()
    const payload: WrongAnswerNoteDoc = {
      studentId,
      questionId: q.id,
      conceptId: input.conceptId,
      conceptName: input.conceptName,
      questionStem: q.question,
      choices: q.choices ?? [],
      selectedIndex,
      correctIndex: q.correctIndex,
      misconceptionId,
      misconceptionLabel,
      errorType,
      diagnosis,
      source: input.source,
      level: q.level,
      formatId: q.format,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(db, COLLECTION, docId), payload)
  } catch {
    // fail-soft — the practice/chapter flow itself already completed
  }
}

/** Mark this question's note resolved the moment the student answers it
 * correctly again, wherever that happens. No-op if there was never an open
 * note for this question. */
export async function resolveWrongAnswerNote(studentId: string, questionId: string): Promise<void> {
  if (!studentId || !questionId) return
  const docId = wrongNoteDocId(studentId, questionId)
  try {
    const existing = await getDoc(doc(db, COLLECTION, docId))
    if (!existing.exists()) return
    const data = existing.data() as WrongAnswerNoteDoc
    if (data.resolved) return
    const now = Date.now()
    await setDoc(doc(db, COLLECTION, docId), { resolved: true, resolvedAt: now, updatedAt: now }, { merge: true })
  } catch {
    // fail-soft
  }
}

export async function listWrongAnswerNotes(studentId: string, max = 300): Promise<WrongAnswerNoteEntry[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('studentId', '==', studentId),
      orderBy('updatedAt', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as WrongAnswerNoteDoc) }))
  } catch {
    return []
  }
}

/** Realtime subscription for the Notes page. Fails soft to an empty list so a
 * missing index or offline read never blocks the rest of the page. */
export function subscribeWrongAnswerNotes(
  studentId: string,
  onChange: (entries: WrongAnswerNoteEntry[]) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('studentId', '==', studentId),
    orderBy('updatedAt', 'desc'),
  )
  const unsub = onSnapshot(q, snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...(d.data() as WrongAnswerNoteDoc) })))
  }, () => onChange([]))
  return unsub
}
