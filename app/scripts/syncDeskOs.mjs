/**
 * Copy Desk OS prototype into app/public/desk-os for Vite + Firebase Hosting.
 * Source of truth stays agent_work/product/desk_os/ — do not edit the copy.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = join(here, '..')
const src = join(appRoot, '..', 'agent_work', 'product', 'desk_os')
const dest = join(appRoot, 'public', 'desk-os')

if (!existsSync(src)) {
  console.error(`syncDeskOs: missing source ${src}`)
  process.exit(1)
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(join(appRoot, 'public'), { recursive: true })
cpSync(src, dest, {
  recursive: true,
  filter: (path) => {
    const base = path.split(/[/\\]/).pop() || ''
    if (base === 'node_modules' || base === '.DS_Store') return false
    if (base === 'tests') return false
    // Internal planning docs, not part of the product, no reason to ship
    // to production (found shipping there in a repo cleanup audit).
    if (base.endsWith('.md')) return false
    return true
  },
})

console.log(`syncDeskOs: ${src} → ${dest}`)
