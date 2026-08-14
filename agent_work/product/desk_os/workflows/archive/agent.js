/* Jesse archive client — same call as resume: 5s beat, human voice, exact page box. */
(() => {
  const WEBHOOK = 'https://mindcraft-webhook.vercel.app/api/archive-rag';
  const WAIT_MS = 5000;
  const SHELF = [
    { slug: 'calculus', title: 'Calculus', cover: 'covers/calculus.jpg' },
    { slug: 'geometry-course', title: 'Geometry', cover: 'covers/geometry.jpg' },
    { slug: 'fft-benchmarking', title: 'DSP on a $5 chip', cover: 'covers/dsp.jpg' },
    { slug: 'learning-micropython', title: 'MicroPython', cover: 'covers/micropython.jpg' },
    { slug: 'raspberry-pi-stem', title: 'Raspberry Pi STEM', cover: 'covers/raspberry-pi.jpg' },
    { slug: 'circuits', title: 'Circuits', cover: 'covers/circuits.jpg' },
    { slug: 'beginning-electronics', title: 'Electronics', cover: 'covers/electronics.jpg' },
    { slug: 'biology', title: 'Biology', cover: 'covers/biology.jpg' },
    { slug: 'chemistry', title: 'Chemistry', cover: 'covers/chemistry.jpg' },
    { slug: 'intro-to-physics-course', title: 'Physics', cover: 'covers/physics.jpg' },
    { slug: 'learning-python', title: 'Python', cover: 'covers/python.jpg' },
    { slug: 'computer-science', title: 'Computer Science', cover: 'covers/computer-science.jpg' },
    { slug: 'quantum-computing', title: 'Quantum', cover: 'covers/quantum.jpg' },
    { slug: 'linear-algebra', title: 'Linear Algebra', cover: 'covers/linear-algebra.jpg' },
    { slug: 'algebra-1', title: 'Algebra I', cover: 'covers/algebra.jpg' },
    { slug: 'hydroponics', title: 'Hydroponics', cover: 'covers/hydroponics.jpg' },
  ];
  const STOP = new Set(['the','and','for','with','that','this','from','what','how','why','are','was','can','you','your','about','into','book','page','open','show','tell','please','jesse']);

  const $ = (id) => document.getElementById(id);
  const glass = () => window.deskGlass && window.deskGlass.draw();

  let chunks = [];
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

  function speak(text) {
    speechSynthesis.cancel();
    const voice = pickVoice();
    const parts = String(text || '').split(/(?<=[.?!])\s+/).filter(Boolean);
    const play = (i) => {
      if (i >= parts.length) return;
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
    document.querySelectorAll('[data-glass="orb"]').forEach((n) => n.classList.toggle('hot', on));
    glass();
  }

  function addBubble(who, text) {
    const el = document.createElement('div');
    el.className = 'bubble ' + who;
    el.textContent = text;
    $('log').appendChild(el);
    $('log').scrollTop = $('log').scrollHeight;
  }

  function tokens(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  }

  function retrieve(query, limit) {
    const q = tokens(query);
    if (!q.length) return [];
    const scored = [];
    for (const c of chunks) {
      const title = (c.bookTitle + ' ' + c.pageTitle + ' ' + (c.location || '')).toLowerCase();
      const body = String(c.quote || '').toLowerCase();
      let score = 0;
      for (const t of q) {
        if (title.includes(t)) score += 4;
        if (body.includes(t)) score += 1;
        if (String(c.bookSlug || '').replace(/-/g, ' ').includes(t)) score += 2;
      }
      if (score > 0) scored.push(Object.assign({ score }, c));
    }
    scored.sort((a, b) => b.score - a.score);
    const seen = new Set();
    const out = [];
    for (const h of scored) {
      if (seen.has(h.pageUrl)) continue;
      seen.add(h.pageUrl);
      out.push(h);
      if (out.length >= (limit || 3)) break;
    }
    return out;
  }

  function showPage(hit) {
    if (!hit) {
      $('pageBox').hidden = true;
      return;
    }
    $('pageBox').hidden = false;
    $('pageBook').textContent = hit.bookTitle;
    $('pageTitle').textContent = hit.pageTitle;
    $('pageQuote').textContent = hit.quote;
    $('pageLink').href = hit.pageUrl;
    glass();
  }

  function localReply(query, hits) {
    if (!hits.length) {
      return 'I do not have that page in the shelf yet. Try calculus, MicroPython, or the five-dollar DSP book.';
    }
    const top = hits[0];
    return 'I opened ' + top.bookTitle + ' at ' + top.pageTitle + '.';
  }

  async function ask(message) {
    const text = String(message || '').trim();
    if (!text || thinking) return;
    show('call');
    addBubble('you', text);
    const localHits = retrieve(text, 3);
    setThink(true, 'Jesse is reading');
    const started = Date.now();
    let reply = localReply(text, localHits);
    let hits = localHits;
    try {
      const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) reply = data.reply;
        if (Array.isArray(data.hits) && data.hits.length) hits = data.hits;
      }
    } catch (_) { /* on-device index is enough */ }
    const wait = Math.max(0, WAIT_MS - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    setThink(false);
    addBubble('j', reply);
    showPage(hits[0] || null);
    speak(reply);
  }

  function bindHold(btn) {
    let rec = null;
    let hold = false;
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    const start = () => {
      hold = true;
      btn.classList.add('hot');
      $('meetWave').classList.remove('off');
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
      try { rec && rec.stop(); } catch (_) {}
      glass();
    };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  }

  function renderShelf() {
    $('shelfGrid').innerHTML = SHELF.map((b) =>
      '<button class="spine" type="button" data-slug="' + b.slug + '">' +
        '<img src="' + b.cover + '" alt="' + b.title + '">' +
        '<span>' + b.title + '</span>' +
      '</button>'
    ).join('');
    $('shelfGrid').querySelectorAll('.spine').forEach((el) => {
      el.addEventListener('click', () => ask('Open ' + el.querySelector('span').textContent));
    });
  }

  $('callBtn').addEventListener('click', () => {
    show('call');
    if (!$('log').childElementCount) {
      addBubble('j', 'Ask for a page. Calculus, MicroPython, circuits, or the five-dollar DSP book.');
      speak('Ask for a page. Calculus, MicroPython, circuits, or the five-dollar DSP book.');
    }
    glass();
  });
  $('shelfCall').addEventListener('click', () => $('callBtn').click());
  $('toShelf').addEventListener('click', () => show('shelf'));
  $('endCall').addEventListener('click', () => { speechSynthesis.cancel(); show('meet'); });
  document.querySelectorAll('[data-say]').forEach((btn) => {
    btn.addEventListener('click', () => ask(btn.getAttribute('data-say')));
  });
  bindHold($('recBtn'));
  bindHold($('callRec'));
  renderShelf();

  fetch('./chunks.json').then((r) => r.json()).then((data) => {
    chunks = data.chunks || [];
    const q = new URLSearchParams(location.search).get('q');
    if (q) ask(q);
  }).catch(() => {});
})();
