/**
 * lib/studentBooks.ts
 *
 * The student's personal "reading copy" of a resolved concept (the
 * founder's 2026-09-03 "living book" ask): who opened it and any notes they
 * tag to a sim/page. Deliberately thin — the real lesson prose and sim HTML
 * are never duplicated here, they are read live from conceptLibrary (see
 * lib/conceptLibrary.ts) every time the book reopens, so a later content
 * fix there is never stale in an old personal copy. See firestore.rules'
 * student_books block for the ownership rule this relies on.
 */
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

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
 * the same topic never creates a second copy or loses existing notes. */
export async function openStudentBook(
  uid: string,
  authorName: string,
  topic: string,
  conceptId: string,
  conceptLabel: string,
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
  }
  await setDoc(doc(db, STUDENT_BOOKS, bookDocId(uid, conceptId)), book)
  return book
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
