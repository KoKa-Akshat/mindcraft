/**
 * PracticePathLab — green-themed learning path layout experiment.
 * Same structure as Practice path screen; different colors + sidebar streak.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import Sidebar from '../components/Sidebar'
import { ConceptPathIcon } from '../components/ConceptPathIcon'
import { PRACTICE_CONCEPTS } from '../lib/questionBank'
import s from './PracticePathLab.module.css'

const PATH_IDS = [
  'linear_equations',
  'linear_inequalities',
  'absolute_value',
  'systems_of_linear_equations',
  'exponent_rules',
  'radical_expressions',
] as const

const EST_MINUTES = [12, 10, 14, 16, 11, 13]

export default function PracticePathLab() {
  const user = useUser()
  const navigate = useNavigate()
  const { streak } = useStudentData(user)

  const pathConcepts = useMemo(
    () => PATH_IDS.map(id => PRACTICE_CONCEPTS.find(c => c.id === id)).filter(Boolean),
    [],
  )

  const pathIdSet = useMemo(() => new Set<string>(PATH_IDS), [])

  const exploreConcepts = useMemo(
    () => PRACTICE_CONCEPTS.filter(c => !pathIdSet.has(c.id)).slice(0, 8),
    [pathIdSet],
  )

  return (
    <div className={s.shell}>
      <Sidebar />

      <main className={s.page}>
        <header className={s.header}>
          <button type="button" className={s.back} onClick={() => navigate('/practice')}>
            ← Practice
          </button>
          <div className={s.headerRow}>
            <div>
              <span className={s.labBadge}>Lab</span>
              <h1 className={s.title}>Your Learning Path</h1>
              <p className={s.subtitle}>Master algebra step by step</p>
            </div>
            <button type="button" className={s.liveLink} onClick={() => navigate('/practice')}>
              Compare live path →
            </button>
          </div>
        </header>

        <div className={s.layout}>
          <section className={s.pathColumn}>
            <ol className={s.pathList}>
              {pathConcepts.map((concept, i) => (
                <li key={concept!.id} className={s.pathItem}>
                  <div className={s.pathRail} aria-hidden="true">
                    <span className={s.pathDot}>{i + 1}</span>
                    {i < pathConcepts.length - 1 && <span className={s.pathLine} />}
                  </div>
                  <article className={`${s.chapterCard} ${i === 0 ? s.chapterCardActive : ''}`}>
                    <div className={s.iconTile}>
                      <ConceptPathIcon conceptId={concept!.id} size={36} />
                    </div>
                    <div className={s.chapterBody}>
                      <h2 className={s.chapterName}>{concept!.label}</h2>
                      <p className={s.chapterMeta}>Practice · ~{EST_MINUTES[i] ?? 12} min</p>
                    </div>
                    <button
                      type="button"
                      className={s.chapterGo}
                      onClick={() => navigate('/practice', { state: { concept: concept!.id } })}
                    >
                      →
                    </button>
                  </article>
                </li>
              ))}
            </ol>
          </section>

          <aside className={s.sideColumn}>
            <div className={s.streakCard}>
              <span className={s.streakFire} aria-hidden="true">🔥</span>
              <div>
                <p className={s.streakCount}>{streak || 0} day{streak === 1 ? '' : 's'}</p>
                <p className={s.streakLabel}>Keep it up!</p>
              </div>
            </div>

            <div className={s.exploreBlock}>
              <h3 className={s.exploreTitle}>More topics to explore</h3>
              <p className={s.exploreSub}>Not on your current path — jump in anytime.</p>
              <ul className={s.exploreList}>
                {exploreConcepts.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={s.exploreItem}
                      onClick={() => navigate('/practice', { state: { concept: c.id } })}
                    >
                      <span className={s.exploreEmoji}>{c.emoji}</span>
                      <span className={s.exploreName}>{c.label}</span>
                      <span className={s.exploreChev}>›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
