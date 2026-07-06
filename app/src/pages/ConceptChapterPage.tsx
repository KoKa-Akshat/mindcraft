/**
 * ConceptChapterPage — paginated storybook experience.
 *
 * Pages: cover → story chunks (2 paragraphs each) → questions (with notepad)
 * Navigation: tap arrow or swipe; page-slide transition between pages.
 * Questions: no LaTeX, no right/wrong revealed (C4 mode). Lined notepad on right.
 */

import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useMemo } from 'react'
import conceptStoriesRaw from '../data/conceptStories.json'
import { getQuestions, questionCount } from '../lib/questionBank'
import s from './ConceptChapterPage.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type CS = {
  conceptId: string
  conceptName: string
  story: string
  ingredientStories: Record<string, unknown>
}
const DB = conceptStoriesRaw as unknown as Record<string, CS>

// ── Cluster identity ───────────────────────────────────────────────────────────

type Cluster = 'algebra' | 'geometry' | 'functions' | 'data'

const CLUSTER_MAP: Record<string, Cluster> = {
  fractions_decimals: 'algebra',  ratios_proportions: 'algebra',
  percent_ratio: 'algebra',       order_of_operations: 'algebra',
  basic_equations: 'algebra',     linear_equations: 'algebra',
  linear_inequalities: 'algebra', systems_of_linear_equations: 'algebra',
  exponent_rules: 'algebra',      radical_expressions: 'algebra',
  absolute_value: 'algebra',      integer_operations: 'algebra',
  polynomial_operations: 'algebra', factors_multiples: 'algebra',
  number_properties: 'algebra',
  functions_basics: 'functions',  function_notation: 'functions',
  quadratic_functions: 'functions', exponential_functions: 'functions',
  logarithms: 'functions',        composite_inverse: 'functions',
  trigonometry_basics: 'functions', sequences_series: 'functions',
  right_triangle_geometry: 'geometry', triangles_similarity: 'geometry',
  circles: 'geometry',            coordinate_geometry: 'geometry',
  geometric_transformations: 'geometry', solid_geometry: 'geometry',
  statistics_basics: 'data',      probability: 'data',
  data_interpretation: 'data',    regression: 'data',
  counting_combinatorics: 'data', complex_numbers: 'data',
  matrices: 'data',               rational_expressions: 'algebra',
}

const CLUSTER_THEME = {
  algebra:   { bg: '#f5eedb', paper: '#faf5ec', ink: '#3d2f10', accent: '#8b6914', dim: '#a0906a', chip: '#8b6914' },
  geometry:  { bg: '#e8eef5', paper: '#f1f5fa', ink: '#172333', accent: '#1e5f8a', dim: '#4a7396', chip: '#1e5f8a' },
  functions: { bg: '#eaf2e8', paper: '#f1f7f0', ink: '#1a2c16', accent: '#2d6924', dim: '#4a7a42', chip: '#2d6924' },
  data:      { bg: '#f2ece9', paper: '#f8f3f1', ink: '#321614', accent: '#7a2e26', dim: '#8c5550', chip: '#7a2e26' },
}

// ── Cluster SVG glyphs ─────────────────────────────────────────────────────────

const GLYPH: Record<Cluster, React.ReactNode> = {
  algebra: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="40" y1="16" x2="40" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8"  y1="36" x2="72" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="12" cy="36" r="9"  stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="68" cy="36" r="9"  stroke="currentColor" strokeWidth="2" fill="none"/>
      <line x1="30" y1="56" x2="50" y2="56" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  geometry: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4"/>
      <polygon points="40,12 67,67 13,67" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
      <line x1="40" y1="12" x2="40" y2="67" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.5"/>
    </svg>
  ),
  functions: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="8"  y1="72" x2="72" y2="72" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"/>
      <line x1="8"  y1="8"  x2="8"  y2="72" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"/>
      <path d="M8 70 C22 70 18 18 40 23 C56 26 52 62 72 57" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="40" cy="23" r="3.5" fill="currentColor"/>
    </svg>
  ),
  data: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="8"  y1="72" x2="72" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="8"  y1="8"  x2="8"  y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="8"  y1="68" x2="72" y2="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.55"/>
      {([{x:16,y:60},{x:26,y:52},{x:36,y:44},{x:46,y:36},{x:56,y:26},{x:66,y:20}] as const).map((p,i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="currentColor"/>
      ))}
    </svg>
  ),
}

