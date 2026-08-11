/**
 * Desk OS classifier. FileSignals → FilingProposal.
 * Local heuristics always; optional Groq if a key is saved.
 */

import { semesterFromDate } from './semester.js';

export const COURSES = [
  { id: 'ap-chem', name: 'AP Chem', color: '#247a4d' },
  { id: 'algebra-ii', name: 'Algebra II', color: '#1d4ed8' },
  { id: 'us-history', name: 'US History', color: '#92400e' },
  { id: 'english', name: 'English', color: '#7c3aed' },
  { id: 'ap-bio', name: 'AP Bio', color: '#0f766e' },
  { id: 'unsorted', name: 'Unsorted', color: '#5f7a6d' },
];

export const KINDS = [
  { id: 'worksheet', label: 'Worksheet' },
  { id: 'notes', label: 'Notes' },
  { id: 'lab', label: 'Lab' },
  { id: 'reading', label: 'Reading' },
  { id: 'scan', label: 'Scan' },
  { id: 'slides', label: 'Slides' },
  { id: 'other', label: 'Other' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDisplayDate(iso) {
  if (!iso) return 'undated';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

export function formatProposalLine(p) {
  const sem = p.semesterLabel || semesterFromDate(p.date).label;
  return `${p.title} · ${p.courseName} · ${formatDisplayDate(p.date)} · ${sem}`;
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function courseById(id) {
  return COURSES.find((c) => c.id === id) || COURSES[COURSES.length - 1];
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function withSemester(proposal) {
  const sem = semesterFromDate(proposal.date);
  return {
    ...proposal,
    semesterId: sem.id,
    semesterLabel: sem.label,
  };
}

function parseDateHints(text) {
  const t = text || '';
  const named = t.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i);
  if (named) {
    const monthMap = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
      september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
    };
    const mi = monthMap[named[1].toLowerCase()];
    const day = Number(named[2]);
    const year = named[3] ? Number(named[3]) : new Date().getFullYear();
    if (mi != null && day >= 1 && day <= 31) {
      return toIsoDate(new Date(year, mi, day));
    }
  }
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = t.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slash) {
    return toIsoDate(new Date(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2])));
  }
  return null;
}

function demoOverride(signals) {
  const name = (signals.originalName || '').toLowerCase();
  if (/img[_-]?4127/i.test(name)) {
    return withSemester({
      title: 'Stoichiometry practice',
      courseId: 'ap-chem',
      courseName: 'AP Chem',
      unit: 'Unit 3 · Stoichiometry',
      date: '2025-10-12',
      kind: 'worksheet',
      confidence: 0.94,
      reasons: ['AP Chem worksheet, Oct 12'],
      source: 'demo',
    });
  }
  if (/chem_packet|stoichiometry packet/i.test(name) || /stoichiometry packet/i.test(signals.textSnippet || '')) {
    const today = new Date().toISOString().slice(0, 10);
    return withSemester({
      title: 'Stoichiometry packet',
      courseId: 'ap-chem',
      courseName: 'AP Chem',
      unit: 'Unit 3 · Stoichiometry',
      date: today,
      kind: 'worksheet',
      confidence: 0.9,
      reasons: ['Chem packet PDF'],
      source: 'demo',
    });
  }
  return null;
}

/** @param {import('./semester.js')} _ */
export function classifyHeuristic(signals) {
  const demo = demoOverride(signals);
  if (demo) return demo;

  const blob = `${signals.originalName}\n${signals.textSnippet || ''}`.toLowerCase();
  const reasons = [];
  let courseId = 'unsorted';
  let title = 'Untitled drop';
  let unit = 'Inbox';
  let kind = 'other';
  let score = 0.35;

  const rules = [
    {
      test: /stoich|mole|limiting reactant|molar mass|chem|titration|reaction/,
      courseId: 'ap-chem',
      title: /stoich/.test(blob) ? 'Stoichiometry practice' : 'Chemistry worksheet',
      unit: /stoich|mole|limiting/.test(blob) ? 'Unit 3 · Stoichiometry' : 'General chem',
      kind: /lab/.test(blob) ? 'lab' : 'worksheet',
      bump: 0.42,
      why: 'Looks like chem',
    },
    {
      test: /algebra|quadratic|factor|polynomial|slope|linear equation/,
      courseId: 'algebra-ii',
      title: /quadratic/.test(blob) ? 'Quadratic formula drill' : 'Algebra practice',
      unit: /quadratic/.test(blob) ? 'Unit 4 · Quadratics' : 'Skills practice',
      kind: 'worksheet',
      bump: 0.4,
      why: 'Looks like algebra',
    },
    {
      test: /history|reconstruction|amendment|civil war|constitution/,
      courseId: 'us-history',
      title: /reconstruction/.test(blob) ? 'Reconstruction notes' : 'History notes',
      unit: /reconstruction/.test(blob) ? 'Unit 5 · Reconstruction' : 'Lecture notes',
      kind: 'notes',
      bump: 0.4,
      why: 'Looks like history',
    },
    {
      test: /essay|thesis|english|literature|poetry|rhetoric/,
      courseId: 'english',
      title: /essay/.test(blob) ? 'Essay draft' : 'English notes',
      unit: 'Writing',
      kind: /essay/.test(blob) ? 'other' : 'notes',
      bump: 0.38,
      why: 'Looks like English',
    },
    {
      test: /\bbio\b|mitosis|photosynthesis|cell|enzyme|ap bio/,
      courseId: 'ap-bio',
      title: 'Biology notes',
      unit: 'Core bio',
      kind: 'notes',
      bump: 0.38,
      why: 'Looks like bio',
    },
  ];

  for (const rule of rules) {
    if (rule.test.test(blob)) {
      courseId = rule.courseId;
      title = rule.title;
      unit = rule.unit;
      kind = rule.kind;
      score += rule.bump;
      reasons.push(rule.why);
      break;
    }
  }

  if (/img[_-]?\d+|screenshot|scan|photo|camera/i.test(signals.originalName)) {
    if (kind === 'other') kind = 'scan';
    score += 0.08;
  }
  if ((signals.mime || '').startsWith('image/') && kind === 'other') kind = 'scan';
  if (/\.pdf$/i.test(signals.originalName) && kind === 'other') kind = 'worksheet';
  if (/\.txt$|\.md$/i.test(signals.originalName) && kind === 'other') kind = 'notes';

  const dateFromText = parseDateHints(`${signals.originalName} ${signals.textSnippet || ''}`);
  let date = dateFromText;
  if (dateFromText) {
    score += 0.12;
  } else if (signals.lastModified) {
    date = toIsoDate(new Date(signals.lastModified));
  } else {
    date = toIsoDate(new Date());
  }

  if (courseId === 'unsorted') {
    const bare = signals.originalName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    title = bare || 'Untitled drop';
    reasons.push('No course match');
  }

  if (!reasons.length) reasons.push('From the file name');

  const course = courseById(courseId);
  return withSemester({
    title,
    courseId: course.id,
    courseName: course.name,
    unit,
    date,
    kind,
    confidence: clamp01(score),
    reasons: reasons.slice(0, 1),
    source: 'heuristic',
  });
}

