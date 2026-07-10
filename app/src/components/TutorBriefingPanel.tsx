/**
 * TutorBriefingPanel.tsx — pre-session briefing for tutors.
 *
 * "The map, already drawn" (BRAND_BOOK §6): before the session starts the
 * tutor sees exactly where the student is stuck, why, and what the student
 * said they're here for. Everything is read from data the engine already
 * computes — no new backend work:
 *
 *   - goals.text          — free-text goal/motivation typed (or voice-recorded)
 *                           during onboarding, stored on users/{uid}.goals.
 *   - /recommend          — studentProfile.topWeaknesses, bridge/format gaps
 *                           (recommendations[].isBridgeGap + severity), and
 *                           misconceptionGaps[] (tier-3 distractor evidence).
 *   - /knowledge-graph    — per-concept mastery for severity fallbacks
 *                           (via the shared graphCache).
 *
 * The "This session" synthesis is deterministic composition of the above —
 * intentionally NOT an LLM call (no tutor-facing LLM contract exists in
 * AGENT_RULEBOOK.md, and the deterministic engine owns diagnosis).
 *
 * Copy runs peer-level and technical per the Jordan persona: name the gap,
 * name the trap, hand over the why.
 */

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import {
  getRecommendations,
  type MisconceptionGap,
  type RecommendResult,
} from '../lib/mlApi'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { mlIdToLabel } from '../lib/conceptMap'
import { ingredientIdToLabel } from '../lib/recommendNextConcept'
import { lookupMisconceptionTrap } from '../lib/questionBank'
import s from './TutorBriefingPanel.module.css'

interface Props {
  studentId: string
  studentName: string
  examTrack: string
}

type GapKind = 'concept' | 'bridge' | 'format' | 'trap'

interface GapRow {
  key: string
  conceptId: string
  label: string
  /** One peer-level line on WHY this is a gap (bridge direction, format, trap). */
  detail: string | null
  severity: number
  kind: GapKind
}

interface TrapRow {
  key: string
  trap: string
  conceptLabel: string
  ingredientLabel: string | null
  hitLine: string | null
  severity: number
}

const KIND_LABEL: Record<GapKind, string> = {
  concept: 'weak concept',
  bridge: 'bridge gap',
  format: 'format gap',
  trap: 'trap',
}

function formatIdToLabel(formatId: string): string {
  return formatId.replace(/_/g, ' ')
}

function severityClass(sev: number): string {
  if (sev >= 0.7) return s.sevHigh
  if (sev >= 0.4) return s.sevMid
  return s.sevLow
}

function trapName(misconceptionId: string | undefined): string {
  const trap = misconceptionId ? lookupMisconceptionTrap(misconceptionId) : null
  return trap ?? 'trap'
}

function gapIngredient(g: MisconceptionGap): string | undefined {
  return g.ingredientId ?? g.ingredientIds?.[0]
}

function trapHitLine(g: MisconceptionGap): string | null {
  if (g.personalHitRate != null) {
    const pct = Math.round(g.personalHitRate * 100)
    const seen = g.nObservations != null ? ` (${g.nObservations} answer${g.nObservations !== 1 ? 's' : ''} seen)` : ''
    const pop = g.populationHitRate != null
      ? ` — population baseline ${Math.round(g.populationHitRate * 100)}%`
      : ''
    return `fired on ${pct}% of recent attempts${seen}${pop}`
  }
  if (g.hits != null && g.hits > 0) {
    return `${g.hits} recent hit${g.hits !== 1 ? 's' : ''}`
  }
  return null
}

