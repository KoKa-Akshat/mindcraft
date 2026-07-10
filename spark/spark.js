/**
 * spark.js — First Spark overlay for the marketing site (Option A).
 *
 * A cinematic 60–90s curtain layered ON TOP of index.html: visitor types
 * 2–4 interests, solves ONE real bank question wrapped in a scene woven
 * from those interests, then the overlay fades into the same page at
 * #proof. No SEO/perf impact: this module is dynamically imported only on
 * first visit (after window load) or via the hero "See your math" CTA.
 *
 * - Palette/typography mirror index.html tokens (cream/ink/leaf/gold/mint,
 *   Fredoka + Nunito Sans — both already loaded by the page).
 * - Offline-first: deterministic weave via spark-engine.mjs; the Groq API
 *   skin is an enhancement raced against a 3.5s budget.
 * - C4 hide-correctness: the choice is recorded, the world responds in
 *   story physics — no ✓/✗, no verdict.
 * - prefers-reduced-motion: static field, crossfade-only transitions.
 * - Mobile: 28 bubbles, single-column paper card, 44px touch targets.
 *
 * Synced from canonicals in app/public/demo/v2/ where noted; engine + bank
 * copies land here via `node app/scripts/syncSparkAssets.mjs`.
 */
import { fuse, interestLine } from './spark-engine.mjs'

const API = 'https://mindcraft-webhook.vercel.app/api/spark-experience'
const SEEN_KEY = 'mc_spark_seen'
const SESSION_KEY = 'mc_spark_v2'
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches

const COPY = {
  title: 'Mind<em>Craft</em>',
  promiseA: 'Be good at your craft.',
  promiseB: "We'll find the math inside it.",
  inviteTitle: 'Tell us what you like.',
  inviteHint0: 'Add at least two.',
  inviteHint1: 'One more. We need a shape to match.',
  inviteHintMore: 'Add up to four, or build your scene.',
  inviteHintMax: 'Four is plenty for a first scene.',
  buildBtn: 'Build my scene →',
  loading: 'Finding your scene…',
  pickHint: 'Pick one. No verdict yet.',
  finaleStamp: 'You just solved something real',
  finaleTitle: 'This is MindCraft',
  builtAround: list => `Built around ${list}.`,
  bridge: "We have talented tutors, and families who've felt the click.",
  seeReviews: 'See reviews',
  keepExploring: 'Keep exploring',
  autoNote: 'Taking you there…',
  skip: 'Skip',
  memoryChip: list => `You solved something in ${list}.`,
  placeholder: 'cooking, music, space…',
}

