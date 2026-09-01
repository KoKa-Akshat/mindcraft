/**
 * Resume Helper · the in-hub panel Jesse opens in place of Tutors and events
 * (2026-08-31 ask: clicking the mascot beside the Mastery cube toggles the
 * hub between the tutor map and the resume flow the iOS prototype already
 * ships, remembering where the student left off).
 *
 * Two steps, both in place, no navigation:
 *   build · Jesse conversation (the same POST /api/resume-agent the iOS
 *     ResumeAgentView and workflows/resume/agent.js already call, stateless,
 *     full draft sent every turn) plus an editable profile: fields, skills,
 *     roles, custom links. Resume/writing uploads extract text client side
 *     via pdf.js, exactly like agent.js does, and land as sources.
 *   jobs · a real table over users/{uid}/jobOS/state.roles (the same doc the
 *     iOS JobOSStore syncs). Titles link out via roleUrl. Discovery runs the
 *     real evidence-backed /api/discover-internships endpoint and NOTHING
 *     reaches the board without an explicit "Add to board" tap, matching
 *     JobOSStore's "the board never changes silently" discipline. Resume and
 *     cover letter cells call /api/generate-resume-pdf and download the
 *     bytes; resumeReady/coverLetterReady flip true only after a PDF was
 *     really generated.
 *
 * Data layout (all under the SIGNED-IN student's own uid, resolved fresh
 * from ensureFire() at every operation, never cached at module scope and
 * never hardcoded):
 *   users/{uid}/jobOS/resumeDraft · this panel's editable ResumeDraft. A
 *     separate doc from state on purpose: iOS pushToFirestore() writes the
 *     whole state doc, so an extra field there would be silently dropped on
 *     the next iOS save.
 *   users/{uid}/jobOS/state · the shared board. Web writes go through
 *     read-modify-write transactions and always produce a doc that decodes
 *     as the Swift JobOSState (every non-Optional field present), so an iOS
 *     session never falls into its "no remote doc" reseed path.
 */

import { ensureFire } from './fire.js';

const WEBHOOK_BASE = 'https://mindcraft-webhook.vercel.app';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const STEP_KEY_PREFIX = 'deskOs.resumeHelper.step.';

const EMPTY_DRAFT = {
  name: '', headline: '', school: '', email: '', location: '',
  skills: [], roles: [], education: [], projects: [], files: [],
  linkedinUrl: '', drive: false,
};

/** Mirrors JobOSStore.emptyStarter() so a web-created board decodes as the
 *  Swift JobOSState on iOS. Every non-Optional field must be present. */
function emptyBoard() {
  return {
    school: 'Your campus',
    title: 'Apply today',
    subtitle: 'Upload resume · connect LinkedIn · then add roles',
    assets: [
      { id: 'resume', title: 'Upload resume', kind: 'resume', status: 'empty', detail: 'PDF from Files' },
      { id: 'writing', title: 'Creative writing pieces', kind: 'writing', status: 'empty', detail: 'Essays · memos · samples' },
      { id: 'link_linkedin', title: 'Connect LinkedIn', kind: 'link', status: 'empty', detail: 'Paste your profile URL' },
      { id: 'link_2', title: '+ Link', kind: 'link', status: 'empty', detail: 'Portfolio · GitHub · site' },
      { id: 'link_3', title: '+ Link', kind: 'link', status: 'empty', detail: 'Calendly · other' },
    ],
    roles: [],
    contacts: [],
    queue: [],
    syncNotes: [],
    sourceLog: [],
    actionLanes: ['Apply Now', 'Apply + Outreach', 'Prepare', 'Network First', 'Monitor'],
    processStatuses: ['Not Started', 'Applied', 'Screen', 'Interview', 'Offer', 'Closed', 'Skipped'],
  };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function isoNow() { return new Date().toISOString(); }
function dayStamp() { return new Date().toISOString().slice(0, 10); }
function rid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

function safeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : '';
}

let pdfJsPromise = null;
function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve(true);
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = PDFJS;
    s.onload = () => {
      if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(Boolean(window.pdfjsLib));
    };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return pdfJsPromise;
}

async function extractPdf(file) {
  const ok = await ensurePdfJs();
  if (!ok) return '';
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  const n = Math.min(pdf.numPages, 8);
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n';
    if (text.length > 24000) break;
  }
  return text.slice(0, 24000);
}

