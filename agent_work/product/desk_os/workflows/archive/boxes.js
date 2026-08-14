/* Workspace story-boxes. Agents emit {tone,kicker,title,body,bullets,cta}.
   Tones from the story-card formats + Desk brand. Content stays opaque. */

const BOX_TONES = {
  forest:   { bg: '#143a2e', fg: '#f4efe6', pill: 'rgba(196,245,71,.28)', ink: '#c4f547' },
  lime:     { bg: '#c4f547', fg: '#143a2e', pill: 'rgba(20,58,46,.14)',   ink: '#143a2e' },
  teal:     { bg: '#49A7A7', fg: '#FFF8B5', pill: 'rgba(0,0,0,.16)',      ink: '#FFF8B5' },
  magenta:  { bg: '#E11D74', fg: '#ffffff', pill: 'rgba(0,0,0,.18)',      ink: '#ffffff' },
  mustard:  { bg: '#F0C14B', fg: '#2D1B10', pill: 'rgba(45,27,16,.12)',   ink: '#2D1B10' },
  olive:    { bg: '#6B7A4A', fg: '#F7F4EC', pill: 'rgba(0,0,0,.16)',      ink: '#F7F4EC' },
  lavender: { bg: '#F4F0FF', fg: '#3D2A6D', pill: 'rgba(124,92,200,.18)', ink: '#5B3FA8' },
};

function renderWorkspaceBox(spec, onCta) {
  const t = BOX_TONES[spec.tone] || BOX_TONES.forest;
  const el = document.createElement('article');
  el.className = 'wbox';
  el.style.background = t.bg;
  el.style.color = t.fg;
  const kicker = spec.kicker
    ? `<span class="wbox-pill" style="background:${t.pill};color:${t.ink}">${escapeHtml(spec.kicker)}</span>`
    : '';
  const bullets = (spec.bullets || [])
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('');
  const cta = spec.cta
    ? `<button class="wbox-cta" type="button">${escapeHtml(spec.cta)}</button>`
    : '';
  el.innerHTML = `
    ${kicker}
    <h3>${escapeHtml(spec.title || '')}</h3>
    ${spec.body ? `<p>${escapeHtml(spec.body)}</p>` : ''}
    ${bullets ? `<ul>${bullets}</ul>` : ''}
    ${cta}
  `;
  const btn = el.querySelector('.wbox-cta');
  if (btn && onCta) btn.addEventListener('click', () => onCta(spec));
  return el;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

window.DeskBoxes = { BOX_TONES, renderWorkspaceBox, escapeHtml };
