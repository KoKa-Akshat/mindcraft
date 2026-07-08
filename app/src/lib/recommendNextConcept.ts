import { mlIdToLabel } from './conceptMap'
import { fetchKnowledgeGraph } from './graphCache'
import {
  fetchExamConceptIds,
  getRecommendations,
  type ConceptRecommendation,
  type MisconceptionGap,
  type RecommendResult,
} from './mlApi'
import { loadDiagnostic } from './practiceState'
import { loadStudentPathContext } from './studyPathConfig'
import { hasFormatQuestions, lookupMisconceptionTrap, questionCount, type FormatId } from './questionBank'
import type { CurriculumTrack } from './curriculumTrack'

// A concept is a valid PRACTICE target only if the bank can serve it questions.
// Cross-cutting meta-concepts (e.g. representation_translation) have none, so
// they're never routed to as a drill — the path still treats them as prereqs.
function hasPlayableQuestions(conceptId: string | null | undefined): boolean {
  if (!conceptId) return false
  return ([1, 2, 3] as const).some(l => questionCount(conceptId, l) > 0)
}

const URGENCY: Record<string, number> = {
  struggling: 0,
  untouched: 1,
  in_progress: 2,
  mastered: 3,
}

export interface NextConcept {
  conceptId: string
  label: string
  mastery: number
  status: string
  /** Set when the worst weakness is a format↔concept gap (C1 / C3). */
  formatId?: FormatId
  /** Tier-3 misconception gap — optional; present only when that tier wins. */
  misconceptionId?: string
  ingredientId?: string
  distractorChoiceIndex?: number
  /** True when tutorFocusConcepts overrides engine weakness pick (Fable5 Area 4). */
  isTutorPick?: boolean
}

export interface PracticeHubRecommendations {
  weakness: NextConcept | null
  learn: NextConcept | null
}

export type WeaknessCandidate = {
  conceptId: string
  formatId?: FormatId
  severity: number
  source: 'profile' | 'concept_gap' | 'format_gap' | 'misconception_gap'
  misconceptionId?: string
  ingredientId?: string
  distractorChoiceIndex?: number
}

type GraphNode = { id: string; mastery?: number; status?: string; eventCount?: number }

/** 0 exposure — matches KG `status: "untouched"` (`event_count === 0` in serve.py). */
function isZeroExposure(id: string, nodeMap: Map<string, GraphNode>): boolean {
  const n = nodeMap.get(id)
  if (!n) return true
  return (n.eventCount ?? 0) === 0
}

function pickMostUrgent(nodes: GraphNode[]): string | null {
  if (!nodes.length) return null
  return [...nodes]
    .sort(
      (a, b) =>
        (URGENCY[a.status ?? 'untouched'] - URGENCY[b.status ?? 'untouched'])
        || ((a.mastery ?? 0) - (b.mastery ?? 0)),
    )[0]?.id ?? null
}

export function chainSteps(rec: RecommendResult | null): ConceptRecommendation[] {
  return rec?.recommendations?.filter(r => !r.isSupplement && !r.isBridgeGap) ?? []
}

function conceptMastery(conceptId: string, nodeMap: Map<string, GraphNode>): number {
  return nodeMap.get(conceptId)?.mastery ?? 0
}

/** C1 fallback when Agent A has not shipped `severity` yet. */
function gapSeverity(gap: ConceptRecommendation, nodeMap: Map<string, GraphNode>): number {
  if (gap.severity != null) return gap.severity
  const anchorId = gap.bridgeToConcept ?? gap.conceptId
  let base = 1 - conceptMastery(anchorId ?? '', nodeMap)
  if (gap.bridgeEvidence === 'hypothesis') base *= 0.5
  return base
}

function gapIngredientId(gap: MisconceptionGap): string | undefined {
  if (gap.ingredientId) return gap.ingredientId
  if (gap.ingredientIds?.length) return gap.ingredientIds[0]
  return undefined
}