/** Build the deduped, severity-ranked gap list from both /recommend calls. */
function buildGapRows(
  profileRec: RecommendResult | null,
  pathRec: RecommendResult | null,
  masteryOf: (conceptId: string) => number,
): GapRow[] {
  const rows: GapRow[] = []

  for (const w of profileRec?.studentProfile?.topWeaknesses ?? []) {
    rows.push({
      key: `concept:${w.conceptId}`,
      conceptId: w.conceptId,
      label: mlIdToLabel(w.conceptId),
      detail: null,
      severity: 1 - masteryOf(w.conceptId),
      kind: 'concept',
    })
  }

  for (const gap of pathRec?.recommendations ?? []) {
    if (!gap.isBridgeGap) continue
    if (gap.gapType === 'format') {
      const conceptId = gap.bridgeToConcept
      const formatId = gap.bridgeFromConcept
      if (!conceptId || !formatId) continue
      rows.push({
        key: `format:${conceptId}:${formatId}`,
        conceptId,
        label: mlIdToLabel(conceptId),
        detail: `Concept holds, but the ${formatIdToLabel(formatId)} presentation breaks it.`,
        severity: gap.severity ?? 1 - masteryOf(conceptId),
        kind: 'format',
      })
    } else {
      const conceptId = gap.bridgeToConcept ?? gap.conceptId
      if (!conceptId) continue
      const from = gap.bridgeFromConcept ? mlIdToLabel(gap.bridgeFromConcept) : null
      const to = mlIdToLabel(conceptId)
      const hypothesis = gap.bridgeEvidence === 'hypothesis'
      rows.push({
        key: `bridge:${gap.bridgeId ?? conceptId}`,
        conceptId,
        label: to,
        detail: from
          ? `Knows ${from} and ${to} separately — the connection between them is what's failing${hypothesis ? ' (hypothesis, not yet confirmed)' : ''}.`
          : `Cross-concept connection into ${to} is failing${hypothesis ? ' (hypothesis)' : ''}.`,
        severity: gap.severity ?? 1 - masteryOf(conceptId),
        kind: 'bridge',
      })
    }
  }

  for (const g of profileRec?.misconceptionGaps ?? []) {
    const ing = gapIngredient(g)
    rows.push({
      key: `trap:${g.misconceptionId}`,
      conceptId: g.conceptId,
      label: ing ? ingredientIdToLabel(ing) : mlIdToLabel(g.conceptId),
      detail: `The ${trapName(g.misconceptionId)} keeps catching them here.`,
      severity: g.severity,
      kind: 'trap',
    })
  }

  // Dedupe by concept, keeping the most severe (and most specific) row.
  const byConcept = new Map<string, GapRow>()
  for (const row of rows) {
    const existing = byConcept.get(row.conceptId)
    if (!existing || row.severity > existing.severity) byConcept.set(row.conceptId, row)
  }
  return [...byConcept.values()].sort((a, b) => b.severity - a.severity).slice(0, 4)
}

/** Deterministic "what to focus on" — worst gap + freshest trap + stated goal. */
function buildFocus(
  studentFirstName: string,
  gaps: GapRow[],
  traps: TrapRow[],
  goalText: string,
): string[] {
  const lines: string[] = []
  const worst = gaps[0]
  if (worst) {
    const sevPct = Math.round(worst.severity * 100)
    if (worst.kind === 'bridge') {
      lines.push(`Lead with ${worst.label} — the worst gap on the map (severity ${sevPct}%). It's a bridge problem: drill the connection, not the pieces.`)
    } else if (worst.kind === 'format') {
      lines.push(`Lead with ${worst.label} — the worst gap on the map (severity ${sevPct}%). The concept is there; re-present it in the format that's breaking.`)
    } else {
      lines.push(`Lead with ${worst.label} — the worst gap on the map (severity ${sevPct}%).`)
    }
  }
  const trap = traps[0]
  if (trap) {
    lines.push(`Watch for the ${trap.trap} on ${trap.ingredientLabel ?? trap.conceptLabel}${trap.hitLine ? ` — it ${trap.hitLine}` : ''}.`)
  }
  if (goalText) {
    lines.push(`Tie it back to why ${studentFirstName} is here: "${goalText}"`)
  }
  return lines
}

