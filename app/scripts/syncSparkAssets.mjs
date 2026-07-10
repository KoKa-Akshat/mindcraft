#!/usr/bin/env node
/**
 * syncSparkAssets.mjs — copy First Spark canonicals to their deploy targets.
 *
 * Canonical (edit here):        app/public/demo/v2/spark-bank.json
 *                               app/public/demo/v2/spark-engine.mjs
 * Copies (never edit directly): spark/spark-bank.json      (marketing overlay)
 *                               spark/spark-engine.mjs     (marketing overlay)
 *                               webhook/data/spark-bank.json (spark-experience API)
 *
 * Run after any bank/engine change: node app/scripts/syncSparkAssets.mjs
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pairs = [
  ['app/public/demo/v2/spark-bank.json', 'spark/spark-bank.json'],
  ['app/public/demo/v2/spark-engine.mjs', 'spark/spark-engine.mjs'],
  ['app/public/demo/v2/spark-bank.json', 'webhook/data/spark-bank.json'],
]

for (const [src, dst] of pairs) {
  mkdirSync(join(root, dirname(dst)), { recursive: true })
  copyFileSync(join(root, src), join(root, dst))
  console.log(`synced ${src} → ${dst}`)
}
