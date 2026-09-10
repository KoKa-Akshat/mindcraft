import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runResearchAgent } from '../lib/researchAgent'

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET ?? ''
  if (!secret) return true

  const authHeader = req.headers.authorization ?? ''
  const tokenHeader = req.headers['x-research-agent-token']
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader

  return authHeader === `Bearer ${secret}` || token === secret
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'POST'].includes(req.method ?? '')) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const batch = await runResearchAgent()
    return res.status(200).json({
      ok: true,
      batchId: batch.id,
      query: batch.query,
      sourceCount: batch.sourceCount,
      sourceKinds: batch.sourceKinds,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown research-agent error'
    console.error('research-agent error:', message)
    return res.status(500).json({ ok: false, error: message })
  }
}
