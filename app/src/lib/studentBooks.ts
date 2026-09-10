/**
 * lib/studentBooks.ts
 *
 * The student's personal "reading copy" of a resolved concept (the
 * founder's 2026-09-03 "living book" ask): who opened it and any notes they
 * tag to a sim/page. Deliberately thin for LIBRARY content: the real lesson
 * prose and sim HTML are never duplicated here, they are read live from
 * conceptLibrary (see lib/conceptLibrary.ts) every time the book reopens,
 * so a later content fix there is never stale in an old personal copy. See
 * firestore.rules' student_books block for the ownership rule this relies
 * on.
 *
 * 2026-09-03 follow-up ("over time this becomes a big big book of their
 * learning"): the doc now also carries the book's accumulated CHAPTER LIST,
 * so chapters added mid-book (a second topic, another worksheet) survive a
 * reload instead of dying with React state. Library chapters stay thin
 * (conceptId only, content read live); AI-generated chapters carry their
 * body/sim inline because they were never migrated into conceptLibrary and
 * there is nowhere else to read them back from. That inline payload is the
 * doc's known growth limit (Firestore caps a doc at 1MB) and the thing to
 * revisit if generated books get big.
 */
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { HomeworkQuestion } from '../types'

export const STUDENT_BOOKS = 'student_books'

export interface BookNote {
  id: string
  conceptId: string
  text: string
  createdAt: number
}

/** A student's own edits to one page (2026-09-03 ask — "make it editable,
 * each page"): title/paragraph text overrides, paragraph order, and a
 * color pick, layered on top of the real content at render time. Never
 * mutates the shared source (conceptLibrary or a generated book) — this is
 * the student's own copy only, same "personal overlay, real content stays
 * live" shape addBookNote already uses. */
export interface PageEdit {
  title?: string
  paragraphs?: string[]
  paperColor?: string
  inkColor?: string
}

/** One page in the book, persisted. Same unified shape BookReader renders:
 * a real prerequisite-ramp concept, an uploaded-worksheet question resolved
 * to its concept, or one section of an AI-generated book (which carries its
 * content inline, see the file doc comment). */
export interface BookChapter {
  conceptId: string
  label: string
  hasSim: boolean
  question?: HomeworkQuestion
  generated?: { body: string; summary?: string; simHtml?: string }
}

export interface StudentBook {
  studentId: string
  authorName: string
  topic: string
  title: string
  conceptId: string
  conceptLabel: string
  createdAt: number
  notes: BookNote[]
  pageEdits?: Record<string, PageEdit>
  /** The accumulated chapter list: the whole growing book, in reading
   * order. Absent on books created before 2026-09-03's growing-book change;
   * BookReader backfills it from the freshly resolved ramp on next open. */
  chapters?: BookChapter[]
  /** How many leading chapters form the ORIGINAL prerequisite ramp, so the
   * front page can keep offering "start at the foundation" vs "go straight
   * there" after the book has grown past it. 0 for homework/generated-first
   * books, which have no ramp. */
  rampCount?: number
}

/** Firestore rejects `undefined` field values outright (unlike JSON, which
 * just drops them), so optional Chapter fields are omitted rather than
 * passed through. */
function chapterForStorage(c: BookChapter): Record<string, unknown> {
  const out: Record<string, unknown> = { conceptId: c.conceptId, label: c.label, hasSim: c.hasSim }
  if (c.question) out.question = c.question
  if (c.generated) {
    const g: Record<string, unknown> = { body: c.generated.body }
    if (c.generated.summary !== undefined) g.summary = c.generated.summary
    if (c.generated.simHtml !== undefined) g.simHtml = c.generated.simHtml
    out.generated = g
  }
  return out
}

export function bookDocId(uid: string, conceptId: string): string {
  return `${uid}__${conceptId}`
}

export async function loadStudentBook(uid: string, conceptId: string): Promise<StudentBook | null> {
  if (!uid || !conceptId) return null
  const snap = await getDoc(doc(db, STUDENT_BOOKS, bookDocId(uid, conceptId)))
  if (!snap.exists()) return null
  return snap.data() as StudentBook
}

/** Opens the student's reading copy for this concept, creating it the first
 * time. Idempotent by construction (doc id is deterministic), so reopening
 * the same topic never creates a second copy or loses existing notes.
 * `initial` seeds the chapter list + ramp size on CREATION only; an
 * existing book's own accumulated chapters always win over a fresh build,
 * that is the whole point of the growing book. */
export async function openStudentBook(
  uid: string,
  authorName: string,
  topic: string,
  conceptId: string,
  conceptLabel: string,
  initial?: { chapters: BookChapter[]; rampCount: number },
): Promise<StudentBook> {
  const existing = await loadStudentBook(uid, conceptId)
  if (existing) return existing
  const book: StudentBook = {
    studentId: uid,
    authorName,
    topic,
    title: conceptLabel,
    conceptId,
    conceptLabel,
    createdAt: Date.now(),
    notes: [],
    ...(initial ? { chapters: initial.chapters, rampCount: initial.rampCount } : {}),
  }
  const payload: Record<string, unknown> = { ...book }
  if (initial) payload.chapters = initial.chapters.map(chapterForStorage)
  await setDoc(doc(db, STUDENT_BOOKS, bookDocId(uid, conceptId)), payload)
  return book
}

/** Replaces the book's persisted chapter list with the full accumulated
 * one. Whole-list replace on purpose: appends, and only appends, flow
 * through here, and the list IS the book's reading order, so a partial
 * arrayUnion could never express it. `rampCount` is written only when
 * given (backfilling a pre-growing-book doc); appends leave it alone. */
export async function saveBookChapters(
  uid: string,
  bookConceptId: string,
  chapters: BookChapter[],
  rampCount?: number,
): Promise<void> {
  const patch: Record<string, unknown> = { chapters: chapters.map(chapterForStorage) }
  if (rampCount !== undefined) patch.rampCount = rampCount
  await updateDoc(doc(db, STUDENT_BOOKS, bookDocId(uid, bookConceptId)), patch)
}

/** Tags a note to a specific page (concept) within the book. `bookConceptId`
 * is the book's own id (the concept it was opened on); `pageConceptId` is
 * whichever step the student is currently reading, which may be the same
 * concept or a foundation step earlier in the ramp. */
export async function addBookNote(
  uid: string,
  bookConceptId: string,
  pageConceptId: string,
  text: string,
): Promise<BookNote> {
  const trimmed = text.trim().slice(0, 600)
  const note: BookNote = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    conceptId: pageConceptId,
    text: trimmed,
    createdAt: Date.now(),
  }
  await updateDoc(doc(db, STUDENT_BOOKS, bookDocId(uid, bookConceptId)), {
    notes: arrayUnion(note),
  })
  return note
}

/** Saves (merges into) one page's edits. `pageConceptId` scopes it to the
 * exact page being read, same as addBookNote. Firestore dot-path update so
 * this never clobbers another page's edits in the same book. */
export async function savePageEdit(
  uid: string,
  bookConceptId: string,
  pageConceptId: string,
  patch: PageEdit,
): Promise<void> {
  await updateDoc(doc(db, STUDENT_BOOKS, bookDocId(uid, bookConceptId)), {
    [`pageEdits.${pageConceptId}`]: patch,
  })
}