export default function TutorBriefingPanel({ studentId, studentName, examTrack }: Props) {
  const [loading, setLoading] = useState(true)
  const [goalText, setGoalText] = useState('')
  const [gaps, setGaps] = useState<GapRow[]>([])
  const [traps, setTraps] = useState<TrapRow[]>([])

  const firstName = studentName.split(' ')[0] || 'your student'

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        // Stated goal — free text from onboarding (users/{uid}.goals.text).
        // NOTE: goals.tags is a dead always-empty field; only text is real.
        const [userSnap, profileRec, kg] = await Promise.all([
          getDoc(doc(db, 'users', studentId)).catch(() => null),
          getRecommendations(studentId, [], 'curriculum', examTrack),
          fetchKnowledgeGraph(studentId).catch(() => null),
        ])
        if (cancelled) return

        const rawGoal = (userSnap?.data()?.goals as { text?: string } | undefined)?.text?.trim() ?? ''
        setGoalText(rawGoal === '[voice recorded]' ? '' : rawGoal)

        const nodes = ((kg?.nodes ?? []) as Array<{ id?: string; mastery?: number }>)
        const masteryMap = new Map(nodes.map(n => [String(n.id ?? ''), Number(n.mastery ?? 0)]))
        const masteryOf = (id: string) => masteryMap.get(id) ?? 0

        // Second /recommend anchored on the worst profile weakness surfaces
        // bridge + format gaps along its prerequisite chain (same pattern as
        // fetchPracticeHubRecommendations).
        const anchor = profileRec?.studentProfile?.topWeaknesses?.[0]?.conceptId ?? null
        const pathRec = anchor
          ? await getRecommendations(studentId, [anchor], 'curriculum', examTrack)
          : null
        if (cancelled) return

        setGaps(buildGapRows(profileRec, pathRec, masteryOf))
        setTraps(
          (profileRec?.misconceptionGaps ?? [])
            .slice()
            .sort((a, b) => b.severity - a.severity)
            .slice(0, 3)
            .map(g => {
              const ing = gapIngredient(g)
              return {
                key: g.misconceptionId,
                trap: trapName(g.misconceptionId),
                conceptLabel: mlIdToLabel(g.conceptId),
                ingredientLabel: ing ? ingredientIdToLabel(ing) : null,
                hitLine: trapHitLine(g),
                severity: g.severity,
              }
            }),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [studentId, examTrack])

  const focusLines = buildFocus(firstName, gaps, traps, goalText)
  const empty = !loading && gaps.length === 0 && traps.length === 0 && !goalText

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.title}>Session Briefing</span>
        <span className={s.sub}>where {firstName} is stuck, and why</span>
      </div>

      {loading ? (
        <p className={s.emptyText}>Reading the map…</p>
      ) : empty ? (
        <p className={s.emptyText}>
          No evidence yet — the briefing fills in after {firstName}'s first gap scan or practice session.
        </p>
      ) : (
        <>
          {goalText && (
            <div className={s.goalBlock}>
              <span className={s.blockLabel}>Why they're here</span>
              <p className={s.goalQuote}>&ldquo;{goalText}&rdquo;</p>
              <span className={s.goalMeta}>— {firstName}, at onboarding</span>
            </div>
          )}

          {gaps.length > 0 && (
            <div className={s.block}>
              <span className={s.blockLabel}>Where they're stuck</span>
              {gaps.map(g => (
                <div key={g.key} className={s.gapRow}>
                  <div className={s.gapTop}>
                    <span className={s.gapName}>{g.label}</span>
                    <span className={`${s.kindTag} ${g.kind === 'trap' ? s.kindTrap : ''}`}>
                      {KIND_LABEL[g.kind]}
                    </span>
                    <span className={s.gapPct}>{Math.round(g.severity * 100)}</span>
                  </div>
                  <div className={s.sevTrack}>
                    <div
                      className={`${s.sevFill} ${severityClass(g.severity)}`}
                      style={{ width: `${Math.round(Math.max(0.04, Math.min(1, g.severity)) * 100)}%` }}
                    />
                  </div>
                  {g.detail && <p className={s.gapDetail}>{g.detail}</p>}
                </div>
              ))}
            </div>
          )}

          {traps.length > 0 && (
            <div className={s.block}>
              <span className={s.blockLabel}>Traps they keep hitting</span>
              {traps.map(t => (
                <div key={t.key} className={s.trapRow}>
                  <span className={s.trapName}>{t.trap}</span>
                  <span className={s.trapWhere}>
                    {t.ingredientLabel ? `${t.ingredientLabel} · ${t.conceptLabel}` : t.conceptLabel}
                  </span>
                  {t.hitLine && <span className={s.trapHits}>{t.hitLine}</span>}
                </div>
              ))}
            </div>
          )}

          {focusLines.length > 0 && (
            <div className={s.focusBlock}>
              <span className={s.blockLabel}>This session</span>
              {focusLines.map((line, i) => (
                <p key={i} className={s.focusLine}>{line}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
