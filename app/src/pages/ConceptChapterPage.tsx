import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import conceptStoriesRaw from '../data/conceptStories.json'
import contextFramesRaw from '../data/questionContextFrames.json'
import { getQuestions, questionCount } from '../lib/questionBank'
import { canonicalConceptId } from '../lib/conceptAliases'
import InteractiveWidget from '../components/InteractiveWidget'
import ScratchPad from '../components/ScratchPad'
import s from './ConceptChapterPage.module.css'

// ── Types ───────────────────────────────────────────────────────────────────

type CS = {
  conceptId: string
  conceptName: string
  story: string
  ingredientStories: Record<string, unknown>
}
const DB = conceptStoriesRaw as unknown as Record<string, CS>

type ContextFrame = {
  protagonist: string
  settingLine: string
  questionBridge: string
  diceFrame: string | null
  spinnerFrame: string | null
}
const FRAMES = contextFramesRaw as unknown as Record<string, ContextFrame>

// Resolve any short/legacy concept ID to the canonical ontology ID,
// then look up in DB (conceptStories.json keys = canonical IDs).
// Falls back to a synthetic story so the chapter page never hard-errors.
function resolveId(conceptId: string): string {
  return canonicalConceptId(conceptId)
}

// FRAME_ALIAS handles the few cases where frames use a different key than
// the canonical concept ID (e.g. frames use 'basic_probability', not
// 'probability'; 'representation_translation' instead of 'coordinate_geometry').
const FRAME_ALIAS: Record<string, string> = {
  coordinate_geometry: 'representation_translation',
  absolute_value:      'algebraic_manipulation',
}

function getFrame(rawId: string): ContextFrame | null {
  const id = resolveId(rawId)
  return FRAMES[id] ?? FRAMES[FRAME_ALIAS[rawId] ?? ''] ?? FRAMES[FRAME_ALIAS[id] ?? ''] ?? null
}

function makeSyntheticStory(name: string, conceptId: string): CS {
  return {
    conceptId,
    conceptName: name,
    story: `${name} is a foundational concept in mathematics. Work through the questions below to build your understanding — each one isolates a key idea so you can see exactly where your reasoning holds and where it needs sharpening.`,
    ingredientStories: {},
  }
}

function lookupStory(rawId: string): CS {
  const canonical = resolveId(rawId)
  return DB[canonical] ?? DB[rawId] ?? makeSyntheticStory(
    canonical.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    canonical,
  )
}

// ── Cluster identity ─────────────────────────────────────────────────────────

type Cluster = 'algebra' | 'geometry' | 'functions' | 'data'

// Cluster accent per concept — keys must match canonical ontology concept ids.
// Source of truth: ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json
// See DASHBOARD_CONCEPT_ID_CONSISTENCY_FIX.md when adding/renaming concepts.
const CLUSTER_MAP: Record<string, Cluster> = {
  fractions_decimals: 'algebra',  ratios_proportions: 'algebra',
  percent_ratio: 'algebra',       order_of_operations: 'algebra',
  basic_equations: 'algebra',     linear_equations: 'algebra',
  linear_inequalities: 'algebra', systems_of_linear_equations: 'algebra',
  exponent_rules: 'algebra',      radical_expressions: 'algebra',
  absolute_value: 'algebra',      integer_operations: 'algebra',
  polynomial_operations: 'algebra', factors_multiples: 'algebra',
  number_properties: 'algebra',   rational_expressions: 'algebra',
  algebraic_manipulation: 'algebra', measurement_units: 'algebra',
  factoring_polynomials: 'algebra', polynomials: 'algebra',
  quadratic_equations: 'algebra',
  act_strategy: 'algebra', representation_translation: 'algebra',
  functions_basics: 'functions',  function_notation: 'functions',
  quadratic_functions: 'functions', exponential_functions: 'functions',
  logarithms: 'functions',        composite_inverse: 'functions',
  trigonometry_basics: 'functions', sequences_series: 'functions',
  logarithmic_functions: 'functions',
  applications_of_derivatives: 'functions', applications_of_integrals: 'functions',
  derivatives: 'functions', integrals: 'functions', limits_continuity: 'functions',
  right_triangle_geometry: 'geometry', triangles_similarity: 'geometry',
  circles: 'geometry',            coordinate_geometry: 'geometry',
  geometric_transformations: 'geometry', solid_geometry: 'geometry',
  area_volume: 'geometry', circles_geometry: 'geometry',
  lines_angles: 'geometry', triangles_congruence: 'geometry',
  conic_sections: 'geometry', vectors: 'geometry',
  statistics_basics: 'data',      probability: 'data',
  data_interpretation: 'data',    regression: 'data',
  counting_combinatorics: 'data', complex_numbers: 'data',
  matrices: 'data',
  quadratics: 'functions',
  quadratic: 'functions',
  statistics: 'data',
  trigonometry: 'functions',
  basic_probability: 'data', descriptive_statistics: 'data',
  inferential_statistics: 'data', probability_distributions: 'data',
}

