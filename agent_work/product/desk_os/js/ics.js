/**
 * Deterministic ICS parser. No LLM.
 * Accepts pasted .ics text (Google / Apple / Moodle export).
 */

import { semesterFromDate } from './semester.js';
import { COURSES } from './classify.js';

function unfold(ics) {
  return String(ics || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function prop(block, name) {
  const re = new RegExp(`^${name}[;:](.*)$`, 'mi');
  const m = block.match(re);
  if (!m) return '';
  return m[1].replace(/^.*?:/, '').trim();
}

function parseIcsDate(raw) {
  if (!raw) return null;
  const clean = raw.replace(/Z$/, '');
  // YYYYMMDD or YYYYMMDDTHHMMSS
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return iso;
}

function guessCourse(summary) {
  const s = String(summary || '').toLowerCase();
  const rules = [
    [/chem|stoich|mole/, 'ap-chem'],
    [/algebra|quadratic|math/, 'algebra-ii'],
    [/history|reconstruction|civil war/, 'us-history'],
    [/english|essay|lit/, 'english'],
    [/bio|cell|enzyme/, 'ap-bio'],
  ];
  for (const [re, id] of rules) {
    if (re.test(s)) return COURSES.find((c) => c.id === id);
  }
  return COURSES.find((c) => c.id === 'unsorted');
}

/** @returns {{ id: string, title: string, date: string, courseId: string, courseName: string, semesterId: string, semesterLabel: string, source: string }[]} */
export function parseIcs(text) {
  const body = unfold(text);
  const blocks = body.split(/BEGIN:VEVENT/i).slice(1);
  const out = [];

  for (const chunk of blocks) {
    const block = chunk.split(/END:VEVENT/i)[0] || '';
    const title = prop(block, 'SUMMARY') || 'Untitled event';
    const due = parseIcsDate(prop(block, 'DUE'))
      || parseIcsDate(prop(block, 'DTSTART'))
      || null;
    if (!due) continue;
    const course = guessCourse(title);
    const sem = semesterFromDate(due);
    const uid = prop(block, 'UID') || `${title}-${due}`;
    out.push({
      id: `evt_${uid}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80),
      title: title.replace(/\\,/g, ',').replace(/\\n/g, ' '),
      date: due,
      courseId: course.id,
      courseName: course.name,
      semesterId: sem.id,
      semesterLabel: sem.label,
      source: 'ics',
    });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export function daysUntil(iso, today = new Date()) {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = iso.split('-').map(Number);
  const u = Date.UTC(y, m - 1, d);
  return Math.round((u - t) / 86400000);
}
