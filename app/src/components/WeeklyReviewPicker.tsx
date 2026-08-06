/**
 * Weekly Review topic picker — modes on a mandala of concept icons.
 * One circle per topic (the icon badge itself). Let's Go starts the
 * guided play-through from the lit set.
 */
import { useEffect, useMemo, useState } from 'react'
import { actConceptLabel } from '../lib/actToc'
import { conceptIconUrl } from '../lib/conceptIcon'
import { layoutMandalaNodes } from '../lib/mandalaLayout'
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
  /** @deprecated Print path retired from UI; kept optional for callers. */
  onStart?: (paper: WeeklyPracticePaper) => void
  /** Guided play-through inside Practice.tsx. */
  onPlayThrough: (paper: WeeklyPracticePaper) => void
}

const MODE_COPY: Record<TopicPickMode, string> = {
  all: 'Every topic on your map lights up. The paper samples across all of them.',
  recommended: 'Our mix: strengthen your weak spot, stretch into something new, light review.',
  manual: 'Tap dots to choose. Lit = in this week’s paper.',
}

/** Soft orbit guides only — not a second circle per concept. */
function MandalaOrbits({ ringCount }: { ringCount: number }) {
  const radii = [18, 32, 44].slice(0, Math.max(0, ringCount - 1))
  return (
    <g aria-hidden="true">
      {radii.map(r => (
        <ellipse
          key={r}
          cx={50}
          cy={50}
          rx={r}
          ry={r * 0.92}
          className={s.mandalaOrbit}
        />
      ))}
      <circle cx={50} cy={50} r={1.1} fill="rgba(212, 168, 40, 0.35)" />
    </g>
  )
}

export default function WeeklyReviewPicker({
  weakness,
  learn,
  reviewConceptIds = [],
  onClose,
  onPlayThrough,
}: Props) {
  const playable = useMemo(() => playableActConceptIds(), [])
  const playableSet = useMemo(() => new Set(playable), [playable])
  const nodes = useMemo(() => layoutMandalaNodes(playable), [playable])
  const maxRing = useMemo(
    () => nodes.reduce((m, n) => Math.max(m, n.ring), 0),
    [nodes],
  )

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

  function handleLetsGo() {
    const paper = buildPaper()
    if (paper) onPlayThrough(paper)
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
            <MandalaOrbits ringCount={maxRing + 1} />
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
          <button
            type="button"
            className={s.letsGo}
            disabled={litIds.length === 0}
            onClick={handleLetsGo}
          >
            Let’s Go!
          </button>
        </footer>
      </div>
    </div>
  )
}
