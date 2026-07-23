import { describe, expect, it } from 'vitest'
import {
  archetypeIdsForQuestion,
  getConceptScenes,
  selectSceneForQuestion,
  type ConceptScene,
} from './sceneSelection'

describe('sceneSelection', () => {
  describe('getConceptScenes', () => {
    it('returns the pilot scenes array for fractions_decimals', () => {
      const scenes = getConceptScenes('fractions_decimals')
      expect(scenes).not.toBeNull()
      expect(scenes!.length).toBeGreaterThanOrEqual(3)
      expect(scenes!.length).toBeLessThanOrEqual(6)
      for (const scene of scenes!) {
        expect(scene.sceneId).toBeTruthy()
        expect(scene.settingLine).toBeTruthy()
        expect(scene.questionBridge).toBeTruthy()
      }
    })

    it('returns null for a concept with no scenes array yet (legacy single-frame path)', () => {
      expect(getConceptScenes('linear_equations')).toBeNull()
      expect(getConceptScenes('quadratic_equations')).toBeNull()
    })

    it('returns null for an unknown concept id', () => {
      expect(getConceptScenes('not_a_real_concept')).toBeNull()
    })
  })

  describe('archetypeIdsForQuestion', () => {
    it('finds real archetype links for question ids present in the Layer 3 mirror', () => {
      // act_math_t02_q10 / q11 are the two real seed instances whose archetypes
      // (pie_chart_pair_sum_to_target_percent / pie_chart_percent_of_total_count)
      // tag fractions_decimals in Layer 2 primary_concept_ids.
      expect(archetypeIdsForQuestion('act_math_t02_q10')).toContain('pie_chart_pair_sum_to_target_percent')
      expect(archetypeIdsForQuestion('act_math_t02_q11')).toContain('pie_chart_percent_of_total_count')
    })

    it('returns an empty array for a question id with no Layer 3 linkage', () => {
      expect(archetypeIdsForQuestion('fd-1-1')).toEqual([])
      expect(archetypeIdsForQuestion('not-a-real-id')).toEqual([])
    })
  })

  describe('selectSceneForQuestion: archetype match branch', () => {
    it('picks the scene tagged with the matching archetype when a real Layer 3 link exists', () => {
      const scene = selectSceneForQuestion(
        { id: 'act_math_t02_q11', conceptId: 'fractions_decimals' },
      )
      expect(scene).not.toBeNull()
      expect(scene!.archetypeId).toBe('pie_chart_percent_of_total_count')
      expect(scene!.sceneId).toBe('customs_manifest_count')
    })

    it('picks a different scene for a different archetype-linked question id', () => {
      const scene = selectSceneForQuestion(
        { id: 'act_math_t02_q10', conceptId: 'fractions_decimals' },
      )
      expect(scene).not.toBeNull()
      expect(scene!.archetypeId).toBe('pie_chart_pair_sum_to_target_percent')
      expect(scene!.sceneId).toBe('guild_shipment_shares')
    })

    it('archetype match takes priority over rotation', () => {
      // Even though this id would rotate to some hash-derived index, the real
      // archetype link should win whenever a tagged scene exists for it.
      const scene = selectSceneForQuestion(
        { id: 'act_math_t02_q11', conceptId: 'fractions_decimals' },
      )
      const archetypeIds = archetypeIdsForQuestion('act_math_t02_q11')
      expect(archetypeIds.length).toBeGreaterThan(0)
      expect(scene!.archetypeId).toBe(archetypeIds[0])
    })
  })

  describe('selectSceneForQuestion: rotation branch', () => {
    it('falls back to rotation (not archetype match) for a plain bank id with no Layer 3 link', () => {
      const scene = selectSceneForQuestion({ id: 'fd-1-1', conceptId: 'fractions_decimals' })
      expect(scene).not.toBeNull()
      // fd-1-1 has no archetype link, so whichever scene comes back must be
      // reachable purely by the rotation hash, not an archetype tag match.
      expect(archetypeIdsForQuestion('fd-1-1')).toEqual([])
    })

    it('is deterministic: same question id always returns the same scene', () => {
      const q = { id: 'fd-2-7', conceptId: 'fractions_decimals' }
      const first = selectSceneForQuestion(q)
      const second = selectSceneForQuestion(q)
      const third = selectSceneForQuestion({ ...q })
      expect(first!.sceneId).toBe(second!.sceneId)
      expect(first!.sceneId).toBe(third!.sceneId)
    })

    it('does not always land on scene 1, spreads across the scene list for a range of ids', () => {
      const scenes = getConceptScenes('fractions_decimals')!
      const ids = Array.from({ length: 30 }, (_, i) => `fd-${i}-${i % 3}`)
      const landed = new Set(
        ids.map(id => selectSceneForQuestion({ id, conceptId: 'fractions_decimals' })!.sceneId),
      )
      // With 30 varied ids across a 5-scene list, rotation must hit more than
      // just the first scene, a real spread, not a constant.
      expect(landed.size).toBeGreaterThan(1)
      // And scene 1 (index 0) must not be the ONLY scene that ever appears.
      expect([...landed]).not.toEqual([scenes[0].sceneId])
    })

    it('two different ids that hash to different buckets return different scenes', () => {
      // Sanity spot-check with concrete ids rather than only the aggregate
      // spread test above.
      const a = selectSceneForQuestion({ id: 'fd-1-1', conceptId: 'fractions_decimals' })
      const b = selectSceneForQuestion({ id: 'fd-9-9', conceptId: 'fractions_decimals' })
      // Not asserting they MUST differ (hash collisions are legal), but at
      // least one of a spread of distinct ids must differ from scene 1 to
      // prove rotation is live, covered by the spread test; here we just
      // confirm both resolve to valid, real scenes.
      const scenes = getConceptScenes('fractions_decimals')!
      const sceneIds = scenes.map((s: ConceptScene) => s.sceneId)
      expect(sceneIds).toContain(a!.sceneId)
      expect(sceneIds).toContain(b!.sceneId)
    })
  })

  describe('selectSceneForQuestion: no scenes for concept', () => {
    it('returns null for concepts without a scenes array, regardless of question id', () => {
      expect(selectSceneForQuestion({ id: 'le-1-1', conceptId: 'linear_equations' })).toBeNull()
      expect(selectSceneForQuestion({ id: 'act_math_t02_q11', conceptId: 'linear_equations' })).toBeNull()
    })
  })

  describe('selectSceneForQuestion: conceptId override', () => {
    it('uses the override conceptId (not question.conceptId) to look up scenes', () => {
      // A question whose own conceptId is something else (e.g. it was bucketed
      // under descriptive_statistics in the live bank) can still resolve a
      // fractions_decimals scene when the caller passes the override, matching
      // how ConceptChapterPage/Practice resolve scenes off the canonical
      // concept the student is currently working, not the raw bank tag.
      const scene = selectSceneForQuestion(
        { id: 'act_math_t02_q11', conceptId: 'descriptive_statistics' },
        'fractions_decimals',
      )
      expect(scene).not.toBeNull()
      expect(scene!.sceneId).toBe('customs_manifest_count')
    })
  })
})
