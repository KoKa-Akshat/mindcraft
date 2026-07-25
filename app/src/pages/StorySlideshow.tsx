/**
 * StorySlideshow — short looping story + question deck.
 * After Manjushree: ?auto=1 plays slides one-after-another in sequence.
 * Same chapter look as ConceptChapterPage (polaroid story cards + sticker MCQs).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import conceptStoriesRaw from '../data/conceptStories.json'
import contextFramesRaw from '../data/questionContextFrames.json'
import { getQuestions, type Question } from '../lib/questionBank'
import { canonicalConceptId } from '../lib/conceptAliases'
import { storyArtFor, storyArtTilt } from '../lib/storyArt'
import MathText from '../components/MathText'
import HighlightedStem from '../components/HighlightedStem'
import DoodleReward, { pickDoodleStamp } from '../components/doodle/DoodleReward'
import { playChime, playTap } from '../lib/uiSound'
import s from './ConceptChapterPage.module.css'

type CS = {
  conceptId: string
  conceptName: string
  story: string
}
const DB = conceptStoriesRaw as unknown as Record<string, CS>

type ContextFrame = {
  protagonist: string
  settingLine: string
  questionBridge: string
}
const FRAMES = contextFramesRaw as unknown as Record<string, ContextFrame>

const THEME = {
  bg: '#080e14',
  paper: '#f7f3ee',
  ink: '#1c1a17',
  dim: '#6f6a61',
  accent: '#1d3a8a',
}

const STORY_SLIDES = 4
const QUEST_COUNT = 2
const STORY_DWELL_MS = 3200
const QUEST_AFTER_MS = 1400

type Panel =
  | { kind: 'open'; paras: string[]; pageNum: number; pageCount: number }
  | { kind: 'quest'; qIdx: number }

function storyBeats(text: string): string[] {
  const paras = text.split('\n').map(p => p.trim()).filter(p => p.length > 15)
  const beats: string[] = []
  for (const p of paras) {
    if (p.length <= 280) {
      beats.push(p)
      continue
    }
    const sentences = p.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [p]
    let buf = ''
    for (const raw of sentences) {
      const sentence = raw.trim()
      if (!sentence) continue
      if (buf && `${buf} ${sentence}`.length > 260) {
        beats.push(buf)
        buf = sentence
      } else {
        buf = buf ? `${buf} ${sentence}` : sentence
      }
    }
    if (buf) beats.push(buf)
  }
  return beats
}

function takeStoryPages(text: string, pageCount: number): string[][] {
  const beats = storyBeats(text)
  if (beats.length === 0) {
    return [['Your chapter opens here — the scene is already waiting.']]
  }
  const pages: string[][] = Array.from({ length: pageCount }, () => [])
  const per = Math.max(1, Math.ceil(beats.length / pageCount))
  beats.forEach((beat, i) => {
    pages[Math.min(pageCount - 1, Math.floor(i / per))].push(beat)
  })
  return pages.map((p, i) => (p.length ? p.slice(0, 2) : [beats[Math.min(i, beats.length - 1)]]))
}

function fmtChoice(c: string): string {
  return c.replace(/^\s*[A-D][).:]\s*/i, '').trim()
}

