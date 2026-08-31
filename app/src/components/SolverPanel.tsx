import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import HomeworkCards, { type HomeworkSession, type HomeworkCard, type OutcomeRecord } from './HomeworkCards'
import ColdCheckPrompt from './ColdCheckPrompt'
import { PRACTICE_CONCEPTS, getQuestions, type Question } from '../lib/questionBank'
import { getIngredientCards, recordOutcomes, type IngredientRecommendResult, type OutcomeInput } from '../lib/mlApi'
import { solveWithGemini, clueWithGemini } from '../lib/geminiHomework'
import { mlIdToLabel, toOntologyId } from '../lib/conceptMap'
import { invalidateKnowledgeGraph } from '../lib/graphCache'
import { sanitizeProblemText, MAX_PROBLEM_CHARS } from '../lib/inputGuards'
import s from '../pages/Practice.module.css'

const HOMEWORK_API = import.meta.env.VITE_HOMEWORK_API_URL ?? 'http://localhost:8001'

export type SolverPhase = 'input' | 'loading' | 'cards' | 'check' | 'done'

type SolverPanelProps = {
  /** Currently selected exam track from the practice flow — steers the LLM
   *  solver's tone/framing (solveWithGemini / clueWithGemini). */
  exam: string
  /** Pre-filled problem text for the cross-mode handoff — e.g. arriving from
   *  the dashboard's homework quick-box, or a stuck practice question's
   *  "Get a step-by-step walkthrough" link. When set, the panel auto-submits
   *  it on arrival instead of showing the empty input screen. */
  initialProblemText?: string
  /** Switch back to practice mode without touching any other practice state
   *  (the solver's own "Browse topics" exit). */
  onBackToPractice: () => void
  /** Switch back to practice mode AND jump straight into the level picker for
   *  a specific concept (the "Practice on this concept from your problem" bridge). */
  onPracticeConcept: (conceptId: string) => void
}

/** Small pixel mascot shown while the solver is analyzing a problem. */
function PixelCraft({ size = 'sm', className = '' }: { size?: 'sm' | 'lg' | 'md'; className?: string }) {
  return (
    <div className={`${s.pixelCraft} ${s[`pixelCraft${size.toUpperCase()}`]} ${className}`} aria-label="Craft mascot" role="img">
      <span className={s.pixelEarLeft} />
      <span className={s.pixelEarRight} />
      <span className={s.pixelHead}>
        <span className={s.pixelMaskLeft} />
        <span className={s.pixelMaskRight} />
        <span className={s.pixelEyeLeft} />
        <span className={s.pixelEyeRight} />
        <span className={s.pixelNose} />
      </span>
      <span className={s.pixelHeart} />
    </div>
  )
}

// Map concept_chip string from homework cards → practice concept id
function chipToConceptId(chip: string): string | null {
  const normalized = chip.toLowerCase().replace(/[\s-]+/g, '_')
  const direct = PRACTICE_CONCEPTS.find(c => c.id === normalized)
  if (direct) return direct.id
  const partial = PRACTICE_CONCEPTS.find(c =>
    normalized.includes(c.id.slice(0, 6)) || c.id.includes(normalized.slice(0, 6))
  )
  return partial?.id ?? null
}

// Fallback: render the deterministic ingredient-pipeline cards in the homework UI
// when the LLM solver is unavailable. concept_chip carries the ontology id so the
// outcome buttons still feed the student graph.
function ingredientResultToSession(
  ing: IngredientRecommendResult,
  problemText: string,
): HomeworkSession {
  const concept = ing.problemFeatures.primary_concept
  const cards: HomeworkCard[] = ing.cards.map((c, i) => ({
    step_number: i + 1,
    total_steps: ing.cards.length,
    type: 'reframe',
    concept_chip: concept,
    content: c.prompt ? `${c.body}\n\n${c.prompt}` : c.body,
    visual_type: 'none',
    visual_data: '',
    is_visual_step: false,
  }))
  return {
    session_id: `ingredient-${Date.now()}`,
    problem_summary: problemText,
    target_concept: mlIdToLabel(concept),
    path_framing: ing.compositionPrompt || 'Work through these building blocks in order.',
    cards,
    paths_explored: 1,
  }
}