const CSS = `
#mcSpark { position: fixed; inset: 0; z-index: 200; font-family: "Nunito Sans", system-ui, sans-serif; color: #143a2e;
  background: radial-gradient(circle at 78% 16%, rgba(185,232,111,.42), transparent 28%),
              radial-gradient(circle at 14% 82%, rgba(220,238,246,.65), transparent 22%),
              linear-gradient(135deg, #fff8e9 0%, #f4f2dc 48%, #e4f7dc 100%);
  opacity: 0; transition: opacity 1.1s cubic-bezier(.16,1,.3,1); }
#mcSpark.on { opacity: 1; }
#mcSpark.leaving { opacity: 0; pointer-events: none; }
#mcSpark canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
#mcSpark .mcs-stage { position: absolute; inset: 0; display: grid; place-items: center;
  padding: max(72px, calc(env(safe-area-inset-top) + 56px)) 20px max(16px, env(safe-area-inset-bottom));
  text-align: center; pointer-events: none; overflow-y: auto; }
#mcSpark .mcs-stage.live { pointer-events: auto; }
#mcSpark .mcs-fade { opacity: 0; transition: opacity .9s cubic-bezier(.16,1,.3,1), transform 1s cubic-bezier(.16,1,.3,1); }
#mcSpark .mcs-fade.in { opacity: 1; }
#mcSpark .mcs-logo { font-family: Fredoka, system-ui, sans-serif; font-size: clamp(3.2rem, 12vw, 7rem); font-weight: 700;
  letter-spacing: -.03em; line-height: .95; }
#mcSpark .mcs-logo em { font-style: normal; color: #d3a900; }
#mcSpark .mcs-tagline { max-width: 520px; margin: 10px auto 0; font-size: clamp(1.15rem, 3.4vw, 1.8rem); font-weight: 600; color: #687468; }
#mcSpark .mcs-panel { width: min(480px, 94vw); padding: 22px 22px 18px; border-radius: 28px; text-align: left;
  background: rgba(255,253,247,.9); border: 1px solid rgba(20,58,46,.14); box-shadow: 0 24px 70px rgba(29,84,54,.14);
  backdrop-filter: blur(16px); transform: translateY(30px); }
#mcSpark .mcs-fade.in.mcs-panel { transform: translateY(0); }
#mcSpark .mcs-panel h2 { font-family: Fredoka, system-ui, sans-serif; font-size: 1.35rem; font-weight: 600; margin: 0 0 6px; }
#mcSpark .mcs-sub { margin: 0 0 14px; font-size: .88rem; color: #687468; font-weight: 600; }
#mcSpark .mcs-field { display: flex; gap: 8px; border: 1px solid rgba(20,58,46,.14); border-radius: 18px; background: #fffdf7; padding: 5px 5px 5px 16px; }
#mcSpark .mcs-field:focus-within { border-color: rgba(36,122,77,.35); box-shadow: 0 0 0 4px rgba(95,183,121,.12); }
#mcSpark .mcs-field input { flex: 1; min-width: 0; border: none; background: transparent; font: inherit; font-size: 1rem; color: #143a2e; outline: none; }
#mcSpark .mcs-field input::placeholder { color: #9aa89a; }
#mcSpark .mcs-add { width: 44px; height: 44px; border-radius: 14px; border: none; background: #143a2e; color: #fff;
  display: grid; place-items: center; cursor: pointer; flex-shrink: 0; font-size: 1.1rem; }
#mcSpark .mcs-add:hover { background: #247a4d; }
#mcSpark .mcs-chips { display: flex; flex-wrap: wrap; gap: 8px; min-height: 28px; margin-top: 12px; }
#mcSpark .mcs-chips:empty { display: none; }
#mcSpark .mcs-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px;
  background: #e4f7dc; border: 1px solid rgba(36,122,77,.16); color: #247a4d; font-size: .86rem; font-weight: 700; }
#mcSpark .mcs-chip button { border: none; background: none; color: inherit; cursor: pointer; font: inherit; padding: 2px; opacity: .55; min-width: 20px; min-height: 20px; }
#mcSpark .mcs-chip button:hover { opacity: 1; }
#mcSpark .mcs-hint { margin: 10px 0 0; font-size: .78rem; color: #687468; font-weight: 600; }
#mcSpark .mcs-build { margin-top: 0; width: 100%; height: 0; min-height: 0; padding: 0; overflow: hidden; border-radius: 18px; border: none; background: #143a2e;
  color: #fff; font: inherit; font-weight: 800; font-size: .85rem; letter-spacing: .06em; text-transform: uppercase; cursor: pointer;
  opacity: 0; transform: translateY(8px);
  transition: opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1), height .45s cubic-bezier(.16,1,.3,1), margin-top .45s cubic-bezier(.16,1,.3,1); }
#mcSpark .mcs-build.show { margin-top: 14px; height: 44px; opacity: 1; transform: translateY(0); }
#mcSpark .mcs-build:hover { background: #247a4d; }
#mcSpark .mcs-pulse { font-size: .82rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #247a4d; animation: mcsPulse 1.5s ease infinite; }
#mcSpark .mcs-paper { width: min(700px, 94vw); max-height: min(86vh, calc(100vh - 128px)); overflow: auto; padding: 28px; border-radius: 32px; text-align: left;
  background: linear-gradient(180deg, #fffdf7, #f8fbeb); border: 1px solid rgba(20,58,46,.14); box-shadow: 0 24px 70px rgba(29,84,54,.14);
  transform: scale(.97); }
#mcSpark .mcs-fade.in.mcs-paper { transform: scale(1); }
#mcSpark .mcs-stamp { font-size: .7rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #247a4d; margin: 0 0 12px; }
#mcSpark .mcs-intro { font-size: 1.12rem; line-height: 1.55; margin: 0 0 14px; font-weight: 600; }
#mcSpark .mcs-stem { font-size: 1.02rem; line-height: 1.6; color: #2d4a3e; margin: 16px 0; padding-top: 14px; border-top: 1px solid rgba(20,58,46,.14); }
#mcSpark .mcs-choice { display: block; width: 100%; text-align: left; min-height: 44px; padding: 14px 16px; margin-bottom: 8px;
  border-radius: 18px; border: 1px solid rgba(20,58,46,.14); background: #fff; font: inherit; font-size: .96rem; cursor: pointer;
  transition: all .2s cubic-bezier(.16,1,.3,1); color: #143a2e; }
#mcSpark .mcs-choice:hover:not(:disabled) { border-color: rgba(36,122,77,.4); box-shadow: 0 0 0 4px rgba(95,183,121,.1); }
#mcSpark .mcs-choice.picked { border-color: #5fb779; box-shadow: 0 0 0 4px rgba(95,183,121,.15); }
#mcSpark .mcs-choice:disabled { opacity: .85; cursor: default; }
#mcSpark .mcs-fb { display: none; margin-top: 14px; padding: 14px 16px; border-radius: 16px; background: #e4f7dc;
  border-left: 3px solid #5fb779; line-height: 1.5; font-weight: 600; }
#mcSpark .mcs-fb.show { display: block; }
#mcSpark .mcs-finale { width: min(520px, 94vw); padding: 36px 28px; border-radius: 32px; background: rgba(255,253,247,.92);
  border: 1px solid rgba(20,58,46,.14); box-shadow: 0 24px 70px rgba(29,84,54,.14); transform: translateY(16px); }
#mcSpark .mcs-fade.in.mcs-finale { transform: translateY(0); }
#mcSpark .mcs-finale h2 { font-family: Fredoka, system-ui, sans-serif; font-size: 2.2rem; margin: 8px 0 12px; }
#mcSpark .mcs-finale p { color: #687468; line-height: 1.5; margin: 0; font-weight: 600; }
#mcSpark .mcs-bridge { margin-top: 22px; padding-top: 22px; border-top: 1px solid rgba(20,58,46,.14);
  opacity: 0; transition: opacity .9s cubic-bezier(.16,1,.3,1); }
#mcSpark .mcs-bridge.show { opacity: 1; }
#mcSpark .mcs-bridge > p { margin-bottom: 18px; font-size: 1.02rem; color: #143a2e; }
#mcSpark .mcs-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
#mcSpark .mcs-cta { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 20px; border-radius: 22px;
  border: 1px solid rgba(20,58,46,.14); background: #fffdf7; color: #143a2e; font-weight: 800; font-size: .72rem;
  letter-spacing: .08em; text-transform: uppercase; text-decoration: none; cursor: pointer; font-family: inherit; }
#mcSpark .mcs-cta:hover { transform: translateY(-1px); }
#mcSpark .mcs-note { margin-top: 16px !important; font-size: .72rem !important; font-weight: 700 !important; }
#mcSpark .mcs-skip { position: absolute; right: 18px; top: max(18px, env(safe-area-inset-top)); z-index: 5; min-height: 40px; padding: 9px 14px;
  border-radius: 999px; border: 1px solid rgba(20,58,46,.14); background: rgba(255,253,247,.85); color: #687468;
  font: inherit; font-size: .75rem; font-weight: 700; cursor: pointer; backdrop-filter: blur(8px); }
@keyframes mcsPulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  #mcSpark, #mcSpark .mcs-fade, #mcSpark .mcs-build, #mcSpark .mcs-bridge { transition-duration: .25s; transform: none !important; }
  #mcSpark .mcs-pulse { animation: none; opacity: 1; }
}
.mc-memory-chip { display: inline-flex; align-items: center; gap: 10px; margin-top: 18px; padding: 11px 16px;
  border-radius: 999px; background: #e4f7dc; border: 1px solid rgba(36,122,77,.18); color: #247a4d;
  font-size: 15px; font-weight: 800; animation: mcChipIn .8s cubic-bezier(.16,1,.3,1); }
.mc-memory-chip:before { content: ""; width: 9px; height: 9px; border-radius: 999px; background: #f5d348; box-shadow: 0 0 0 4px rgba(245,211,72,.25); }
@keyframes mcChipIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
`

