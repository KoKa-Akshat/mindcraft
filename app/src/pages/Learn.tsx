/**
 * Learn: the production "ask anything -> resolve -> read -> check" experience.
 *
 * Promoted from the DevUnifiedLearn prototype (2026-08-30) and rewired off the
 * prototype's four localhost Python servers onto real production services:
 *
 *   search        POST /api/concept-resolve   (new, local embeddings, no LLM spend)
 *   chapter/sim   Firestore conceptLibrary / conceptLibrarySims, read directly
 *                 by the authenticated client under firestore.rules
 *   simplify      POST /api/simplify-chapter  (new, Groq, budget-gated)
 *   live sim      POST /api/generate-sim      (EXISTING production pipeline)
 *   check question POST /api/generate-questions (EXISTING production endpoint)
 *   study history Firestore conceptStudyLog, per student, not localStorage
 *   materials     POST /api/parse-homework    (EXISTING production endpoint,
 *                 same client lib the Work tab uses: lib/homework.ts)
 *   hints         POST ML /recommend-ingredients via getIngredientCards()
 *                 (EXISTING graduated hint-card system, same one
 *                 HomeworkSession.tsx uses; hints, never solutions)
 *   voice         POST /api/tts (Kokoro, af_heart, Jesse's voice) to read a
 *                 hint aloud
 *
 * Every request that needs identity carries the signed-in user's real Firebase
 * ID token. There is no fake/local placeholder anywhere in this file.
 *
 * The UX decisions carried over from the validated prototype, unchanged
 * because they were the point of building it:
 *   - A broad query starts at the FOUNDATION of the prerequisite ramp; a
 *     precise, confident query starts at the concept it actually named, with
 *     the ramp still shown behind it as context.
 *   - The auto-simplified reading is the default, with a toggle back to the
 *     original, and a rewrite that fails its faithfulness check is never
 *     shown at all: the original stands and the reason is stated.
 *   - A generated sim is badged AI GENERATED and never mistaken for a
 *     human-reviewed one; a failed generation says why.
 *   - A concept counts as studied only when its check question was actually
 *     answered, not when a chapter was on screen.
 *   - The graph stays alive behind the panels rather than disappearing.
 *
 * Added 2026-09-01 (learn-redesign branch):
 *   - Visual pass on the reading experience: calmer navy palette, larger
 *     body type, softer cards. The sim panel treatment and the two-column
 *     layout are deliberately unchanged.
 *   - The right panel, when no sim exists, is a scrollable materials area:
 *     upload a worksheet (PDF/photo), questions are extracted by the same
 *     transcribe-only pipeline the Work tab uses, and each question gets a
 *     graduated hint path on the left. Hints arrive ONE at a time and never
 *     contain the final answer. That is a deliberate learning-science
 *     decision (guardrailed help beats answer-giving; see the design note in
 *     the PR), not a missing feature.
 */
import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import ColdCheckPrompt from '../components/ColdCheckPrompt'
import MathText from '../components/MathText'
import { useUser } from '../App'
import {
  resolveConcept,
  fetchConceptContent,
  fetchConceptLabels,
  simplifyChapter,
  fetchCheckQuestion,
  generateSim,
  loadStudyLog,
  recordStudied,
  type ConceptMatch,
  type ConceptSim,
  type PathStep,
  type ConceptContent,
  type CheckQuestion,
  type GeneratedSim,
  type StudyRecord,
} from '../lib/conceptLibrary'
import { pagesFromFile, parseHomeworkPages } from '../lib/homework'
import { getIngredientCards, getRecommendations, WEBHOOK_BASE, type IngredientRecommendResult, type MisconceptionGap } from '../lib/mlApi'
import { mlIdToLabel } from '../lib/conceptMap'
import { lookupMisconceptionTrap } from '../lib/questionBank'
import { prewarmEmbedder, embedderReady } from '../lib/queryEmbedder'
import { recordLearnActivity } from '../lib/learnActivity'
import type { HomeworkQuestion } from '../types'

/** Below this, even the best available match is noise rather than a signal:
 * nothing in the library is actually about the query, and dressing up a
 * near-zero score as content would be a lie. */
const NO_COVERAGE_FLOOR = 0.35
/** Below this a query is probably broad/exploratory, so the ramp starts at its
 * foundation rather than at whatever advanced concept scored highest. */
const RAMP_CONFIDENCE_CEILING = 0.6
const CONFIDENCE_THRESHOLD = 0.5
const REVEAL_DELAY_MS = 1400
const SETTLE_DELAY_MS = 600

const MATERIALS_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

interface LibraryCounts { nodes: number; withLesson: number; withSim: number; subjects: number }

// ── Visual language ─────────────────────────────────────────────────────────
// One calm, warm navy surface set. The founder's complaint (2026-09-01) was
// specifically about the reading experience: near-black boxes, small
// low-contrast text. The sim panel and the two-column layout were called out
// as working, so those structures are untouched; only surfaces, type, and
// spacing changed.
const PAGE_BG = '#0F1424'
const FONT_STACK = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif"
const TEXT_PRIMARY = 'rgba(238,242,252,0.95)'
const TEXT_SOFT = 'rgba(205,215,238,0.8)'
const TEXT_FAINT = 'rgba(205,215,238,0.55)'
const BORDER_SOFT = '1px solid rgba(160,178,224,0.16)'

const CARD: CSSProperties = {
  background: '#182036',
  border: BORDER_SOFT,
  borderRadius: 18,
  boxShadow: '0 6px 22px rgba(5,9,22,0.3)',
}

function Eyebrow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase', color }}>
      {children}
    </div>
  )
}

interface NeighborRow {
  id: string
  label: string
  group: string
  hasChapter: boolean
  hasSim: boolean
  relation: 'prerequisite' | 'next' | 'related'
}

/** Hint-card templates come from the ML service (Engine lane) and some carry
 * em/en dashes. The product-wide style rule bans those, so they are replaced
 * at this display boundary rather than silently shown. */
function cleanDashes(text: string): string {
  return text.replace(new RegExp('\\s*[\\u2014\\u2013]\\s*', 'g'), ', ')
}

interface MaterialsState {
  fileName: string
  pageCount: number
  questions: HomeworkQuestion[]
}

