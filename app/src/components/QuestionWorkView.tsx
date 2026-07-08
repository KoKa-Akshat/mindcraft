import { useNavigate } from 'react-router-dom'
import MathText from './MathText'
import EtchedQuestion from './book/EtchedQuestion'
import { getQuestionById } from '../lib/questionBank'
import type { StudentWorkEntry } from '../types'
import s from './QuestionWorkView.module.css'

function sourceLabel(source?: StudentWorkEntry['source']) {
  switch (source) {
    case 'chapter': return 'Chapter'
    case 'practice': return 'Practice'
    case 'session': return 'Session'
    default: return 'Work'
  }
}

function verdictLabel(verdict?: 'ok' | 'wrong' | 'unparsed') {
  if (verdict === 'ok') return 'Verified'
  if (verdict === 'wrong') return 'Needs repair'
  return 'Unparsed'
}

export default function QuestionWorkView({
  entry,
  showPrompt = true,
}: {
  entry: StudentWorkEntry
  showPrompt?: boolean
}) {
  const navigate = useNavigate()
  const question = entry.questionId ? getQuestionById(entry.questionId) : undefined
  const prompt = question?.question ?? entry.prompt

  return (
    <div className={s.panel}>
      <div className={s.meta}>
        <span className={s.metaChip}>{sourceLabel(entry.source)}</span>
        {entry.conceptId && (
          <span className={s.metaChip}>{entry.conceptId.replace(/_/g, ' ')}</span>
        )}
        <span className={s.metaChip}>{new Date(entry.updatedAt ?? entry.createdAt).toLocaleDateString()}</span>
      </div>

      {showPrompt && prompt && (
        question ? (
          <EtchedQuestion
            text={question.question}
            tag={`${question.examTag ?? sourceLabel(entry.source)} · L${question.level}`}
            compact
          />
        ) : (
          <p className={s.prompt}><MathText text={prompt} /></p>
        )
      )}

      {question && question.choices.length > 0 && (
        <div className={s.section}>
          <span className={s.sectionLabel}>Question choices</span>
          <div className={s.choices}>
            {question.choices.map((choice, i) => (
              <div
                key={i}
                className={`${s.choice} ${entry.selectedAnswerIndex === i ? s.choiceSelected : ''}`}
              >
                <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                <span className={s.choiceText}><MathText text={choice} /></span>
                {entry.selectedAnswerIndex === i && (
                  <span className={s.choiceMark}>your pick</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.scratchImage && (
        <div className={s.section}>
          <span className={s.sectionLabel}>Ink</span>
          <img src={entry.scratchImage} alt="Student work" className={s.scratch} />
        </div>
      )}

      {entry.scratchTranscription?.text && (
        <div className={s.section}>
          <span className={s.sectionLabel}>Transcription</span>
          <p className={s.transcription}>
            <MathText text={entry.scratchTranscription.text} />
          </p>
        </div>
      )}

      {entry.workLines && entry.workLines.length > 0 && (
        <div className={s.section}>
          <span className={s.sectionLabel}>Worked steps</span>
          <div className={s.steps}>
            {entry.workLines.map((line, index) => (
              <div key={`${entry.id}-${index}`} className={s.step}>
                <div className={s.stepNum}>{index + 1}</div>
                <div className={s.stepBody}>
                  <div className={s.stepTop}>
                    <span className={s.stepText}>
                      <MathText text={line.text || line.latex || '—'} />
                    </span>
                    <div className={s.stepChips}>
                      {line.rule?.label && (
                        <span className={s.ruleChip}>{line.rule.label}</span>
                      )}
                      <span className={`${s.stepChip} ${line.verdict === 'ok' ? s.ok : line.verdict === 'wrong' ? s.wrong : s.unparsed}`}>
                        {verdictLabel(line.verdict)}
                      </span>
                    </div>
                  </div>
                  {line.checkReason && (
                    <span className={s.reason}>{line.checkReason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.reasoningText && (
        <div className={s.section}>
          <span className={s.sectionLabel}>Student thinking</span>
          <p className={s.thinking}>{entry.reasoningText}</p>
        </div>
      )}

      {entry.conceptId && entry.questionId && (
        <button
          type="button"
          className={s.practiceAgain}
          onClick={() => navigate('/practice', { state: { conceptId: entry.conceptId } })}
        >
          Practice this again →
        </button>
      )}
    </div>
  )
}
