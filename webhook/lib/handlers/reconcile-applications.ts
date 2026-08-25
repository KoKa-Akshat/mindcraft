/**
 * POST /api/reconcile-applications
 *
 * Real reconciliation loop for MindCraft's Resume/JobOS board (2026-08-22) —
 * the same "check tracked applications against real signal before touching
 * anything" pattern from the reference job-search Command Center
 * architecture: an unambiguous company+role match is the ONLY branch point;
 * everything else is logged/surfaced, never guessed.
 *
 * Real constraint, confirmed by reading GmailClient.swift directly:
 * fetchInbox() only ever returns the most recent 20 INBOX messages by
 * metadata (from/subject/snippet/date) — there is no search-by-query, no
 * thread fetch, anywhere in that client. This loop is bounded by whatever
 * the client already fetched, not a targeted search.
 *
 * This NEVER marks anything Applied server-side — JobOSStore.markApplied
 * already requires an explicit confirmed:true tap for even a fully manual,
 * obvious case ("the desk never applies for you"), and this loop doesn't
 * get a shortcut around that discipline just because an email looks
 * confident. It only ever returns suggestions for the student to confirm.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { checkAndRecordAttempt, checkPlatformBudget, recordActualSpend } from '../generationBudget'
import { studentGeminiComplete } from '../studentGemini'

const client = new Anthropic()
const MODEL = 'claude-haiku-4-5-20251001'
const INPUT_USD_PER_MTOK = 1.0
const OUTPUT_USD_PER_MTOK = 5.0

interface InboxMessageIn {
  from: string
  subject: string
  snippet: string
  dateLabel: string
}

interface TrackedRoleIn {
  id: string
  company: string
  role: string
  processStatus: string
}

export interface ReconciliationSuggestion {
  roleId: string
  matchedFrom: string
  matchedSubject: string
  suggestedStatus: string
  reason: string
}

function clip(s: unknown, max: number): string {
  return typeof s === 'string' ? s.slice(0, max) : ''
}

function normalizeMessages(input: unknown): InboxMessageIn[] {
  if (!Array.isArray(input)) return []
  return input.slice(0, 20).map((m) => ({
    from: clip(m?.from, 120),
    subject: clip(m?.subject, 200),
    snippet: clip(m?.snippet, 400),
    dateLabel: clip(m?.dateLabel, 40),
  }))
}

function normalizeRoles(input: unknown): TrackedRoleIn[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((r) => r && typeof r.id === 'string' && typeof r.company === 'string' && typeof r.role === 'string')
    .slice(0, 60)
    .filter((r) => !['Closed', 'Skipped'].includes(String(r.processStatus)))
    .map((r) => ({
      id: clip(r.id, 60),
      company: clip(r.company, 120),
      role: clip(r.role, 160),
      processStatus: clip(r.processStatus, 40),
    }))
}

function buildPrompt(messages: InboxMessageIn[], roles: TrackedRoleIn[]): string {
  return `A student is tracking these internship/summer-program applications on a board:

${roles.map((r) => `- id=${r.id} | company="${r.company}" | role="${r.role}" | current status="${r.processStatus}"`).join('\n')}

Here are their ${messages.length} most recent inbox emails (metadata only):

${messages.map((m, i) => `[${i + 1}] from="${m.from}" subject="${m.subject}" snippet="${m.snippet}" date="${m.dateLabel}"`).join('\n')}

For each tracked role, only propose a suggestion if an email is an UNAMBIGUOUS match on BOTH the company name AND a role/program that clearly corresponds to that specific tracked role (not just any email from that company, and not a role match where the company has multiple similarly-named tracked roles). If a company has more than one tracked role and the email doesn't specify which, propose NOTHING for that company. If you are not confident, propose nothing — do not guess.

"reason" must paraphrase the actual email evidence (e.g. "Subject says 'Application received — Summer Analyst 2027'"), never a bare confidence score or generic statement.

Return ONLY a JSON array, no prose, no markdown fences (empty array is a completely valid and expected answer):
[{"roleId":"","matchedFrom":"","matchedSubject":"","suggestedStatus":"Applied","reason":""}]`
}

function parseSuggestions(text: string, validRoleIds: Set<string>): ReconciliationSuggestion[] {
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s) => s && typeof s.roleId === 'string' && validRoleIds.has(s.roleId))
      .slice(0, 20)
      .map((s) => ({
        roleId: String(s.roleId),
        matchedFrom: clip(s.matchedFrom, 120),
        matchedSubject: clip(s.matchedSubject, 200),
        suggestedStatus: clip(s.suggestedStatus, 40) || 'Applied',
        reason: clip(s.reason, 300),
      }))
  } catch {
    return []
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { messages?: unknown; roles?: unknown; studentGeminiKey?: string }
  const messages = normalizeMessages(body.messages)
  const roles = normalizeRoles(body.roles)
  const studentGeminiKey = typeof body.studentGeminiKey === 'string' ? body.studentGeminiKey.trim() : ''
  if (messages.length === 0 || roles.length === 0) {
    return res.status(200).json({ status: 'ok', suggestions: [] })
  }

  // BYOK (2026-08-25): a single plain call, no separate real-money step
  // like discover-internships.ts's Search calls - safe to fully bypass
  // both checks when a student key is present, same as
  // generate-lesson-outline.ts.
  if (!studentGeminiKey) {
    const platformBudget = await checkPlatformBudget()
    if (!platformBudget.allowed) {
      return res.status(429).json({
        status: 'rate_limited',
        reason: `This closed test's monthly generation budget is used up ($${platformBudget.spentThisMonthUsd.toFixed(2)}/$${platformBudget.capUsd}). It resets next month.`,
      })
    }
    const studentBudget = await checkAndRecordAttempt(uid)
    if (!studentBudget.allowed) {
      return res.status(429).json({
        status: 'rate_limited',
        reason: `Daily generation limit reached (${studentBudget.attemptsToday}/${studentBudget.cap}).`,
      })
    }
  }

  try {
    let text: string
    if (studentGeminiKey) {
      text = await studentGeminiComplete(studentGeminiKey, buildPrompt(messages, roles), 1200)
    } else {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1200,
        messages: [{ role: 'user', content: buildPrompt(messages, roles) }],
      })
      const costUsd =
        (message.usage.input_tokens / 1_000_000) * INPUT_USD_PER_MTOK +
        (message.usage.output_tokens / 1_000_000) * OUTPUT_USD_PER_MTOK
      recordActualSpend(costUsd).catch((e) => {
        console.error('reconcile-applications: failed to record platform spend', e)
      })
      const textBlock = message.content.find((b) => b.type === 'text')
      text = textBlock && 'text' in textBlock ? textBlock.text : ''
    }
    const validRoleIds = new Set(roles.map((r) => r.id))
    const suggestions = parseSuggestions(text, validRoleIds)
    return res.status(200).json({ status: 'ok', suggestions })
  } catch (err) {
    console.error('[reconcile-applications] error:', err)
    return res.status(502).json({ status: 'error', reason: String(err) })
  }
}
