/**
 * Pipeline stage 2 · Tag
 * Attach subject, concept hints, and interaction intent to each source.
 */

const SUBJECT_TAGS = {
  act_math: {
    domain: 'math',
    instanceKind: 'act',
    badge: 'ACT',
    concepts: ['linear_equations', 'functions_basics', 'ratios'],
    interaction: 'mcq',
  },
  piano: {
    domain: 'music',
    instanceKind: 'piano',
    badge: 'Piano',
    concepts: ['hand_position', 'five_finger', 'simple_melody'],
    interaction: 'piano',
  },
  biology: {
    domain: 'science',
    instanceKind: 'book',
    badge: 'Book',
    concepts: ['cells', 'systems'],
    interaction: 'quiz',
  },
  chemistry: {
    domain: 'science',
    instanceKind: 'book',
    badge: 'Book',
    concepts: ['stoichiometry', 'moles'],
    interaction: 'quiz',
  },
  history: {
    domain: 'humanities',
    instanceKind: 'book',
    badge: 'Book',
    concepts: ['timeline', 'cause_effect'],
    interaction: 'quiz',
  },
  custom: {
    domain: 'custom',
    instanceKind: 'book',
    badge: 'Book',
    concepts: ['general'],
    interaction: 'quiz',
  },
};

export function subjectMeta(subjectId) {
  return SUBJECT_TAGS[subjectId] || SUBJECT_TAGS.custom;
}

/**
 * Heuristic concept pick from prompt/text (no LLM required).
 * @param {string} blob
 * @param {string[]} pool
 */
export function guessConcept(blob, pool) {
  const t = String(blob || '').toLowerCase();
  for (const c of pool || []) {
    const token = c.replace(/_/g, ' ');
    if (t.includes(token) || t.includes(c)) return c;
  }
  if (/scale|finger|keyboard|melody|piano|c major|minuet/.test(t)) return 'five_finger';
  if (/equation|solve|algebra|linear/.test(t)) return 'linear_equations';
  if (/function|f\(x\)|graph/.test(t)) return 'functions_basics';
  return pool?.[0] || 'general';
}

/**
 * @param {import('./extract.js').ExtractedSource[]} extracted
 * @param {{ id: string, label?: string }} subject
 */
export function tagSources(extracted, subject) {
  const meta = subjectMeta(subject?.id || 'custom');
  return (extracted || []).map((s, i) => {
    const blob = `${s.prompt || ''} ${s.text || ''} ${s.name || ''}`;
    const concept = guessConcept(blob, meta.concepts);
    return {
      ...s,
      tags: {
        subjectId: subject?.id || 'custom',
        subjectLabel: subject?.label || meta.badge,
        domain: meta.domain,
        concept,
        interaction: meta.interaction,
        order: i,
        prompt: (s.prompt || '').trim() || `Work from ${s.name}`,
      },
    };
  });
}

export { SUBJECT_TAGS };