/** Human label from a Layer-1 ingredient id slug (e.g. ratios_proportions__unit_rate). */
export function ingredientIdToLabel(ingredientId: string): string {
  const slug = ingredientId.includes('__') ? ingredientId.split('__').pop()! : ingredientId
  return slug
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** PawHub weak-spot copy when tier 3 wins (BRAND_BOOK — places on the map, not failures). */
export function formatMisconceptionWeaknessLabel(
  ingredientId: string | undefined,
  misconceptionId: string | undefined,
  conceptLabel: string,
): string {
  const headline = ingredientId ? ingredientIdToLabel(ingredientId) : conceptLabel
  const trap = misconceptionId ? lookupMisconceptionTrap(misconceptionId) : null
  if (trap) return `${headline} — the ${trap} keeps catching you`
  return headline
}

/**
 * C1 — pick the single most severe **playable** weakness across profile
 * weaknesses, concept-bridge gaps, and format gaps.
 * excludedConcepts: concepts already assessed/excluded (e.g. gap-scan exclusions).
 */
export function worstWeakness(
  profileRec: RecommendResult | null,
  pathRec: RecommendResult | null,
  nodeMap: Map<string, GraphNode>,
  excludedConcepts: ReadonlySet<string> = new Set(),
): WeaknessCandidate | null {
  const candidates: WeaknessCandidate[] = []

  for (const w of profileRec?.studentProfile?.topWeaknesses ?? []) {
    if (!hasPlayableQuestions(w.conceptId)) continue
    if (excludedConcepts.has(w.conceptId)) continue
    candidates.push({
      conceptId: w.conceptId,
      severity: 1 - conceptMastery(w.conceptId, nodeMap),
      source: 'profile',
    })
  }

  for (const gap of pathRec?.recommendations ?? []) {
    if (!gap.isBridgeGap) continue
    if (gap.gapType === 'format') {
      const conceptId = gap.bridgeToConcept
      const formatId = gap.bridgeFromConcept as FormatId | undefined
      if (!conceptId || !formatId || !hasFormatQuestions(conceptId, formatId)) continue
      if (excludedConcepts.has(conceptId)) continue
      candidates.push({
        conceptId,
        formatId,
        severity: gapSeverity(gap, nodeMap),
        source: 'format_gap',
      })
    } else {
      const conceptId = gap.bridgeToConcept ?? gap.conceptId
      if (!conceptId || !hasPlayableQuestions(conceptId)) continue
      if (excludedConcepts.has(conceptId)) continue
      candidates.push({
        conceptId,
        severity: gapSeverity(gap, nodeMap),
        source: 'concept_gap',
      })
    }
  }

  for (const g of profileRec?.misconceptionGaps ?? []) {
    if (!hasPlayableQuestions(g.conceptId)) continue
    if (excludedConcepts.has(g.conceptId)) continue
    candidates.push({
      conceptId: g.conceptId,
      severity: g.severity,
      source: 'misconception_gap',
      misconceptionId: g.misconceptionId,
      ingredientId: gapIngredientId(g),
      distractorChoiceIndex: g.distractorChoiceIndex,
    })
  }

  if (!candidates.length) return null
  return candidates.reduce((best, c) => (c.severity > best.severity ? c : best))
}

function toNextConcept(
  conceptId: string | null | undefined,
  nodeMap: Map<string, GraphNode>,
  weakness?: WeaknessCandidate | null,
  opts?: { isTutorPick?: boolean },
): NextConcept | null {
  if (!conceptId) return null
  const node = nodeMap.get(conceptId)
  const baseLabel = mlIdToLabel(conceptId)
  const label = weakness?.source === 'misconception_gap'
    ? formatMisconceptionWeaknessLabel(weakness.ingredientId, weakness.misconceptionId, baseLabel)
    : baseLabel
  return {
    conceptId,
    label,
    mastery: node?.mastery ?? 0,
    status: node?.status ?? 'untouched',
    formatId: weakness?.formatId,
    misconceptionId: weakness?.misconceptionId,
    ingredientId: weakness?.ingredientId,
    distractorChoiceIndex: weakness?.distractorChoiceIndex,
    isTutorPick: opts?.isTutorPick,
  }
}

/**
 * Dashboard + practice hub recommendations.
 *
 * Weak spot — `worstWeakness()` across profile + concept/format gaps (C1).
 * Learn next — first 0-exposure playable concept on the exam path.
 */
/** Map curriculumTrack → exam string for the /exam-concepts/{exam} endpoint. */
function trackToExam(track: CurriculumTrack | null | undefined, diagnosticExam: string | null): string {
  if (track === 'middle_school') return 'MIDDLE_SCHOOL'
  if (track === 'high_school')   return 'HIGH_SCHOOL'
  return diagnosticExam ?? 'ACT'
}

export async function fetchPracticeHubRecommendations(
  userId: string,
  curriculumTrack?: CurriculumTrack | null,
): Promise<PracticeHubRecommendations> {
  if (!userId) return { weakness: null, learn: null }

  const diagnostic = await loadDiagnostic(userId)
  const exam = trackToExam(curriculumTrack, diagnostic?.exam ?? null)
  const examConceptIds = await fetchExamConceptIds(exam)
  const scope = examConceptIds.length > 0 ? examConceptIds : undefined

  const kg = await fetchKnowledgeGraph(userId)
  const nodes = (kg?.nodes ?? []) as GraphNode[]
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const profileRec = await getRecommendations(userId, [], 'curriculum', exam)
  const anchorWeakness = profileRec?.studentProfile?.topWeaknesses
    ?.find(w => hasPlayableQuestions(w.conceptId))?.conceptId ?? null
  const anchor = anchorWeakness ?? pickMostUrgent(
    scope ? nodes.filter(n => scope.includes(n.id)) : nodes,
  )
  const pathRec = anchor
    ? await getRecommendations(userId, [anchor], 'curriculum', exam)
    : null

  const pathCtx = await loadStudentPathContext(userId)
  const tutorPickId = pathCtx.tutorFocusConcepts.find(hasPlayableQuestions) ?? null

  const worst = worstWeakness(profileRec, pathRec, nodeMap)
  let weaknessId = worst?.conceptId ?? null
  let tutorPick = false

  if (tutorPickId) {
    weaknessId = tutorPickId
    tutorPick = true
  } else if (!weaknessId) {
    weaknessId = [...(scope ? nodes.filter(n => scope.includes(n.id)) : nodes)]
      .filter(n => hasPlayableQuestions(n.id))
      .sort((a, b) =>
        (URGENCY[a.status ?? 'untouched'] - URGENCY[b.status ?? 'untouched'])
        || ((a.mastery ?? 0) - (b.mastery ?? 0)))[0]?.id ?? null
  }

  const examRec = await getRecommendations(userId, [], 'exam', exam)
  const actPath = chainSteps(examRec).map(s => s.conceptId)
  const learnId =
    actPath.find(id => id !== weaknessId && isZeroExposure(id, nodeMap) && hasPlayableQuestions(id))
    ?? [...(scope ? nodes.filter(n => scope.includes(n.id)) : nodes)]
        .filter(n => n.id !== weaknessId && isZeroExposure(n.id, nodeMap) && hasPlayableQuestions(n.id))
        .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))[0]?.id
    ?? null

  return {
    weakness: toNextConcept(weaknessId, nodeMap, tutorPick ? null : worst, { isTutorPick: tutorPick }),
    learn: toNextConcept(learnId, nodeMap),
  }
}

/** Weakness-prioritized drill target from `/recommend`. */
export async function fetchNextConcept(userId: string): Promise<NextConcept | null> {
  const { weakness } = await fetchPracticeHubRecommendations(userId)
  return weakness
}

/** Next step on the pathfinder chain (Learning GPS "learn new"). */
export async function fetchNextNewConcept(userId: string): Promise<NextConcept | null> {
  const { learn } = await fetchPracticeHubRecommendations(userId)
  return learn
}
