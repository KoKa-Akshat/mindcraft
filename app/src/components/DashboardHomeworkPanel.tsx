/**
 * Embedded homework help — problem input that opens the full solver.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import s from '../pages/ConstellationGpsLab.module.css'
import n from './DashboardPanels.module.css'

export default function DashboardHomeworkPanel({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate()
  const [problem, setProblem] = useState('')

  function openSolver() {
    const text = problem.trim()
    if (!text) return
    navigate('/practice', { state: { problemText: text } })
  }

  return (
    <div className={s.embeddedRoot}>
      <div className={s.embeddedHeader}>
        <button type="button" className={s.embeddedBack} onClick={onBack}>
          ← Back to hub
        </button>
        <div className={s.embeddedTitleRow}>
          <h2 className={s.embeddedTitle}>Homework Help</h2>
          <span className={s.embeddedSub}>Socratic hints · no spoilers</span>
        </div>
      </div>

      <div className={s.panelRoute}>
        <div className={n.homeworkCopy}>
          <p>
            Paste a stuck problem. Craft builds step-by-step hint cards and logs
            which concepts you’re working through — same flow as the full solver.
          </p>
        </div>

        <div className={n.homeworkTags}>
          <span className={n.homeworkTag}>Step hints</span>
          <span className={n.homeworkTag}>Concept tags</span>
          <span className={n.homeworkTag}>Visual scaffolds</span>
        </div>

        <textarea
          className={n.homeworkInput}
          placeholder="Paste your problem… e.g. Solve 2x + 5 = 13"
          value={problem}
          onChange={e => setProblem(e.target.value)}
          rows={5}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) openSolver()
          }}
        />

        <button
          type="button"
          className={s.btnPrimary}
          disabled={!problem.trim()}
          onClick={openSolver}
        >
          Build my hint path →
        </button>

        <button
          type="button"
          className={s.btnGhost}
          style={{ marginTop: 8 }}
          onClick={() => navigate('/practice', { state: { homeworkHelp: true } })}
        >
          Open full problem solver →
        </button>
      </div>
    </div>
  )
}
