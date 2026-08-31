// THROWAWAY dev preview route — renders ColdCheckPrompt with a hardcoded
// sample question so it can be tried without a full auth + ML backend round
// trip. Delete this file and its route in App.tsx when done poking at it.
import { useState } from 'react'
import ColdCheckPrompt from '../components/ColdCheckPrompt'
import type { Question } from '../lib/questionBank'

const SAMPLE_QUESTION: Question = {
  id: 'dev-preview-1',
  conceptId: 'linear_equations',
  level: 1,
  question: 'Solve for x: 3x + 5 = 20',
  choices: ['x = 3', 'x = 5', 'x = 15', 'x = 25'],
  correctIndex: 1,
  explanation: 'Subtract 5 from both sides: 3x = 15. Divide by 3: x = 5.',
  hints: [],
}

export default function DevColdCheckPreview() {
  const [resultLog, setResultLog] = useState<string>('')
  const [key, setKey] = useState(0)

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: 24, background: '#0A0A0F', minHeight: '100vh', color: 'white', fontFamily: 'system-ui' }}>
      <h2 style={{ fontSize: 18, marginBottom: 20 }}>ColdCheckPrompt — dev preview</h2>
      <ColdCheckPrompt
        key={key}
        question={SAMPLE_QUESTION}
        onResult={({ correct, selectedIndex }) => {
          setResultLog(`onResult fired: correct=${correct}, selectedIndex=${selectedIndex}`)
        }}
      />
      {resultLog && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontSize: 13 }}>
          {resultLog}
          <button onClick={() => { setKey(k => k + 1); setResultLog('') }} style={{ marginLeft: 12, cursor: 'pointer' }}>
            reset
          </button>
        </div>
      )}
    </div>
  )
}
