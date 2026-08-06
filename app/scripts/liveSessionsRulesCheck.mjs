/**
 * liveSessionsRulesCheck.mjs
 *
 * Minimal Firestore emulator rules-test script for the new `liveSessions` +
 * `strokes` subcollection rule block (firebase/firestore.rules). No rules-
 * test harness existed in this repo before this — this is deliberately a
 * small standalone script, not a whole test framework, per the plan at
 * ~/.claude/plans/snuggly-wandering-candle.md build-order step 1.
 *
 * Run:
 *   cd app
 *   firebase emulators:exec --only firestore --project mindcraft-rules-test \
 *     "node scripts/liveSessionsRulesCheck.mjs"
 *
 * (firebase.json's emulators.firestore.port must match FIRESTORE_PORT below.)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing'
import {
  doc, setDoc, getDoc, getDocs, addDoc, collection, serverTimestamp,
} from 'firebase/firestore'

const FIRESTORE_PORT = 8091
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
// scriptDir is app/scripts — repo root is two levels up.
const rulesPath = path.join(scriptDir, '..', '..', 'firebase', 'firestore.rules')

const results = []
function record(name, ok, note) {
  results.push({ name, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  (${note})` : ''}`)
}

async function check(name, promise) {
  try {
    await promise
    record(name, true)
  } catch (e) {
    record(name, false, e?.message?.split('\n')[0])
  }
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'mindcraft-rules-test',
    firestore: {
      rules: readFileSync(rulesPath, 'utf8'),
      host: '127.0.0.1',
      port: FIRESTORE_PORT,
    },
  })

  // ── Fixtures (bypass rules — this is admin seeding, not a rules test) ───
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'student1'), { role: 'student', tutorId: 'tutorA' })
    await setDoc(doc(db, 'users', 'tutorA'), { role: 'tutor' })
    await setDoc(doc(db, 'users', 'tutorB'), { role: 'tutor' }) // unrelated
    await setDoc(doc(db, 'users', 'parentA'), { role: 'parent', childId: 'student1' })
    await setDoc(doc(db, 'users', 'parentC'), { role: 'parent', childIds: ['other-kid', 'student1'] })
    await setDoc(doc(db, 'users', 'parentB'), { role: 'parent', childId: 'someone-else' }) // unrelated

    // Baseline session other tests read/write against.
    await setDoc(doc(db, 'liveSessions', 'session1'), {
      studentId: 'student1',
      tutorId: 'tutorA',
      contextType: 'question',
      questionId: 'q1',
      conceptId: 'c1',
      conceptName: 'Linear Equations',
      questionText: 'Solve for x: 2x + 3 = 7',
      status: 'active',
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      endedAt: null,
    })

    // Baseline WORKSHEET-context session (write-on-it live calls, added
    // alongside question/weekly_paper — see liveSession.ts). Same shape plus
    // pageImage/pageIndex/pageCount; the rules block itself was NOT changed
    // for this addition (create/update never allowlist specific field names,
    // only studentId/tutorId immutability) — these cases exist to verify
    // that empirically rather than by inspection alone.
    await setDoc(doc(db, 'liveSessions', 'session2'), {
      studentId: 'student1',
      tutorId: 'tutorA',
      contextType: 'worksheet',
      questionId: null,
      conceptId: null,
      conceptName: null,
      questionText: null,
      pageImage: 'data:image/jpeg;base64,/9j/tiny',
      pageIndex: 0,
      pageCount: 3,
      status: 'active',
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      endedAt: null,
    })
  })

  const studentDb = testEnv.authenticatedContext('student1').firestore()
  const tutorDb = testEnv.authenticatedContext('tutorA').firestore()
  const otherTutorDb = testEnv.authenticatedContext('tutorB').firestore()
  const parentDb = testEnv.authenticatedContext('parentA').firestore()
  const parentArrayDb = testEnv.authenticatedContext('parentC').firestore()
  const otherParentDb = testEnv.authenticatedContext('parentB').firestore()

  // ── 1. Student can create their own session (real tutorId) ─────────────
  await check(
    'student creates own session with correct tutorId',
    assertSucceeds(addDoc(collection(studentDb, 'liveSessions'), {
      studentId: 'student1',
      tutorId: 'tutorA',
      contextType: 'question',
      questionId: 'q2',
      conceptId: 'c1',
      conceptName: 'Linear Equations',
      questionText: 'text',
      status: 'active',
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      endedAt: null,
    })),
  )

  // ── 2. Student CANNOT spoof tutorId to someone other than their real tutor
  await check(
    'student cannot spoof tutorId on create',
    assertFails(addDoc(collection(studentDb, 'liveSessions'), {
      studentId: 'student1',
      tutorId: 'tutorB', // NOT users/student1.tutorId
      contextType: 'question',
      questionId: 'q3',
      conceptId: 'c1',
      conceptName: null,
      questionText: null,
      status: 'active',
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      endedAt: null,
    })),
  )

  // ── 3. Student reads own session ────────────────────────────────────────
  await check('student reads own session', assertSucceeds(getDoc(doc(studentDb, 'liveSessions', 'session1'))))

  // ── 4. Linked tutor reads the session ───────────────────────────────────
  await check('linked tutor reads session', assertSucceeds(getDoc(doc(tutorDb, 'liveSessions', 'session1'))))

  // ── 5. Linked parent (childId) reads the session ────────────────────────
  await check('linked parent (childId) reads session', assertSucceeds(getDoc(doc(parentDb, 'liveSessions', 'session1'))))

  // ── 5b. Linked parent (childIds array) reads the session ────────────────
  await check('linked parent (childIds array) reads session', assertSucceeds(getDoc(doc(parentArrayDb, 'liveSessions', 'session1'))))

  // ── 6. Unrelated tutor DENIED read ──────────────────────────────────────
  await check('unrelated tutor denied session read', assertFails(getDoc(doc(otherTutorDb, 'liveSessions', 'session1'))))

  // ── 7. Unrelated parent DENIED read ─────────────────────────────────────
  await check('unrelated parent denied session read', assertFails(getDoc(doc(otherParentDb, 'liveSessions', 'session1'))))

  // ── Worksheet-context cases (write-on-it live calls) ────────────────────
  // Mirrors cases 1/3/4/6 above but for contextType:'worksheet' with the new
  // pageImage/pageIndex/pageCount fields, plus an update case — confirming
  // the schema addition works under the UNCHANGED rules, not assumed.
  await check(
    'student creates own worksheet session with pageImage/pageIndex/pageCount',
    assertSucceeds(addDoc(collection(studentDb, 'liveSessions'), {
      studentId: 'student1',
      tutorId: 'tutorA',
      contextType: 'worksheet',
      questionId: null,
      conceptId: null,
      conceptName: null,
      questionText: null,
      pageImage: 'data:image/jpeg;base64,/9j/tiny2',
      pageIndex: 1,
      pageCount: 4,
      status: 'active',
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      endedAt: null,
    })),
  )
  await check('student reads own worksheet session', assertSucceeds(getDoc(doc(studentDb, 'liveSessions', 'session2'))))
  await check('linked tutor reads worksheet session', assertSucceeds(getDoc(doc(tutorDb, 'liveSessions', 'session2'))))
  await check('unrelated tutor denied worksheet session read', assertFails(getDoc(doc(otherTutorDb, 'liveSessions', 'session2'))))
  await check(
    'student updates lifecycle field on worksheet session (status)',
    assertSucceeds(setDoc(doc(studentDb, 'liveSessions', 'session2'), { status: 'ended', endedAt: serverTimestamp() }, { merge: true })),
  )
  await check(
    'student writes stroke into own worksheet session',
    assertSucceeds(addDoc(collection(studentDb, 'liveSessions', 'session2', 'strokes'), {
      authorId: 'student1',
      authorRole: 'student',
      points: [{ x: 5, y: 5, p: 0.5 }],
      createdAt: serverTimestamp(),
    })),
  )

  // ── 8. Student can write a stroke into their own session ───────────────
  await check(
    'student writes stroke into own session',
    assertSucceeds(addDoc(collection(studentDb, 'liveSessions', 'session1', 'strokes'), {
      authorId: 'student1',
      authorRole: 'student',
      points: [{ x: 10, y: 10, p: 0.5 }, { x: 12, y: 11, p: 0.6 }],
      createdAt: serverTimestamp(),
    })),
  )

  // ── 9. Linked tutor can write a stroke ──────────────────────────────────
  await check(
    'linked tutor writes stroke',
    assertSucceeds(addDoc(collection(tutorDb, 'liveSessions', 'session1', 'strokes'), {
      authorId: 'tutorA',
      authorRole: 'tutor',
      points: [{ x: 20, y: 20, p: 0.4 }],
      createdAt: serverTimestamp(),
    })),
  )

  // ── 10. Linked parent can write a stroke ────────────────────────────────
  await check(
    'linked parent writes stroke',
    assertSucceeds(addDoc(collection(parentDb, 'liveSessions', 'session1', 'strokes'), {
      authorId: 'parentA',
      authorRole: 'parent',
      points: [{ x: 30, y: 30, p: 0.7 }],
      createdAt: serverTimestamp(),
    })),
  )

  // ── 11. Unrelated tutor DENIED stroke write ─────────────────────────────
  await check(
    'unrelated tutor denied stroke write',
    assertFails(addDoc(collection(otherTutorDb, 'liveSessions', 'session1', 'strokes'), {
      authorId: 'tutorB',
      authorRole: 'tutor',
      points: [{ x: 1, y: 1, p: 0.1 }],
      createdAt: serverTimestamp(),
    })),
  )

  // ── 12. Unrelated parent DENIED stroke read (list) ──────────────────────
  await check(
    'unrelated parent denied strokes list read',
    assertFails(getDocs(collection(otherParentDb, 'liveSessions', 'session1', 'strokes'))),
  )

  // ── 13. Authorized reader's UNFILTERED list()/onSnapshot-equivalent query
  // on the strokes subcollection must NOT be blocked (the specific risk the
  // plan flags — the read rule must resolve via get() on the parent doc,
  // never resource.data on each stroke, or Firestore rejects the whole list
  // even for a legitimately-authorized reader).
  await check(
    'student unfiltered strokes list query succeeds',
    assertSucceeds(getDocs(collection(studentDb, 'liveSessions', 'session1', 'strokes'))),
  )
  await check(
    'tutor unfiltered strokes list query succeeds',
    assertSucceeds(getDocs(collection(tutorDb, 'liveSessions', 'session1', 'strokes'))),
  )
  await check(
    'parent unfiltered strokes list query succeeds',
    assertSucceeds(getDocs(collection(parentDb, 'liveSessions', 'session1', 'strokes'))),
  )

  // ── Bonus: a stroke cannot be created under someone else's authorId ─────
  await check(
    'student cannot write a stroke impersonating another author',
    assertFails(addDoc(collection(studentDb, 'liveSessions', 'session1', 'strokes'), {
      authorId: 'tutorA', // spoofed
      authorRole: 'tutor',
      points: [{ x: 1, y: 1, p: 0.1 }],
      createdAt: serverTimestamp(),
    })),
  )

  // ── Bonus: interactions footnote fix — tutor can now read their student's
  // interactions via the student's OWN tutorId link (previously denied).
  // Uses a FIXED doc id (setDoc, not addDoc) deliberately: withSecurityRulesDisabled
  // awaits its callback but does NOT propagate the callback's return value
  // (confirmed by reading node_modules/@firebase/rules-unit-testing's
  // withSecurityRulesDisabled implementation — `await callback(context);` with
  // no `return`), so fishing an addDoc-generated id back out via a second
  // withSecurityRulesDisabled + getDocs call always resolved to undefined.
  // A known id sidesteps that pitfall entirely instead of retrying/racing. ──
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'interactions', 'interaction1'), {
      studentId: 'student1', conceptId: 'c1', outcome: 1, timestamp: serverTimestamp(),
    })
  })
  await check(
    "linked tutor reads student's interactions (footnote fix)",
    assertSucceeds(getDoc(doc(tutorDb, 'interactions', 'interaction1'))),
  )
  await check(
    "unrelated tutor denied student's interactions",
    assertFails(getDoc(doc(otherTutorDb, 'interactions', 'interaction1'))),
  )

  await testEnv.cleanup()

  const failed = results.filter(r => !r.ok)
  console.log('')
  console.log(`${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) {
    console.log('FAILURES:')
    for (const f of failed) console.log(`  - ${f.name}${f.note ? `: ${f.note}` : ''}`)
    process.exitCode = 1
  }
}

main().catch(e => {
  console.error('Rules check crashed:', e)
  process.exitCode = 1
})
