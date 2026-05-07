#!/usr/bin/env node
import { GoogleGenerativeAI } from '@google/generative-ai'

const [conceptId, ...topicParts] = process.argv.slice(2)
const topic = topicParts.join(' ').trim()
const apiKey = process.env.GEMINI_API_KEY

if (!conceptId || !topic) {
  console.error('Usage: GEMINI_API_KEY=... node scripts/generateManimScene.mjs <conceptId> "<topic or misconception>"')
  process.exit(1)
}

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in environment.')
  process.exit(1)
}

const systemPrompt = `
You generate Manim Community Edition scenes for MindCraft math visual explanations.
Manim is the Python animation library created by 3Blue1Brown for math visuals.

Return Python code only. Do not use markdown fences.

Requirements:
- Use "from manim import *".
- Define exactly one Scene subclass named MindCraftVisual.
- Keep the scene under 90 lines.
- Make the visual educational, not decorative.
- Use coordinate axes, number lines, braces, arrows, labels, color, or transformations when helpful.
- Include 2-4 short MathTex/Text labels that explain the idea.
- Avoid external files, images, network calls, random generation, plugins, or custom fonts.
- The code must render with: manim -pql <file>.py MindCraftVisual
- Use original explanatory visuals, not copied lesson scripts.
- Target high-school ACT/SAT/IB math students who are anxious and need clarity fast.
`

const userPrompt = `
Concept ID: ${conceptId}
Topic or misconception: ${topic}

Create a Manim scene that helps a student understand this visually.
`

const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction: systemPrompt,
})

function cleanPython(text) {
  return text
    .trim()
    .replace(/^```(?:python)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
}

function validateScene(code) {
  if (!code.includes('from manim import *')) {
    throw new Error('Generated scene is missing "from manim import *".')
  }
  if (!/class\s+MindCraftVisual\s*\(\s*Scene\s*\)\s*:/.test(code)) {
    throw new Error('Generated scene must define class MindCraftVisual(Scene).')
  }
  const blocked = ['open(', 'requests.', 'urllib', 'subprocess', 'os.', 'sys.', 'ImageMobject(']
  const found = blocked.find(token => code.includes(token))
  if (found) {
    throw new Error(`Generated scene includes blocked token: ${found}`)
  }
}

try {
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
    },
  })

  const code = cleanPython(result.response.text())
  validateScene(code)
  console.log(code)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Manim scene generation failed.')
  process.exit(1)
}
