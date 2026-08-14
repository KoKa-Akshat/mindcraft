/* Jesse book-creation workspace — guided call, live draft, publish to Binder.
   Transcript pattern (speaker-labeled rows, append + auto-scroll, "Live"
   status while listening) adapted from st-imdev/oatmeal-meeting-notes (MIT) -
   see TranscriptRow/MeetingSession in that repo. Oatmeal keeps structuring
   as a separate post-call pass rather than live-restructuring notes; this
   workflow does the same: the transcript just grows, and the draft panel
   (title + chapters) is Jesse's separate, explicit organizing pass after
   each turn - not an attempt to reflow the transcript itself live. */
(() => {
  const WEBHOOK = 'https://mindcraft-webhook.vercel.app/api/book-agent';
  const WAIT_MS = 4000; // test note: keep - matches Jesse pacing elsewhere

  const $ = (id) => document.getElementById(id);
  const glass = () => window.deskGlass && window.deskGlass.draw();

  let thinking = false;
  let started = false;
  let draft = { topic: '', title: '', chapters: [] };

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
      if (v.lang === 'en-US') return 5;
      return 8;
    };
    return voices.sort((a, b) => rank(a) - rank(b))[0] || null;
  }

  function speak(text) {
    speechSynthesis.cancel();
    const voice = pickVoice();
    const parts = String(text || '').split(/(?<=[.?!])\s+/).filter(Boolean);
    const play = (i) => {
      if (i >= parts.length) return;
      const u = new SpeechSynthesisUtterance(parts[i]);
      u.rate = 0.92; u.pitch = 1.02;
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
    if (el) {
      el.hidden = !on;
      if (label) el.querySelector('b').textContent = label;
    }
    $('meetStatus').textContent = on ? 'Reading' : 'Ready to listen';
    document.querySelectorAll('[data-glass="orb"]').forEach((n) => n.classList.toggle('hot', on));
    glass();
  }

  function setLive(on) {
    const el = $('deskLive');
    if (!el) return;
    el.classList.toggle('live', on);
    if (on) el.textContent = 'Listening';
  }

  /* Oatmeal-style transcript row: speaker label + text, append-only, always
     auto-scrolls to the newest bubble. */
  function addBubble(who, text) {
    const el = document.createElement('div');
    el.className = 'bubble ' + who;
    const label = document.createElement('b');
    label.textContent = who === 'you' ? 'You' : 'Jesse';
    const body = document.createElement('span');
    body.textContent = text;
    el.appendChild(label);
    el.appendChild(body);
    $('log').appendChild(el);
    $('log').scrollTop = $('log').scrollHeight;
  }

  function renderDraft() {
    $('draftTitle').textContent = draft.title || draft.topic || 'Untitled book';
    const host = $('draftChapters');
    if (!draft.chapters.length) {
      host.innerHTML = '<p class="empty">Chapters will appear here as you talk.</p>';
    } else {
      host.innerHTML = draft.chapters.map((c, i) => `
        <div class="chapter">
          <h3>${escapeHtml(c.title || ('Chapter ' + (i + 1)))}</h3>
          <p>${escapeHtml(c.body)}</p>
        </div>
      `).join('');
    }
    $('publishBtn').disabled = !(draft.title && draft.chapters.length);
    glass();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  async function ask(message) {
    const text = String(message || '').trim();
    if (!text || thinking) return;
    addBubble('you', text);
    setThink(true, 'Jesse is reading');
    setLive(false);
    const startedAt = Date.now();
    let data = null;
    try {
      const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, draft }),
      });
      if (res.ok) data = await res.json();
    } catch (_) {}
    const wait = Math.max(0, WAIT_MS - (Date.now() - startedAt));
    await new Promise((r) => setTimeout(r, wait));
    setThink(false);
    if (data) {
      if (data.draft) draft = data.draft;
      const reply = data.reply || 'Tell me more and I will keep building the book.';
      addBubble('j', reply);
      speak(reply);
      $('deskLive').textContent = data.readyToPublish ? 'Ready to publish' : 'What is your book about';
    } else {
      const reply = 'I could not reach the desk just now. Keep talking and I will catch up.';
      addBubble('j', reply);
      speak(reply);
    }
    renderDraft();
  }

  function startBook() {
    if (started) { show('desk'); return; }
    started = true;
    draft = { topic: '', title: '', chapters: [] };
    $('log').innerHTML = '';
    show('desk');
    renderDraft();
    const greet = 'What do you want to teach. Any topic you know well enough to explain.';
    addBubble('j', greet);
    speak(greet);
  }

  function bindHold(btn) {
    let rec = null;
    let hold = false;
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    const start = () => {
      hold = true;
      btn.classList.add('hot');
      $('meetWave').classList.remove('off');
      setLive(true);
      glass();
      if (!Speech) return;
      rec = new Speech();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.onresult = (e) => {
        const said = e.results[0] && e.results[0][0] && e.results[0][0].transcript;
        if (said) ask(said);
      };
      rec.start();
    };
    const stop = () => {
      if (!hold) return;
      hold = false;
      btn.classList.remove('hot');
      $('meetWave').classList.add('off');
      setLive(false);
      try { rec && rec.stop(); } catch (_) {}
      glass();
    };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  }

  function publish() {
    if (!(draft.title && draft.chapters.length)) return;
    $('publishBtn').disabled = true;
    $('publishBtn').textContent = 'Publishing…';
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.deskBook) {
      window.webkit.messageHandlers.deskBook.postMessage({ type: 'publish', draft });
    } else {
      // No native bridge (plain browser preview) - nothing to write to.
      window.__deskBookFromNative && window.__deskBookFromNative({ type: 'publishResult', ok: false, error: 'No Desk app connection' });
    }
  }

  /* Native calls this after attempting the Firestore write. */
  window.__deskBookFromNative = (payload) => {
    if (!payload) return;
    if (payload.type === 'publishResult') {
      if (payload.ok) {
        $('publishBtn').textContent = 'Published';
        const reply = 'Filed to your Binder. Anyone reading it will see your name on it.';
        addBubble('j', reply);
        speak(reply);
      } else {
        $('publishBtn').disabled = false;
        $('publishBtn').textContent = 'Publish to Binder';
        const reply = payload.error || 'Could not publish just now. Try again in a moment.';
        addBubble('j', reply);
        speak(reply);
      }
    }
  };

  $('startBtn').addEventListener('click', startBook);
  $('endCall').addEventListener('click', () => { speechSynthesis.cancel(); show('meet'); });
  $('publishBtn').addEventListener('click', publish);
  $('typeInput').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = e.target.value.trim();
    if (!v) return;
    e.target.value = '';
    ask(v);
  });
  bindHold($('recBtn'));
  bindHold($('callRec'));
})();