// ── bubble field (2D canvas — deliberately light) ────────────────
function makeField(canvas) {
  const ctx = canvas.getContext('2d')
  const mobile = innerWidth < 640
  const N = mobile ? 28 : 48
  const HUES = [128, 98, 145, 42, 195, 168, 115, 78]
  const bubbles = []
  for (let i = 0; i < N; i++) {
    bubbles.push({
      x: Math.random(), y: Math.random(),
      r: 8 + Math.pow(Math.random(), 1.7) * (mobile ? 46 : 64),
      hue: HUES[i % HUES.length],
      phase: Math.random() * Math.PI * 2,
      vx: (Math.random() - .5) * .00016, vy: (Math.random() - .5) * .00013,
      alpha: .10 + Math.random() * .16,
    })
  }
  const state = { gather: 0, raf: 0, dead: false }
  function resize() {
    canvas.width = innerWidth * devicePixelRatio
    canvas.height = innerHeight * devicePixelRatio
  }
  resize()
  addEventListener('resize', resize)
  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const W = canvas.width, H = canvas.height
    for (const b of bubbles) {
      let x = (b.x + Math.sin(t * .00045 + b.phase) * .012 + b.vx * t) % 1
      let y = (b.y + Math.cos(t * .00038 + b.phase) * .01 + b.vy * t) % 1
      if (x < 0) x += 1
      if (y < 0) y += 1
      if (state.gather > 0) {
        x += (.5 - x) * state.gather * .6
        y += (.5 - y) * state.gather * .6
      }
      const px = x * W, py = y * H, pr = b.r * devicePixelRatio
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr)
      g.addColorStop(0, `hsla(${b.hue}, 70%, 70%, ${b.alpha})`)
      g.addColorStop(.6, `hsla(${b.hue}, 70%, 72%, ${b.alpha * .4})`)
      g.addColorStop(1, 'hsla(0, 0%, 100%, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (REDUCED) {
    draw(0) // static field — crossfade-only variant
  } else {
    const loop = (t) => {
      if (state.dead) return
      draw(t)
      state.raf = requestAnimationFrame(loop)
    }
    state.raf = requestAnimationFrame(loop)
  }
  return {
    setGather(g) { state.gather = g; if (REDUCED) draw(0) },
    tint(hue) {
      let n = 0
      for (const b of bubbles) {
        if (Math.abs(b.hue - hue) < 50 || Math.abs(b.hue - hue) > 310) { b.hue = hue; b.alpha = Math.min(.3, b.alpha + .06); n++ }
      }
      if (!n && bubbles.length) { bubbles[0].hue = hue }
      if (REDUCED) draw(0)
    },
    destroy() { state.dead = true; cancelAnimationFrame(state.raf) },
  }
}

