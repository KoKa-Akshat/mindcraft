import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useUser } from '../../App'
import {
  fetchConceptContent, generateSim, resolveConcept,
  type ConceptContent, type ConceptMatch, type GeneratedSim, type PathStep,
} from '../../lib/conceptLibrary'
import { generateBook } from '../../lib/generatedBooks'
import { pagesFromFile, parseHomeworkPages } from '../../lib/homework'
import { recordLearnActivity } from '../../lib/learnActivity'
import { askTutor } from '../../lib/learnTutor'
import { addBookNote, openStudentBook, savePageEdit, type BookNote, type PageEdit, type StudentBook } from '../../lib/studentBooks'
import type { HomeworkQuestion } from '../../types'
import {
  ACCENT_LIME, FONT_STACK, INK_PENCIL, INK_SOFT, INK_SYSTEM,
  PAGE_BG, PAPER_BASE, PAPER_EDGE, PAPER_RAISED, PAPER_RECESSED, SERIF_STACK,
} from './shared'

const NO_COVERAGE_FLOOR = 0.35
const RAMP_CONFIDENCE_CEILING = 0.6
const NEAR_TIE = 0.08
const MATERIALS_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

const BUILD_CAPTIONS = [
  'reading the library for this…',
  'lining up the ramp in…',
  'setting the cover…',
]

type Screen = 'intake' | 'cover' | 'zone' | 'read'

/** One page in the reading path — a step in the real prerequisite ramp, an
 * uploaded worksheet question resolved to its own concept, or (2026-09-03:
 * "if nothing is in the library use the AI to generate it") one section of
 * a freshly AI-generated book. Unified so ReadPage/the pager never
 * special-case which one they're looking at. */
interface Chapter {
  conceptId: string
  label: string
  hasSim: boolean
  question?: HomeworkQuestion
  generated?: { body: string; summary?: string; simHtml?: string }
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  fallback?: boolean
}

function chapterFromStep(s: PathStep): Chapter {
  return { conceptId: s.conceptId, label: s.label, hasSim: s.hasSim }
}

/** Either the real prerequisite ramp the resolver returned, or, when there
 * is no ramp, just the resolved concept itself. */
function stepsFrom(best: ConceptMatch, ramp: PathStep[]): PathStep[] {
  if (ramp.length > 1) return ramp
  return [{ conceptId: best.conceptId, label: best.label, hasLesson: best.hasLesson, hasSim: best.hasSim, subject: best.subject }]
}

const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }

/** Shared drag mechanic (2026-09-03 ask: "everything on the screen
 * editable, the chat box moveable") — used by both the floating search bar
 * and the Jesse chat window. Position is plain fixed-position pixels,
 * dragged from whatever element spreads the returned handle props onto
 * itself (a header bar, a grip icon), clamped so a panel can never be
 * dragged fully off-screen. */
function useDraggablePosition(getDefault: () => { top: number; left: number }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origTop: number; origLeft: number } | null>(null)

  useEffect(() => {
    if (pos) return
    setPos(getDefault())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (!pos) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, origTop: pos.top, origLeft: pos.left }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current
    if (!d) return
    const top = Math.max(8, Math.min(window.innerHeight - 46, d.origTop + (e.clientY - d.startY)))
    const left = Math.max(8, Math.min(window.innerWidth - 60, d.origLeft + (e.clientX - d.startX)))
    setPos({ top, left })
  }
  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return { pos, dragHandleProps: { onPointerDown, onPointerMove, onPointerUp } }
}

/**
 * /learn/book — the "living book" reading experience (founder ask,
 * 2026-09-03): a student describes what they want to learn, Jesse's scope
 * chat resolves it to a real concept, and this page opens that concept as a
 * book with the student's own name on the cover, the zone choice folded
 * into page one, and real chapter prose + real sims as the pages after
 * that. A brand-new route rather than a new stage inside Learn.tsx on
 * purpose: Learn.tsx/PathRamp.tsx/ReadingPane.tsx are mid-refactor in a
 * separate concurrent session as this was built, so this page resolves and
 * renders independently, sharing only the underlying library functions
 * (resolveConcept/fetchConceptContent/generateSim/pagesFromFile/
 * parseHomeworkPages), never their state. Homework Help (the "I have
 * homework to work through" entry on the main /learn screen) stays its own
 * separate, already-shipped flow — this page's own worksheet upload is a
 * second front door into the SAME real parse-homework pipeline, landing in
 * book form instead, not a replacement for it.
 *
 * Real ramp, real chapters, real sims, a real per-student note you can tag
 * to a page, and now a real worksheet upload whose questions become
 * navigable chapters on this same book's front page. A topic with no real
 * coverage in the library says so, it does not fabricate a book.
 */
