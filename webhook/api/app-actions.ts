/**
 * api/app-actions.ts, consolidated router for small Firestore actions.
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
import claimInvitedRole from '../lib/handlers/claim-invited-role'
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
import generateBook from '../lib/handlers/generate-book'
import getBook from '../lib/handlers/get-book'
import generateLessonOutline from '../lib/handlers/generate-lesson-outline'
import archiveBooks from '../lib/handlers/archive-books'
import englishPractice from '../lib/handlers/english-practice'
import resetStudentData from '../lib/handlers/reset-student-data'
import logSimInteraction from '../lib/handlers/log-sim-interaction'
import generateSessionReport from '../lib/handlers/generate-session-report'
import getSessionReports from '../lib/handlers/get-session-reports'
import discoverInternships from '../lib/handlers/discover-internships'
import reconcileApplications from '../lib/handlers/reconcile-applications'
import listGeneratedSims from '../lib/handlers/list-generated-sims'
import microsims from '../lib/handlers/microsims'
import conceptResolve from '../lib/handlers/concept-resolve'
import simplifyChapter from '../lib/handlers/simplify-chapter'
import generateResumePdf from '../lib/handlers/generate-resume-pdf'
import learnTutor from '../lib/handlers/learn-tutor'
import learnTutorHistory from '../lib/handlers/learn-tutor-history'

const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown> = {
  'create-classroom': createClassroom,
  'join-classroom': joinClassroom,
  'link-child': linkChild,
  'grant-admin': grantAdmin,
  'claim-invited-role': claimInvitedRole,
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
  'generate-book': generateBook,
  'get-book': getBook,
  'generate-lesson-outline': generateLessonOutline,
  'archive-books': archiveBooks,
  'english-practice': englishPractice,
  'reset-student-data': resetStudentData,
  'log-sim-interaction': logSimInteraction,
  'generate-session-report': generateSessionReport,
  'get-session-reports': getSessionReports,
  'discover-internships': discoverInternships,
  'reconcile-applications': reconcileApplications,
  'list-generated-sims': listGeneratedSims,
  'microsims': microsims,
  // Concept library (migrated 2026-08-30): free-text semantic resolution over
  // the whole 4118-concept library, and the auto-simplify pass that reshapes a
  // chapter for how the student asked. Both are new capabilities, neither
  // duplicates an existing handler. Concept CONTENT is deliberately not here:
  // it is served by direct authenticated Firestore reads gated by
  // firestore.rules, see the note in that file.
  'concept-resolve': conceptResolve,
  'simplify-chapter': simplifyChapter,
  'learn-tutor': learnTutor,
  'learn-tutor-history': learnTutorHistory,
  // Resume Helper PDFs (2026-08-31). Routed through this consolidated
  // function rather than a new api/*.ts file on purpose: the deployment
  // already sits at exactly 12 functions, the Hobby plan's cap (see this
  // file's header), so a 13th function file would fail the next deploy.
  // pdf-lib is pure JS (~1MB), so it does not move this function anywhere
  // near the 250MB size limit the way a headless renderer would.
  'generate-resume-pdf': generateResumePdf,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === 'string' ? req.query.action : ''
  const fn = HANDLERS[action]
  if (!fn) return res.status(404).json({ error: `Unknown action: ${action}` })
  return fn(req, res)
}
