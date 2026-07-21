/**
 * ActTrailMap — simple, fun ACT concept map for the dashboard.
 * Clusters as sticker islands; tap opens the notebook lesson.
 * Replaces the dense constellation for embedded dashboard use.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACT_TOC_SECTIONS, actConceptLabel, actFrequency } from '../lib/actToc'
import { mlIdToLabel } from '../lib/conceptMap'
import s from './ActTrailMap.module.css'

type Props = {
  sparkId?: string | null
  onOpenLesson: (conceptId: string) => void
}

export default function ActTrailMap({ sparkId, onOpenLesson }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(sparkId ?? ACT_TOC_SECTIONS[1]?.conceptIds[0] ?? '')

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ACT_TOC_SECTIONS.map(sec => ({
      ...sec,
      conceptIds: sec.conceptIds
        .filter(id => {
          if (!needle) return true
          return actConceptLabel(id).toLowerCase().includes(needle) || id.includes(needle)
        })
        .sort((a, b) => actFrequency(b) - actFrequency(a)),
    })).filter(sec => sec.conceptIds.length > 0)
  }, [q])

  return (
    <div className={s.root}>
      <input
        className={s.search}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Find a topic…"
        aria-label="Find ACT topic"
      />

      <div className={s.trail}>
        {sections.map(sec => (
          <section key={sec.id} className={s.island}>
            <h3 className={s.islandTitle}>{sec.title}</h3>
            <div className={s.stickers}>
              {sec.conceptIds.map(id => {
                const isSpark = id === sparkId
                const isFocus = id === focus
                return (
                  <button
                    key={id}
                    type="button"
                    className={[
                      s.sticker,
                      isSpark ? s.stickerSpark : '',
                      isFocus ? s.stickerFocus : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setFocus(id)}
                    onDoubleClick={() => onOpenLesson(id)}
                  >
                    {isSpark && <span className={s.sparkBadge}>★</span>}
                    <span className={s.stickerLabel}>{actConceptLabel(id)}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {focus && (
        <div className={s.dock}>
          <div className={s.dockCopy}>
            <span className={s.dockName}>{actConceptLabel(focus)}</span>
            {focus === sparkId && <span className={s.dockHint}>today’s spark</span>}
          </div>
          <button type="button" className={s.dockGo} onClick={() => onOpenLesson(focus)}>
            Open lesson →
          </button>
          <button
            type="button"
            className={s.dockGhost}
            onClick={() => navigate('/practice', { state: { conceptId: focus, missionType: 'learn' } })}
          >
            Quick drill
          </button>
        </div>
      )}

      {!focus && sparkId && (
        <p className={s.emptyHint}>Tap a sticker — double-tap or hit Open for {mlIdToLabel(sparkId)}.</p>
      )}
    </div>
  )
}
