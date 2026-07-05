export type CurriculumTrack = 'middle_school' | 'high_school' | 'act_prep'

export const CURRICULUM_TRACK_OPTIONS: {
  id: CurriculumTrack
  title: string
  description: string
}[] = [
  {
    id: 'middle_school',
    title: 'Middle School (Gr 6–8)',
    description: 'Foundations and pre-algebra skills by grade level.',
  },
  {
    id: 'high_school',
    title: 'High School (Gr 9–10)',
    description: 'Algebra, geometry, and early college-prep math.',
  },
  {
    id: 'act_prep',
    title: 'ACT Prep (Gr 11–12)',
    description: 'Exam-focused path toward ACT Math readiness.',
  },
]

/** Display-only copy for PawHub when track is middle school (ML calls unchanged). */
export function pawHubDisplayText(
  text: string,
  track: CurriculumTrack | null | undefined,
): string {
  if (track !== 'middle_school') return text
  return text
    .replace(/\bACT Math\b/gi, 'Math Skills')
    .replace(/\bACT\b/g, 'Math Skills')
}

export function pawHubLearnSub(track: CurriculumTrack | null | undefined): string {
  if (track === 'middle_school') return 'Your next skill'
  return 'Plot your route'
}

export function pawHubPracticeSub(
  weaknessLabel: string | undefined,
  track: CurriculumTrack | null | undefined,
): string {
  if (weaknessLabel) return pawHubDisplayText(weaknessLabel, track)
  if (track === 'middle_school') return 'Your grade-level path'
  return 'Your learning path'
}
