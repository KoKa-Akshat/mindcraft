import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { doc, updateDoc, deleteField, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { usePracticePathQueue } from '../lib/practicePathQueue'
import { isDiagnosticComplete } from '../lib/practiceState'
import { fetchPracticeHubRecommendations } from '../lib/recommendNextConcept'
import { worldUrl } from '../lib/siteUrls'
import { invalidateKnowledgeGraph } from '../lib/graphCache'
import HeroBar from '../components/HeroBar'
import PawHub from '../components/PawHub'
import PracticeLearningPathMini from '../components/PracticeLearningPathMini'
import ConstellationGpsExplorer from '../components/ConstellationGpsExplorer'
import DashboardRoutePanel from '../components/DashboardRoutePanel'
import DashboardNotesPanel from '../components/DashboardNotesPanel'
import DashboardHomeworkPanel from '../components/DashboardHomeworkPanel'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function ViewToggle({ onPick3D }: { onPick3D: () => void }) {
  return (
    <div className={s.topActions}>
      <div className={s.viewToggle} aria-label="Dashboard view switcher">
        <button className={s.toggleBtn} onClick={onPick3D}>3D</button>
        <button className={`${s.toggleBtn} ${s.toggleActive}`} disabled>Web</button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const data = useStudentData(user)
  const uid = user?.uid ?? ''
  const path = usePracticePathQueue(uid)

  const [diagChecked, setDiagChecked] = useState(false)
  const [plotConceptId, setPlotConceptId] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)

  async function handleStartOver() {
    if (!window.confirm('Wipe your diagnostic data and start fresh?')) return
    setRestarting(true)
    try {
      await updateDoc(doc(db, 'users', uid), {
        diagnosticCompleted:   deleteField(),
        diagnosticCompletedAt: deleteField(),
        diagnostic:            deleteField(),
        goals:                 deleteField(),
        practiceDrafts:        deleteField(),
        practiceDraftAt:       deleteField(),
      })
      const [interSnap, learnSnap] = await Promise.all([
        getDocs(query(collection(db, 'interactions'),    where('studentId', '==', uid))),
        getDocs(query(collection(db, 'learning_events'), where('studentId', '==', uid))),
      ])
      const all = [...interSnap.docs, ...learnSnap.docs]
      for (let i = 0; i < all.length; i += 499) {
        const b = writeBatch(db)
        all.slice(i, i + 499).forEach(d => b.delete(d.ref))
        await b.commit()
      }
      await deleteDoc(doc(db, 'knowledge_graphs', uid))
      invalidateKnowledgeGraph(uid)
      localStorage.removeItem('mc-diag-done')
      sessionStorage.removeItem('mc-clicked-me')
      document.cookie = 'mc_diag_done=0; domain=.web.app; path=/; max-age=0; SameSite=Lax'
      document.cookie = 'mc_diag_done=0; path=/; max-age=0'
      window.location.href = '/practice'
    } catch (e) {
      console.error('[StartOver] failed', e)
      setRestarting(false)
    }
  }

  const view = searchParams.get('view') ?? 'practice'
  const gpsMode = view === 'gps'
  const routeMode = view === 'route'
  const notesMode = view === 'notes'
  const homeworkMode = view === 'homework'
  const panelMode = gpsMode || routeMode || notesMode || homeworkMode

  const conceptParam = searchParams.get('concept')
  const targetParam = searchParams.get('target')
  const learnNextParam = searchParams.get('learnNext') === '1'

  function openPractice() {
    navigate('/dashboard', { replace: true })
  }

  function openGps() {
    navigate('/dashboard?view=gps', { replace: true })
  }

  function openRoute(targetId: string) {
    navigate(`/dashboard?view=route&target=${encodeURIComponent(targetId)}`, { replace: true })
  }

  function openNotes() {
    navigate('/dashboard?view=notes', { replace: true })
  }

  function openHomework() {
    navigate('/dashboard?view=homework', { replace: true })
  }

  function closePanel() {
    navigate('/dashboard', { replace: true })
  }

  function goTo3DWorld() {
    localStorage.setItem('dashboardView', '3d')
    const base = worldUrl(uid)
    window.location.href = diagChecked ? `${base}&diagDone=1` : base
  }

  useEffect(() => { localStorage.setItem('dashboardView', 'web') }, [])

  useEffect(() => {
    if (!gpsMode) {
      setPlotConceptId(null)
      return
    }
    if (conceptParam) {
      setPlotConceptId(conceptParam)
      return
    }
    if (learnNextParam && uid) {
      let cancelled = false
      void fetchPracticeHubRecommendations(uid).then(rec => {
        if (!cancelled) setPlotConceptId(rec.learn?.conceptId ?? null)
      })
      return () => { cancelled = true }
    }
    setPlotConceptId(null)
  }, [gpsMode, conceptParam, learnNextParam, uid])

  useEffect(() => {
    let cancelled = false
    isDiagnosticComplete(user.uid).then(done => {
      if (cancelled) return
      if (!done) navigate('/practice', { state: { examHelp: true } })
      else {
        setDiagChecked(true)
        document.cookie = 'mc_diag_done=1; domain=.web.app; path=/; max-age=31536000; SameSite=Lax'
      }
    })
    return () => { cancelled = true }
  }, [user.uid, navigate])

  return (
    <div className={s.shell}>
      <main className={s.page}>
        <HeroBar
          greeting={greeting()}
          name={data.displayName}
          nextSession={data.nextSession}
          tutorId={data.tutorId}
          showUserControls
          minimal
          showBooking={diagChecked}
          onBooking={() => navigate('/book')}
        />

        {(!diagChecked || data.loading) ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <>
            <ViewToggle onPick3D={goTo3DWorld} />

            <div className={`${s.stage} ${panelMode ? s.stageGps : ''}`}>
              <div className={s.pawCol}>
                <motion.div
                  className={s.pawWrap}
                  initial={{ opacity: 0, x: -32 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 70, damping: 16 }}
                >
                  <PawHub
                    userId={uid}
                    layout="side"
                    compact
                    onPracticeClick={openPractice}
                    onGpsClick={openGps}
                    onNotesClick={openNotes}
                    onHomeworkClick={openHomework}
                  />
                </motion.div>
              </div>

              <div className={panelMode ? s.gpsCol : s.pathCol}>
                {routeMode && targetParam ? (
                  <DashboardRoutePanel
                    targetId={targetParam}
                    onBack={() => navigate(conceptParam
                      ? `/dashboard?view=gps&concept=${encodeURIComponent(conceptParam)}`
                      : '/dashboard?view=gps')}
                  />
                ) : notesMode ? (
                  <DashboardNotesPanel onBack={closePanel} />
                ) : homeworkMode ? (
                  <DashboardHomeworkPanel onBack={closePanel} />
                ) : gpsMode ? (
                  <ConstellationGpsExplorer
                    embedded
                    onBack={closePanel}
                    autoPlotConceptId={plotConceptId}
                    onStartRoute={openRoute}
                  />
                ) : (
                  <PracticeLearningPathMini
                    concepts={path.pathConcepts}
                    activeConceptId={path.activeConceptId}
                    progressPct={path.progressPct}
                    completedCount={path.completedOnPath}
                    totalCount={path.pathQueue.length}
                    exam={path.exam}
                    loading={path.loading}
                  />
                )}
              </div>
            </div>
          </>
        )}
        <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
          <button
            onClick={handleStartOver}
            disabled={restarting}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.35)',
              fontSize: 12,
              padding: '6px 16px',
              cursor: restarting ? 'default' : 'pointer',
            }}
          >
            {restarting ? 'Clearing…' : '↺ Start Over'}
          </button>
        </div>
      </main>
    </div>
  )
}