export default function BookReader() {
  const user = useUser()
  const uid = user?.uid ?? ''
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const topic = (searchParams.get('topic') ?? '').trim()
  // Homework Help (2026-09-03 ask): "I have homework to work through" on the
  // main /learn screen now lands here instead of the old graph-page upload
  // flow, with a real intake (write it or upload it) instead of a topic to
  // resolve. Homework Help itself is unchanged — /api/parse-homework, still
  // BYOK-gated, exactly as it already was — this is a second front door
  // onto the same pipeline that lands in book form.
  const homeworkMode = searchParams.get('mode') === 'homework'

  const [screen, setScreen] = useState<Screen>('cover')
  const [phase, setPhase] = useState<'resolving' | 'generating' | 'ready' | 'out_of_domain' | 'no_match' | 'error'>('resolving')
  const [genCaption, setGenCaption] = useState('')
  const [genProgress, setGenProgress] = useState<{ chaptersReady: number; totalChapters: number } | null>(null)
  // Distinguishes a generated book's flat page list (no zone-card choice —
  // every section is just the next page) from an uploaded worksheet's, so
  // ZonePage's copy can say the right thing without a new prop threading
  // through every call site.
  const [chaptersKind, setChaptersKind] = useState<'upload' | 'generated' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [best, setBest] = useState<ConceptMatch | null>(null)
  const [rampSteps, setRampSteps] = useState<Chapter[]>([])
  const [steps, setSteps] = useState<Chapter[]>([])
  const [uploadedChapters, setUploadedChapters] = useState<Chapter[] | null>(null)
  const [book, setBook] = useState<StudentBook | null>(null)

  const [readIndex, setReadIndex] = useState(0)
  const [pageContent, setPageContent] = useState<ConceptContent | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState('')

  const [simGenerating, setSimGenerating] = useState(false)
  const [simGenStatus, setSimGenStatus] = useState('')
  const [simGenFailed, setSimGenFailed] = useState('')
  const [generatedSim, setGeneratedSim] = useState<GeneratedSim | null>(null)

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const [uploadBusy, setUploadBusy] = useState('')
  const [uploadError, setUploadError] = useState('')
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [homeworkDraft, setHomeworkDraft] = useState('')

  // A real, moveable Jesse chat floating over the book (2026-09-03 ask):
  // same guarded /api/learn-tutor Jesse already uses elsewhere on Learn, not
  // a new backend. sessionId is the book's own concept id, so reopening the
  // same book later resumes the same conversation thread server-side.
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState('')

  const [searchDraft, setSearchDraft] = useState('')
  const searchBarWidth = 460
  const { pos: searchPos, dragHandleProps: searchDragProps } = useDraggablePosition(() => ({
    top: window.innerHeight - 78,
    left: Math.max(20, window.innerWidth / 2 - searchBarWidth / 2),
  }))

  const [captionIdx, setCaptionIdx] = useState(0)
  useEffect(() => {
    if (phase !== 'resolving') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const t = window.setInterval(() => setCaptionIdx((i) => (i + 1) % BUILD_CAPTIONS.length), 1300)
    return () => window.clearInterval(t)
  }, [phase])

  // Resolve the topic to a real concept, exactly the same logic Learn.tsx's
  // own search() uses (near-tie guard, ramp validity check, foundation vs.
  // direct start), then open the student's personal reading copy. Full
  // reset every time topic changes (the bottom search bar can send a
  // student from an already-open book straight into a new one), so nothing
  // from the previous book — screen, an upload's chapters, notes state —
  // leaks into the next.
  useEffect(() => {
    let cancelled = false
    setUploadedChapters(null)
    setChaptersKind(null)
    setUploadError('')
    setPageContent(null)
    setGeneratedSim(null)
    setGenCaption('')
    setGenProgress(null)
    if (homeworkMode) {
      setScreen('intake')
      setPhase('ready')
      setBook(null)
      setBest(null)
      setSteps([])
      setRampSteps([])
      return
    }
    setScreen('cover')
    if (!topic) { setPhase('error'); setErrorMsg('No topic was given.'); return }
    if (!uid) return
    setPhase('resolving')
    setErrorMsg('')
    const authorName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'A MindCraft student'

    // Nothing in the library: generate it for real instead of dead-ending
    // (2026-09-03 ask — the real, gated /api/generate-book pipeline, same
    // one the overnight cron uses, run ad-hoc on this exact topic).
    async function generateFallback(closestLabel: string | undefined) {
      setPhase('generating')
      setGenCaption('Starting...')
      setGenProgress(null)
      const { book: generated, reason } = await generateBook(topic, {
        onStatus: setGenCaption,
        onProgress: setGenProgress,
      })
      if (cancelled) return
      if (!generated || !generated.chapters?.some((c) => c.sections?.length)) {
        setErrorMsg(reason || '')
        setPhase(closestLabel ? 'out_of_domain' : 'no_match')
        return
      }
      const flat: Chapter[] = generated.chapters.flatMap((ch) => ch.sections.map((s) => ({
        conceptId: s.concept_id,
        label: s.title,
        hasSim: !!s.sim_html,
        generated: { body: s.body, summary: s.summary, simHtml: s.sim_html },
      })))
      setBest({ conceptId: generated.subject_id, label: generated.title, subject: '', subjectTitle: '', level: '', hasLesson: true, hasSim: false, score: 1 })
      setRampSteps([])
      setSteps(flat)
      setUploadedChapters(flat)
      setChaptersKind('generated')
      setReadIndex(0)
      const opened = await openStudentBook(uid, authorName, topic, generated.subject_id, generated.title)
      if (cancelled) return
      setBook(opened)
      recordLearnActivity(uid, 'learn_book_generated', { subjectId: generated.subject_id, topic, sections: flat.length })
      setPhase('ready')
    }

    ;(async () => {
      try {
        const data = await resolveConcept(topic, 5)
        if (cancelled) return
        const ms = data.matches
        if (!ms.length) { await generateFallback(undefined); return }
        if (ms[0].score < NO_COVERAGE_FLOOR) { setBest(ms[0]); await generateFallback(ms[0].label); return }
        const withContent = ms.find((m) => m.hasLesson && ms[0].score - m.score <= NEAR_TIE)
        const chosen = withContent ?? ms[0]
        const returned = Array.isArray(data.path) ? data.path : []
        const ramp = returned.length > 1 && returned[returned.length - 1].conceptId === chosen.conceptId ? returned : []
        const startAtFoundation = ramp.length > 1 && chosen.score < RAMP_CONFIDENCE_CEILING
        const builtSteps = stepsFrom(chosen, ramp).map(chapterFromStep)

        setBest(chosen)
        setRampSteps(builtSteps)
        setSteps(builtSteps)
        setChaptersKind(null)
        setReadIndex(startAtFoundation ? 0 : builtSteps.length - 1)

        const opened = await openStudentBook(uid, authorName, topic, chosen.conceptId, chosen.label)
        if (cancelled) return
        setBook(opened)
        recordLearnActivity(uid, 'learn_book_opened', { conceptId: chosen.conceptId, topic })
        setPhase('ready')
      } catch (e) {
        if (!cancelled) { setPhase('error'); setErrorMsg(String(e instanceof Error ? e.message : e)) }
      }
    })()
    return () => { cancelled = true }
  }, [topic, uid, user, homeworkMode])

  // Load the current reading page's real chapter + sim whenever the step
  // changes (zone pick, paging through the ramp, or a picked upload
  // chapter). An AI-generated page already carries its own body/sim
  // inline (it was never migrated into conceptLibrary, fetchConceptContent
  // would just 404 on it), so that case builds a ConceptContent-shaped
  // object directly instead of fetching one — same shape, so ReadPage
  // never has to know the difference.
  useEffect(() => {
    if (screen !== 'read' || !steps[readIndex]) return
    const step = steps[readIndex]
    let cancelled = false
    setContentError('')
    setGeneratedSim(null)
    setSimGenFailed('')
    setNoteOpen(false)
    setNoteDraft('')
    if (step.generated) {
      setContentLoading(false)
      setPageContent({
        conceptId: step.conceptId,
        label: step.label,
        subject: '', subjectTitle: 'Generated for you',
        level: '',
        chapter: { title: step.label, summary: step.generated.summary || '', body: step.generated.body },
        sim: step.generated.simHtml ? { simId: step.conceptId, title: step.generated.summary || step.label, html: step.generated.simHtml } : null,
        prereqs: [], unlocks: [], crossSubject: [],
      })
      return
    }
    setContentLoading(true)
    fetchConceptContent(step.conceptId)
      .then((c) => { if (!cancelled) setPageContent(c) })
      .catch((e) => { if (!cancelled) setContentError(String(e instanceof Error ? e.message : e)) })
      .finally(() => { if (!cancelled) setContentLoading(false) })
    return () => { cancelled = true }
  }, [screen, readIndex, steps])

  async function runSimGeneration() {
    if (!pageContent || simGenerating) return
    setSimGenerating(true)
    setSimGenFailed('')
    const { sim, reason } = await generateSim(pageContent.label, {
      onStatus: (s) => setSimGenStatus(s),
    })
    setSimGenerating(false)
    if (sim) {
      setGeneratedSim(sim)
      recordLearnActivity(uid, 'learn_sim_generated', { conceptId: pageContent.conceptId })
    } else {
      setSimGenFailed(reason || 'The sim did not come through.')
    }
  }

  async function saveNote() {
    if (!book || !steps[readIndex] || !noteDraft.trim() || noteSaving) return
    setNoteSaving(true)
    try {
      const note = await addBookNote(uid, book.conceptId, steps[readIndex].conceptId, noteDraft)
      setBook((b) => (b ? { ...b, notes: [...b.notes, note] } : b))
      recordLearnActivity(uid, 'learn_book_note_added', { conceptId: steps[readIndex].conceptId })
      setNoteDraft('')
      setNoteOpen(false)
    } catch {
      // Non-blocking — the draft stays in the textarea so nothing typed is lost.
    } finally {
      setNoteSaving(false)
    }
  }

  // Real per-page editing (2026-09-03 ask, clarified: not the chat window —
  // the text on the page itself, reorderable, with its own colors). Saved
  // as an overlay on the student's own book, never touching the shared
  // source (conceptLibrary or a generated book) other students read.
  function updatePageEdit(patch: Partial<PageEdit>) {
    if (!book || !currentStep) return
    const conceptId = currentStep.conceptId
    const bookConceptId = book.conceptId
    const merged: PageEdit = { ...(book.pageEdits?.[conceptId] ?? {}), ...patch }
    setBook((b) => (b ? { ...b, pageEdits: { ...(b.pageEdits ?? {}), [conceptId]: merged } } : b))
    savePageEdit(uid, bookConceptId, conceptId, merged).catch(() => { /* local state already updated; retried on next edit */ })
  }

  // Shared by both real intake paths below: resolve each question to its
  // own concept, same as Learn.tsx's loadSimForQuestion, and land the
  // results as real navigable chapters on this book's front page rather
  // than auto-jumping straight into reading one. Merges onto any chapters
  // already there (a second upload, or upload after writing some by hand)
  // instead of replacing them.
  async function commitChapters(chapters: Chapter[], sourceLabel: string) {
    if (!chapters.length) return false
    const merged = uploadedChapters ? [...uploadedChapters, ...chapters] : chapters
    setUploadedChapters(merged)
    setChaptersKind('upload')
    setSteps(merged)
    if (!book) {
      const anchor = merged[0]
      const authorName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'A MindCraft student'
      const opened = await openStudentBook(uid, authorName, sourceLabel, anchor.conceptId, anchor.label)
      setBook(opened)
    }
    setReadIndex(0)
    setScreen('zone')
    recordLearnActivity(uid, 'learn_book_worksheet_uploaded', { count: chapters.length })
    return true
  }

  async function chaptersFromQuestions(questions: HomeworkQuestion[]): Promise<Chapter[]> {
    const resolved = await Promise.all(questions.map(async (q): Promise<Chapter | null> => {
      try {
        const r = await resolveConcept(q.text, 3)
        const m = r.matches[0]
        if (!m) return null
        return { conceptId: m.conceptId, label: q.number ? `Q${q.number}` : q.text.slice(0, 60), hasSim: m.hasSim, question: q }
      } catch {
        return null
      }
    }))
    return resolved.filter((c): c is Chapter => c !== null)
  }

  // Worth Fixing / Homework Help's upload option: a real worksheet upload,
  // not a hand-off to a different page. Same real pipeline Learn.tsx's own
  // Homework Help uses (pagesFromFile -> parseHomeworkPages, transcribe-and-
  // split only, never solves, still gated on the student's own BYOK key
  // exactly as before) — this is a second front door onto that same
  // service, landing in book form instead.
  async function handleUploadFile(file: File) {
    setUploadError('')
    setUploadBusy('Reading your pages...')
    try {
      const pages = await pagesFromFile(file)
      if (pages.length === 0) { setUploadError('Could not read that file. Try a clearer photo or a PDF.'); return }
      setUploadBusy(`Pulling questions out of ${pages.length} page${pages.length > 1 ? 's' : ''}...`)
      const { questions, unavailable, needsKey } = await parseHomeworkPages(pages)
      if (needsKey) { setUploadError('Add a free API key in Settings (the gear icon on your dash) to use worksheet upload.'); return }
      if (unavailable) { setUploadError('Reading is temporarily unavailable. Try again in a bit.'); return }
      if (questions.length === 0) { setUploadError('No questions found on those pages. Try another file.'); return }

      setUploadBusy(`Finding the concept behind each of ${questions.length} question${questions.length > 1 ? 's' : ''}...`)
      const chapters = await chaptersFromQuestions(questions)
      if (!chapters.length) { setUploadError("Couldn't match any of those questions to something in the library yet."); return }
      await commitChapters(chapters, 'My homework')
    } catch {
      setUploadError('Something went wrong reading that upload.')
    } finally {
      setUploadBusy('')
    }
  }

  // Homework Help's write-it-in option (2026-09-03 ask): no file needed —
  // one question per line becomes one page, same resolve + chapter path an
  // upload's extracted questions go through.
  async function submitHomeworkText() {
    const lines = homeworkDraft.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20)
    if (!lines.length) return
    setUploadError('')
    setUploadBusy(`Finding the concept behind ${lines.length > 1 ? 'each question' : 'that'}...`)
    try {
      const questions: HomeworkQuestion[] = lines.map((text, i) => ({
        id: `w${i}`, number: null, text, choices: null, figureNote: null, ambiguous: false,
      }))
      const chapters = await chaptersFromQuestions(questions)
      if (!chapters.length) { setUploadError("Couldn't match that to something in the library yet. Try rephrasing it."); return }
      await commitChapters(chapters, lines[0])
      setHomeworkDraft('')
    } catch {
      setUploadError('Something went wrong finding that.')
    } finally {
      setUploadBusy('')
    }
  }

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatSending || !book) return
    setChatMessages((m) => [...m, { role: 'user', content: text }])
    setChatInput('')
    setChatSending(true)
    setChatError('')
    try {
      const result = await askTutor({
        sessionId: book.conceptId,
        message: text,
        conceptId: currentStep?.conceptId || book.conceptId,
        conceptLabel: pageContent?.label || currentStep?.label || book.conceptLabel,
        chapterSummary: pageContent?.chapter?.summary,
        hintsShown: 0,
      })
      setChatMessages((m) => [...m, { role: 'assistant', content: result.reply, fallback: result.fallback }])
    } catch (e) {
      setChatError(String(e instanceof Error ? e.message : e))
    } finally {
      setChatSending(false)
    }
  }

  function pickZone(startIndex: number) {
    setReadIndex(startIndex)
    setScreen('read')
  }

  function backToRamp() {
    setUploadedChapters(null)
    setChaptersKind(null)
    setSteps(rampSteps)
    setScreen('zone')
  }

  function goNext() {
    if (screen === 'cover') { if (phase === 'ready') setScreen('zone'); return }
    if (screen === 'zone') return
    if (readIndex < steps.length - 1) setReadIndex((i) => i + 1)
  }
  function goPrev() {
    if (screen === 'read') {
      if (readIndex > 0) { setReadIndex((i) => i - 1); return }
      setScreen('zone')
      return
    }
    if (screen === 'zone') setScreen('cover')
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, readIndex, phase, steps.length])

  function submitSearch() {
    const q = searchDraft.trim()
    if (!q) return
    setSearchDraft('')
    navigate(`/learn/book?topic=${encodeURIComponent(q)}`)
  }

  const currentStep = steps[readIndex]
  const pageNotes = book?.notes.filter((n) => n.conceptId === currentStep?.conceptId) ?? []
  const canGoPrev = screen !== 'cover' && screen !== 'intake'
  const canGoNext = screen === 'cover' ? phase === 'ready' : screen === 'read' && readIndex < steps.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: PAGE_BG, color: '#f5f5f5', display: 'flex', flexDirection: 'column', fontFamily: FONT_STACK }}>
      <style>{'.lrn-book-para:hover .lrn-book-para-controls { opacity: 1 !important; }'}</style>
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 32px', fontSize: 11.5, color: 'rgba(245,245,245,0.55)' }}>
        <Link to="/learn" style={{ color: 'inherit', textDecoration: 'none' }}>&larr; Back to the graph</Link>
        <span style={{ ...mono, fontSize: 10.5 }}>Your book</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', padding: '0 32px' }}>

        {(phase === 'error' || phase === 'no_match') && (
          <BookMessage title="This book couldn't open" body={errorMsg || "Nothing in the library matched that yet."} />
        )}

        {screen === 'intake' && (
          <IntakePage
            draft={homeworkDraft}
            onDraftChange={setHomeworkDraft}
            onSubmitText={() => void submitHomeworkText()}
            onTriggerUpload={() => uploadInputRef.current?.click()}
            busy={uploadBusy}
            error={uploadError}
          />
        )}

        {(phase !== 'error' && phase !== 'no_match') && screen === 'cover' && (
          <CoverPage
            phase={phase}
            topic={topic}
            title={book?.title || topic}
            author={book?.authorName || 'You'}
            caption={phase === 'generating' ? genCaption : BUILD_CAPTIONS[captionIdx]}
            genProgress={genProgress}
            outOfDomainLabel={phase === 'out_of_domain' ? best?.label : undefined}
            failureReason={phase === 'out_of_domain' ? errorMsg : undefined}
          />
        )}

        {phase === 'ready' && screen === 'zone' && (best || uploadedChapters) && (
          <ZonePage
            resolvedLabel={best?.label ?? ''}
            hasFoundation={rampSteps.length > 1}
            foundationLabel={rampSteps[0]?.label}
            rampLength={rampSteps.length}
            onPickFoundation={() => { setSteps(rampSteps); pickZone(0) }}
            onPickDirect={() => { setSteps(rampSteps); pickZone(rampSteps.length - 1) }}
            onTriggerUpload={() => uploadInputRef.current?.click()}
            uploadBusy={uploadBusy}
            uploadError={uploadError}
            chapters={uploadedChapters}
            chaptersKind={chaptersKind}
            onPickChapter={pickZone}
            onBackToRamp={rampSteps.length > 0 ? backToRamp : undefined}
          />
        )}

        {phase === 'ready' && screen === 'read' && currentStep && (
          <ReadPage
            step={currentStep}
            stepNumber={readIndex + 1}
            stepCount={steps.length}
            content={pageContent}
            loading={contentLoading}
            error={contentError}
            generatedSim={generatedSim}
            simGenerating={simGenerating}
            simGenStatus={simGenStatus}
            simGenFailed={simGenFailed}
            onRunSimGeneration={runSimGeneration}
            notes={pageNotes}
            noteOpen={noteOpen}
            noteDraft={noteDraft}
            noteSaving={noteSaving}
            noteRef={noteRef}
            onOpenNote={() => { setNoteOpen(true); window.setTimeout(() => noteRef.current?.focus(), 40) }}
            onNoteDraftChange={setNoteDraft}
            onSaveNote={saveNote}
            onCancelNote={() => { setNoteOpen(false); setNoteDraft('') }}
            pageEdit={book?.pageEdits?.[currentStep.conceptId]}
            onUpdateEdit={updatePageEdit}
          />
        )}
      </div>

      {phase === 'out_of_domain' && screen === 'cover' && (
        <div style={{ flex: 'none', textAlign: 'center', padding: '0 32px 8px' }}>
          <p style={{ fontSize: 12.5, color: 'rgba(245,245,245,0.6)', margin: 0 }}>
            "{topic}" wasn't in the library, and a real attempt to generate it didn't come through. {' '}
            <Link to="/learn" style={{ color: ACCENT_LIME }}>Try a different question</Link>.
          </p>
        </div>
      )}

      {screen !== 'intake' && (phase === 'ready' || screen !== 'cover') && phase !== 'error' && phase !== 'no_match' && (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '10px 0 90px' }}>
          <PagerBtn onClick={goPrev} disabled={!canGoPrev}>&larr; Prev</PagerBtn>
          <span style={{ ...mono, fontSize: 10.5, color: 'rgba(245,245,245,0.5)' }}>
            {screen === 'cover' ? 'cover' : screen === 'zone' ? 'page one' : `page ${readIndex + 2} of ${steps.length + 1}`}
          </span>
          <PagerBtn onClick={goNext} disabled={!canGoNext}>Next &rarr;</PagerBtn>
        </div>
      )}

      <input
        ref={uploadInputRef}
        type="file"
        accept={MATERIALS_ACCEPT}
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUploadFile(f); e.target.value = '' }}
      />

      {/* Always-available search (2026-09-03 ask): starting a new book from
          inside one you're already reading. Moveable (2026-09-03 follow-up
          ask) via the grip handle at its left edge, same drag mechanic the
          Jesse chat window uses. */}
      {searchPos && (
        <div
          style={{
            position: 'fixed', top: searchPos.top, left: searchPos.left,
            width: searchBarWidth, maxWidth: '92vw', display: 'flex', gap: 6, padding: 8, borderRadius: 16,
            background: 'rgba(20,31,24,0.86)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(140,178,150,0.2)', boxShadow: '0 14px 34px rgba(3,8,5,0.4)', zIndex: 40,
          }}
        >
          <div
            {...searchDragProps}
            title="Drag to move"
            style={{ flex: 'none', width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none', color: 'rgba(245,245,245,0.35)', fontSize: 14, letterSpacing: 2 }}
          >
            &#8942;
          </div>
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            placeholder="Start a new book — what do you want to understand?"
            style={{ flex: 1, minWidth: 0, padding: '12px 4px', borderRadius: 12, border: 'none', background: 'transparent', color: '#f5f5f5', fontSize: 14, fontFamily: FONT_STACK, outline: 'none' }}
          />
          <button
            onClick={submitSearch}
            disabled={!searchDraft.trim()}
            style={{ flex: 'none', padding: '12px 20px', borderRadius: 12, border: 'none', background: '#3d6b4f', color: 'white', fontWeight: 600, fontSize: 13, cursor: searchDraft.trim() ? 'pointer' : 'default', opacity: searchDraft.trim() ? 1 : 0.6 }}
          >
            Search
          </button>
        </div>
      )}

      {/* Moveable Jesse (2026-09-03 ask): a real, guarded tutor chat that
          floats over the book instead of living fixed in a column, so it
          never blocks the page you're reading — drag it by its header. */}
      {phase === 'ready' && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Ask Jesse"
          style={{
            position: 'absolute', right: 28, bottom: 22, width: 52, height: 52, borderRadius: '50%',
            border: 'none', background: ACCENT_LIME, color: '#0a0f08', fontWeight: 700, fontSize: 11,
            cursor: 'pointer', boxShadow: '0 14px 34px rgba(3,8,5,0.4)', display: 'grid', placeItems: 'center',
          }}
        >
          Jesse
        </button>
      )}
      {phase === 'ready' && chatOpen && (
        <DraggableChat
          messages={chatMessages}
          input={chatInput}
          onInputChange={setChatInput}
          onSend={() => void sendChat()}
          sending={chatSending}
          error={chatError}
          onClose={() => setChatOpen(false)}
          conceptLabel={pageContent?.label || currentStep?.label || book?.title || 'this book'}
        />
      )}
    </div>
  )
}

function PagerBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...mono, fontSize: 11, color: disabled ? 'rgba(245,245,245,0.25)' : 'rgba(245,245,245,0.75)',
        background: 'transparent', border: '1px solid rgba(245,245,245,0.18)', borderRadius: 999,
        padding: '9px 18px', cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

const pageShellStyle: React.CSSProperties = {
  position: 'absolute', inset: '0 0 16px', background: PAPER_BASE, color: INK_SYSTEM, borderRadius: 3,
  boxShadow: `3px 0 0 ${PAPER_EDGE}, 6px 0 0 ${PAPER_RECESSED}, 9px 0 0 ${PAPER_EDGE}, 0 30px 70px -20px rgba(0,0,0,0.6), 0 4px 18px rgba(0,0,0,0.35)`,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
}

function BookMessage({ title, body }: { title: string; body: string }) {
  return (
    <div style={pageShellStyle}>
      <div style={{ margin: 'auto', maxWidth: 420, textAlign: 'center', padding: 32 }}>
        <div style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: 26, marginBottom: 10 }}>{title}</div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: INK_PENCIL, margin: 0 }}>{body}</p>
        <Link to="/learn" style={{ display: 'inline-block', marginTop: 18, fontSize: 12.5, color: '#5f7a12' }}>&larr; Back to Learn</Link>
      </div>
    </div>
  )
}