// ── Page spec ──────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConceptChapterPage() {
  const { conceptId = '' } = useParams<{ conceptId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fromDashboard = Boolean((location.state as { fromDashboard?: boolean } | null)?.fromDashboard)

  const cs = DB[conceptId]
  const cluster = CLUSTER_MAP[conceptId] ?? 'algebra'
  const theme = CLUSTER_THEME[cluster]
  const glyph = GLYPH[cluster]
  const ch = chapterNum(conceptId)

  const questions = useMemo(() => {
    if (!conceptId) return []
    const qs = [...getQuestions(conceptId, 1, 3), ...getQuestions(conceptId, 2, 3)]
    const seen = new Set<string>()
    return qs.filter(q => { if (seen.has(q.question)) return false; seen.add(q.question); return true }).slice(0, 3)
  }, [conceptId])

  const totalQs = questionCount(conceptId, 1) + questionCount(conceptId, 2) + questionCount(conceptId, 3)

  const specs = useMemo(() => cs ? buildSpecs(cs.story, Math.min(questions.length, 3)) : [], [cs, questions.length])

  const [pageIdx, setPageIdx] = useState(0)
  const [dir, setDir] = useState<'f' | 'b'>('f')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})

  const goTo = (i: number, d: 'f' | 'b') => {
    if (i < 0) { navigate(-1); return }
    if (i >= specs.length) {
      navigate('/practice', { state: { conceptId } })
      return
    }
    setDir(d)
    setPageIdx(i)
  }

  if (!cs) {
    return (
      <div className={s.desk}>
        <button className={s.backBtn} onClick={() => navigate(-1)}>← back</button>
        <p style={{ color: 'rgba(255,255,255,.4)', marginTop: 40 }}>No story found for <code>{conceptId}</code>.</p>
      </div>
    )
  }

  const spec = specs[pageIdx]
  const isLast = pageIdx === specs.length - 1
  const storyPageCount = specs.filter(p => p.kind === 'story').length

  return (
    <div
      className={s.desk}
      style={{ '--theme-bg': theme.bg, '--theme-ink': theme.ink, '--theme-accent': theme.accent, '--theme-dim': theme.dim } as React.CSSProperties}
    >
      {/* Back */}
      <button className={s.backBtn} onClick={() => navigate(-1)} aria-label="Back">
        ←
      </button>

      {/* Page container — key triggers entry animation */}
      <div
        key={pageIdx}
        className={`${s.page} ${dir === 'f' ? s.enterRight : s.enterLeft} ${fromDashboard && pageIdx === 0 ? s.enterFromGutter : ''}`}
        style={{ background: theme.paper }}
      >
        {/* Grain overlay */}
        <div className={s.grain} aria-hidden />

        {/* ── COVER ─────────────────────────────────────────── */}
        {spec.kind === 'cover' && (
          <div className={s.coverLayout}>
            <div className={s.coverTop}>
              <span className={s.coverChip} style={{ color: theme.chip, borderColor: theme.chip + '33', background: theme.chip + '12' }}>
                {cluster}
              </span>
              <span className={s.coverChNum}>Ch. {ch}</span>
            </div>
            <div className={s.coverGlyph} style={{ color: theme.accent }}>
              {glyph}
            </div>
            <h1 className={s.coverTitle} style={{ color: theme.ink }}>
              {cs.conceptName}
            </h1>
            <p className={s.coverSub} style={{ color: theme.dim }}>
              {totalQs} questions · your story starts here
            </p>
            <button
              className={s.coverCta}
              style={{ background: theme.ink, color: theme.bg }}
              onClick={() => goTo(1, 'f')}
            >
              Open chapter →
            </button>
          </div>
        )}

        {/* ── STORY ─────────────────────────────────────────── */}
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
                    <span className={s.dropCap} style={{ color: theme.accent }}>
                      {p[0]}
                    </span>
                  )}
                  {spec.isFirst && i === 0 ? p.slice(1) : p}
                </p>
              ))}
            </div>

            {/* Chapter info at foot of last story page */}
            {spec.pageNum === storyPageCount && (
              <div className={s.storyFoot}>
                <span className={s.storyFootLabel} style={{ color: theme.dim }}>
                  {cs.conceptName} · {totalQs} questions waiting
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── QUESTION ──────────────────────────────────────── */}
        {spec.kind === 'question' && (() => {
          const q = questions[spec.qIdx]
          if (!q) return null
          const qNum = spec.qIdx + 1
          const qTotal = specs.filter(p => p.kind === 'question').length
          const chosen = answers[spec.qIdx] ?? null
          const isDone = submitted[spec.qIdx] ?? false

          return (
            <div className={s.qLayout}>
              {/* Left: question */}
              <div className={s.qLeft}>
                <header className={s.qHead}>
                  <span className={s.qKicker}>Question {qNum} of {qTotal}</span>
                  <span className={s.qChipSmall} style={{ color: theme.chip }}>Ch. {ch}</span>
                </header>

                <p className={s.qText}>{q.question}</p>

                <div className={s.qChoices}>
                  {q.choices.slice(0, 4).map((c, i) => (
                    <button
                      key={i}
                      className={`${s.choice} ${chosen === i ? s.choiceChosen : ''} ${isDone ? s.choiceDone : ''}`}
                      style={chosen === i ? { borderColor: theme.accent, background: theme.accent + '14' } : undefined}
                      onClick={() => !isDone && setAnswers(a => ({ ...a, [spec.qIdx]: i }))}
                      disabled={isDone}
                    >
                      <span className={s.choiceLetter} style={{ color: theme.accent }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className={s.choiceText}>{c}</span>
                    </button>
                  ))}
                </div>

                {!isDone && (
                  <button
                    className={s.submitBtn}
                    style={{ background: theme.ink, color: theme.bg }}
                    disabled={chosen === null}
                    onClick={() => setSubmitted(d => ({ ...d, [spec.qIdx]: true }))}
                  >
                    {chosen === null ? 'Choose an answer' : 'Lock it in →'}
                  </button>
                )}

                {isDone && (
                  <p className={s.qDoneNote} style={{ color: theme.dim }}>
                    Recorded. Keep going.
                  </p>
                )}
              </div>

              {/* Right: lined notepad for working */}
              <div className={s.notepad}>
                <p className={s.notepadLabel} style={{ color: theme.dim }}>your work</p>
                <div className={s.notepadLines} style={{ '--line-color': theme.accent + '18' } as React.CSSProperties} />
              </div>
            </div>
          )
        })()}

        {/* ── NAVIGATION BAR ────────────────────────────────── */}
        {spec.kind !== 'cover' && (
          <nav className={s.nav}>
            <button className={s.navArrow} onClick={() => goTo(pageIdx - 1, 'b')} aria-label="Previous page">
              ←
            </button>

            <div className={s.navDots}>
              {specs.slice(1).map((p, i) => {
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
              <button
                className={s.navPrimary}
                style={{ background: theme.ink, color: theme.bg }}
                onClick={() => navigate('/practice', { state: { conceptId } })}
              >
                Practice →
              </button>
            ) : (
              <button className={s.navArrow} onClick={() => goTo(pageIdx + 1, 'f')} aria-label="Next page">
                →
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}
