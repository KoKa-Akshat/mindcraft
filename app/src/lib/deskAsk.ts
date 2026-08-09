/**
 * Desk Operator client — shared Ask MindCraft mount for Dash / Desk.
 * POST /api/desk-ask (Firebase Bearer). Same contract as iOS DeskAskClient.
 */

import { auth } from '../firebase'
import { WEBHOOK_BASE } from './mlApi'

export type DeskAskActionType =
  | 'open_gmail'
  | 'open_apply'
  | 'open_connect'
  | 'refresh_calendar'
  | 'prepend_intel'

export interface DeskAskAction {
  type: DeskAskActionType
  payload?: string
}

export interface DeskAskContext {
  intelLines: string[]
  binderItems: { title: string; course: string }[]
  calendarEvents: { day: string; title: string }[]
  connected: string[]
  openSurface?: 'desk' | 'gmail' | 'applyToday'
}

export interface DeskAskResult {
  reply: string
  actions: DeskAskAction[]
  toolsUsed: string[]
  fallback?: boolean
}

export async function askDeskAgent(
  message: string,
  deskContext: DeskAskContext,
): Promise<DeskAskResult | null> {
  const user = auth.currentUser
  if (!user) return null
  const token = await user.getIdToken()
  const res = await fetch(`${WEBHOOK_BASE}/api/desk-ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: message.trim(),
      studentId: user.uid,
      deskContext,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || typeof data.reply !== 'string') return null
  return {
    reply: data.reply.trim(),
    actions: Array.isArray(data.actions) ? data.actions : [],
    toolsUsed: Array.isArray(data.toolsUsed) ? data.toolsUsed : [],
    fallback: Boolean(data.fallback),
  }
}

/** Install auth bridge so web Desk OS (`deskAsk.js`) can call the same API. */
export function installDeskAskAuthBridge(): void {
  if (typeof window === 'undefined') return
  type Bridge = { studentId: string; getIdToken: () => Promise<string> }
  const w = window as Window & { __MC_DESK_AUTH__?: Bridge }
  const bridge: Bridge = {
    studentId: auth.currentUser?.uid || '',
    getIdToken: async () => {
      const u = auth.currentUser
      if (!u) return ''
      bridge.studentId = u.uid
      return u.getIdToken()
    },
  }
  w.__MC_DESK_AUTH__ = bridge
  auth.onAuthStateChanged((u) => {
    bridge.studentId = u?.uid || ''
  })
}