// ── overlay ──────────────────────────────────────────────────────
let mounted = null

export function launch() {
  if (mounted) return
  try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }

  const style = document.createElement('style')
  style.id = 'mcSparkStyle'
  style.textContent = CSS
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = 'mcSpark'
  root.innerHTML = `
    <canvas></canvas>
    <div class="mcs-stage"></div>
    <button class="mcs-skip" type="button" hidden>${COPY.skip}</button>`
  document.body.appendChild(root)
  const prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  const stage = root.querySelector('.mcs-stage')
  const skipBtn = root.querySelector('.mcs-skip')
  const field = makeField(root.querySelector('canvas'))
  const interests = []
  let bank = null
  let completed = false
  let buildTimer = null
  const timers = []
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t }

  mounted = { root, style, field }
  requestAnimationFrame(() => root.classList.add('on'))

  function setStage(html, live = false) {
    stage.innerHTML = html
    stage.classList.toggle('live', live)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => stage.querySelectorAll('.mcs-fade').forEach(el => el.classList.add('in'))))
  }

  async function loadBank() {
    if (bank) return bank
    const res = await fetch(new URL('./spark-bank.json', import.meta.url))
    bank = await res.json()
    return bank
  }

  // ── beat 1: arrival ── (brief title beat; the promise rides into the invite panel)
  function arrival() {
    setStage(`
      <div class="mcs-fade">
        <div class="mcs-logo">${COPY.title}</div>
      </div>`)
    later(() => { skipBtn.hidden = false; invite() }, REDUCED ? 900 : 1500)
  }

  // ── beat 2/3: invitation ──
  function invite() {
    field.setGather(.12)
    setStage(`
      <div class="mcs-panel mcs-fade">
        <h2>${COPY.inviteTitle}</h2>
        <p class="mcs-sub">${COPY.promiseA} ${COPY.promiseB}</p>
        <div class="mcs-field">
          <input id="mcsInp" placeholder="${COPY.placeholder}" autocomplete="off" />
          <button class="mcs-add" id="mcsAdd" type="button" aria-label="Add interest">↑</button>
        </div>
        <div class="mcs-chips" id="mcsChips"></div>
        <p class="mcs-hint" id="mcsHint">${COPY.inviteHint0}</p>
        <button class="mcs-build" id="mcsBuild" type="button">${COPY.buildBtn}</button>
      </div>`, true)
    const inp = stage.querySelector('#mcsInp')
    const hint = stage.querySelector('#mcsHint')
    const build = stage.querySelector('#mcsBuild')

    function renderChips() {
      stage.querySelector('#mcsChips').innerHTML = interests
        .map((v, i) => `<span class="mcs-chip">${v}<button type="button" data-i="${i}" aria-label="Remove ${v}">×</button></span>`)
        .join('')
      stage.querySelectorAll('.mcs-chip button').forEach(x => {
        x.onclick = () => { interests.splice(Number(x.dataset.i), 1); renderChips(); sync() }
      })
    }
    function sync() {
      if (buildTimer) { clearTimeout(buildTimer); buildTimer = null }
      hint.textContent = interests.length === 0 ? COPY.inviteHint0
        : interests.length === 1 ? COPY.inviteHint1
        : interests.length < 4 ? COPY.inviteHintMore
        : COPY.inviteHintMax
      build.classList.toggle('show', interests.length >= 2)
      if (interests.length >= 2) buildTimer = later(buildScene, 2600)
    }
    function add() {
      // Split compound input on conjunctions/separators: "chemistry and math",
      // "art, music", "coding & gaming", "space + soccer", pasted newlines.
      const pieces = inp.value.split(/\s+and\s+|[,;+&\n/]+/i).map(s => s.trim()).filter(Boolean)
      if (!pieces.length) return
      if (interests.length >= 4) { hint.textContent = COPY.inviteHintMax; return }
      const seen = new Set(interests.map(v => v.toLowerCase()))
      for (const piece of pieces) {
        if (interests.length >= 4) break // cap respected — extras dropped gracefully
        if (seen.has(piece.toLowerCase())) continue
        seen.add(piece.toLowerCase())
        interests.push(piece)
      }
      inp.value = ''
      const hue = (interests.join('').split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0) >>> 0) % 360
      field.tint(hue)
      renderChips()
      sync()
    }
    stage.querySelector('#mcsAdd').onclick = add
    build.onclick = () => { if (interests.length >= 2) buildScene() }
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add() } }
    inp.focus()
  }

  // ── beat 4: the spark ──
  let building = false
  async function buildScene() {
    if (building) return
    building = true
    if (buildTimer) { clearTimeout(buildTimer); buildTimer = null }
    field.setGather(1)
    setStage(`<p class="mcs-pulse mcs-fade">${COPY.loading}</p>`)
    const started = Date.now()

    let apiPayload = null
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 3500)
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests }),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (res.ok) apiPayload = await res.json()
    } catch { /* offline weave below */ }

    const data = await loadBank()
    const payload = apiPayload?.generated ? apiPayload : fuse(interests, data)
    const wait = Math.max(0, 1200 - (Date.now() - started))
    later(() => showQuestion(payload), wait)
  }

  function showQuestion(p) {
    field.setGather(.3)
    setStage(`
      <div class="mcs-paper mcs-fade">
        <p class="mcs-stamp">${p.protagonist} · ${p.setting}</p>
        <p class="mcs-intro">${p.storyIntro}</p>
        <p class="mcs-stem">${p.storyStem}</p>
        ${p.choices.map((c, i) => `<button class="mcs-choice" data-i="${i}">${c}</button>`).join('')}
        <p class="mcs-hint" id="mcsPickHint">${COPY.pickHint}</p>
        <p class="mcs-fb" id="mcsFb"></p>
      </div>`, true)
    const fb = stage.querySelector('#mcsFb')
    stage.querySelectorAll('.mcs-choice').forEach(btn => {
      btn.onclick = () => {
        stage.querySelectorAll('.mcs-choice').forEach(b => (b.disabled = true))
        btn.classList.add('picked')
        stage.querySelector('#mcsPickHint')?.remove()
        // C4: record the choice, never a verdict — the world responds.
        const ok = Number(btn.dataset.i) === p.correctIndex
        fb.textContent = ok ? p.worldFeedback.correct : p.worldFeedback.incorrect
        fb.classList.add('show')
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            interests: [...interests],
            questionId: p.questionId,
            conceptId: p.conceptId,
            selectedIndex: Number(btn.dataset.i),
          }))
        } catch { /* private mode */ }
        later(finale, 2600)
      }
    })
  }

  // ── beat 5: handoff ──
  function finale() {
    completed = true
    field.setGather(.1)
    const built = interestLine(interests)
    setStage(`
      <div class="mcs-finale mcs-fade">
        <p class="mcs-stamp">${COPY.finaleStamp}</p>
        <h2>${COPY.finaleTitle}</h2>
        <p>${COPY.builtAround(built)}</p>
        <div class="mcs-bridge" id="mcsBridge">
          <p>${COPY.bridge}</p>
          <div class="mcs-actions">
            <button class="mcs-cta" id="mcsReviews" type="button">${COPY.seeReviews}</button>
            <button class="mcs-cta" id="mcsExplore" type="button">${COPY.keepExploring}</button>
          </div>
          <p class="mcs-hint mcs-note">${COPY.autoNote}</p>
        </div>
      </div>`, true)
    later(() => stage.querySelector('#mcsBridge')?.classList.add('show'), 2000)
    stage.querySelector('#mcsReviews').onclick = () => close('#proof')
    stage.querySelector('#mcsExplore').onclick = () => close(null)
    later(() => close('#proof'), 6500)
  }

  let closing = false
  function close(anchor) {
    if (closing) return
    closing = true
    timers.forEach(clearTimeout)
    field.setGather(0)
    root.classList.add('leaving')
    later(() => {
      field.destroy()
      root.remove()
      style.remove()
      document.body.style.overflow = prevOverflow
      mounted = null
      if (anchor) document.querySelector(anchor)?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' })
      if (completed) addMemoryChip()
    }, REDUCED ? 300 : 1100)
  }

  function addMemoryChip() {
    if (document.querySelector('.mc-memory-chip')) return
    const home = document.querySelector('.hero-copy')
    if (!home || !interests.length) return
    const chip = document.createElement('p')
    chip.className = 'mc-memory-chip'
    chip.textContent = COPY.memoryChip(interestLine(interests))
    home.appendChild(chip)
  }

  skipBtn.onclick = () => close(null)
  loadBank().catch(() => {})
  arrival()
}

/** First-visit auto launch (Option A). Called from index.html. */
export function autoLaunch() {
  let seen = null
  try { seen = sessionStorage.getItem(SEEN_KEY) } catch { return }
  if (seen) return
  launch()
}
