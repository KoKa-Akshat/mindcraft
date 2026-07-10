/**
 * chapterJournal.ts — work-to-journal for the concept chapter page.
 *
 * Whatever a student works through on a chapter page (a concept's story +
 * questions) becomes appendable to their Notes, the same way a completed
 * homework upload does — reuses the `homework_sessions` collection shape
 * `DashboardNotesPanel` already reads (see `lib/homework.ts` /
 * `completeHomeworkSession`), rather than inventing a parallel save path.
 * One doc per (student, concept), merged across visits so a chapter's entry
 * grows as more questions are worked instead of duplicating rows.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { HomeworkSessionDoc } from '../types'

const COLLECTION = 'homework_sessions'

function chapterDocId(studentId: string, conceptId: string): string {
  return `chapter_${studentId}_${conceptId}`
}

function bulletFor(questionNumber: number, correct: boolean, hasWork: boolean): string {
  const worked = hasWork ? ', scratch work saved' : ''
  return `Question ${questionNumber}: ${correct ? 'answered' : 'attempted'}${worked}.`
}

export interface ChapterWorkInput {
  studentId: string
  conceptId: string
  conceptName: string
  questionId: string
  questionNumber: number
  correct: boolean
  hasWork: boolean
}

/** Append (or start) this concept chapter's journal entry after a question is locked in. */
export async function appendChapterWorkToJournal(input: ChapterWorkInput): Promise<void> {
  const docId = chapterDocId(input.studentId, input.conceptId)
  const now = Date.now()

  try {
    const existing = await getDoc(doc(db, COLLECTION, docId))
    const prior = existing.exists() ? (existing.data() as Omit<HomeworkSessionDoc, 'id'>) : null
    const bullets = [...(prior?.summary?.bullets ?? [])]
    const bullet = bulletFor(input.questionNumber, input.correct, input.hasWork)
    // Replace this question's line if already present (re-answering the same
    // question updates its entry rather than duplicating it).
    const marker = `Question ${input.questionNumber}:`
    const idx = bullets.findIndex(b => b.startsWith(marker))
    if (idx >= 0) bullets[idx] = bullet
    else bullets.push(bullet)

    const payload: Omit<HomeworkSessionDoc, 'id'> = {
      studentId: input.studentId,
      title: `${input.conceptName} chapter`,
      sourceFileName: input.conceptId,
      pageCount: bullets.length,
      questions: [],
      currentIndex: 0,
      status: 'completed',
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
      completedAt: now,
      summary: {
        date: new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bullets,
      },
    }
    await setDoc(doc(db, COLLECTION, docId), payload, { merge: true })
  } catch {
    // fail-soft — the chapter itself already saved via saveQuestionWork;
    // the journal entry is a nice-to-have surface, not the source of truth.
  }
}
