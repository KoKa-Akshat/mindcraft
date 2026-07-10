/**
 * spark-engine.mjs — First Spark deterministic fusion engine.
 *
 * Interests → lexicon entries → cluster vote → flagship story cell →
 * woven multi-hobby intro (primary scene + secondary thread, one scene).
 * No LLM, no DOM — safe to run in the browser AND in node (acceptance tests).
 *
 * CANONICAL copy: app/public/demo/v2/spark-engine.mjs
 * Synced copies:  spark/spark-engine.mjs (marketing overlay)
 * Sync via:       node app/scripts/syncSparkAssets.mjs
 *
 * Contracts honored:
 * - Math is frozen: the engine never touches question/choices/correctIndex —
 *   weaving happens ONLY in the intro templates.
 * - C4 hide-correctness: engine exposes world_feedback for in-world response;
 *   callers must never render ✓/✗ verdicts.
 */

const WORD_RE = /[^a-z0-9\s]/g

export function normalize(raw) {
  return String(raw ?? '').toLowerCase().replace(WORD_RE, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(text) {
  return normalize(text).split(' ').filter(w => w.length > 1)
}

function hashString(s) {
  let h = 0
  for (const ch of s) h = ((h << 5) - h + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

/**
 * Resolve one free-text interest against the lexicon.
 * Match ladder: exact key → alias → token/substring → keyword overlap.
 * Always returns an entry — unmatched input gets a graceful fallback with
 * the visitor's own words as the scene noun.
 */
export function resolveInterest(raw, lexicon) {
  const clean = normalize(raw)
  const tokens = tokenize(clean)

  if (lexicon[clean]) return { raw, key: clean, entry: lexicon[clean], matched: true, weight: 1 }

  for (const [key, entry] of Object.entries(lexicon)) {
    if ((entry.aliases ?? []).some(a => normalize(a) === clean)) {
      return { raw, key, entry, matched: true, weight: 0.95 }
    }
  }

  // token / substring: "video games" → gaming, "cooking shows" → cooking
  for (const [key, entry] of Object.entries(lexicon)) {
    const names = [key, ...(entry.aliases ?? []).map(normalize)]
    for (const name of names) {
      if (!name) continue
      if (tokens.includes(name) || clean.includes(name) || (name.length > 3 && name.includes(clean) && clean.length > 3)) {
        return { raw, key, entry, matched: true, weight: 0.8 }
      }
      const nameTokens = tokenize(name)
      if (nameTokens.length > 1 && nameTokens.some(t => tokens.includes(t))) {
        return { raw, key, entry, matched: true, weight: 0.6 }
      }
    }
  }

  // keyword overlap: "loot boxes" → gaming (keyword "loot")
  let best = null
  for (const [key, entry] of Object.entries(lexicon)) {
    const hits = (entry.keywords ?? []).filter(k => tokens.includes(normalize(k))).length
    if (hits > 0 && (!best || hits > best.hits)) best = { key, entry, hits }
  }
  if (best) return { raw, key: best.key, entry: best.entry, matched: true, weight: 0.5 }

  // graceful fallback — the visitor's own words become the scene noun
  return {
    raw,
    key: clean,
    entry: { cluster: null, scene_noun: `the world of ${clean}`, themes: [], concepts: [], keywords: tokens, aliases: [] },
    matched: false,
    weight: 0,
  }
}

/** Cluster vote: weighted by match quality; ties go to the earlier-typed interest. */
export function pickCluster(resolved, bank) {
  const votes = new Map()
  resolved.forEach((r, i) => {
    const c = r.entry.cluster
    if (!c || !bank.clusters[c]) return
    const w = r.weight * (1 - i * 0.05) // slight primacy to earlier chips
    votes.set(c, (votes.get(c) ?? 0) + w)
  })
  let bestCluster = null
  let bestScore = -1
  for (const r of resolved) {
    const c = r.entry.cluster
    if (!c || !bank.clusters[c]) continue
    const s = votes.get(c)
    if (s > bestScore) { bestScore = s; bestCluster = c }
  }
  return bestCluster ?? bank.default_cluster ?? 'discovery'
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function fillTemplate(tpl, a, b) {
  return tpl
    .replaceAll('{a_noun}', a.entry.scene_noun)
    .replaceAll('{b_noun}', b.entry.scene_noun)
    .replaceAll('{A}', capitalize(normalize(a.raw)))
    .replaceAll('{B}', capitalize(normalize(b.raw)))
    .replaceAll('{a}', normalize(a.raw))
    .replaceAll('{b}', normalize(b.raw))
}

export function interestLine(list) {
  if (list.length <= 1) return list[0] ?? ''
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

/**
 * Cell selection: pick the story cell whose math MECHANIC belongs to the
 * visitor's interests, not just whose theme is adjacent (see
 * agent_work/product/STORY_QUESTION_QUALITY_GUIDE.md — the Action step of
 * situation/task/action/result must be native to the scene).
 *
 * Only flagship-quality cells (those with introTemplates) are eligible —
 * they are the ones authored to weave two interests into one scene.
 * Score = cluster fit + concept fit: an interest whose lexicon entry lists
 * the cell's conceptId pulls that cell up, weighted by match quality, typing
 * order, and the concept's position in the entry's list. The cluster
 * flagship wins ties, so behavior without concept signal is unchanged.
 */
export function pickCell(resolved, clusterId, cluster, bank) {
  const eligible = bank.questions.filter(q => (q.introTemplates ?? []).length > 0)
  if (!eligible.length) {
    return bank.questions.find(q => q.id === cluster.flagship)
      ?? bank.questions.find(q => q.conceptId === cluster.concepts?.[0])
      ?? bank.questions[0]
  }
  let best = null
  let bestScore = -Infinity
  for (const q of eligible) {
    let s = 0
    // Cluster fit dominates: the primary SCENE stays in the winning cluster
    // (brief rule: thread the secondary interest, don't switch worlds).
    if (q.cluster === clusterId) s += 2
    if (q.id === cluster.flagship) s += 0.01 // stable tie-break
    // Concept fit decides WITHIN the cluster: an entry's first-listed concept
    // is its native mechanic (nursing → ratios/dosage), later ones fade fast.
    resolved.forEach((r, i) => {
      const idx = (r.entry.concepts ?? []).indexOf(q.conceptId)
      if (idx >= 0) s += r.weight * (1 - i * 0.05) * Math.max(0.2, 1 - idx * 0.5)
    })
    if (s > bestScore) { bestScore = s; best = q }
  }
  return best
}

/**
 * The core: 2–4 interests in, one collided scene out.
 * Returns a payload shaped like the spark-experience API response.
 */
export function fuse(interests, bank) {
  const resolved = interests.map(i => resolveInterest(i, bank.lexicon ?? {}))
  const clusterId = pickCluster(resolved, bank)
  const cluster = bank.clusters[clusterId]

  // primary = first typed interest belonging to the winning cluster
  const primary = resolved.find(r => r.entry.cluster === clusterId) ?? resolved[0]
  // secondary = first typed interest that isn't the primary (prefer a different cluster)
  const others = resolved.filter(r => r !== primary)
  const secondary = others.find(r => r.entry.cluster !== clusterId) ?? others[0] ?? primary

  const cell = pickCell(resolved, clusterId, cluster, bank)

  const templates = cell.introTemplates ?? []
  const storyIntro = templates.length
    ? fillTemplate(templates[hashString(interests.join('|')) % templates.length], primary, secondary)
    : (cell.storyIntro ?? cell.storyContext ?? '')

  return {
    interests: [...interests],
    clusterId,
    primaryInterest: primary.raw,
    secondaryInterest: secondary.raw,
    conceptId: cell.conceptId,
    questionId: cell.id,
    protagonist: cell.protagonist ?? 'the guide',
    setting: cell.setting ?? '',
    taleTitle: cell.title ?? '',
    storyIntro,
    storyStem: cell.question,
    choices: cell.choices,
    correctIndex: cell.correctIndex,
    worldFeedback: cell.world_feedback ?? {
      correct: 'The scene holds.',
      incorrect: 'Pause. Read what the scene was really asking.',
    },
    generated: false,
  }
}