export default function Learn({ embedded = false }: { embedded?: boolean }) {
  const user = useUser()
  const uid = user?.uid ?? ''
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [loading, setLoading] = useState(false)
  /** Model download progress (0-100) for the on-device search model, shown
   * only on the very first search of a fresh browser profile. */
  const [embedPct, setEmbedPct] = useState<number | null>(null)
  const [matches, setMatches] = useState<ConceptMatch[] | null>(null)
  const [resolved, setResolved] = useState<ConceptMatch | null>(null)
  const [outOfDomain, setOutOfDomain] = useState(false)
  const [err, setErr] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [resolveMeta, setResolveMeta] = useState<{ indexed: number; totalMs: number; coldStart: boolean } | null>(null)

  const [panelsRevealed, setPanelsRevealed] = useState(false)
  const [panelsSettled, setPanelsSettled] = useState(false)

  const [path, setPath] = useState<PathStep[]>([])
  const [pathIndex, setPathIndex] = useState(0)

  const [content, setContent] = useState<ConceptContent | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentFailed, setContentFailed] = useState('')

  const [simplifiedBody, setSimplifiedBody] = useState('')
  const [simplifying, setSimplifying] = useState(false)
  const [simplifyFailed, setSimplifyFailed] = useState('')
  const [showSimplified, setShowSimplified] = useState(true)
  const [simplifyMeta, setSimplifyMeta] = useState<{ reductionPct: number; cached: boolean } | null>(null)

  const [checkQuestion, setCheckQuestion] = useState<CheckQuestion | null>(null)
  const [checkResult, setCheckResult] = useState('')
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkFailed, setCheckFailed] = useState('')

  const [generatedSim, setGeneratedSim] = useState<GeneratedSim | null>(null)
  const [simGenerating, setSimGenerating] = useState(false)
  const [simGenStatus, setSimGenStatus] = useState('')
  const [simGenFailed, setSimGenFailed] = useState('')

  const [studyLog, setStudyLog] = useState<Record<string, StudyRecord>>({})
  const [neighbors, setNeighbors] = useState<NeighborRow[]>([])
  const [counts, setCounts] = useState<LibraryCounts | null>(null)

  // ── Materials + per-question intelligence ─────────────────────────────────
  // Uploaded worksheet pages live in the right panel (a scrollable list of
  // extracted questions); the help for whichever question is selected lives
  // in the LEFT column, next to the reading. Materials survive concept
  // navigation on purpose: a worksheet is the student's own artifact, not a
  // property of the concept being read.
  const [materials, setMaterials] = useState<MaterialsState | null>(null)
  const [materialsBusy, setMaterialsBusy] = useState('')
  const [materialsError, setMaterialsError] = useState('')
  const [selectedQ, setSelectedQ] = useState<number | null>(null)
  const [rightTab, setRightTab] = useState<'sim' | 'materials'>('sim')

  const [qHints, setQHints] = useState<IngredientRecommendResult | null>(null)
  const [qHintsLoading, setQHintsLoading] = useState(false)
  const [qHintsTried, setQHintsTried] = useState(false)
  /** Graduated reveal: how many hint cards are visible. Always starts at 1.
   * The whole set is never dumped at once; that is the guardrail. */
  const [hintsShown, setHintsShown] = useState(0)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const [voiceFailed, setVoiceFailed] = useState(false)

  // ── Proactive misconception nudge ───────────────────────────────────────
  // 2026-09-02: every surface on this page was student-initiated (search,
  // upload, hints on request) — nothing ever spoke up first. This is the
  // fix: /recommend already computes misconceptionGaps (a reviewed
  // misconception -> ingredient map, not a raw LLM guess) for every
  // student, it was just never surfaced outside the tutor dashboard. Shown
  // the moment this page opens, before any search, because "independent,
  // inside the platform" is most of how a student actually studies here —
  // tutors are once a week; this either catches the gap or it does not.
  const [nudge, setNudge] = useState<{ conceptId: string; label: string; trapLabel: string } | null>(null)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  // ── Per-question sims ────────────────────────────────────────────────────
  // "Sims and questions are trackable and give us immediate data" — every
  // materials question resolves to its own concept and, if the library
  // already has a real sim for it (no generation spend), loads it
  // automatically alongside the hint path. If none exists yet, a real
  // "generate one" button stands in, same budget-gated pipeline the main
  // reading pane already uses, just scoped to this one question's concept.
  interface QuestionSimState {
    status: 'loading' | 'ready' | 'none' | 'error'
    conceptId?: string
    conceptLabel?: string
    sim?: ConceptSim
    generating?: boolean
    genStatus?: string
    genFailed?: string
    generatedSim?: GeneratedSim
  }
  const [questionSims, setQuestionSims] = useState<Record<number, QuestionSimState>>({})

  const graphIframeRef = useRef<HTMLIFrameElement>(null)
  const materialsFileRef = useRef<HTMLInputElement>(null)
  const topUploadFileRef = useRef<HTMLInputElement>(null)
  const simplifyStartedForRef = useRef<string | null>(null)
  const checkStartedForRef = useRef<string | null>(null)
  const simGenStartedForRef = useRef<string | null>(null)

  // ── Derived ───────────────────────────────────────────────────────────────
  // Declared above every hook that reads them: a const referenced by an effect
  // earlier in file order is a temporal-dead-zone ReferenceError that blanks
  // the whole page on first render.
  const hasPath = path.length > 1
  const activeStep = hasPath ? (path[pathIndex] ?? path[path.length - 1]) : null
  const activeConceptId = activeStep?.conceptId ?? resolved?.conceptId ?? null
  const isLastStep = !hasPath || pathIndex >= path.length - 1
  const nextStep = hasPath && !isLastStep ? path[pathIndex + 1] : null
  const chapter = content?.chapter ?? null
  const sim = content?.sim ?? null
  const showPanels = !!(resolved && !outOfDomain && chapter && panelsRevealed)
  const belowThreshold = !!resolved && resolved.score < CONFIDENCE_THRESHOLD
  const usingSimplified = showSimplified && !!simplifiedBody
  const activeBody = usingSimplified ? simplifiedBody : chapter?.body ?? ''
  const paras = activeBody.split('\n\n').map((p) => p.trim()).filter(Boolean)
  const chunks: string[][] = []
  for (let i = 0; i < paras.length; i += 2) chunks.push(paras.slice(i, i + 2))
  const studiedIds = Object.keys(studyLog)
  const isStudied = (id: string) => !!studyLog[id]
  const activeLabel = activeStep?.label ?? content?.label ?? resolved?.label ?? ''
  const hasSimContent = !!(sim || generatedSim)
  const effectiveTab: 'sim' | 'materials' = hasSimContent ? rightTab : 'materials'
  const selectedQuestion = materials && selectedQ != null ? materials.questions[selectedQ] ?? null : null

  // Honest totals for the empty states, from the same export the 3D graph
  // reads. Tiny file, deliberately separate from the 1.5 MB graph payload so
  // this page never downloads the whole graph just to print two numbers.
  useEffect(() => {
    fetch('/full-concept-graph-counts.json')
      .then((r) => r.json())
      .then((d) => setCounts(d?.counts ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!uid) return
    void loadStudyLog(uid).then(setStudyLog)
  }, [uid])

  useEffect(() => {
    if (!uid) return
    void getRecommendations(uid, [], 'curriculum').then((rec) => {
      const gaps = rec?.misconceptionGaps ?? []
      if (!gaps.length) return
      const top = [...gaps].sort((a, b) => b.severity - a.severity)[0]
      const trap = lookupMisconceptionTrap(top.misconceptionId)
      setNudge({
        conceptId: top.conceptId,
        label: mlIdToLabel(top.conceptId),
        trapLabel: trap ?? 'a familiar trap',
      })
    })
  }, [uid])

  // Start pulling the on-device search model as soon as this view opens, so
  // the one-time download overlaps with the student reading the page and
  // typing, instead of starting only once they hit Search.
  useEffect(() => {
    if (embedderReady()) return
    prewarmEmbedder((pct) => setEmbedPct(Math.round(pct)))
  }, [])

  function highlightInGraph(conceptId: string) {
    graphIframeRef.current?.contentWindow?.postMessage({ type: 'highlight', nodeId: conceptId, neighborIds: [] }, '*')
  }

  function pushStudiedToGraph(log: Record<string, StudyRecord>) {
    graphIframeRef.current?.contentWindow?.postMessage({ type: 'studied', ids: Object.keys(log) }, '*')
  }

  useEffect(() => {
    pushStudiedToGraph(studyLog)
  }, [studyLog])

  /** keepPreviousWhileLoading is for stepping along the guided path: clearing
   * content first collapses the panels and bounces the student back to the
   * full-screen graph for the length of one fetch. Holding the old chapter
   * until the new one lands avoids that flash. It is never used to hide a
   * failure: every failure path clears it. */
  const loadContent = useCallback(async (conceptId: string, keepPreviousWhileLoading = false) => {
    setContentFailed('')
    if (!keepPreviousWhileLoading) setContent(null)
    setContentLoading(true)
    try {
      const data = await fetchConceptContent(conceptId)
      if (!data) {
        setContent(null)
        setContentFailed(`The library has no document for ${conceptId}.`)
        return
      }
      setContent(data)
      if (data.chapter) {
        // A real chapter from the library actually landed on this student's
        // screen (the no document and no chapter paths above never reach
        // here). One of the three honest Jesse signals; see
        // lib/learnActivity.ts.
        recordLearnActivity(uid, 'learn_chapter_opened', { conceptId })
      }
      const related = [
        ...data.prereqs.map((id) => ({ id, relation: 'prerequisite' as const })),
        ...data.unlocks.map((id) => ({ id, relation: 'next' as const })),
        ...data.crossSubject.map((id) => ({ id, relation: 'related' as const })),
      ].slice(0, 12)
      if (related.length) {
        const labels = await fetchConceptLabels(related.map((r) => r.id))
        setNeighbors(
          related
            .map((r) => {
              const meta = labels.get(r.id)
              if (!meta) return null
              return {
                id: r.id,
                label: meta.label,
                group: `${meta.subjectTitle} · ${meta.level.replace(/_/g, ' ')}`,
                hasChapter: meta.hasLesson,
                hasSim: meta.hasSim,
                relation: r.relation,
              } as NeighborRow
            })
            .filter((n): n is NeighborRow => !!n),
        )
      } else {
        setNeighbors([])
      }
    } catch (e) {
      setContent(null)
      setContentFailed(`Could not load that chapter: ${String(e).slice(0, 140)}`)
    } finally {
      setContentLoading(false)
    }
  }, [uid])

  function resetPerConcept(keepContent = false) {
    setCheckQuestion(null)
    setCheckResult('')
    setCheckFailed('')
    setCheckLoading(false)
    if (!keepContent) { setContent(null); setNeighbors([]) }
    setContentFailed('')
    setGeneratedSim(null)
    setSimGenFailed('')
    setSimGenStatus('')
    setSimGenerating(false)
    setSimplifiedBody('')
    setSimplifyFailed('')
    setSimplifying(false)
    setSimplifyMeta(null)
    setShowSimplified(true)
    checkStartedForRef.current = null
    simplifyStartedForRef.current = null
    simGenStartedForRef.current = null
  }

  function goToStep(i: number) {
    const step = path[i]
    if (!step) return
    setPathIndex(i)
    resetPerConcept(true)
    void loadContent(step.conceptId, true)
    highlightInGraph(step.conceptId)
  }

  const search = useCallback(async (text?: string) => {
    const q = (text ?? query).trim()
    if (!q) return
    setLoading(true)
    setErr('')
    setSearchedQuery(q)
    setResolved(null)
    setMatches(null)
    setOutOfDomain(false)
    setPanelsRevealed(false)
    setPanelsSettled(false)
    setPath([])
    setPathIndex(0)
    setResolveMeta(null)
    resetPerConcept()
    try {
      // The on-device search model downloads once per browser profile (~22 MB)
      // and is cached for weeks afterwards. That first wait is narrated with
      // real progress rather than hidden behind a spinner that looks broken.
      const data = await resolveConcept(q, 5, (pct) => setEmbedPct(Math.round(pct)))
      setMatches(data.matches)
      setResolveMeta({ indexed: data.indexedConcepts, totalMs: data.timingsMs.total, coldStart: data.coldStart })
      const ms = data.matches
      if (!ms.length) { setErr('Search returned no matches at all, which should not happen. Try again.'); return }
      if (ms[0].score < NO_COVERAGE_FLOOR) {
        setOutOfDomain(true)
        setResolved(ms[0])
        return
      }
      // Prefer the best match that actually has a readable chapter. The
      // resolver only indexes lesson-bearing concepts so the raw #1 normally
      // wins; this stays as a near-tie guard.
      const NEAR_TIE = 0.08
      const withContent = ms.find((m) => m.hasLesson && ms[0].score - m.score <= NEAR_TIE)
      const best = withContent ?? ms[0]
      setResolved(best)
      // The search genuinely resolved to a real concept in the library (the
      // no matches and out of domain paths above return before this line).
      // One of the three honest Jesse signals; see lib/learnActivity.ts.
      recordLearnActivity(uid, 'learn_search_resolved', {
        query: q,
        conceptId: best.conceptId,
        score: Number(best.score.toFixed(3)),
      })

      // The resolver builds the ramp for its own top match. If the near-tie
      // guard picked a different concept, that ramp is not about the concept
      // being shown, so it is dropped rather than mislabelled.
      const returned = Array.isArray(data.path) ? data.path : []
      const ramp = returned.length > 1 && returned[returned.length - 1].conceptId === best.conceptId ? returned : []
      setPath(ramp)
      const startAtFoundation = ramp.length > 1 && best.score < RAMP_CONFIDENCE_CEILING
      const startIndex = startAtFoundation ? 0 : ramp.length - 1
      setPathIndex(Math.max(0, startIndex))
      const startId = startAtFoundation ? ramp[0].conceptId : best.conceptId
      void loadContent(startId)
      highlightInGraph(startId)
      setTimeout(() => setPanelsRevealed(true), REVEAL_DELAY_MS)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, loadContent, uid])

  // A ?q= in the URL runs one search on mount, so the Dashboard can hand a
  // typed question straight through into this view.
  const autoRanRef = useRef(false)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !autoRanRef.current) {
      autoRanRef.current = true
      void search(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-simplify as soon as a real chapter is settled, once per concept. It
  // deliberately does NOT wait on the panel reveal the way the check question
  // does: the check question is an interruption and has to be timed, this is
  // just the default text and should be ready as early as possible.
  useEffect(() => {
    if (!resolved || outOfDomain || !activeConceptId) return
    if (contentLoading || !chapter?.body) return
    if (simplifyStartedForRef.current === activeConceptId) return
    simplifyStartedForRef.current = activeConceptId
    setSimplifying(true)
    setSimplifyFailed('')
    setSimplifiedBody('')
    setSimplifyMeta(null)
    void simplifyChapter(chapter.body, searchedQuery, activeConceptId)
      .then((v) => {
        if (!v.verified) { setSimplifyFailed(v.reason || 'not verified'); return }
        setSimplifiedBody(v.simplifiedBody ?? '')
        setSimplifyMeta({ reductionPct: v.reductionPct ?? 0, cached: v.cached === true })
        setShowSimplified(true)
      })
      .finally(() => setSimplifying(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, activeConceptId, contentLoading, resolved, outOfDomain])

  useEffect(() => {
    if (!panelsRevealed) { setPanelsSettled(false); return }
    const t = setTimeout(() => setPanelsSettled(true), SETTLE_DELAY_MS)
    return () => clearTimeout(t)
  }, [panelsRevealed])

  // Check question: starts only once the panels have settled, and only once
  // per concept. Keyed off the ACTIVE concept, not the resolved one, so
  // walking the guided path gets a question per step rather than one for a
  // concept the student has not reached yet.
  useEffect(() => {
    if (!panelsSettled || !resolved || outOfDomain || !activeConceptId) return
    if (contentLoading || !chapter) return
    if (checkStartedForRef.current === activeConceptId) return
    checkStartedForRef.current = activeConceptId
    setCheckLoading(true)
    setCheckFailed('')
    void fetchCheckQuestion(activeConceptId)
      .then(({ question, reason }) => {
        if (question) setCheckQuestion(question)
        else setCheckFailed(reason || 'no question available')
      })
      .finally(() => setCheckLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelsSettled, chapter, activeConceptId, contentLoading])

  function backToGraph() {
    setResolved(null)
    setMatches(null)
    setOutOfDomain(false)
    setPanelsRevealed(false)
    setPanelsSettled(false)
    setPath([])
    setPathIndex(0)
    resetPerConcept()
    graphIframeRef.current?.contentWindow?.postMessage({ type: 'clear' }, '*')
  }

  async function runSimGeneration() {
    if (!activeConceptId || !content) return
    setSimGenerating(true)
    setSimGenFailed('')
    setSimGenStatus('Starting generation...')
    setGeneratedSim(null)
    const { sim: made, reason } = await generateSim(content.label, { onStatus: setSimGenStatus })
    if (made) setGeneratedSim(made)
    else setSimGenFailed(reason || 'Generation did not produce a usable sim.')
    setSimGenerating(false)
    setSimGenStatus('')
    // Was missing entirely: a student asking for and getting a sim is real
    // study effort, same as answering a check question, but Jesse's leveling
    // never counted it. Only fires on a real, gate-passed result, not a
    // failed attempt.
    if (made && uid) recordLearnActivity(uid, 'learn_sim_generated', { conceptId: activeConceptId })
  }

  async function onAnswered(correct: boolean) {
    setCheckResult(correct ? 'Recorded: correct, on your own.' : 'Recorded: missed it, flagged for review.')
    if (!activeConceptId || !uid) return
    // The strongest of the three honest Jesse signals: a check question was
    // actually answered. Right or wrong both count as real study effort,
    // matching this page's own rule that only an answered question marks a
    // concept studied; see lib/learnActivity.ts.
    recordLearnActivity(uid, 'learn_check_answered', { conceptId: activeConceptId, correct })
    const updated = await recordStudied(uid, activeConceptId, correct, studyLog[activeConceptId])
    setStudyLog((prev) => ({ ...prev, [activeConceptId]: updated }))
  }

  function runSearch(text?: string) {
    const q = (text ?? query).trim()
    if (!q) return
    if (!embedded) {
      const next = new URLSearchParams(searchParams)
      next.set('q', q)
      setSearchParams(next, { replace: true })
    }
    void search(q)
  }

  // ── Materials upload ──────────────────────────────────────────────────────
  // Same pipeline as the Work tab (WorkStudio.tsx): rasterize client-side,
  // extract questions via /api/parse-homework, which transcribes and splits
  // only, never solves. Failures are stated plainly, never papered over.
  async function handleMaterialsFile(file: File, opts: { autoResolve?: boolean } = {}) {
    setMaterialsError('')
    setMaterialsBusy('Reading your pages...')
    try {
      const pages = await pagesFromFile(file)
      if (pages.length === 0) {
        setMaterialsError('Could not read that file. Try a clearer photo or a PDF.')
        return
      }
      setMaterialsBusy(`Pulling questions out of ${pages.length} page${pages.length > 1 ? 's' : ''}...`)
      const { questions, unavailable, needsKey } = await parseHomeworkPages(pages)
      if (needsKey) {
        setMaterialsError('Add a free API key in Settings (the gear icon on your dash) to use homework upload.')
        return
      }
      if (unavailable) {
        setMaterialsError('Reading is temporarily unavailable. Try again in a bit.')
        return
      }
      if (questions.length === 0) {
        setMaterialsError('No questions found on those pages. Try another file.')
        return
      }
      const materialsSnapshot: MaterialsState = { fileName: file.name, pageCount: pages.length, questions }
      setMaterials(materialsSnapshot)
      setRightTab('materials')
      // Uploading before ever searching has no resolved concept to hang the
      // materials panel off of, so the first extracted question doubles as
      // the search query: same resolve path as typing it in, just skipping
      // the retyping. A later upload from inside an already-resolved concept
      // (the materials panel's own uploader) must NOT do this, or it would
      // yank the student off the concept they are already reading.
      if (opts.autoResolve) {
        setSelectedQ(0)
        setQuery(questions[0].text)
        runSearch(questions[0].text)
        void loadSimForQuestion(0, materialsSnapshot)
      } else {
        setSelectedQ(null)
      }
    } catch {
      setMaterialsError('Something went wrong reading that upload.')
    } finally {
      setMaterialsBusy('')
    }
  }

  function selectQuestion(i: number) {
    setSelectedQ(i)
    setQHints(null)
    setQHintsTried(false)
    setHintsShown(0)
    setVoiceFailed(false)
    void loadSimForQuestion(i)
    // The help card renders in the left column; bring it into view so picking
    // a question on the right visibly answers on the left.
    window.setTimeout(() => {
      document.getElementById('lrn-q-intel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 80)
  }

  /** Resolve one materials question to its own concept and, if the library
   * already has a real sim there, load it, free, no generation spend. Cached
   * per question index so re-selecting the same question does not re-resolve.
   * Takes an optional explicit materials snapshot: the auto-resolve upload
   * path calls this in the same tick as setMaterials(), before the state
   * update has landed, so reading the `materials` state here would still see
   * the pre-upload value (null). */
  async function loadSimForQuestion(i: number, materialsOverride?: MaterialsState) {
    const m = materialsOverride ?? materials
    if (!m || questionSims[i]) return
    const q = m.questions[i]
    setQuestionSims((prev) => ({ ...prev, [i]: { status: 'loading' } }))
    try {
      const resolved = await resolveConcept(q.text, 3)
      const best = resolved.matches[0]
      if (!best) {
        setQuestionSims((prev) => ({ ...prev, [i]: { status: 'none' } }))
        return
      }
      if (!best.hasSim) {
        setQuestionSims((prev) => ({ ...prev, [i]: { status: 'none', conceptId: best.conceptId, conceptLabel: best.label } }))
        return
      }
      const content = await fetchConceptContent(best.conceptId)
      setQuestionSims((prev) => ({
        ...prev,
        [i]: content?.sim
          ? { status: 'ready', conceptId: best.conceptId, conceptLabel: best.label, sim: content.sim }
          : { status: 'none', conceptId: best.conceptId, conceptLabel: best.label },
      }))
    } catch {
      setQuestionSims((prev) => ({ ...prev, [i]: { status: 'error' } }))
    }
  }

  /** Same budget-gated generation pipeline the main reading pane uses
   * (runSimGeneration), scoped to one materials question's own concept
   * instead of the page's active one. Only reachable once loadSimForQuestion
   * has already confirmed the library has no sim here, same "deliberate
   * button, not automatic" rule. */
  async function generateSimForQuestion(i: number) {
    const qs = questionSims[i]
    if (!qs?.conceptLabel) return
    setQuestionSims((prev) => ({ ...prev, [i]: { ...prev[i], generating: true, genFailed: '' } }))
    const { sim: made, reason } = await generateSim(qs.conceptLabel, {
      onStatus: (s) => setQuestionSims((prev) => ({ ...prev, [i]: { ...prev[i], genStatus: s } })),
    })
    setQuestionSims((prev) => ({
      ...prev,
      [i]: {
        ...prev[i],
        generating: false,
        genStatus: '',
        generatedSim: made ?? undefined,
        genFailed: made ? '' : (reason || 'Generation did not produce a usable sim.'),
      },
    }))
    if (made && uid && qs.conceptId) recordLearnActivity(uid, 'learn_sim_generated', { conceptId: qs.conceptId })
  }

  async function fetchFirstHint() {
    if (!materials || selectedQ == null || !uid) return
    const q = materials.questions[selectedQ]
    setQHintsLoading(true)
    try {
      const result = await getIngredientCards(uid, q.text, 4)
      setQHints(result)
      setQHintsTried(true)
      setHintsShown(result && result.cards.length > 0 ? 1 : 0)
    } finally {
      setQHintsLoading(false)
    }
  }

  /** Read one hint aloud in Jesse's voice (Kokoro af_heart via /api/tts).
   * LaTeX delimiters are stripped for speech; failure is stated, not hidden. */
  async function speakHint(text: string, idx: number) {
    if (speakingIdx !== null) return
    setVoiceFailed(false)
    setSpeakingIdx(idx)
    try {
      const res = await fetch(`${WEBHOOK_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.replace(/\$/g, ''), voice: 'af_heart' }),
      })
      if (!res.ok) throw new Error('tts failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => { URL.revokeObjectURL(url); setSpeakingIdx(null) }
      audio.onerror = () => { URL.revokeObjectURL(url); setSpeakingIdx(null); setVoiceFailed(true) }
      await audio.play()
    } catch {
      setSpeakingIdx(null)
      setVoiceFailed(true)
    }
  }

  const visibleHintCards = qHints ? qHints.cards.slice(0, hintsShown) : []
  const moreHintsAvailable = !!qHints && hintsShown > 0 && hintsShown < qHints.cards.length

  return (
    <div style={{ height: embedded ? '100%' : '100vh', width: '100%', background: PAGE_BG, color: TEXT_PRIMARY, fontFamily: FONT_STACK, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes lrnRise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .lrn-col { scrollbar-width: thin; scrollbar-color: rgba(205,215,238,0.2) transparent; }
        .lrn-col::-webkit-scrollbar { width: 8px; }
        .lrn-col::-webkit-scrollbar-thumb { background: rgba(205,215,238,0.16); border-radius: 4px; }
        .lrn-neighbor { transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        .lrn-neighbor:hover { background: rgba(99,102,241,0.15) !important; border-color: rgba(129,140,248,0.55) !important; transform: translateX(3px); }
        .lrn-input:focus { outline: none; border-color: rgba(129,140,248,0.7) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
        .lrn-qrow { transition: background .15s ease, border-color .15s ease; }
        .lrn-qrow:hover { background: rgba(94,200,240,0.1) !important; border-color: rgba(94,200,240,0.45) !important; }
      `}</style>

      {nudge && !nudgeDismissed && (
        <div style={{ padding: '12px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: BORDER_SOFT, background: 'rgba(167,139,250,0.08)' }}>
          <span style={{ flex: 1, minWidth: 0, lineHeight: 1.5 }}>
            <b style={{ color: '#A78BFA' }}>Worth a look:</b> {nudge.trapLabel} keeps catching you on <b>{nudge.label}</b>. A quick pass now beats it showing up again later.
          </span>
          <button
            onClick={() => { setNudgeDismissed(true); setQuery(nudge.label); runSearch(nudge.label) }}
            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 9, border: 'none', background: '#A78BFA', color: '#1E1533', cursor: 'pointer' }}
          >
            Practice this
          </button>
          <button
            onClick={() => setNudgeDismissed(true)}
            aria-label="Dismiss"
            style={{ flexShrink: 0, fontSize: 12.5, padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(167,139,250,0.35)', background: 'transparent', color: TEXT_FAINT, cursor: 'pointer' }}
          >
            not now
          </button>
        </div>
      )}

      {resolved && (
        <div style={{ padding: '10px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: BORDER_SOFT, background: 'rgba(205,215,238,0.03)', color: outOfDomain ? '#FF7B7B' : belowThreshold ? '#F0C060' : TEXT_FAINT }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            {outOfDomain ? (
              <>Closest match was <b>{resolved.label}</b> at only {(resolved.score * 100).toFixed(0)}%, which is noise, not a real signal. Nothing in the {resolveMeta ? `${resolveMeta.indexed}-lesson library` : 'library'} is actually about this, so it is not shown as a match.</>
            ) : !chapter ? (
              <>
                Resolved to <b>{resolved.label}</b> in {resolved.subjectTitle || resolved.subject} at {(resolved.score * 100).toFixed(0)}%.
                {contentLoading ? ' Fetching its chapter...' : contentFailed ? ` ${contentFailed}` : ' No lesson exists for it yet. Honest gap, not a bug.'}
              </>
            ) : (
              <>
                Resolved to <b>{resolved.label}</b> in {resolved.subjectTitle || resolved.subject} at {(resolved.score * 100).toFixed(0)}% confidence
                {hasPath && pathIndex === 0 && (
                  <>, but that sits {path.length - 1} prerequisites deep, so you are starting at <b>{path[0].label}</b> and working up (step {pathIndex + 1} of {path.length})</>
                )}
                {hasPath && pathIndex > 0 && <>, its {path.length - 1}-step prerequisite ramp is shown below for context</>}
                {belowThreshold && ', below our calibrated bar, shown honestly rather than faked as a confident match'}
                {matches && matches[0].conceptId !== resolved.conceptId && (
                  <> (top raw match was "{matches[0].label}" at {(matches[0].score * 100).toFixed(0)}%, but it has no lesson yet, so showing the next best real one)</>
                )}
              </>
            )}
          </span>
          {showPanels && (
            <button onClick={backToGraph} style={{ flexShrink: 0, fontSize: 12, padding: '5px 13px', borderRadius: 9, border: '1px solid rgba(205,215,238,0.25)', background: 'transparent', color: TEXT_SOFT, cursor: 'pointer' }}>
              Back to full graph
            </button>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: showPanels ? 0 : 2, opacity: showPanels ? 0.55 : 1, pointerEvents: showPanels ? 'none' : 'auto', transition: 'opacity 0.6s ease' }}>
          <iframe
            ref={graphIframeRef}
            title="concept-graph"
            src="/full-graph-viewer.html?hideSubjects"
            onLoad={() => pushStudiedToGraph(studyLog)}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>

        {showPanels && chapter && resolved && (
          <div style={{ position: 'absolute', inset: '20px 16px 16px 16px', borderRadius: 18, zIndex: 1, display: 'flex', gap: 16, padding: '10px 12px 12px', background: 'transparent' }}>
            <div className="lrn-col" style={{ flex: hasSimContent ? '0 0 32%' : '1 1 58%', minWidth: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4, animation: 'lrnRise 0.55s ease both' }}>
              {hasPath && (
                <div style={{ ...CARD, padding: '16px 18px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <Eyebrow color="#58CC02">Your path to {path[path.length - 1].label}</Eyebrow>
                    <span style={{ fontSize: 11.5, color: contentLoading ? '#8BE85C' : TEXT_FAINT }}>
                      {contentLoading ? 'loading this step...' : `step ${pathIndex + 1} of ${path.length}`}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 10px', fontSize: 13, color: TEXT_FAINT, lineHeight: 1.55 }}>
                    Built from the real prerequisite edges in the concept graph, foundational first. Every step has a written lesson, so any chip is clickable.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {path.map((step, i) => {
                      const current = i === pathIndex
                      const done = i < pathIndex
                      return (
                        <span key={step.conceptId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {i > 0 && <span style={{ fontSize: 11, color: 'rgba(205,215,238,0.3)' }}>›</span>}
                          <button
                            onClick={() => goToStep(i)}
                            title={step.conceptId}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                              fontSize: 12.5, fontWeight: current ? 700 : 500, padding: '6px 12px', borderRadius: 999,
                              border: `1px solid ${current ? '#58CC02' : done ? 'rgba(88,204,2,0.32)' : 'rgba(205,215,238,0.18)'}`,
                              background: current ? 'rgba(88,204,2,0.18)' : done ? 'rgba(88,204,2,0.07)' : 'rgba(205,215,238,0.04)',
                              color: current ? '#8BE85C' : done ? TEXT_SOFT : TEXT_SOFT,
                            }}
                          >
                            <span style={{ fontSize: 10, opacity: 0.7 }}>{i + 1}</span>
                            {step.label}
                            {step.hasSim && <span style={{ fontSize: 9, fontWeight: 700, color: '#F0C060' }}>SIM</span>}
                            {isStudied(step.conceptId) && <span title="you have studied this before" style={{ fontSize: 9, fontWeight: 700, color: '#f2b84b' }}>✓ STUDIED</span>}
                          </button>
                        </span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => goToStep(pathIndex - 1)}
                      disabled={pathIndex === 0}
                      style={{ fontSize: 12.5, padding: '7px 13px', borderRadius: 9, border: '1px solid rgba(205,215,238,0.2)', background: 'transparent', color: pathIndex === 0 ? 'rgba(205,215,238,0.3)' : TEXT_SOFT, cursor: pathIndex === 0 ? 'default' : 'pointer' }}
                    >
                      Back
                    </button>
                    {nextStep ? (
                      <button
                        onClick={() => goToStep(pathIndex + 1)}
                        style={{ fontSize: 13, fontWeight: 600, padding: '8px 15px', borderRadius: 9, border: 'none', background: '#58CC02', color: '#0a1a00', cursor: 'pointer' }}
                      >
                        Next concept: {nextStep.label} ›
                      </button>
                    ) : (
                      <span style={{ fontSize: 12.5, color: TEXT_FAINT }}>
                        Last step. This is what "{searchedQuery || resolved.label}" actually resolved to.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {selectedQuestion && (
                <div id="lrn-q-intel" style={{ ...CARD, border: '1px solid rgba(94,200,240,0.35)', padding: '16px 18px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Eyebrow color="#5EC8F0">Help with {selectedQuestion.number ? `question ${selectedQuestion.number}` : 'this question'}</Eyebrow>
                    <button
                      onClick={() => setSelectedQ(null)}
                      style={{ marginLeft: 'auto', fontSize: 11.5, padding: '3px 10px', borderRadius: 7, border: '1px solid rgba(205,215,238,0.22)', background: 'transparent', color: TEXT_FAINT, cursor: 'pointer' }}
                    >
                      close
                    </button>
                  </div>
                  <div style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: TEXT_PRIMARY }}>
                    <MathText text={selectedQuestion.text} />
                  </div>
                  {selectedQuestion.figureNote && (
                    <p style={{ margin: '8px 0 0', fontSize: 12.5, color: TEXT_FAINT, lineHeight: 1.5 }}>The sheet shows: {selectedQuestion.figureNote}</p>
                  )}
                  <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: 'rgba(94,200,240,0.75)' }}>
                    Hints come one at a time, and never include the final answer. Doing the step yourself is what makes it stick.
                  </p>

                  {visibleHintCards.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                      {visibleHintCards.map((card, i) => (
                        <div key={card.cardTemplateId + i} style={{ border: '1px solid rgba(94,200,240,0.25)', background: 'rgba(94,200,240,0.07)', borderRadius: 12, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#5EC8F0', letterSpacing: 0.6 }}>HINT {i + 1}</span>
                            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{cleanDashes(card.title)}</span>
                            <button
                              onClick={() => void speakHint(cleanDashes(`${card.title}. ${card.body}`), i)}
                              disabled={speakingIdx !== null}
                              title="Hear this hint in Jesse's voice"
                              style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 9px', borderRadius: 7, border: '1px solid rgba(94,200,240,0.35)', background: 'transparent', color: speakingIdx === i ? '#5EC8F0' : 'rgba(94,200,240,0.8)', cursor: speakingIdx !== null ? 'default' : 'pointer', flexShrink: 0 }}
                            >
                              {speakingIdx === i ? 'playing...' : 'hear it'}
                            </button>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6, color: TEXT_SOFT }}>
                            <MathText text={cleanDashes(card.body)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {voiceFailed && (
                    <p style={{ margin: '8px 0 0', fontSize: 11.5, color: TEXT_FAINT }}>Voice is not available right now. The hint still stands in text.</p>
                  )}

                  <div style={{ marginTop: 12 }}>
                    {qHintsLoading ? (
                      <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(94,200,240,0.8)' }}>Building your hint path...</p>
                    ) : !qHintsTried ? (
                      <button
                        onClick={() => void fetchFirstHint()}
                        style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9, border: 'none', background: '#5EC8F0', color: '#062331', cursor: 'pointer' }}
                      >
                        Show me a first hint
                      </button>
                    ) : moreHintsAvailable ? (
                      <button
                        onClick={() => setHintsShown((n) => n + 1)}
                        style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(94,200,240,0.45)', background: 'transparent', color: '#5EC8F0', cursor: 'pointer' }}
                      >
                        Still stuck? Next hint ({hintsShown} of {qHints?.cards.length ?? 0} shown)
                      </button>
                    ) : visibleHintCards.length > 0 ? (
                      <p style={{ margin: 0, fontSize: 12.5, color: TEXT_FAINT, lineHeight: 1.55 }}>
                        That is every hint on this path. From here, working it on paper beats another hint. The check question below is a good next stop.
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: 12.5, color: TEXT_FAINT, lineHeight: 1.55 }}>
                        No hint path for this one yet. That is an honest gap, not a loading error. Reading the chapter here and trying the check question is the real next step.
                      </p>
                    )}
                  </div>

                  {selectedQ != null && questionSims[selectedQ] && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(94,200,240,0.2)' }}>
                      {(() => {
                        const qs = questionSims[selectedQ]
                        if (qs.status === 'loading') {
                          return <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(94,200,240,0.75)' }}>Checking for a sim on this...</p>
                        }
                        if (qs.status === 'ready' && qs.sim) {
                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#58CC02', letterSpacing: 0.6 }}>SIM</span>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{qs.sim.title}</span>
                              </div>
                              <iframe title="question-sim" srcDoc={qs.sim.html} style={{ width: '100%', height: 280, border: '1px solid rgba(205,215,238,0.15)', borderRadius: 12, background: 'white' }} sandbox="allow-scripts" />
                            </>
                          )
                        }
                        if (qs.generatedSim) {
                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', letterSpacing: 0.6 }}>AI GENERATED</span>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{qs.generatedSim.title}</span>
                              </div>
                              <iframe title="question-sim-generated" srcDoc={qs.generatedSim.html} style={{ width: '100%', height: 280, border: '1px solid rgba(205,215,238,0.15)', borderRadius: 12, background: 'white' }} sandbox="allow-scripts" />
                            </>
                          )
                        }
                        if (qs.generating) {
                          return <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(167,139,250,0.85)' }}>{qs.genStatus || 'Starting...'}</p>
                        }
                        if (qs.status === 'none' && qs.conceptLabel) {
                          return (
                            <>
                              <button
                                onClick={() => void generateSimForQuestion(selectedQ)}
                                style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(167,139,250,0.45)', background: 'transparent', color: '#A78BFA', cursor: 'pointer' }}
                              >
                                Generate a sim for this
                              </button>
                              {qs.genFailed && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#FF7B7B' }}>{qs.genFailed}</p>}
                            </>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )}
                </div>
              )}

              <div style={{ ...CARD, padding: '22px 24px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Eyebrow color="#58CC02">Chapter</Eyebrow>
                  {usingSimplified && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: '#5EC8F0', border: '1px solid rgba(94,200,240,0.5)', background: 'rgba(94,200,240,0.12)', borderRadius: 6, padding: '2px 8px' }}>
                      SIMPLIFIED
                    </span>
                  )}
                  {simplifying && <span style={{ fontSize: 11.5, color: 'rgba(94,200,240,0.8)' }}>simplifying for your question...</span>}
                  {simplifiedBody && (
                    <button
                      onClick={() => setShowSimplified((s) => !s)}
                      style={{ marginLeft: 'auto', fontSize: 11.5, padding: '4px 11px', borderRadius: 7, border: '1px solid rgba(205,215,238,0.25)', background: 'transparent', color: TEXT_SOFT, cursor: 'pointer' }}
                    >
                      {showSimplified ? 'show full original' : 'show simplified'}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.3, margin: '10px 0 8px', letterSpacing: -0.2 }}>{chapter.title}</div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: TEXT_SOFT, fontStyle: 'italic' }}>{chapter.summary}</p>
                {usingSimplified && simplifyMeta && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: 'rgba(94,200,240,0.75)' }}>
                    Auto-shortened by {simplifyMeta.reductionPct}% for how you asked ("{searchedQuery}"), then independently checked by a second model to confirm no formula, number, or conclusion was lost. Toggle above for the full original.
                  </p>
                )}
                {!usingSimplified && simplifyFailed && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: TEXT_FAINT }}>
                    Showing the full original chapter: the auto-simplified version was not used ({simplifyFailed}).
                  </p>
                )}
              </div>

              {chunks.map((group, i) => (
                <div key={`${usingSimplified ? 's' : 'o'}-${i}`} style={{ ...CARD, padding: '20px 24px', flexShrink: 0 }}>
                  <Eyebrow color="rgba(205,215,238,0.4)">Part {i + 1} of {chunks.length}</Eyebrow>
                  {group.map((p, j) => (
                    <p key={j} style={{ margin: '12px 0 0', fontSize: 16.5, lineHeight: 1.75, color: TEXT_PRIMARY, maxWidth: '64ch' }}>{p}</p>
                  ))}
                </div>
              ))}

              <div style={{ ...CARD, padding: '20px 24px', flexShrink: 0 }}>
                <Eyebrow color="#818CF8">Cement understanding</Eyebrow>
                {checkQuestion ? (
                  <>
                    <div style={{ marginTop: 10 }}>
                      <ColdCheckPrompt
                        key={checkQuestion.id}
                        question={checkQuestion as never}
                        onResult={({ correct }) => void onAnswered(correct)}
                      />
                    </div>
                    {checkResult && <p style={{ fontSize: 13.5, color: TEXT_SOFT, margin: '10px 0 0' }}>{checkResult}</p>}
                  </>
                ) : checkLoading ? (
                  <p style={{ fontSize: 13, color: TEXT_FAINT, margin: '8px 0 0', lineHeight: 1.6 }}>
                    Generating a check question for this concept and independently re-solving it before you see it...
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: TEXT_FAINT, margin: '8px 0 0', lineHeight: 1.6 }}>
                    No check question for this concept right now{checkFailed ? `: ${checkFailed}` : '.'} You can keep reading; this concept just will not be marked studied, since nothing was answered.
                  </p>
                )}
              </div>

              <div style={{ ...CARD, padding: '20px 22px', flexShrink: 0 }}>
                <Eyebrow color="#818CF8">Related concepts</Eyebrow>
                <p style={{ margin: '6px 0 12px', fontSize: 13, color: TEXT_FAINT, lineHeight: 1.5 }}>
                  Real graph edges from {activeLabel || resolved.label}: what comes before it, what it unlocks, and what connects across subjects.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {neighbors.length === 0 && <p style={{ margin: 0, fontSize: 13, color: TEXT_FAINT }}>No graph neighbours recorded for this concept.</p>}
                  {neighbors.map((n) => (
                    <button
                      key={`${n.relation}-${n.id}`}
                      className="lrn-neighbor"
                      onClick={() => { resetPerConcept(); setPath([]); setPathIndex(0); void loadContent(n.id); highlightInGraph(n.id) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '11px 13px', borderRadius: 11, border: '1px solid rgba(205,215,238,0.13)', background: 'rgba(205,215,238,0.04)', color: TEXT_PRIMARY, cursor: 'pointer', fontSize: 14 }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {n.label}
                        <span style={{ display: 'block', fontSize: 11.5, color: TEXT_FAINT, marginTop: 2 }}>{n.group}</span>
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: n.relation === 'prerequisite' ? '#8BE85C' : n.relation === 'next' ? '#818CF8' : '#A78BFA', border: '1px solid currentColor', borderRadius: 6, padding: '2px 7px', opacity: 0.85 }}>
                        {n.relation === 'prerequisite' ? 'BEFORE' : n.relation === 'next' ? 'NEXT' : 'CROSS'}
                      </span>
                      {isStudied(n.id) && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#f2b84b', border: '1px solid rgba(242,184,75,0.4)', borderRadius: 6, padding: '2px 7px' }}>✓</span>}
                      {n.hasSim && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#F0C060', border: '1px solid rgba(240,192,96,0.4)', borderRadius: 6, padding: '2px 7px' }}>SIM</span>}
                      {!n.hasChapter && <span style={{ flexShrink: 0, fontSize: 10.5, color: TEXT_FAINT }}>no chapter yet</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ flex: hasSimContent ? '1 1 auto' : '0 0 38%', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 0, animation: 'lrnRise 0.55s ease 0.08s both' }}>
              {hasSimContent && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexShrink: 0 }}>
                  {(['sim', 'materials'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setRightTab(tab)}
                      style={{
                        fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                        border: `1px solid ${effectiveTab === tab ? 'rgba(129,140,248,0.6)' : 'rgba(205,215,238,0.18)'}`,
                        background: effectiveTab === tab ? '#2A3054' : 'rgba(15,20,36,0.85)',
                        color: effectiveTab === tab ? '#B4BCF9' : TEXT_FAINT,
                      }}
                    >
                      {tab === 'sim' ? 'Simulation' : `Your materials${materials ? ` (${materials.questions.length})` : ''}`}
                    </button>
                  ))}
                </div>
              )}

              {hasSimContent && effectiveTab === 'sim' ? (
                sim ? (
                  <div style={{ ...CARD, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: BORDER_SOFT, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <Eyebrow color="#F0C060">Interactive simulation</Eyebrow>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{sim.title}</span>
                      {sim.sourceRepo && <span style={{ fontSize: 11.5, color: TEXT_FAINT }}>{sim.sourceRepo}</span>}
                    </div>
                    <iframe title="sim" srcDoc={sim.html} style={{ flex: 1, border: 'none', background: 'white' }} sandbox="allow-scripts" />
                  </div>
                ) : generatedSim ? (
                  <div style={{ ...CARD, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: BORDER_SOFT, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <Eyebrow color="#A78BFA">Interactive simulation</Eyebrow>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{generatedSim.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: '#A78BFA', border: '1px solid rgba(167,139,250,0.5)', background: 'rgba(167,139,250,0.12)', borderRadius: 6, padding: '2px 8px' }}>
                        AI GENERATED
                      </span>
                      {generatedSim.cached && <span style={{ fontSize: 10.5, color: TEXT_FAINT }}>reused from the library, not regenerated</span>}
                      <div style={{ flexBasis: '100%', fontSize: 11.5, color: TEXT_FAINT, lineHeight: 1.5, marginTop: 4 }}>
                        Generated by the MicroSim pipeline and only shown because it passed the structural rubric and the visual quality gate. Not human reviewed.
                        {typeof generatedSim.qualityGateScore === 'number' ? ` Gate score ${generatedSim.qualityGateScore}.` : ''}
                      </div>
                    </div>
                    <iframe title="generated-sim" srcDoc={generatedSim.html} style={{ flex: 1, border: 'none', background: 'white' }} sandbox="allow-scripts" />
                  </div>
                ) : null
              ) : (
                <div className="lrn-col" style={{ ...CARD, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 22px' }}>
                  {!hasSimContent && (
                    <div style={{ borderBottom: BORDER_SOFT, paddingBottom: 16 }}>
                      <Eyebrow color="#A78BFA">Simulation</Eyebrow>
                      <div style={{ fontSize: 15.5, fontWeight: 700, margin: '8px 0 6px', color: TEXT_PRIMARY }}>No simulation exists yet for this concept</div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: TEXT_FAINT }}>
                        {counts ? `Only ${counts.withSim} of ${counts.nodes} concepts in the library have a pre-built interactive sim so far` : 'Most concepts have no pre-built interactive sim yet'}, and {activeLabel || resolved.label} isn't one of them. That's a real content gap we're closing, not a loading error.
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => void runSimGeneration()}
                          disabled={simGenerating}
                          style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: simGenerating ? 'rgba(167,139,250,0.35)' : '#A78BFA', color: '#140a2e', fontWeight: 700, fontSize: 13, cursor: simGenerating ? 'default' : 'pointer' }}
                        >
                          {simGenerating ? 'Generating and reviewing...' : 'Generate a sim for this'}
                        </button>
                      </div>
                      {simGenerating ? (
                        <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.6, color: 'rgba(167,139,250,0.85)' }}>
                          {simGenStatus || 'Starting...'} The pipeline writes the sim, renders it headlessly, scores it against a structural rubric, then runs a visual quality gate. Nothing is shown unless the whole gate passes, and if it fails you will be told why. This usually takes under two minutes.
                        </p>
                      ) : simGenFailed ? (
                        <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.6, color: '#FF7B7B' }}>{simGenFailed}</p>
                      ) : (
                        <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.6, color: TEXT_FAINT }}>
                          A generated sim is clearly badged AI GENERATED and is never shown unless it passes the quality gate. Generation spends from a shared monthly budget, so it is a deliberate button, not automatic.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <Eyebrow color="#5EC8F0">Your materials</Eyebrow>
                    {!materials ? (
                      <>
                        <p style={{ margin: '8px 0 12px', fontSize: 13.5, lineHeight: 1.65, color: TEXT_SOFT }}>
                          Working from a real worksheet? Upload it and every question becomes clickable, each with its own hint path next to the reading. We read and split your pages; we never solve them for you.
                        </p>
                        <input
                          ref={materialsFileRef}
                          type="file"
                          accept={MATERIALS_ACCEPT}
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void handleMaterialsFile(f)
                            e.target.value = ''
                          }}
                        />
                        <button
                          onClick={() => materialsFileRef.current?.click()}
                          disabled={!!materialsBusy}
                          style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px dashed rgba(94,200,240,0.5)', background: 'rgba(94,200,240,0.07)', color: '#5EC8F0', fontWeight: 700, fontSize: 13, cursor: materialsBusy ? 'default' : 'pointer' }}
                        >
                          {materialsBusy || 'Upload a worksheet (PDF or photo)'}
                        </button>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: '8px 0 12px', fontSize: 12.5, lineHeight: 1.55, color: TEXT_FAINT }}>
                          {materials.fileName} · {materials.pageCount} page{materials.pageCount > 1 ? 's' : ''} · {materials.questions.length} question{materials.questions.length > 1 ? 's' : ''} found. Tap a question and its help opens on the left, next to the reading.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {materials.questions.map((q, i) => {
                            const active = selectedQ === i
                            return (
                              <button
                                key={q.id}
                                className="lrn-qrow"
                                onClick={() => selectQuestion(i)}
                                style={{
                                  textAlign: 'left', padding: '11px 13px', borderRadius: 11, cursor: 'pointer',
                                  border: `1px solid ${active ? 'rgba(94,200,240,0.6)' : 'rgba(205,215,238,0.13)'}`,
                                  background: active ? 'rgba(94,200,240,0.12)' : 'rgba(205,215,238,0.04)',
                                  color: TEXT_PRIMARY, fontSize: 14, lineHeight: 1.55,
                                }}
                              >
                                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: active ? '#5EC8F0' : TEXT_FAINT }}>
                                    {q.number ? `Q${q.number}` : `#${i + 1}`}
                                  </span>
                                  <span style={{ flex: 1, minWidth: 0 }}>
                                    <MathText text={q.text.length > 220 ? `${q.text.slice(0, 220)}...` : q.text} />
                                  </span>
                                </span>
                                {q.ambiguous && (
                                  <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#F0C060' }}>
                                    We may have split this one oddly. Read it before you start.
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        <button
                          onClick={() => { setMaterials(null); setSelectedQ(null); setQHints(null); setQHintsTried(false); setHintsShown(0); setMaterialsError('') }}
                          style={{ marginTop: 12, fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(205,215,238,0.2)', background: 'transparent', color: TEXT_FAINT, cursor: 'pointer', alignSelf: 'flex-start' }}
                        >
                          Clear and upload a different file
                        </button>
                      </>
                    )}
                    {materialsError && <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.55, color: '#FF7B7B' }}>{materialsError}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: BORDER_SOFT, display: 'flex', gap: 10, alignItems: 'center', background: PAGE_BG, flexWrap: 'wrap' }}>
        <input
          className="lrn-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Ask anything, or paste a homework question..."
          style={{ flex: 1, minWidth: 220, padding: '13px 17px', borderRadius: 13, border: '1px solid rgba(205,215,238,0.2)', background: 'rgba(205,215,238,0.05)', color: TEXT_PRIMARY, fontSize: 15, fontFamily: FONT_STACK }}
        />
        <button onClick={() => runSearch()} disabled={loading} style={{ padding: '13px 28px', borderRadius: 13, border: 'none', background: '#6366F1', color: 'white', fontWeight: 600, fontSize: 14.5, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? '...' : 'Search'}
        </button>
        <input
          ref={topUploadFileRef}
          type="file"
          accept={MATERIALS_ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleMaterialsFile(f, { autoResolve: true })
            e.target.value = ''
          }}
        />
        <button
          onClick={() => topUploadFileRef.current?.click()}
          disabled={!!materialsBusy || loading}
          title="Upload a worksheet and jump straight to it, no typing needed"
          style={{ padding: '13px 20px', borderRadius: 13, border: '1.5px dashed rgba(94,200,240,0.5)', background: 'rgba(94,200,240,0.07)', color: '#5EC8F0', fontWeight: 600, fontSize: 13.5, cursor: materialsBusy || loading ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {materialsBusy || 'Upload homework'}
        </button>
        {/* The materials panel's own error line only exists once a concept has
            resolved, so an upload started from here (before anything has
            resolved) needs its own surface, or a failure reads as the button
            just silently doing nothing. */}
        {!showPanels && materialsError && (
          <span style={{ fontSize: 12.5, color: '#FF7B7B', maxWidth: 320, lineHeight: 1.45 }}>{materialsError}</span>
        )}
        {embedPct !== null && embedPct < 100 && !embedderReady() && (
          <span style={{ fontSize: 12, color: '#5EC8F0', maxWidth: 360, lineHeight: 1.45 }}>
            Getting the search model ready ({embedPct}%). This is a one-time download that stays cached in your browser, and it runs on your device, so searching costs nothing.
          </span>
        )}
        {resolveMeta && !loading && (
          <span style={{ fontSize: 11.5, color: TEXT_FAINT, whiteSpace: 'nowrap' }}>
            {resolveMeta.indexed} concepts searched in {resolveMeta.totalMs}ms{resolveMeta.coldStart ? ' (cold start)' : ''}
          </span>
        )}
        {studiedIds.length > 0 && (
          <span title={studiedIds.join(', ')} style={{ fontSize: 12, color: '#f2b84b', whiteSpace: 'nowrap' }}>
            ✓ {studiedIds.length} studied
          </span>
        )}
        {err && <p style={{ color: '#FF7B7B', fontSize: 13.5, margin: 0 }}>{err}</p>}
      </div>
    </div>
  )
}
