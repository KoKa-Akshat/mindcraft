import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import conceptStoriesRaw from '../data/conceptStories.json'
import { getQuestions, questionCount } from '../lib/questionBank'
import MathText from '../components/MathText'
import s from './ConceptChapterPage.module.css'

type IngredientStory = string | { name?: string; story: string }
type ConceptStory = {
  conceptId: string
  conceptName: string
  story: string
  ingredientStories: Record<string, IngredientStory>
}
const conceptStories = conceptStoriesRaw as unknown as Record<string, ConceptStory>

// --- Concept visual identity --------------------------------------------------
// Each concept gets a "cluster color" and a simple geometric glyph (SVG path)
// representing its mathematical essence. Four clusters map to spec tab dyes.

type ClusterKey = 'algebra' | 'geometry' | 'functions' | 'data'

const CLUSTER_MAP: Record<string, ClusterKey> = {
  fractions_decimals: 'algebra',     ratios_proportions: 'algebra',
  percent_ratio: 'algebra',          order_of_operations: 'algebra',
  basic_equations: 'algebra',        linear_equations: 'algebra',
  linear_inequalities: 'algebra',    systems_of_linear_equations: 'algebra',
  exponent_rules: 'algebra',         radical_expressions: 'algebra',
  absolute_value: 'algebra',         integer_operations: 'algebra',
  polynomial_operations: 'algebra',  factors_multiples: 'algebra',
  number_properties: 'algebra',
  functions_basics: 'functions',     function_notation: 'functions',
  quadratic_functions: 'functions',  exponential_functions: 'functions',
  logarithms: 'functions',           composite_inverse: 'functions',
  trigonometry: 'functions',         sequences_series: 'functions',
  right_triangle_geometry: 'geometry', triangles_similarity: 'geometry',
  circles: 'geometry',               coordinate_geometry: 'geometry',
  transformations: 'geometry',       solid_geometry: 'geometry',
  vectors_matrices: 'geometry',
  statistics_basics: 'data',         probability: 'data',
  data_interpretation: 'data',       regression: 'data',
  counting_combinatorics: 'data',    complex_numbers: 'data',
}

const CLUSTER_COLORS: Record<ClusterKey, { bg: string; ink: string; accent: string }> = {
  algebra:   { bg: '#d9c8a8', ink: '#4a3a18', accent: '#8b6914' },
  geometry:  { bg: '#b9c4ce', ink: '#1a2e3a', accent: '#2a5f7e' },
  functions: { bg: '#c3cdb4', ink: '#1e2f1a', accent: '#3a6b2a' },
  data:      { bg: '#d4bcb4', ink: '#3a1e1a', accent: '#7e3a2a' },
}

function clusterFor(conceptId: string) {
  return CLUSTER_MAP[conceptId] ?? 'algebra'
}

// Simple SVG glyphs — one per cluster
const CLUSTER_GLYPH: Record<ClusterKey, React.ReactNode> = {
  algebra: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Balance beam */}
      <line x1="40" y1="20" x2="40" y2="60" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="10" y1="40" x2="70" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="40" r="7" stroke="currentColor" strokeWidth="2"/>
      <circle cx="68" cy="40" r="7" stroke="currentColor" strokeWidth="2"/>
      <line x1="32" y1="58" x2="48" y2="58" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  geometry: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Triangle + circle */}
      <circle cx="40" cy="40" r="26" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4"/>
      <polygon points="40,14 66,66 14,66" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round"/>
      <line x1="40" y1="14" x2="40" y2="66" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.6"/>
    </svg>
  ),
  functions: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Smooth curve with axes */}
      <line x1="10" y1="70" x2="70" y2="70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="10" x2="10" y2="70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 68 C25 68 20 20 40 25 C55 28 50 60 70 55" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="40" cy="25" r="2.5" fill="currentColor"/>
    </svg>
  ),
  data: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Scatter plot with trend line */}
      <line x1="10" y1="70" x2="70" y2="70" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10" y1="10" x2="10" y2="70" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10" y1="65" x2="70" y2="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6"/>
      {[{x:18,y:58},{x:28,y:50},{x:36,y:42},{x:44,y:38},{x:56,y:28},{x:64,y:22}].map((p,i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="currentColor"/>
      ))}
    </svg>
  ),
}

// Derive a chapter number from the conceptId (deterministic, just for display)
function chapterNumber(conceptId: string): number {
  const ids = Object.keys(conceptStories)
  const idx = ids.indexOf(conceptId)
  return idx >= 0 ? idx + 1 : 1
}

// Split story into paragraphs for rendering
function parseStory(text: string): string[] {
  return text.split('\n').map(p => p.trim()).filter(Boolean)
}

