import { useEffect, useMemo, useState } from 'react'
import { getRecommendations, type ConceptRecommendation } from '../lib/mlApi'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { mlIdToLabel } from '../lib/conceptMap'

/**
 * Recommended Reinforcement.
 *
 * A NEW consumer of /recommend's `recommendations[]` — the goal-path views
 * (LearningGPS) drop that array, and these gaps sit BETWEEN mastered endpoints,
 * so they're invisible there. Renders both gap types (identical object shape):
 *   - concept gap: "you know both X and Y but stumble connecting them"
 *   - format gap:  "you know the concept but fail it as a {vessel}"
 *
 * Display-only in v1: no gap type has a server-detector → practice path yet
 * (concept gaps included — bridgePractice.ts derives its own from the confidence
 * map), so the CTA is disabled and says so rather than dead-ending.
 */

const MAX_ITEMS = 5

function prettyFormat(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function gapEndpoints(g: ConceptRecommendation): { from: string; to: string } {
  if (g.gapType === 'format') {
    // from = format_id (vessel), to = anchor concept
    return { from: prettyFormat(g.bridgeFromConcept ?? ''), to: mlIdToLabel(g.bridgeToConcept ?? g.conceptId) }
  }
  return { from: mlIdToLabel(g.bridgeFromConcept ?? ''), to: mlIdToLabel(g.bridgeToConcept ?? g.conceptId) }
}

// Honesty contract: Tier-1 is earned ("you've struggled here"), Tier-2 is a
// hedge ("this might trip you up"). Most gaps are Tier-2 today — keep it honest.
function badge(evidence: string | null | undefined): { label: string; bg: string } {
  return evidence === 'evidence'
    ? { label: "You've struggled here before", bg: '#EF4444' }
    : { label: 'This might trip you up', bg: '#F59E0B' }
}

export function ReinforceCard({ recommendations }: { recommendations: ConceptRecommendation[] }) {
  const gaps = useMemo(() => {
    return recommendations
      .filter(r => r.isBridgeGap)
      // Tier-1 (earned evidence) above Tier-2 (hypothesis).
      .sort((a, b) => {
        const rank = (e?: string | null) => (e === 'evidence' ? 0 : 1)
        return rank(a.bridgeEvidence) - rank(b.bridgeEvidence)
      })
      .slice(0, MAX_ITEMS)
  }, [recommendations])

  if (gaps.length === 0) return null

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #EEF0F3',
    }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>Recommended Reinforcement</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7280' }}>
        Connections and formats where you know the material but stumble on the link.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gaps.map((g, i) => {
          const { from, to } = gapEndpoints(g)
          const b = badge(g.bridgeEvidence)
          return (
            <div key={g.bridgeId ?? `${g.gapType}-${g.bridgeFromConcept}-${i}`}
              style={{ border: '1px solid #EEF0F3', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {from} <span style={{ color: '#9CA3AF' }}>→</span> {to}
                  <span title={g.gapType === 'format'
                      ? 'Format gap — scoped to one concept you know, shown in a vessel you stumble on'
                      : 'Connection gap — spans two mastered topics you struggle to link'}
                    style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#6B7280',
                    background: '#F3F4F6', borderRadius: 6, padding: '2px 6px',
                  }}>{g.gapType === 'format' ? 'format · within a concept' : 'connection · across concepts'}</span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#fff',
                  background: b.bg, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
                }}>{b.label}</span>
              </div>
              <p style={{ margin: '8px 0 10px', fontSize: 13, color: '#4B5563' }}>{g.reason}</p>
              <button
                disabled
                title="Targeted practice for this gap isn't wired up yet"
                style={{
                  fontSize: 13, fontWeight: 600, color: '#9CA3AF',
                  background: '#F3F4F6', border: 'none', borderRadius: 8,
                  padding: '7px 12px', cursor: 'not-allowed',
                }}>
                Practice (coming soon)
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Self-fetching wrapper for the dashboard. Picks the student's most-urgent
 * concept (lowest mastery, mirroring LearningGPS) as the /recommend target so
 * the server produces a chain — gaps ride that response. Reuses the shared
 * knowledge-graph cache so this doesn't add a Cloud Run round-trip.
 */
export default function ReinforcePanel({ userId }: { userId: string }) {
  const [recs, setRecs] = useState<ConceptRecommendation[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const kg = await fetchKnowledgeGraph(userId)
      const nodes = (kg?.nodes ?? []) as Array<{ id?: string; mastery?: number }>
      if (!nodes.length) return
      // Most-urgent = lowest-mastery concept; gives the server a real chain.
      const target = [...nodes]
        .filter(n => typeof n.id === 'string')
        .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))[0]?.id
      if (!target) return
      const result = await getRecommendations(userId, [target], 'curriculum')
      if (!cancelled && result) setRecs(result.recommendations ?? [])
    }
    void load()
    return () => { cancelled = true }
  }, [userId])

  return <ReinforceCard recommendations={recs} />
}
