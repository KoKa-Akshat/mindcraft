/**
 * WorksheetSession.tsx
 *
 * "Write on it" mode for an uploaded worksheet — the second choice next to
 * WorkStudio's existing "Extract questions" path (HomeworkSession.tsx). That
 * path re-parses pages into separate question cards with their own blank
 * scratchpads; this one shows each rasterized page AS AN IMAGE and lets the
 * student write directly on top of it, like marking up a photocopy, plus a
 * Call button so a linked tutor/parent can join and see + write on the same
 * page in real time (same live-session infra as Practice.tsx's question
 * calls and WeeklyPracticePaperPage's paper calls — see liveSession.ts).
 *
 * Pages arrive via router state from WorkStudio.tsx (`pagesFromFile()`
 * output, already in memory there — no reason to round-trip them through a
 * new Firestore collection just to hand them to this page). Deliberately NOT
 * persisted server-side (see homework.ts's live-session snapshot doc comment
 * for why a *full-res* multi-page array is a bad fit for a Firestore doc);
 * a reload of this route has nothing to resume from and bounces back to the
 * Work tab, same as HomeworkSession's own "invalid state" redirect target.
 *
 * Page navigation remounts the ScratchPad (key'd by page index) so switching
 * pages starts a fresh canvas — the exact same convention HomeworkSession
 * uses between questions (`key={session.id}-${index}}`), not a new pattern.
 * Ink is not round-tripped back in on revisiting a page, matching that same
 * existing page's actual behavior (its own per-question Firestore save is
 * fire-and-forget for the journal, not for redisplay within the session).
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import ScratchPad from '../components/ScratchPad'
import CallButton from '../components/CallButton'
import { downscaleForLiveSession, titleFromFileName } from '../lib/homework'
import s from './HomeworkSession.module.css'
import ws from './WorksheetSession.module.css'

interface WorksheetLocationState {
  pages: string[]
  fileName: string
}

export default function WorksheetSession() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useUser()

  const state = location.state as WorksheetLocationState | null
  const pages = state?.pages ?? []
  const fileName = state?.fileName ?? ''

  const [index, setIndex] = useState(0)
  const [tutorId, setTutorId] = useState<string | null>(null)
  const [callImage, setCallImage] = useState<string | null>(null)

  // No pages in router state (direct visit, reload, back-button after
  // navigating away) — nothing to show, same redirect target HomeworkSession
  // uses for its own equivalent "invalid state" case.
  useEffect(() => {
    if (pages.length === 0) {
      const t = window.setTimeout(() => navigate('/dashboard?view=worksheet', { replace: true }), 1500)
      return () => window.clearTimeout(t)
    }
  }, [pages.length, navigate])

  // Linked tutor, for the Call button — same lookup HomeworkSession does.
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    void getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (cancelled) return
      const linkedTutorId = snap.data()?.tutorId
      if (typeof linkedTutorId === 'string' && linkedTutorId) setTutorId(linkedTutorId)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.uid])

  // Downscaled snapshot of the CURRENT page, refreshed whenever the student
  // flips pages, so a Call started from any page carries the right image
  // (see liveSession.ts's `pageImage` doc comment — the call, once started,
  // stays locked to the page it began on; this just keeps the button ready
  // with whatever page is on screen right now).
  useEffect(() => {
    if (pages.length === 0) { setCallImage(null); return }
    let cancelled = false
    void downscaleForLiveSession(pages[index]).then(img => {
      if (!cancelled) setCallImage(img)
    })
    return () => { cancelled = true }
  }, [pages, index])

  if (pages.length === 0) {
    return (
      <div className={s.shell}>
        <nav className={s.nav}>
          <Link to="/dashboard?view=worksheet" className={s.logo}>Mind<span>Craft</span></Link>
          <Link to="/dashboard?view=worksheet" className={s.back}>← Homework</Link>
        </nav>
        <main className={s.page}>
          <div className={`${s.card} ${ws.empty}`}>
            <p className={ws.emptyTitle}>Nothing to write on yet.</p>
            <p className={ws.emptySub}>Taking you back to upload a worksheet…</p>
          </div>
        </main>
      </div>
    )
  }

  const total = pages.length

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link to="/dashboard?view=worksheet" className={s.logo}>Mind<span>Craft</span></Link>
        <Link to="/dashboard?view=worksheet" className={s.back}>← Homework</Link>
      </nav>

      <main className={s.page}>
        <div className={s.progress}>
          {titleFromFileName(fileName)} · Page {index + 1} of {total}
        </div>

        <div className={s.card}>
          <ScratchPad
            key={`${fileName}-${index}`}
            height={520}
            fillHeight
            backgroundImage={pages[index]}
          />

          {user?.uid && (
            <div className={ws.callRow}>
              <CallButton
                studentId={user.uid}
                tutorId={tutorId}
                context={{
                  contextType: 'worksheet',
                  pageImage: callImage ?? undefined,
                  pageIndex: index,
                  pageCount: total,
                }}
              />
            </div>
          )}

          <div className={s.navRow}>
            <button
              type="button"
              className={s.prevBtn}
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              ← back
            </button>
            <button
              type="button"
              className={s.submitBtn}
              onClick={() => setIndex(i => Math.min(total - 1, i + 1))}
              disabled={index + 1 >= total}
            >
              Next page →
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