function CoverPage({
  phase, topic, title, author, caption, outOfDomainLabel, genProgress, failureReason,
}: {
  phase: string; topic: string; title: string; author: string; caption: string; outOfDomainLabel?: string
  genProgress?: { chaptersReady: number; totalChapters: number } | null; failureReason?: string
}) {
  const isReady = phase === 'ready'
  const isGenerating = phase === 'generating'
  // out_of_domain (reached here only once real generation was also tried
  // and failed — see BookReader's generateFallback) is a DONE state, not a
  // still-loading one — showing it with the same partially-lit pips and
  // rotating "building" caption as an in-progress resolve read as
  // permanently stuck, the real bug behind "is it actually working? and
  // loading?" 2026-09-03. Amber instead of lime marks it done but empty.
  const isOutOfDomain = phase === 'out_of_domain'
  const lit = isReady || isOutOfDomain
    ? 10
    : isGenerating && genProgress && genProgress.totalChapters > 0
      ? Math.max(1, Math.min(10, Math.round((genProgress.chaptersReady / genProgress.totalChapters) * 10)))
      : isGenerating ? 2 : 5
  const pipColor = isOutOfDomain ? '#c98a3a' : ACCENT_LIME
  const statusLabel = isReady ? 'ready' : isOutOfDomain ? 'no match' : isGenerating ? 'generating' : 'checking the library'
  const statusCaption = isReady
    ? 'Turn the page to pick where to start.'
    : isOutOfDomain
      ? (failureReason || `Nothing in the library covers this yet${outOfDomainLabel ? ` — closest was "${outOfDomainLabel}"` : ''}.`)
      : isGenerating
        ? (caption || 'Nothing in the library covers this yet, writing it for real instead — this can take a few minutes.')
        : caption
  return (
    <div style={pageShellStyle}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 64px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 10.5, color: INK_SOFT }}>
          <span>Reading copy</span>
          <strong style={{ color: INK_SYSTEM, fontWeight: 500 }}>MindCraft</strong>
        </div>
        <div style={{ margin: 'auto 0', padding: '26px 0' }}>
          <div style={{ ...mono, fontSize: 11, color: INK_PENCIL, marginBottom: 14 }}>Started from: &ldquo;{topic}&rdquo;</div>
          <h1 style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(44px, 8vw, 88px)', lineHeight: 0.98, margin: '0 0 16px', textWrap: 'balance' }}>
            {title}
          </h1>
          <div style={{ borderTop: `1px solid ${PAPER_EDGE}`, paddingTop: 16, marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...mono, fontSize: 11, color: INK_PENCIL }}>
              <span style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} style={{ width: 14, height: 4, borderRadius: 2, background: i < lit ? pipColor : PAPER_EDGE }} />
                ))}
              </span>
              <span>{statusLabel}</span>
            </div>
            <div style={{ ...mono, fontSize: 11, color: INK_SOFT, minHeight: 14, marginTop: 6, textTransform: 'none', letterSpacing: 'normal' }}>
              {statusCaption}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0 26px', ...mono, fontSize: 11, color: INK_PENCIL }}>
          <span>By <strong style={{ color: INK_SYSTEM }}>{author}</strong></span>
        </div>
      </div>
    </div>
  )
}

