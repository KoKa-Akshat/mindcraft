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
import calendlyWebhook from '../lib/handlers/calendly-webhook'
import conceptGraph from '../lib/handlers/concept-graph'
import parseHomework from '../lib/handlers/parse-homework'
import sparkExperience from '../lib/handlers/spark-experience'
import adminLink from '../lib/handlers/admin-link'
import deployRules from '../lib/handlers/deploy-rules'
import marketingLead from '../lib/handlers/marketing-lead'
import marketingDrop from '../lib/handlers/marketing-drop'
import cronMarketingFollowup from '../lib/handlers/cron-marketing-followup'
import deskAsk from '../lib/handlers/desk-ask'
import resumeAgent from '../lib/handlers/resume-agent'
import archiveRag from '../lib/handlers/archive-rag'
import bookAgent from '../lib/handlers/book-agent'
import gmailDigest from '../lib/handlers/gmail-digest'
import ingestLessonGraph from '../lib/handlers/ingest-lesson-graph'
import generateSim from '../lib/handlers/generate-sim'
import archiveBooks from '../lib/handlers/archive-books'

const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown> = {
  'create-classroom': createClassroom,
  'join-classroom': joinClassroom,
  'link-child': linkChild,
  'grant-admin': grantAdmin,
  'delete-session': deleteSession,
  'publish-summary': publishSummary,
  'register-calendly': registerCalendly,
  'calendly-webhook': calendlyWebhook,
  'concept-graph': conceptGraph,
  'parse-homework': parseHomework,
  'spark-experience': sparkExperience,
  'admin-link': adminLink,
  'deploy-rules': deployRules,
  'marketing-lead': marketingLead,
  'marketing-drop': marketingDrop,
  'cron-marketing-followup': cronMarketingFollowup,
  'desk-ask': deskAsk,
  'resume-agent': resumeAgent,
  'archive-rag': archiveRag,
  'book-agent': bookAgent,
  'gmail-digest': gmailDigest,
  'ingest-lesson-graph': ingestLessonGraph,
  'generate-sim': generateSim,
  'archive-books': archiveBooks,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === 'string' ? req.query.action : ''
  const fn = HANDLERS[action]
  if (!fn) return res.status(404).json({ error: `Unknown action: ${action}` })
  return fn(req, res)
}
