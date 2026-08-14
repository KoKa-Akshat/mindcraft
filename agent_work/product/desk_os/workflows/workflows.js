/* MindCraft Scheduling Workflows — real local app (shareable links, votes, seats) */
(() => {
  const STORE = 'mc_workflows_v1';
  const CALENDLY = 'https://calendly.com/joinmindcraft/30min';
  const $ = (s, r = document) => r.querySelector(s);

  const CARDS = [
    { id: 'resume', title: 'Resume builder', tone: '#c4f547', icon: '✎',
      blurb: 'Jesse on a call. LinkedIn pull. Drive folder you already own.' },
    { id: 'archive', title: 'Open Learning Archive', tone: '#143a2e', icon: '▣',
      blurb: 'Ask Jesse. Exact page from Dan’s open textbooks. Data stays yours.' },
    { id: 'book', title: 'Create a book', tone: '#6B7A4A', icon: '✒',
      blurb: 'Hop on a call with Jesse and write your own short book.' },
    { id: 'poll', title: 'Group Poll', tone: '#c4a484', icon: '◷',
      blurb: 'Find the time that works for everyone. Votes stack. Share the link.' },
    { id: 'signup', title: 'Sign-up Sheet', tone: '#1f6b4a', icon: '▥',
      blurb: 'Workshops & office hours — one claim per seat.' },
    { id: 'oneOne', title: '1:1', tone: '#72c74a', icon: '◎',
      blurb: 'Offer windows. They pick one. You get a confirmed hold.' },
    { id: 'booking', title: 'Booking Page', tone: '#3b82c4', icon: '◉',
      blurb: 'Calendly booking page — share once, book in clicks.' },
  ];

  const DEFAULTS = {
    poll: { title: 'When works for study hall?', note: 'Pick every time you can make.',
      slots: ['Tue 4:00 PM', 'Tue 5:00 PM', 'Wed 3:30 PM', 'Thu 4:00 PM'] },
    signup: { title: 'Office hours sign-up', note: 'One seat per slot.',
      slots: ['Mon 12:00 · Seat 1', 'Mon 12:30 · Seat 1', 'Wed 4:00 · Seat 1', 'Wed 4:30 · Seat 1'] },
    oneOne: { title: 'Book a 1:1 with me', note: 'Pick one window this week.',
      slots: ['Fri 10:00 AM', 'Fri 11:00 AM', 'Sat 2:00 PM', 'Sun 4:00 PM'] },
  };

  let db = loadDB();
  let view = 'picker'; // picker | editor | respond
  let draft = null;
  let respondId = null;

  function uid() { return Math.random().toString(36).slice(2, 9); }
  function toast(msg) {
    const el = $('#toast');
    el.hidden = false; el.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2200);
  }
  function loadDB() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{"items":{}}'); }
    catch { return { items: {} }; }
  }
  function saveDB() { localStorage.setItem(STORE, JSON.stringify(db)); }

  function shareUrl(id) {
    const u = new URL(location.href);
    u.searchParams.set('w', id);
    u.searchParams.set('v', 'f5');
    return u.toString();
  }

  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => toast('Link copied')).catch(() => {
      prompt('Copy link', text);
    });
  }

  function startEditor(kind, aiPrompt = '') {
    if (kind === 'resume') {
      location.href = './resume/?v=r5';
      return;
    }
    if (kind === 'archive') {
      location.href = './archive/?v=a2';
      return;
    }
    if (kind === 'book') {
      location.href = './book/?v=b1';
      return;
    }
    if (kind === 'booking') {
      window.open(CALENDLY, '_blank', 'noopener');
      toast('Opening Calendly');
      return;
    }
    const d = DEFAULTS[kind];
    draft = {
      id: uid(),
      kind,
      title: d.title,
      note: d.note,
      slots: d.slots.map(label => ({ id: uid(), label, votes: [], claims: [] })),
      slides: [{ id: 1, label: 'Cover', body: d.title }],
      aiPrompt,
      createdAt: Date.now(),
    };
    if (aiPrompt) applyAI(draft);
    view = 'editor';
    render();
  }

  function applyAI(wf) {
    const p = (wf.aiPrompt || '').toLowerCase();
    if (!p.trim()) { toast('Type what AI should shape'); return; }
    if (p.includes('act') || p.includes('friday')) {
      wf.title = 'Friday ACT review — when works?';
      wf.note = 'Quick group poll. Share the link; votes stack here.';
      wf.slots = ['Fri 4:00 PM', 'Fri 5:00 PM', 'Fri 6:00 PM', 'Sat 11:00 AM'].map(label => ({ id: uid(), label, votes: [], claims: [] }));
    } else if (p.includes('desmos') || p.includes('workshop') || p.includes('seat')) {
      wf.title = 'Desmos graphing lab';
      wf.note = '8 seats. First claim wins.';
      wf.slots = Array.from({ length: 8 }, (_, i) => ({ id: uid(), label: `Wed 3:00 · Seat ${i + 1}`, votes: [], claims: [] }));
      wf.kind = 'signup';
    } else if (p.includes('essay') || p.includes('college') || p.includes('25')) {
      wf.title = 'College essay 1:1 (25 min)';
      wf.note = 'Pick one window — confirmed hold.';
      wf.slots = ['Mon 5:00 PM', 'Tue 5:00 PM', 'Thu 4:30 PM', 'Sun 2:00 PM'].map(label => ({ id: uid(), label, votes: [], claims: [] }));
      wf.kind = 'oneOne';
    } else {
      wf.title = `${wf.title} · AI pass`;
      wf.note = 'AI shaped this from your note. Edit slots, then share.';
    }
    wf.slides[0].body = wf.title;
    toast('AI customize applied');
  }

  function publishDraft() {
    if (!draft) return;
    draft.title = $('#fTitle')?.value?.trim() || draft.title;
    draft.note = $('#fNote')?.value?.trim() || draft.note;
    db.items[draft.id] = structuredClone(draft);
    saveDB();
    const url = shareUrl(draft.id);
    copy(url);
    toast('Published · link copied');
  }

  function openRespond(id) {
    const item = db.items[id];
    if (!item) { toast('Workflow not found on this device'); view = 'picker'; render(); return; }
    respondId = id;
    view = 'respond';
    render();
  }

  function voterKey() {
    let k = localStorage.getItem('mc_wf_voter');
    if (!k) { k = 'v_' + uid(); localStorage.setItem('mc_wf_voter', k); }
    return k;
  }

  function submitResponse(selectedIds) {
    const item = db.items[respondId];
    if (!item) return;
    const me = voterKey();
    if (item.kind === 'poll') {
      for (const s of item.slots) s.votes = s.votes.filter(v => v !== me);
      for (const id of selectedIds) {
        const s = item.slots.find(x => x.id === id);
        if (s) s.votes.push(me);
      }
    } else if (item.kind === 'signup') {
      for (const id of selectedIds) {
        const s = item.slots.find(x => x.id === id);
        if (!s) continue;
        if (s.claims.length && !s.claims.includes(me)) { toast('Seat taken'); return; }
        s.claims = [me];
      }
    } else if (item.kind === 'oneOne') {
      const id = selectedIds[0];
      if (!id) { toast('Pick one time'); return; }
      for (const s of item.slots) s.claims = s.claims.filter(c => c !== me);
      const s = item.slots.find(x => x.id === id);
      if (s.claims.length && !s.claims.includes(me)) { toast('That time is taken'); return; }
      s.claims = [me];
    }
    saveDB();
    toast('Saved · thanks');
    render();
  }

  function renderPicker() {
    $('#headTitle').textContent = 'Select your workflow';
    const mine = Object.values(db.items).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
    $('#shell').innerHTML = `
      <div class="pickerTitle">
        <h2>Select your workflow</h2>
        <p>In-house poll · sign-up · 1:1. Booking = Calendly. Links work on this browser (local).</p>
      </div>
      <div class="cardRow" id="cardRow">
        ${CARDS.map(c => `
          <article class="wfCard" data-widget="${c.id} ${c.title.toLowerCase()} booking calendly poll signup">
            <div class="wfArt">
              <span class="badge">${c.id === 'booking' ? 'Calendly' : 'In-house'}</span>
              <div class="wfIcon" style="background:${c.tone}">${c.icon}</div>
            </div>
            <h3>${c.title}</h3>
            <p>${c.blurb}</p>
            <div class="wfActions">
              <button class="btnCreate" data-create="${c.id}">Create</button>
              <button class="btnAI" data-ai="${c.id}">AI customize</button>
            </div>
          </article>
        `).join('')}
      </div>
      ${mine.length ? `
        <div class="mineList">
          <div class="hint" style="font-size:11px;font-weight:800;color:var(--ink-dim);margin-top:4px">YOUR WORKFLOWS</div>
          ${mine.map(w => `
            <div class="mineRow" data-widget="mine ${w.kind} ${w.title.toLowerCase()}">
              <span>${w.title}</span>
              <span>
                <button class="ghostBtn" data-open="${w.id}" style="padding:5px 10px">Open</button>
                <button class="ghostBtn" data-share="${w.id}" style="padding:5px 10px">Share</button>
              </span>
            </div>
          `).join('')}
        </div>` : ''}
    `;
    $('#shell').querySelectorAll('[data-create]').forEach(b => b.onclick = () => startEditor(b.dataset.create));
    $('#shell').querySelectorAll('[data-ai]').forEach(b => {
      b.onclick = () => {
        const seeds = {
          poll: 'Friday ACT review for 6 friends',
          signup: 'Workshop: Desmos graphing lab, 8 seats',
          oneOne: 'College essay check-ins, 25 min each',
          booking: '',
        };
        if (b.dataset.ai === 'booking') { toast('Customize in Calendly'); return; }
        startEditor(b.dataset.ai, seeds[b.dataset.ai]);
      };
    });
    $('#shell').querySelectorAll('[data-open]').forEach(b => b.onclick = () => openRespond(b.dataset.open));
    $('#shell').querySelectorAll('[data-share]').forEach(b => b.onclick = () => copy(shareUrl(b.dataset.share)));
  }

  function renderEditor() {
    const labels = { poll: 'Group Poll', signup: 'Sign-up Sheet', oneOne: '1:1' };
    $('#headTitle').textContent = labels[draft.kind] || 'Workflow';
    const slots = draft.slots.map((s, i) => `
      <div class="slot"><span>${s.label}</span><button data-rm="${i}">Remove</button></div>
    `).join('');
    const slides = draft.slides.map(s => `
      <div class="slideThumb filled"><strong>${s.label}</strong><span>${s.body}</span></div>
    `).join('') + `<button class="slideThumb add" id="addSlide">+ Add slide</button>`;

    $('#shell').innerHTML = `
      <div class="editor">
        <aside class="panel" data-widget="setup title note ai">
          <h4>Setup</h4>
          <p class="hint">Dense board · share when ready</p>
          <div class="field"><label>Title</label><input id="fTitle" value="${esc(draft.title)}"></div>
          <div class="field"><label>Note</label><textarea id="fNote">${esc(draft.note)}</textarea></div>
          <button class="ghostBtn" id="addSlot" style="width:100%;margin-bottom:6px">+ Add time / seat</button>
          <div class="aiBox">
            <textarea id="aiPrompt" placeholder="AI customize…">${esc(draft.aiPrompt || '')}</textarea>
            <div class="row"><button class="limeBtn" id="aiGo" style="padding:6px 12px;font-size:11px">AI customize</button></div>
          </div>
        </aside>
        <section class="center" data-widget="stage share gmail calendar">
          <div class="hero">
            <h3 id="heroTitle">${esc(draft.title)}</h3>
            <p id="heroNote">${esc(draft.note)}</p>
          </div>
          <div class="bar">
            <button class="limeBtn" id="publish">Share link →</button>
            <button class="ghostBtn" id="mailHint">Gmail invite</button>
            <button class="ghostBtn" id="calHint">Calendar hold</button>
            <button class="ghostBtn" id="backPicker">All workflows</button>
          </div>
        </section>
        <aside class="panel" data-widget="slots slides slideshow">
          <h4>Slots</h4>
          <p class="hint">Live votes/claims after share</p>
          <div id="slotList">${slots}</div>
          <h4 style="margin-top:10px">Slideshow</h4>
          <p class="hint">Mute-friendly deck</p>
          <div class="slideRail">${slides}</div>
        </aside>
      </div>
    `;

    const sync = () => {
      draft.title = $('#fTitle').value;
      draft.note = $('#fNote').value;
      $('#heroTitle').textContent = draft.title;
      $('#heroNote').textContent = draft.note;
      if (draft.slides[0]) draft.slides[0].body = draft.title;
    };
    $('#fTitle').oninput = sync;
    $('#fNote').oninput = sync;
    $('#addSlot').onclick = () => {
      draft.slots.push({ id: uid(), label: draft.kind === 'signup' ? `New seat · ${draft.slots.length + 1}` : 'New time window', votes: [], claims: [] });
      render();
    };
    $('#addSlide').onclick = () => {
      const n = draft.slides.length + 1;
      draft.slides.push({ id: n, label: `Slide ${n}`, body: n === 2 ? 'How it works' : `Beat ${n}` });
      toast('Slide added');
      render();
    };
    $('#aiGo').onclick = () => { draft.aiPrompt = $('#aiPrompt').value; applyAI(draft); render(); };
    $('#publish').onclick = publishDraft;
    $('#mailHint').onclick = () => toast('Uses desk Gmail when linked · invite text ready');
    $('#calHint').onclick = () => toast('Uses desk Calendar free/busy when linked');
    $('#backPicker').onclick = () => { view = 'picker'; draft = null; render(); };
    $('#shell').querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
      draft.slots.splice(+b.dataset.rm, 1);
      render();
    });
  }

  function renderRespond() {
    const item = db.items[respondId];
    if (!item) return renderPicker();
    $('#headTitle').textContent = item.title;
    const me = voterKey();
    const multi = item.kind === 'poll';
    $('#shell').innerHTML = `
      <div class="respond" data-widget="respond vote claim">
        <h2>${esc(item.title)}</h2>
        <p class="note">${esc(item.note)} · ${item.kind === 'poll' ? 'Select all that work' : item.kind === 'signup' ? 'Claim open seats' : 'Pick one time'}</p>
        <div id="choices">
          ${item.slots.map(s => {
            const taken = s.claims.length && !s.claims.includes(me);
            const mine = item.kind === 'poll' ? s.votes.includes(me) : s.claims.includes(me);
            const meta = item.kind === 'poll'
              ? `${s.votes.length} vote${s.votes.length === 1 ? '' : 's'}`
              : (taken ? 'Taken' : (s.claims.length ? 'Yours' : 'Open'));
            return `<label class="choice ${mine ? 'on' : ''} ${taken ? 'taken' : ''}">
              <input type="${multi ? 'checkbox' : 'radio'}" name="slot" value="${s.id}" ${mine ? 'checked' : ''} ${taken ? 'disabled' : ''}>
              <span>${esc(s.label)}</span>
              <span class="meta">${meta}</span>
            </label>`;
          }).join('')}
        </div>
        <div class="bar" style="border:0;padding:10px 0 0;background:transparent">
          <button class="limeBtn" id="submitResp">Submit</button>
          <button class="ghostBtn" id="copyResp">Copy link</button>
          <button class="ghostBtn" id="backHome">Workflows home</button>
        </div>
      </div>
    `;
    $('#submitResp').onclick = () => {
      const selected = [...$('#shell').querySelectorAll('input[name=slot]:checked')].map(i => i.value);
      submitResponse(selected);
    };
    $('#copyResp').onclick = () => copy(shareUrl(respondId));
    $('#backHome').onclick = () => { view = 'picker'; respondId = null; history.replaceState({}, '', location.pathname + '?v=f5'); render(); };
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function applySearch(q) {
    const needle = (q || '').trim().toLowerCase();
    document.querySelectorAll('[data-widget]').forEach(el => {
      const hay = ((el.dataset.widget || '') + ' ' + el.textContent).toLowerCase();
      el.classList.toggle('is-hidden', !!needle && !hay.includes(needle));
    });
  }

  function render() {
    if (view === 'picker') renderPicker();
    else if (view === 'editor') renderEditor();
    else renderRespond();
    applySearch($('#askInput').value);
  }

  $('#deskAsk').onsubmit = (e) => {
    e.preventDefault();
    applySearch($('#askInput').value);
    const q = $('#askInput').value.trim().toLowerCase();
    if (q.includes('resume')) startEditor('resume');
    else if (q.includes('poll')) startEditor('poll');
    else if (q.includes('sign')) startEditor('signup');
    else if (q.includes('1:1') || q.includes('one')) startEditor('oneOne');
    else if (q.includes('book') || q.includes('calendly')) startEditor('booking');
    else if (q) toast('Filtered');
  };
  $('#askInput').oninput = () => applySearch($('#askInput').value);
  $('#askPlus').onclick = () => { view = 'picker'; draft = null; render(); toast('Pick a workflow'); };

  window.addEventListener('wheel', (e) => {
    const ask = $('#deskAsk');
    if (e.deltaY > 4) ask.classList.add('is-hidden');
    else if (e.deltaY < -4) ask.classList.remove('is-hidden');
  }, { passive: true });

  const params = new URLSearchParams(location.search);
  const w = params.get('w');
  if (w) openRespond(w);
  else render();
})();
