/* Jesse resume client — 5s beat, human voice, LinkedIn/Drive/PDF extract, Let's apply. */
(() => {
  const WEBHOOK = 'https://mindcraft-webhook.vercel.app/api/resume-agent';
  const WAIT_MS = 5000;
  const FB = {
    apiKey: 'AIzaSyBetzXAekac3zTdzgJ3vGxqKCQAXc3tcsU',
    authDomain: 'mindcraft-93858.web.app',
    projectId: 'mindcraft-93858',
    appId: '1:1024068467805:web:1fed20442356c7b757e1b4',
  };
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  const FOLDERS = ['The Desk', 'MindCraft Desk'];

  const $ = (id) => document.getElementById(id);
  const glass = () => window.deskGlass && window.deskGlass.draw();

  const state = {
    name: '', headline: '', school: '', email: '', location: '',
    skills: [], roles: [], education: [], projects: [], files: [],
    linkedinUrl: '', drive: false,
  };
  let suggestedRoles = [];
  let thinking = false;

  const wave = $('meetWave');
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('b');
    b.style.height = (8 + Math.random() * 28) + 'px';
    b.style.animationDelay = (i * 0.06) + 's';
    wave.appendChild(b);
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('on', el.id === id));
    requestAnimationFrame(() => { glass(); requestAnimationFrame(glass); });
  }

  function pickVoice() {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    const rank = (v) => {
      const n = v.name;
      if (/Samantha/.test(n)) return 0;
      if (/^Ava$|Ava \(/.test(n)) return 1;
      if (/Allison|Susan|Victoria|Zoe|Jenny|Moira|Karen/.test(n)) return 2;
      if (/Google US English/.test(n)) return 3;
      if (/en-US/.test(v.lang) && /female/i.test(n)) return 4;
      if (v.lang === 'en-US') return 5;
      return 8;
    };
    return voices.sort((a, b) => rank(a) - rank(b))[0] || null;
  }

  function speak(text, onDone) {
    speechSynthesis.cancel();
    const voice = pickVoice();
    const parts = String(text || '').split(/(?<=[.?!])\s+/).filter(Boolean);
    const play = (i) => {
      if (i >= parts.length) { if (onDone) onDone(); return; }
      const u = new SpeechSynthesisUtterance(parts[i]);
      u.rate = 0.92;
      u.pitch = 1.02;
      u.volume = 1;
      if (voice) u.voice = voice;
      u.onend = () => setTimeout(() => play(i + 1), 280);
      speechSynthesis.speak(u);
    };
    play(0);
  }
  speechSynthesis.onvoiceschanged = () => {};

  function setThink(on, label) {
    thinking = on;
    const el = $('think');
    if (!el) return;
    el.hidden = !on;
    if (label) el.querySelector('b').textContent = label;
    $('meetStatus').textContent = on ? 'Reading' : 'Ready to listen';
    if ($('callStatus')) $('callStatus').textContent = on ? 'Jesse is thinking…' : 'Friendly. Guided. Your words.';
    document.querySelectorAll('[data-glass="orb"]').forEach((n) => {
      n.classList.toggle('hot', on);
      n.disabled = on;
    });
    glass();
  }

  function roleLine(r) {
    if (typeof r === 'string') return r;
    const bits = [r.title, r.org, r.when].filter(Boolean).join(' — ');
    return bits || '';
  }

  function applyDraft(d) {
    if (!d) return;
    state.name = d.name || state.name;
    state.headline = d.headline || state.headline;
    state.school = d.school || state.school;
    state.email = d.email || state.email;
    state.location = d.location || state.location;
    state.linkedinUrl = d.linkedinUrl || state.linkedinUrl;
    state.drive = Boolean(d.drive || state.drive);
    if (Array.isArray(d.skills)) state.skills = Array.from(new Set([...state.skills, ...d.skills.map(String)]));
    if (Array.isArray(d.education)) state.education = Array.from(new Set([...state.education, ...d.education.map(String)]));
    if (Array.isArray(d.projects)) state.projects = Array.from(new Set([...state.projects, ...d.projects.map(String)]));
    if (Array.isArray(d.files)) state.files = Array.from(new Set([...state.files, ...d.files.map(String)]));
    if (Array.isArray(d.roles) && d.roles.length) {
      const have = new Set(state.roles.map(roleLine));
      d.roles.forEach((r) => {
        const line = roleLine(r);
        if (line && !have.has(line)) { state.roles.push(r); have.add(line); }
      });
    }
    if (state.linkedinUrl) $('dataPill').textContent = 'Private draft';
    renderResume();
  }

  function renderResume() {
    const name = state.name || 'Your name';
    const head = state.headline || 'Add a line that sounds like you';
    const skills = state.skills.length
      ? state.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')
      : '<span class="chip">skills land here</span>';
    const roles = state.roles.length
      ? '<ul>' + state.roles.map((r) => `<li>${esc(roleLine(r))}</li>`).join('') + '</ul>'
      : '<p>Roles appear after LinkedIn, Drive, or a call.</p>';
    const files = state.files.length ? state.files.map(esc).join(', ') : 'None yet';
    $('nm').textContent = name;
    $('hd').textContent = head;
    $('skills').innerHTML = skills;
    $('resume').innerHTML = `
      <h2>${esc(name)}</h2>
      <div class="meta">${esc(head)}</div>
      ${state.email ? `<p>${esc(state.email)}</p>` : ''}
      <h3>Experience</h3>
      ${roles}
      <h3>Skills</h3>
      <div class="chips">${skills}</div>
      <h3>Files on The Desk</h3>
      <p>${files}${state.drive ? ' · Drive folder linked' : ''}</p>
    `;
    $('applyBtn') && ($('applyBtn').hidden = !(state.name && (state.roles.length || state.skills.length >= 2)));
    glass();
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function nativeSend(payload) {
    const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.deskResume;
    if (!h) return false;
    h.postMessage(payload);
    return true;
  }

  async function extractPdf(file) {
    if (!file || !window.pdfjsLib) return '';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
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
    if (name.endsWith('.pdf')) return extractPdf(file);
    if (name.endsWith('.txt') || file.type.startsWith('text/')) return (await file.text()).slice(0, 24000);
    return extractPdf(file);
  }

  async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function askJesse(message, extraSources) {
    const sources = Object.assign({
      linkedinUrl: state.linkedinUrl,
      linkedinText: ($('liText') && $('liText').value) || '',
      driveFiles: window.__deskDriveFiles || [],
      resumeText: window.__deskResumeText || '',
      resumeFileName: state.files[0] || '',
    }, extraSources || {});

    setThink(true, 'Jesse is reading');
    const started = Date.now();
    let data = null;
    try {
      const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, draft: state, sources }),
      });
      if (res.ok) data = await res.json();
    } catch (_) { /* local fallback below */ }

    const wait = Math.max(0, WAIT_MS - (Date.now() - started));
    await sleep(wait);
    setThink(false);

    if (!data || !data.reply) {
      data = localFallback(message, sources);
    }
    applyDraft(data.draft);
    suggestedRoles = data.suggestedRoles || [];
    const reply = data.reply;
    speak(reply);
    if ((data.actions || []).some((a) => a.type === 'open_apply')) openApply();
    if (data.readyToApply) $('applyBtn').hidden = false;
    return data;
  }

  function localFallback(message, sources) {
    const blob = [message, sources.linkedinText, sources.resumeText, ...(sources.driveFiles || []).map((f) => f.text)].join('\n');
    const skills = ['Python', 'R', 'Excel', 'SQL', 'Stata', 'Java', 'JavaScript', 'TypeScript', 'Tutoring', 'Writing', 'Research', 'Tableau', 'Spanish', 'French']
      .filter((s) => new RegExp('\\b' + s + '\\b', 'i').test(blob));
    const email = (blob.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    const school = (blob.match(/Macalester College|University of [A-Z][A-Za-z]+|College of [A-Z][A-Za-z ]+/i) || [])[0] || '';
    const nameLine = blob.split('\n').map((l) => l.trim()).find((l) => /^[A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(l)) || '';
    const roles = [];
    blob.split('\n').forEach((line) => {
      const m = line.trim().match(/^(.{3,60})\s+[–—-]\s+(.{3,60})$/);
      if (m) roles.push({ title: m[1], org: m[2], when: '', bullets: [] });
    });
    const intern = blob.match(/intern(?:ed|ship)?\s+(?:at\s+)?([A-Z][A-Za-z0-9&.\- ]{2,40})/i);
    if (intern) roles.push({ title: 'Intern', org: intern[1].trim(), when: '', bullets: [] });
    const ready = Boolean(nameLine || roles.length || skills.length >= 2);
    let reply = 'I heard you. Paste LinkedIn Experience, open The Desk folder, or upload a PDF.';
    if (roles.length) reply = `Pulled ${roles[0].org} onto a private draft. Tell me what to add or cut.`;
    else if (skills.length) reply = `Added ${skills.slice(0, 3).join(', ')}. Name a role if you want it on the page.`;
    else if (nameLine) reply = `Got ${nameLine}. Add Experience or a PDF next.`;
    if (/apply/i.test(message) && ready) reply = 'The draft is on your desk. Search from the directions, then log Applied on the board.';
    return {
      reply,
      draft: {
        name: nameLine, email, school, skills, roles,
        files: sources.resumeFileName ? [sources.resumeFileName] : [],
        linkedinUrl: sources.linkedinUrl || '',
        drive: Boolean(sources.driveFiles && sources.driveFiles.length),
      },
      suggestedRoles: ready ? [{
        company: 'Handshake / LinkedIn jobs',
        role: 'Internship matching your draft',
        why: 'From the facts on the page. You submit. We do not apply for you.',
        query: [school, skills.slice(0, 2).join(' '), 'intern'].filter(Boolean).join(' '),
      }] : [],
      actions: /apply/i.test(message) && ready ? [{ type: 'open_apply' }] : [],
      readyToApply: ready,
    };
  }

  function openApply() {
    const list = $('applyList');
    list.innerHTML = (suggestedRoles.length ? suggestedRoles : [{
      company: 'Apply today',
      role: 'Open the board',
      why: 'Resume and LinkedIn are on the desk. Log Applied only after you submit.',
      query: state.headline || 'internship',
    }]).map((r) => `
      <article class="paper" style="min-height:0">
        <h2>${esc(r.role)}</h2>
        <div class="meta">${esc(r.company)}</div>
        <p>${esc(r.why)}</p>
        <p class="hint" style="text-align:left">Search: ${esc(r.query)}</p>
      </article>
    `).join('');
    show('apply');
    nativeSend({
      type: 'apply',
      fileName: state.files[0] || 'Jesse draft',
      linkedinUrl: state.linkedinUrl,
      suggestions: suggestedRoles,
    });
  }

  window.__deskResumeFromNative = (msg) => {
    if (!msg || msg.type !== 'driveFiles') return;
    if (msg.error) {
      $('linkNote').innerHTML = '<b>' + esc(msg.error) + '</b>';
      speak(msg.error);
      glass();
      return;
    }
    window.__deskDriveFiles = msg.files || [];
    state.drive = true;
    (msg.files || []).forEach((f) => { if (f.name) state.files.push(f.name); });
    $('linkNote').innerHTML = '<b>Drive folder linked.</b> Only The Desk folder. ' + (msg.files || []).length + ' files read.';
    askJesse('I connected The Desk Drive folder. Extract useful resume facts from these files.');
  };

  let rec = null;
  async function listen(button, onText, statusEl) {
    const status = statusEl || $('meetStatus');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      const fake = prompt('Type what you would say');
      if (fake) onText(fake);
      return;
    }
    if (rec) { stopListen(); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    button.classList.add('hot');
    wave.classList.remove('off');
    if (status) status.textContent = 'Listening…';
    glass();
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onend = () => {
      button.classList.remove('hot');
      wave.classList.add('off');
      if (!thinking && status) status.textContent = status === $('meetStatus') ? 'Ready to listen' : 'Friendly. Guided. Your words.';
      rec = null;
      glass();
    };
    r.start();
    rec = r;
  }
  function stopListen() { if (rec) try { rec.stop(); } catch (_) {} }

  // One-shot dictation on the meet screen: hold to talk, release to send -
  // a single utterance, not a live back-and-forth (that's the native "Call
  // Jesse" call now, JesseCallSession on the app side).
  $('recBtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    listen($('recBtn'), (text) => {
      show('link');
      askJesse(text);
    });
  });
  $('recBtn').addEventListener('pointerup', stopListen);
  $('recBtn').addEventListener('pointercancel', stopListen);
  $('recBtn').addEventListener('pointerleave', stopListen);

  $('toLink').addEventListener('click', () => show('link'));
  $('liBtn').addEventListener('click', () => {
    $('liSheet').hidden = false;
    glass();
  });
  $('liCancel').addEventListener('click', () => { $('liSheet').hidden = true; glass(); });
  $('liSave').addEventListener('click', async () => {
    const url = ($('liUrl').value || '').trim();
    const text = ($('liText').value || '').trim();
    const file = $('liPdf').files[0];
    let pdfText = '';
    if (file) {
      pdfText = await extractAny(file);
      state.files.push(file.name);
    }
    state.linkedinUrl = url;
    $('liSheet').hidden = true;
    show('desk');
    await askJesse('I connected LinkedIn. Extract useful facts from the URL, pasted Experience, and PDF.', {
      linkedinUrl: url,
      linkedinText: [text, pdfText].filter(Boolean).join('\n\n'),
    });
  });

  async function connectDriveWeb() {
    if (nativeSend({ type: 'drive' })) {
      setThink(true, 'Opening Drive');
      return;
    }
    if (!window.firebase) {
      speak('Sign in with Google on The Desk, then tap Drive again.');
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB);
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope(DRIVE_SCOPE);
      const result = await firebase.auth().signInWithPopup(provider);
      const token = result.credential && result.credential.accessToken;
      if (!token) {
        speak('Google did not share Drive. Allow The Desk folder and try again.');
        return;
      }
      const files = await readDeskFolder(token);
      window.__deskDriveFiles = files;
      state.drive = true;
      files.forEach((f) => state.files.push(f.name));
      $('linkNote').innerHTML = '<b>Drive folder linked.</b> Only The Desk folder. ' + files.length + ' files read.';
      await askJesse('I connected The Desk Drive folder. Extract useful resume facts from these files.', { driveFiles: files });
    } catch (err) {
      speak('Drive needs a folder named The Desk, and Drive API on for this Google project.');
      $('linkNote').textContent = String(err && err.message || err);
    }
  }

  async function readDeskFolder(token) {
    let folderId = null;
    for (const name of FOLDERS) {
      const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const json = await res.json();
      if (json.files && json.files[0]) { folderId = json.files[0].id; break; }
    }
    if (!folderId) throw new Error('Create a Drive folder named exactly The Desk, then tap again.');
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=12`, {
      headers: { Authorization: 'Bearer ' + token },
    }).then((r) => r.json());
    const out = [];
    for (const f of (list.files || []).slice(0, 8)) {
      let text = '';
      if (f.mimeType === 'application/vnd.google-apps.document') {
        text = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`, {
          headers: { Authorization: 'Bearer ' + token },
        }).then((r) => r.text());
      } else if (f.mimeType === 'text/plain') {
        text = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
          headers: { Authorization: 'Bearer ' + token },
        }).then((r) => r.text());
      }
      out.push({ name: f.name, text: String(text || '').slice(0, 8000) });
    }
    return out;
  }

  $('driveBtn').addEventListener('click', connectDriveWeb);
  function openFile() { $('filePick').click(); }
  $('uploadBtn').addEventListener('click', openFile);
  $('deskUpload').addEventListener('click', openFile);
  $('filePick').addEventListener('change', async () => {
    const f = $('filePick').files[0];
    if (!f) return;
    const text = await extractAny(f);
    window.__deskResumeText = text;
    state.files.push(f.name);
    show('desk');
    await askJesse('I uploaded a resume file. Extract useful facts and place them on the draft.', {
      resumeText: text,
      resumeFileName: f.name,
    });
  });
  $('addSkill').addEventListener('click', () => {
    const s = prompt('Skill to add');
    if (!s) return;
    askJesse('Add this skill to my resume: ' + s.trim());
  });
  $('applyBtn').addEventListener('click', () => {
    askJesse('The draft looks ready. Let’s apply.');
  });
  $('applyBack').addEventListener('click', () => show('desk'));

  renderResume();
  // No auto-speak-on-load here - the native JesseRailView greets out loud/
  // in text on the right now. Two "Hi, I'm Jesse"s (one spoken here, one
  // shown there) was the exact "two Jesses" bug this fixes.
})();
