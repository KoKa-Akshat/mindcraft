/**
 * /prep — Student panic loop entry point.
 *
 * State machine: input → diagnosing → gap_map → practicing → done
 * Session persistence: if an in-progress session exists in Firestore,
 * the return-flow banner shows before the input screen.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import PanicInput       from '../components/PanicInput'
import GapMap           from '../components/GapMap'
import PracticeCards    from '../components/PracticeCards'
import ReadinessScore   from '../components/ReadinessScore'
import s from './Prep.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ExamType = 'SAT_MATH' | 'ACT_MATH' | 'IB_MATH_AA' | 'IB_MATH_AI' | 'AP_CALC_AB'

export interface Gap {
  conceptId:          string
  conceptName:        string
  urgency:            'critical' | 'moderate' | 'stable'
  studentScore:       number
  examWeight:         number
  brokenPrerequisite: string
  bridgeConcept:      string
  practiceCount:      number
}

export interface DiagnoseResult {
  gaps:                Gap[]
  sessionId:           string
  examType:            string
  diagnosisConfidence: 'high' | 'medium' | 'low'
  mode:                'triage' | 'foundation'
}

export interface PracticeResult {
  conceptId:  string
  attempted:  number
  correct:    number
  finalScore: number
}

type Stage = 'return_check' | 'input' | 'diagnosing' | 'gap_map' | 'practicing' | 'done'

interface ResumeInfo {
  sessionId:   string
  conceptName: string
  examType:    string
}

const EXAM_LABEL: Record<string, string> = {
  SAT_MATH:   'SAT Math',
  ACT_MATH:   'ACT Math',
  IB_MATH_AA: 'IB Math AA',
  IB_MATH_AI: 'IB Math AI',
  AP_CALC_AB: 'AP Calc AB',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Prep() {
  const user     = useUser()
  const navigate = useNavigate()

  const [stage,          setStage]          = useState<Stage>('return_check')
  const [result,         setResult]         = useState<DiagnoseResult | null>(null)
  const [activeGapIdx,   setActiveGapIdx]   = useState(0)
  const [liveGaps,       setLiveGaps]       = useState<Gap[]>([])
  const [initialGaps,    setInitialGaps]    = useState<Gap[]>([])
  const [practiceResults, setPracticeResults] = useState<Record<string, PracticeResult>>({})
  const [resumeInfo,     setResumeInfo]     = useState<ResumeInfo | null>(null)

  // ── Check for in-progress session on mount ─────────────────────────────────
  useEffect(() => {
    async function checkResume() {
      if (!user) { setStage('input'); return }
      try {
        const q = query(
          collection(db, 'users', user.uid, 'prepSessions'),
          where('status', '==', 'in_progress'),
          orderBy('createdAt', 'desc'),
          limit(1)
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          const ref  = snap.docs[0].data()
          const full = await getDoc(doc(db, 'sessions', ref.sessionId))
          if (full.exists()) {
            const data = full.data()
            const topGap = data.gaps?.[0]
            setResumeInfo({
              sessionId:   ref.sessionId,
              conceptName: topGap?.conceptName ?? 'your top gap',
              examType:    ref.examType,
            })
            setStage('return_check')
            return
          }
        }
      } catch { /* ignore */ }
      setStage('input')
    }
    checkResume()
  }, [user])


  // ── Diagnosis complete ─────────────────────────────────────────────────────
  function onDiagnosed(r: DiagnoseResult) {
    setResult(r)
    setLiveGaps(r.gaps)
    setInitialGaps(r.gaps)   // snapshot before practice mutates scores
    setPracticeResults({})
    setStage('gap_map')
  }

  // ── Start practicing on a gap ──────────────────────────────────────────────
  function startPractice(gapIdx: number) {
    setActiveGapIdx(gapIdx)
    setStage('practicing')
  }

  // ── Live gap mastery update (3 correct in a row → urgency drops) ───────────
  function onMasteryUpdate(conceptId: string, newScore: number) {
    setLiveGaps(prev => prev.map(g => {
      if (g.conceptId !== conceptId) return g
      const updated = { ...g, studentScore: newScore }
      if      (newScore >= 0.72) updated.urgency = 'stable'
      else if (newScore >= 0.45) updated.urgency = 'moderate'
      else                       updated.urgency = 'critical'
      return updated
    }))
  }

  // ── Gap practice complete → accumulate results ───────────────────────────
  function onPracticeComplete(pr: PracticeResult) {
    setPracticeResults(prev => ({ ...prev, [pr.conceptId]: pr }))
    setStage('done')
  }

  // ── Resume flow ───────────────────────────────────────────────────────────
  async function handleResume() {
    if (!resumeInfo) return
    try {
      const snap = await getDoc(doc(db, 'sessions', resumeInfo.sessionId))
      if (snap.exists()) {
        const data = snap.data()
        setResult({
          gaps:                data.gaps,
          sessionId:           resumeInfo.sessionId,
          examType:            resumeInfo.examType,
          diagnosisConfidence: data.diagnosisConfidence ?? 'medium',
          mode:                data.mode ?? 'foundation',
        })
        setLiveGaps(data.gaps)
        setStage('gap_map')
      }
    } catch {
      setStage('input')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (stage === 'return_check' && resumeInfo) {
    return (
      <div className={s.returnWrap}>
        <div className={s.returnCard}>
          <div className={s.returnIcon}>↩</div>
          <h2 className={s.returnTitle}>Welcome back.</h2>
          <p className={s.returnCopy}>
            Your <strong>{resumeInfo.conceptName}</strong> gap is still open
            for <strong>{EXAM_LABEL[resumeInfo.examType] ?? resumeInfo.examType}</strong>.
            Pick up where you left off?
          </p>
          <div className={s.returnBtns}>
            <button className={s.btnContinue} onClick={handleResume}>Continue →</button>
            <button className={s.btnFresh}    onClick={() => { setResumeInfo(null); setStage('input') }}>Start fresh</button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'input' || stage === 'diagnosing') {
    return (
      <PanicInput
        diagnosing={stage === 'diagnosing'}
        onDiagnosing={() => setStage('diagnosing')}
        onDiagnosed={onDiagnosed}
        studentId={user?.uid}
      />
    )
  }

  if (stage === 'gap_map' && result) {
    return (
      <GapMap
        gaps={liveGaps}
        examType={result.examType}
        sessionId={result.sessionId}
        studentId={user?.uid ?? ''}
        onStartPractice={startPractice}
      />
    )
  }

  if (stage === 'practicing' && result) {
    const gap = liveGaps[activeGapIdx]
    return (
      <PracticeCards
        gap={gap}
        examType={result.examType as ExamType}
        sessionId={result.sessionId}
        studentId={user?.uid ?? ''}
        mode={result.mode ?? 'foundation'}
        allGaps={liveGaps}
        onMasteryUpdate={onMasteryUpdate}
        onComplete={onPracticeComplete}
        onBackToMap={() => setStage('gap_map')}
      />
    )
  }

  if (stage === 'done' && result) {
    return (
      <ReadinessScore
        gaps={liveGaps}
        initialGaps={initialGaps}
        practiceResults={practiceResults}
        examType={result.examType}
        sessionId={result.sessionId}
        studentId={user?.uid ?? ''}
        onRestart={() => { setResult(null); setLiveGaps([]); setInitialGaps([]); setPracticeResults({}); setStage('input') }}
      />
    )
  }

  return <div className={s.loading}><div className={s.spinner} /></div>
}