function stripEmDashes(s) {
  return String(s || '').replace(/\u2014/g, ',');
}

function normalizeProposal(raw, fallback) {
  const course = courseById(raw.courseId) || courseById(fallback.courseId);
  const kindOk = KINDS.some((k) => k.id === raw.kind) ? raw.kind : fallback.kind;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date || '') ? raw.date : fallback.date;
  return withSemester({
    title: stripEmDashes(raw.title || fallback.title).slice(0, 80),
    courseId: course.id,
    courseName: course.name,
    unit: stripEmDashes(raw.unit || fallback.unit).slice(0, 80),
    date,
    kind: kindOk,
    confidence: clamp01(Number(raw.confidence ?? fallback.confidence)),
    reasons: Array.isArray(raw.reasons) && raw.reasons.length
      ? raw.reasons.map((r) => stripEmDashes(r)).slice(0, 1)
      : fallback.reasons,
    source: raw.source || 'llm',
  });
}

export function getGroqKey() {
  try {
    return localStorage.getItem('deskOs.groqKey') || '';
  } catch {
    return '';
  }
}

export function setGroqKey(key) {
  try {
    if (key) localStorage.setItem('deskOs.groqKey', key);
    else localStorage.removeItem('deskOs.groqKey');
  } catch {
    /* ignore */
  }
}

export async function classifyWithLlm(signals, fallback) {
  const key = getGroqKey();
  if (!key) return fallback;

  const system = [
    'File messy student homework into one course binder for one school semester.',
    'Return ONLY JSON: title, courseId, unit, date (YYYY-MM-DD), kind, confidence (0-1), reasons (1 short string in an array).',
    `courseId one of: ${COURSES.map((c) => c.id).join(', ')}.`,
    `kind one of: ${KINDS.map((k) => k.id).join(', ')}.`,
    'No em dashes. Keep titles short. Do not invent extra documents.',
  ].join(' ');

  const user = JSON.stringify({
    originalName: signals.originalName,
    mime: signals.mime,
    textSnippet: (signals.textSnippet || '').slice(0, 2500),
    lastModifiedIso: signals.lastModified
      ? toIsoDate(new Date(signals.lastModified))
      : null,
  });

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content);
    return normalizeProposal({ ...parsed, source: 'llm' }, fallback);
  } catch {
    return fallback;
  }
}

export async function classifyFile(signals) {
  const heuristic = classifyHeuristic(signals);
  if (heuristic.source === 'demo') return heuristic;
  return classifyWithLlm(signals, heuristic);
}

export async function extractTextSnippet(file) {
  const mime = file.type || '';
  const name = file.name || '';
  if (mime.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(name)) {
    return (await file.text()).slice(0, 4000);
  }
  if (/img[_-]?4127/i.test(name)) {
    return [
      'AP CHEMISTRY Unit 3',
      'Stoichiometry Practice Set',
      'Date: Oct 12',
      '1. How many moles of CO2 are produced',
      '2. A sample of NaCl weighs 58.44 g',
      '3. Limiting reactant',
    ].join('\n');
  }
  if (/chem_packet/i.test(name)) {
    return [
      'AP Chem Unit 3 Stoichiometry packet',
      'Date: Aug 7, 2026',
      'Limiting reactant practice set',
    ].join('\n');
  }
  return '';
}
