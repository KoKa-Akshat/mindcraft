import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? ''

export interface IntakeResult {
  recommendedConceptIds: string[]
  message: string
  examFocus: string
}

const EXAM_CONCEPT_DEFAULTS: Record<string, string[]> = {
  ACT:     ['linear_equations', 'quadratic_equations', 'systems_of_linear_equations', 'functions_basics'],
  SAT:     ['linear_equations', 'quadratic_equations', 'linear_inequalities', 'functions_basics'],
  IB:      ['quadratic_equations', 'functions_basics', 'rational_expressions', 'basic_probability'],
  AP:      ['functions_basics', 'quadratic_equations', 'polynomials', 'rational_expressions'],
  General: ['linear_equations', 'quadratic_equations', 'functions_basics', 'exponent_rules'],
}

export async function getConceptRecommendations(
  exam: string,
  topic: string,
  availableConceptIds: string[],
): Promise<IntakeResult> {
  if (!API_KEY) {
    return {
      recommendedConceptIds: EXAM_CONCEPT_DEFAULTS[exam] ?? availableConceptIds.slice(0, 4),
      message: `Here are the highest-yield ${exam} concepts. Start with whichever feels weakest!`,
      examFocus: exam,
    }
  }

  const genAI = new GoogleGenerativeAI(API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are a math tutor helping a student prep for the ${exam} exam.
Student said: "${topic || 'I want to improve my math score'}"

Available concept IDs: ${availableConceptIds.join(', ')}

Return ONLY valid JSON — nothing else — with exactly these fields:
{
  "recommendedConceptIds": [3 to 4 concept IDs from the list most relevant to this student's exam + topic],
  "message": "1-2 sentences: personalized encouragement explaining why these concepts will most improve their score"
}
Focus on the highest-yield concepts for ${exam}. If the student mentioned a specific topic, prioritize it.`

  try {
    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as { recommendedConceptIds: string[]; message: string }

    const validIds = (parsed.recommendedConceptIds ?? []).filter(id =>
      availableConceptIds.includes(id)
    )

    return {
      recommendedConceptIds: validIds.length >= 2 ? validIds : (EXAM_CONCEPT_DEFAULTS[exam] ?? availableConceptIds.slice(0, 4)),
      message: parsed.message ?? '',
      examFocus: exam,
    }
  } catch {
    return {
      recommendedConceptIds: EXAM_CONCEPT_DEFAULTS[exam] ?? availableConceptIds.slice(0, 4),
      message: `Here are the most important ${exam} concepts. Let's build your confidence before the exam!`,
      examFocus: exam,
    }
  }
}
