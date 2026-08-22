import { createHash } from 'node:crypto'
import { db } from './firebase'
import { googleSearch, type SearchResult, type SourceKind } from './googleSearch'

interface ResearchInsight {
  painPoints: string[]
  examSignals: string[]
  conceptSignals: string[]
  studentLanguage: string[]
  productIdeas: string[]
  safetyNotes: string[]
}

interface ResearchBatch {
  id: string
  createdAt: string
  query: string
  sourceKinds: SourceKind[]
  sourceCount: number
  sources: {
    title: string
    url: string
    host: string
    kind: SourceKind
    snippetPreview: string
  }[]
  insights: ResearchInsight
}

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''

const RESEARCH_QUERIES = [
  'ACT math students panic before exam what topics are hardest',
  'SAT math prep what am I missing algebra gaps students',
  'IB math exam revision hardest concepts students struggle',
  'math tutor students common algebra misconceptions exam prep',
  'site:reddit.com ACT math study what topics are hardest',
  'site:reddit.com SAT math prep algebra gaps',
  'site:quora.com ACT math prep hardest questions',
  'site:quora.com SAT math students struggle with algebra',
]

function stableId(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24)
}

async function summarizeSignals(query: string, sources: SearchResult[]): Promise<ResearchInsight> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY must be configured.')
  }

  const response = await fetch(`${GEMINI_API}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.35,
      },
      contents: [{
        role: 'user',
        parts: [{
          text: `You are MindCraft's safe market-research analyst.

Use only the search titles, URLs, hosts, and short snippets below. Do not invent quotes. Do not include personal data.
Extract patterns useful for an ACT/SAT/IB math exam-prep product.

Return valid JSON:
{
  "painPoints": string[],
  "examSignals": string[],
  "conceptSignals": string[],
  "studentLanguage": string[],
  "productIdeas": string[],
  "safetyNotes": string[]
}

Rules:
- Summarize patterns, not individual users.
- Do not reproduce long source text.
- Keep each bullet under 140 characters.
- Include a safety note if the evidence is weak, anecdotal, or from forums.

Query: ${query}
Sources:
${sources.map((source, index) => `${index + 1}. ${source.title}
Host: ${source.displayLink}
URL: ${source.url}
Snippet: ${source.snippet}`).join('\n\n')}`,
        }],
      }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Gemini summarize failed: ${response.status}`)
  }

  const data = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const parsed = JSON.parse(text) as Partial<ResearchInsight>

  return {
    painPoints: parsed.painPoints ?? [],
    examSignals: parsed.examSignals ?? [],
    conceptSignals: parsed.conceptSignals ?? [],
    studentLanguage: parsed.studentLanguage ?? [],
    productIdeas: parsed.productIdeas ?? [],
    safetyNotes: parsed.safetyNotes ?? [],
  }
}

export async function runResearchAgent(): Promise<ResearchBatch> {
  const cursorDoc = await db.collection('agentState').doc('researchAgent').get()
  const cursor = Number(cursorDoc.data()?.cursor ?? 0)
  const query = RESEARCH_QUERIES[cursor % RESEARCH_QUERIES.length]

  const sources = await googleSearch(query)
  const uniqueSources = [...new Map(sources.map(source => [source.url, source])).values()]
  const insights = await summarizeSignals(query, uniqueSources)

  const createdAt = new Date().toISOString()
  const batch: ResearchBatch = {
    id: stableId(`${query}:${createdAt}`),
    createdAt,
    query,
    sourceKinds: [...new Set(uniqueSources.map(source => source.kind))],
    sourceCount: uniqueSources.length,
    sources: uniqueSources.map(source => ({
      title: source.title,
      url: source.url,
      host: source.displayLink,
      kind: source.kind,
      snippetPreview: source.snippet,
    })),
    insights,
  }

  await db.collection('researchBatches').doc(batch.id).set(batch)
  await db.collection('agentState').doc('researchAgent').set({
    cursor: cursor + 1,
    updatedAt: createdAt,
    lastBatchId: batch.id,
  }, { merge: true })

  return batch
}
