/**
 * learnActivity.ts
 *
 * One call per real learning moment on /learn. It does two things:
 *
 *   1. logEvent(): appends the honest audit event to the `events`
 *      collection, same calling convention KnowledgeGraph.tsx uses.
 *   2. Bumps users/{uid}.learnActivityCount by 1 via increment().
 *
 * The counter exists so the Desk OS hub can render Jesse the desk pet's
 * stage from ONE cheap getDoc (the same users/{uid} read App.tsx's
 * deskOsHandoffQuery() already performs) instead of a count query over the
 * whole events collection on every load. It is incrementally correct by
 * construction: it moves only when a real event is recorded, and
 * increment() is atomic server side, so concurrent tabs cannot lose counts.
 *
 * Honesty note (verified against the DEPLOYED ruleset on 2026-08-31): the
 * live firestore.rules has no match block for the `events` collection at
 * all, so the client side addDoc inside logEvent() is currently denied and
 * silently swallowed (the collection has zero documents ever, despite
 * KnowledgeGraph.tsx calling logEvent in production). The deployed rules DO
 * allow an owner to update non privileged keys on their own users/{uid}
 * doc, so the counter is the load bearing signal today. The logEvent call
 * stays because it is the right audit trail the moment an events rule
 * ships; nothing here fabricates activity either way.
 */
import { db } from '../firebase'
import { doc, setDoc, increment } from 'firebase/firestore'
import { logEvent } from './logEvent'

export function recordLearnActivity(
  uid: string | null | undefined,
  type: string,
  data?: Record<string, unknown>,
) {
  if (!uid) return
  void logEvent(uid, type, data)
  // merge:true so a users doc that somehow does not exist yet is created
  // rather than erroring; increment() is atomic either way.
  setDoc(doc(db, 'users', uid), { learnActivityCount: increment(1) }, { merge: true })
    .catch(() => { /* non blocking, same policy as logEvent */ })
}
