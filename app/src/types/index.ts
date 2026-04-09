/**
 * types/index.ts
 *
 * Canonical Firestore document shapes shared across the entire app.
 * Import from here instead of defining local interfaces in each page.
 * Any change to a data model only needs to happen in one place.
 */

// ─── Sessions ────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  studentName: string
  studentEmail: string
  studentId: string | null
  tutorId: string
  tutorName?: string
  subject: string
  date: string
  scheduledAt: number
  endAt: number
  duration: string
  status: 'scheduled' | 'completed' | 'cancelled'
  meetingUrl: string | null
  summaryStatus?: 'pending' | 'draft' | 'published'
  calendlyEventUri?: string
  firefliesMeetingUrl?: string
  transcript?: {
    meetingId: string
    fullText: string
    summary: { overview?: string; action_items?: string; keywords?: string } | null
    sentences: { speaker_name: string; text: string }[]
    duration: number
    processedAt: string
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'parent' | 'tutor' | 'admin'

export interface TutorStudent {
  id: string
  displayName: string
  email: string
  /** Last published session summary stored on the student's user doc */
  lastSession?: {
    title?: string
    subject?: string
    date?: string
    bullets?: string[]
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id?: string
  senderId: string
  text: string
  fileUrl: string | null
  fileName: string | null
  fileType: 'image' | 'pdf' | 'doc' | null
  createdAt: any // Firestore ServerTimestamp
}
