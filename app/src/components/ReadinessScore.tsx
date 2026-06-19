import { useState, useEffect, useRef } from 'react'
import type { Gap } from '../pages/Prep'
import s from './ReadinessScore.module.css'

const API_BASE = import.meta.env.VITE_WEBHOOK_URL ?? 'https://mindcraft-webhook.vercel.app'

const EXAM_LABEL: Record<string, string> = {
  SAT_MATH:   'SAT Math',
  ACT_MATH:   'ACT Math',
  IB_MATH_AA: 'IB Math AA',
  IB_MATH_AI: 'IB Math AI',
  AP_CALC_AB: 'AP Calc AB',
}

interface PracticeResult {
  conceptId:  string
  attempted:  number
  correct:    number
  finalScore: number
}

interface Props {
  gaps:            Gap[]
  initialGaps?:    Gap[]
  practiceResults?: Record<string, PracticeResult>
  examType:        string
  sessionId:       string
  studentId:       string
  onRestart:       () => void
}

export default function ReadinessScore({ gaps, initialGaps, practiceResults, examType, sessionId, studentId, onRestart }: Props) {
  const [copy,    setCopy]    = useState('')
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Compute weighted readiness
  const totalWeight   = gaps.reduce((s, g) => s + g.examWeight, 0)
  const weightedScore = gaps.reduce((s, g) => s + g.studentScore * g.examWeight, 0)
  const readinessPct  = Math.round((weightedScore / (totalWeight || 1)) * 100)

  // Calibration delta: initial perceived (BKT score) vs actual practice accuracy
  const calibrationRows = (initialGaps ?? [])
    .filter(ig => practiceResults?.[ig.conceptId] !== undefined)
    .map(ig => {
      const pr          = practiceResults![ig.conceptId]
      const perceived   = Math.round(ig.studentScore * 100)
      const actual      = pr.attempted > 0 ? Math.round((pr.correct / pr.attempted) * 100) : null
      const delta       = actual != null ? actual - perceived : null
      return { conceptName: ig.conceptName, perceived, actual, delta, attempted: pr.attempted }
    })
    .filter(r => r.attempted > 0)

  const closedCount   = gaps.filter(g => g.urgency === 'stable').length
  const openCount     = gaps.filter(g => g.urgency !== 'stable').length

  // ── Fetch Claude Sonnet readiness copy ────────────────────────────────────
  useEffect(() => {
    async function fetchCopy() {
      try {
        const res = await fetch(`${API_BASE}/api/gemini`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'readiness-copy',
            sessionId,
            examType,
            readinessPct,
            gaps: gaps.map(g => ({
              conceptName:  g.conceptName,
              urgency:      g.urgency,
              studentScore: g.studentScore,
              examWeight:   g.examWeight,
            })),
            calibration: calibrationRows,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setCopy(data.copy ?? defaultCopy(readinessPct, examType))
        } else {
          setCopy(defaultCopy(readinessPct, examType))
        }
      } catch {
        setCopy(defaultCopy(readinessPct, examType))
      } finally {
        setLoading(false)
      }
    }
    fetchCopy()
  }, [])

  async function copyShareCard() {
    const text = buildShareText(readinessPct, examType, closedCount, openCount)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const ringPct     = Math.min(readinessPct, 100)
  const circumf     = 2 * Math.PI * 54   // r=54
  const strokeDash  = (ringPct / 100) * circumf
  const ringColor   = readinessPct >= 70 ? '#58CC02' : readinessPct >= 45 ? '#F5A623' : '#FF5C5C'

  return (
    <div className={s.shell}>
      <div className={s.inner}>

        <div className={s.brand}>Mind<span>Craft</span></div>

        <h1 className={s.headline}>Session complete.</h1>
        <p className={s.examLabel}>{EXAM_LABEL[examType] ?? examType}</p>

        {/* Readiness ring */}
        <div className={s.ringWrap}>
          <svg className={s.ring} viewBox="0 0 120 120" width="140" height="140">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={ringColor} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumf}`}
              strokeDashoffset={circumf * 0.25}
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div className={s.ringLabel}>
            <span className={s.ringPct} style={{ color: ringColor }}>{readinessPct}%</span>
            <span className={s.ringText}>exam<br/>ready</span>
          </div>
        </div>

        {/* Stats row */}
        <div className={s.stats}>
          <div className={s.stat}>
            <span className={s.statNum} style={{ color: '#58CC02' }}>{closedCount}</span>
            <span className={s.statLabel}>gaps<br/>stabilized</span>
          </div>
          <div className={s.statDivider} />
          <div className={s.stat}>
            <span className={s.statNum} style={{ color: '#F5A623' }}>{openCount}</span>
            <span className={s.statLabel}>gaps<br/>still open</span>
          </div>
          <div className={s.statDivider} />
          <div className={s.stat}>
            <span className={s.statNum} style={{ color: '#fff' }}>{gaps.length}</span>
            <span className={s.statLabel}>total<br/>mapped</span>
          </div>
        </div>

        {/* Calibration delta */}
        {calibrationRows.length > 0 && (
          <div className={s.calibration}>
            <p className={s.calibrationTitle}>Calibration check</p>
            <p className={s.calibrationSub}>How your confidence compared to your actual performance.</p>
            <div className={s.calibrationTable}>
              {calibrationRows.map(row => (
                <div key={row.conceptName} className={s.calibrationRow}>
                  <span className={s.calConcept}>{row.conceptName}</span>
                  <span className={s.calPerceivedWrap}>
                    <span className={s.calLabel}>felt</span>
                    <span className={s.calVal}>{row.perceived}%</span>
                  </span>
                  <span className={s.calArrow}>→</span>
                  <span className={s.calActualWrap}>
                    <span className={s.calLabel}>actual</span>
                    <span className={s.calVal}>{row.actual ?? '—'}%</span>
                  </span>
                  {row.delta != null && (
                    <span className={[
                      s.calDelta,
                      row.delta > 10 ? s.calDeltaPos : row.delta < -10 ? s.calDeltaNeg : s.calDeltaNeutral
                    ].join(' ')}>
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className={s.calibrationNote}>
              A large positive delta means you underestimated yourself. A large negative means you overestimated — the gap is real.
            </p>
          </div>
        )}

        {/* Copy */}
        <div className={s.copyWrap} ref={cardRef}>
          {loading
            ? <div className={s.copyLoading}><div className={s.spinner} /></div>
            : <p className={s.copy}>{copy}</p>
          }
        </div>

        {/* Gap status list */}
        <div className={s.gapList}>
          {gaps.map(g => (
            <div key={g.conceptId} className={s.gapRow}>
              <span className={s.gapDot} style={{
                background: g.urgency === 'stable' ? '#58CC02' : g.urgency === 'moderate' ? '#F5A623' : '#FF5C5C'
              }} />
              <span className={s.gapName}>{g.conceptName}</span>
              <span className={s.gapStatus}>
                {g.urgency === 'stable' ? 'Stabilizing' : g.urgency === 'moderate' ? 'Still forming' : 'Needs repair'}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className={s.actions}>
          <button className={s.btnShare} onClick={copyShareCard} type="button">
            {copied ? '✓ Copied' : 'Copy progress card'}
          </button>
          <button className={s.btnRestart} onClick={onRestart} type="button">
            New session →
          </button>
        </div>

        <p className={s.footNote}>
          Your gap map updates as you practice. Come back — it remembers where you are.
        </p>
      </div>
    </div>
  )
}

function defaultCopy(pct: number, examType: string): string {
  const exam = EXAM_LABEL[examType] ?? examType
  if (pct >= 70) return `You've stabilized the gaps that matter most for ${exam}. The path forward is clearer than when you started. Keep closing.`
  if (pct >= 45) return `You've named your gaps for ${exam} — that's the hard part. Each concept you practice moves this score. The work is forming.`
  return `You found real gaps in ${exam} today. That's not a bad sign — it's the beginning of the repair. The map is drawn. Now we build.`
}

function buildShareText(pct: number, examType: string, closed: number, open: number): string {
  const exam = EXAM_LABEL[examType] ?? examType
  return `MindCraft ${exam} session: ${pct}% exam ready. ${closed} gaps stabilized, ${open} still open. Building from the gaps up.`
}