/** Homework Help's real intake (2026-09-03 ask): write it in, one question
 * per line, or upload a photo/PDF — either way every question becomes its
 * own page in a real book. Homework Help's own upload pipeline is
 * unchanged (still BYOK-gated, still transcribe-only); this is just a
 * second front door onto it that lands here instead of the graph page. */
function IntakePage({
  draft, onDraftChange, onSubmitText, onTriggerUpload, busy, error,
}: {
  draft: string; onDraftChange: (v: string) => void; onSubmitText: () => void
  onTriggerUpload: () => void; busy: string; error: string
}) {
  return (
    <div style={pageShellStyle}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 64px', maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ ...mono, fontSize: 11, color: INK_PENCIL, marginBottom: 10 }}>Homework help</div>
        <h1 style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: 'clamp(30px, 5vw, 42px)', margin: '0 0 14px' }}>
          What's the homework?
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: INK_PENCIL, margin: '0 0 26px' }}>
          Write each question on its own line, or upload a photo or PDF. Either way, every question becomes its own page in a real book, with a sim if one exists.
        </p>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={'e.g.\nWhat is the derivative of x^2?\nSolve for x: 2x + 4 = 10'}
          rows={5}
          disabled={!!busy}
          style={{ width: '100%', resize: 'vertical', padding: '14px 16px', borderRadius: 6, border: `1px solid ${PAPER_EDGE}`, background: PAPER_RAISED, color: INK_SYSTEM, fontFamily: FONT_STACK, fontSize: 14, outline: 'none', marginBottom: 12 }}
        />
        <button
          onClick={onSubmitText}
          disabled={!draft.trim() || !!busy}
          style={{ alignSelf: 'flex-start', padding: '11px 22px', borderRadius: 999, border: 'none', background: '#3d6b4f', color: 'white', fontWeight: 600, fontSize: 13.5, cursor: draft.trim() && !busy ? 'pointer' : 'default', opacity: draft.trim() && !busy ? 1 : 0.6 }}
        >
          Build the book
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '26px 0', ...mono, fontSize: 10, color: INK_SOFT }}>
          <span style={{ flex: 1, height: 1, background: PAPER_EDGE }} />
          or
          <span style={{ flex: 1, height: 1, background: PAPER_EDGE }} />
        </div>

        <button
          onClick={onTriggerUpload}
          disabled={!!busy}
          style={{ border: `1px solid ${PAPER_EDGE}`, borderRadius: 2, padding: '16px 18px', background: PAPER_RAISED, cursor: 'pointer', textAlign: 'left', fontFamily: FONT_STACK }}
        >
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Upload a photo or PDF</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: INK_PENCIL }}>{busy || 'Every question gets pulled out and turned into its own page.'}</div>
        </button>
        {error && <p style={{ fontSize: 12.5, color: '#b23b3b', margin: '10px 0 0' }}>{error}</p>}
      </div>
    </div>
  )
}

