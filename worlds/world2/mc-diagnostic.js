/**
 * In-world diagnostic overlay for Nox's kitchen (projects / diagnostics screen).
 * Opens when the player clicks the Diagnostics sign in the 3D world, or via "Let Nox Cook".
 */
(function () {
  var ML_BASE = 'https://mindcraft-ml-630302850770.us-central1.run.app'
  var APP_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4321'
    : 'https://mindcraft-93858.web.app'

  var params = new URLSearchParams(window.location.search)
  var studentId = params.get('student') || params.get('uid') || ''
  var spec = null
  var step = 'intro'
  var goalTags = []
  var goalText = ''
  var confidence = {}
  var probeIdx = 0
  var picked = null
  var probePhase = 'answer' // answer | feedback

  var ENCOURAGEMENT = [
    'You\'re doing great — keep going!',
    'Every answer helps Jesse cook up your path.',
    'Nice work — one question at a time.',
    'Love the effort — Jesse\'s taking notes.',
    'Keep it up — you\'re building something good here.',
  ]
  var lastCorrect = false
  var correctCount = 0
  var questionStart = 0
  var probeAdvanceTimer = null
  var root, panel

  function $(sel) { return root.querySelector(sel) }

  function normalize(v) {
    return (v || '').toLowerCase().replace(/[\s−–—]+/g, '').replace(/[^\w/().+-]/g, '')
  }

  function sendLearningEvent(payload) {
    if (!studentId) return Promise.resolve(false)
    return fetch(ML_BASE + '/learning-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        subject_id: payload.subjectId || 'math',
        concept_id: payload.conceptId,
        event_type: payload.eventType,
        outcome: payload.outcome != null ? payload.outcome : null,
        duration_ms: payload.durationMs || null,
        source: 'diagnostic',
        metadata: payload.metadata || {},
      }),
    }).then(function (r) { return r.ok }).catch(function () { return false })
  }

  function render() {
    if (!spec || !panel) return
    var html = ''
    var presets = spec.goals_step.presets || []
    var concepts = spec.confidence_step.concepts || []
    var scale = spec.confidence_step.scale || []
    var probes = spec.probe_step.questions || []

    if (step === 'intro') {
      html += '<h2 class="mc-diag-title">' + esc(spec.intro.title) + '</h2>'
      html += '<p class="mc-diag-body">' + esc(spec.intro.body) + '</p>'
      html += '<button class="mc-diag-primary" data-action="next">Start</button>'
    } else if (step === 'goals') {
      html += '<h2 class="mc-diag-title">' + esc(spec.goals_step.prompt) + '</h2>'
      var goalsPlaceholder = spec.goals_step.placeholder || 'Tell us what you are aiming for…'
      html += '<div class="mc-diag-tags">'
      presets.forEach(function (p) {
        html += '<button class="mc-diag-tag' + (goalTags.indexOf(p) >= 0 ? ' on' : '') + '" data-goal="' + escAttr(p) + '">' + esc(p) + '</button>'
      })
      html += '</div>'
      html += '<textarea class="mc-diag-textarea" id="mc-diag-goals-text" placeholder="' + escAttr(goalsPlaceholder) + '" rows="6">' + esc(goalText) + '</textarea>'
      html += '<button class="mc-diag-primary" data-action="next"' + (goalTags.length === 0 && !goalText.trim() ? ' disabled' : '') + '>Next</button>'
    } else if (step === 'confidence') {
      html += '<h2 class="mc-diag-title">' + esc(spec.confidence_step.prompt) + '</h2>'
      html += '<p class="mc-diag-note">' + esc(spec.confidence_step.note) + '</p>'
      html += '<div class="mc-diag-conf">'
      concepts.forEach(function (c) {
        html += '<div class="mc-diag-conf-row"><div class="mc-diag-conf-name">' + esc(c.name) + '</div><div class="mc-diag-scale">'
        scale.forEach(function (s) {
          html += '<button class="' + (confidence[c.concept_id] === s.value ? 'on' : '') + '" data-conf="' + escAttr(c.concept_id) + '" data-val="' + s.value + '">' + esc(s.label) + '</button>'
        })
        html += '</div></div>'
      })
      html += '</div>'
      var done = Object.keys(confidence).length >= concepts.length
      html += '<button class="mc-diag-primary" data-action="next"' + (done ? '' : ' disabled') + '>Next</button>'
    } else if (step === 'probes' && probes[probeIdx]) {
      var probe = probes[probeIdx]
      html += '<h2 class="mc-diag-title">' + esc(probe.stem) + '</h2>'

      if (probePhase === 'feedback') {
        var msg = ENCOURAGEMENT[probeIdx % ENCOURAGEMENT.length]
        html += '<div class="mc-diag-feedback good"><strong>' + msg + '</strong></div>'
      } else {
        html += '<div class="mc-diag-choices">'
        Object.keys(probe.choices).forEach(function (key) {
          html += '<button class="mc-diag-choice" data-choice="' + escAttr(key) + '"><span class="key">' + esc(key) + '</span><span>' + esc(probe.choices[key]) + '</span></button>'
        })
        html += '</div>'
        html += '<div class="mc-diag-skip-wrap"><button class="mc-diag-skip" type="button" data-action="skip">Skip</button></div>'
      }
    } else if (step === 'done') {
      html += '<h2 class="mc-diag-title">Complete</h2>'
      html += '<p class="mc-diag-body">Lessons will dynamically accommodate you, Jesse really cooked.</p>'
      html += '<button class="mc-diag-primary" data-action="dashboard">Go to dashboard</button>'
    }

    panel.innerHTML = '<button id="mc-diag-close" type="button" aria-label="Close">×</button>' + html

    $('#mc-diag-close').onclick = hide
    panel.querySelectorAll('[data-goal]').forEach(function (btn) {
      btn.onclick = function () {
        var g = btn.getAttribute('data-goal')
        if (goalTags.indexOf(g) >= 0) goalTags = goalTags.filter(function (x) { return x !== g })
        else goalTags.push(g)
        render()
      }
    })
    var ta = $('#mc-diag-goals-text')
    if (ta) {
      ta.oninput = function () {
        goalText = ta.value
        var next = panel.querySelector('[data-action="next"]')
        if (next) next.disabled = goalTags.length === 0 && !goalText.trim()
      }
    }

    panel.querySelectorAll('[data-conf]').forEach(function (btn) {
      btn.onclick = function () {
        confidence[btn.getAttribute('data-conf')] = parseFloat(btn.getAttribute('data-val'))
        render()
      }
    })

    panel.querySelectorAll('[data-choice]').forEach(function (btn) {
      btn.onclick = function () { answerProbe(btn.getAttribute('data-choice')) }
    })

    var nextBtn = panel.querySelector('[data-action="next"]')
    if (nextBtn) nextBtn.onclick = onNext
    var skipBtn = panel.querySelector('[data-action="skip"]')
    if (skipBtn) skipBtn.onclick = skipProbe
    var dashBtn = panel.querySelector('[data-action="dashboard"]')
    if (dashBtn) dashBtn.onclick = function () { window.location.href = APP_BASE + '/dashboard' }
  }

  function onNext() {
    if (step === 'intro') step = 'goals'
    else if (step === 'goals') step = 'confidence'
    else if (step === 'confidence') finishConfidence()
    render()
  }

  function finishConfidence() {
    var entries = Object.keys(confidence)
    entries.forEach(function (cid) {
      sendLearningEvent({
        conceptId: cid,
        eventType: 'confidence_report',
        outcome: null,
        metadata: { confidence: confidence[cid], step: 'confidence' },
      })
    })
    step = 'probes'
    probeIdx = 0
    picked = null
    probePhase = 'answer'
    questionStart = Date.now()
    render()
  }

  function clearProbeAdvanceTimer() {
    if (probeAdvanceTimer) {
      clearTimeout(probeAdvanceTimer)
      probeAdvanceTimer = null
    }
  }

  function scheduleProbeAdvance() {
    clearProbeAdvanceTimer()
    probeAdvanceTimer = setTimeout(advanceProbe, 2000)
  }

  function advanceProbe() {
    clearProbeAdvanceTimer()
    var probes = spec.probe_step.questions
    if (probeIdx + 1 < probes.length) {
      probeIdx++
      picked = null
      probePhase = 'answer'
      questionStart = Date.now()
      render()
    } else {
      complete()
    }
  }

  function answerProbe(key) {
    if (picked || !spec || probePhase !== 'answer') return
    picked = key
    var probes = spec.probe_step.questions
    var probe = probes[probeIdx]
    var chosen = probe.choices[key] || ''
    var correct = normalize(chosen) === normalize(probe.correct_answer)
    lastCorrect = correct
    if (correct) correctCount++
    sendLearningEvent({
      conceptId: probe.concept_id,
      eventType: 'answer_submitted',
      outcome: correct ? 1 : 0,
      durationMs: Date.now() - questionStart,
      metadata: { question_id: probe.question_id, selected: key, step: 'probe' },
    })
    probePhase = 'feedback'
    render()
    scheduleProbeAdvance()
  }

  function skipProbe() {
    clearProbeAdvanceTimer()
    advanceProbe()
  }

  function complete() {
    step = 'done'
    var goals = { tags: goalTags, text: goalText.trim() }
    sendLearningEvent({
      conceptId: 'diagnostic',
      eventType: 'diagnostic_complete',
      metadata: {
        concepts_seen: (spec.confidence_step.concepts || []).length,
        probes_answered: (spec.probe_step.questions || []).length,
        correct: correctCount,
        goals: goals,
      },
    })
    render()
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  }
  function escAttr(s) { return esc(s).replace(/'/g, '&#39;') }

  function show() {
    if (!spec) return
    root.classList.add('show')
    step = 'intro'
    goalTags = []
    goalText = ''
    confidence = {}
    probeIdx = 0
    picked = null
    probePhase = 'answer'
    correctCount = 0
    render()
  }

  function hide() {
    clearProbeAdvanceTimer()
    root.classList.remove('show')
  }

  function boot() {
    root = document.getElementById('mc-diag')
    panel = document.getElementById('mc-diag-panel')
    if (!root || !panel) return

    fetch('data/actDiagnostic.json?v=879bdfe9')
      .then(function (r) { return r.json() })
      .then(function (d) { spec = d })
      .catch(function () { console.warn('MC: could not load diagnostic spec') })

    root.querySelector('#mc-diag-backdrop').onclick = hide

    // Prevent clicks inside the overlay from reaching the THREE.js raycaster on the canvas
    root.addEventListener('click', function (e) { e.stopPropagation() })
    root.addEventListener('pointerdown', function (e) { e.stopPropagation() })
    root.addEventListener('pointerup', function (e) { e.stopPropagation() })
  }

  window.MC_onProjectsOpen = function () { show() }
  window.MC_onProjectsClose = function () { hide() }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
