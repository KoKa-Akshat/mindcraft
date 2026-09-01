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
 */
import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import ColdCheckPrompt from '../components/ColdCheckPrompt'
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
import { prewarmEmbedder, embedderReady } from '../lib/queryEmbedder'
import { recordLearnActivity } from '../lib/learnActivity'

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

interface LibraryCounts { nodes: number; withLesson: number; withSim: number; subjects: number }

const CARD: CSSProperties = {
  background: '#13131C',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  boxShadow: '0 12px 32px rgba(0,0,0,0.38)',
}

function Eyebrow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color }}>
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

  const graphIframeRef = useRef<HTMLIFrameElement>(null)
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

  return (
    <div style={{ height: embedded ? '100%' : '100vh', width: '100%', background: '#0A0A0F', color: 'white', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes lrnRise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .lrn-col { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent; }
        .lrn-col::-webkit-scrollbar { width: 8px; }
        .lrn-col::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }
        .lrn-neighbor { transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        .lrn-neighbor:hover { background: rgba(99,102,241,0.13) !important; border-color: rgba(99,102,241,0.5) !important; transform: translateX(3px); }
        .lrn-input:focus { outline: none; border-color: rgba(99,102,241,0.65) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }
      `}</style>

      {resolved && (
        <div style={{ padding: '10px 20px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: outOfDomain ? '#FF6B6B' : belowThreshold ? '#F0C060' : 'rgba(255,255,255,0.5)' }}>
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
            <button onClick={backToGraph} style={{ flexShrink: 0, fontSize: 11, padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
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
            src="/full-graph-viewer.html"
            onLoad={() => pushStudiedToGraph(studyLog)}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>

        {showPanels && chapter && resolved && (
          <div style={{ position: 'absolute', inset: '20px 16px 16px 16px', borderRadius: 18, zIndex: 1, display: 'flex', gap: 14, padding: '10px 12px 12px', background: 'transparent' }}>
            <div className="lrn-col" style={{ flex: sim || generatedSim ? '0 0 32%' : '1 1 58%', minWidth: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4, animation: 'lrnRise 0.55s ease both' }}>
              {hasPath && (
                <div style={{ ...CARD, padding: '14px 16px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <Eyebrow color="#58CC02">Your path to {path[path.length - 1].label}</Eyebrow>
                    <span style={{ fontSize: 10.5, color: contentLoading ? '#8BE85C' : 'rgba(255,255,255,0.4)' }}>
                      {contentLoading ? 'loading this step...' : `step ${pathIndex + 1} of ${path.length}`}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                    Built from the real prerequisite edges in the concept graph, foundational first. Every step has a written lesson, so any chip is clickable.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {path.map((step, i) => {
                      const current = i === pathIndex
                      const done = i < pathIndex
                      return (
                        <span key={step.conceptId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {i > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>›</span>}
                          <button
                            onClick={() => goToStep(i)}
                            title={step.conceptId}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                              fontSize: 11.5, fontWeight: current ? 700 : 500, padding: '5px 10px', borderRadius: 999,
                              border: `1px solid ${current ? '#58CC02' : done ? 'rgba(88,204,2,0.32)' : 'rgba(255,255,255,0.14)'}`,
                              background: current ? 'rgba(88,204,2,0.18)' : done ? 'rgba(88,204,2,0.06)' : 'rgba(255,255,255,0.03)',
                              color: current ? '#8BE85C' : done ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.72)',
                            }}
                          >
                            <span style={{ fontSize: 9.5, opacity: 0.7 }}>{i + 1}</span>
                            {step.label}
                            {step.hasSim && <span style={{ fontSize: 8.5, fontWeight: 700, color: '#F0C060' }}>SIM</span>}
                            {isStudied(step.conceptId) && <span title="you have studied this before" style={{ fontSize: 8.5, fontWeight: 700, color: '#f2b84b' }}>✓ STUDIED</span>}
                          </button>
                        </span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => goToStep(pathIndex - 1)}
                      disabled={pathIndex === 0}
                      style={{ fontSize: 11.5, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: pathIndex === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)', cursor: pathIndex === 0 ? 'default' : 'pointer' }}
                    >
                      Back
                    </button>
                    {nextStep ? (
                      <button
                        onClick={() => goToStep(pathIndex + 1)}
                        style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#58CC02', color: '#0a1a00', cursor: 'pointer' }}
                      >
                        Next concept: {nextStep.label} ›
                      </button>
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>
                        Last step. This is what "{searchedQuery || resolved.label}" actually resolved to.
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ ...CARD, padding: '18px 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Eyebrow color="#58CC02">Chapter</Eyebrow>
                  {usingSimplified && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: '#5EC8F0', border: '1px solid rgba(94,200,240,0.5)', background: 'rgba(94,200,240,0.12)', borderRadius: 5, padding: '2px 7px' }}>
                      SIMPLIFIED
                    </span>
                  )}
                  {simplifying && <span style={{ fontSize: 10.5, color: 'rgba(94,200,240,0.8)' }}>simplifying for your question...</span>}
                  {simplifiedBody && (
                    <button
                      onClick={() => setShowSimplified((s) => !s)}
                      style={{ marginLeft: 'auto', fontSize: 10.5, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
                    >
                      {showSimplified ? 'show full original' : 'show simplified'}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, margin: '8px 0 8px' }}>{chapter.title}</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>{chapter.summary}</p>
                {usingSimplified && simplifyMeta && (
                  <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.55, color: 'rgba(94,200,240,0.75)' }}>
                    Auto-shortened by {simplifyMeta.reductionPct}% for how you asked ("{searchedQuery}"), then independently checked by a second model to confirm no formula, number, or conclusion was lost. Toggle above for the full original.
                  </p>
                )}
                {!usingSimplified && simplifyFailed && (
                  <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.55, color: 'rgba(255,255,255,0.4)' }}>
                    Showing the full original chapter: the auto-simplified version was not used ({simplifyFailed}).
                  </p>
                )}
              </div>

              {chunks.map((group, i) => (
                <div key={`${usingSimplified ? 's' : 'o'}-${i}`} style={{ ...CARD, padding: '16px 20px', flexShrink: 0 }}>
                  <Eyebrow color="rgba(255,255,255,0.35)">Part {i + 1} of {chunks.length}</Eyebrow>
                  {group.map((p, j) => (
                    <p key={j} style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)' }}>{p}</p>
                  ))}
                </div>
              ))}

              <div style={{ ...CARD, padding: '16px 20px', flexShrink: 0 }}>
                <Eyebrow color="#6366F1">Cement understanding</Eyebrow>
                {checkQuestion ? (
                  <>
                    <div style={{ marginTop: 10 }}>
                      <ColdCheckPrompt
                        key={checkQuestion.id}
                        question={checkQuestion as never}
                        onResult={({ correct }) => void onAnswered(correct)}
                      />
                    </div>
                    {checkResult && <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', margin: '10px 0 0' }}>{checkResult}</p>}
                  </>
                ) : checkLoading ? (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '8px 0 0', lineHeight: 1.6 }}>
                    Generating a check question for this concept and independently re-solving it before you see it...
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '8px 0 0', lineHeight: 1.6 }}>
                    No check question for this concept right now{checkFailed ? `: ${checkFailed}` : '.'} You can keep reading; this concept just will not be marked studied, since nothing was answered.
                  </p>
                )}
              </div>

              <div style={{ ...CARD, padding: '16px 18px', flexShrink: 0 }}>
                <Eyebrow color="#6366F1">Related concepts</Eyebrow>
                <p style={{ margin: '6px 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  Real graph edges from {activeLabel || resolved.label}: what comes before it, what it unlocks, and what connects across subjects.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {neighbors.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>No graph neighbours recorded for this concept.</p>}
                  {neighbors.map((n) => (
                    <button
                      key={`${n.relation}-${n.id}`}
                      className="lrn-neighbor"
                      onClick={() => { resetPerConcept(); setPath([]); setPathIndex(0); void loadContent(n.id); highlightInGraph(n.id) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', fontSize: 13 }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {n.label}
                        <span style={{ display: 'block', fontSize: 10.5, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{n.group}</span>
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: n.relation === 'prerequisite' ? '#8BE85C' : n.relation === 'next' ? '#6366F1' : '#A78BFA', border: '1px solid currentColor', borderRadius: 5, padding: '2px 6px', opacity: 0.85 }}>
                        {n.relation === 'prerequisite' ? 'BEFORE' : n.relation === 'next' ? 'NEXT' : 'CROSS'}
                      </span>
                      {isStudied(n.id) && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#f2b84b', border: '1px solid rgba(242,184,75,0.4)', borderRadius: 5, padding: '2px 6px' }}>✓</span>}
                      {n.hasSim && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#F0C060', border: '1px solid rgba(240,192,96,0.4)', borderRadius: 5, padding: '2px 6px' }}>SIM</span>}
                      {!n.hasChapter && <span style={{ flexShrink: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>no chapter yet</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {sim ? (
              <div style={{ ...CARD, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'lrnRise 0.55s ease 0.08s both' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <Eyebrow color="#F0C060">Interactive simulation</Eyebrow>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{sim.title}</span>
                  {sim.sourceRepo && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{sim.sourceRepo}</span>}
                </div>
                <iframe title="sim" srcDoc={sim.html} style={{ flex: 1, border: 'none', background: 'white' }} sandbox="allow-scripts" />
              </div>
            ) : generatedSim ? (
              <div style={{ ...CARD, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'lrnRise 0.55s ease both' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <Eyebrow color="#A78BFA">Interactive simulation</Eyebrow>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{generatedSim.title}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: '#A78BFA', border: '1px solid rgba(167,139,250,0.5)', background: 'rgba(167,139,250,0.12)', borderRadius: 5, padding: '2px 7px' }}>
                    AI GENERATED
                  </span>
                  {generatedSim.cached && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>reused from the library, not regenerated</span>}
                  <div style={{ flexBasis: '100%', fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginTop: 4 }}>
                    Generated by the MicroSim pipeline and only shown because it passed the structural rubric and the visual quality gate. Not human reviewed.
                    {typeof generatedSim.qualityGateScore === 'number' ? ` Gate score ${generatedSim.qualityGateScore}.` : ''}
                  </div>
                </div>
                <iframe title="generated-sim" srcDoc={generatedSim.html} style={{ flex: 1, border: 'none', background: 'white' }} sandbox="allow-scripts" />
              </div>
            ) : (
              <div style={{ ...CARD, border: '1.5px dashed rgba(255,255,255,0.14)', boxShadow: 'none', background: 'rgba(255,255,255,0.015)', flex: '0 0 38%', minWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 36px', gap: 14, animation: 'lrnRise 0.55s ease 0.08s both' }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
                  <path d="M8 20.5h8M12 16.5v4" />
                  <path d="M8.5 8.5h7M8.5 11.5h4" strokeDasharray="2 2.5" />
                </svg>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>No simulation exists yet for this concept</div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.5)', maxWidth: 340 }}>
                  {counts ? `Only ${counts.withSim} of ${counts.nodes} concepts in the library have a pre-built interactive sim so far` : 'Most concepts have no pre-built interactive sim yet'}, and {activeLabel || resolved.label} isn't one of them. That's a real content gap we're closing, not a loading error.
                </p>
                <button
                  onClick={() => void runSimGeneration()}
                  disabled={simGenerating}
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: simGenerating ? 'rgba(167,139,250,0.35)' : '#A78BFA', color: '#140a2e', fontWeight: 700, fontSize: 13, cursor: simGenerating ? 'default' : 'pointer' }}
                >
                  {simGenerating ? 'Generating and reviewing...' : 'Generate a sim for this'}
                </button>
                {simGenerating ? (
                  <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6, color: 'rgba(167,139,250,0.85)', maxWidth: 340 }}>
                    {simGenStatus || 'Starting...'} The pipeline writes the sim, renders it headlessly, scores it against a structural rubric, then runs a visual quality gate. Nothing is shown unless the whole gate passes, and if it fails you will be told why. This usually takes under two minutes.
                  </p>
                ) : simGenFailed ? (
                  <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6, color: '#FF6B6B', maxWidth: 340 }}>{simGenFailed}</p>
                ) : (
                  <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.35)', maxWidth: 340 }}>
                    A generated sim is clearly badged AI GENERATED and is never shown unless it passes the quality gate. Generation spends from a shared monthly budget, so it is a deliberate button, not automatic.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10, alignItems: 'center', background: '#0A0A0F', flexWrap: 'wrap' }}>
        <input
          className="lrn-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Ask anything, or paste a homework question..."
          style={{ flex: 1, minWidth: 220, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 14 }}
        />
        <button onClick={() => runSearch()} disabled={loading} style={{ padding: '12px 26px', borderRadius: 12, border: 'none', background: '#6366F1', color: 'white', fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? '...' : 'Search'}
        </button>
        {embedPct !== null && embedPct < 100 && !embedderReady() && (
          <span style={{ fontSize: 11.5, color: '#5EC8F0', maxWidth: 360, lineHeight: 1.45 }}>
            Getting the search model ready ({embedPct}%). This is a one-time download that stays cached in your browser, and it runs on your device, so searching costs nothing.
          </span>
        )}
        {resolveMeta && !loading && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
            {resolveMeta.indexed} concepts searched in {resolveMeta.totalMs}ms{resolveMeta.coldStart ? ' (cold start)' : ''}
          </span>
        )}
        {studiedIds.length > 0 && (
          <span title={studiedIds.join(', ')} style={{ fontSize: 11.5, color: '#f2b84b', whiteSpace: 'nowrap' }}>
            ✓ {studiedIds.length} studied
          </span>
        )}
        {err && <p style={{ color: '#FF6B6B', fontSize: 13, margin: 0 }}>{err}</p>}
      </div>
    </div>
  )
}
