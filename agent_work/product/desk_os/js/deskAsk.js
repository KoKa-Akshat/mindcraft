/**
 * Desk Operator client for Ask MindCraft.
 * Calls POST /api/desk-ask when Firebase auth is available via
 * window.__MC_DESK_AUTH__ = { getIdToken(): Promise<string>, studentId: string }.
 * Otherwise returns a local deterministic desk fallback (same action shape).
 */

const WEBHOOK_BASE = 'https://mindcraft-webhook.vercel.app'

export function buildDeskContextFromLocal() {
  let intelLines = []
  let connected = []
  let binderItems = []
  let calendarEvents = []
  try {
    intelLines = JSON.parse(localStorage.getItem('deskOs.intelLines') || '[]') || []
  } catch { /* ignore */ }
  try {
    const connect = JSON.parse(localStorage.getItem('deskOs.connect') || '{}') || {}
    connected = Object.keys(connect)
  } catch { /* ignore */ }
  try {
    const items = JSON.parse(localStorage.getItem('deskOs.fieldDeskItems') || '[]') || []
    binderItems = items.slice(0, 20).map((it) => ({
      title: String(it.title || it.name || 'Untitled'),
      course: String(it.course || 'Inbox'),
    }))
  } catch { /* ignore */ }
  try {
    const events = JSON.parse(localStorage.getItem('deskOs.calendarEvents') || '[]') || []
    calendarEvents = events.slice(0, 10).map((ev) => ({
      day: String(ev.day || ''),
      title: String(ev.title || ''),
    }))
  } catch { /* ignore */ }

  return {
    intelLines: intelLines.slice(0, 12).map(String),
    binderItems,
    calendarEvents,
    connected,
    openSurface: 'desk',
  }
}

function localFallback(message, deskContext) {
  const s = String(message || '').toLowerCase()
  const actions = []
  if (/mail|gmail|inbox|email/.test(s)) {
    actions.push({ type: 'open_gmail' })
    return { reply: 'Opening your Gmail box.', actions, toolsUsed: [], fallback: true }
  }
  if (/apply|job|resume|linkedin/.test(s)) {
    actions.push({ type: 'open_apply' })
    return { reply: 'Opening Apply today.', actions, toolsUsed: [], fallback: true }
  }
  if (/connect|moodle|link/.test(s)) {
    actions.push({ type: 'open_connect' })
    return { reply: 'Opening Connect.', actions, toolsUsed: [], fallback: true }
  }
  if (/cal|week|schedule|due/.test(s)) {
    actions.push({ type: 'refresh_calendar' })
    const cal = deskContext.calendarEvents || []
    if (cal.length) {
      return {
        reply: `From your calendar: ${cal.slice(0, 4).map((e) => `${e.day} · ${e.title}`).join('; ')}.`,
        actions,
        toolsUsed: [],
        fallback: true,
      }
    }
    return {
      reply: 'No events this week yet. Connect Gmail + Calendar to load your real week.',
      actions,
      toolsUsed: [],
      fallback: true,
    }
  }
  return {
    reply: 'I heard you. Try ask about your week, open mail, or Apply today.',
    actions,
    toolsUsed: [],
    fallback: true,
  }
}

async function authBridge() {
  const bridge = typeof window !== 'undefined' ? window.__MC_DESK_AUTH__ : null
  if (!bridge?.getIdToken || !bridge?.studentId) return null
  try {
    const token = await bridge.getIdToken()
    if (!token) return null
    return { token, studentId: String(bridge.studentId) }
  } catch {
    return null
  }
}

/**
 * @param {string} message
 * @param {object} [deskContext]
 * @returns {Promise<{ reply: string, actions: object[], toolsUsed: string[], fallback?: boolean }>}
 */
export async function askDeskAgent(message, deskContext = buildDeskContextFromLocal()) {
  const trimmed = String(message || '').trim()
  if (!trimmed) {
    return { reply: '', actions: [], toolsUsed: [], fallback: true }
  }

  const auth = await authBridge()
  if (!auth) return localFallback(trimmed, deskContext)

  try {
    const res = await fetch(`${WEBHOOK_BASE}/api/desk-ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        message: trimmed,
        studentId: auth.studentId,
        deskContext,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || typeof data.reply !== 'string') {
      return localFallback(trimmed, deskContext)
    }
    return {
      reply: data.reply,
      actions: Array.isArray(data.actions) ? data.actions : [],
      toolsUsed: Array.isArray(data.toolsUsed) ? data.toolsUsed : [],
      fallback: Boolean(data.fallback),
    }
  } catch {
    return localFallback(trimmed, deskContext)
  }
}