const CLUSTER_THEME = {
  algebra:   { bg: '#f5eedb', paper: '#faf5ec', ink: '#3d2f10', accent: '#8b6914', dim: '#a0906a', chip: '#8b6914', lineBg: 'rgba(139,105,20,0.09)' },
  geometry:  { bg: '#e8eef5', paper: '#f1f5fa', ink: '#172333', accent: '#1e5f8a', dim: '#4a7396', chip: '#1e5f8a', lineBg: 'rgba(30,95,138,0.09)' },
  functions: { bg: '#eaf2e8', paper: '#f1f7f0', ink: '#1a2c16', accent: '#2d6924', dim: '#4a7a42', chip: '#2d6924', lineBg: 'rgba(45,105,36,0.09)' },
  data:      { bg: '#f2ece9', paper: '#f8f3f1', ink: '#321614', accent: '#7a2e26', dim: '#8c5550', chip: '#7a2e26', lineBg: 'rgba(122,46,38,0.09)' },
}

// ── Cluster glyphs ───────────────────────────────────────────────────────────

const GLYPH: Record<Cluster, React.ReactNode> = {
  algebra: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="40" y1="16" x2="40" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8"  y1="36" x2="72" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="12" cy="36" r="9"  stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="68" cy="36" r="9"  stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
  ),
  geometry: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4"/>
      <polygon points="40,12 67,67 13,67" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
    </svg>
  ),
  functions: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="8" y1="72" x2="72" y2="72" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="8"  x2="8"  y2="72" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 70 C22 70 18 18 40 23 C56 26 52 62 72 57" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="40" cy="23" r="3.5" fill="currentColor"/>
    </svg>
  ),
  data: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="8" y1="72" x2="72" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="8" y1="8"  x2="8"  y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="8" y1="68" x2="72" y2="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.55"/>
      {[{x:16,y:60},{x:26,y:52},{x:36,y:44},{x:46,y:36},{x:56,y:26},{x:66,y:20}].map((p,i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="currentColor"/>
      ))}
    </svg>
  ),
}

// ── Page spec ────────────────────────────────────────────────────────────────

type PageSpec =
  | { kind: 'cover' }
  | { kind: 'story'; paras: string[]; isFirst: boolean; pageNum: number }
  | { kind: 'question'; qIdx: number }

function buildSpecs(text: string, qCount: number): PageSpec[] {
  const paras = text.split('\n').map(p => p.trim()).filter(p => p.length > 15)
  const specs: PageSpec[] = [{ kind: 'cover' }]
  let storyPage = 0
  for (let i = 0; i < paras.length; i += 2) {
    specs.push({ kind: 'story', paras: paras.slice(i, i + 2), isFirst: i === 0, pageNum: ++storyPage })
  }
  for (let i = 0; i < qCount; i++) specs.push({ kind: 'question', qIdx: i })
  return specs
}

function chapterNum(conceptId: string): number {
  return Object.keys(DB).indexOf(conceptId) + 1
}

// ── Choice text formatter — clean up "33.333 ... %" etc. ─────────────────────

function fmtChoice(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*\.\.\.\s*(\d*)/g, '$1…$2')
    .replace(/\s+(%|°)/g, '$1')
    .replace(/(\d)\s+\/\s+(\d)/g, '$1/$2')
    .trim()
}

