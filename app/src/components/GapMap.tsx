import type { Gap } from '../pages/Prep'
import s from './GapMap.module.css'

const EXAM_LABEL: Record<string, string> = {
  SAT_MATH:   'SAT Math',
  ACT_MATH:   'ACT Math',
  IB_MATH_AA: 'IB Math AA',
  IB_MATH_AI: 'IB Math AI',
  AP_CALC_AB: 'AP Calc AB',
}

interface Props {
  gaps:            Gap[]
  examType:        string
  sessionId:       string
  studentId:       string
  mode?:           'triage' | 'foundation'
  onStartPractice: (idx: number) => void
}

export default function GapMap({ gaps, examType, mode = 'foundation', onStartPractice }: Props) {
  const critical = gaps.filter(g => g.urgency === 'critical')
  const moderate = gaps.filter(g => g.urgency === 'moderate')
  const stable   = gaps.filter(g => g.urgency === 'stable')

  return (
    <div className={s.shell}>
      <div className={s.inner}>

        <div className={s.brand}>Mind<span>Craft</span></div>

        <div className={s.header}>
          <div>
            <p className={s.exam}>{EXAM_LABEL[examType] ?? examType}</p>
            <h1 className={s.headline}>Here's your fault map.</h1>
            <p className={s.sub}>
              {critical.length > 0 && (
                <>The root break is at <strong>{critical[0].brokenPrerequisite || critical[0].conceptName}</strong>. Fix that and the rest starts to open.</>
              )}
              {critical.length === 0 && gaps.length > 0 && (
                <>You're closer than you think. {moderate.length} concepts still forming, {stable.length} stabilizing.</>
              )}
            </p>
          </div>
          {mode === 'triage' && (
            <div className={s.triageBadge}>🚨 Triage</div>
          )}
        </div>

        {critical.length > 0 && (
          <FaultSection label="Needs repair" urgency="critical" gaps={critical} allGaps={gaps} onStart={onStartPractice} />
        )}
        {moderate.length > 0 && (
          <FaultSection label="Still forming" urgency="moderate" gaps={moderate} allGaps={gaps} onStart={onStartPractice} />
        )}
        {stable.length > 0 && (
          <FaultSection label="Stabilizing" urgency="stable" gaps={stable} allGaps={gaps} onStart={onStartPractice} />
        )}

        <p className={s.footNote}>
          Gap map updates as you practice. Each concept you close makes the next one easier.
        </p>
      </div>
    </div>
  )
}

function FaultSection({
  label, urgency, gaps, allGaps, onStart,
}: {
  label:   string
  urgency: Gap['urgency']
  gaps:    Gap[]
  allGaps: Gap[]
  onStart: (idx: number) => void
}) {
  return (
    <div className={s.section}>
      <div className={`${s.sectionLabel} ${s[`label_${urgency}`]}`}>{label}</div>
      <div className={s.trees}>
        {gaps.map(gap => {
          const idx = allGaps.indexOf(gap)
          return <FaultTree key={gap.conceptId} gap={gap} onStart={() => onStart(idx)} />
        })}
      </div>
    </div>
  )
}

function FaultTree({ gap, onStart }: { gap: Gap; onStart: () => void }) {
  const pct      = Math.round(gap.studentScore * 100)
  const barColor = gap.urgency === 'critical' ? '#FF5C5C' : gap.urgency === 'moderate' ? '#F5A623' : '#58CC02'
  const hasSplit = gap.brokenPrerequisite || gap.bridgeConcept

  return (
    <div className={`${s.tree} ${s[`tree_${gap.urgency}`]}`}>

      {/* Crash site — the concept itself */}
      <div className={s.crashNode}>
        <div className={s.crashMeta}>
          <span className={s.crashLabel}>crash site</span>
          <span className={s.crashWeight}>{gap.examWeight}% of exam</span>
        </div>
        <div className={s.crashName}>{gap.conceptName}</div>
        <div className={s.masterBar}>
          <div className={s.masterFill} style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <div className={s.masterLabel}>
          {pct}% mastery &mdash; {gap.urgency === 'stable' ? 'Stabilizing' : gap.urgency === 'moderate' ? 'Still forming' : 'Needs repair'}
        </div>
      </div>

      {/* Fault split — bridge vs broken prerequisite */}
      {hasSplit && (
        <div className={s.split}>
          <div className={s.splitLine} />
          <div className={s.splitBranches}>

            {gap.bridgeConcept && (
              <div className={s.branch}>
                <div className={s.connector} />
                <div className={`${s.node} ${s.nodeSolid}`}>
                  <div className={s.nodeTag}>foundation holds</div>
                  <div className={s.nodeName}>{gap.bridgeConcept}</div>
                </div>
              </div>
            )}

            {gap.brokenPrerequisite && (
              <div className={s.branch}>
                <div className={s.connector} />
                <div className={`${s.node} ${s.nodeBroken}`}>
                  <div className={s.nodeTag}>root break</div>
                  <div className={s.nodeName}>{gap.brokenPrerequisite}</div>
                </div>
              </div>
            )}

          </div>

          {gap.brokenPrerequisite && gap.bridgeConcept && (
            <p className={s.insight}>
              Your <em>{gap.bridgeConcept}</em> is solid.
              The break is only at <em>{gap.brokenPrerequisite}</em>.
              Fix that one gear and {gap.conceptName} unlocks.
            </p>
          )}
        </div>
      )}

      <button className={`${s.practiceBtn} ${s[`practiceBtn_${gap.urgency}`]}`} onClick={onStart} type="button">
        Work on this gap &rarr;
      </button>
      <div className={s.qCount}>{gap.practiceCount} practice problems</div>
    </div>
  )
}
