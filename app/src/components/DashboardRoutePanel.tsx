/** @deprecated Stable name for the composed book-styled route surface. */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { getRecommendations } from '../lib/mlApi'
import { studyPlanFromRecommendation } from '../lib/bookRoute'
import StudyPlanList, { type StudyPlanItem } from './book/StudyPlanList'

export default function DashboardRoutePanel({ targetId }: { targetId: string }) {
  const user = useUser()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<{
    items: StudyPlanItem[]
    completedCount: number
    progressPct: number
  }>({ items: [], completedCount: 0, progressPct: 0 })

  useEffect(() => {
    if (!user?.uid || !targetId) return
    let cancelled = false
    setLoading(true)
    void Promise.all([
      fetchKnowledgeGraph(user.uid),
      getRecommendations(user.uid, [targetId], 'curriculum'),
    ]).then(([kg, recommendation]) => {
      if (!cancelled) setPlan(studyPlanFromRecommendation(
        recommendation,
        (kg?.nodes ?? []) as Array<{ id: string; mastery?: number; status?: string }>,
        targetId,
      ))
    }).catch(() => {
      if (!cancelled) setPlan(studyPlanFromRecommendation(null, [], targetId))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [targetId, user?.uid])

  return (
    <StudyPlanList
      title={loading ? 'Plotting your route…' : 'Your route'}
      examLabel="curriculum"
      items={plan.items}
      progressPct={plan.progressPct}
      completedCount={plan.completedCount}
      disabled={loading}
      onSelect={item => navigate(`/concept/${encodeURIComponent(item.id)}`, {
        state: { fromDashboard: true },
      })}
    />
  )
}
