/** Public site URLs — marketing is the landing; app host is login + product only. */
export const MARKETING_BASE = 'https://mindcraft-marketing-site.web.app'
export const APP_BASE = 'https://mindcraft-93858.web.app'
export const APP_LOGIN = `${APP_BASE}/login`

const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost'

/** Nox's kitchen — world2 served from mindcraft-world1.web.app */
export const WORLD_BASE = isLocal ? 'http://localhost:3001' : 'https://mindcraft-world1.web.app'

export function worldUrl(studentId?: string): string {
  if (!studentId) return WORLD_BASE
  return `${WORLD_BASE}?student=${encodeURIComponent(studentId)}`
}

export function appUrl(path: string): string {
  if (isLocal) return path
  return `${APP_BASE}${path.startsWith('/') ? path : `/${path}`}`
}
