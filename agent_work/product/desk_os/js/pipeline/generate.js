/**
 * Pipeline stage 3 · Generate
 * Build a playable page list + static HTML fallback from tagged sources.
 * Deterministic spine · language stubs only (LLM later).
 */

import { subjectMeta } from './tag.js';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Purpose-built piano patterns (public-domain pedagogy · not a scanned PDF) */
const PIANO_PATTERNS = {
  five_finger: {
    title: 'C major five-finger',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4'],
    prompt: 'Play ascending, then descending. Keep a steady pulse.',
  },
  hand_position: {
    title: 'Soft curved hand',
    notes: ['C4', 'E4', 'G4'],
    prompt: 'Tap C-E-G as a gentle chord outline.',
  },
  simple_melody: {
    title: 'Twinkle motif (public domain)',
    notes: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'],
    prompt: 'Play the opening motif. Hum once, then play.',
  },
};

/** Purpose-built ACT-style MCQs (local prototype · not live bank sync) */
const ACT_MCQ = {
  linear_equations: {
    stem: 'If 3x - 7 = 11, what is x?',
    choices: ['4', '6', '5', '18/3'],
    answer: 1,
    explain: '3x = 18 → x = 6.',
  },
  functions_basics: {
    stem: 'If f(x) = 2x + 1, what is f(3)?',
    choices: ['5', '6', '7', '8'],
    answer: 2,
    explain: '2(3)+1 = 7.',
  },
  ratios: {
    stem: 'A recipe uses sugar to flour in the ratio 2:5. If there are 10 cups of flour, how much sugar?',
    choices: ['2', '4', '5', '25'],
    answer: 1,
    explain: '2/5 = s/10 → s = 4.',
  },
};

/**
 * @param {{
 *   tagged: object[],
 *   subject: { id: string, label?: string },
 *   title: string,
 * }} opts
 */
