import { gemini } from './geminiProxy'
import type { HomeworkSession } from '../components/HomeworkCards'

const EXAM_STYLE: Record<string, string> = {
  ACT:     'ACT Math: 60 questions / 60 min — speed and pattern recognition. Use ACT phrasing ("which of the following"). Efficient algebraic methods, no proofs.',
  SAT:     'SAT Math: context-heavy, real-world setups, graphs, tables. Use SAT phrasing ("in the xy-plane", "based on the function above"). Moderate difficulty.',
  IB:      'IB Mathematics SL/HL: rigorous justification required. Use IB phrasing ("Show that…", "Hence find…"). Exact values (π, √2), multi-part problems.',
  AP:      'AP Calculus/Precalculus: college-level rigour. Use AP phrasing ("Let f be defined by…", "On the interval…"). Correct notation, domain/range conditions.',
  General: 'General high school math. Friendly, clear language. Step-by-step guidance.',
}

const SVG_KEYWORDS = ['linear', 'equation', 'quadratic', 'function', 'exponent', 'polynomial', 'system', 'rational', 'transform', 'inequality', 'graph']

export async function solveWithGemini(problemText: string, examType = 'General'): Promise<HomeworkSession> {
  const examStyle = EXAM_STYLE[examType] ?? EXAM_STYLE.General
  const wantSVG   = SVG_KEYWORDS.some(k => problemText.toLowerCase().includes(k))

  const svgInstruction = wantSVG
    ? `On card 3 (hint) set "visual_type":"svg","is_visual_step":true. Generate a compact inline SVG (viewBox="0 0 280 130") illustrating the key concept — axes, a curve/line, labelled key points. Light colours on transparent bg (stroke="#C4F547", text fill="#F0F7F4"). Self-contained, no external refs.`
    : `All cards: "visual_type":"none","visual_data":""`

  const prompt = `You are Craft — a sharp math tutor for ${examType} students.

EXAM STYLE: ${examStyle}

PROBLEM: """${problemText}"""

Create a thorough 6-card Socratic tutoring session. NEVER reveal the final answer — guide discovery at every step.
${svgInstruction}

CARD SEQUENCE (exactly in this order):
1. "question"     — Open with what the student needs to notice. What type of problem is this? What information is given? 1-2 sharp sentences.
2. "hint"         — Name the exact concept/formula needed and WHY it applies here. Include the key formula or rule if relevant. 2-3 sentences.
3. "hint"         — Walk through step 1 of the solution approach without giving the answer. Ask the student to try this step. 2 sentences. ${wantSVG ? '(include the SVG on this card)' : ''}
4. "reframe"      — Offer a simpler related example that uses the same technique, then bridge back to this problem. 2-3 sentences ${examType} style.
5. "question"     — Ask: "What did you get?" Prompt the student to verify their answer makes sense (units, sign, magnitude, plugging back in). 2 sentences.
6. "encouragement" — One powerful insight sentence. Tell them what mastery of this looks like on real ${examType} exams. Motivating close.

Return ONLY valid JSON:
{
  "session_id":"gm-${Date.now()}",
  "problem_summary":"<12 words max describing the problem>",
  "target_concept":"<core concept e.g. Quadratic Formula>",
  "path_framing":"<6-word ${examType} flavoured study framing>",
  "paths_explored":4,
  "cards":[
    {"step_number":1,"total_steps":6,"type":"question","concept_chip":"<concept>","content":"<card 1 content>","visual_type":"none","visual_data":"","is_visual_step":false},
    {"step_number":2,"total_steps":6,"type":"hint","concept_chip":"<concept>","content":"<card 2 content>","visual_type":"none","visual_data":"","is_visual_step":false},
    {"step_number":3,"total_steps":6,"type":"hint","concept_chip":"<concept>","content":"<card 3 content>","visual_type":"${wantSVG ? 'svg' : 'none'}","visual_data":"${wantSVG ? 'GENERATE_SVG_HERE' : ''}","is_visual_step":${wantSVG}},
    {"step_number":4,"total_steps":6,"type":"reframe","concept_chip":"<concept>","content":"<card 4 content>","visual_type":"none","visual_data":"","is_visual_step":false},
    {"step_number":5,"total_steps":6,"type":"question","concept_chip":"<concept>","content":"<card 5 content>","visual_type":"none","visual_data":"","is_visual_step":false},
    {"step_number":6,"total_steps":6,"type":"encouragement","concept_chip":"<concept>","content":"<card 6 content>","visual_type":"none","visual_data":"","is_visual_step":false}
  ]
}
Rules: never give the numeric answer, each card max 70 words, return ONLY the JSON.`

  const raw   = await gemini(prompt)
  const match = raw.trim().match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Unexpected response from AI')

  const parsed = JSON.parse(match[0]) as HomeworkSession
  parsed.cards = parsed.cards.map(card => ({
    ...card,
    visual_data:    card.visual_type === 'svg' && card.visual_data && !card.visual_data.includes('GENERATE') ? card.visual_data : '',
    is_visual_step: card.visual_type === 'svg' && !!card.visual_data && !card.visual_data.includes('GENERATE'),
  }))
  return parsed
}

export async function clueWithGemini(stepContent: string, concept: string, clueNumber: number, examType = 'General'): Promise<string> {
  const prompt = `A ${examType} student is stuck on this math tutoring step about ${concept}:
"${stepContent}"
Give clue #${clueNumber}. One sentence, max 22 words. Specific, concrete, ${examType} vocabulary. Move them forward without giving the answer. Return only the clue sentence.`

  const text = await gemini(prompt)
  return text.trim().replace(/^["']|["']$/g, '')
}
