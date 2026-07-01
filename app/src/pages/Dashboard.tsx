import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { usePracticePathQueue } from '../lib/practicePathQueue'
import { isDiagnosticComplete, markDiagnosticComplete } from '../lib/practiceState'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import type { Confidence } from '../lib/bridgePractice'
import HeroBar from '../components/HeroBar'
import MasteryBadge from '../components/MasteryBadge'
import PawHub from '../components/PawHub'
import NextConceptCard from '../components/NextConceptCard'
import ConstellationGpsExplorer from '../components/ConstellationGpsExplorer'
import DashboardRoutePanel from '../components/DashboardRoutePanel'
import DashboardNotesPanel from '../components/DashboardNotesPanel'
import DashboardHomeworkPanel from '../components/DashboardHomeworkPanel'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
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

  const view = searchParams.get('view') ?? 'practice'
  const gpsMode = view === 'gps'
  const routeMode = view === 'route'
  const notesMode = view === 'notes'
  const homeworkMode = view === 'homework'
  const panelMode = gpsMode || routeMode || notesMode || homeworkMode

  const conceptParam = searchParams.get('concept')
  const targetParam = searchParams.get('target')

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
    setPlotConceptId(null)
  }, [gpsMode, conceptParam])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const diag = searchParams.get('diag')
      if (diag) {
        try {
          const { exam, confidence, goals, excluded } = JSON.parse(diag) as {
            exam?: string
            confidence: Record<string, Confidence>
            goals?: { tags: string[]; text: string }
            excluded?: string[]
          }
          await applyDiagnosticConfidence(user.uid, exam ?? 'ACT', confidence, goals, {
            excludedConcepts: excluded ?? [],
          })
        } catch { /* fall through — worst case they get the gap-scan */ }
        if (cancelled) return
        navigate('/dashboard', { replace: true })
        setDiagChecked(true)
        document.cookie = 'mc_diag_done=1; domain=.web.app; path=/; max-age=31536000; SameSite=Lax'
        return
      }

      let done = await isDiagnosticComplete(user.uid)
      if (!done && localStorage.getItem('mc-diag-done') === '1') {
        await markDiagnosticComplete(user.uid, { exam: 'ACT', confidenceMap: {} })
        done = true
      }
      if (cancelled) return
      if (!done) navigate('/practice', { state: { examHelp: true } })
      else {
        setDiagChecked(true)
        document.cookie = 'mc_diag_done=1; domain=.web.app; path=/; max-age=31536000; SameSite=Lax'
      }
    })()
    return () => { cancelled = true }
  }, [user.uid, navigate, searchParams])

  return (
    <div className={s.shell}>
      <main className={s.page}>
        <div className={s.heroRow}>
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
          {diagChecked && <MasteryBadge userId={uid} />}
        </div>

        {(!diagChecked || data.loading) ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <>
            <div className={s.stage}>
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

              <div className={s.panelCol}>
                <div className={s.panelSlot}>
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
                    <NextConceptCard
                      concept={path.pathConcepts[0] ?? null}
                      loading={path.loading}
                      exam={path.exam}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