export function generateBook({ tagged, subject, title }) {
  const meta = subjectMeta(subject?.id || 'custom');
  const sources = tagged || [];
  const pages = [];

  pages.push({
    type: 'cover',
    title: title || `${subject?.label || meta.badge} Field Book`,
    subtitle: `${subject?.label || meta.badge} · interactive prototype`,
    license: meta.domain === 'music'
      ? 'Purpose-built assets in the spirit of public-domain method books (no scanned PDF ingest yet).'
      : 'Local ACT-style items · same cook path as piano. Live diagnosis optional.',
  });

  pages.push({
    type: 'read',
    title: 'How this book works',
    body: meta.interaction === 'piano'
      ? 'Each chapter turns a tagged source into a short read, then a playable keyboard drill. Tap keys or use Play phrase.'
      : 'Each chapter turns a tagged source into a short read, then a check question. Finish with an optional live diagnosis path for ACT.',
  });

  const chapters = sources.slice(0, 6).map((s, i) => {
    const concept = s.tags?.concept || meta.concepts[i % meta.concepts.length];
    const chapterTitle = s.tags?.prompt || `From ${s.name}`;
    const sims = [];

    pages.push({
      type: 'read',
      title: chapterTitle,
      body: (s.text || '').trim().slice(0, 480)
        || `Chapter drawn from ${s.name}. Tag prompts steer what the drill practices.`,
      concept,
    });

    if (meta.interaction === 'piano') {
      const pat = PIANO_PATTERNS[concept] || PIANO_PATTERNS.five_finger;
      pages.push({
        type: 'piano',
        title: pat.title,
        notes: pat.notes,
        prompt: pat.prompt,
        concept,
      });
      sims.push(`Piano drill · ${pat.title}`);
    } else if (meta.interaction === 'mcq' || subject?.id === 'act_math') {
      const q = ACT_MCQ[concept] || ACT_MCQ.linear_equations;
      pages.push({
        type: 'mcq',
        title: `Check · ${concept.replace(/_/g, ' ')}`,
        stem: q.stem,
        choices: q.choices,
        answer: q.answer,
        explain: q.explain,
        concept,
      });
      sims.push(`MCQ · ${concept}`);
    } else {
      pages.push({
        type: 'quiz',
        title: `Check · ${chapterTitle}`,
        q: `In one line, what is the main idea of “${chapterTitle}”?`,
        placeholder: 'Type a short answer…',
        concept,
      });
      sims.push(`Reflection · ${concept}`);
    }

    return { title: chapterTitle, sims, concept };
  });

  if (!chapters.length) {
    // Seed empty cook with one default drill
    if (meta.interaction === 'piano') {
      const pat = PIANO_PATTERNS.five_finger;
      pages.push({ type: 'piano', title: pat.title, notes: pat.notes, prompt: pat.prompt, concept: 'five_finger' });
      chapters.push({ title: pat.title, sims: [pat.title], concept: 'five_finger' });
    } else {
      const q = ACT_MCQ.linear_equations;
      pages.push({
        type: 'mcq',
        title: 'Check · linear equations',
        stem: q.stem,
        choices: q.choices,
        answer: q.answer,
        explain: q.explain,
        concept: 'linear_equations',
      });
      chapters.push({ title: 'Linear equations', sims: ['MCQ'], concept: 'linear_equations' });
    }
  }

  if (meta.instanceKind === 'act') {
    pages.push({
      type: 'action',
      title: 'Optional · live diagnosis',
      body: 'Open the MindCraft try-diagnostic path (local Vite or live Firebase). Prototype stays local until you choose this.',
      action: 'open-diagnostic',
      label: 'Open /try/diagnostic',
    });
  }

  pages.push({
    type: 'done',
    title: 'Session parked',
    body: 'Progress is saved in this browser only. Call on the hub still works for mastery check-in.',
  });

  const book = {
    id: `book_${Date.now()}`,
    title: title || `${subject?.label || meta.badge} Field Book`,
    subject: subject?.id || 'custom',
    subjectLabel: subject?.label || meta.badge,
    instanceKind: meta.instanceKind,
    badge: meta.badge,
    sources: sources.map((s) => ({
      name: s.name,
      kind: s.kind,
      prompt: s.prompt,
      concept: s.tags?.concept,
    })),
    chapters,
    pages,
    cookedAt: new Date().toISOString(),
    pipeline: ['extract', 'tag', 'generate', 'bind'],
    refs: {
      mccreary: 'https://dmccreary.github.io/intelligent-textbooks/case-studies/',
      mindcraft: 'ml/scripts/pipeline/',
    },
  };

  book.html = buildStaticHtml(book);
  return book;
}

/** Lightweight HTML fallback (iframe / blob) when the JS player is unavailable */
export function buildStaticHtml(book) {
  const pages = book.pages || [];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(book.title)}</title>
<style>
  body{margin:0;font-family:Georgia,serif;background:#f4efe6;color:#1c1a17}
  header{padding:28px 32px;background:#1a222c;color:#f5f5f5}
  header p{margin:0 0 6px;font:500 11px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
  h1{margin:0;font:italic 400 30px/1.15 Georgia,serif}
  main{padding:24px 28px 64px;max-width:720px}
  .pg{border-top:1px solid #e0d6c8;padding:18px 0}
  .pg h2{font:600 18px/1.25 system-ui;margin:0 0 8px}
  .pg p{font:400 15px/1.5 Georgia,serif;margin:0 0 8px;color:#3a3530}
  .chip{display:inline-block;font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#3d6b4f}
</style></head><body>
<header>
  <p>MindCraft · Interactive Field Book</p>
  <h1>${escapeHtml(book.title)}</h1>
</header>
<main>
  <p class="chip">${escapeHtml(book.subjectLabel)} · ${pages.length} pages</p>
  ${pages.map((p, i) => `
    <section class="pg">
      <h2>${i + 1}. ${escapeHtml(p.title || p.type)}</h2>
      <p>${escapeHtml(p.body || p.stem || p.prompt || p.q || p.subtitle || '')}</p>
    </section>`).join('')}
</main>
</body></html>`;
}
