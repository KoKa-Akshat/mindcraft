/**
 * api/app-actions.ts — consolidated router for small Firestore actions.
 *
 * Vercel's Hobby plan caps a deployment at 12 serverless functions; the heavy
 * LLM endpoints (story-module, generate-questions, gemini, jarvis, …) need
 * their own functions for maxDuration, so the quick CRUD-style handlers share
 * this one. Old URLs (/api/create-classroom etc.) still work via the rewrites
 * in vercel.json, so deployed frontends never notice.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import createClassroom from '../lib/handlers/create-classroom'
import joinClassroom from '../lib/handlers/join-classroom'
import linkChild from '../lib/handlers/link-child'
import grantAdmin from '../lib/handlers/grant-admin'
import deleteSession from '../lib/handlers/delete-session'
import publishSummary from '../lib/handlers/publish-summary'
import registerCalendly from '../lib/handlers/register-calendly'
import conceptGraph from '../lib/handlers/concept-graph'
import parseHomework from '../lib/handlers/parse-homework'

const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown> = {
  'create-classroom': createClassroom,
  'join-classroom': joinClassroom,
  'link-child': linkChild,
  'grant-admin': grantAdmin,
  'delete-session': deleteSession,
  'publish-summary': publishSummary,
  'register-calendly': registerCalendly,
  'concept-graph': conceptGraph,
  'parse-homework': parseHomework,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === 'string' ? req.query.action : ''
  const fn = HANDLERS[action]
  if (!fn) return res.status(404).json({ error: `Unknown action: ${action}` })
  return fn(req, res)
}
