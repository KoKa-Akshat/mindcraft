import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}

function readRulesFile(name: 'firestore.rules' | 'storage.rules') {
  const candidates = [
    resolve(process.cwd(), 'firebase', name),
    resolve(process.cwd(), '../firebase', name),
  ]
  const rulesPath = candidates.find(existsSync)
  if (!rulesPath) {
    throw new Error(`Missing canonical ${name} file. Checked: ${candidates.join(', ')}`)
  }
  return readFileSync(rulesPath, 'utf8').trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')
  if (req.body?.secret !== process.env.ANTHROPIC_API_KEY?.slice(-8)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const app = getApps()[0]
    const credential = (app as any).options.credential
    const token = await credential.getAccessToken()
    const accessToken = token.access_token
    const projectId = 'mindcraft-93858'
    const firestoreRules = readRulesFile('firestore.rules')
    const storageRules = readRulesFile('storage.rules')

    // Deploy Firestore rules
    const fsRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { files: [{ name: 'firestore.rules', content: firestoreRules }] }
        }),
      }
    )
    const fsData = await fsRes.json()
    if (!fsRes.ok) return res.status(500).json({ error: 'Firestore ruleset failed', detail: fsData })
    const fsRulesetName = fsData.name

    // Release Firestore rules
    const fsReleaseRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: fsRulesetName } }),
      }
    )
    const fsReleaseData = await fsReleaseRes.json()

    // Deploy Storage rules
    const stRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { files: [{ name: 'storage.rules', content: storageRules }] }
        }),
      }
    )
    const stData = await stRes.json()
    if (!stRes.ok) return res.status(500).json({ error: 'Storage ruleset failed', detail: stData })
    const stRulesetName = stData.name

    const storageBucket = `${projectId}.firebasestorage.app`
    const storageReleaseName = `firebase.storage/${storageBucket}`

    // Try to patch existing release; if 404, create it
    let stReleaseRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${encodeURIComponent(storageReleaseName)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ release: { name: `projects/${projectId}/releases/${storageReleaseName}`, rulesetName: stRulesetName } }),
      }
    )
    if (stReleaseRes.status === 404) {
      stReleaseRes = await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `projects/${projectId}/releases/${storageReleaseName}`, rulesetName: stRulesetName }),
        }
      )
    }
    const stReleaseData = await stReleaseRes.json()

    return res.status(200).json({
      ok: true,
      firestoreRelease: fsReleaseData,
      storageRelease: stReleaseData,
    })
  } catch (err: any) {
    console.error('deploy-rules error:', err)
    return res.status(500).json({ error: err?.message })
  }
}
