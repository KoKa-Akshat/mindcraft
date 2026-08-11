/** Live ivory transcript · speakers rail · calm chrome */

import { enableResizeHandles, enableSheetDrag } from './float.js';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayStamp() {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function uid() {
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** @param {string} line */
function parseSpeaker(line) {
  const m = String(line || '').match(/^\s*(?:\[?(speaker\s*(\d+)|teacher|student|ms\.?\s*\w+|mr\.?\s*\w+|mx\.?\s*\w+)\]?)\s*[:\-]\s*(.+)$/i);
  if (!m) return { speaker: null, text: String(line || '').trim() };
  const tag = m[1];
  const num = m[2] ? Number(m[2]) : null;
  let key = 's1';
  if (num && num >= 1 && num <= 5) key = `s${num}`;
  else if (/teacher/i.test(tag)) key = 's1';
  else if (/student/i.test(tag)) key = 's2';
  else key = 's2';
  return { speaker: key, text: m[3].trim(), label: tag };
}

/**
 * @param {{
 *   plane: HTMLElement,
 *   onBoop?: (kind: 'summary'|'dues'|'mission', ctx: { lines: string[], text: string, el: HTMLElement }) => void,
 *   attachSheet?: (el: HTMLElement) => void,
 * }} opts
 */
export function createTranscriptSurface({ plane, onBoop, attachSheet }) {
  /** @type {HTMLElement | null} */
  let activeEl = null;
  /** @type {{ text: string, speaker: string | null }[]} */
  let finals = [];
  let interim = '';
  let live = false;
  /** @type {Set<string>} */
  const speakersSeen = new Set();
  /** @type {Record<string, string>} */
  const names = { s1: '', s2: '', s3: '', s4: '', s5: '' };

  function placeLiveDot(el) {
    const win = el.querySelector('.sheet-win');
    if (!win || win.querySelector('.live-dot')) return;
    const dot = document.createElement('span');
    dot.className = 'live-dot';
    dot.setAttribute('aria-label', 'Recording');
    dot.title = 'Live';
    // Before − and ×
    win.insertBefore(dot, win.firstChild);
  }

  function syncSpeakerRail() {
    if (!activeEl) return;
    const rail = activeEl.querySelector('[data-speaker-rail]');
    const body = activeEl.querySelector('[data-transcript-body]');
    if (!rail || !body) return;
    const multi = speakersSeen.size >= 2;
    activeEl.classList.toggle('has-speakers', multi);
    rail.hidden = !multi;
    if (!multi) return;
    const list = rail.querySelector('[data-speaker-list]');
    if (!list) return;
    const keys = ['s1', 's2', 's3', 's4', 's5'].filter((k) => speakersSeen.has(k) || names[k]);
    // Always show up to max(seen, 2) slots, max 5
    const n = Math.min(5, Math.max(keys.length, speakersSeen.size, 2));
    list.innerHTML = '';
    for (let i = 1; i <= n; i += 1) {
      const key = `s${i}`;
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="sp-n">${i}.</span>
        <input type="text" maxlength="24" data-sp="${key}" placeholder="name" value="${escapeHtml(names[key] || '')}" autocomplete="off" />
      `;
      const input = li.querySelector('input');
      input?.addEventListener('input', () => {
        names[key] = input.value.trim();
        paint();
      });
      input?.addEventListener('pointerdown', (e) => e.stopPropagation());
      list.appendChild(li);
    }
  }

  function displayName(key) {
    if (!key) return '';
    const n = names[key];
    if (n) return n;
    return key.replace(/^s/, 'Speaker ');
  }

  function ensurePage() {
    if (activeEl && plane.contains(activeEl)) return activeEl;

    const id = uid();
    const el = document.createElement('aside');
    el.className = 'paper-sheet transcript-sheet is-live';
    el.dataset.sheet = id;
    el.dataset.kind = 'transcript';
    // Fresh page on the desk · percent so it lands on the current wallpaper canvas
    el.style.left = '22%';
    el.style.top = '10%';
    el.style.width = '50%';
    el.style.height = '62%';
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule" aria-hidden="true"></div>
      <header class="transcript-head sheet-chrome">
        <p class="page-kicker">live class · ${escapeHtml(todayStamp())}</p>
      </header>
      <div class="transcript-body" data-transcript-body>
        <div class="transcript-ink" data-ink></div>
        <aside class="speaker-rail" data-speaker-rail hidden aria-label="Speakers">
          <p class="speaker-rail-kicker">speakers</p>
          <ol class="speaker-list" data-speaker-list></ol>
        </aside>
      </div>
      <footer class="transcript-foot" hidden>
        <button type="button" class="boop-primary" data-boop="summary">
          <span class="hl">Boop · summary notes</span>
        </button>
        <div class="boop-row">
          <button type="button" data-boop="dues">Pull dues</button>
          <span class="auth-sep" aria-hidden="true">·</span>
          <button type="button" data-boop="mission">Open mission</button>
        </div>
      </footer>
    `;

    plane.appendChild(el);
    if (attachSheet) attachSheet(el);
    else {
      enableResizeHandles(el);
      enableSheetDrag(el, '.sheet-chrome, .page-kicker, .transcript-head');
    }
    placeLiveDot(el);

    el.querySelectorAll('[data-boop]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const kind = btn.getAttribute('data-boop');
        const text = finals.map((f) => f.text).join('\n');
        onBoop?.(/** @type {'summary'|'dues'|'mission'} */ (kind), {
          lines: finals.map((f) => f.text),
          text,
          el,
        });
      });
    });

    activeEl = el;
    finals = [];
    interim = '';
    speakersSeen.clear();
    return el;
  }

  function paint() {
    const el = activeEl;
    if (!el) return;
    const ink = el.querySelector('[data-ink]');
    if (!ink) return;
    const settled = finals.map((row) => {
      const who = row.speaker
        ? `<span class="ink-who">${escapeHtml(displayName(row.speaker))}</span>`
        : '';
      return `<p class="ink-line settled">${who}${escapeHtml(row.text)}</p>`;
    }).join('');
    const ghost = interim
      ? `<p class="ink-line interim">${escapeHtml(interim)}</p>`
      : (live && !finals.length ? `<p class="ink-line interim">Listening…</p>` : '');
    ink.innerHTML = settled + ghost;
    ink.scrollTop = ink.scrollHeight;
    syncSpeakerRail();
  }

  return {
    open() {
      const el = ensurePage();
      live = true;
      el.hidden = false;
      el.classList.remove('is-min', 'is-done', 'page-away');
      el.classList.add('is-live');
      el.style.zIndex = '32';
      // Keep a generous working size each open
      if (!el.classList.contains('is-journal-open')) {
        el.style.width = el.style.width || '640px';
        el.style.height = el.style.height || '520px';
        if (parseFloat(el.style.width) < 480) el.style.width = '640px';
        if (parseFloat(el.style.height) < 360) el.style.height = '520px';
      }
      placeLiveDot(el);
      const foot = el.querySelector('.transcript-foot');
      if (foot) foot.hidden = true;
      finals = [];
      interim = '';
      speakersSeen.clear();
      paint();
      return el;
    },

    /** @param {string} line */
    pushFinal(line) {
      const parsed = parseSpeaker(line);
      if (!parsed.text) return;
      ensurePage();
      if (parsed.speaker) speakersSeen.add(parsed.speaker);
      finals.push({ text: parsed.text, speaker: parsed.speaker });
      interim = '';
      paint();
    },

    /** @param {string} text */
    setInterim(text) {
      ensurePage();
      const t = String(text || '').trim();
      const joined = finals.map((f) => f.text).join(' ').trim();
      if (joined && t.startsWith(joined)) {
        interim = t.slice(joined.length).trim();
      } else if (finals.length && t.includes(finals[finals.length - 1].text)) {
        const last = finals[finals.length - 1].text;
        const idx = t.lastIndexOf(last);
        interim = t.slice(idx + last.length).trim();
      } else {
        interim = t;
      }
      paint();
    },

    /** @param {string} [fullText] */
    complete(fullText) {
      ensurePage();
      live = false;
      if (activeEl) {
        activeEl.classList.remove('is-live');
        activeEl.classList.add('is-done');
        const foot = activeEl.querySelector('.transcript-foot');
        if (foot) foot.hidden = false;
      }
      if (fullText && !finals.length) {
        finals = String(fullText)
          .split(/(?<=[.!?])\s+|\n+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((line) => {
            const p = parseSpeaker(line);
            if (p.speaker) speakersSeen.add(p.speaker);
            return { text: p.text, speaker: p.speaker };
          });
      }
      interim = '';
      paint();
      return {
        lines: finals.map((f) => f.text),
        text: finals.map((f) => f.text).join('\n'),
        el: activeEl,
      };
    },

    getActive() {
      return activeEl;
    },

    getText() {
      return finals.map((f) => f.text).join('\n');
    },
  };
}

export function boopSummaryLines(lines) {
  const src = lines.filter(Boolean);
  if (!src.length) return ['(empty recording)'];
  const hw = src.find((l) => /homework|due|friday|monday|quiz|lab/i.test(l));
  const out = [];
  out.push(src[0]);
  if (hw && hw !== src[0]) out.push(hw);
  if (src.length > 1 && src[src.length - 1] !== out[out.length - 1]) {
    out.push(src[src.length - 1]);
  }
  return out.slice(0, 5);
}

export function boopExtractDue(text) {
  const m = String(text || '').match(/due\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)/i);
  if (!m) return null;
  return `Something is due ${m[1].toLowerCase()}`;
}