async function extractAny(file) {
  if (!file) return '';
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.md') || (file.type || '').startsWith('text/')) {
    return (await file.text()).slice(0, 24000);
  }
  return extractPdf(file);
}

function roleLine(r) {
  if (typeof r === 'string') return r;
  return [r.title, r.org, r.when].filter(Boolean).join(' · ');
}

/**
 * @param {{ root: HTMLElement, onToast?: (msg: string) => void }} opts
 */
export function createResumeHelper({ root, onToast }) {
  if (!root) return { open() {}, close() {}, isOpen: () => false, destroy() {} };

  const el = (sel) => root.querySelector(sel);
  const soft = el('[data-rh-soft]');
  const backBtn = el('[data-rh-back]');
  const forwardBtn = el('[data-rh-forward]');
  const stepBuild = el('[data-rh-step-build]');
  const stepJobs = el('[data-rh-step-jobs]');
  const statusEl = el('[data-rh-status]');
  const transcript = el('[data-rh-transcript]');
  const chatForm = el('[data-rh-chat]');
  const chatInput = el('[data-rh-chat-input]');
  const fileResume = el('[data-rh-file-resume]');
  const fileWriting = el('[data-rh-file-writing]');
  const skillsEl = el('[data-rh-skills]');
  const rolesEl = el('[data-rh-roles]');
  const linksEl = el('[data-rh-links]');
  const tableEl = el('[data-rh-table]');
  const candidatesEl = el('[data-rh-candidates]');
  const discoverBtn = el('[data-rh-discover]');
  const jobsNote = el('[data-rh-jobs-note]');
  const fields = [...root.querySelectorAll('[data-rh-f]')];

  let step = 'build';
  let draft = { ...EMPTY_DRAFT };
  let draftLoaded = false;
  let board = null;
  let unsubBoard = null;
  let boardUid = null;
  let candidates = [];
  let thinking = false;
  let saveTimer = null;
  let greeted = false;
  let signedOut = false;

  // ---------- auth ----------

  async function me() {
    const fire = await ensureFire();
    if (!fire || !fire.user) return null;
    return fire;
  }

  // ---------- step memory ----------

  function stepKey(uid) { return STEP_KEY_PREFIX + (uid || 'anon'); }

  function rememberStep(uid) {
    try { sessionStorage.setItem(stepKey(uid), step); } catch { /* ignore */ }
  }

  function recallStep(uid) {
    try {
      const s = sessionStorage.getItem(stepKey(uid));
      if (s === 'jobs' || s === 'build') step = s;
    } catch { /* ignore */ }
  }

  function setStep(next, uid) {
    step = next === 'jobs' ? 'jobs' : 'build';
    if (stepBuild) stepBuild.hidden = step !== 'build';
    if (stepJobs) stepJobs.hidden = step !== 'jobs';
    if (backBtn) backBtn.hidden = step !== 'jobs';
    if (forwardBtn) forwardBtn.hidden = step !== 'build';
    if (soft) {
      soft.textContent = step === 'jobs'
        ? 'Openings on your board. Titles link to the real posting; PDFs are ready to send.'
        : 'Jesse builds your profile from a real resume, then finds real openings with links.';
    }
    rememberStep(uid);
  }

  // ---------- Jesse transcript ----------

  function bubble(kind, text) {
    if (!transcript) return;
    const div = document.createElement('div');
    div.className = `rh-bubble ${kind === 'you' ? 'is-you' : 'is-jesse'}`;
    div.textContent = text;
    transcript.appendChild(div);
    transcript.scrollTop = transcript.scrollHeight;
  }

  function setThinking(on, label) {
    thinking = on;
    if (statusEl) statusEl.textContent = on ? (label || 'Jesse is reading') : 'Ready when you are';
    root.querySelectorAll('[data-rh-chat] button, .rh-mini').forEach((b) => { b.disabled = on; });
  }

  function greetOnce() {
    if (greeted) return;
    greeted = true;
    if (transcript && !transcript.childElementCount) {
      // "Welcome back" only when there is real draft substance; a name alone
      // can come from the auth profile prefill, and that student still needs
      // the upload pitch.
      const substantive = draft.skills.length || draft.roles.length || draft.files.length;
      bubble('jesse', substantive
        ? `Welcome back${draft.name ? `, ${String(draft.name).split(/\s+/)[0]}` : ''}. Edit anything on the right, or open the jobs table.`
        : 'Hi, I am Jesse. Upload a resume and I will do my magic: a profile you can edit, then real openings with links, resumes, and cover letters.');
    }
  }

  // ---------- draft ----------

  function mergeDraft(next) {
    if (!next) return;
    draft.name = next.name || draft.name;
    draft.headline = next.headline || draft.headline;
    draft.school = next.school || draft.school;
    draft.email = next.email || draft.email;
    draft.location = next.location || draft.location;
    draft.linkedinUrl = next.linkedinUrl || draft.linkedinUrl;
    draft.drive = Boolean(next.drive || draft.drive);
    for (const key of ['skills', 'education', 'projects', 'files']) {
      if (Array.isArray(next[key])) {
        draft[key] = [...new Set([...draft[key], ...next[key].map(String)])];
      }
    }
    if (Array.isArray(next.roles) && next.roles.length) {
      const have = new Set(draft.roles.map(roleLine));
      next.roles.forEach((r) => {
        const line = roleLine(r);
        if (line && !have.has(line)) { draft.roles.push(r); have.add(line); }
      });
    }
  }

  function paintDraft() {
    fields.forEach((input) => {
      const key = input.dataset.rhF;
      if (document.activeElement !== input) input.value = draft[key] || '';
    });
    if (skillsEl) {
      skillsEl.innerHTML = draft.skills.map((s, i) => `
        <span class="rh-chip">${esc(s)}<button type="button" data-rh-del-skill="${i}" aria-label="Remove ${esc(s)}">×</button></span>
      `).join('') || '<span class="rh-soft-note">Skills land here after an upload or a chat.</span>';
    }
    if (rolesEl) {
      rolesEl.innerHTML = draft.roles.map((r, i) => `
        <div class="rh-role-row">
          <span>${esc(roleLine(r))}</span>
          <button type="button" data-rh-del-role="${i}" aria-label="Remove role">×</button>
        </div>
      `).join('') || '<span class="rh-soft-note">Experience appears after a resume upload or a chat with Jesse.</span>';
    }
  }

  function scheduleSaveDraft() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { void saveDraft(); }, 900);
  }

  async function saveDraft() {
    const fire = await me();
    if (!fire) return;
    const { db, fx, user } = fire;
    try {
      await fx.setDoc(
        fx.doc(db, 'users', user.uid, 'jobOS', 'resumeDraft'),
        { ...draft, updatedAt: isoNow() },
      );
    } catch { /* offline is fine, next save retries */ }
  }

  async function loadDraft() {
    if (draftLoaded) return;
    const fire = await me();
    if (!fire) return;
    const { db, fx, user } = fire;
    try {
      const snap = await fx.getDoc(fx.doc(db, 'users', user.uid, 'jobOS', 'resumeDraft'));
      if (snap.exists()) {
        const data = snap.data() || {};
        mergeDraft(data);
      }
      draftLoaded = true;
    } catch { /* stay with the empty draft */ }
  }

  // ---------- board (users/{uid}/jobOS/state) ----------

  async function watchBoard() {
    const fire = await me();
    if (!fire) return;
    const { db, fx, user } = fire;
    if (boardUid === user.uid && unsubBoard) return;
    if (unsubBoard) { try { unsubBoard(); } catch { /* ignore */ } }
    boardUid = user.uid;
    unsubBoard = fx.onSnapshot(
      fx.doc(db, 'users', user.uid, 'jobOS', 'state'),
      (snap) => {
        board = snap.exists() ? snap.data() : null;
        paintLinks();
        paintTable();
      },
      () => { board = null; paintTable(); },
    );
  }

  /**
   * Read-modify-write on the shared board doc. `mutate` gets a full board
   * (the iOS-compatible starter when the doc does not exist yet) and must
   * return the next full board. A transaction, so a concurrent iOS save is
   * not clobbered blindly.
   */
  async function mutateBoard(mutate) {
    const fire = await me();
    if (!fire) { onToast?.('Sign in to save to your board'); return false; }
    const { db, fx, user } = fire;
    const ref = fx.doc(db, 'users', user.uid, 'jobOS', 'state');
    try {
      await fx.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists() ? snap.data() : emptyBoard();
        tx.set(ref, mutate(structuredClone(current)));
      });
      return true;
    } catch {
      onToast?.('Could not save to your board. Try again.');
      return false;
    }
  }

  function logEvent(state, eventType, detail) {
    state.sourceLog = [
      { id: rid('ev'), createdAt: isoNow(), eventType, detail, agent: 'desk-os-web' },
      ...(state.sourceLog || []),
    ].slice(0, 80);
  }

  function markAsset(state, matcher, patch) {
    state.assets = state.assets || [];
    const i = state.assets.findIndex(matcher);
    if (i >= 0) state.assets[i] = { ...state.assets[i], ...patch };
    return i >= 0;
  }

  async function markResumeUploaded(fileName) {
    await mutateBoard((state) => {
      markAsset(state, (a) => a.kind === 'resume', {
        status: 'ready', detail: fileName, markedAt: isoNow(),
      });
      logEvent(state, 'asset', `Resume uploaded · ${fileName}`);
      return state;
    });
  }

  async function markWritingReady(fileName) {
    await mutateBoard((state) => {
      markAsset(state, (a) => a.kind === 'writing', {
        status: 'ready', detail: fileName, markedAt: isoNow(),
      });
      logEvent(state, 'asset', `Writing ready · ${fileName}`);
      return state;
    });
  }

  async function saveLinkedIn(url) {
    await mutateBoard((state) => {
      markAsset(state, (a) => a.id === 'link_linkedin', {
        status: 'ready', detail: url, markedAt: isoNow(),
      });
      logEvent(state, 'linkedin', `Connected · ${url}`);
      return state;
    });
  }

  function linkTitle(url) {
    try { return new URL(url).host.replace(/^www\./, ''); } catch { return 'Link'; }
  }

  async function addCustomLink(url) {
    await mutateBoard((state) => {
      const open = (state.assets || []).find((a) => a.kind === 'link' && a.id !== 'link_linkedin' && a.status !== 'ready');
      if (open) {
        markAsset(state, (a) => a.id === open.id, {
          status: 'ready', detail: url, title: linkTitle(url), markedAt: isoNow(),
        });
      } else {
        state.assets = [...(state.assets || []), {
          id: rid('link'), title: linkTitle(url), kind: 'link', status: 'ready', detail: url, markedAt: isoNow(),
        }];
      }
      logEvent(state, 'asset', `Link added · ${url}`);
      return state;
    });
  }

  async function removeCustomLink(assetId) {
    await mutateBoard((state) => {
      markAsset(state, (a) => a.id === assetId, {
        status: 'empty', detail: 'Portfolio · GitHub · site', title: '+ Link',
      });
      logEvent(state, 'asset', 'Link removed');
      return state;
    });
  }

  function customLinks() {
    return ((board && board.assets) || []).filter(
      (a) => a.kind === 'link' && a.id !== 'link_linkedin' && a.status === 'ready' && a.detail,
    );
  }

  function paintLinks() {
    if (!linksEl) return;
    const rows = customLinks();
    linksEl.innerHTML = rows.map((a) => `
      <div class="rh-role-row">
        <a href="${esc(safeUrl(a.detail) || '#')}" target="_blank" rel="noopener noreferrer">${esc(a.detail)}</a>
        <button type="button" data-rh-del-link="${esc(a.id)}" aria-label="Remove link">×</button>
      </div>
    `).join('') || '<span class="rh-soft-note">No links yet. Add a portfolio, GitHub, anything.</span>';
  }

  // ---------- Jesse call ----------

  async function askJesse(message, extraSources) {
    const sources = {
      linkedinUrl: draft.linkedinUrl,
      linkedinText: '',
      driveFiles: [],
      resumeText: '',
      resumeFileName: draft.files[0] || '',
      ...(extraSources || {}),
    };
    setThinking(true);
    let data = null;
    try {
      const res = await fetch(`${WEBHOOK_BASE}/api/resume-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, draft, sources }),
      });
      if (res.ok) data = await res.json();
    } catch { /* honest failure below */ }
    setThinking(false);
    if (!data || !data.reply) {
      bubble('jesse', 'I could not reach the resume service just now. Your edits still save; try me again in a moment.');
      return;
    }
    mergeDraft(data.draft);
    paintDraft();
    scheduleSaveDraft();
    bubble('jesse', data.reply);
    if (Array.isArray(data.suggestedRoles) && data.suggestedRoles.length) {
      bubble('jesse', 'Directions worth searching: ' + data.suggestedRoles.map((r) => r.role).filter(Boolean).join(' · ')
        + '. Open the jobs table and I will look for real openings.');
    }
    if (data.readyToApply && forwardBtn) forwardBtn.classList.add('is-ready');
  }

  // ---------- discovery ----------

  async function runDiscovery() {
    const fire = await me();
    if (!fire) { onToast?.('Sign in to search'); return; }
    if (discoverBtn) { discoverBtn.disabled = true; discoverBtn.textContent = 'Searching the real web…'; }
    if (jobsNote) jobsNote.textContent = 'Running real searches. This can take ~20 seconds.';
    try {
      const token = await fire.user.getIdToken();
      const res = await fetch(`${WEBHOOK_BASE}/api/discover-internships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          interests: draft.skills.slice(0, 5),
          location: draft.location || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        if (jobsNote) jobsNote.textContent = data.reason || 'Daily generation limit reached.';
        return;
      }
      if (!res.ok || data.status !== 'ok') {
        if (jobsNote) jobsNote.textContent = 'Search did not come back. Try again in a bit.';
        return;
      }
      candidates = Array.isArray(data.candidates) ? data.candidates : [];
      if (jobsNote) {
        jobsNote.textContent = candidates.length
          ? `${candidates.length} real candidate${candidates.length === 1 ? '' : 's'} found. Add the ones you want to your board.`
          : 'Nothing specific enough this run. Zero is an honest answer; try again later.';
      }
      paintCandidates();
    } catch {
      if (jobsNote) jobsNote.textContent = 'Search failed. Check your connection and try again.';
    } finally {
      if (discoverBtn) { discoverBtn.disabled = false; discoverBtn.textContent = 'Find openings for me'; }
    }
  }

  function paintCandidates() {
    if (!candidatesEl) return;
    candidatesEl.hidden = candidates.length === 0;
    candidatesEl.innerHTML = candidates.map((c, i) => `
      <article class="rh-candidate">
        <div>
          <strong>${esc(c.role)}</strong>
          <span class="rh-cand-co">${esc(c.company)}${c.location ? ` · ${esc(c.location)}` : ''}</span>
          <p>${esc(c.why || '')}</p>
          ${safeUrl(c.roleUrl) ? `<a href="${esc(safeUrl(c.roleUrl))}" target="_blank" rel="noopener noreferrer">${esc(safeUrl(c.roleUrl))}</a>` : ''}
          <span class="rh-verify ${c.verificationStatus === 'link_verified' ? 'is-verified' : ''}">${c.verificationStatus === 'link_verified' ? 'link verified' : 'unverified'}</span>
        </div>
        <button type="button" data-rh-add-cand="${i}">Add to board</button>
      </article>
    `).join('');
  }

  async function addCandidate(i) {
    const c = candidates[i];
    if (!c) return;
    const ok = await mutateBoard((state) => {
      const nextRank = Math.max(0, ...(state.roles || []).map((r) => Number(r.rank) || 0)) + 1;
      const url = safeUrl(c.roleUrl);
      const role = {
        id: rid('role'),
        rank: nextRank,
        actionLane: 'Apply Now',
        company: String(c.company || '').slice(0, 120),
        role: String(c.role || '').slice(0, 160),
        location: String(c.location || '').slice(0, 100),
        fitScore: 80,
        eligibility: 'Plausible',
        applied: false,
        contacts: '',
        processStatus: 'Not Started',
        nextAction: 'Open listing and confirm requirements.',
        roleUrl: url,
        careerUrl: url,
        why: String(c.why || '').slice(0, 300),
        resumeReady: false,
        coverLetterReady: false,
        liveStatus: url ? 'Live signal' : 'Verify posting',
        lastChecked: dayStamp(),
        source: 'discovery',
        verificationStatus: c.verificationStatus === 'link_verified' ? 'link_verified' : 'unverified',
        discoveredAt: isoNow(),
        category: 'job',
      };
      if (c.deadline) role.deadline = String(c.deadline).slice(0, 40);
      state.roles = [...(state.roles || []), role];
      logEvent(state, 'add_role', `${role.company} · ${role.role} · from discovery`);
      return state;
    });
    if (ok) {
      candidates.splice(i, 1);
      paintCandidates();
      onToast?.(`Added · ${c.company}`);
    }
  }

  // ---------- jobs table ----------

  function openRoles() {
    return ((board && board.roles) || [])
      .filter((r) => !['Closed', 'Skipped'].includes(r.processStatus))
      .filter((r) => (r.category || 'job') === 'job')
      .sort((a, b) => (a.rank || 0) - (b.rank || 0));
  }

  function paintTable() {
    if (!tableEl) return;
    if (signedOut) {
      tableEl.innerHTML = '<tr><td colspan="7" class="rh-empty">Sign in to see your board.</td></tr>';
      return;
    }
    const rows = openRoles();
    if (!rows.length) {
      tableEl.innerHTML = '<tr><td colspan="7" class="rh-empty">Nothing on the board yet. Hit "Find openings for me" above, then add what you like.</td></tr>';
      return;
    }
    tableEl.innerHTML = rows.map((r) => {
      const url = safeUrl(r.roleUrl);
      const title = url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(r.role || 'Opening')}</a>`
        : esc(r.role || 'Opening');
      return `
        <tr data-role-id="${esc(r.id)}">
          <td class="rh-td-role">${title}</td>
          <td>${esc(r.company || '')}</td>
          <td>${esc(r.location || '')}</td>
          <td>${esc(r.deadline || '')}</td>
          <td><button type="button" class="rh-pdf ${r.resumeReady ? 'is-ready' : ''}" data-rh-pdf="resume" data-role-id="${esc(r.id)}">${r.resumeReady ? 'Resume PDF ✓' : 'Resume PDF'}</button></td>
          <td><button type="button" class="rh-pdf ${r.coverLetterReady ? 'is-ready' : ''}" data-rh-pdf="coverLetter" data-role-id="${esc(r.id)}">${r.coverLetterReady ? 'Letter PDF ✓' : 'Letter PDF'}</button></td>
          <td><span class="rh-status-chip">${esc(r.processStatus || 'Not Started')}</span></td>
        </tr>`;
    }).join('');
  }

  async function downloadPdf(kind, roleId, button) {
    const fire = await me();
    if (!fire) { onToast?.('Sign in first'); return; }
    const role = openRoles().find((r) => r.id === roleId);
    if (!role) return;
    if (kind === 'resume' && !draft.name && !draft.skills.length) {
      onToast?.('Build your profile first, the PDF needs it');
      setStep('build', fire.user.uid);
      return;
    }
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Making PDF…'; }
    try {
      const token = await fire.user.getIdToken();
      const res = await fetch(`${WEBHOOK_BASE}/api/generate-resume-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind,
          draft,
          links: customLinks().map((a) => a.detail),
          role: kind === 'coverLetter'
            ? { company: role.company, role: role.role, location: role.location, why: role.why, roleUrl: role.roleUrl }
            : undefined,
        }),
      });
      if (res.status === 404) {
        onToast?.('PDF service is not deployed yet. Deploy the webhook first.');
        return;
      }
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        onToast?.(data.reason || 'Daily generation limit reached.');
        return;
      }
      if (!res.ok) { onToast?.('PDF failed. Try again.'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const who = (draft.name || 'student').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const co = (role.company || 'role').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = kind === 'resume' ? `resume-${who}.pdf` : `cover-letter-${who}-${co}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const flag = kind === 'resume' ? 'resumeReady' : 'coverLetterReady';
      await mutateBoard((state) => {
        const i = (state.roles || []).findIndex((r) => r.id === roleId);
        if (i >= 0) state.roles[i] = { ...state.roles[i], [flag]: true };
        logEvent(state, 'pdf', `${kind} PDF generated · ${role.company}`);
        return state;
      });
    } catch {
      // A fetch() that throws here is either a real network problem or the
      // PDF endpoint not being deployed yet (an undeployed route 404s with
      // no CORS headers, which surfaces as a thrown TypeError, so the 404
      // branch above never gets a chance).
      onToast?.('PDF failed. If this keeps happening, the PDF service is not deployed yet.');
    } finally {
      if (button) { button.disabled = false; if (original) button.textContent = original; }
    }
  }

  // ---------- events ----------

  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (thinking) return;
    const text = (chatInput?.value || '').trim();
    if (!text) return;
    if (chatInput) chatInput.value = '';
    bubble('you', text);
    void askJesse(text);
  });

  el('[data-rh-upload-resume]')?.addEventListener('click', () => fileResume?.click());
  el('[data-rh-upload-writing]')?.addEventListener('click', () => fileWriting?.click());

  fileResume?.addEventListener('change', async () => {
    const f = fileResume.files && fileResume.files[0];
    if (!f) return;
    fileResume.value = '';
    bubble('you', `Uploaded ${f.name}`);
    setThinking(true, 'Reading your resume');
    const text = await extractAny(f);
    setThinking(false);
    if (!text.trim()) {
      bubble('jesse', 'I could not read text out of that file. A text PDF or a .txt works best.');
      return;
    }
    draft.files = [...new Set([f.name, ...draft.files])];
    await markResumeUploaded(f.name);
    await askJesse('I uploaded a resume file. Extract useful facts and place them on the draft.', {
      resumeText: text,
      resumeFileName: f.name,
    });
  });

  fileWriting?.addEventListener('change', async () => {
    const f = fileWriting.files && fileWriting.files[0];
    if (!f) return;
    fileWriting.value = '';
    bubble('you', `Uploaded writing piece ${f.name}`);
    setThinking(true, 'Reading your writing');
    const text = await extractAny(f);
    setThinking(false);
    await markWritingReady(f.name);
    if (text.trim()) {
      await askJesse('I uploaded a writing piece. Pull anything resume-worthy from it (skills, projects, roles).', {
        resumeText: text,
        resumeFileName: f.name,
      });
    } else {
      bubble('jesse', `Marked your writing piece ${f.name} as ready on the board.`);
    }
  });

  fields.forEach((input) => {
    input.addEventListener('input', () => {
      draft[input.dataset.rhF] = input.value;
      scheduleSaveDraft();
    });
    input.addEventListener('change', () => {
      if (input.dataset.rhF === 'linkedinUrl') {
        const url = safeUrl(input.value);
        if (url) void saveLinkedIn(url);
      }
    });
  });

  el('[data-rh-skill-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = el('[data-rh-skill-input]');
    const s = (input?.value || '').trim();
    if (!s) return;
    if (input) input.value = '';
    if (!draft.skills.some((x) => x.toLowerCase() === s.toLowerCase())) {
      draft.skills.push(s);
      paintDraft();
      scheduleSaveDraft();
    }
  });

  el('[data-rh-link-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = el('[data-rh-link-input]');
    const url = safeUrl(input?.value);
    if (!url) { onToast?.('Links need to start with https://'); return; }
    if (input) input.value = '';
    void addCustomLink(url);
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.rhDelSkill != null) {
      draft.skills.splice(Number(t.dataset.rhDelSkill), 1);
      paintDraft();
      scheduleSaveDraft();
    } else if (t.dataset.rhDelRole != null) {
      draft.roles.splice(Number(t.dataset.rhDelRole), 1);
      paintDraft();
      scheduleSaveDraft();
    } else if (t.dataset.rhDelLink) {
      void removeCustomLink(t.dataset.rhDelLink);
    } else if (t.dataset.rhAddCand != null) {
      void addCandidate(Number(t.dataset.rhAddCand));
    } else if (t.dataset.rhPdf) {
      void downloadPdf(t.dataset.rhPdf, t.dataset.roleId, t);
    }
  });

  discoverBtn?.addEventListener('click', () => { void runDiscovery(); });

  backBtn?.addEventListener('click', async () => {
    const fire = await me();
    setStep('build', fire?.user?.uid);
  });
  forwardBtn?.addEventListener('click', async () => {
    const fire = await me();
    setStep('jobs', fire?.user?.uid);
  });

  // ---------- lifecycle ----------

  let opened = false;

  async function open() {
    root.hidden = false;
    const fire = await me();
    if (!fire) {
      signedOut = true;
      if (soft) soft.textContent = 'Sign in to build your resume. This panel saves to your own account.';
      setStep('build');
      paintDraft();
      paintTable();
      greetOnce();
      return;
    }
    signedOut = false;
    if (!opened) {
      opened = true;
      recallStep(fire.user.uid);
      await loadDraft();
      if (!draft.email && fire.user.email) draft.email = fire.user.email;
      if (!draft.name && fire.user.displayName) draft.name = fire.user.displayName;
      void watchBoard();
    }
    setStep(step, fire.user.uid);
    paintDraft();
    greetOnce();
  }

  function close() {
    root.hidden = true;
  }

  return {
    open,
    close,
    isOpen: () => !root.hidden,
    destroy() {
      if (unsubBoard) { try { unsubBoard(); } catch { /* ignore */ } }
      if (saveTimer) window.clearTimeout(saveTimer);
    },
  };
}