export default function ConceptChapterPage() {
  const { conceptId = '' } = useParams<{ conceptId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const fromDashboard = Boolean((location.state as { fromDashboard?: boolean } | null)?.fromDashboard)

  const story = conceptStories[conceptId]
  const cluster = clusterFor(conceptId)
  const palette = CLUSTER_COLORS[cluster]
  const glyph = CLUSTER_GLYPH[cluster]

  // Questions preview (Level 1, up to 2 shown)
  const previewQs = getQuestions(conceptId, 1, 2)
  const totalQs = questionCount(conceptId, 1) + questionCount(conceptId, 2) + questionCount(conceptId, 3)

  // Ingredient stories for this concept
  const ingredients = story
    ? Object.values(story.ingredientStories).slice(0, 3)
    : []

  // Page-open entrance animation
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 60)
    return () => clearTimeout(t)
  }, [])

  if (!story) {
    return (
      <div className={s.desk}>
        <div className={s.notFound}>
          <button className={s.backBtn} onClick={() => navigate(-1)}>← back</button>
          <p>No story found for <code>{conceptId}</code>.</p>
        </div>
      </div>
    )
  }

  const paragraphs = parseStory(story.story)
  const chapterNum = chapterNumber(conceptId)

  function startPractice() {
    navigate('/practice', { state: { conceptId } })
  }

  return (
    <div className={s.desk}>
      {/* Back navigation — sits on the desk, above the notebook */}
      <button className={s.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
        ← back
      </button>

      {/* The notebook spread */}
      <div className={`${s.spread} ${fromDashboard ? s.fromDashboard : ''} ${open ? s.spreadOpen : ''}`}>

        {/* ── LEFT PAGE: The Story ──────────────────────────── */}
        <div className={s.leftPage} ref={leftRef}>
          <div className={s.pageGrain} aria-hidden />

          {/* Running header */}
          <div className={s.runHead}>
            <span className={s.runHeadLabel}>the story</span>
            <span className={s.runHeadPage}>{chapterNum}</span>
          </div>

          {/* Chapter marker */}
          <div className={s.chapterMark}>
            <span className={s.chapterStamp}>Ch. {chapterNum}</span>
            <span
              className={s.clusterPip}
              style={{ background: palette.bg, color: palette.ink }}
            >
              {cluster}
            </span>
          </div>

          {/* Concept name — display typography */}
          <h1 className={s.conceptTitle}>{story.conceptName}</h1>

          {/* Margin rule + story body */}
          <div className={s.storyBody}>
            <div className={s.marginRule} aria-hidden />
            <div className={s.storyText}>
              {paragraphs.map((p, i) => (
                <p key={i} className={s.storyParagraph}>{p}</p>
              ))}
            </div>
          </div>

          {/* Ingredient story excerpts — tipped as footnotes */}
          {ingredients.length > 0 && (
            <div className={s.ingredientNotes}>
              <div className={s.ingredientDivider} aria-hidden />
              {ingredients.map((ing, i) => {
                const text = typeof ing === 'string' ? ing : (ing.story ?? '')
                const preview = text.slice(0, 120) + (text.length > 120 ? '…' : '')
                return (
                  <div key={i} className={s.ingredientNote}>
                    <span className={s.ingredientNum}>{i + 1}</span>
                    <p className={s.ingredientText}>{preview}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Gutter shadow — the binding */}
        <div className={s.gutter} aria-hidden>
          {[0,1,2,3,4].map(i => <div key={i} className={s.gutterStitch} aria-hidden />)}
        </div>

        {/* ── RIGHT PAGE: The Chapter ──────────────────────── */}
        <div className={s.rightPage}>
          <div className={s.pageGrain} aria-hidden />

          {/* Running header */}
          <div className={s.runHead} style={{ justifyContent: 'flex-end' }}>
            <span className={s.runHeadPage}>{chapterNum + 1}</span>
          </div>

          {/* Concept glyph + what you'll master */}
          <div className={s.rightHero}>
            <div
              className={s.glyphWrap}
              style={{ color: palette.accent }}
            >
              {glyph}
            </div>
            <div className={s.heroText}>
              <p className={s.heroLabel}>what you'll master</p>
              <h2 className={s.heroTitle}>{story.conceptName}</h2>
            </div>
          </div>

          {/* Ingredient list — what's inside this chapter */}
          <div className={s.ingredientList}>
            {Object.entries(story.ingredientStories).slice(0, 4).map(([key, ing], i) => {
              const name = (typeof ing === 'object' ? ing.name : undefined) ?? key.split('__')[1]?.replace(/_/g, ' ') ?? key
              return (
                <div key={key} className={s.ingredientItem}>
                  <span className={s.ingredientBullet} style={{ color: palette.accent }}>▸</span>
                  <span className={s.ingredientName}>{name}</span>
                </div>
              )
            })}
          </div>

          {/* Practice question preview */}
          {previewQs.length > 0 && (
            <div className={s.questionsSection}>
              <p className={s.questionsSectionLabel}>a question from this chapter</p>
              <div className={s.questionCard}>
                <p className={s.questionText}>
                  <MathText text={previewQs[0].question} />
                </p>
                <div className={s.questionChoices}>
                  {previewQs[0].choices.slice(0, 4).map((choice, i) => (
                    <button
                      key={i}
                      className={`${s.choiceBtn} ${activeQuestion === i ? s.choiceSelected : ''}`}
                      onClick={() => setActiveQuestion(activeQuestion === i ? null : i)}
                    >
                      <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                      <MathText text={choice} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer: question count + CTA */}
          <div className={s.footerRow}>
            {totalQs > 0 && (
              <p className={s.questionCount}>
                <span className={s.questionCountNum}>{totalQs}</span> questions in bank
              </p>
            )}
            <button className={s.practiceBtn} onClick={startPractice}>
              Practice this chapter
              <span className={s.practiceBtnArrow}>→</span>
            </button>
          </div>

          {/* Back-pocket index line */}
          <div className={s.indexLine}>
            <span>see also:</span>
            <button onClick={() => navigate('/dashboard')} className={s.indexLink}>dashboard</button>
            <span>·</span>
            <button onClick={() => navigate('/knowledge-graph')} className={s.indexLink}>the map</button>
            <span>·</span>
            <button onClick={() => navigate('/practice')} className={s.indexLink}>full practice</button>
          </div>
        </div>
      </div>
    </div>
  )
}
