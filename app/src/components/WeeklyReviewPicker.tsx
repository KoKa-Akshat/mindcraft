/**
 * Weekly Review topic picker — three modes on a lit knowledge map:
 *   all         → every playable ACT dot lit
 *   recommended → weakness + stretch + review algo picks lit
 *   manual      → click dots to toggle
 *
 * Builds on lib/weeklyPracticePaper.ts; Confirm caches the paper and starts
 * practice from the first slot (same launch path Dashboard used before).
 */
import { useEffect, useMemo, useState } from 'react'
import { layoutActMapNodes } from '../lib/actMapLayout'
import { actConceptLabel } from '../lib/actToc'
import { conceptIconUrl } from '../lib/conceptIcon'
import type { NextConcept } from '../lib/recommendNextConcept'
import {
  buildWeeklyPracticePaper,
  cacheWeeklyPaper,
  loadCachedWeeklyPaper,
  playableActConceptIds,
  recommendedConceptIds,
  type TopicPickMode,
  type WeeklyPracticePaper,
} from '../lib/weeklyPracticePaper'
import s from './WeeklyReviewPicker.module.css'

type Props = {
  weakness: NextConcept | null
  learn: NextConcept | null
  reviewConceptIds?: string[]
  onClose: () => void
  /** Printable / scrollable paper — the original Weekly Review flow. */
  onStart: (paper: WeeklyPracticePaper) => void
  /** Guided play-through: story beat → formula card → question batch per
   *  topic, in sequence, inside Practice.tsx. New alongside `onStart`, not a
   *  replacement — the printable path stays reachable via its own button. */
  onPlayThrough: (paper: WeeklyPracticePaper) => void
}

const MODE_COPY: Record<TopicPickMode, string> = {
  all: 'Every topic on your map lights up. The paper samples across all of them.',
  recommended: 'Our mix: strengthen your weak spot, stretch into something new, light review.',
  manual: 'Tap dots to choose. Lit = in this week’s paper.',
}

export default function WeeklyReviewPicker({
  weakness,
  learn,
  reviewConceptIds = [],
  onClose,
  onStart,
  onPlayThrough,
}: Props) {
  const playable = useMemo(() => playableActConceptIds(), [])
  const playableSet = useMemo(() => new Set(playable), [playable])
  const nodes = useMemo(() => layoutActMapNodes(playableSet), [playableSet])

  const recommended = useMemo(
    () => recommendedConceptIds({ weakness, learn, reviewConceptIds }).filter(id => playableSet.has(id)),
    [weakness, learn, reviewConceptIds, playableSet],
  )

  const cached = useMemo(() => loadCachedWeeklyPaper(), [])
  const [mode, setMode] = useState<TopicPickMode>(cached?.mode ?? 'recommended')
  const [manualIds, setManualIds] = useState<string[]>(() => {
    if (cached?.mode === 'manual' && cached.selectedConceptIds?.length) {
      return cached.selectedConceptIds.filter(id => playableSet.has(id))
    }
    return recommended
  })

  useEffect(() => {
    if (mode !== 'manual') return
    if (manualIds.length === 0 && recommended.length > 0) {
      setManualIds(recommended)
    }
  }, [mode, manualIds.length, recommended])

  const litIds = useMemo(() => {
    if (mode === 'all') return playable
    if (mode === 'recommended') return recommended
    return manualIds
  }, [mode, playable, recommended, manualIds])

  const litSet = useMemo(() => new Set(litIds), [litIds])

  function selectMode(next: TopicPickMode) {
    setMode(next)
    if (next === 'manual' && manualIds.length === 0) {
      setManualIds(recommended.length ? recommended : playable.slice(0, 4))
    }
  }

  function toggleDot(id: string) {
    if (mode !== 'manual') return
    setManualIds(prev => (
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    ))
  }

  function buildPaper(): WeeklyPracticePaper | null {
    if (litIds.length === 0) return null
    const paper = buildWeeklyPracticePaper({
      weakness,
      learn,
      reviewConceptIds,
      selectedConceptIds: litIds,
      mode,
      questionsPerSlot: mode === 'all' ? 1 : 3,
      maxQuestions: mode === 'all' ? 12 : undefined,
    })
    if (!paper.questionIds.length) return null
    cacheWeeklyPaper(paper)
    return paper
  }

  function handlePlayThrough() {
    const paper = buildPaper()
    if (paper) onPlayThrough(paper)
  }

  function handlePrintScroll() {
    const paper = buildPaper()
    if (paper) onStart(paper)
  }

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true" aria-labelledby="weekly-review-title">
      <div className={s.panel}>
        <header className={s.head}>
          <div>
            <p className={s.eyebrow}>This week’s paper</p>
            <h2 id="weekly-review-title" className={s.title}>Weekly Review</h2>
          </div>
          <button type="button" className={s.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className={s.modes} role="tablist" aria-label="Topic pick mode">
          {([
            ['recommended', 'Recommended'],
            ['manual', 'Pick topics'],
            ['all', 'All topics'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`${s.modeBtn} ${mode === id ? s.modeOn : ''}`}
              onClick={() => selectMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className={s.modeCopy}>{MODE_COPY[mode]}</p>

        <div className={s.mapWrap}>
          <svg className={s.mapSvg} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {nodes.map(n => {
              const lit = litSet.has(n.id)
              return (
                <circle
                  key={`ring-${n.id}`}
                  cx={n.x}
                  cy={n.y}
                  r={lit ? 4.2 : 3.4}
                  className={lit ? s.dotRingLit : s.dotRing}
                />
              )
            })}
          </svg>
          {nodes.map(n => {
            const lit = litSet.has(n.id)
            const icon = conceptIconUrl(n.id)
            return (
              <button
                key={n.id}
                type="button"
                className={`${s.dot} ${lit ? s.dotLit : ''} ${mode === 'manual' ? s.dotClickable : ''}`}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
                onClick={() => toggleDot(n.id)}
                disabled={mode !== 'manual'}
                title={actConceptLabel(n.id)}
                aria-pressed={lit}
                aria-label={`${actConceptLabel(n.id)}${lit ? ', selected' : ''}`}
              >
                {icon ? <img src={icon} alt="" /> : <span>{actConceptLabel(n.id).slice(0, 1)}</span>}
              </button>
            )
          })}
        </div>

        <footer className={s.foot}>
          <p className={s.count}>
            {litIds.length === 0
              ? 'Pick at least one topic'
              : `${litIds.length} topic${litIds.length === 1 ? '' : 's'} lit`}
          </p>
          <div className={s.actions}>
            <button type="button" className={s.secondary} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={s.secondary}
              disabled={litIds.length === 0}
              onClick={handlePrintScroll}
            >
              Print / scroll
            </button>
            <button
              type="button"
              className={s.primary}
              disabled={litIds.length === 0}
              onClick={handlePlayThrough}
            >
              Play through →
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
