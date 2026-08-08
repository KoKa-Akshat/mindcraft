/**
 * Cleanup pass: scan desk cards, score relevance, draft short summaries.
 * Deterministic first; optional LLM later. No invented claims.
 */

import { daysUntil } from './ics.js';
import { formatDisplayDate } from './classify.js';

function scoreCard(card) {
  let score = 0.35;
  const reasons = [];
  if (card.type === 'due') {
    const d = daysUntil(card.date);
    if (d >= 0 && d <= 3) { score += 0.45; reasons.push('due soon'); }
    else if (d >= 0 && d <= 10) { score += 0.25; reasons.push('upcoming'); }
    else if (d < 0) { score -= 0.15; reasons.push('already past'); }
  }
  if (card.type === 'transcript') { score += 0.2; reasons.push('class take'); }
  if (card.type === 'file' || card.type === 'worksheet') { score += 0.15; reasons.push('filed work'); }
  if (card.type === 'mail') { score += 0.12; reasons.push('teacher mail'); }
  if (card.type === 'draft') { score += 0.08; reasons.push('draft'); }
  if (/stoich|chem|quiz|essay|lab/i.test(`${card.title} ${card.unit || ''}`)) {
    score += 0.08;
    reasons.push('matches active coursework');
  }
  return {
    ...card,
    relevance: Math.max(0, Math.min(1, score)),
    keepDefault: score >= 0.45,
    reasons,
  };
}

export function summarizeCard(card) {
  if (card.type === 'due') {
    return `Due ${formatDisplayDate(card.date)} for ${card.courseName}. Keep this if it is still on your list.`;
  }
  if (card.type === 'transcript') {
    const bit = (card.snippet || 'Notes from class.').slice(0, 140);
    return `Class recording for ${card.courseName}. ${bit}`;
  }
  if (card.type === 'file') {
    return `${card.kind || 'File'} for ${card.courseName}${card.unit ? ` · ${card.unit}` : ''}. Came from ${card.originalName || 'an upload'}.`;
  }
  if (card.type === 'mail') {
    return `From ${card.from || 'your teacher'}. ${(card.snippet || card.body || '').slice(0, 140)}`;
  }
  if (card.type === 'draft') {
    return `Draft to ${card.from || 'recipient'}. Edit before you send.`;
  }
  return card.title || 'Desk item';
}

export function runCleanupScan(cards, termId) {
  const inTerm = cards.filter((c) => !c.semesterId || c.semesterId === termId);
  const scored = inTerm
    .filter((c) => c.type !== 'processing')
    .map((c) => {
      const s = scoreCard(c);
      return { ...s, summary: summarizeCard({ ...c, ...s }) };
    })
    .sort((a, b) => b.relevance - a.relevance);

  const byCourse = {};
  for (const c of scored) {
    const key = c.courseId || 'unsorted';
    if (!byCourse[key]) byCourse[key] = [];
    byCourse[key].push(c.id);
  }

  return {
    items: scored,
    byCourse,
    keepCount: scored.filter((c) => c.keepDefault).length,
    total: scored.length,
  };
}

/** Pack kept cards into tidy course columns (Hivemind tidy). */
export function layoutByCourse(cards, courseOrder = []) {
  const PAD = 48;
  const CW = 280;
  const CH = 168;
  const GAP = 24;
  const COL_GAP = 36;
  const groups = new Map();
  for (const c of cards) {
    const key = c.courseId || 'unsorted';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const keys = [
    ...courseOrder.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !courseOrder.includes(k)),
  ];
  let col = 0;
  for (const key of keys) {
    const list = groups.get(key) || [];
    list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    list.forEach((card, row) => {
      card.x = PAD + col * (CW + COL_GAP);
      card.y = PAD + row * (CH + GAP);
    });
    col += 1;
  }
  return cards;
}
