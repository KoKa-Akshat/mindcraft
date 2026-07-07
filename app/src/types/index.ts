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
  plan?: SessionPlan
  tutorObservation?: TutorObservation
  /** Tutor-flagged follow-up problems for async student reasoning capture (§3). */
  workPrompts?: string[]
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

// ─── Session plan / observation ───────────────────────────────────────────────

export interface SessionPlan {
  topics: string[]
  goals: string
  notes: string
  createdAt: number
}

export interface TutorObservation {
  rating: 1 | 2 | 3 | 4 | 5
  notes: string
  struggled_with: string[]
  excelled_at: string[]
  completedAt: number
}

// ─── Student async reasoning (session follow-up work) ─────────────────────────

export type ScratchStrokePoint = [number, number, number]

export interface ScratchStrokeData {
  strokes: ScratchStrokePoint[][]
  width: number
  height: number
}

export type InkBbox = [number, number, number, number]

export interface WorkLine {
  bbox: InkBbox
  strokeIdx: number[]
  text: string
  latex: string
  editedByStudent: boolean
  verdict?: 'ok' | 'wrong' | 'unparsed'
  checkReason?: string
}

export type WorkSource = 'practice' | 'chapter' | 'session'

export interface QuestionWorkDoc {
  studentId: string
  questionId?: string
  conceptId: string
  source: WorkSource
  level?: 1 | 2 | 3
  formatId?: string
  sessionId?: string
  prompt?: string
  scratchImage?: string
  scratchStrokes: ScratchStrokeData
  workLines: WorkLine[]
  scratchTranscription: {
    text: string
    latex: string
    editedByStudent: boolean
  }
  wasStuck?: boolean
  reasoningText?: string
  createdAt: number
  updatedAt: number
}

export interface StudentWorkEntry {
  id: string
  sessionId: string
  studentId: string
  prompt: string
  questionId?: string
  conceptId?: string
  source?: WorkSource
  scratchImage?: string
  scratchStrokes?: ScratchStrokeData
  workLines?: WorkLine[]
  scratchTranscription?: {
    text: string
    latex: string
    editedByStudent: boolean
  }
  reasoningText: string
  wasStuck: boolean
  createdAt: number
}

// ─── Classroom ────────────────────────────────────────────────────────────────

export interface Classroom {
  code: string
  tutorId: string
  tutorName: string
  studentIds: string[]
  createdAt: number
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
