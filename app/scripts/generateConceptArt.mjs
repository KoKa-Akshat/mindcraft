#!/usr/bin/env node
/**
 * generateConceptArt.mjs — concept-accurate story art pipeline.
 *
 * Generates ONE illustration per concept, using that concept's own LOCKED
 * chapter identity (protagonist + setting, from questionContextFrames.json /
 * conceptStories.json — the same data ConceptChapterPage.tsx and
 * storyMatch.ts already use), so the art matches the story a student
 * actually reads for that concept instead of a shared generic photo.
 *
 * Output: app/src/assets/canvas/generated/story-{conceptId}.jpg (800x800,
 * JPEG q85). storyArt.ts auto-discovers anything dropped here via
 * import.meta.glob — no code edit needed after a run.
 *
 * Requires the Higgsfield CLI (`higgsfield`) authenticated, and python3 with
 * Pillow (`pip install pillow`) for the resize/compress step.
 *
 * Usage:
 *   node app/scripts/generateConceptArt.mjs --list                 # show queue + priority order, no spend
 *   node app/scripts/generateConceptArt.mjs --dry-run fractions_decimals
 *   node app/scripts/generateConceptArt.mjs fractions_decimals      # spend 1 credit, generate + wire in
 *   node app/scripts/generateConceptArt.mjs --top 5                 # generate the 5 highest actFrequency concepts still on fallback
 *   node app/scripts/generateConceptArt.mjs --force fractions_decimals   # regenerate even if already done
 *
 * Each run appends a row to app/scripts/conceptArtManifest.json (concept,
 * protagonist, prompt, model, cost, timestamp, output path) so reruns never
 * double-spend on a concept that's already covered, and so spend is
 * auditable across sessions.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(__dirname, '..')
const GENERATED_DIR = resolve(APP_ROOT, 'src/assets/canvas/generated')
const MANIFEST_PATH = resolve(__dirname, 'conceptArtManifest.json')

const FRAMES = JSON.parse(await readFile(resolve(APP_ROOT, 'src/data/questionContextFrames.json'), 'utf8'))
const STORIES = JSON.parse(await readFile(resolve(APP_ROOT, 'src/data/conceptStories.json'), 'utf8'))
const COVERAGE = JSON.parse(await readFile(resolve(APP_ROOT, 'src/data/actOntologyCoverage.json'), 'utf8'))

// Fixed style formula, appended byte-identical to every prompt so the whole
// app reads as one continuous illustrated world. Distinct from Manjushree's
// Himalayan-game formula (different feature, different setting) but same
// warm painterly cartoon-illustrated quality bar Akshat responded well to.
const STYLE_FORMULA =
  'warm painterly storybook illustration style, soft cel-shaded rendering ' +
  'with clean confident linework, gentle golden-hour lighting, rich warm ' +
  'color palette of amber, cream, and deep blue, cozy academic notebook ' +
  'atmosphere, illustrated like a premium educational storybook app, ' +
  'inviting and studious mood, clean readable composition, single ' +
  'character as the focal point, no text or letters in the image, no ' +
  'watermark, no UI elements'

const MODEL = 'seedream_v5_lite'
const ASPECT = '1:1'
const QUALITY = 'high'
const OUT_SIZE = 800
const JPEG_QUALITY = 85

function actTestedConceptIds() {
  const tiers = COVERAGE.levelTiers
  return [...tiers.foundational.conceptIds, ...tiers.core.conceptIds]
}

function firstSentence(text, maxLen = 260) {
  const clean = (text ?? '').replace(/\n/g, ' ').trim()
  const m = clean.match(/[^.!?]+[.!?]/)
  const s = (m ? m[0] : clean).trim()
  return s.length > maxLen ? s.slice(0, maxLen).trim() : s
}

function buildPrompt(conceptId) {
  const frame = FRAMES[conceptId]
  const story = STORIES[conceptId]
  if (!frame && !story) return null
  const protagonist = frame?.protagonist ?? story?.conceptName ?? conceptId
  const setting = frame?.settingLine ?? ''
  const scene = story?.story ? firstSentence(story.story) : ''
  const conceptName = story?.conceptName ?? conceptId

  const sceneNoPeriod = scene.replace(/[.!?]+$/, '')
  const parts = [
    `Storybook illustration of ${protagonist}`,
    setting ? `in ${setting}` : '',
    sceneNoPeriod ? `depicting the moment when ${sceneNoPeriod}` : '',
    `the scene should visually evoke the math concept "${conceptName}" through props and setting, not text or symbols`,
    STYLE_FORMULA,
  ].filter(Boolean)
  return parts.join(', ')
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  } catch {
    return { generations: [] }
  }
}

async function saveManifest(manifest) {
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
}

async function alreadyGenerated(conceptId) {
  try {
    await access(resolve(GENERATED_DIR, `story-${conceptId}.jpg`))
    return true
  } catch {
    return false
  }
}

function priorityQueue() {
  const byConcept = COVERAGE.byConceptId
  return actTestedConceptIds()
    .map(id => ({ id, actFrequency: byConcept[id]?.actFrequency ?? 0, name: byConcept[id]?.name ?? id }))
    .sort((a, b) => b.actFrequency - a.actFrequency)
}

async function listQueue() {
  const queue = priorityQueue()
  console.log('ACT-tested concepts, priority order (by actFrequency), * = already has generated art:\n')
  for (const c of queue) {
    const done = await alreadyGenerated(c.id)
    console.log(`${done ? '*' : ' '} ${c.actFrequency.toFixed(2)}  ${c.id.padEnd(30)} ${c.name}`)
  }
}

async function higgsfieldGenerate(prompt) {
  const args = [
    'generate', 'create', MODEL,
    '--prompt', prompt,
    '--aspect_ratio', ASPECT,
    '--quality', QUALITY,
    '--wait', '--wait-timeout', '5m',
    '--json',
  ]
  const { stdout } = await run('higgsfield', args, { maxBuffer: 1024 * 1024 * 10 })
  const data = JSON.parse(stdout)
  // Result shape varies slightly by CLI version; probe common locations.
  // Confirmed shape (2026-07): `higgsfield generate create ... --wait --json`
  // returns an ARRAY of job objects, each with a top-level `result_url`
  // (full-res) and `min_result_url` (preview webp).
  const job = Array.isArray(data) ? data[0] : data
  const url =
    job?.result_url ??
    job?.result?.[0]?.url ??
    job?.outputs?.[0]?.url ??
    job?.output_url ??
    job?.url ??
    job?.results?.[0]?.url ??
    job?.min_result_url
  if (!url) throw new Error('Could not find output URL in higgsfield response: ' + stdout.slice(0, 2000))
  return { url, raw: job }
}

async function downloadAndResize(url, conceptId) {
  await mkdir(GENERATED_DIR, { recursive: true })
  const tmpPath = resolve(GENERATED_DIR, `.tmp-${conceptId}`)
  const outPath = resolve(GENERATED_DIR, `story-${conceptId}.jpg`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(tmpPath, buf)

  // Resize/compress with Pillow to match the existing 800x800 JPEG q85 plates.
  const py = `
from PIL import Image
im = Image.open("${tmpPath}").convert("RGB")
w, h = im.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
im = im.crop((left, top, left + side, top + side)).resize((${OUT_SIZE}, ${OUT_SIZE}), Image.LANCZOS)
im.save("${outPath}", "JPEG", quality=${JPEG_QUALITY})
`
  await run('python3', ['-c', py])
  await run('rm', ['-f', tmpPath])
  return outPath
}

async function generateOne(conceptId, { dryRun = false, force = false } = {}) {
  const prompt = buildPrompt(conceptId)
  if (!prompt) {
    console.log(`SKIP ${conceptId}: no locked protagonist/story found in questionContextFrames.json or conceptStories.json`)
    return null
  }
  if (!force && await alreadyGenerated(conceptId)) {
    console.log(`SKIP ${conceptId}: already has generated art (use --force to regenerate)`)
    return null
  }
  console.log(`\n=== ${conceptId} ===`)
  console.log(prompt)
  if (dryRun) return { conceptId, prompt, dryRun: true }

  const cost = await run('higgsfield', ['generate', 'cost', MODEL, '--prompt', prompt, '--aspect_ratio', ASPECT, '--quality', QUALITY, '--json'])
    .then(r => r.stdout.trim()).catch(() => 'unknown')
  console.log(`Estimated cost: ${cost}`)

  const { url } = await higgsfieldGenerate(prompt)
  const outPath = await downloadAndResize(url, conceptId)
  console.log(`Saved ${outPath}`)

  const manifest = await loadManifest()
  manifest.generations.push({
    conceptId,
    protagonist: FRAMES[conceptId]?.protagonist ?? null,
    setting: FRAMES[conceptId]?.settingLine ?? null,
    prompt,
    model: MODEL,
    aspect: ASPECT,
    quality: QUALITY,
    sourceUrl: url,
    outputPath: `src/assets/canvas/generated/story-${conceptId}.jpg`,
    generatedAt: new Date().toISOString(),
  })
  await saveManifest(manifest)
  return { conceptId, prompt, outPath }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const list = args.includes('--list')
  const topIdx = args.indexOf('--top')
  const positional = args.filter((a, i) =>
    !a.startsWith('--') && args[i - 1] !== '--top',
  )

  if (list) {
    await listQueue()
    return
  }

  let targets = positional
  if (topIdx !== -1) {
    const n = parseInt(args[topIdx + 1], 10) || 5
    const queue = priorityQueue()
    const remaining = []
    for (const c of queue) {
      if (force || !(await alreadyGenerated(c.id))) remaining.push(c.id)
      if (remaining.length >= n) break
    }
    targets = remaining
  }

  if (targets.length === 0) {
    console.log('No concept ids given. Use --list to see the queue, or pass concept ids / --top N.')
    return
  }

  for (const conceptId of targets) {
    await generateOne(conceptId, { dryRun, force })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
