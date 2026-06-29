/**
 * PracticePathLab — experimental “luxury green” learning path layout.
 * Test at /practice-path-lab (does not replace production /practice path UI).
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
    () => PATH_IDS.map(id => PRACTICE_CONCEPTS.find(c => c.id === id)!).filter(Boolean),
    [],
  )

  const pathIdSet = useMemo(() => new Set<string>(PATH_IDS), [])

  const exploreConcepts = useMemo(
    () => PRACTICE_CONCEPTS.filter(c => !pathIdSet.has(c.id)).slice(0, 8),
    [pathIdSet],
  )

  const pathHeight = pathConcepts.length * 112 + 40

  return (
    <div className={s.page}>
      <Sidebar />

      <main className={s.main}>
        <header className={s.header}>
          <button type="button" className={s.back} onClick={() => navigate('/practice')}>
            ← Practice
          </button>
          <div className={s.headerRow}>
            <div>
              <span className={s.labBadge}>Lab</span>
              <h1 className={s.title}>Your Learning Path</h1>
              <p className={s.subtitle}>Master algebra step by step — MindCraft green layout experiment</p>
            </div>
            <button type="button" className={s.liveLink} onClick={() => navigate('/practice')}>
              Compare live path →
            </button>
          </div>
        </header>

        <div className={s.layout}>
          <section className={s.pathColumn}>
            <div className={s.pathStage} style={{ minHeight: `${pathHeight}px` }}>
              <svg
                className={s.pathSvg}
                viewBox={`0 0 520 ${pathHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="pathLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#54b948" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#c4f547" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                {pathConcepts.slice(0, -1).map((_, i) => {
                  const y1 = i * 112 + 56
                  const y2 = (i + 1) * 112 + 56
                  return (
                    <line
                      key={i}
                      x1="36"
                      y1={y1}
                      x2="36"
                      y2={y2}
                      stroke="url(#pathLineGrad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>

              {pathConcepts.map((concept, i) => (
                <article
                  key={concept.id}
                  className={`${s.chapterCard} ${i === 0 ? s.chapterCardActive : ''}`}
                  style={{ top: `${i * 112}px` }}
                >
                  <div className={s.nodeNum} aria-hidden="true">{i + 1}</div>
                  <div className={s.iconTile}>
                    <ConceptPathIcon conceptId={concept.id} size={36} />
                  </div>
                  <div className={s.chapterBody}>
                    <h2 className={s.chapterName}>{concept.label}</h2>
                    <p className={s.chapterMeta}>Practice · ~{EST_MINUTES[i] ?? 12} min</p>
                  </div>
                  <button
                    type="button"
                    className={s.chapterGo}
                    onClick={() => navigate('/practice', { state: { concept: concept.id } })}
                  >
                    →
                  </button>
                </article>
              ))}
            </div>
          </section>

          <aside className={s.sideColumn}>
            <div className={s.streakCard}>
              <div className={s.streakTop}>
                <span className={s.streakFire} aria-hidden="true">🔥</span>
                <div>
                  <p className={s.streakCount}>{streak || 0} day{streak === 1 ? '' : 's'}</p>
                  <p className={s.streakLabel}>Keep it up!</p>
                </div>
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
