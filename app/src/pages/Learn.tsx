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
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  type PathStep,
  type ConceptContent,
  type CheckQuestion,
  type GeneratedSim,
  type StudyRecord,
} from '../lib/conceptLibrary'
import { pagesFromFile, parseHomeworkPages } from '../lib/homework'
import { getIngredientCards, getRecommendations, WEBHOOK_BASE, type IngredientRecommendResult } from '../lib/mlApi'
import { mlIdToLabel } from '../lib/conceptMap'
import { lookupMisconceptionTrap } from '../lib/questionBank'
import { prewarmEmbedder, embedderReady } from '../lib/queryEmbedder'
import { recordLearnActivity } from '../lib/learnActivity'
import NudgeBanner from './learn/NudgeBanner'
import StatusBar from './learn/StatusBar'
import PathRamp from './learn/PathRamp'
import QuestionHelpCard from './learn/QuestionHelpCard'
import ReadingPane from './learn/ReadingPane'
import NeighborsCard from './learn/NeighborsCard'
import RightColumn from './learn/RightColumn'
import SearchBar from './learn/SearchBar'
import EntryStage from './learn/EntryStage'
import RouteCards from './learn/RouteCards'
import TutorPanel, { type TutorMessage } from './learn/TutorPanel'
import { askTutor } from '../lib/learnTutor'
import HistorySidebar from './learn/HistorySidebar'
import { loadLearnSessions, fetchTutorHistory, type LearnSessionSummary } from '../lib/learnSessions'
import { PAGE_BG, FONT_STACK, TEXT_PRIMARY, type NeighborRow, type MaterialsState, type LibraryCounts, type QuestionSimState } from './learn/shared'

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

  // ── Entry + route cards (Phase 1) ────────────────────────────────────────
  // A resolve from a genuinely blank-slate search (typed into the entry
  // stage or the main search bar) does not jump straight to content. It
  // stops here with the real data needed to offer a few honest routes in,
  // and only calls loadContent/highlightInGraph/reveals the panels once the
  // student actually picks one (see pickRoute). The three ALREADY-specific
  // entry points, a ?q= deep link from the Dashboard, a materials
  // auto-resolve, and the nudge banner's "Practice this", skip this stage
  // entirely and keep their exact pre-Phase-1 direct-to-content behavior:
  // the student already said precisely what they want, a route picker
  // would be friction, not help.
  const [routeCardsFor, setRouteCardsFor] = useState<{
    best: ConceptMatch
    ramp: PathStep[]
    startAtFoundation: boolean
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // ── Phase 2: guarded tutor chat ───────────────────────────────────────────
  // One conversation per concept (activeConceptId doubles as the session
  // id, see sendTutorMessage), reset by resetPerConcept the same way every
  // other per-concept surface already is. Sends through askTutor
  // (lib/learnTutor.ts), which runs on the student's own BYOK key first,
  // a capped platform fallback second, and reveals the next hint card
  // client-side as a last resort, never a dead end.
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([])
  const [tutorInput, setTutorInput] = useState('')
  const [tutorSending, setTutorSending] = useState(false)
  const [tutorError, setTutorError] = useState('')

  // ── Phase 3: chat-history sidebar ─────────────────────────────────────────
  // A lightweight per-student index (learnSessions/{uid}, read directly from
  // Firestore, same pattern loadStudyLog already uses) of which concepts
  // have a Jesse conversation and when it last moved. Picking one re-opens
  // that concept AND its actual chat transcript (fetchTutorHistory, backend
  // only, see lib/learnSessions.ts's doc comment for why).
  const [sessions, setSessions] = useState<LearnSessionSummary[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  // ── Proactive misconception nudge ───────────────────────────────────────
  // 2026-09-02: every surface on this page was student-initiated (search,
  // upload, hints on request), nothing ever spoke up first. This is the
  // fix: /recommend already computes misconceptionGaps (a reviewed
  // misconception -> ingredient map, not a raw LLM guess) for every
  // student, it was just never surfaced outside the tutor dashboard. Shown
  // the moment this page opens, before any search, because "independent,
  // inside the platform" is most of how a student actually studies here,
  // and tutors are once a week; this either catches the gap or it does not.
  const [nudge, setNudge] = useState<{ conceptId: string; label: string; trapLabel: string } | null>(null)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  // ── Per-question sims ────────────────────────────────────────────────────
  // "Sims and questions are trackable and give us immediate data": every
  // materials question resolves to its own concept and, if the library
  // already has a real sim for it (no generation spend), loads it
  // automatically alongside the hint path. If none exists yet, a real
  // "generate one" button stands in, same budget-gated pipeline the main
  // reading pane already uses, just scoped to this one question's concept.
  // QuestionSimState lives in ./learn/shared, shared with QuestionHelpCard.
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
    void loadLearnSessions(uid).then(setSessions)
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
    setTutorMessages([])
    setTutorInput('')
    setTutorError('')
    checkStartedForRef.current = null
    simplifyStartedForRef.current = null
    simGenStartedForRef.current = null
  }

  /** One turn of the guarded tutor chat. activeConceptId doubles as the
   * conversation's session id, so leaving and coming back to the same
   * concept resumes it (loadHistory in the backend), the same continuity
   * every other per-concept surface here already has. */
  async function sendTutorMessage() {
    const text = tutorInput.trim()
    if (!text || !activeConceptId || tutorSending) return
    setTutorInput('')
    setTutorError('')
    setTutorMessages((prev) => [...prev, { role: 'user', content: text }])
    setTutorSending(true)
    try {
      const result = await askTutor({
        sessionId: activeConceptId,
        message: text,
        conceptId: activeConceptId,
        conceptLabel: activeLabel || resolved?.label || activeConceptId,
        questionText: selectedQuestion?.text,
        chapterSummary: chapter?.summary,
        hintsShown,
      })
      setTutorMessages((prev) => [...prev, { role: 'assistant', content: result.reply, fallback: result.fallback }])
      if (result.action === 'reveal_hint') {
        setHintsShown((n) => (qHints ? Math.min(qHints.cards.length, n + 1) : n))
      }
      // The backend already upserted this concept to the front of the
      // student's session index (learn-tutor.ts's upsertLearnSession); pull
      // the fresh list so the sidebar reflects it without a page reload.
      if (uid) void loadLearnSessions(uid).then(setSessions)
    } catch (e) {
      setTutorError(String(e instanceof Error ? e.message : e))
    } finally {
      setTutorSending(false)
    }
  }

  /** Fired by HistorySidebar. Re-opens a past concept exactly like a
   * neighbor/route pick (loadContent + highlightInGraph + reveal), skipping
   * the resolver since the concept id is already known, then loads that
   * concept's actual chat transcript so the student picks up the
   * conversation instead of starting it over. Reachable from any stage,
   * including a still-blank EntryStage, so it resets the same search-level
   * state search() itself resets before setting the new resolved concept. */
  async function openSession(conceptId: string, conceptLabel: string) {
    setHistoryOpen(false)
    resetPerConcept()
    setMatches(null)
    setOutOfDomain(false)
    setPath([])
    setPathIndex(0)
    setRouteCardsFor(null)
    setPanelsRevealed(false)
    setPanelsSettled(false)
    setQuery(conceptLabel)
    setSearchedQuery(conceptLabel)
    const labels = await fetchConceptLabels([conceptId])
    const meta = labels.get(conceptId)
    setResolved({
      conceptId,
      label: meta?.label ?? conceptLabel,
      subject: '',
      subjectTitle: meta?.subjectTitle ?? '',
      level: meta?.level ?? '',
      hasLesson: meta?.hasLesson ?? true,
      hasSim: meta?.hasSim ?? false,
      score: 1,
    })
    void loadContent(conceptId)
    highlightInGraph(conceptId)
    setTimeout(() => setPanelsRevealed(true), REVEAL_DELAY_MS)
    const history = await fetchTutorHistory(conceptId)
    setTutorMessages(history)
  }

  function goToStep(i: number) {
    const step = path[i]
    if (!step) return
    setPathIndex(i)
    resetPerConcept(true)
    void loadContent(step.conceptId, true)
    highlightInGraph(step.conceptId)
  }

  const search = useCallback(async (text?: string, opts: { skipRouteCards?: boolean } = {}) => {
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
    setRouteCardsFor(null)
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
      if (!opts.skipRouteCards) {
        // Stop here. pickRoute (fired by RouteCards) does the loadContent
        // + highlight + reveal this used to do unconditionally.
        setRouteCardsFor({ best, ramp, startAtFoundation })
        return
      }
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

  /** Fired by a RouteCards pick. Does what search() used to do
   * unconditionally before Phase 1: sets the real path index for whichever
   * route was chosen, loads that concept's content, highlights it in the
   * graph, and reveals the panels. */
  function pickRoute(conceptId: string, pathIndexToUse: number) {
    setRouteCardsFor(null)
    setPathIndex(Math.max(0, pathIndexToUse))
    void loadContent(conceptId)
    highlightInGraph(conceptId)
    setTimeout(() => setPanelsRevealed(true), REVEAL_DELAY_MS)
  }

  // A ?q= in the URL runs one search on mount, so the Dashboard can hand a
  // typed question straight through into this view.
  const autoRanRef = useRef(false)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !autoRanRef.current) {
      autoRanRef.current = true
      void search(q, { skipRouteCards: true })
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

  function runSearch(text?: string, opts: { skipRouteCards?: boolean } = {}) {
    const q = (text ?? query).trim()
    if (!q) return
    if (!embedded) {
      const next = new URLSearchParams(searchParams)
      next.set('q', q)
      setSearchParams(next, { replace: true })
    }
    void search(q, opts)
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
        runSearch(questions[0].text, { skipRouteCards: true })
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
        <NudgeBanner
          nudge={nudge}
          onPractice={() => { setNudgeDismissed(true); setQuery(nudge.label); runSearch(nudge.label, { skipRouteCards: true }) }}
          onDismiss={() => setNudgeDismissed(true)}
        />
      )}

      {resolved && (
        <StatusBar
          resolved={resolved}
          outOfDomain={outOfDomain}
          belowThreshold={belowThreshold}
          chapter={chapter}
          contentLoading={contentLoading}
          contentFailed={contentFailed}
          hasPath={hasPath}
          path={path}
          pathIndex={pathIndex}
          matches={matches}
          resolveMeta={resolveMeta}
          showPanels={showPanels}
          onBackToGraph={backToGraph}
        />
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

        {uid && (
          <HistorySidebar
            sessions={sessions}
            open={historyOpen}
            onToggle={() => setHistoryOpen((v) => !v)}
            onOpenSession={(conceptId, conceptLabel) => void openSession(conceptId, conceptLabel)}
            activeConceptId={activeConceptId}
          />
        )}

        {!searchedQuery && !materials && !routeCardsFor && (
          <EntryStage
            onFocusSearch={() => searchInputRef.current?.focus()}
            onUploadHomework={() => topUploadFileRef.current?.click()}
            nudgeLabel={nudge && !nudgeDismissed ? nudge.label : null}
            onPracticeNudge={() => {
              if (!nudge) return
              setNudgeDismissed(true)
              setQuery(nudge.label)
              runSearch(nudge.label, { skipRouteCards: true })
            }}
          />
        )}

        {routeCardsFor && (
          <RouteCards
            resolvedLabel={routeCardsFor.best.label}
            hasFoundation={routeCardsFor.ramp.length > 1}
            foundationLabel={routeCardsFor.ramp[0]?.label}
            rampLength={routeCardsFor.ramp.length}
            personalizedLabel={nudge && nudge.conceptId !== routeCardsFor.best.conceptId ? nudge.label : null}
            personalizedTrapLabel={nudge?.trapLabel ?? null}
            onPickFoundation={() => pickRoute(routeCardsFor.ramp[0].conceptId, 0)}
            onPickDirect={() => pickRoute(routeCardsFor.best.conceptId, Math.max(0, routeCardsFor.ramp.length - 1))}
            onPickPersonalized={() => { if (nudge) runSearch(nudge.label, { skipRouteCards: true }) }}
            onUploadInstead={() => topUploadFileRef.current?.click()}
          />
        )}

        {showPanels && chapter && resolved && (
          <div style={{ position: 'absolute', inset: '20px 16px 16px 16px', borderRadius: 18, zIndex: 1, display: 'flex', gap: 16, padding: '10px 12px 12px', background: 'transparent' }}>
            <div className="lrn-col" style={{ flex: hasSimContent ? '0 0 32%' : '1 1 58%', minWidth: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4, animation: 'lrnRise 0.55s ease both' }}>
              {hasPath && (
                <PathRamp
                  path={path}
                  pathIndex={pathIndex}
                  contentLoading={contentLoading}
                  nextStep={nextStep}
                  searchedQuery={searchedQuery}
                  resolved={resolved}
                  isStudied={isStudied}
                  onGoToStep={goToStep}
                />
              )}

              {selectedQuestion && (
                <QuestionHelpCard
                  selectedQuestion={selectedQuestion}
                  onClose={() => setSelectedQ(null)}
                  visibleHintCards={visibleHintCards}
                  speakingIdx={speakingIdx}
                  onSpeakHint={(text, idx) => void speakHint(text, idx)}
                  voiceFailed={voiceFailed}
                  qHintsLoading={qHintsLoading}
                  qHintsTried={qHintsTried}
                  onFetchFirstHint={() => void fetchFirstHint()}
                  moreHintsAvailable={moreHintsAvailable}
                  hintsShown={hintsShown}
                  qHints={qHints}
                  onShowNextHint={() => setHintsShown((n) => n + 1)}
                  questionSim={selectedQ != null ? questionSims[selectedQ] : undefined}
                  onGenerateSim={() => { if (selectedQ != null) void generateSimForQuestion(selectedQ) }}
                />
              )}

              <ReadingPane
                chapter={chapter}
                usingSimplified={usingSimplified}
                simplifying={simplifying}
                simplifiedBody={simplifiedBody}
                showSimplified={showSimplified}
                onToggleSimplified={() => setShowSimplified((s) => !s)}
                simplifyMeta={simplifyMeta}
                searchedQuery={searchedQuery}
                simplifyFailed={simplifyFailed}
                chunks={chunks}
                checkQuestion={checkQuestion}
                checkLoading={checkLoading}
                checkFailed={checkFailed}
                checkResult={checkResult}
                onAnswered={(correct) => void onAnswered(correct)}
              />

              <TutorPanel
                messages={tutorMessages}
                input={tutorInput}
                onInputChange={setTutorInput}
                onSend={() => void sendTutorMessage()}
                sending={tutorSending}
                error={tutorError}
              />

              <NeighborsCard
                activeLabel={activeLabel}
                resolvedLabel={resolved.label}
                neighbors={neighbors}
                isStudied={isStudied}
                onOpenNeighbor={(id) => { resetPerConcept(); setPath([]); setPathIndex(0); void loadContent(id); highlightInGraph(id) }}
              />
            </div>

            <RightColumn
              hasSimContent={hasSimContent}
              effectiveTab={effectiveTab}
              onSetRightTab={setRightTab}
              materials={materials}
              sim={sim}
              generatedSim={generatedSim}
              counts={counts}
              activeLabel={activeLabel}
              resolved={resolved}
              simGenerating={simGenerating}
              simGenStatus={simGenStatus}
              simGenFailed={simGenFailed}
              onRunSimGeneration={() => void runSimGeneration()}
              materialsBusy={materialsBusy}
              materialsError={materialsError}
              selectedQ={selectedQ}
              materialsFileRef={materialsFileRef}
              materialsAccept={MATERIALS_ACCEPT}
              onFileChosen={(f) => void handleMaterialsFile(f)}
              onSelectQuestion={selectQuestion}
              onClearMaterials={() => { setMaterials(null); setSelectedQ(null); setQHints(null); setQHintsTried(false); setHintsShown(0); setMaterialsError('') }}
            />
          </div>
        )}
      </div>

      <SearchBar
        query={query}
        onQueryChange={setQuery}
        onSearch={() => runSearch()}
        loading={loading}
        inputRef={searchInputRef}
        topUploadFileRef={topUploadFileRef}
        materialsAccept={MATERIALS_ACCEPT}
        onTopUpload={(f) => void handleMaterialsFile(f, { autoResolve: true })}
        materialsBusy={materialsBusy}
        showPanels={showPanels}
        materialsError={materialsError}
        embedPct={embedPct}
        embedderReady={embedderReady()}
        resolveMeta={resolveMeta}
        studiedIds={studiedIds}
        err={err}
      />
    </div>
  )
}
