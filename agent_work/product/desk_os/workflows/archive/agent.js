/* Jesse archive workspace — textbook cards, story-boxes, study plan, MicroSims. */
(() => {
  const WEBHOOK = 'https://mindcraft-webhook.vercel.app/api/archive-rag';
  const WAIT_MS = 4000;
  const SHELF = [
    { slug: 'circuits', title: 'AI Circuits Course', subject: 'Engineering', cover: 'covers/circuits.jpg',
      description: 'Learn electronic circuits with AI-powered simulations and knowledge graphs.',
      stats: '300 concepts · 16 chapters · 75 MicroSims' },
    { slug: 'calculus', title: 'Calculus', subject: 'Mathematics', cover: 'covers/calculus.jpg',
      description: 'Interactive Calculus textbook covering AB and BC curricula.',
      stats: '380 concepts · 23 chapters · 123 MicroSims' },
    { slug: 'fft-benchmarking', title: 'Real-Time DSP on a $5 Microcontroller', subject: 'Engineering', cover: 'covers/dsp.jpg',
      description: 'FFT theory to the oscilloscope on a Raspberry Pi Pico 2.',
      stats: '574 concepts · 27 chapters · 62 MicroSims' },
    { slug: 'learning-micropython', title: 'Learning MicroPython with AI', subject: 'Programming', cover: 'covers/micropython.jpg',
      description: 'Kids learn MicroPython on real chips.',
      stats: '3 MicroSims · 81K words' },
    { slug: 'raspberry-pi-stem', title: 'Learning STEM with Raspberry Pi Hardware', subject: 'STEM', cover: 'covers/raspberry-pi.jpg',
      description: 'Raspberry Pi as a STEM classroom.',
      stats: '531 concepts · 20 chapters · 99 MicroSims' },
    { slug: 'beginning-electronics', title: 'Beginning Electronics with AI', subject: 'Engineering', cover: 'covers/electronics.jpg',
      description: 'Electronics basics for junior and high school.',
      stats: '9 MicroSims · 21K words' },
    { slug: 'biology', title: 'Biology: An Interactive Course', subject: 'Life Sciences', cover: 'covers/biology.jpg',
      description: 'Advanced high school biology with college-credit focus.',
      stats: '380 concepts · 20 chapters · 86 MicroSims' },
    { slug: 'chemistry', title: 'Chemistry', subject: 'Chemistry', cover: 'covers/chemistry.jpg',
      description: 'College-credit chemistry with interactive simulations.',
      stats: '500 concepts · 18 chapters · 46 MicroSims' },
    { slug: 'intro-to-physics-course', title: 'Introduction to Physics', subject: 'Physics', cover: 'covers/physics.jpg',
      description: 'Motion and energy for a year-long intro course.',
      stats: '200 concepts · 13 chapters · 104 MicroSims' },
    { slug: 'learning-python', title: 'Learning Python', subject: 'Computer Science', cover: 'covers/python.jpg',
      description: 'Python from fifth grade onward.',
      stats: '450 concepts · 38 chapters · 31 MicroSims' },
    { slug: 'computer-science', title: 'Computer Science with Python', subject: 'Computer Science', cover: 'covers/computer-science.jpg',
      description: 'College-credit computer science.',
      stats: '400 concepts · 20 chapters · 121 MicroSims' },
    { slug: 'quantum-computing', title: "A Skeptic's Guide to Quantum Computing", subject: 'Physics', cover: 'covers/quantum.jpg',
      description: 'Why quantum computing may never be economically viable.',
      stats: '241 concepts · 17 chapters · 52 MicroSims' },
    { slug: 'linear-algebra', title: 'Linear Algebra for AI and Machine Learning', subject: 'Mathematics', cover: 'covers/linear-algebra.jpg',
      description: 'Abstract algebra bridged to AI.',
      stats: '300 concepts · 15 chapters · 126 MicroSims' },
    { slug: 'algebra-1', title: 'Algebra I', subject: 'Mathematics', cover: 'covers/algebra.jpg',
      description: 'Introductory algebra with interactive simulations.',
      stats: '200 concepts · 13 chapters · 13 MicroSims' },
    { slug: 'geometry-course', title: 'AI Assisted Geometry', subject: 'Mathematics', cover: 'covers/geometry.jpg',
      description: 'High-school geometry using MicroSims.',
      stats: '200 concepts · 12 chapters · 173 MicroSims' },
    { slug: 'hydroponics', title: 'Hydroponics: From Mason Jar to Vertical Farm', subject: 'Agriculture', cover: 'covers/hydroponics.jpg',
      description: 'Hydroponic plant systems, mason jar to farm.',
      stats: '500 concepts · 21 chapters · 30 MicroSims' },
  ];
  const STOP = new Set(['the','and','for','with','that','this','from','what','how','why','are','was','can','you','your','about','into','book','page','open','show','tell','please','jesse','plan','study']);
  const TIME_LABEL = { 15: '15 minutes', 45: '45 minutes', 120: '2 hours', week: 'this week' };
  const TONES = ['mustard', 'teal', 'magenta', 'olive', 'lavender', 'forest', 'lime'];

  const $ = (id) => document.getElementById(id);
  const glass = () => window.deskGlass && window.deskGlass.draw();
  const esc = window.DeskBoxes.escapeHtml;

  let chunks = [];
  let thinking = false;
  let plan = { minutes: null, interest: null };
  let currentHit = null;
  let planned = false;

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

  function pushBox(spec) {
    const el = window.DeskBoxes.renderWorkspaceBox(spec, (s) => {
      if (s.action === 'open' && s.hit) openBook(s.hit);
      if (s.action === 'sim' && s.hit) { openBook(s.hit); loadSim(s.hit); }
    });
    $('board').appendChild(el);
    glass();
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function openBook(hit) {
    if (!hit) return;
    currentHit = hit;
    show('desk');
    $('spread').hidden = false;
    $('pageBook').textContent = hit.bookTitle;
    $('pageTitle').textContent = hit.pageTitle;
    $('pageQuote').textContent = hit.quote;
    $('pageLink').href = hit.pageUrl;
    const hasSim = Boolean(hit.simUrl);
    $('loadSim').hidden = !hasSim;
    if (!hasSim) {
      $('simFrame').hidden = true;
      $('simFrame').removeAttribute('src');
    }
    glass();
  }

  function loadSim(hit) {
    const h = hit || currentHit;
    if (!h || !h.simUrl) return;
    $('simFrame').hidden = false;
    $('simFrame').src = h.simUrl + 'main.html';
    $('loadSim').hidden = true;
    glass();
  }

  function nForTime() {
    if (plan.minutes === 15) return 1;
    if (plan.minutes === 45) return 2;
    if (plan.minutes === 120) return 3;
    return 4;
  }

  function layPlan() {
    const q = plan.interest || 'calculus';
    const hits = retrieve(q, nForTime());
    $('board').innerHTML = '';
    pushBox({
      tone: 'mustard',
      kicker: 'Your window',
      title: TIME_LABEL[plan.minutes] || 'A sitting',
      body: 'Enough for a real page. Not a scroll.',
    });
    const book = hits[0] ? hits[0].bookTitle : q;
    pushBox({
      tone: 'teal',
      kicker: 'Today’s book',
      title: book,
      body: 'Dan’s open textbook. We open the page. We do not copy it.',
    });
    hits.forEach((h, i) => {
      const sim = h.simUrl;
      pushBox({
        tone: TONES[i % TONES.length],
        kicker: sim ? 'Page + simulation' : 'Page',
        title: h.pageTitle,
        body: h.quote.slice(0, 140),
        bullets: [h.bookTitle],
        cta: sim ? 'Load simulation' : 'Open this page',
        action: sim ? 'sim' : 'open',
        hit: h,
      });
    });
    if (hits[0]) openBook(hits[0]);
    const reply = hits[0]
      ? 'For ' + (TIME_LABEL[plan.minutes] || 'this sitting') + ' I laid ' + book + ' on the desk. Start at ' + hits[0].pageTitle + '.'
      : 'I heard the time. Name a subject and I will pick a book.';
    addBubble('j', reply);
    speak(reply);
    $('deskLive').textContent = 'Plan on the desk';
  }

  function parseTime(text) {
    const t = text.toLowerCase();
    if (/week|several day/.test(t)) return 'week';
    if (/2 hour|two hour|120/.test(t)) return 120;
    if (/45|hour|hourish/.test(t)) return 45;
    if (/15|twenty|quick|short/.test(t)) return 15;
    return null;
  }

  function parseInterest(text) {
    const t = text.toLowerCase();
    const keys = ['micropython','circuits','calculus','dsp','fft','biology','chemistry','physics','geometry','hydroponics','quantum','electronics','python','algebra'];
    return keys.find((k) => t.includes(k)) || null;
  }

  async function ask(message) {
    const text = String(message || '').trim();
    if (!text || thinking) return;
    show('desk');
    addBubble('you', text);

    const t = parseTime(text);
    const interest = parseInterest(text);
    if (t && !plan.minutes) plan.minutes = t;
    if (interest) plan.interest = interest;

    if (!plan.minutes) {
      addBubble('j', 'How much time do you have. Fifteen minutes, forty-five, two hours, or this week.');
      speak('How much time do you have. Fifteen minutes, forty-five, two hours, or this week.');
      $('timeChips').hidden = false;
      $('interestChips').hidden = true;
      $('deskLive').textContent = 'Waiting on time';
      return;
    }
    if (!plan.interest) {
      $('timeChips').hidden = true;
      $('interestChips').hidden = false;
      addBubble('j', 'What are you into. Circuits, calculus, DSP, biology, Python.');
      speak('What are you into. Circuits, calculus, DSP, biology, Python.');
      $('deskLive').textContent = 'Waiting on interest';
      return;
    }

    setThink(true, 'Jesse is reading');
    const started = Date.now();
    let hits = retrieve(text + ' ' + plan.interest, 3);
    try {
      const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, minutes: plan.minutes, interest: plan.interest }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.hits) && data.hits.length) hits = data.hits;
      }
    } catch (_) {}
    const wait = Math.max(0, WAIT_MS - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    setThink(false);
    $('timeChips').hidden = true;
    $('interestChips').hidden = true;
    if (planned) {
      const hits = retrieve(text + ' ' + (plan.interest || ''), 1);
      const reply = hits[0]
        ? 'Opened ' + hits[0].bookTitle + ' at ' + hits[0].pageTitle + '.'
        : 'I do not have that page yet.';
      addBubble('j', reply);
      speak(reply);
      if (hits[0]) openBook(hits[0]);
      return;
    }
    planned = true;
    layPlan();
  }

  function startPlan() {
    plan = { minutes: null, interest: null };
    planned = false;
    $('board').innerHTML = '';
    $('log').innerHTML = '';
    $('spread').hidden = true;
    $('timeChips').hidden = false;
    $('interestChips').hidden = true;
    show('desk');
    addBubble('j', 'How much time do you have, and what are you into.');
    speak('How much time do you have, and what are you into.');
    $('deskLive').textContent = 'Time and interest first';
    glass();
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
    $('shelfGrid').innerHTML = SHELF.map((b) => `
      <button class="tcard" type="button" data-slug="${esc(b.slug)}">
        <img src="${esc(b.cover)}" alt="">
        <div class="body">
          <div class="cat">${esc(b.subject)}</div>
          <h2>${esc(b.title)}</h2>
          <p>${esc(b.description)}</p>
          <div class="stats">${esc(b.stats)}</div>
        </div>
      </button>
    `).join('');
    $('shelfGrid').querySelectorAll('.tcard').forEach((el) => {
      el.addEventListener('click', () => {
        const slug = el.getAttribute('data-slug');
        const book = SHELF.find((b) => b.slug === slug);
        plan.interest = slug.replace(/-/g, ' ');
        const hits = retrieve(book.title, 1);
        show('desk');
        if (hits[0]) {
          openBook(hits[0]);
          addBubble('j', 'Opened ' + book.title + '. Want a plan around it, or shall we load a simulation.');
          speak('Opened ' + book.title + '. Want a plan around it, or shall we load a simulation.');
          if (hits[0].simUrl) {
            pushBox({
              tone: 'magenta',
              kicker: 'Touch the idea',
              title: hits[0].pageTitle,
              body: 'Dan’s MicroSim. Change a variable. Watch it move.',
              cta: 'Load simulation',
              action: 'sim',
              hit: hits[0],
            });
          }
        } else {
          plan.minutes = plan.minutes || 45;
          layPlan();
        }
      });
    });
  }

  $('planBtn').addEventListener('click', startPlan);
  $('shelfPlan').addEventListener('click', startPlan);
  $('toShelf').addEventListener('click', () => show('shelf'));
  $('backShelf').addEventListener('click', () => show('shelf'));
  $('endCall').addEventListener('click', () => { speechSynthesis.cancel(); show('meet'); });
  $('loadSim').addEventListener('click', () => loadSim());
  document.querySelectorAll('[data-time]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-time');
      plan.minutes = v === 'week' ? 'week' : Number(v);
      ask(TIME_LABEL[plan.minutes]);
    });
  });
  document.querySelectorAll('[data-interest]').forEach((btn) => {
    btn.addEventListener('click', () => ask(btn.getAttribute('data-interest')));
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
