/* MindCraft Studio — real local create app (Fable 5 desk surface) */
(() => {
  const KEY = 'mc_studio_project_v1';
  const DB = 'mc_studio_blobs_v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = {
    title: 'Untitled Story',
    media: [], // {id, name, kind, mime}
    scenes: [], // {id, mediaId, dur}
    words: [], // {id, text, style}
    stickers: [], // {id, emoji, x, y}
    musicId: null,
    captions: true,
    look: 'none',
    selectedScene: null,
    playing: false,
    playT: 0,
    urls: {}, // id -> objectURL
  };

  let playTimer = null;

  function uid() { return Math.random().toString(36).slice(2, 10); }
  function toast(msg) {
    const el = $('#toast');
    el.hidden = false; el.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('blobs');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function putBlob(id, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getBlob(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readonly');
      const req = tx.objectStore('blobs').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function delBlob(id) {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').delete(id);
      tx.oncomplete = () => resolve();
    });
  }

  function saveMeta() {
    localStorage.setItem(KEY, JSON.stringify({
      title: state.title,
      media: state.media,
      scenes: state.scenes,
      words: state.words,
      stickers: state.stickers,
      musicId: state.musicId,
      captions: state.captions,
      look: state.look,
    }));
  }

  async function ensureUrl(id) {
    if (state.urls[id]) return state.urls[id];
    const blob = await getBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    state.urls[id] = url;
    return url;
  }

  async function loadProject() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      Object.assign(state, {
        title: p.title || state.title,
        media: p.media || [],
        scenes: p.scenes || [],
        words: p.words || [],
        stickers: p.stickers || [],
        musicId: p.musicId || null,
        captions: p.captions !== false,
        look: p.look || 'none',
      });
      $('#projectTitle').value = state.title;
      for (const m of state.media) {
        if (m.seed || m.id === 'jesse_seed') state.urls[m.id] = 'kitchen-warm.jpg';
        else await ensureUrl(m.id);
      }
    } catch (_) {}
  }

  function kindOf(file) {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'image';
  }

  async function ingestFiles(files) {
    for (const file of files) {
      const id = uid();
      const kind = kindOf(file);
      await putBlob(id, file);
      state.media.unshift({ id, name: file.name, kind, mime: file.type });
      await ensureUrl(id);
      if (kind === 'audio' && !state.musicId) {
        state.musicId = id;
        syncMusic();
      }
    }
    saveMeta();
    render();
    toast(`${files.length} file${files.length > 1 ? 's' : ''} added`);
  }

  function addScene(mediaId) {
    const m = state.media.find(x => x.id === mediaId);
    if (!m || m.kind === 'audio') return;
    const id = uid();
    state.scenes.push({ id, mediaId, dur: m.kind === 'video' ? 4 : 2.5 });
    state.selectedScene = id;
    saveMeta();
    render();
  }

  function useJesse() {
    const id = 'jesse_seed';
    if (!state.media.some(m => m.id === id)) {
      state.media.unshift({ id, name: 'Jesse’s Kitchen', kind: 'image', mime: 'image/jpeg', seed: true });
      state.urls[id] = 'kitchen-warm.jpg';
    }
    addScene(id);
    toast('Jesse scene on timeline');
  }

  function syncMusic() {
    const el = $('#musicEl');
    if (!state.musicId) { el.removeAttribute('src'); el.pause(); return; }
    ensureUrl(state.musicId).then(url => {
      if (!url) return;
      if (el.src !== url) el.src = url;
    });
  }

  function totalDur() {
    return state.scenes.reduce((a, s) => a + (s.dur || 2.5), 0);
  }

  function sceneAt(t) {
    let acc = 0;
    for (const s of state.scenes) {
      acc += s.dur || 2.5;
      if (t < acc) return s;
    }
    return state.scenes[state.scenes.length - 1] || null;
  }

  function stopPlay() {
    state.playing = false;
    clearInterval(playTimer);
    playTimer = null;
    $('#playBtn').textContent = '▶';
    $('#musicEl').pause();
  }

  function togglePlay() {
    if (!state.scenes.length) { toast('Add scenes first'); return; }
    if (state.playing) { stopPlay(); return; }
    state.playing = true;
    state.playT = 0;
    $('#playBtn').textContent = '■';
    syncMusic();
    const music = $('#musicEl');
    music.currentTime = 0;
    music.play().catch(() => {});
    playTimer = setInterval(() => {
      state.playT += 0.1;
      if (state.playT >= totalDur()) {
        stopPlay();
        state.playT = 0;
        paintStage();
        return;
      }
      const sc = sceneAt(state.playT);
      if (sc) state.selectedScene = sc.id;
      paintStage();
      const m = Math.floor(state.playT / 60);
      const s = Math.floor(state.playT % 60);
      $('#timecode').textContent = `${m}:${String(s).padStart(2, '0')}`;
    }, 100);
  }

  function paintStage() {
    const stage = $('#stage');
    stage.classList.remove('look-warm', 'look-cool', 'look-noir', 'look-pop');
    if (state.look !== 'none') stage.classList.add(`look-${state.look}`);

    const sc = state.scenes.find(s => s.id === state.selectedScene) || state.scenes[0];
    const hero = $('#jesseHero');
    const media = $('#stageMedia');
    const overlay = $('#stageOverlay');

    if (!sc) {
      hero.style.display = '';
      hero.hidden = false;
      media.innerHTML = '';
    } else {
      hero.hidden = true;
      hero.style.display = 'none';
      const m = state.media.find(x => x.id === sc.mediaId);
      const url = state.urls[sc.mediaId] || (m?.seed ? 'kitchen-warm.jpg' : '');
      if (m?.kind === 'video') {
        media.innerHTML = `<video src="${url}" autoplay muted playsinline loop></video>`;
      } else {
        media.innerHTML = url ? `<img src="${url}" alt="">` : '';
      }
    }

    overlay.innerHTML = '';
    for (const w of state.words) {
      const d = document.createElement('div');
      d.className = `word ${w.style || 'blocky'}`;
      d.textContent = w.text;
      d.contentEditable = 'true';
      d.onblur = () => { w.text = d.textContent.trim() || w.text; saveMeta(); };
      overlay.appendChild(d);
    }
    for (const st of state.stickers) {
      const d = document.createElement('div');
      d.className = 'stickerAbs';
      d.textContent = st.emoji;
      d.style.left = `${st.x}%`;
      d.style.top = `${st.y}%`;
      bindDrag(d, st);
      overlay.appendChild(d);
    }
    if (state.captions && sc) {
      const m = state.media.find(x => x.id === sc.mediaId);
      const cap = document.createElement('div');
      cap.className = 'word sticker';
      cap.style.top = '72%';
      cap.textContent = m?.name?.replace(/\.[^.]+$/, '') || 'Scene';
      overlay.appendChild(cap);
    }
  }

  function bindDrag(el, st) {
    let ox, oy;
    el.onpointerdown = (e) => {
      el.setPointerCapture(e.pointerId);
      const r = $('#stage').getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      el.onpointermove = (ev) => {
        const rr = $('#stage').getBoundingClientRect();
        st.x = Math.max(2, Math.min(92, ((ev.clientX - rr.left) / rr.width) * 100));
        st.y = Math.max(2, Math.min(88, ((ev.clientY - rr.top) / rr.height) * 100));
        el.style.left = `${st.x}%`;
        el.style.top = `${st.y}%`;
      };
      el.onpointerup = () => { el.onpointermove = null; saveMeta(); };
    };
  }

  function renderWidgets() {
    $('#leftCol').innerHTML = `
      <div class="widget" data-widget="media photos clips upload">
        <h3>Media</h3><div class="hint">Photos & clips</div>
        <div class="mediaGrid" id="mediaGrid"></div>
      </div>
      <div class="widget" data-widget="text titles words">
        <h3>Text</h3><div class="hint">Titles that stick</div>
        <div class="pills" id="textPills">
          <button class="pill" data-style="blocky">Blocky</button>
          <button class="pill" data-style="neon">Neon</button>
          <button class="pill" data-style="sticker">Sticker tag</button>
        </div>
      </div>
      <div class="widget" data-widget="captions mute subtitles">
        <h3>Captions</h3><div class="hint">Mute-friendly</div>
        <button class="limeBtn" id="capBtn">${state.captions ? 'Captions on' : 'Captions off'}</button>
      </div>
    `;
    $('#rightCol').innerHTML = `
      <div class="widget" data-widget="stickers emoji slap">
        <h3>Stickers</h3><div class="hint">Slap-on energy</div>
        <div class="stickerGrid" id="stickerGrid"></div>
      </div>
      <div class="widget" data-widget="music audio spotify beat">
        <h3>Music</h3><div class="hint">Upload a track</div>
        <button class="limeBtn" id="musicPick">Pick audio file</button>
        <div class="hint" style="margin-top:6px" id="musicLabel">${state.musicId ? 'Track linked' : 'No track yet'}</div>
      </div>
      <div class="widget" data-widget="looks filters fx warm cool noir pop">
        <h3>Looks</h3><div class="hint">One-tap filters</div>
        <div class="pills" id="lookPills">
          ${['none','warm','cool','noir','pop'].map(l =>
            `<button class="pill ${state.look===l?'on':''}" data-look="${l}">${l}</button>`).join('')}
        </div>
      </div>
    `;

    const grid = $('#mediaGrid');
    grid.innerHTML = `<button class="addCell" id="addMedia">+</button>`;
    for (const m of state.media.filter(x => x.kind !== 'audio')) {
      const url = state.urls[m.id] || (m.seed ? 'kitchen-warm.jpg' : '');
      const b = document.createElement('button');
      b.className = 'mediaCell';
      b.title = m.name;
      b.innerHTML = m.kind === 'video'
        ? `<video src="${url}" muted></video>`
        : `<img src="${url}" alt="">`;
      b.onclick = () => addScene(m.id);
      grid.appendChild(b);
    }
    $('#addMedia').onclick = () => $('#fileInput').click();
    $$('#textPills .pill').forEach(p => p.onclick = () => {
      state.words.push({ id: uid(), text: 'Your title', style: p.dataset.style });
      saveMeta(); render();
    });
    $('#capBtn').onclick = () => { state.captions = !state.captions; saveMeta(); render(); };
    ['🔥','💎','⚡','🌿','🎯','✨','🦉','⭐'].forEach(e => {
      const b = document.createElement('button');
      b.textContent = e;
      b.onclick = () => {
        state.stickers.push({ id: uid(), emoji: e, x: 40 + Math.random()*20, y: 35 + Math.random()*20 });
        saveMeta(); render();
      };
      $('#stickerGrid').appendChild(b);
    });
    $('#musicPick').onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'audio/*';
      inp.onchange = () => inp.files?.length && ingestFiles(inp.files);
      inp.click();
    };
    $$('#lookPills .pill').forEach(p => p.onclick = () => {
      state.look = p.dataset.look; saveMeta(); render();
    });
  }

  function renderTimeline() {
    const sceneLane = $('#sceneLane');
    if (!state.scenes.length) {
      sceneLane.innerHTML = `<span class="emptyLane">Tap media to build scenes →</span>`;
    } else {
      sceneLane.innerHTML = state.scenes.map(s => {
        const m = state.media.find(x => x.id === s.mediaId);
        return `<div class="clip ${state.selectedScene===s.id?'on':''}" data-sid="${s.id}">
          <span>${(m?.name || 'scene').slice(0,14)}</span>
          <span class="x" data-rm="${s.id}">✕</span>
        </div>`;
      }).join('');
      $$('.clip[data-sid]').forEach(c => {
        c.onclick = (e) => {
          if (e.target.dataset.rm) {
            state.scenes = state.scenes.filter(s => s.id !== e.target.dataset.rm);
            saveMeta(); render(); return;
          }
          state.selectedScene = c.dataset.sid; render();
        };
      });
    }
    $('#wordLane').innerHTML = state.words.length
      ? state.words.map(w => `<div class="clip" style="background:#2a5644">${w.text.slice(0,18)} <span class="x" data-wid="${w.id}">✕</span></div>`).join('')
      : `<span class="emptyLane">Words overlay every scene</span>`;
    $$('[data-wid]').forEach(x => x.onclick = (e) => {
      e.stopPropagation();
      state.words = state.words.filter(w => w.id !== x.dataset.wid);
      saveMeta(); render();
    });
    $('#musicLane').innerHTML = state.musicId
      ? `<div class="clip" style="background:#1f6b4a">Track on · clear <span class="x" id="rmMusic">✕</span></div>`
      : `<span class="emptyLane">Upload audio in Music</span>`;
    $('#rmMusic')?.addEventListener('click', async () => {
      const id = state.musicId;
      state.musicId = null;
      if (id && !state.media.some(m => m.id === id && m.kind !== 'audio')) await delBlob(id);
      state.media = state.media.filter(m => m.id !== id);
      syncMusic(); saveMeta(); render();
    });
    $('#tlHint').textContent = state.scenes.length
      ? `${state.scenes.length} scenes · ${totalDur().toFixed(1)}s`
      : 'Tap media to add scenes';
  }

  function render() {
    renderWidgets();
    renderTimeline();
    paintStage();
    applySearch($('#askInput').value);
  }

  function applySearch(q) {
    const needle = (q || '').trim().toLowerCase();
    $$('.widget').forEach(w => {
      const hay = (w.dataset.widget || '') + ' ' + w.textContent.toLowerCase();
      w.classList.toggle('is-hidden', !!needle && !hay.includes(needle));
    });
  }

  // events
  $('#fileInput').onchange = () => {
    if ($('#fileInput').files?.length) ingestFiles($('#fileInput').files);
    $('#fileInput').value = '';
  };
  $('#askPlus').onclick = () => $('#fileInput').click();
  $('#deskAsk').onsubmit = (e) => {
    e.preventDefault();
    applySearch($('#askInput').value);
    const q = $('#askInput').value.trim().toLowerCase();
    if (q.includes('caption')) { state.captions = true; saveMeta(); render(); toast('Captions on'); }
    else if (q.includes('warm') || q.includes('noir') || q.includes('cool') || q.includes('pop')) {
      state.look = ['warm','cool','noir','pop'].find(l => q.includes(l)) || state.look;
      saveMeta(); render(); toast(`Look · ${state.look}`);
    } else if (q) toast('Filtered widgets');
  };
  $('#askInput').oninput = () => applySearch($('#askInput').value);
  $('#projectTitle').oninput = () => { state.title = $('#projectTitle').value; saveMeta(); };
  $('#playBtn').onclick = togglePlay;
  $('#useJesse').onclick = useJesse;
  $('#craftBtn').onclick = () => {
    if (!state.scenes.length) { toast('Add at least one scene'); return; }
    toast(`Crafted · ${state.scenes.length} scenes · ${totalDur().toFixed(1)}s (device save)`);
  };

  // drag-drop
  const board = $('#board');
  ['dragover','dragenter'].forEach(ev => board.addEventListener(ev, e => e.preventDefault()));
  board.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) ingestFiles(e.dataTransfer.files);
  });

  // ask dock: scroll/wheel tuck
  let lastY = 0;
  window.addEventListener('wheel', (e) => {
    const ask = $('#deskAsk');
    if (e.deltaY > 4) ask.classList.add('is-hidden');
    else if (e.deltaY < -4) ask.classList.remove('is-hidden');
  }, { passive: true });

  loadProject().then(() => {
    if (!state.media.length) {
      state.urls.jesse_seed = 'kitchen-warm.jpg';
    }
    syncMusic();
    render();
  });
})();
