/**
 * Tutor "open student dash" session flag.
 * Set while the Admin iframe is open so the framed student route can
 * resolve live data for that student under the tutor's auth.
 */
const KEY = 'mc-tutor-view-as'

export function setTutorViewAsStudentId(studentId: string | null) {
  try {
    if (studentId) sessionStorage.setItem(KEY, studentId)
    else sessionStorage.removeItem(KEY)
  } catch { /* ignore */ }
}

export function getTutorViewAsStudentId(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const TUTOR_EXIT_STUDENT_MSG = 'mc-tutor-exit-student'
