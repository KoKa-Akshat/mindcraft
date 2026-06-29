#!/usr/bin/env node
/** Copy ml/data/generated_questions.json → app/src/data/generatedQuestions.json (Lane B / B4). */
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = resolve(__dirname, '../../ml/data/generated_questions.json')
const dest = resolve(__dirname, '../src/data/generatedQuestions.json')

await mkdir(dirname(dest), { recursive: true })
await copyFile(src, dest)
console.log(`synced ${src} → ${dest}`)
