import MathText from '../../components/MathText'
import type { HomeworkQuestion } from '../../types'
import type { IngredientRecommendResult, PracticeCard } from '../../lib/mlApi'
import { CARD, Eyebrow, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT, cleanDashes, type QuestionSimState } from './shared'

export interface QuestionHelpCardProps {
  selectedQuestion: HomeworkQuestion
  onClose: () => void
  visibleHintCards: PracticeCard[]
  speakingIdx: number | null
  onSpeakHint: (text: string, idx: number) => void
  voiceFailed: boolean
  qHintsLoading: boolean
  qHintsTried: boolean
  onFetchFirstHint: () => void
  moreHintsAvailable: boolean
  hintsShown: number
  qHints: IngredientRecommendResult | null
  onShowNextHint: () => void
  questionSim: QuestionSimState | undefined
  onGenerateSim: () => void
}

/** "Help with question N": hint path + this question's own sim, if any.
 * Purely presentational, all of hint-fetching, TTS, and per-question sim
 * resolution/generation live in Learn.tsx. */
export default function QuestionHelpCard({
  selectedQuestion, onClose, visibleHintCards, speakingIdx, onSpeakHint, voiceFailed,
  qHintsLoading, qHintsTried, onFetchFirstHint, moreHintsAvailable, hintsShown, qHints,
  onShowNextHint, questionSim, onGenerateSim,
}: QuestionHelpCardProps) {
  return (
    <div id="lrn-q-intel" style={{ ...CARD, border: '1px solid rgba(94,200,240,0.35)', padding: '16px 18px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Eyebrow color="#5EC8F0">Help with {selectedQuestion.number ? `question ${selectedQuestion.number}` : 'this question'}</Eyebrow>
        <button
          onClick={onClose}
          style={{ marginLeft: 'auto', fontSize: 11.5, padding: '3px 10px', borderRadius: 7, border: '1px solid rgba(205,215,238,0.22)', background: 'transparent', color: TEXT_FAINT, cursor: 'pointer' }}
        >
          close
        </button>
      </div>
      <div style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: TEXT_PRIMARY }}>
        <MathText text={selectedQuestion.text} />
      </div>
      {selectedQuestion.figureNote && (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: TEXT_FAINT, lineHeight: 1.5 }}>The sheet shows: {selectedQuestion.figureNote}</p>
      )}
      <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: 'rgba(94,200,240,0.75)' }}>
        Hints come one at a time, and never include the final answer. Doing the step yourself is what makes it stick.
      </p>

      {visibleHintCards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {visibleHintCards.map((card, i) => (
            <div key={card.cardTemplateId + i} style={{ border: '1px solid rgba(94,200,240,0.25)', background: 'rgba(94,200,240,0.07)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#5EC8F0', letterSpacing: 0.6 }}>HINT {i + 1}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{cleanDashes(card.title)}</span>
                <button
                  onClick={() => onSpeakHint(cleanDashes(`${card.title}. ${card.body}`), i)}
                  disabled={speakingIdx !== null}
                  title="Hear this hint in Jesse's voice"
                  style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 9px', borderRadius: 7, border: '1px solid rgba(94,200,240,0.35)', background: 'transparent', color: speakingIdx === i ? '#5EC8F0' : 'rgba(94,200,240,0.8)', cursor: speakingIdx !== null ? 'default' : 'pointer', flexShrink: 0 }}
                >
                  {speakingIdx === i ? 'playing...' : 'hear it'}
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6, color: TEXT_SOFT }}>
                <MathText text={cleanDashes(card.body)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {voiceFailed && (
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: TEXT_FAINT }}>Voice is not available right now. The hint still stands in text.</p>
      )}

      <div style={{ marginTop: 12 }}>
        {qHintsLoading ? (
          <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(94,200,240,0.8)' }}>Building your hint path...</p>
        ) : !qHintsTried ? (
          <button
            onClick={onFetchFirstHint}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9, border: 'none', background: '#5EC8F0', color: '#062331', cursor: 'pointer' }}
          >
            Show me a first hint
          </button>
        ) : moreHintsAvailable ? (
          <button
            onClick={onShowNextHint}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(94,200,240,0.45)', background: 'transparent', color: '#5EC8F0', cursor: 'pointer' }}
          >
            Still stuck? Next hint ({hintsShown} of {qHints?.cards.length ?? 0} shown)
          </button>
        ) : visibleHintCards.length > 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: TEXT_FAINT, lineHeight: 1.55 }}>
            That is every hint on this path. From here, working it on paper beats another hint. The check question below is a good next stop.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: TEXT_FAINT, lineHeight: 1.55 }}>
            No hint path for this one yet. That is an honest gap, not a loading error. Reading the chapter here and trying the check question is the real next step.
          </p>
        )}
      </div>

      {questionSim && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(94,200,240,0.2)' }}>
          {questionSim.status === 'loading' ? (
            <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(94,200,240,0.75)' }}>Checking for a sim on this...</p>
          ) : questionSim.status === 'ready' && questionSim.sim ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#58CC02', letterSpacing: 0.6 }}>SIM</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{questionSim.sim.title}</span>
              </div>
              <iframe title="question-sim" srcDoc={questionSim.sim.html} style={{ width: '100%', height: 280, border: '1px solid rgba(205,215,238,0.15)', borderRadius: 12, background: 'white' }} sandbox="allow-scripts" />
            </>
          ) : questionSim.generatedSim ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', letterSpacing: 0.6 }}>AI GENERATED</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{questionSim.generatedSim.title}</span>
              </div>
              <iframe title="question-sim-generated" srcDoc={questionSim.generatedSim.html} style={{ width: '100%', height: 280, border: '1px solid rgba(205,215,238,0.15)', borderRadius: 12, background: 'white' }} sandbox="allow-scripts" />
            </>
          ) : questionSim.generating ? (
            <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(167,139,250,0.85)' }}>{questionSim.genStatus || 'Starting...'}</p>
          ) : questionSim.status === 'none' && questionSim.conceptLabel ? (
            <>
              <button
                onClick={onGenerateSim}
                style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(167,139,250,0.45)', background: 'transparent', color: '#A78BFA', cursor: 'pointer' }}
              >
                Generate a sim for this
              </button>
              {questionSim.genFailed && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#FF7B7B' }}>{questionSim.genFailed}</p>}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
