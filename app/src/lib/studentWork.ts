import {
  doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { QuestionWorkDoc, WorkSource, ScratchStrokeData, WorkLine } from '../types'
import type { FormatId } from './questionBank'

const EMPTY_STROKES: ScratchStrokeData = { strokes: [], width: 0, height: 0 }
const EMPTY_TRANSCRIPTION = { text: '', latex: '', editedByStudent: false }

export function workDocId(studentId: string, questionId: string): string {
  return `${studentId}__${questionId}`
}

export function sessionWorkDocId(studentId: string, sessionId: string, prompt: string): string {
  const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)
  return `${studentId}__session__${sessionId}__${slug || 'prompt'}`
}

export interface SaveQuestionWorkInput {
  questionId?: string
  conceptId: string
  source: WorkSource
  level?: 1 | 2 | 3
  formatId?: FormatId
  sessionId?: string
  prompt?: string
  scratchImage?: string
  scratchStrokes?: ScratchStrokeData
  workLines?: WorkLine[]
  scratchTranscription?: { text: string; latex: string; editedByStudent: boolean }
  wasStuck?: boolean
  reasoningText?: string
  selectedAnswerIndex?: number
}

function resolveDocId(studentId: string, input: SaveQuestionWorkInput): string | null {
  if (input.questionId) return workDocId(studentId, input.questionId)
  if (input.sessionId && input.prompt) return sessionWorkDocId(studentId, input.sessionId, input.prompt)
  return null
}

export async function loadQuestionWork(
  studentId: string,
  questionId: string,
): Promise<QuestionWorkDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'student_work', workDocId(studentId, questionId)))
    if (!snap.exists()) return null
    return snap.data() as QuestionWorkDoc
  } catch {
    return null
  }
}

export async function saveQuestionWork(
  studentId: string,
  input: SaveQuestionWorkInput,
): Promise<void> {
  const docId = resolveDocId(studentId, input)
  if (!docId) return

  const now = Date.now()
  const existing = input.questionId
    ? await loadQuestionWork(studentId, input.questionId)
    : null

  const payload: QuestionWorkDoc = {
    studentId,
    questionId: input.questionId,
    conceptId: input.conceptId,
    source: input.source,
    level: input.level,
    formatId: input.formatId,
    sessionId: input.sessionId,
    prompt: input.prompt,
    scratchImage: input.scratchImage ?? existing?.scratchImage ?? '',
    scratchStrokes: input.scratchStrokes ?? existing?.scratchStrokes ?? EMPTY_STROKES,
    workLines: input.workLines ?? existing?.workLines ?? [],
    scratchTranscription: input.scratchTranscription ?? existing?.scratchTranscription ?? EMPTY_TRANSCRIPTION,
    wasStuck: input.wasStuck ?? existing?.wasStuck,
    reasoningText: input.reasoningText ?? existing?.reasoningText,
    selectedAnswerIndex: input.selectedAnswerIndex ?? existing?.selectedAnswerIndex,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  try {
    await setDoc(doc(db, 'student_work', docId), payload, { merge: true })
  } catch { /* fail-soft */ }
}

export async function listStudentWork(
  studentId: string,
  max = 50,
): Promise<QuestionWorkDoc[]> {
  try {
    const q = query(
      collection(db, 'student_work'),
      where('studentId', '==', studentId),
      orderBy('updatedAt', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => d.data() as QuestionWorkDoc)
  } catch {
    return []
  }
}