function ZonePage({
  resolvedLabel, hasFoundation, foundationLabel, rampLength, onPickFoundation, onPickDirect,
  onTriggerUpload, uploadBusy, uploadError, chapters, chaptersKind, onPickChapter, onBackToRamp,
}: {
  resolvedLabel: string; hasFoundation: boolean; foundationLabel: string | undefined; rampLength: number
  onPickFoundation: () => void; onPickDirect: () => void
  onTriggerUpload: () => void; uploadBusy: string; uploadError: string
  chapters: Chapter[] | null; chaptersKind: 'upload' | 'generated' | null; onPickChapter: (i: number) => void; onBackToRamp?: () => void
}) {
  const isGenerated = chaptersKind === 'generated'
  return (
    <div style={pageShellStyle}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 64px 40px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <div style={{ ...mono, fontSize: 11, color: INK_PENCIL, marginBottom: 10 }}>Page one</div>

        {chapters ? (
          <>
            <h2 style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: 'clamp(28px, 5vw, 38px)', margin: '0 0 16px', textWrap: 'balance' }}>
              {isGenerated ? 'Written for you, chapter by chapter' : 'Your worksheet, chapter by chapter'}
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: INK_PENCIL, maxWidth: '56ch', margin: '0 0 26px' }}>
              {isGenerated
                ? `${chapters.length} page${chapters.length === 1 ? '' : 's'}, generated for real just now — nothing in the library covered this. Pick one.`
                : `${chapters.length} question${chapters.length === 1 ? '' : 's'}, each its own page in. Pick one.`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chapters.map((c, i) => (
                <button
                  key={i}
                  onClick={() => onPickChapter(i)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    textAlign: 'left', border: `1px solid ${PAPER_EDGE}`, borderRadius: 2, padding: '14px 16px',
                    background: PAPER_RAISED, cursor: 'pointer', fontFamily: FONT_STACK,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                    <span style={{ ...mono, fontSize: 10.5, color: '#5f7a12', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.question?.text || c.label}</span>
                  </span>
                  {c.hasSim && <span style={{ ...mono, fontSize: 9.5, color: '#8A5A23', flexShrink: 0 }}>sim</span>}
                </button>
              ))}
            </div>
            {onBackToRamp && (
              <button
                onClick={onBackToRamp}
                style={{ marginTop: 22, background: 'none', border: 'none', color: INK_SOFT, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Or read "{resolvedLabel}" instead
              </button>
            )}
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: 'clamp(28px, 5vw, 38px)', margin: '0 0 16px', textWrap: 'balance' }}>
              Where that landed
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: INK_PENCIL, maxWidth: '56ch', margin: '0 0 26px' }}>
              &ldquo;{resolvedLabel}&rdquo; is where that resolved to. Pick where you actually want to start.
            </p>
            <div style={{ ...mono, fontSize: 11, color: INK_SOFT, marginBottom: 14 }}>Ways in</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
              {hasFoundation && foundationLabel && (
                <ZoneCard
                  label="COMFORT ZONE" accent="#5f7a12" dist={`${rampLength - 1} step${rampLength - 1 === 1 ? '' : 's'} back`}
                  title={`Start at the foundation: ${foundationLabel}`}
                  detail="Build up from what you already have. Slower, sturdier."
                  onClick={onPickFoundation}
                />
              )}
              <ZoneCard
                label="PROXIMAL ZONE" accent="#5f7a12" dist="right here"
                title={`Go straight to ${resolvedLabel}`}
                detail="Skip the ramp, read this concept directly."
                onClick={onPickDirect}
              />
              <ZoneCard
                label="WORTH FIXING" accent={INK_PENCIL} dist="upload"
                title="Working from a worksheet instead?"
                detail={uploadBusy || "Upload it — every question becomes its own chapter in this book, with a sim if one exists."}
                onClick={onTriggerUpload}
              />
              {uploadError && <p style={{ fontSize: 12.5, color: '#b23b3b', margin: '2px 0 0' }}>{uploadError}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ZoneCard({
  label, accent, dist, title, detail, onClick,
}: { label: string; accent: string; dist: string; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${label === 'PROXIMAL ZONE' ? ACCENT_LIME : PAPER_EDGE}`, borderRadius: 2, padding: '16px 18px',
        background: label === 'PROXIMAL ZONE' ? `linear-gradient(0deg, rgba(196,245,71,0.14), rgba(196,245,71,0.14)), ${PAPER_RAISED}` : PAPER_RAISED,
        cursor: 'pointer', textAlign: 'left', display: 'block', color: 'inherit', fontFamily: FONT_STACK,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ ...mono, fontSize: 11, color: accent }}>{label}</span>
        <span style={{ ...mono, fontSize: 10.5, color: INK_SOFT, whiteSpace: 'nowrap', letterSpacing: 'normal', textTransform: 'none' }}>{dist}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: INK_PENCIL }}>{detail}</div>
    </button>
  )
}

interface ReadPageProps {
  step: Chapter
  stepNumber: number
  stepCount: number
  content: ConceptContent | null
  loading: boolean
  error: string
  generatedSim: GeneratedSim | null
  simGenerating: boolean
  simGenStatus: string
  simGenFailed: string
  onRunSimGeneration: () => void
  notes: BookNote[]
  noteOpen: boolean
  noteDraft: string
  noteSaving: boolean
  noteRef: React.RefObject<HTMLTextAreaElement>
  onOpenNote: () => void
  onNoteDraftChange: (v: string) => void
  onSaveNote: () => void
  onCancelNote: () => void
  pageEdit: PageEdit | undefined
  onUpdateEdit: (patch: Partial<PageEdit>) => void
}

const PAGE_COLOR_SWATCHES: { paper: string; ink: string; label: string }[] = [
  { paper: PAPER_BASE, ink: INK_SYSTEM, label: 'Paper' },
  { paper: '#fdf6e3', ink: '#3a2f1c', label: 'Cream' },
  { paper: '#f2f6fb', ink: '#1a2b4a', label: 'Sky' },
  { paper: '#fbeef0', ink: '#4a2040', label: 'Blush' },
  { paper: '#eef7f0', ink: '#123524', label: 'Mint' },
  { paper: '#1c1a17', ink: '#f2ede4', label: 'Ink' },
]

function ReadPage({
  step, stepNumber, stepCount, content, loading, error, generatedSim,
  simGenerating, simGenStatus, simGenFailed, onRunSimGeneration,
  notes, noteOpen, noteDraft, noteSaving, noteRef, onOpenNote, onNoteDraftChange, onSaveNote, onCancelNote,
  pageEdit, onUpdateEdit,
}: ReadPageProps) {
  const sim = content?.sim ?? null
  const realParas = content?.chapter?.body ? content.chapter.body.split('\n\n').map((p) => p.trim()).filter(Boolean) : []
  const paras = pageEdit?.paragraphs ?? realParas
  const title = pageEdit?.title ?? (content?.label || step.label)
  const paperColor = pageEdit?.paperColor || PAPER_BASE
  const inkColor = pageEdit?.inkColor || INK_SYSTEM

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(title)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [paraDraft, setParaDraft] = useState('')
  const [colorsOpen, setColorsOpen] = useState(false)

  useEffect(() => { setTitleDraft(title); setEditingTitle(false); setEditingIndex(null); setColorsOpen(false) }, [step.conceptId, title])

  function commitTitle() {
    setEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== title) onUpdateEdit({ title: trimmed })
  }
  function startEditPara(i: number) {
    setEditingIndex(i)
    setParaDraft(paras[i])
  }
  function commitPara(i: number) {
    setEditingIndex(null)
    const next = [...paras]
    next[i] = paraDraft
    onUpdateEdit({ paragraphs: next })
  }
  function moveParagraph(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= paras.length) return
    const next = [...paras]
    ;[next[i], next[j]] = [next[j], next[i]]
    onUpdateEdit({ paragraphs: next })
  }

  return (
    <div style={{ ...pageShellStyle, background: paperColor, color: inkColor }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 64px 40px', maxWidth: 780, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...mono, fontSize: 10.5, color: INK_SOFT, marginBottom: 8 }}>
          <span>Chapter {stepNumber} of {stepCount}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{content?.subjectTitle || ''}</span>
            <button
              onClick={() => setColorsOpen((v) => !v)}
              title="Change page colors"
              style={{ width: 20, height: 20, borderRadius: '50%', border: `1px solid ${PAPER_EDGE}`, background: `linear-gradient(135deg, ${paperColor} 50%, ${inkColor} 50%)`, cursor: 'pointer', padding: 0 }}
              aria-label="Change page colors"
            />
          </div>
        </div>

        {colorsOpen && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {PAGE_COLOR_SWATCHES.map((s) => (
              <button
                key={s.label}
                onClick={() => { onUpdateEdit({ paperColor: s.paper, inkColor: s.ink }); setColorsOpen(false) }}
                title={s.label}
                style={{
                  width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', padding: 0,
                  background: s.paper, border: `2px solid ${s.paper === paperColor ? '#5f7a12' : PAPER_EDGE}`,
                }}
                aria-label={`Use ${s.label} colors`}
              />
            ))}
          </div>
        )}

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === 'Enter' && commitTitle()}
            style={{
              fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: 'clamp(24px, 4.4vw, 32px)', margin: '0 0 20px',
              width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${inkColor}`, color: 'inherit', outline: 'none', padding: 0,
            }}
          />
        ) : (
          <h2
            onClick={() => setEditingTitle(true)}
            title="Click to edit"
            style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: 'clamp(24px, 4.4vw, 32px)', margin: '0 0 20px', cursor: 'text' }}
          >
            {title}
          </h2>
        )}

        {step.question && (
          <div style={{ border: `1px dashed ${PAPER_EDGE}`, borderRadius: 2, padding: '12px 14px', marginBottom: 16, background: PAPER_RECESSED }}>
            <div style={{ ...mono, fontSize: 9.5, color: INK_SOFT, marginBottom: 4 }}>From your upload{step.question.number ? `, question ${step.question.number}` : ''}</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: INK_SYSTEM, margin: 0 }}>{step.question.text}</p>
          </div>
        )}

        {loading && <p style={{ fontSize: 13, color: INK_SOFT }}>Turning to this page...</p>}
        {error && <p style={{ fontSize: 13, color: '#b23b3b' }}>{error}</p>}

        {!loading && !error && (
          <>
            <div style={{ border: `1px solid ${PAPER_EDGE}`, borderRadius: 2, background: INK_SYSTEM, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', ...mono, fontSize: 10, color: 'rgba(245,245,245,0.65)', borderBottom: '1px solid rgba(245,245,245,0.1)' }}>
                <span>Simulation</span>
                {(sim || generatedSim) && <span style={{ color: ACCENT_LIME }}>&#9679; live</span>}
              </div>
              {sim ? (
                <iframe title="sim" srcDoc={sim.html} sandbox="allow-scripts" style={{ width: '100%', height: 320, border: 'none', background: 'white', display: 'block' }} />
              ) : generatedSim ? (
                <iframe title="generated-sim" srcDoc={generatedSim.html} sandbox="allow-scripts" style={{ width: '100%', height: 320, border: 'none', background: 'white', display: 'block' }} />
              ) : (
                <div style={{ padding: '18px 16px', color: 'rgba(245,245,245,0.75)' }}>
                  <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: '0 0 10px' }}>No simulation exists yet for this concept.</p>
                  <button
                    onClick={onRunSimGeneration}
                    disabled={simGenerating}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: simGenerating ? 'rgba(196,245,71,0.35)' : ACCENT_LIME, color: '#0a0f08', fontWeight: 700, fontSize: 12.5, cursor: simGenerating ? 'default' : 'pointer' }}
                  >
                    {simGenerating ? 'Generating and reviewing...' : 'Generate a sim for this'}
                  </button>
                  {simGenerating && <p style={{ fontSize: 11, color: 'rgba(196,245,71,0.85)', marginTop: 8 }}>{simGenStatus || 'Starting...'}</p>}
                  {simGenFailed && <p style={{ fontSize: 11, color: '#ff9b9b', marginTop: 8 }}>{simGenFailed}</p>}
                </div>
              )}
            </div>

            {paras.length ? (
              paras.map((p, i) => (
                <div key={i} className="lrn-book-para" style={{ position: 'relative', margin: i === 0 ? 0 : '12px 0 0', maxWidth: '62ch' }}>
                  {editingIndex === i ? (
                    <textarea
                      autoFocus
                      value={paraDraft}
                      onChange={(e) => setParaDraft(e.target.value)}
                      onBlur={() => commitPara(i)}
                      rows={Math.max(2, Math.ceil(paraDraft.length / 80))}
                      style={{ width: '100%', resize: 'vertical', fontSize: 14.5, lineHeight: 1.72, fontFamily: 'inherit', color: 'inherit', background: 'transparent', border: `1px dashed ${inkColor}`, borderRadius: 4, padding: 6, outline: 'none' }}
                    />
                  ) : (
                    <p
                      onClick={() => startEditPara(i)}
                      title="Click to edit"
                      style={{ fontSize: 14.5, lineHeight: 1.72, color: 'inherit', margin: 0, cursor: 'text', paddingRight: 44 }}
                    >
                      {p}
                    </p>
                  )}
                  {editingIndex !== i && (
                    <div className="lrn-book-para-controls" style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 2, opacity: 0 }}>
                      <button onClick={() => moveParagraph(i, -1)} disabled={i === 0} aria-label="Move paragraph up" style={{ width: 20, height: 20, border: `1px solid ${PAPER_EDGE}`, background: 'transparent', color: 'inherit', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 10, padding: 0, borderRadius: 3 }}>&uarr;</button>
                      <button onClick={() => moveParagraph(i, 1)} disabled={i === paras.length - 1} aria-label="Move paragraph down" style={{ width: 20, height: 20, border: `1px solid ${PAPER_EDGE}`, background: 'transparent', color: 'inherit', cursor: i === paras.length - 1 ? 'default' : 'pointer', opacity: i === paras.length - 1 ? 0.3 : 1, fontSize: 10, padding: 0, borderRadius: 3 }}>&darr;</button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13.5, color: INK_SOFT }}>No written chapter for this concept yet.</p>
            )}

            {notes.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '26px 0 12px', ...mono, fontSize: 10, color: INK_SOFT }}>
                  <span style={{ flex: 1, height: 1, background: PAPER_EDGE }} />
                  your notes
                  <span style={{ flex: 1, height: 1, background: PAPER_EDGE }} />
                </div>
                {notes.map((n) => (
                  <div key={n.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: PAPER_RECESSED, border: `1px dashed ${PAPER_EDGE}`, borderRadius: 2, padding: '12px 14px', marginTop: 10 }}>
                    <span style={{ width: 8, height: 8, marginTop: 5, borderRadius: '50%', background: ACCENT_LIME, boxShadow: '0 0 0 4px rgba(196,245,71,0.25)', flexShrink: 0 }} />
                    <p style={{ fontSize: 13.5, lineHeight: 1.55, color: INK_SYSTEM, fontStyle: 'italic', margin: 0 }}>&ldquo;{n.text}&rdquo;</p>
                  </div>
                ))}
              </>
            )}

            {noteOpen ? (
              <div style={{ marginTop: 16 }}>
                <textarea
                  ref={noteRef}
                  value={noteDraft}
                  onChange={(e) => onNoteDraftChange(e.target.value)}
                  placeholder="What do you want to remember here?"
                  rows={2}
                  style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 8, border: `1px solid ${PAPER_EDGE}`, background: PAPER_RAISED, color: INK_SYSTEM, fontFamily: FONT_STACK, fontSize: 13, outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={onSaveNote} disabled={noteSaving || !noteDraft.trim()} style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: '#3d6b4f', color: 'white', fontWeight: 600, fontSize: 12.5, cursor: noteSaving ? 'default' : 'pointer' }}>
                    {noteSaving ? 'Saving...' : 'Save note'}
                  </button>
                  <button onClick={onCancelNote} style={{ padding: '7px 16px', borderRadius: 999, border: `1px solid ${PAPER_EDGE}`, background: 'transparent', color: INK_PENCIL, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={onOpenNote}
                style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, ...mono, fontSize: 10.5, color: INK_PENCIL, border: `1px solid ${PAPER_EDGE}`, borderRadius: 999, padding: '7px 13px', cursor: 'pointer', background: 'transparent' }}
              >
                <span style={{ color: '#5f7a12', fontWeight: 600 }}>+</span> Tag your own note to this page
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function DraggableChat({
  messages, input, onInputChange, onSend, sending, error, onClose, conceptLabel,
}: {
  messages: ChatMsg[]; input: string; onInputChange: (v: string) => void; onSend: () => void
  sending: boolean; error: string; onClose: () => void; conceptLabel: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { pos, dragHandleProps } = useDraggablePosition(() => ({
    top: Math.max(20, window.innerHeight - 460),
    left: Math.max(20, window.innerWidth - 356),
  }))

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, sending])

  if (!pos) return null

  return (
    <div
      style={{
        position: 'fixed', top: pos.top, left: pos.left, width: 320, maxHeight: 440, zIndex: 50,
        display: 'flex', flexDirection: 'column', background: PAPER_BASE, color: INK_SYSTEM,
        borderRadius: 10, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', border: `1px solid ${PAPER_EDGE}`, overflow: 'hidden',
      }}
    >
      <div
        {...dragHandleProps}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
          background: INK_SYSTEM, color: '#f5f5f5', cursor: 'grab', touchAction: 'none', flexShrink: 0, userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Jesse · {conceptLabel}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(245,245,245,0.7)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }}
          aria-label="Close chat"
        >
          &times;
        </button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && !sending && (
          <p style={{ fontSize: 12.5, color: INK_SOFT, margin: 0 }}>Ask Jesse about this page. It will help you get unstuck, not just hand you the answer.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '8px 11px',
              borderRadius: 10, fontSize: 13, lineHeight: 1.5,
              background: m.role === 'user' ? 'rgba(61,107,79,0.14)' : PAPER_RAISED,
              border: `1px solid ${m.role === 'user' ? 'rgba(61,107,79,0.3)' : PAPER_EDGE}`,
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && <div style={{ alignSelf: 'flex-start', fontSize: 12, color: INK_SOFT }}>Jesse is thinking...</div>}
      </div>
      {error && <p style={{ fontSize: 11.5, color: '#b23b3b', margin: '0 12px 6px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: `1px solid ${PAPER_EDGE}`, flexShrink: 0 }}>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !sending && onSend()}
          placeholder="Ask about this page..."
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: `1px solid ${PAPER_EDGE}`, background: PAPER_RAISED, color: INK_SYSTEM, fontSize: 12.5, outline: 'none', fontFamily: FONT_STACK }}
        />
        <button
          onClick={onSend}
          disabled={sending || !input.trim()}
          style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: sending || !input.trim() ? 'rgba(196,245,71,0.4)' : ACCENT_LIME, color: '#0a0f08', fontWeight: 700, fontSize: 12, cursor: sending || !input.trim() ? 'default' : 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
