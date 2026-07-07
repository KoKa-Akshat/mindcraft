import { db } from '../lib/firebase'

async function main() {
  const snap = await db.collection('users').get()
  const flagged = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((user: any) => (
      user.role === 'admin'
      || user.role === 'tutor'
      || !!user.childId
      || !!user.tutorId
      || !!user.classroomId
    ))

  console.log(JSON.stringify(flagged.map((user: any) => ({
    uid: user.id,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    role: user.role ?? null,
    childId: user.childId ?? null,
    tutorId: user.tutorId ?? null,
    classroomId: user.classroomId ?? null,
  })), null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