export default function StorySlideshow() {
  const { conceptId: rawId = 'fractions_decimals' } = useParams()
  const [searchParams] = useSearchParams()
  const autoPlay = searchParams.get('auto') === '1'
  const navigate = useNavigate()
  const conceptId = canonicalConceptId(rawId) || 'fractions_decimals'
  const cs = DB[conceptId] ?? DB.fractions_decimals
  const frame = FRAMES[conceptId] ?? FRAMES.fractions_decimals ?? null
  const artSrc = storyArtFor(conceptId)

  const [deckKey, setDeckKey] = useState(0)
  const questions = useMemo(
    () => getQuestions(conceptId, 1, QUEST_COUNT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conceptId, deckKey],
  )

  const panels = useMemo<Panel[]>(() => {
    const pages = takeStoryPages(cs.story, STORY_SLIDES)
    const open: Panel[] = pages.map((paras, i) => ({
      kind: 'open',
      paras,
      pageNum: i + 1,
      pageCount: pages.length,
    }))
    const quests: Panel[] = questions.map((_, qIdx) => ({ kind: 'quest', qIdx }))
    return [...open, ...quests]
  }, [cs.story, questions])

  const [panelIdx, setPanelIdx] = useState(0)
  const [slideDir, setSlideDir] = useState<'f' | 'b'>('f')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  const [eliminated, setEliminated] = useState<Record<number, number[]>>({})
  const [wiggleChoice, setWiggleChoice] = useState<{ qIdx: number; i: number } | null>(null)
  const [hintsShown, setHintsShown] = useState<Record<number, number>>({})
  const [rewardPhrase, setRewardPhrase] = useState<string | null>(null)
  const touchX = useRef<number | null>(null)
  const autoTimer = useRef(0)
  const panelsRef = useRef(panels)
  panelsRef.current = panels

  const current = panels[panelIdx]
  const isLast = panelIdx >= panels.length - 1

  function goToPanel(next: number, dir: 'f' | 'b') {
    window.clearTimeout(autoTimer.current)
    if (next < 0) {
      setSlideDir('b')
      setPanelIdx(panelsRef.current.length - 1)
      return
    }
    if (next >= panelsRef.current.length) {
      setDeckKey(k => k + 1)
      setAnswers({})
      setSubmitted({})
      setEliminated({})
      setHintsShown({})
      setSlideDir('f')
      setPanelIdx(0)
      return
    }
    setSlideDir(dir)
    setPanelIdx(next)
  }

  // Autoplay: story slides advance on a timer; quest slides wait for a correct lock-in.
  useEffect(() => {
    if (!autoPlay) return
    window.clearTimeout(autoTimer.current)
    const panel = panels[panelIdx]
    if (!panel) return

    if (panel.kind === 'open') {
      autoTimer.current = window.setTimeout(() => {
        goToPanel(panelIdx + 1, 'f')
      }, STORY_DWELL_MS)
      return () => window.clearTimeout(autoTimer.current)
    }

    // Quest: advance only after the student locks the right answer.
    if (panel.kind === 'quest' && submitted[panel.qIdx]) {
      autoTimer.current = window.setTimeout(() => {
        goToPanel(panelIdx + 1, 'f')
      }, QUEST_AFTER_MS)
      return () => window.clearTimeout(autoTimer.current)
    }
    return () => window.clearTimeout(autoTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, panelIdx, deckKey, submitted, panels])

  function lockAnswer(qIdx: number) {
    const chosen = answers[qIdx]
    if (chosen === null || chosen === undefined) return
    const q = questions[qIdx]
    if (!q) return
    if (chosen !== q.correctIndex) {
      playTap()
      setEliminated(e => ({
        ...e,
        [qIdx]: [...new Set([...(e[qIdx] ?? []), chosen])],
      }))
      setWiggleChoice({ qIdx, i: chosen })
      window.setTimeout(() => setWiggleChoice(null), 520)
      setAnswers(a => {
        const next = { ...a }
        delete next[qIdx]
        return next
      })
      return
    }
    playChime()
    setRewardPhrase(pickDoodleStamp(qIdx + chosen))
    setSubmitted(d => ({ ...d, [qIdx]: true }))
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.changedTouches[0]?.clientX ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchX.current
    touchX.current = null
    if (start == null) return
    const dx = (e.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(dx) < 48) return
    if (dx < 0) goToPanel(panelIdx + 1, 'f')
    else goToPanel(panelIdx - 1, 'b')
  }

  function Polaroid({ salt }: { salt: number }) {
    const tilt = storyArtTilt(conceptId, salt)
    return (
      <figure
        className={`${s.polaroid} ${s.polaroidHero}`}
        style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
        aria-hidden
      >
        <img src={artSrc} alt="" draggable={false} />
      </figure>
    )
  }

  function renderOpen(paras: string[], pageNum: number, pageCount: number) {
    const isFirst = pageNum === 1
    return (
      <div className={s.blendSheet}>
        <Polaroid salt={panelIdx + deckKey} />
        <div className={s.blendCopy}>
          <p className={s.blendEyebrow}>
            {isFirst ? 'Story card' : `${cs.conceptName} · continued`}
          </p>
          {isFirst ? (
            <h1 className={s.blendTitle}>{cs.conceptName}</h1>
          ) : (
            <p className={s.blendStamp} style={{ color: THEME.dim }}>
              page {pageNum} of {pageCount}
            </p>
          )}
          {isFirst && frame && (
            <p className={s.blendStamp} style={{ color: THEME.accent }}>
              {frame.protagonist}
              {frame.settingLine ? ` · ${frame.settingLine}` : ''}
            </p>
          )}
          {paras.map((p, i) => (
            <p key={i} className={`${s.blendPara} ${isFirst && i === 0 ? s.blendLead : ''}`}>
              {isFirst && i === 0 && p.length > 0 && (
                <span className={s.dropCap} style={{ color: THEME.accent }}>{p[0]}</span>
              )}
              {isFirst && i === 0 ? p.slice(1) : p}
            </p>
          ))}
          {autoPlay && (
            <p className={s.blendStamp} style={{ color: THEME.dim, marginTop: 12 }}>
              next slide…
            </p>
          )}
        </div>
      </div>
    )
  }

  function renderQuest(qIdx: number) {
    const q: Question | undefined = questions[qIdx]
    if (!q) return null
    const chosen = answers[qIdx] ?? null
    const isDone = submitted[qIdx] ?? false
    const allHints = (q.hints ?? []).slice(0, 2)
    return (
      <div className={`${s.blendSheet} ${s.blendQuest}`}>
        <div className={s.blendQuestMain}>
          <header className={s.qHead}>
            <span className={s.qKicker}>{qIdx + 1} / {QUEST_COUNT}</span>
          </header>
          {frame?.questionBridge && (
            <p className={s.blendStamp} style={{ color: THEME.accent, marginBottom: 10 }}>
              {frame.questionBridge}
            </p>
          )}
          <HighlightedStem text={q.question} ink={THEME.ink} accent={THEME.accent} highlights={[]} />
          <div className={`${s.qChoices} ${s.stickerChoices}`}>
            {q.choices.slice(0, 4).map((c, i) => {
              const out = (eliminated[qIdx] ?? []).includes(i)
              const wiggling = wiggleChoice?.qIdx === qIdx && wiggleChoice.i === i
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    s.choice,
                    s.stickerChoice,
                    chosen === i ? s.choiceChosen : '',
                    isDone && chosen === i ? s.choiceCorrect : '',
                    out ? s.choiceSoftWrong : '',
                    wiggling ? s.choiceWiggle : '',
                    isDone ? s.choiceDone : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !isDone && !out && setAnswers(a => ({ ...a, [qIdx]: i }))}
                  disabled={isDone || out}
                >
                  <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                  <span className={s.choiceText}><MathText text={fmtChoice(c)} /></span>
                </button>
              )
            })}
          </div>

          {!isDone && allHints.length > 0 && (
            <div className={s.hintStrip}>
              {(hintsShown[qIdx] ?? 0) < allHints.length && (
                <button
                  type="button"
                  className={s.hintBtn}
                  style={{ borderColor: THEME.accent + '55', color: THEME.accent }}
                  onClick={() => setHintsShown(h => ({ ...h, [qIdx]: (h[qIdx] ?? 0) + 1 }))}
                >
                  hint?
                </button>
              )}
              {allHints.slice(0, hintsShown[qIdx] ?? 0).map((hint, hi) => (
                <div key={hi} className={s.hintBubble} style={{ borderLeftColor: THEME.accent + '66', color: THEME.dim }}>
                  <MathText text={hint} />
                </div>
              ))}
            </div>
          )}

          {!isDone ? (
            <button
              type="button"
              className={s.submitBtn}
              style={{ background: THEME.ink, color: THEME.paper }}
              disabled={chosen === null}
              onClick={() => lockAnswer(qIdx)}
            >
              {chosen === null ? 'Pick one' : 'Lock in →'}
            </button>
          ) : (
            <p className={s.qDoneNote} style={{ color: THEME.dim }}>
              {autoPlay ? 'Nice — next slide…' : 'Nice. Swipe for the next slide.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={s.chapterDesk}
      style={{
        '--theme-bg': THEME.bg,
        '--theme-paper': THEME.paper,
        '--theme-ink': THEME.ink,
        '--theme-accent': THEME.accent,
        '--theme-dim': THEME.dim,
      } as React.CSSProperties}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <DoodleReward phrase={rewardPhrase} onDone={() => setRewardPhrase(null)} />

      <header className={s.canvasChrome}>
        <button type="button" className={s.chromeBack} onClick={() => navigate(-1)}>← back</button>
        <span className={s.canvasWordmark}>{cs.conceptName}</span>
        <div className={s.canvasChromeRight}>
          <span className={s.blendStamp} style={{ color: THEME.dim, margin: 0 }}>
            {autoPlay ? 'autoplay' : 'loop'}
          </span>
        </div>
      </header>

      <main
        className={`${s.canvasStage} ${slideDir === 'f' ? s.slideFwd : s.slideBack}`}
        key={`${deckKey}-${panelIdx}`}
      >
        {current?.kind === 'open'
          ? renderOpen(current.paras, current.pageNum, current.pageCount)
          : current?.kind === 'quest'
            ? renderQuest(current.qIdx)
            : null}
      </main>

      <nav className={s.spreadNav}>
        <button type="button" className={s.navArrow} onClick={() => goToPanel(panelIdx - 1, 'b')} aria-label="Previous">←</button>
        <div className={s.navDots}>
          {panels.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${s.dot} ${i === panelIdx ? s.dotActive : ''} ${i < panelIdx ? s.dotPast : ''}`}
              style={i === panelIdx ? { background: THEME.accent } : i < panelIdx ? { background: THEME.accent + '55' } : undefined}
              onClick={() => goToPanel(i, i > panelIdx ? 'f' : 'b')}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          className={isLast ? s.navPrimary : s.navArrow}
          style={isLast ? { background: THEME.ink, color: THEME.paper } : undefined}
          onClick={() => goToPanel(panelIdx + 1, 'f')}
          aria-label={isLast ? 'Loop again' : 'Next'}
        >
          {isLast ? 'again →' : '→'}
        </button>
      </nav>
    </div>
  )
}