// ── Question text renderer — pulls out (Diagram: ...) callouts ───────────────

function QuestionContent({ text, ink, accent }: { text: string; ink: string; accent: string }) {
  const parts = text.split(/(\(Diagram:[^)]{0,300}\))/g)
  return (
    <p className={s.qText} style={{ color: ink }}>
      {parts.map((part, i) => {
        const m = part.match(/^\(Diagram: (.+)\)$/)
        if (m) {
          return (
            <span key={i} className={s.diagramBox} style={{ borderLeftColor: accent }}>
              <span className={s.diagramIcon} aria-hidden>⬡</span>
              {m[1]}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

// ── Calculator ───────────────────────────────────────────────────────────────

function Calculator() {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<number | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [fresh, setFresh] = useState(true)

  const press = (val: string) => {
    if ('0123456789.'.includes(val)) {
      if (val === '.' && display.includes('.')) return
      setDisplay(d => fresh ? val === '.' ? '0.' : val : d === '0' ? val : d + val)
      setFresh(false)
    } else if (val === '←') {
      setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0')
    } else if (val === 'C') {
      setDisplay('0'); setPrev(null); setOp(null); setFresh(true)
    } else if (val === '±') {
      setDisplay(d => d === '0' ? '0' : d.startsWith('-') ? d.slice(1) : '-' + d)
    } else if (val === '√') {
      const n = parseFloat(display)
      setDisplay(n < 0 ? 'Error' : String(parseFloat(Math.sqrt(n).toFixed(8))))
      setFresh(true)
    } else if (['+', '−', '×', '÷'].includes(val)) {
      setPrev(parseFloat(display)); setOp(val); setFresh(true)
    } else if (val === '=' && prev !== null && op) {
      const n = parseFloat(display)
      let r: number
      if (op === '+') r = prev + n
      else if (op === '−') r = prev - n
      else if (op === '×') r = prev * n
      else r = n === 0 ? NaN : prev / n
      setDisplay(isFinite(r) ? String(parseFloat(r.toFixed(10))) : 'Error')
      setPrev(null); setOp(null); setFresh(true)
    }
  }

  const BTNS = [
    ['C', '←', '√', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['±', '0', '.', '='],
  ]

  return (
    <div className={s.calcPanel}>
      <div className={s.calcDisplay}>{display}</div>
      {BTNS.map((row, ri) => (
        <div key={ri} className={s.calcRow}>
          {row.map(btn => (
            <button
              key={btn}
              className={`${s.calcBtn} ${btn === '=' ? s.calcEq : ''} ${['C','←','√','÷','×','−','+'].includes(btn) ? s.calcOp : ''}`}
              onClick={() => press(btn)}
            >
              {btn}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ConceptChapterPage() {
  const { conceptId = '' } = useParams<{ conceptId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fromDashboard = Boolean((location.state as { fromDashboard?: boolean } | null)?.fromDashboard)

  const cs = lookupStory(conceptId)
  const cluster = CLUSTER_MAP[conceptId] ?? 'algebra'
  const theme = CLUSTER_THEME[cluster]
  const glyph = GLYPH[cluster]
  const ch = chapterNum(conceptId)

  const questions = useMemo(() => {
    if (!conceptId) return []
    const qs = [...getQuestions(conceptId, 1, 4), ...getQuestions(conceptId, 2, 4)]
    const seen = new Set<string>()
    return qs.filter(q => { if (seen.has(q.question)) return false; seen.add(q.question); return true }).slice(0, 4)
  }, [conceptId])

  const totalQs = questionCount(conceptId, 1) + questionCount(conceptId, 2) + questionCount(conceptId, 3)
  const specs = useMemo(() => buildSpecs(cs.story, Math.min(questions.length, 4)), [cs.story, questions.length])

  const [pageIdx, setPageIdx] = useState(0)
  const [dir, setDir] = useState<'f' | 'b'>('f')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [scratchRev, setScratchRev] = useState<Record<number, number>>({})
  // hintsShownPerQ tracks how many hints have been revealed per question index
  const [hintsShownPerQ, setHintsShownPerQ] = useState<Record<number, number>>({})
  // showWriteNudge: show writing prompt after 8s idle on question with empty notes
  const [showWriteNudge, setShowWriteNudge] = useState(false)

  // Show write nudge after 8s on a question page if notes are still empty
  const currentSpec = specs[pageIdx]
  useEffect(() => {
    setShowWriteNudge(false)
    if (currentSpec?.kind !== 'question') return
    const { qIdx } = currentSpec as { kind: 'question'; qIdx: number }
    if (notes[qIdx]) return
    const t = setTimeout(() => setShowWriteNudge(true), 8000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdx])

  // Floating panels
  const [showCalc, setShowCalc] = useState(false)
  const [showPing, setShowPing] = useState(false)
  const [pingMsg, setPingMsg] = useState('')
  const [pingSent, setPingSent] = useState(false)

  const goTo = (i: number, d: 'f' | 'b') => {
    if (i < 0) { navigate(-1); return }
    if (i >= specs.length) {
      navigate('/practice', { state: { conceptId } })
      return
    }
    setDir(d)
    setPageIdx(i)
  }

  const sendPing = () => {
    // Stub: would POST to Firestore or a notifications endpoint
    setPingSent(true)
    setTimeout(() => { setShowPing(false); setPingSent(false); setPingMsg('') }, 2200)
  }

  const spec = specs[pageIdx]
  const isLast = pageIdx === specs.length - 1
  const storyPageCount = specs.filter(p => p.kind === 'story').length

  return (
    <div
      className={s.desk}
      style={{ '--theme-bg': theme.bg, '--theme-ink': theme.ink, '--theme-accent': theme.accent, '--theme-dim': theme.dim } as React.CSSProperties}
    >
      <button className={s.backBtn} onClick={() => navigate(-1)} aria-label="Back">← back</button>

      {/* ── Page ── */}
      <div
        key={pageIdx}
        className={`${s.page} ${dir === 'f' ? s.enterRight : s.enterLeft} ${fromDashboard && pageIdx === 0 ? s.enterFromGutter : ''}`}
        style={{ background: theme.paper }}
      >
        <div className={s.grain} aria-hidden />

        {/* ── COVER ── */}
        {spec.kind === 'cover' && (
          <div className={s.coverLayout}>
            <div className={s.coverTop}>
              <span className={s.coverChip} style={{ color: theme.chip, borderColor: theme.chip + '33', background: theme.chip + '12' }}>
                {cluster}
              </span>
              <span className={s.coverChNum}>Ch. {ch}</span>
            </div>
            <div className={s.coverGlyph} style={{ color: theme.accent }}>{glyph}</div>
            <h1 className={s.coverTitle} style={{ color: theme.ink }}>{cs.conceptName}</h1>
            <p className={s.coverSub} style={{ color: theme.dim }}>{totalQs} questions · your story starts here</p>
            <button className={s.coverCta} style={{ background: theme.ink, color: theme.bg }} onClick={() => goTo(1, 'f')}>
              Open chapter →
            </button>
          </div>
        )}

        {/* ── STORY ── */}
        {spec.kind === 'story' && (
          <div className={s.storyLayout}>
            <header className={s.storyHead}>
              <span className={s.storyRunLabel}>the story</span>
              <span className={s.storyRunPage}>{spec.pageNum} / {storyPageCount}</span>
            </header>
            <div className={s.storyBody}>
              {spec.paras.map((p, i) => (
                <p key={i} className={`${s.storyPara} ${spec.isFirst && i === 0 ? s.firstPara : ''}`}>
                  {spec.isFirst && i === 0 && p.length > 0 && (
                    <span className={s.dropCap} style={{ color: theme.accent }}>{p[0]}</span>
                  )}
                  {spec.isFirst && i === 0 ? p.slice(1) : p}
                </p>
              ))}
            </div>
            {spec.pageNum === storyPageCount && (
              <div className={s.storyFoot}>
                <span className={s.storyFootLabel} style={{ color: theme.dim }}>
                  {cs.conceptName} · {totalQs} questions waiting
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── QUESTION ── */}
        {spec.kind === 'question' && (() => {
          const q = questions[spec.qIdx]
          if (!q) return null
          const qNum = spec.qIdx + 1
          const qTotal = specs.filter(p => p.kind === 'question').length
          const chosen = answers[spec.qIdx] ?? null
          const isDone = submitted[spec.qIdx] ?? false
          const frame = getFrame(conceptId)

          // Pick the best bridge line for this question
          const txt = q.question.toLowerCase()
          const bridge = frame
            ? (txt.includes('die') || txt.includes('dice') || txt.includes('roll')) && frame.diceFrame
              ? frame.diceFrame
              : (txt.includes('spinner') || txt.includes('spin')) && frame.spinnerFrame
              ? frame.spinnerFrame
              : frame.questionBridge
            : null

          return (
            <div className={s.qLayout}>
              {/* Left: question */}
              <div className={s.qLeft}>
                <header className={s.qHead}>
                  <span className={s.qKicker}>Question {qNum} of {qTotal}</span>
                  <span className={s.qChipSmall} style={{ color: theme.chip }}>Ch. {ch}</span>
                </header>

                {/* Story context bridge */}
                {frame && (
                  <div className={s.storyBridge}>
                    <span className={s.storyBridgeSetting} style={{ color: theme.dim }}>{frame.settingLine}</span>
                    <p className={s.storyBridgeText} style={{ color: theme.accent + 'cc' }}>{bridge}</p>
                  </div>
                )}

                <QuestionContent text={q.question} ink={theme.ink} accent={theme.accent} />

                {/* Interactive widget (dice / spinner / coin) */}
                <InteractiveWidget
                  conceptId={conceptId}
                  questionText={q.question}
                  theme={{ accent: theme.accent, ink: theme.ink, bg: theme.bg, dim: theme.dim }}
                />

                <div className={s.qChoices}>
                  {q.choices.slice(0, 4).map((c, i) => (
                    <button
                      key={i}
                      className={`${s.choice} ${chosen === i ? s.choiceChosen : ''} ${isDone ? s.choiceDone : ''}`}
                      style={chosen === i ? {
                        borderColor: theme.accent,
                        background: theme.accent + '14',
                        '--choice-bg': theme.accent + '14',
                      } as React.CSSProperties : undefined}
                      onClick={() => !isDone && setAnswers(a => ({ ...a, [spec.qIdx]: i }))}
                      disabled={isDone}
                    >
                      <span className={s.choiceLetter} style={{ color: theme.accent }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className={s.choiceText}>{fmtChoice(c)}</span>
                    </button>
                  ))}
                </div>

                {/* Hint strip */}
                {!isDone && q.hints && q.hints.length > 0 && (
                  <div className={s.hintStrip}>
                    {(hintsShownPerQ[spec.qIdx] ?? 0) < q.hints.length && (
                      <button
                        className={s.hintBtn}
                        style={{ borderColor: theme.accent + '55', color: theme.accent }}
                        onClick={() => setHintsShownPerQ(h => ({ ...h, [spec.qIdx]: (h[spec.qIdx] ?? 0) + 1 }))}
                      >
                        💡 {(hintsShownPerQ[spec.qIdx] ?? 0) === 0 ? 'Need a hint?' : 'Another hint'}
                      </button>
                    )}
                    {q.hints.slice(0, hintsShownPerQ[spec.qIdx] ?? 0).map((hint, hi) => (
                      <div key={hi} className={s.hintBubble} style={{ borderLeftColor: theme.accent + '66', color: theme.dim }}>
                        {hint}
                      </div>
                    ))}
                  </div>
                )}

                {/* Misconception callout after wrong answer */}
                {isDone && chosen !== null && chosen !== q.correctIndex && q.misconception_label && (
                  <div className={s.misconception}>
                    <span className={s.misconceptionLabel}>common slip</span>
                    {q.misconception_label}
                  </div>
                )}

                {!isDone ? (
                  <button
                    className={s.submitBtn}
                    style={{ background: theme.ink, color: theme.bg }}
                    disabled={chosen === null}
                    onClick={() => setSubmitted(d => ({ ...d, [spec.qIdx]: true }))}
                  >
                    {chosen === null ? 'Choose an answer' : 'Lock it in →'}
                  </button>
                ) : (
                  <p className={s.qDoneNote} style={{ color: theme.dim }}>
                    {chosen === q.correctIndex ? 'Correct. Keep going.' : 'Noted. Review your work.'}
                  </p>
                )}
              </div>

              {/* Right: scratch pad for handwritten work */}
              <div className={s.notepad}>
                <div className={s.notepadHeader}>
                  <span className={s.notepadLabel} style={{ color: theme.dim }}>your work</span>
                  {notes[spec.qIdx] && (
                    <button
                      className={s.notepadClear}
                      type="button"
                      onClick={() => {
                        setNotes(n => ({ ...n, [spec.qIdx]: '' }))
                        setScratchRev(r => ({ ...r, [spec.qIdx]: (r[spec.qIdx] ?? 0) + 1 }))
                      }}
                    >
                      clear
                    </button>
                  )}
                </div>
                {showWriteNudge && !notes[spec.qIdx] && (
                  <span className={s.writeNudge}>try sketching it out first…</span>
                )}
                <ScratchPad
                  key={`${spec.qIdx}-${scratchRev[spec.qIdx] ?? 0}`}
                  height={240}
                  onChange={canvas => {
                    setNotes(n => ({ ...n, [spec.qIdx]: canvas.toDataURL('image/png') }))
                  }}
                />
              </div>
            </div>
          )
        })()}

        {/* ── NAV ── */}
        {spec.kind !== 'cover' && (
          <nav className={s.nav}>
            <button className={s.navArrow} onClick={() => goTo(pageIdx - 1, 'b')} aria-label="Previous">←</button>
            <div className={s.navDots}>
              {specs.slice(1).map((_, i) => {
                const idx = i + 1
                const isActive = idx === pageIdx
                const isPast = idx < pageIdx
                return (
                  <button
                    key={i}
                    className={`${s.dot} ${isActive ? s.dotActive : ''} ${isPast ? s.dotPast : ''}`}
                    style={isActive ? { background: theme.accent } : isPast ? { background: theme.accent + '55' } : undefined}
                    onClick={() => goTo(idx, idx > pageIdx ? 'f' : 'b')}
                    aria-label={`Page ${idx}`}
                  />
                )
              })}
            </div>
            {isLast ? (
              <button className={s.navPrimary} style={{ background: theme.ink, color: theme.bg }} onClick={() => navigate('/practice', { state: { conceptId } })}>
                Practice →
              </button>
            ) : (
              <button className={s.navArrow} onClick={() => goTo(pageIdx + 1, 'f')} aria-label="Next">→</button>
            )}
          </nav>
        )}
      </div>

      {/* ── Floating toolbar ── */}
      <div className={s.floatBar}>
        {showCalc && <Calculator />}
        {showPing && (
          <div className={s.pingPanel}>
            <p className={s.pingTitle}>Message your tutor</p>
            {pingSent ? (
              <p className={s.pingSent}>Sent! Your tutor will see this.</p>
            ) : (
              <>
                <textarea
                  className={s.pingInput}
                  placeholder="e.g. Stuck on question 2 — can we go over this next session?"
                  value={pingMsg}
                  onChange={e => setPingMsg(e.target.value)}
                />
                <button className={s.pingSubmit} disabled={!pingMsg.trim()} onClick={sendPing}>
                  Send to tutor →
                </button>
              </>
            )}
          </div>
        )}
        <button
          className={`${s.fabBtn} ${s.fabPing}`}
          onClick={() => { setShowPing(p => !p); setShowCalc(false) }}
          aria-label="Message tutor"
        >
          ✉ Ping tutor
        </button>
        <button
          className={`${s.fabBtn} ${s.fabCalc}`}
          onClick={() => { setShowCalc(c => !c); setShowPing(false) }}
          aria-label="Calculator"
        >
          ⊞ Calculator
        </button>
      </div>
    </div>
  )
}