export default function SolverPanel({ exam, initialProblemText, onBackToPractice, onPracticeConcept }: SolverPanelProps) {
  const user     = useUser()
  const navigate = useNavigate()
  const fileRef  = useRef<HTMLInputElement>(null)

  // sPhase/problem are seeded synchronously from initialProblemText so a
  // handoff arrival never flashes the empty input screen before the
  // mount effect below kicks off the actual submission.
  const [sPhase,     setSPhase]     = useState<SolverPhase>(initialProblemText ? 'loading' : 'input')
  const [problem,    setProblem]    = useState(initialProblemText ?? '')
  const [solverFile, setSolverFile] = useState<File | null>(null)
  const [session,    setSession]    = useState<HomeworkSession | null>(null)
  const [sResults,   setSResults]   = useState<OutcomeRecord[]>([])
  const [error,      setError]      = useState('')
  const [slowLoad,   setSlowLoad]   = useState(false)

  // The solo-check gate: a self-reported "I get it" queues one fresh,
  // unaided question on that concept before the session can close. Self-
  // report outcomes are still recorded immediately (below) so that write
  // never depends on a bank match existing — the check is an additional,
  // separate signal, not a blocker on the base write. checkQuestion stays
  // null when the concept has no unseen bank item (a real bank gap), and
  // the gate is skipped gracefully rather than treated as an error.
  const [checkQuestion, setCheckQuestion] = useState<Question | null>(null)

  // Cross-mode handoff: a pre-filled problem (dashboard quick-box, or a stuck
  // practice question's walkthrough link) auto-submits once on arrival.
  useEffect(() => {
    if (initialProblemText) {
      void submitProblem(initialProblemText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Solver helpers ────────────────────────────────────────────────────────

  async function submitProblem(rawProblemText: string, file?: File | null) {
    const problemText = sanitizeProblemText(rawProblemText)
    if (!problemText.trim() && !file) return
    setSPhase('loading')
    setError('')
    setSession(null)
    setSlowLoad(false)

    try {
      let data: HomeworkSession

      if (file) {
        const slowTimer = setTimeout(() => setSlowLoad(true), 7000)
        const form = new FormData()
        form.append('student_id', user.uid)
        form.append('problem_text', problemText)
        form.append('subject', 'algebra')
        form.append('file', file)
        const res = await fetch(`${HOMEWORK_API}/submit-with-file`, { method: 'POST', body: form })
        clearTimeout(slowTimer)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { detail?: string }).detail ?? `Server error ${res.status}`)
        }
        data = await res.json()
      } else {
        data = await solveWithGemini(problemText, exam || 'General')
      }

      setSession(data)
      setSPhase('cards')
    } catch (err: unknown) {
      // LLM solver failed (e.g. Anthropic credits exhausted) — fall back to the
      // deterministic ingredient pipeline when we have problem text to classify.
      if (problemText.trim()) {
        const ing = await getIngredientCards(user.uid, problemText, 4)
        if (ing && ing.cards.length > 0) {
          setSession(ingredientResultToSession(ing, problemText))
          setSlowLoad(false)
          setSPhase('cards')
          return
        }
      }
      setSlowLoad(false)
      // The ingredient fallback above needs typed text to classify against —
      // a photo/PDF-only submission has none, so it can't run at all here.
      // Surface that honestly and point at the recovery path that actually
      // exists (type it in) rather than a raw, unactionable error string.
      setError(
        !problemText.trim() && file
          ? 'Photo-based homework help is temporarily unavailable. Try typing your question in the box above instead.'
          : err instanceof Error ? err.message : 'Something went wrong.',
      )
      setSPhase('input')
    }
  }

  // Concepts from homework that the student struggled with (outcome === 0)
  const weakHomeworkConcepts: Array<{ label: string; conceptId: string | null }> =
    sResults
      .filter(r => r.outcome === 0)
      .map(r => ({ label: r.concept_chip, conceptId: chipToConceptId(r.concept_chip) }))

  return (
    <>
      <div className={s.solverHeader}>
        <div className={s.solverHeaderLeft}>
          <h1 className={s.solverPageTitle}>Solver</h1>
          <p className={s.solverPageSub}>Paste or upload a stuck problem for step-by-step hints</p>
        </div>
      </div>
      <div className={s.solverWrap}>
      {sPhase === 'input' && (
        <div className={s.solverPanel}>
          <div className={s.solverCopy}>
            <span className={s.solverEyebrow}>Homework Help</span>
            <h2 className={s.solverTitle}>Turn a stuck problem into visual intuition.</h2>
            <p className={s.solverSub}>
              Paste the problem or upload a photo. Craft builds Socratic hint cards, concept tags, and a visual step when the math needs a graph.
            </p>
            <div className={s.solverFeatureGrid}>
              <span>Step-by-step hints</span>
              <span>Concept map logging</span>
              <span>Manim or SVG visuals</span>
            </div>
          </div>

          <div className={s.solverInputCard}>
            {solverFile ? (
              <div className={s.fileStrip}>
                <span>{solverFile.type === 'application/pdf' ? '📄' : '🖼️'} {solverFile.name}</span>
                <button onClick={() => setSolverFile(null)}>✕</button>
              </div>
            ) : (
              <button className={s.uploadBtn} onClick={() => fileRef.current?.click()}>
                ⬆ Upload image or PDF
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setSolverFile(f) }}
                />
              </button>
            )}
            <textarea
              className={s.solverTextarea}
              placeholder="Paste your problem here... e.g. Solve x² - 5x + 6 = 0"
              value={problem}
              onChange={e => setProblem(sanitizeProblemText(e.target.value))}
              maxLength={MAX_PROBLEM_CHARS}
              rows={5}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitProblem(problem, solverFile) }}
            />
            <button
              className={s.solverBtn}
              onClick={() => submitProblem(problem, solverFile)}
              disabled={!problem.trim() && !solverFile}
            >
              Build my hint path →
            </button>
            {error && (
              <div className={s.errorMsg}>
                {error}
                <button onClick={() => setError('')}>✕</button>
              </div>
            )}
            <div className={s.solverMiniVisual} aria-hidden>
              <span />
              <svg viewBox="0 0 260 120" fill="none">
                <path d="M18 92 H242 M36 104 V18" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
                <path d="M38 88 C82 74 95 28 130 34 C166 40 171 89 222 28" stroke="#C4F547" strokeWidth="4" strokeLinecap="round" />
                <circle cx="130" cy="34" r="5" fill="#4ECDC4" />
                <circle cx="222" cy="28" r="5" fill="#FF6B6B" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {sPhase === 'loading' && (
        <div className={s.solverLoading}>
          <PixelCraft size="md" className={s.solverMascot} />
          <p className={s.solverLoadingText}>Analyzing your problem…</p>
          <div className={s.buildingDots}>
            <span /><span /><span />
          </div>
          {slowLoad && <p className={s.slowMsg}>First load can take 30–60 s — Cloud Run warming up. Hang tight!</p>}
        </div>
      )}

      {sPhase === 'cards' && session && (
        <HomeworkCards
          session={session}
          studentId={user.uid}
          apiBase={HOMEWORK_API}
          fetchClue={(content, concept, num) => clueWithGemini(content, concept, num, exam || 'General')}
          onComplete={r => {
            setSResults(r)
            // Feed homework outcomes into the student graph (concept_chip
            // -> concept id; outcome 1 = solved). Unknown ids skip server-side.
            const outs = r.map(rec => ({
              // chipToConceptId handles LLM label chips; the ?? passes through
              // ontology ids from the ingredient fallback. Backend skips invalid.
              conceptId: toOntologyId(chipToConceptId(rec.concept_chip) ?? rec.concept_chip),
              succeeded: rec.outcome === 1,
            }))
            void recordOutcomes(user.uid, outs)
            invalidateKnowledgeGraph(user.uid)

            // Solo-check gate: self-report says "I get it" is a feeling, not
            // proof (Bastani et al. 2025 — self-report can't detect a crutch
            // effect). Pick one fresh, unaided question on the first
            // self-reported-solved concept before letting the session close.
            const solvedConceptId = outs.find(o => o.succeeded)?.conceptId
            const pool = solvedConceptId ? getQuestions(solvedConceptId, 1, 1, []) : []
            if (pool.length > 0) {
              setCheckQuestion(pool[0])
              setSPhase('check')
            } else {
              setSPhase('done')
            }
          }}
          onNewProblem={() => { setProblem(''); setSession(null); setSPhase('input') }}
        />
      )}

      {sPhase === 'check' && checkQuestion && (
        <ColdCheckPrompt
          question={checkQuestion}
          onResult={({ correct, selectedIndex }) => {
            void recordOutcomes(user.uid, [{
              conceptId: checkQuestion.conceptId,
              score: correct ? 1 : 0,
              questionId: checkQuestion.id,
              selectedChoiceIndex: selectedIndex,
              level: checkQuestion.level,
            }])
            invalidateKnowledgeGraph(user.uid)
            setCheckQuestion(null)
            setSPhase('done')
          }}
        />
      )}

      {sPhase === 'done' && (
        <div className={s.completeWrap}>
          <div className={s.completeStars}>✦</div>
          <h2 className={s.completeTitle}>Session complete</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
            {sResults.filter(r => r.outcome === 1).length} of {sResults.length} concepts solid
          </p>

          {/* ── Homework → practice bridge ── */}
          {weakHomeworkConcepts.length > 0 && (
            <div className={s.weakConceptsBlock}>
              <div className={s.weakConceptsTitle}>
                🎯 Concepts to practice from this problem:
              </div>
              <div className={s.weakConceptsList}>
                {weakHomeworkConcepts.map((wc, i) => (
                  <div key={i} className={s.weakConceptRow}>
                    <span className={s.weakConceptChip}>{wc.label}</span>
                    {wc.conceptId ? (
                      <button
                        className={s.weakPracticeBtn}
                        onClick={() => onPracticeConcept(wc.conceptId!)}
                      >
                        Practice →
                      </button>
                    ) : (
                      <button
                        className={s.weakPracticeBtn}
                        onClick={onBackToPractice}
                      >
                        Browse topics →
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className={s.weakConceptsHint}>
                These concepts came up in your problem and need more work.
                Practice them now to lock in the understanding.
              </p>
            </div>
          )}

          <div className={s.completeActions}>
            <button className={s.btnSecondary} onClick={() => { setProblem(''); setSPhase('input') }}>
              Try another problem
            </button>
            <button className={s.btnPrimary} onClick={() => navigate('/knowledge-graph')}>
              View Knowledge Graph →
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
