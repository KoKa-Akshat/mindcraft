import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FieldValue } from 'firebase-admin/firestore'
import { db, auth } from '../firebase'
import { setCors } from '../cors'

/**
 * Admin-only direct linking — the backend for the Admin "Links" table
 * (student/tutor/parent roster with per-row assign controls). Unlike
 * link-child.ts (parent self-service, email-gated) and join-classroom.ts
 * (student self-service, join-code-gated, a SEPARATE classroom mechanism
 * this doesn't touch), this lets an admin wire ANY student to ANY tutor
 * and/or ANY parent directly, and undo a mistaken link.
 *
 * Tutor linking writes assignedTutorId/assignedTutorIds/assignedTutorName —
 * the SAME fields TutorDashboard.tsx's roster query and Admin.tsx's own
 * Tutors-tab display already read (previously written by a direct, unpro-
 * tected client updateDoc() in Admin.tsx; moved server-side here and now
 * blocked from client writes in firestore.rules, alongside childId/tutorId/
 * classroomId, which is the "properly wired" part of this change).
 *
 * Same additive-array + legacy-scalar-stays-in-sync shape as link-child.ts/
 * join-classroom.ts: assignedTutorId and childId are kept as the single
 * "most recent" value every existing reader already expects,
 * assignedTutorIds/childIds are the new arrays real multi-link features
 * read from. Nothing that reads the old scalar fields breaks.
 *
 * Body (all fields optional — send only the ones you're changing):
 *   studentId: string (required for every action below)
 *   tutorId?: string        — link this tutor to the student
 *   unlinkTutorId?: string  — remove this tutor from the student
 *   parentId?: string       — link this parent to the student
 *   unlinkParentId?: string — remove this student from the parent
 *   program?: string        — dash/curriculum track ('ACT' today; 'SAT'/
 *     'PIANO' reserved placeholders for future tracks, see PROGRAM_IDS below)
 */
const PROGRAM_IDS = new Set(['ACT', 'SAT', 'PIANO'])
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const token = await auth.verifyIdToken(header.slice(7))
    const callerSnap = await db.collection('users').doc(token.uid).get()
    if (callerSnap.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' })
    }

    const body = req.body ?? {}
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
    if (!studentId) return res.status(400).json({ error: 'Missing studentId' })

    const studentSnap = await db.collection('users').doc(studentId).get()
    if (!studentSnap.exists) return res.status(404).json({ error: 'Student not found' })

    if (typeof body.tutorId === 'string' && body.tutorId.trim()) {
      const tutorId = body.tutorId.trim()
      const tutorSnap = await db.collection('users').doc(tutorId).get()
      if (!tutorSnap.exists) return res.status(404).json({ error: 'Tutor not found' })
      const tutorData = tutorSnap.data() ?? {}
      await db.collection('users').doc(studentId).set({
        assignedTutorId: tutorId,
        assignedTutorName: tutorData.displayName || tutorData.email || tutorId,
        assignedTutorIds: FieldValue.arrayUnion(tutorId),
      }, { merge: true })
    }

    if (typeof body.unlinkTutorId === 'string' && body.unlinkTutorId.trim()) {
      const unlinkTutorId = body.unlinkTutorId.trim()
      const current = studentSnap.data() ?? {}
      const updates: Record<string, unknown> = { assignedTutorIds: FieldValue.arrayRemove(unlinkTutorId) }
      if (current.assignedTutorId === unlinkTutorId) {
        updates.assignedTutorId = FieldValue.delete()
        updates.assignedTutorName = FieldValue.delete()
      }
      await db.collection('users').doc(studentId).update(updates)
    }

    if (typeof body.parentId === 'string' && body.parentId.trim()) {
      const parentId = body.parentId.trim()
      const parentSnap = await db.collection('users').doc(parentId).get()
      if (!parentSnap.exists) return res.status(404).json({ error: 'Parent not found' })
      await db.collection('users').doc(parentId).set({
        role: 'parent',
        childId: studentId,
        childIds: FieldValue.arrayUnion(studentId),
      }, { merge: true })
    }

    if (typeof body.program === 'string' && body.program.trim()) {
      const program = body.program.trim().toUpperCase()
      if (!PROGRAM_IDS.has(program)) return res.status(400).json({ error: 'Unknown program' })
      await db.collection('users').doc(studentId).set({ program }, { merge: true })
    }

    if (typeof body.unlinkParentId === 'string' && body.unlinkParentId.trim()) {
      const unlinkParentId = body.unlinkParentId.trim()
      const parentSnap = await db.collection('users').doc(unlinkParentId).get()
      const current = parentSnap.data() ?? {}
      const updates: Record<string, unknown> = { childIds: FieldValue.arrayRemove(studentId) }
      if (current.childId === studentId) updates.childId = FieldValue.delete()
      await db.collection('users').doc(unlinkParentId).update(updates)
    }

    return res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('admin-link error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
